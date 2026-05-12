/**
 * Command Handler
 * Registers and handles all MokkyBuddy commands
 */

import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { MokkyBuddyApiClient, MockRouteDTO } from '../api/client';
import { ApiKeyManager, Environment } from '../auth/apiKeyManager';
import { ServerTreeDataProvider, ServerTreeItem, RouteTreeItem } from '../providers/treeProvider';
import { SnippetProvider } from '../providers/snippetProvider';
import { StatusBarManager } from '../ui/statusBarManager';
import { TestResultPanel, TestResult } from '../ui/testResultPanel';

export class CommandHandler {
    constructor(
        private apiClient: MokkyBuddyApiClient,
        private apiKeyManager: ApiKeyManager,
        private treeProvider: ServerTreeDataProvider,
        private statusBarManager: StatusBarManager,
        private snippetProvider?: SnippetProvider
    ) {}

    registerAllCommands(context: vscode.ExtensionContext): void {
        // API Key Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.setApiKey', () => this.setApiKey())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.clearApiKey', () => this.clearApiKey())
        );

        // Server Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.createServer', () => this.createServer())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.deleteServer', (item: ServerTreeItem) => 
                this.deleteServer(item)
            )
        );

        // Route Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.createRoute', (item: ServerTreeItem) => 
                this.createRoute(item)
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.editRoute', (item: RouteTreeItem) => 
                this.editRoute(item)
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.deleteRoute', (item: RouteTreeItem) => 
                this.deleteRoute(item)
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.testRoute', (item: RouteTreeItem) => 
                this.testRoute(item)
            )
        );

        // UI Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.refreshServers', () => this.refreshServers())
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.selectEnvironment', () => this.selectEnvironment())
        );

        // Snippet Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.insertSnippet', () => this.insertSnippet())
        );

        // CodeLens Commands
        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.testRouteCodeLens', (route: any) => 
                this.testRouteCodeLens(route)
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.saveRouteCodeLens', (route: any) => 
                this.saveRouteCodeLens(route)
            )
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('mokkyBuddy.openRouteInBrowser', (route: any) => 
                this.openRouteInBrowser(route)
            )
        );
    }

    // ============================================
    // API Key Commands
    // ============================================

    private async setApiKey(): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'Enter your MokkyBuddy API Key',
            prompt: 'API Key will be stored securely',
            password: true
        });

        if (apiKey) {
            await this.apiKeyManager.setApiKey(apiKey);
            this.statusBarManager.updateApiKeyStatus(true);
            this.treeProvider.refresh();
        }
    }

    private async clearApiKey(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to clear your API Key?',
            'Yes',
            'No'
        );

        if (confirm === 'Yes') {
            await this.apiKeyManager.clearApiKey();
            this.statusBarManager.updateApiKeyStatus(false);
            this.treeProvider.refresh();
        }
    }

    // ============================================
    // Server Commands
    // ============================================

    private async createServer(): Promise<void> {
        const name = await vscode.window.showInputBox({
            placeHolder: 'Server name',
            prompt: 'Enter the name of your new server'
        });

        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            placeHolder: 'Server description (optional)',
            prompt: 'Enter a description'
        });

        try {
            const serverId = await this.apiClient.createServer(name, description || undefined);
            vscode.window.showInformationMessage(`✅ Server created: ${name}`);
            this.treeProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to create server: ${error}`);
        }
    }

    private async deleteServer(item: ServerTreeItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Delete server "${item.server.name}"?`,
            'Yes',
            'No'
        );

        if (confirm === 'Yes') {
            try {
                await this.apiClient.deleteServer(item.server.id);
                vscode.window.showInformationMessage(`✅ Server deleted`);
                this.treeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to delete server: ${error}`);
            }
        }
    }

    // ============================================
    // Route Commands
    // ============================================

    private async createRoute(item?: ServerTreeItem): Promise<void> {
        let serverId: string | undefined;

        if (item) {
            serverId = item.server.id;
        } else {
            // No context, ask user to select a server
            try {
                const servers = await this.apiClient.listServers();
                if (servers.length === 0) {
                    vscode.window.showErrorMessage('No servers found. Please create a server first.');
                    return;
                }

                const selected = await vscode.window.showQuickPick(
                    servers.map(s => ({
                        label: s.name,
                        description: s.description,
                        id: s.id
                    })),
                    { placeHolder: 'Select a server to add the route to' }
                );

                if (selected) {
                    serverId = selected.id;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to load servers: ${error}`);
            }
        }

        if (!serverId) {
            return;
        }

        const uri = vscode.Uri.parse(
            `mokkybuddy-route://create?serverId=${serverId}&action=create`
        );

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });

        // Store context for save handling
        const currentServerId = serverId;
        const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc.uri.scheme === 'mokkybuddy-route') {
                await this.saveRoute(currentServerId, savedDoc.getText());
                onSaveDisposable.dispose();
            }
        });
    }

    private async editRoute(item: RouteTreeItem): Promise<void> {
        try {
            const route = await this.apiClient.getRoute(item.serverId, item.route.id);
            const routeJson = JSON.stringify(route);
            
            const uri = vscode.Uri.parse(
                `mokkybuddy-route://edit?serverId=${item.serverId}&routeId=${item.route.id}&action=edit&data=${encodeURIComponent(routeJson)}`
            );

            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            // Store context for save handling
            const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
                if (savedDoc.uri.scheme === 'mokkybuddy-route') {
                    await this.updateRoute(item.serverId, item.route.id, savedDoc.getText());
                    onSaveDisposable.dispose();
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to load route: ${error}`);
        }
    }

    private async deleteRoute(item: RouteTreeItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Delete route "${item.route.method} ${item.route.serverPath}"?`,
            'Yes',
            'No'
        );

        if (confirm === 'Yes') {
            try {
                await this.apiClient.deleteRoute(item.serverId, item.route.id);
                vscode.window.showInformationMessage(`✅ Route deleted`);
                this.treeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to delete route: ${error}`);
            }
        }
    }

    private async saveRoute(serverId: string, content: string): Promise<void> {
        try {
            const route: MockRouteDTO = JSON.parse(content);
            const routeId = await this.apiClient.createRoute(serverId, route);
            vscode.window.showInformationMessage(`✅ Route saved successfully!`);
            this.treeProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to save route: ${error}`);
        }
    }

    private async updateRoute(serverId: string, routeId: string, content: string): Promise<void> {
        try {
            const route: MockRouteDTO = JSON.parse(content);
            await this.apiClient.updateRoute(serverId, routeId, route);
            vscode.window.showInformationMessage(`✅ Route updated successfully!`);
            this.treeProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to update route: ${error}`);
        }
    }

    private async testRoute(item: RouteTreeItem): Promise<void> {
        try {
            vscode.window.showInformationMessage('Testing route...');
            // Test functionality will be implemented in next phase with CodeLens
            vscode.window.showInformationMessage('Route test feature coming soon!');
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to test route: ${error}`);
        }
    }

    // ============================================
    // UI Commands
    // ============================================

    private refreshServers(): void {
        this.treeProvider.refresh();
        vscode.window.showInformationMessage('✅ Servers refreshed');
    }

    private async selectEnvironment(): Promise<void> {
        vscode.window.showInformationMessage('MokkyBuddy Cloud mode is always active. Use "gatewayUrl" setting for developer overrides.');
    }

    // ============================================
    // Snippet Commands
    // ============================================

    private async insertSnippet(): Promise<void> {
        if (!this.snippetProvider) {
            vscode.window.showWarningMessage('⚠️ Snippet provider not available');
            return;
        }

        // Check if an editor is active and focused on a JSON document
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'json') {
            vscode.window.showWarningMessage('❌ Please open a JSON file to insert a snippet');
            return;
        }

        const snippetLabels = this.snippetProvider.getSnippetLabels();
        
        if (snippetLabels.length === 0) {
            vscode.window.showWarningMessage('ℹ️ No snippets available');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            snippetLabels,
            {
                placeHolder: 'Select a snippet template to insert...',
                matchOnDescription: true
            }
        );

        if (selected && selected.detail) {
            const snippetTemplate = this.snippetProvider.getSnippetTemplate(selected.detail);
            if (snippetTemplate) {
                const snippetJson = JSON.stringify(snippetTemplate, null, 2);
                
                // Replace entire document content with snippet
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                
                await editor.edit(editBuilder => {
                    editBuilder.replace(fullRange, snippetJson);
                });
                
                vscode.window.showInformationMessage(`✅ Snippet "${selected.label}" inserted!`);
            }
        }
    }

    // ============================================
    // CodeLens Commands
    // ============================================

    private async testRouteCodeLens(route: any): Promise<void> {
        if (!route.method || !route.path) {
            vscode.window.showErrorMessage('❌ Invalid route: missing method or path');
            return;
        }

        try {
            // Show progress
            const testPromise = this.executeRouteTest(route);
            const result = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Testing API...' },
                () => testPromise
            );

            // Show result panel
            const panel = TestResultPanel.createOrShow(vscode.Uri.file(''));
            panel.displayResult(result);

            if (result.statusCode && result.statusCode >= 200 && result.statusCode < 300) {
                vscode.window.showInformationMessage(`✅ Test successful: ${result.statusCode}`);
            } else if (result.error) {
                vscode.window.showWarningMessage(`⚠️ Test failed: ${result.error}`);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`❌ Error testing route: ${error}`);
        }
    }

    private async saveRouteCodeLens(route: any): Promise<void> {
        // Get active editor context to find server ID
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('❌ No editor active');
            return;
        }

        try {
            // Extract serverId from query if available
            const uri = editor.document.uri;
            const params = new URLSearchParams(uri.query);
            const serverId = params.get('serverId');
            const routeId = params.get('routeId');

            if (!serverId) {
                vscode.window.showErrorMessage('❌ Server ID not found');
                return;
            }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Saving route...' },
                async () => {
                    if (routeId) {
                        // Update existing route
                        await this.apiClient.updateRoute(serverId, routeId, route);
                        vscode.window.showInformationMessage('✅ Route updated!');
                    } else {
                        // Create new route
                        await this.apiClient.createRoute(serverId, route);
                        vscode.window.showInformationMessage('✅ Route created!');
                    }
                    this.treeProvider.refresh();
                }
            );

        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to save route: ${error}`);
        }
    }

    private async openRouteInBrowser(route: any): Promise<void> {
        if (!route.path) {
            vscode.window.showErrorMessage('❌ No path defined');
            return;
        }

        try {
            const env = this.apiKeyManager.getCurrentEnvironment();
            const baseUrl = this.apiKeyManager.getGatewayUrl();
            const fullUrl = `${baseUrl}${route.path}`;

            await vscode.env.openExternal(vscode.Uri.parse(fullUrl));
            vscode.window.showInformationMessage(`🌐 Opening ${fullUrl}`);

        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to open browser: ${error}`);
        }
    }

    private async executeRouteTest(route: any): Promise<TestResult> {
        const env = this.apiKeyManager.getCurrentEnvironment();
        const baseUrl = this.apiKeyManager.getGatewayUrl();
        const fullUrl = `${baseUrl}${route.path}`;

        const result: TestResult = {
            method: route.method,
            path: route.path,
            url: fullUrl,
            timestamp: new Date()
        };

        try {
            const startTime = Date.now();

            const options: any = {
                method: route.method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'MokkyBuddy-VSCode-Extension'
                }
            };

            // Add request body if applicable
            if ((route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') && route.testBody) {
                options.body = typeof route.testBody === 'string' ? route.testBody : JSON.stringify(route.testBody);
            }

            const response = await fetch(fullUrl, options);
            const responseTime = Date.now() - startTime;

            result.statusCode = response.status;
            result.statusText = response.statusText;
            result.responseTime = responseTime;

            // Collect headers
            result.headers = {};
            response.headers.forEach((value: string, name: string) => {
                result.headers![name] = value;
            });

            // Parse response body
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result.responseBody = await response.json();
            } else {
                result.responseBody = await response.text();
            }

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
        }

        return result;
    }
}
