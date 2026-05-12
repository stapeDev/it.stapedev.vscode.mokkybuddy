/**
 * Virtual JSON Document Provider for Route Editing
 * Provides native JSON editing experience through VS Code's custom URI scheme
 */

import * as vscode from 'vscode';
import { SnippetProvider } from './snippetProvider';

export class VirtualJsonEditorProvider implements vscode.TextDocumentContentProvider {
    
    constructor(private snippetProvider?: SnippetProvider) {}
    
    provideTextDocumentContent(uri: vscode.Uri): string {
        const params = new URLSearchParams(uri.query);
        const action = params.get('action') || 'create';
        const serverId = params.get('serverId');

        if (action === 'create') {
            return this.getCreateRouteTemplate(serverId || '');
        } else if (action === 'edit') {
            const routeData = params.get('data');
            if (routeData) {
                return JSON.stringify(JSON.parse(decodeURIComponent(routeData)), null, 2);
            }
        }

        return this.getCreateRouteTemplate(serverId || '');
    }

    private getCreateRouteTemplate(serverId: string): string {
        // Use SnippetProvider if available, otherwise fallback
        let template;
        
        if (this.snippetProvider) {
            template = this.snippetProvider.getBasicTemplate();
        } else {
            template = {
                method: 'GET',
                path: '/api/resource',
                description: 'Brief description of what this endpoint does',
                isEnabled: true,
                responses: [
                    {
                        statusCode: 200,
                        body: {
                            success: true,
                            data: []
                        },
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        delay: 0
                    },
                    {
                        statusCode: 500,
                        body: {
                            error: 'Internal server error'
                        },
                        condition: 'when error occurs'
                    }
                ],
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            };
        }
        
        return JSON.stringify(template, null, 2);
    }

    // Optional: Handle document changes (for saving)
    async onDidChangeEmitter(uri: vscode.Uri, content: string): Promise<void> {
        // This will be called when the user saves the document
        console.log('Virtual document changed:', uri.toString());
        console.log('Content:', content);
    }
}
