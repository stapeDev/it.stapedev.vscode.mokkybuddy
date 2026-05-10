/**
 * MokkyBuddy Extension - Authentication Service
 * Handles login, logout, token refresh, and user management
 */

import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { TokenStorage } from './tokenStorage';
import { 
    AuthResponse, 
    LoginRequest,
    RegisterRequest,
    TokenData, 
    UserDTO, 
    AuthenticationError,
    NetworkError,
    AuthStateChangedEvent 
} from '../models/types';
import { ConfigManager } from '../utils/config';
import { outputChannel } from '../utils/logger.js';

export class AuthService {
    private static instance: AuthService;
    private tokenStorage: TokenStorage;
    private refreshTimer: NodeJS.Timeout | null = null;
    
    // Event emitter for authentication state changes
    private readonly _onAuthStateChanged = new vscode.EventEmitter<AuthStateChangedEvent>();
    public readonly onAuthStateChanged = this._onAuthStateChanged.event;

    private constructor() {
        this.tokenStorage = TokenStorage.getInstance();
    }

    /**
     * Get the AuthService singleton instance
     */
    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    /**
     * Login with username/email and password
     */
    async login(usernameOrEmail: string, password: string): Promise<UserDTO> {
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig();
        const gatewayUrl = configManager.getGatewayUrl();
        const tenantName = config.saas.tenantName;

        const loginRequest: LoginRequest = {
            usernameOrEmail,
            password,
            tenantName
        };

        outputChannel.appendLine(`🔐 Attempting login for: ${usernameOrEmail}`);

        try {
            const response = await fetch(`${gatewayUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(loginRequest)
            });

            if (!response.ok) {
                const errorText = await response.text();
                outputChannel.appendLine(`❌ Login failed: ${response.status} - ${errorText}`);
                
                if (response.status === 401 || response.status === 403) {
                    throw new AuthenticationError('Invalid credentials');
                }
                throw new AuthenticationError(`Login failed: ${errorText}`);
            }

            const authResponse: AuthResponse = await response.json();
            
            // Calculate expiration time
            const expiresAt = authResponse.expiresIn;

            // Get user info
            const user = await this.fetchUserInfo(authResponse.accessToken, gatewayUrl);

            // Store tokens
            const tokenData: TokenData = {
                accessToken: authResponse.accessToken,
                refreshToken: authResponse.refreshToken,
                expiresAt,
                user
            };

            await this.tokenStorage.storeTokens(tokenData);
            
            // Set up auto-refresh if enabled
            if (config.saas.autoRefreshToken) {
                this.setupAutoRefresh(expiresAt);
            }

            // Update VS Code context for UI
            await vscode.commands.executeCommand('setContext', 'mokkyBuddy.isLoggedIn', true);
            
            // Emit auth state change event
            this._onAuthStateChanged.fire({ isLoggedIn: true, user });

            outputChannel.appendLine(`✅ Login successful for: ${user.username}`);
            return user;

        } catch (error: any) {
            if (error instanceof AuthenticationError) {
                throw error;
            }
            outputChannel.appendLine(`❌ Login error: ${error.message}`);
            throw new NetworkError(`Connection error: ${error.message}`);
        }
    }

    /**
     * Register a new user account
     */
    async register(
        username: string, 
        email: string, 
        password: string, 
        firstname?: string, 
        lastname?: string
    ): Promise<UserDTO> {
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig();
        const gatewayUrl = configManager.getGatewayUrl();
        const tenantName = config.saas.tenantName;

        const registerRequest: RegisterRequest = {
            username,
            email,
            password,
            firstname,
            lastname,
            tenantName
        };

        outputChannel.appendLine(`📝 Attempting registration for: ${username}`);

        try {
            const response = await fetch(`${gatewayUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(registerRequest)
            });

            if (!response.ok) {
                const errorText = await response.text();
                outputChannel.appendLine(`❌ Registration failed: ${response.status} - ${errorText}`);
                
                if (response.status === 409) {
                    throw new AuthenticationError('Username or email already exists');
                }
                if (response.status === 400) {
                    throw new AuthenticationError(`Invalid registration data: ${errorText}`);
                }
                throw new AuthenticationError(`Registration failed: ${errorText}`);
            }

            const user: UserDTO = await response.json();
            outputChannel.appendLine(`✅ Registration successful for: ${user.username}`);
            
            return user;

        } catch (error: any) {
            if (error instanceof AuthenticationError) {
                throw error;
            }
            outputChannel.appendLine(`❌ Registration error: ${error.message}`);
            throw new NetworkError(`Connection error: ${error.message}`);
        }
    }

    /**
     * Fetch user information from the API
     */
    private async fetchUserInfo(accessToken: string, gatewayUrl: string): Promise<UserDTO> {
        try {
            const response = await fetch(`${gatewayUrl}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }

            return await response.json();
        } catch (error) {
            // Return minimal user data extracted from token if API fails
            return this.extractUserFromToken(accessToken);
        }
    }

    /**
     * Extract basic user info from JWT token
     */
    private extractUserFromToken(token: string): UserDTO {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
            
            return {
                id: decoded.userID || decoded.sub,
                username: decoded.username || decoded.sub,
                email: decoded.email || '',
                tenantId: decoded.tenantID,
                roles: decoded.roles || []
            };
        } catch {
            return {
                id: '',
                username: 'Unknown',
                email: ''
            };
        }
    }

    /**
     * Logout and clear all stored tokens
     */
    async logout(): Promise<void> {
        outputChannel.appendLine('🔓 Logging out...');
        
        // Clear refresh timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // Clear stored tokens
        await this.tokenStorage.clearTokens();

        // Update VS Code context
        await vscode.commands.executeCommand('setContext', 'mokkyBuddy.isLoggedIn', false);

        // Emit auth state change event
        this._onAuthStateChanged.fire({ isLoggedIn: false });

        outputChannel.appendLine('✅ Logout complete');
    }

    /**
     * Refresh the access token using the refresh token
     */
    async refreshToken(): Promise<boolean> {
        const refreshToken = await this.tokenStorage.getRefreshToken();
        if (!refreshToken) {
            outputChannel.appendLine('❌ No refresh token available');
            return false;
        }

        const configManager = ConfigManager.getInstance();
        const gatewayUrl = configManager.getGatewayUrl();

        outputChannel.appendLine('🔄 Refreshing access token...');

        try {
            const response = await fetch(`${gatewayUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                outputChannel.appendLine(`❌ Token refresh failed: ${response.status}`);
                await this.logout();
                return false;
            }

            const authResponse: AuthResponse = await response.json();
            const expiresAt = authResponse.expiresIn;

            // Get current user
            const currentUser = await this.tokenStorage.getUser();

            // Store new tokens
            const tokenData: TokenData = {
                accessToken: authResponse.accessToken,
                refreshToken: authResponse.refreshToken,
                expiresAt,
                user: currentUser || undefined
            };

            await this.tokenStorage.storeTokens(tokenData);

            // Reset auto-refresh
            const config = ConfigManager.getInstance().getConfig();
            if (config.saas.autoRefreshToken) {
                this.setupAutoRefresh(expiresAt);
            }

            outputChannel.appendLine('✅ Token refreshed successfully');
            return true;

        } catch (error: any) {
            outputChannel.appendLine(`❌ Token refresh error: ${error.message}`);
            await this.logout();
            return false;
        }
    }

    /**
     * Set up automatic token refresh before expiration
     */
    private setupAutoRefresh(expiresAt: number): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Refresh 5 minutes before expiration
        const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000);
        
        if (refreshTime > 0) {
            this.refreshTimer = setTimeout(async () => {
                await this.refreshToken();
            }, refreshTime);
            
            outputChannel.appendLine(`⏰ Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        return await this.tokenStorage.isAuthenticated();
    }

    /**
     * Get current user
     */
    async getCurrentUser(): Promise<UserDTO | null> {
        return await this.tokenStorage.getUser();
    }

    /**
     * Get access token for API calls
     */
    async getAccessToken(): Promise<string | null> {
        // Check if token is about to expire
        const isExpired = await this.tokenStorage.isTokenExpired();
        
        if (isExpired) {
            const refreshed = await this.refreshToken();
            if (!refreshed) {
                return null;
            }
        }

        return await this.tokenStorage.getAccessToken();
    }

    /**
     * Ensure user is logged in, prompt for login if not
     */
    async ensureAuthenticated(): Promise<boolean> {
        if (await this.isAuthenticated()) {
            return true;
        }

        const login = await vscode.window.showInformationMessage(
            'You need to login to use SAAS features',
            'Login',
            'Cancel'
        );

        if (login === 'Login') {
            await vscode.commands.executeCommand('mokkyBuddyAPIRunner.login');
            return await this.isAuthenticated();
        }

        return false;
    }

    /**
     * Initialize auth state on extension activation
     */
    async initializeAuthState(): Promise<void> {
        const isLoggedIn = await this.isAuthenticated();
        await vscode.commands.executeCommand('setContext', 'mokkyBuddy.isLoggedIn', isLoggedIn);
        
        if (isLoggedIn) {
            const user = await this.getCurrentUser();
            this._onAuthStateChanged.fire({ isLoggedIn: true, user: user || undefined });
            
            // Set up auto-refresh if token is still valid
            const config = ConfigManager.getInstance().getConfig();
            if (config.saas.autoRefreshToken) {
                const expiresAt = await this.tokenStorage.getExpirationTime();
                if (expiresAt) {
                    this.setupAutoRefresh(expiresAt);
                }
            }
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this._onAuthStateChanged.dispose();
    }
}
