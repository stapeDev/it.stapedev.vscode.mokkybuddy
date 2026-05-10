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
        
        const endpoints: EnvironmentConfig = {
            local: {
                gatewayUrl: config.get<string>('saas.endpoints.local.gatewayUrl') ?? 'http://localhost:8090',
                mockServerBaseUrl: config.get<string>('saas.endpoints.local.mockServerBaseUrl') ?? 'http://localhost:8083'
            },
            dev: {
                gatewayUrl: config.get<string>('saas.endpoints.dev.gatewayUrl') ?? 'https://gateway.dev.mokkybuddy.stapedev.it',
                mockServerBaseUrl: config.get<string>('saas.endpoints.dev.mockServerBaseUrl') ?? 'https://mock.dev.mokkybuddy.stapedev.it'
            },
            test: {
                gatewayUrl: config.get<string>('saas.endpoints.test.gatewayUrl') ?? 'https://gateway.test.mokkybuddy.stapedev.it',
                mockServerBaseUrl: config.get<string>('saas.endpoints.test.mockServerBaseUrl') ?? 'https://mock.test.mokkybuddy.stapedev.it'
            },
            prod: {
                gatewayUrl: config.get<string>('saas.endpoints.prod.gatewayUrl') ?? 'https://gateway.mokkybuddy.stapedev.it',
                mockServerBaseUrl: config.get<string>('saas.endpoints.prod.mockServerBaseUrl') ?? 'https://mock.mokkybuddy.stapedev.it'
            }
        };

        return {
            javaPath: config.get<string>('javaPath') ?? 'java',
            serverPort: config.get<number>('serverPort') ?? 8081,
            apiMode: config.get<ApiMode>('apiMode') ?? 'file',
            saas: {
                environment: config.get<Environment>('saas.environment') ?? 'local',
                tenantName: config.get<string>('saas.tenantName') ?? 'default',
                autoRefreshToken: config.get<boolean>('saas.autoRefreshToken') ?? true,
                endpoints
            }
        };
    }

    /**
     * Get the current API mode
     */
    getApiMode(): ApiMode {
        return this.getConfig().apiMode;
    }

    /**
     * Check if current mode is SAAS
     */
    isSaasMode(): boolean {
        return this.getApiMode() === 'saas';
    }

    /**
     * Check if current mode is local (file or database)
     */
    isLocalMode(): boolean {
        const mode = this.getApiMode();
        return mode === 'file' || mode === 'database';
    }

    /**
     * Get current environment
     */
    getEnvironment(): Environment {
        return this.getConfig().saas.environment;
    }

    /**
     * Get current environment endpoints
     */
    getCurrentEndpoints(): EnvironmentEndpoints {
        const config = this.getConfig();
        return config.saas.endpoints[config.saas.environment];
    }

    /**
     * Get Gateway URL for current environment
     */
    getGatewayUrl(): string {
        return this.getCurrentEndpoints().gatewayUrl;
    }

    /**
     * Get Mock Server Base URL for current environment
     */
    getMockServerBaseUrl(): string {
        return this.getCurrentEndpoints().mockServerBaseUrl;
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
     * Update the environment
     */
    async setEnvironment(env: Environment): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('saas.environment', env, vscode.ConfigurationTarget.Global);
    }

    /**
     * Update the server port
     */
    async setServerPort(port: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update('serverPort', port, vscode.ConfigurationTarget.Global);
    }

    /**
     * Update SAAS gateway URL for a specific environment
     */
    async setGatewayUrl(env: Environment, url: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update(`saas.endpoints.${env}.gatewayUrl`, url, vscode.ConfigurationTarget.Global);
    }

    /**
     * Update SAAS mock server URL for a specific environment
     */
    async setMockServerBaseUrl(env: Environment, url: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('mokkyBuddy');
        await config.update(`saas.endpoints.${env}.mockServerBaseUrl`, url, vscode.ConfigurationTarget.Global);
    }

    /**
     * Get environment display info
     */
    getEnvironmentInfo(): { name: string; emoji: string; gatewayUrl: string } {
        const env = this.getEnvironment();
        const endpoints = this.getCurrentEndpoints();
        
        const envInfo: Record<Environment, { name: string; emoji: string }> = {
            local: { name: 'Local', emoji: '🏠' },
            dev: { name: 'Development', emoji: '🔧' },
            test: { name: 'Test/Staging', emoji: '🧪' },
            prod: { name: 'Production', emoji: '🚀' }
        };

        return {
            ...envInfo[env],
            gatewayUrl: endpoints.gatewayUrl
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
