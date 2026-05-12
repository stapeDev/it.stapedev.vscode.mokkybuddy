/**
 * Status Bar Manager
 * Displays MokkyBuddy status, environment, and API key status in VS Code status bar
 */

import * as vscode from 'vscode';

export class StatusBarManager {
    private environmentStatusBarItem: vscode.StatusBarItem;
    private apiKeyStatusBarItem: vscode.StatusBarItem;

    constructor() {
        // Environment selector status bar
        this.environmentStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.environmentStatusBarItem.command = 'mokkyBuddy.selectEnvironment';
        this.environmentStatusBarItem.show();

        // API Key status bar
        this.apiKeyStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            101
        );
        this.apiKeyStatusBarItem.command = 'mokkyBuddy.setApiKey';
        this.apiKeyStatusBarItem.show();
    }

    updateEnvironment(environment: string): void {
        this.environmentStatusBarItem.text = `$(server-environment) MokkyBuddy: ${environment.toUpperCase()}`;
        this.environmentStatusBarItem.tooltip = `Current environment: ${environment}`;
    }

    updateApiKeyStatus(hasKey: boolean): void {
        if (hasKey) {
            this.apiKeyStatusBarItem.text = '$(key) API Key: Connected';
            this.apiKeyStatusBarItem.tooltip = 'API Key is configured';
            this.apiKeyStatusBarItem.color = new vscode.ThemeColor('charts.green');
        } else {
            this.apiKeyStatusBarItem.text = '$(key) API Key: Not Set';
            this.apiKeyStatusBarItem.tooltip = 'Click to configure API Key';
            this.apiKeyStatusBarItem.color = new vscode.ThemeColor('charts.red');
        }
    }

    dispose(): void {
        this.environmentStatusBarItem.dispose();
        this.apiKeyStatusBarItem.dispose();
    }
}
