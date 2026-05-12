/**
 * MokkyBuddy VS Code Extension - Main Entry Point
 * Cloud-native API mock manager for MokkyBuddy SaaS platform
 * Exclusively connects to MokkyBuddy cloud via API Key
 */

import * as vscode from 'vscode';
import { ApiKeyManager } from './auth/apiKeyManager';
import { MokkyBuddyApiClient } from './api/client';
import { ServerTreeDataProvider } from './providers/treeProvider';
import { VirtualJsonEditorProvider } from './providers/virtualJsonProvider';
import { RouteCodeLensProvider } from './providers/routeCodeLensProvider';
import { SnippetProvider } from './providers/snippetProvider';
import { StatusBarManager } from './ui/statusBarManager';
import { CommandHandler } from './commands/commandHandler';

let context: vscode.ExtensionContext;

export async function activate(ctx: vscode.ExtensionContext) {
    context = ctx;
    console.log('🚀 MokkyBuddy Extension activating (Cloud-Native Mode)...');

    try {
        // Initialize API Key Manager
        const apiKeyManager = new ApiKeyManager((ctx as any).secrets);
        
        // Initialize API Client
        const apiClient = new MokkyBuddyApiClient(apiKeyManager);
        
        // Initialize Status Bar Manager
        const statusBarManager = new StatusBarManager();
        
        // Initialize Snippet Provider for templates
        const resourcePath = ctx.extensionPath;
        const snippetProvider = new SnippetProvider(resourcePath);
        
        // Initialize Tree Data Provider
        const treeProvider = new ServerTreeDataProvider(apiClient, apiKeyManager);
        ctx.subscriptions.push(
            vscode.window.registerTreeDataProvider('mokkyBuddyServerView', treeProvider)
        );
        
        // Register Virtual Document Provider for JSON editing
        ctx.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                'mokkybuddy-route', 
                new VirtualJsonEditorProvider(snippetProvider)
            )
        );

        // Register CodeLens Provider for inline test commands
        ctx.subscriptions.push(
            vscode.languages.registerCodeLensProvider(
                { scheme: 'mokkybuddy-route' },
                new RouteCodeLensProvider()
            )
        );
        
        // Initialize Command Handler with snippet provider
        const commandHandler = new CommandHandler(apiClient, apiKeyManager, treeProvider, statusBarManager, snippetProvider);
        commandHandler.registerAllCommands(ctx);
        
        // Display status bar with current environment
        const env = apiKeyManager.getCurrentEnvironment();
        statusBarManager.updateEnvironment(env);
        statusBarManager.updateApiKeyStatus(await apiKeyManager.hasApiKey());
        
        console.log('✅ MokkyBuddy extension activated successfully');
        
    } catch (error) {
        console.error('❌ Error activating MokkyBuddy extension:', error);
        vscode.window.showErrorMessage('Failed to activate MokkyBuddy extension');
    }
}

export function deactivate() {
    console.log('🛑 MokkyBuddy extension deactivating');
}
