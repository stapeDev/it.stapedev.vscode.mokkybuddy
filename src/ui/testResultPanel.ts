/**
 * Test Result Panel - Shows HTTP test results
 * Displays request/response details in a side panel
 */

import * as vscode from 'vscode';

export interface TestResult {
    method: string;
    path: string;
    url: string;
    statusCode?: number;
    statusText?: string;
    responseTime?: number;
    responseBody?: any;
    headers?: Record<string, string>;
    error?: string;
    timestamp?: Date;
}

export class TestResultPanel {
    private static currentPanel: TestResultPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(extensionUri: vscode.Uri) {
        this.panel = vscode.window.createWebviewPanel(
            'mokkyBuddyTestResults',
            'MokkyBuddy Test Results',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri): TestResultPanel {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (TestResultPanel.currentPanel) {
            TestResultPanel.currentPanel.panel.reveal(column);
            return TestResultPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = new TestResultPanel(extensionUri);
        TestResultPanel.currentPanel = panel;
        return panel;
    }

    public displayResult(result: TestResult): void {
        this.panel.webview.html = this.getWebviewContent(result);
    }

    private getWebviewContent(result: TestResult): string {
        const statusClass = result.statusCode && result.statusCode >= 200 && result.statusCode < 300
            ? 'success'
            : result.statusCode && result.statusCode >= 400
            ? 'error'
            : 'warning';

        const statusIcon = statusClass === 'success' ? '✅' : statusClass === 'error' ? '❌' : '⚠️';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #e0e0e0;
            background: #1e1e1e;
            padding: 16px;
        }
        
        .container {
            max-width: 100%;
        }
        
        .status-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #252526;
            border-left: 4px solid #0e639c;
            margin-bottom: 16px;
            border-radius: 4px;
        }
        
        .status-header.success {
            border-left-color: #4ec9b0;
        }
        
        .status-header.error {
            border-left-color: #f48771;
        }
        
        .status-icon {
            font-size: 20px;
        }
        
        .status-text {
            flex: 1;
        }
        
        .status-code {
            font-weight: bold;
            font-size: 16px;
        }
        
        .status-message {
            font-size: 12px;
            opacity: 0.7;
        }
        
        .request-info, .response-info {
            margin-bottom: 16px;
            background: #252526;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .section-title {
            background: #1e1e1e;
            padding: 8px 12px;
            font-weight: bold;
            color: #4ec9b0;
            border-bottom: 1px solid #3e3e42;
        }
        
        .section-content {
            padding: 12px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 8px;
            font-size: 13px;
        }
        
        .info-label {
            min-width: 80px;
            color: #858585;
            font-weight: 500;
        }
        
        .info-value {
            flex: 1;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            color: #ce9178;
        }
        
        .response-body {
            background: #1e1e1e;
            padding: 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .error-message {
            background: #5a1a1a;
            color: #ff6b6b;
            padding: 12px;
            border-radius: 4px;
            border-left: 4px solid #ff6b6b;
            margin-bottom: 16px;
        }
        
        .headers-grid {
            display: grid;
            gap: 8px;
        }
        
        .header-item {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 8px;
            font-size: 12px;
        }
        
        .header-key {
            color: #9cdcfe;
        }
        
        .header-value {
            color: #ce9178;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        ${result.error ? `
            <div class="error-message">
                ❌ ${result.error}
            </div>
        ` : ''}
        
        <div class="status-header ${statusClass}">
            <div class="status-icon">${statusIcon}</div>
            <div class="status-text">
                <div class="status-code">${result.statusCode || 'N/A'} ${result.statusText || 'Unknown'}</div>
                <div class="status-message">${result.responseTime ? result.responseTime + 'ms' : ''}</div>
            </div>
        </div>
        
        <div class="request-info">
            <div class="section-title">Request</div>
            <div class="section-content">
                <div class="info-row">
                    <div class="info-label">Method:</div>
                    <div class="info-value">${result.method}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">URL:</div>
                    <div class="info-value">${result.url}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Path:</div>
                    <div class="info-value">${result.path}</div>
                </div>
            </div>
        </div>
        
        ${result.headers && Object.keys(result.headers).length > 0 ? `
            <div class="response-info">
                <div class="section-title">Response Headers</div>
                <div class="section-content">
                    <div class="headers-grid">
                        ${Object.entries(result.headers).map(([key, value]) => `
                            <div class="header-item">
                                <div class="header-key">${key}:</div>
                                <div class="header-value">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        ` : ''}
        
        ${result.responseBody !== undefined ? `
            <div class="response-info">
                <div class="section-title">Response Body</div>
                <div class="section-content">
                    <div class="response-body">${typeof result.responseBody === 'string' ? result.responseBody : JSON.stringify(result.responseBody, null, 2)}</div>
                </div>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
    }

    public dispose(): void {
        TestResultPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
