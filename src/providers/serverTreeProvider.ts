/**
 * MokkyBuddy Extension - Server Tree Provider
 * TreeDataProvider for displaying servers and routes in the sidebar
 * Supports all three modes: file, database, and saas
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { 
    ApiDef, 
    ServerDef, 
    ApiMode, 
    HttpMethod, 
    UiServer,
    KpiDashboard 
} from '../models/types';
import { ConfigManager } from '../utils/config';
import { ApiKeyService } from '../auth/apiKeyService';
import { ServerApi, RouteApi } from '../api';
import { log, logError } from '../utils/logger';

export class ServerTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Local server management
    private localServers: ServerDef[] = [];
    
    // SAAS data cache
    private saasServers: ServerDef[] = [];
    private cachedKpi: KpiDashboard | null = null;

    // Storage paths
    private storageDir: string;
    private tempConfigPath: string;
    private uiConfigPath: string;

    constructor(
        private context: vscode.ExtensionContext
    ) {
        this.storageDir = context.globalStoragePath || path.join(context.extensionPath, 'storage');
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.tempConfigPath = path.join(this.storageDir, 'api-temp.json');
        this.uiConfigPath = path.join(this.storageDir, 'api-ui.json');

        // Initialize with a default local server
        this.initializeLocalServer();

        // Listen for API key state changes
        ApiKeyService.getInstance().onApiKeyStateChanged(async (event) => {
            if (event.hasApiKey) {
                await this.loadSaasServers();
            } else {
                this.saasServers = [];
                this.cachedKpi = null;
            }
            this.refresh();
        });
    }

    /**
     * Initialize the default local server
     */
    private initializeLocalServer(): void {
        const config = ConfigManager.getInstance().getConfig();
        const localServer: ServerDef = {
            name: 'Localhost',
            port: config.serverPort,
            javaPath: config.javaPath,
            apiList: [],
            running: false,
            isSaas: false
        };
        this.localServers = [localServer];
    }

    /**
     * Get local servers
     */
    getLocalServers(): ServerDef[] {
        return this.localServers;
    }

    /**
     * Get SAAS servers
     */
    getSaasServers(): ServerDef[] {
        return this.saasServers;
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    /**
     * Get tree item
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for a tree item
     */
    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const mode = ConfigManager.getInstance().getApiMode();

        // Root level
        if (!element) {
            return this.getRootItems(mode);
        }

        // Handle different node types
        const contextValue = element.contextValue;

        if (contextValue === 'localServerNode' || contextValue === 'serverNode') {
            return this.getServerChildren(element, mode);
        }

        if (contextValue === 'saasServerNode') {
            return this.getSaasServerChildren(element);
        }

        if (contextValue === 'apiNode') {
            return (element as any).children ?? [];
        }

        return [];
    }

    /**
     * Get root level items based on mode
     */
    private async getRootItems(mode: ApiMode): Promise<vscode.TreeItem[]> {
        const items: vscode.TreeItem[] = [];
        const configManager = ConfigManager.getInstance();

        // Mode indicator
        const modeItem = new vscode.TreeItem(
            `📋 Mode: ${mode.toUpperCase()}`,
            vscode.TreeItemCollapsibleState.None
        );
        modeItem.command = {
            command: 'mokkyBuddyAPIRunner.selectApiMode',
            title: 'Change Mode'
        };
        modeItem.contextValue = 'modeNode';
        items.push(modeItem);

        if (mode === 'saas') {
            // Environment indicator for SAAS mode
            const envInfo = configManager.getEnvironmentInfo();
            const envItem = new vscode.TreeItem(
                `${envInfo.emoji} Environment: ${envInfo.name}`,
                vscode.TreeItemCollapsibleState.None
            );
            envItem.command = {
                command: 'mokkyBuddyAPIRunner.selectEnvironment',
                title: 'Change Environment'
            };
            envItem.tooltip = `Gateway: ${envInfo.gatewayUrl}`;
            envItem.contextValue = 'environmentNode';
            items.push(envItem);

            // SAAS mode items
            const hasApiKey = ApiKeyService.getInstance().hasApiKey();
            
            if (!hasApiKey) {
                const apiKeyItem = new vscode.TreeItem(
                    '🔑 Set API Key',
                    vscode.TreeItemCollapsibleState.None
                );
                apiKeyItem.command = {
                    command: 'mokkyBuddyAPIRunner.setApiKey',
                    title: 'Set API Key'
                };
                apiKeyItem.contextValue = 'apiKeyNode';
                items.push(apiKeyItem);
            } else {
                // API Key configured indicator
                const apiKeyItem = new vscode.TreeItem(
                    '🔑 API Key configured',
                    vscode.TreeItemCollapsibleState.None
                );
                apiKeyItem.contextValue = 'apiKeyConfiguredNode';
                items.push(apiKeyItem);

                // KPI summary
                if (this.cachedKpi) {
                    const kpiItem = new vscode.TreeItem(
                        `📊 ${this.cachedKpi.servers.totalServers} servers, ${this.cachedKpi.apis.totalApis} APIs`,
                        vscode.TreeItemCollapsibleState.None
                    );
                    kpiItem.command = {
                        command: 'mokkyBuddyAPIRunner.showKpi',
                        title: 'Show KPI'
                    };
                    kpiItem.contextValue = 'kpiNode';
                    items.push(kpiItem);
                }

                // SAAS servers
                for (const server of this.saasServers) {
                    const apiCount = server.apiList?.length ?? 0;
                    const serverItem = new vscode.TreeItem(
                        `🖥️ ${server.name} (${apiCount} APIs)`,
                        vscode.TreeItemCollapsibleState.Collapsed
                    );
                    serverItem.contextValue = 'saasServerNode';
                    (serverItem as any).serverData = server;
                    items.push(serverItem);
                }

                // Add new server button
                const addServerItem = new vscode.TreeItem(
                    '➕ Create New Server',
                    vscode.TreeItemCollapsibleState.None
                );
                addServerItem.command = {
                    command: 'mokkyBuddyAPIRunner.createServer',
                    title: 'Create Server'
                };
                addServerItem.contextValue = 'addServerNode';
                items.push(addServerItem);

                // Logout button
                const logoutItem = new vscode.TreeItem(
                    '🚪 Logout',
                    vscode.TreeItemCollapsibleState.None
                );
                logoutItem.command = {
                    command: 'mokkyBuddyAPIRunner.logout',
                    title: 'Logout'
                };
                logoutItem.contextValue = 'logoutNode';
                items.push(logoutItem);
            }
        } else {
            // File or Database mode - show local servers
            for (let i = 0; i < this.localServers.length; i++) {
                const server = this.localServers[i];
                const apiCount = server.apiList?.filter(a => a.path && a.method).length ?? 0;
                const status = server.running ? '🟢' : '⚪';
                
                const serverItem = new vscode.TreeItem(
                    `${status} ${server.name}:${server.port} (${apiCount} APIs)`,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                serverItem.contextValue = 'localServerNode';
                (serverItem as any).serverIndex = i;
                (serverItem as any).serverData = server;
                items.push(serverItem);
            }
        }

        return items;
    }

    /**
     * Get children for a local server node
     */
    private async getServerChildren(element: vscode.TreeItem, mode: ApiMode): Promise<vscode.TreeItem[]> {
        const server = (element as any).serverData as ServerDef;
        if (!server) {
            return [];
        }

        // Load APIs for the server
        await this.loadApisForServer(server, mode);

        const items: vscode.TreeItem[] = [];

        // Start/Stop button
        const toggleItem = new vscode.TreeItem(
            server.running ? '⏹ Stop Server' : '▶ Start Server',
            vscode.TreeItemCollapsibleState.None
        );
        toggleItem.command = {
            command: 'mokkyBuddyAPIRunner.toggleServer',
            title: 'Toggle Server',
            arguments: [server]
        };
        items.push(toggleItem);

        // Port info
        const portItem = new vscode.TreeItem(
            `🔌 Port: ${server.port}`,
            vscode.TreeItemCollapsibleState.None
        );
        portItem.command = {
            command: 'mokkyBuddyAPIRunner.changePort',
            title: 'Change Port',
            arguments: [server]
        };
        items.push(portItem);

        // Config source
        const configLabel = mode === 'file' 
            ? `📁 Config: Local File` 
            : `🗄️ Config: Database`;
        items.push(new vscode.TreeItem(configLabel, vscode.TreeItemCollapsibleState.None));

        // API routes
        server.apiList?.filter(a => a.path && a.method).forEach(api => {
            const apiItem = this.createApiTreeItem(api, server);
            items.push(apiItem);
        });

        // Add API button
        const addItem = new vscode.TreeItem(
            '➕ Add API',
            vscode.TreeItemCollapsibleState.None
        );
        addItem.command = {
            command: 'mokkyBuddyAPIRunner.addAPI',
            title: 'Add API',
            arguments: [server]
        };
        items.push(addItem);

        // File mode specific actions
        if (mode === 'file') {
            const saveItem = new vscode.TreeItem(
                '💾 Save Config',
                vscode.TreeItemCollapsibleState.None
            );
            saveItem.command = {
                command: 'mokkyBuddyAPIRunner.saveAPIConfig',
                title: 'Save Config',
                arguments: [server]
            };
            items.push(saveItem);
        }

        // Load config button
        const loadItem = new vscode.TreeItem(
            '📂 Load Config',
            vscode.TreeItemCollapsibleState.None
        );
        loadItem.command = {
            command: 'mokkyBuddyAPIRunner.loadAPIConfig',
            title: 'Load Config',
            arguments: [server]
        };
        items.push(loadItem);

        return items;
    }

    /**
     * Get children for a SAAS server node
     */
    private async getSaasServerChildren(element: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const server = (element as any).serverData as ServerDef;
        if (!server || !server.id) {
            return [];
        }

        const items: vscode.TreeItem[] = [];

        // Server info
        const configManager = ConfigManager.getInstance();
        const mockUrl = `${configManager.getMockServerBaseUrl()}/${server.id}`;
        
        const urlItem = new vscode.TreeItem(
            `🔗 ${mockUrl}`,
            vscode.TreeItemCollapsibleState.None
        );
        urlItem.tooltip = 'Mock server endpoint URL';
        items.push(urlItem);

        if (server.description) {
            const descItem = new vscode.TreeItem(
                `📝 ${server.description}`,
                vscode.TreeItemCollapsibleState.None
            );
            items.push(descItem);
        }

        // Load routes from SAAS
        try {
            const routes = await RouteApi.getInstance().getAllRoutes(server.id);
            server.apiList = routes.map(r => ({
                id: r.id,
                method: r.method as HttpMethod,
                path: r.path,
                response: r.response,
                expectedBody: r.expectedBody,
                jsonSchema: r.jsonSchema
            }));

            // API routes
            for (const api of server.apiList) {
                const apiItem = this.createApiTreeItem(api, server, true);
                items.push(apiItem);
            }
        } catch (error: any) {
            logError('Failed to load SAAS routes:', error);
            items.push(new vscode.TreeItem('❌ Failed to load routes'));
        }

        // Add route button
        const addItem = new vscode.TreeItem(
            '➕ Add Route',
            vscode.TreeItemCollapsibleState.None
        );
        addItem.command = {
            command: 'mokkyBuddyAPIRunner.addAPI',
            title: 'Add Route',
            arguments: [server]
        };
        items.push(addItem);

        // Upload routes from file
        const uploadItem = new vscode.TreeItem(
            '📤 Upload Routes from File',
            vscode.TreeItemCollapsibleState.None
        );
        uploadItem.command = {
            command: 'mokkyBuddyAPIRunner.loadAPIConfig',
            title: 'Upload Routes',
            arguments: [server]
        };
        items.push(uploadItem);

        // Delete server button
        const deleteItem = new vscode.TreeItem(
            '🗑️ Delete Server',
            vscode.TreeItemCollapsibleState.None
        );
        deleteItem.command = {
            command: 'mokkyBuddyAPIRunner.deleteServer',
            title: 'Delete Server',
            arguments: [server]
        };
        items.push(deleteItem);

        return items;
    }

    /**
     * Create a tree item for an API route
     */
    private createApiTreeItem(api: ApiDef, server: ServerDef, isSaas: boolean = false): vscode.TreeItem {
        const methodColors: Record<string, string> = {
            'GET': '🟢',
            'POST': '🟡',
            'PUT': '🟠',
            'DELETE': '🔴',
            'PATCH': '🟣',
            'HEAD': '⚪',
            'OPTIONS': '⚫'
        };

        const color = methodColors[api.method] || '⚪';
        const apiItem = new vscode.TreeItem(
            `${color} [${api.method}] ${api.path}`,
            vscode.TreeItemCollapsibleState.Collapsed
        );
        apiItem.contextValue = 'apiNode';
        apiItem.tooltip = `${api.method} ${api.path}`;

        // Create children for API details
        const children: vscode.TreeItem[] = [];

        if (api.response !== undefined) {
            const responseItem = new vscode.TreeItem(
                `📤 Response: ${this.preview(api.response)}`,
                vscode.TreeItemCollapsibleState.None
            );
            responseItem.command = {
                command: 'mokkyBuddyAPIRunner.previewJson',
                title: 'Preview',
                arguments: [api.response]
            };
            children.push(responseItem);
        }

        if (api.expectedBody !== undefined) {
            const bodyItem = new vscode.TreeItem(
                `📥 Expected Body: ${this.preview(api.expectedBody)}`,
                vscode.TreeItemCollapsibleState.None
            );
            bodyItem.command = {
                command: 'mokkyBuddyAPIRunner.previewJson',
                title: 'Preview',
                arguments: [api.expectedBody]
            };
            children.push(bodyItem);
        }

        if (api.jsonSchema !== undefined) {
            const schemaItem = new vscode.TreeItem(
                `📋 JSON Schema: ${this.preview(api.jsonSchema)}`,
                vscode.TreeItemCollapsibleState.None
            );
            schemaItem.command = {
                command: 'mokkyBuddyAPIRunner.previewJson',
                title: 'Preview',
                arguments: [api.jsonSchema]
            };
            children.push(schemaItem);
        }

        // Delete button
        const deleteItem = new vscode.TreeItem(
            '🗑️ Delete Route',
            vscode.TreeItemCollapsibleState.None
        );
        deleteItem.command = {
            command: 'mokkyBuddyAPIRunner.deleteAPI',
            title: 'Delete',
            arguments: [server, api]
        };
        children.push(deleteItem);

        (apiItem as any).children = children;
        return apiItem;
    }

    /**
     * Preview JSON content
     */
    private preview(json: any): string {
        if (!json) {
            return '—';
        }
        const s = JSON.stringify(json);
        return s.length > 50 ? s.slice(0, 50) + '…' : s;
    }

    /**
     * Load APIs for a local server based on mode
     */
    async loadApisForServer(server: ServerDef, mode?: ApiMode): Promise<void> {
        const currentMode = mode || ConfigManager.getInstance().getApiMode();

        if (currentMode === 'file') {
            await this.loadApisFromFile(server);
        } else if (currentMode === 'database') {
            await this.loadApisFromDatabase(server);
        }
    }

    /**
     * Load APIs from local file
     */
    private async loadApisFromFile(server: ServerDef): Promise<void> {
        try {
            // Try temp config first (active state)
            if (fs.existsSync(this.tempConfigPath)) {
                const raw = JSON.parse(fs.readFileSync(this.tempConfigPath, 'utf-8')) ?? [];
                server.apiList = Array.isArray(raw) ? raw.filter((a: any) => a.path && a.method) : [];
                return;
            }

            // Fallback to UI config
            if (fs.existsSync(this.uiConfigPath)) {
                const rawList: UiServer[] = JSON.parse(fs.readFileSync(this.uiConfigPath, 'utf-8')) ?? [];
                server.apiList = rawList.find((s: UiServer) => s.name === server.name)?.apiList ?? [];
                return;
            }

            server.apiList = [];
        } catch (e: any) {
            logError('Error loading file config:', e);
            server.apiList = [];
        }
    }

    /**
     * Load APIs from local database server
     */
    private async loadApisFromDatabase(server: ServerDef): Promise<void> {
        if (!server.running) {
            server.apiList = [];
            return;
        }

        try {
            const res = await fetch(`http://localhost:${server.port}/api/mokky/route/`);
            const data: any[] = await res.json();
            server.apiList = data.map(d => ({
                id: String(d.id),
                method: d.method as HttpMethod,
                path: d.path,
                expectedBody: d.expectedBody,
                response: d.response,
                jsonSchema: d.jsonSchema
            }));
        } catch (e: any) {
            logError('Error fetching from database:', e);
            server.apiList = [];
        }
    }

    /**
     * Load SAAS servers from backend
     */
    async loadSaasServers(): Promise<void> {
        try {
            const serverApi = ServerApi.getInstance();
            const routeApi = RouteApi.getInstance();

            // Load servers
            const servers = await serverApi.getAllServers();
            this.saasServers = servers.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                port: 0,
                javaPath: '',
                apiList: [],
                isSaas: true
            }));

            // Load KPI
            try {
                const serverKpi = await serverApi.getKpi();
                const apiKpi = await routeApi.getKpi();
                this.cachedKpi = {
                    servers: serverKpi,
                    apis: apiKpi
                };
            } catch {
                // KPI is optional
            }

            log(`✅ Loaded ${this.saasServers.length} SAAS servers`);
        } catch (error: any) {
            logError('Failed to load SAAS servers:', error);
            this.saasServers = [];
        }
    }

    /**
     * Write active config to temp file
     */
    writeActiveConfig(server: ServerDef): void {
        if (ConfigManager.getInstance().getApiMode() === 'file') {
            try {
                fs.writeFileSync(
                    this.tempConfigPath, 
                    JSON.stringify(server.apiList ?? [], null, 2), 
                    'utf-8'
                );
                log(`💾 Config saved to: ${this.tempConfigPath}`);
            } catch (e: any) {
                logError('Error writing config:', e);
            }
        }
    }

    /**
     * Persist UI config for all servers
     */
    persistUiConfig(): void {
        try {
            const uiServers = this.localServers.map(s => ({
                name: s.name,
                port: s.port,
                javaPath: s.javaPath,
                apiList: s.apiList
            }));
            fs.writeFileSync(this.uiConfigPath, JSON.stringify(uiServers, null, 2), 'utf-8');
            log(`💾 UI config saved to: ${this.uiConfigPath}`);
        } catch (e: any) {
            logError('Error saving UI config:', e);
        }
    }

    /**
     * Get storage paths
     */
    getStoragePaths(): { tempConfig: string; uiConfig: string } {
        return {
            tempConfig: this.tempConfigPath,
            uiConfig: this.uiConfigPath
        };
    }
}
