/**
 * MokkyBuddy Extension - API Key Service
 * Handles API Key management for SAAS authentication
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../utils/config';
import { outputChannel } from '../utils/logger';

const API_KEY_STORAGE_KEY = 'mokkyBuddy.apiKey';

export interface ApiKeyStateChangedEvent {
    hasApiKey: boolean;
}

export class ApiKeyService {
    private static instance: ApiKeyService;
    private globalState: vscode.Memento;
    private cachedApiKey: string | null = null;
    
    // Event emitter for API key state changes
    private readonly _onApiKeyStateChanged = new vscode.EventEmitter<ApiKeyStateChangedEvent>();
    public readonly onApiKeyStateChanged = this._onApiKeyStateChanged.event;

    private constructor() {
        // Will be initialized later
        this.globalState = null as any;
    }

    /**
     * Initialize with extension context
     */
    static initialize(context: vscode.ExtensionContext): void {
        if (!ApiKeyService.instance) {
            ApiKeyService.instance = new ApiKeyService();
        }
        ApiKeyService.instance.globalState = context.globalState;
        
        // Load cached API key from settings or storage
        ApiKeyService.instance.loadApiKey();
    }

    /**
     * Get the ApiKeyService singleton instance
     */
    static getInstance(): ApiKeyService {
        if (!ApiKeyService.instance) {
            ApiKeyService.instance = new ApiKeyService();
        }
        return ApiKeyService.instance;
    }

    /**
     * Load API key from settings or storage
     */
    private loadApiKey(): void {
        // First try from settings
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        const settingsApiKey = config.get<string>('apiKey');
        
        if (settingsApiKey) {
            this.cachedApiKey = settingsApiKey;
            return;
        }
        
        // Then try from global state (for secure storage)
        const storedApiKey = this.globalState?.get<string>(API_KEY_STORAGE_KEY);
        if (storedApiKey) {
            this.cachedApiKey = storedApiKey;
        }
    }

    /**
     * Set the API Key
     */
    async setApiKey(apiKey: string): Promise<void> {
        if (!apiKey || apiKey.trim().length === 0) {
            throw new Error('API Key cannot be empty');
        }

        this.cachedApiKey = apiKey.trim();
        
        // Store in settings for visual feedback and persistence
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('apiKey', this.cachedApiKey, vscode.ConfigurationTarget.Global);
        
        // Store in global state for persistence
        await this.globalState.update(API_KEY_STORAGE_KEY, this.cachedApiKey);
        
        // Update VS Code context for UI
        await vscode.commands.executeCommand('setContext', 'mokkyBuddy.hasApiKey', true);
        
        // Emit state change event
        this._onApiKeyStateChanged.fire({ hasApiKey: true });

        outputChannel.appendLine('✅ API Key configured successfully');
    }

    /**
     * Get the API Key
     */
    getApiKey(): string | null {
        // Reload from settings in case it changed
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        const settingsApiKey = config.get<string>('apiKey');
        
        if (settingsApiKey) {
            this.cachedApiKey = settingsApiKey;
        }
        
        return this.cachedApiKey;
    }

    /**
     * Check if API Key is configured
     */
    hasApiKey(): boolean {
        return this.getApiKey() !== null && this.getApiKey() !== '';
    }

    /**
     * Clear the API Key
     */
    async clearApiKey(): Promise<void> {
        this.cachedApiKey = null;
        
        // Clear from settings
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
        
        // Clear from storage
        await this.globalState.update(API_KEY_STORAGE_KEY, undefined);
        
        // Update VS Code context
        await vscode.commands.executeCommand('setContext', 'mokkyBuddy.hasApiKey', false);
        
        // Emit state change event
        this._onApiKeyStateChanged.fire({ hasApiKey: false });

        outputChannel.appendLine('✅ API Key cleared');
    }

    /**
     * Validate API Key with the server (optional)
     */
    async validateApiKey(): Promise<boolean> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return false;
        }

        const configManager = ConfigManager.getInstance();
        const gatewayUrl = configManager.getGatewayUrl();

        try {
            const response = await fetch(`${gatewayUrl}/api/auth/validate`, {
                method: 'GET',
                headers: {
                    'X-API-Key': apiKey,
                    'Accept': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            outputChannel.appendLine(`⚠️ API Key validation failed: ${error}`);
            return false;
        }
    }

    /**
     * Initialize API Key state on extension activation
     */
    async initializeApiKeyState(): Promise<void> {
        const hasKey = this.hasApiKey();
        await vscode.commands.executeCommand('setContext', 'mokkyBuddy.hasApiKey', hasKey);
        
        this._onApiKeyStateChanged.fire({ hasApiKey: hasKey });
        
        if (hasKey) {
            outputChannel.appendLine('🔑 API Key found, SAAS mode ready');
        }
    }

    /**
     * Ensure API Key is set, prompt if not
     */
    async ensureApiKey(): Promise<boolean> {
        if (this.hasApiKey()) {
            return true;
        }

        const setKey = await vscode.window.showInformationMessage(
            'API Key required for SAAS mode',
            'Set API Key',
            'Cancel'
        );

        if (setKey === 'Set API Key') {
            await vscode.commands.executeCommand('mokkyBuddyAPIRunner.setApiKey');
            return this.hasApiKey();
        }

        return false;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this._onApiKeyStateChanged.dispose();
    }
}
