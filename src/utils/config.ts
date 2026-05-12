/**
 * MokkyBuddy Extension - Configuration Manager
 * Centralized configuration management
 */

import * as vscode from 'vscode';
import { ApiMode, Environment, EnvironmentConfig, EnvironmentEndpoints, MokkyBuddyConfig } from '../models/types';

export class ConfigManager {
    private static instance: ConfigManager;

    private constructor() {}

    /**
     * Get the ConfigManager singleton instance
     */
    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Get the current configuration
     */
    getConfig(): MokkyBuddyConfig {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        
        return {
            javaPath: config.get<string>('javaPath') ?? 'java',
            serverPort: config.get<number>('serverPort') ?? 8081,
            apiMode: config.get<ApiMode>('apiMode') ?? 'saas',
            apiKey: config.get<string>('apiKey'),
            gatewayUrl: config.get<string>('gatewayUrl')
        };
    }

    /**
     * Get the current API mode
     */
    getApiMode(): ApiMode {
        return this.getConfig().apiMode || 'saas';
    }

    /**
     * Check if current mode is SAAS
     */
    isSaasMode(): boolean {
        return true; // Per utente finale è solo SAAS ora
    }

    /**
     * Check if current mode is local (file or database)
     */
    isLocalMode(): boolean {
        return false;
    }

    /**
     * Get current environment
     */
    getEnvironment(): Environment {
        return 'prod';
    }

    /**
     * Get Gateway URL
     */
    getGatewayUrl(): string {
        const config = this.getConfig();
        // Default to production, but allow hidden override for local development
        return config.gatewayUrl || 'http://localhost:8090';
    }

    /**
     * Get Mock Server Base URL
     */
    getMockServerBaseUrl(): string {
        return 'http://localhost:8090';
    }

    /**
     * Get Java path
     */
    getJavaPath(): string {
        return this.getConfig().javaPath;
    }

    /**
     * Get server port (for local modes)
     */
    getServerPort(): number {
        return this.getConfig().serverPort;
    }

    /**
     * Update a configuration value
     */
    async updateConfig<K extends keyof MokkyBuddyConfig>(
        key: K, 
        value: MokkyBuddyConfig[K],
        global: boolean = true
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        const target = global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace;
        await config.update(key, value, target);
    }

    /**
     * Update the API mode
     */
    async setApiMode(mode: ApiMode): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('apiMode', mode, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get environment display info
     */
    getEnvironmentInfo(): { name: string; emoji: string; gatewayUrl: string } {
        return {
            name: 'Cloud',
            emoji: '🚀',
            gatewayUrl: this.getGatewayUrl()
        };
    }

    /**
     * Listen for configuration changes
     */
    onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mokkyBuddy')) {
                callback(e);
            }
        });
    }
}
