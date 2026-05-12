/**
 * API Key Management - Secure handling of MokkyBuddy API credentials
 */

import * as vscode from 'vscode';

export type Environment = 'local' | 'dev' | 'test' | 'prod';

export interface GatewayEndpoints {
    [key: string]: string;
}

export class ApiKeyManager {
    private readonly SECRET_KEY = 'mokkybuddy.apiKey';
    private apiKey: string | null = null;
    
    constructor(private secretStorage: any) {}

    async setApiKey(key: string): Promise<void> {
        this.apiKey = key;
        await this.secretStorage.store(this.SECRET_KEY, key);
        
        // Sync with visible settings
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('apiKey', key, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('✅ API Key saved successfully');
    }

    async getApiKey(): Promise<string | null> {
        // Prefer settings if set, otherwise fallback to secrets
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        const settingsKey = config.get<string>('apiKey');
        
        if (settingsKey) {
            this.apiKey = settingsKey;
            return settingsKey;
        }

        if (!this.apiKey) {
            this.apiKey = await this.secretStorage.get(this.SECRET_KEY) || null;
        }
        return this.apiKey;
    }

    async hasApiKey(): Promise<boolean> {
        const key = await this.getApiKey();
        return !!key;
    }

    async clearApiKey(): Promise<void> {
        this.apiKey = null;
        await this.secretStorage.delete(this.SECRET_KEY);
        
        // Clear from settings too
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('✅ API Key cleared');
    }

    getGatewayUrl(): string {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        // Hidden developer override or default production URL
        return config.get<string>('gatewayUrl') || 'http://localhost:8090';
    }

    getAvailableEnvironments(): Environment[] {
        return ['prod'];
    }

    getCurrentEnvironment(): Environment {
        return 'prod';
    }
}
