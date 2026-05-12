/**
 * Server & Route TreeView Data Provider
 * Displays servers and routes in a hierarchical tree structure with KPI data on hover
 */

import * as vscode from 'vscode';
import { MokkyBuddyApiClient, ServerDTO, MockRouteDTO, KpiRouteDTO } from '../api/client';
import { ApiKeyManager } from '../auth/apiKeyManager';

export class ServerTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private apiClient: MokkyBuddyApiClient,
        private apiKeyManager: ApiKeyManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    async getTreeItem(element: TreeItem): Promise<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        try {
            const hasKey = await this.apiKeyManager.hasApiKey();
            if (!hasKey) {
                return [new TreeItem('Please set your API Key to get started', vscode.TreeItemCollapsibleState.None, 'message')];
            }

            if (!element) {
                // Root level - show servers
                try {
                    const servers = await this.apiClient.listServers();
                    return servers.map(server => 
                        new ServerTreeItem(server, this.apiClient)
                    );
                } catch (error) {
                    console.error('Error loading servers:', error);
                    return [new TreeItem(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, vscode.TreeItemCollapsibleState.None, 'error')];
                }
            } else if (element instanceof ServerTreeItem) {
                // Show routes for this server
                try {
                    const routes = await this.apiClient.listRoutes(element.server.id);
                    return routes.map(route =>
                        new RouteTreeItem(route, element.server.id, this.apiClient)
                    );
                } catch (error) {
                    console.error('Error loading routes:', error);
                    return [];
                }
            }

            return [];
        } catch (error) {
            console.error('Error in getChildren:', error);
            return [];
        }
    }
}

// Base TreeItem class
export class TreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        contextValue?: string
    ) {
        super(label, collapsibleState);
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}

// Server TreeItem with KPI tooltip
export class ServerTreeItem extends TreeItem {
    constructor(
        public server: ServerDTO,
        private apiClient: MokkyBuddyApiClient
    ) {
        super(
            server.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            'serverNode'
        );
        this.id = server.id;
        this.description = `${server.apis || 0} routes`;
        this.iconPath = vscode.ThemeIcon.File;
    }

    async getTooltip(): Promise<string> {
        try {
            // Get KPI on demand
            const kpi = await this.apiClient.getServerKpi();
            return `📊 Total APIs: ${kpi.totalApis} | Requests: ${kpi.totalRequests || 0}`;
        } catch (error) {
            return 'Click to see details';
        }
    }
}

// Route TreeItem with KPI tooltip
export class RouteTreeItem extends TreeItem {
    private kpi: KpiRouteDTO | null = null;

    constructor(
        public route: MockRouteDTO,
        public serverId: string,
        private apiClient: MokkyBuddyApiClient
    ) {
        super(
            `${route.method} ${route.serverPath}`,
            vscode.TreeItemCollapsibleState.None,
            'routeNode'
        );
        this.id = route.id;
        this.description = route.userPath || '';
        
        // Set icon based on HTTP method
        const methodIcon: Record<string, string> = {
            'GET': '$(arrow-down)',
            'POST': '$(add)',
            'PUT': '$(edit)',
            'DELETE': '$(trash)',
            'PATCH': '$(edit)',
        };
        this.iconPath = vscode.ThemeIcon.Folder;
    }

    async getTooltip(): Promise<string> {
        try {
            // Lazy load KPI only when tooltip is requested
            if (!this.kpi) {
                this.kpi = await this.apiClient.getRouteKpi(this.serverId, this.route.id);
            }
            
            return `
📊 Route Statistics:
- Method: ${this.kpi.method}
- Path: ${this.kpi.path}
- Requests: ${this.kpi.totalRequests || 0}
- Success Rate: ${(this.kpi.successRate || 0).toFixed(1)}%
- Avg Response Time: ${this.kpi.averageResponseTime || 0}ms
            `.trim();
        } catch (error) {
            return 'Click to see details';
        }
    }
}
