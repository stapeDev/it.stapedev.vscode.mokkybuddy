/**
 * Route CodeLens Provider
 * Provides inline commands for testing and saving routes
 */

import * as vscode from 'vscode';

export class RouteCodeLensProvider implements vscode.CodeLensProvider {
    
    constructor() {}

    async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        // Only provide code lenses for mokkybuddy-route:// documents
        if (document.uri.scheme !== 'mokkybuddy-route') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];

        try {
            const content = document.getText();
            const routeData = JSON.parse(content);

            // Check if route has required fields
            if (!routeData.method || !routeData.path) {
                return [];
            }

            // Line 1: "Test Route" CodeLens
            const line1 = document.lineAt(0);
            const testCodeLens = new vscode.CodeLens(line1.range, {
                title: '▶️ Test Route',
                command: 'mokkyBuddy.testRouteCodeLens',
                arguments: [routeData]
            });
            codeLenses.push(testCodeLens);

            // Line 2: "Save to Cloud" CodeLens
            if (document.lineCount > 1) {
                const line2 = document.lineAt(1);
                const saveCodeLens = new vscode.CodeLens(line2.range, {
                    title: '☁️ Save to Cloud',
                    command: 'mokkyBuddy.saveRouteCodeLens',
                    arguments: [routeData]
                });
                codeLenses.push(saveCodeLens);
            }

            // Line 3: "Open in Browser" CodeLens (if test results available)
            if (document.lineCount > 2) {
                const line3 = document.lineAt(2);
                const openCodeLens = new vscode.CodeLens(line3.range, {
                    title: '🌐 Open in Browser',
                    command: 'mokkyBuddy.openRouteInBrowser',
                    arguments: [routeData]
                });
                codeLenses.push(openCodeLens);
            }

        } catch (error) {
            // Silently ignore JSON parse errors
            return [];
        }

        return codeLenses;
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.CodeLens {
        return codeLens;
    }
}
