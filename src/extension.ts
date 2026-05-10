/**
 * MokkyBuddy Extension - Main Entry Point
 * Supports three modes: file, database, and saas
 */

import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Internal modules
import { ApiKeyService } from './auth';
import { ServerApi, RouteApi } from './api';
import { ServerTreeProvider } from './providers';
import { ConfigManager } from './utils/config';
import { outputChannel, log, logError, logSuccess, showOutputChannel } from './utils/logger';
import { 
    ServerDef, 
    ApiDef, 
    HttpMethod, 
    ApiMode,
    MockRouteDTO,
    Environment 
} from './models/types';

// Re-export for backwards compatibility
export { outputChannel };

// Export servers for backwards compatibility with tests
export let servers: ServerDef[] = [];

let serverProvider: ServerTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    log('🚀 MokkyBuddy Extension activating...');

    // Initialize services
    ApiKeyService.initialize(context);
    const apiKeyService = ApiKeyService.getInstance();
    const configManager = ConfigManager.getInstance();

    // Initialize tree provider
    serverProvider = new ServerTreeProvider(context);
    
    // Update exported servers reference
    servers = serverProvider.getLocalServers();
    
    // Register tree view
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('mokkyBuddyServerView', serverProvider)
    );

    // Initialize API Key state
    apiKeyService.initializeApiKeyState().then(() => {
        serverProvider.refresh();
    });

    // Get storage paths
    const { tempConfig: TEMP_CONFIG, uiConfig: UI_CONFIG_FILE } = serverProvider.getStoragePaths();

    // Helper functions
    const getCurrentApiMode = (): ApiMode => configManager.getApiMode();
    
    const checkPort = async (port: number): Promise<boolean> => {
        if (process.env.NODE_ENV === 'test') {
            return true;
        }
        return new Promise(resolve => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => server.close(() => resolve(true)));
            server.listen(port);
        });
    };

    const startServer = async (server: ServerDef) => {
        if (!(await checkPort(server.port))) {
            vscode.window.showErrorMessage(`Port ${server.port} is already in use!`);
            logError(`Port ${server.port} already in use`);
            return;
        }

        const jarPath = path.join(context.extensionPath || '', 'resources', 'mokkyBuddyAPI.jar');
        if (!fs.existsSync(jarPath)) {
            vscode.window.showErrorMessage(`JAR not found: ${jarPath}`);
            logError(`JAR not found: ${jarPath}`);
            return;
        }

        const args: string[] = ['-jar', jarPath, `--server.port=${server.port}`];
        const mode = getCurrentApiMode();

        if (mode === 'database') {
            args.push('--spring.profiles.active=databaselocal');
        } else if (mode === 'file') {
            args.push(`--it.stapedev.api.mokkybuddy.loader.mock.route.file=file:${TEMP_CONFIG}`);
            
            // Load API from temp config at startup
            if (fs.existsSync(TEMP_CONFIG)) {
                try {
                    const rawList = JSON.parse(fs.readFileSync(TEMP_CONFIG, 'utf-8')) ?? [];
                    server.apiList = rawList.filter((a: any) => a.path && a.method);
                } catch (e: any) {
                    logError('Error loading TEMP_CONFIG:', e);
                }
            }
        }

        server.process = spawn(server.javaPath, args);
        
        server.process.stdout?.on('data', (chunk: Buffer) => {
            chunk.toString().split(/\r?\n/).filter(l => l).forEach(line => {
                outputChannel.appendLine(`[Spring] ${line}`);
            });
        });
        
        server.process.stderr?.on('data', (chunk: Buffer) => {
            chunk.toString().split(/\r?\n/).filter(l => l).forEach(line => {
                outputChannel.appendLine(`[Spring ERR] ${line}`);
            });
        });
        
        server.process.on('exit', code => {
            server.process = undefined;
            server.running = false;
            serverProvider.refresh();
            log(`⏹ Server ${server.name} exited with code ${code}`);
        });

        server.running = true;
        serverProvider.refresh();
        vscode.window.showInformationMessage(`Server started at http://localhost:${server.port}`);
        logSuccess(`Server started at http://localhost:${server.port}`);
    };

    const stopServer = (server: ServerDef) => {
        server.process?.kill();
        server.running = false;
        serverProvider.refresh();
        vscode.window.showInformationMessage('Server stopped.');
        log('⏹ Server stopped');
    };

    const restartServer = async (server: ServerDef) => {
        if (server.running) {
            stopServer(server);
        }

        // Wait for port to be released
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            if (await checkPort(server.port)) {
                break;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        await startServer(server);
    };

    // ============================================
    // Register Commands
    // ============================================

    // Toggle Server (local modes)
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.toggleServer', async (server: ServerDef) => {
            if (server.running) {
                stopServer(server);
            } else {
                await startServer(server);
            }
        })
    );

    // Change Port
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.changePort', async (server: ServerDef) => {
            const portStr = await vscode.window.showInputBox({
                placeHolder: 'New Port',
                value: String(server.port),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 65535) {
                        return 'Please enter a valid port (1-65535)';
                    }
                    return null;
                }
            });
            
            if (!portStr) {
                return;
            }
            
            const newPort = Number(portStr);
            server.port = newPort;
            await configManager.setServerPort(newPort);
            
            if (server.running) {
                await restartServer(server);
            } else {
                serverProvider.refresh();
            }
        })
    );

    // Preview JSON
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.previewJson', async (json: any) => {
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(json, null, 2),
                language: 'json'
            });
            vscode.window.showTextDocument(doc, { preview: false });
        })
    );

    // Delete API
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteAPI', async (server: ServerDef, api: ApiDef) => {
            const mode = getCurrentApiMode();

            if (mode === 'saas' && server.isSaas && server.id && api.id) {
                try {
                    await RouteApi.getInstance().deleteRoute(server.id, api.id);
                    vscode.window.showInformationMessage('Route deleted from cloud');
                } catch (e: any) {
                    logError('Error deleting SAAS route:', e);
                    vscode.window.showErrorMessage(`Failed to delete route: ${e.message}`);
                    return;
                }
            } else if (mode === 'database' && api.id) {
                try {
                    const res = await fetch(`http://localhost:${server.port}/api/mokky/route/${api.id}/`, { 
                        method: 'DELETE' 
                    });
                    if (!res.ok) {
                        const text = await res.text();
                        logError(`Error deleting API: ${res.status} - ${text}`);
                        return;
                    }
                } catch (e: any) {
                    logError('Error deleting database route:', e);
                    return;
                }
            }

            // Remove from local list
            server.apiList = server.apiList.filter(a => a !== api);
            
            // Write config for file mode
            if (mode === 'file') {
                serverProvider.writeActiveConfig(server);
                if (server.running) {
                    await restartServer(server);
                }
            }

            serverProvider.refresh();
            vscode.window.showInformationMessage('Route deleted');
        })
    );

    // Add API
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.addAPI', async (server: ServerDef) => {
            const methodPick = await vscode.window.showQuickPick(
                ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                { placeHolder: 'Select HTTP Method' }
            );
            if (!methodPick) {
                return;
            }

            const pathInput = await vscode.window.showInputBox({
                placeHolder: '/api/example',
                prompt: 'Enter the API path'
            });
            if (!pathInput) {
                return;
            }

            const responseInput = await vscode.window.showInputBox({
                placeHolder: '{"message": "ok"}',
                prompt: 'Enter response JSON (optional)'
            });

            const expectedBodyInput = await vscode.window.showInputBox({
                placeHolder: '{"name": "string"}',
                prompt: 'Enter expected body JSON (optional)'
            });

            const schemaInput = await vscode.window.showInputBox({
                placeHolder: '{"type": "object", "properties": {...}}',
                prompt: 'Enter JSON Schema (optional)'
            });

            let response: any;
            let expectedBody: any;
            let jsonSchema: any;

            try {
                response = responseInput ? JSON.parse(responseInput) : undefined;
            } catch {
                vscode.window.showErrorMessage('Invalid response JSON');
                return;
            }

            try {
                expectedBody = expectedBodyInput ? JSON.parse(expectedBodyInput) : undefined;
            } catch {
                vscode.window.showErrorMessage('Invalid expected body JSON');
                return;
            }

            try {
                jsonSchema = schemaInput ? JSON.parse(schemaInput) : undefined;
            } catch {
                vscode.window.showErrorMessage('Invalid JSON Schema');
                return;
            }

            const api: ApiDef = {
                method: methodPick as HttpMethod,
                path: pathInput,
                response,
                expectedBody,
                jsonSchema
            };

            const mode = getCurrentApiMode();

            // SAAS mode: create route via API
            if (mode === 'saas' && server.isSaas && server.id) {
                try {
                    const routeApi = RouteApi.getInstance();
                    const routeDTO: MockRouteDTO = {
                        method: api.method,
                        path: api.path,
                        response: api.response,
                        expectedBody: api.expectedBody,
                        jsonSchema: api.jsonSchema
                    };
                    const routeId = await routeApi.createRoute(server.id, routeDTO);
                    api.id = routeId;
                    vscode.window.showInformationMessage('Route created in cloud');
                } catch (e: any) {
                    logError('Error creating SAAS route:', e);
                    vscode.window.showErrorMessage(`Failed to create route: ${e.message}`);
                    return;
                }
            }
            // Database mode: create via local API
            else if (mode === 'database') {
                try {
                    const res = await fetch(`http://localhost:${server.port}/api/mokky/route/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(api)
                    });
                    if (!res.ok) {
                        const text = await res.text();
                        logError(`Error adding API: ${res.status} - ${text}`);
                        return;
                    }
                    const result: any = await res.json();
                    api.id = typeof result === 'string' ? result : result?.id;
                } catch (e: any) {
                    logError('Error adding database route:', e);
                    return;
                }
            }

            // Add to local list
            server.apiList.push(api);
            
            // File mode: save and restart
            if (mode === 'file') {
                serverProvider.writeActiveConfig(server);
                if (server.running) {
                    await restartServer(server);
                }
            }

            serverProvider.refresh();
            vscode.window.showInformationMessage('Route added successfully');
        })
    );

    // Load API Config
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.loadAPIConfig', async (server: ServerDef) => {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: { 'JSON': ['json'] }
            });
            
            if (!files || files.length === 0) {
                return;
            }
            
            const fileUri = files[0];
            const mode = getCurrentApiMode();

            if (mode === 'saas' && server.isSaas && server.id) {
                // Upload to SAAS
                try {
                    await RouteApi.getInstance().uploadRoutes(server.id, fileUri.fsPath);
                    vscode.window.showInformationMessage('Routes uploaded to cloud!');
                } catch (e: any) {
                    logError('Error uploading routes:', e);
                    vscode.window.showErrorMessage(`Failed to upload: ${e.message}`);
                    return;
                }
            } else if (mode === 'database') {
                // Upload to local database
                try {
                    await fetch(`http://localhost:${server.port}/api/mokky/route/clear`, { method: 'POST' });
                    const form = new FormData();
                    form.append('file', fs.createReadStream(fileUri.fsPath));
                    await fetch(`http://localhost:${server.port}/api/mokky/route/load`, {
                        method: 'POST',
                        body: form
                    });
                    vscode.window.showInformationMessage('Config loaded to database!');
                } catch (e: any) {
                    logError('Error loading to database:', e);
                    return;
                }
            } else {
                // File mode: copy to temp config
                fs.copyFileSync(fileUri.fsPath, TEMP_CONFIG);
                
                try {
                    const raw = JSON.parse(fs.readFileSync(TEMP_CONFIG, 'utf-8')) ?? [];
                    server.apiList = Array.isArray(raw) ? raw.filter((a: any) => a.path && a.method) : [];
                } catch (e: any) {
                    logError('Error loading file:', e);
                    server.apiList = [];
                }

                if (server.running) {
                    await restartServer(server);
                }
                vscode.window.showInformationMessage('Config loaded from file!');
            }

            serverProvider.persistUiConfig();
            serverProvider.refresh();
        })
    );

    // Save API Config
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveAPIConfig', async (server: ServerDef) => {
            const uri = await vscode.window.showSaveDialog({
                filters: { 'JSON': ['json'] },
                defaultUri: vscode.Uri.file('mokky-routes.json')
            });

            if (!uri) {
                return;
            }

            try {
                fs.writeFileSync(uri.fsPath, JSON.stringify(server.apiList, null, 2), 'utf-8');
                vscode.window.showInformationMessage(`Config saved to ${uri.fsPath}`);
            } catch (e: any) {
                logError('Error saving config:', e);
                vscode.window.showErrorMessage(`Failed to save: ${e.message}`);
            }
        })
    );

    // Save Config (for tree view button)
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveConfig', async (server: ServerDef) => {
            serverProvider.persistUiConfig();
            vscode.window.showInformationMessage('Configuration saved!');
        })
    );

    // Select API Mode
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.selectApiMode', async () => {
            const mode = await vscode.window.showQuickPick(
                [
                    { label: 'file', description: 'Store APIs in local JSON files' },
                    { label: 'database', description: 'Store APIs in local H2 database' },
                    { label: 'saas', description: 'Connect to MokkyBuddy cloud platform' }
                ],
                { placeHolder: 'Select API Mode' }
            );
            
            if (!mode) {
                return;
            }

            // Stop all local servers
            for (const server of serverProvider.getLocalServers()) {
                if (server.running) {
                    stopServer(server);
                }
            }

            await configManager.setApiMode(mode.label as ApiMode);
            
            vscode.window.showInformationMessage(`API mode changed to: ${mode.label}`);

            // Reset server API lists
            for (const server of serverProvider.getLocalServers()) {
                server.apiList = [];
                await serverProvider.loadApisForServer(server);
            }

            // If switching to SAAS, check API Key
            if (mode.label === 'saas') {
                const hasKey = apiKeyService.hasApiKey();
                if (!hasKey) {
                    const setKey = await vscode.window.showInformationMessage(
                        'API Key required for SAAS mode',
                        'Set API Key',
                        'Cancel'
                    );
                    if (setKey === 'Set API Key') {
                        await vscode.commands.executeCommand('mokkyBuddyAPIRunner.setApiKey');
                    }
                } else {
                    await serverProvider.loadSaasServers();
                }
            }

            serverProvider.refresh();
        })
    );

    // Set API Key
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.setApiKey', async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your MokkyBuddy API Key',
                placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'API Key cannot be empty';
                    }
                    return null;
                }
            });

            if (apiKey) {
                await apiKeyService.setApiKey(apiKey);
                vscode.window.showInformationMessage('API Key configured successfully!');
                
                // Load SAAS servers if in SAAS mode
                if (configManager.getApiMode() === 'saas') {
                    await serverProvider.loadSaasServers();
                }
                serverProvider.refresh();
            }
        })
    );

    // Clear API Key
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.clearApiKey', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to clear the API Key?',
                'Clear',
                'Cancel'
            );
            
            if (confirm === 'Clear') {
                await apiKeyService.clearApiKey();
                serverProvider.refresh();
                vscode.window.showInformationMessage('API Key cleared');
            }
        })
    );

    // Create Server (SAAS)
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.createServer', async () => {
            if (!await apiKeyService.ensureApiKey()) {
                return;
            }

            const name = await vscode.window.showInputBox({
                placeHolder: 'my-mock-server',
                prompt: 'Enter server name'
            });
            
            if (!name) {
                return;
            }

            const description = await vscode.window.showInputBox({
                placeHolder: 'Description (optional)',
                prompt: 'Enter server description'
            });

            try {
                const serverApi = ServerApi.getInstance();
                await serverApi.createServer({ name, description });
                vscode.window.showInformationMessage(`Server "${name}" created!`);
                await serverProvider.loadSaasServers();
                serverProvider.refresh();
            } catch (e: any) {
                logError('Error creating server:', e);
                vscode.window.showErrorMessage(`Failed to create server: ${e.message}`);
            }
        })
    );

    // Delete Server (SAAS)
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteServer', async (server: ServerDef) => {
            if (!server.id) {
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete server "${server.name}"? This action cannot be undone.`,
                'Delete',
                'Cancel'
            );

            if (confirm !== 'Delete') {
                return;
            }

            try {
                const serverApi = ServerApi.getInstance();
                await serverApi.deleteServer(server.id);
                vscode.window.showInformationMessage(`Server "${server.name}" deleted`);
                await serverProvider.loadSaasServers();
                serverProvider.refresh();
            } catch (e: any) {
                logError('Error deleting server:', e);
                vscode.window.showErrorMessage(`Failed to delete server: ${e.message}`);
            }
        })
    );

    // Sync Routes to Cloud
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.syncRoutes', async (server: ServerDef) => {
            if (!await apiKeyService.ensureApiKey()) {
                return;
            }

            // Select target server
            const saasServers = serverProvider.getSaasServers();
            if (saasServers.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    'No SAAS servers found. Create one first?',
                    'Create Server',
                    'Cancel'
                );
                if (create === 'Create Server') {
                    await vscode.commands.executeCommand('mokkyBuddyAPIRunner.createServer');
                }
                return;
            }

            const targetServer = await vscode.window.showQuickPick(
                saasServers.map(s => ({ label: s.name, server: s })),
                { placeHolder: 'Select target server' }
            );

            if (!targetServer || !targetServer.server.id) {
                return;
            }

            try {
                const routeApi = RouteApi.getInstance();
                const routes = server.apiList.filter(a => a.path && a.method);
                
                for (const route of routes) {
                    await routeApi.createRoute(targetServer.server.id, {
                        method: route.method,
                        path: route.path,
                        response: route.response,
                        expectedBody: route.expectedBody,
                        jsonSchema: route.jsonSchema
                    });
                }

                vscode.window.showInformationMessage(
                    `Synced ${routes.length} routes to "${targetServer.label}"`
                );
                await serverProvider.loadSaasServers();
                serverProvider.refresh();
            } catch (e: any) {
                logError('Error syncing routes:', e);
                vscode.window.showErrorMessage(`Failed to sync: ${e.message}`);
            }
        })
    );

    // Show KPI Dashboard
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.showKpi', async () => {
            if (!await apiKeyService.ensureApiKey()) {
                return;
            }

            try {
                const serverApi = ServerApi.getInstance();
                const routeApi = RouteApi.getInstance();
                
                const serverKpi = await serverApi.getKpi();
                const apiKpi = await routeApi.getKpi();

                const kpiContent = `# MokkyBuddy KPI Dashboard

## Servers
- **Total Servers**: ${serverKpi.totalServers}
- **Active Servers**: ${serverKpi.activeServers}
- **Created Today**: ${serverKpi.serversCreatedToday}
- **Created This Week**: ${serverKpi.serversCreatedThisWeek}

## APIs
- **Total APIs**: ${apiKpi.totalApis}
- **Created Today**: ${apiKpi.apisCreatedToday}
- **Created This Week**: ${apiKpi.apisCreatedThisWeek}

### APIs by Method
${Object.entries(apiKpi.apisByMethod || {})
    .map(([method, count]) => `- **${method}**: ${count}`)
    .join('\n')}
`;

                const doc = await vscode.workspace.openTextDocument({
                    content: kpiContent,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            } catch (e: any) {
                logError('Error loading KPI:', e);
                vscode.window.showErrorMessage(`Failed to load KPI: ${e.message}`);
            }
        })
    );

    // Refresh Servers
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.refreshServers', async () => {
            const mode = getCurrentApiMode();
            
            if (mode === 'saas' && apiKeyService.hasApiKey()) {
                await serverProvider.loadSaasServers();
            } else {
                for (const server of serverProvider.getLocalServers()) {
                    await serverProvider.loadApisForServer(server);
                }
            }
            
            serverProvider.refresh();
            vscode.window.showInformationMessage('Servers refreshed');
        })
    );

    // Edit Route (opens JSON editor)
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.editRoute', async (server: ServerDef, api: ApiDef) => {
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(api, null, 2),
                language: 'json'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
        })
    );

    // Select Environment
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.selectEnvironment', async () => {
            const currentEnv = configManager.getEnvironment();
            const envInfo = configManager.getEnvironmentInfo();
            
            interface EnvironmentQuickPickItem extends vscode.QuickPickItem {
                value: Environment;
            }
            
            const environments: EnvironmentQuickPickItem[] = [
                { label: '🏠 Local', value: 'local', description: 'Local development (localhost)' },
                { label: '🔧 Development', value: 'dev', description: 'Development server' },
                { label: '🧪 Test/Staging', value: 'test', description: 'Test/Staging server' },
                { label: '🚀 Production', value: 'prod', description: 'Production server' }
            ];

            const selection = await vscode.window.showQuickPick<EnvironmentQuickPickItem>(
                environments.map(env => ({
                    ...env,
                    picked: env.value === currentEnv,
                    detail: env.value === currentEnv ? `Current: ${envInfo.gatewayUrl}` : undefined
                })),
                { 
                    placeHolder: `Select environment (current: ${envInfo.name})`
                }
            );

            if (!selection) {
                return;
            }

            const newEnv = selection.value;
            
            if (newEnv !== currentEnv) {
                await configManager.setEnvironment(newEnv);
                
                const newInfo = configManager.getEnvironmentInfo();
                vscode.window.showInformationMessage(
                    `Environment changed to ${newInfo.emoji} ${newInfo.name} (${newInfo.gatewayUrl})`
                );
                
                // Refresh servers if in SAAS mode
                if (configManager.isSaasMode() && apiKeyService.hasApiKey()) {
                    await serverProvider.loadSaasServers();
                }
                
                serverProvider.refresh();
            }
        })
    );

    // Configuration change listener
    context.subscriptions.push(
        configManager.onConfigurationChanged((e) => {
            if (e.affectsConfiguration('mokkyBuddy.apiMode') || 
                e.affectsConfiguration('mokkyBuddy.saas.environment')) {
                serverProvider.refresh();
            }
        })
    );

    // Show output channel command
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.showOutput', () => {
            showOutputChannel();
        })
    );

    logSuccess('MokkyBuddy Extension activated!');
}

export function deactivate() {
    log('🛑 MokkyBuddy Extension deactivating...');
    
    // Stop all running servers
    if (serverProvider) {
        for (const server of serverProvider.getLocalServers()) {
            if (server.process) {
                server.process.kill();
            }
        }
    }

    // Dispose API Key service
    ApiKeyService.getInstance().dispose();
    
    log('👋 MokkyBuddy Extension deactivated');
}

