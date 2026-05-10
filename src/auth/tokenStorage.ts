/**
 * MokkyBuddy Extension - Token Storage
 * Secure storage for JWT tokens using VS Code's GlobalState or Memento
 */

import * as vscode from 'vscode';
import { TokenData, UserDTO } from '../models/types';

const TOKEN_KEY = 'mokkybuddy.auth.tokens';
const USER_KEY = 'mokkybuddy.auth.user';

export class TokenStorage {
    private static instance: TokenStorage;
    private globalState: vscode.Memento;
    private memoryCache: TokenData | null = null;

    private constructor(context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
    }

    /**
     * Initialize the TokenStorage singleton
     */
    static initialize(context: vscode.ExtensionContext): TokenStorage {
        if (!TokenStorage.instance) {
            TokenStorage.instance = new TokenStorage(context);
        }
        return TokenStorage.instance;
    }

    /**
     * Get the TokenStorage instance
     */
    static getInstance(): TokenStorage {
        if (!TokenStorage.instance) {
            throw new Error('TokenStorage not initialized. Call initialize() first.');
        }
        return TokenStorage.instance;
    }

    /**
     * Store authentication tokens
     */
    async storeTokens(tokenData: TokenData): Promise<void> {
        this.memoryCache = tokenData;
        await this.globalState.update(TOKEN_KEY, JSON.stringify(tokenData));
        
        if (tokenData.user) {
            await this.globalState.update(USER_KEY, JSON.stringify(tokenData.user));
        }
    }

    /**
     * Retrieve stored tokens
     */
    async getTokens(): Promise<TokenData | null> {
        // Try memory cache first
        if (this.memoryCache && this.memoryCache.expiresAt > Date.now()) {
            return this.memoryCache;
        }

        try {
            const stored = this.globalState.get<string>(TOKEN_KEY);
            if (stored) {
                const tokenData: TokenData = JSON.parse(stored);
                this.memoryCache = tokenData;
                return tokenData;
            }
        } catch (error) {
            console.error('Error retrieving tokens:', error);
        }
        return null;
    }

    /**
     * Get access token if valid
     */
    async getAccessToken(): Promise<string | null> {
        const tokens = await this.getTokens();
        if (tokens && tokens.expiresAt > Date.now()) {
            return tokens.accessToken;
        }
        return null;
    }

    /**
     * Get refresh token
     */
    async getRefreshToken(): Promise<string | null> {
        const tokens = await this.getTokens();
        return tokens?.refreshToken ?? null;
    }

    /**
     * Check if token is expired or about to expire (within 5 minutes)
     */
    async isTokenExpired(bufferMs: number = 5 * 60 * 1000): Promise<boolean> {
        const tokens = await this.getTokens();
        if (!tokens) {
            return true;
        }
        return tokens.expiresAt <= (Date.now() + bufferMs);
    }

    /**
     * Get stored user information
     */
    async getUser(): Promise<UserDTO | null> {
        try {
            const stored = this.globalState.get<string>(USER_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error retrieving user:', error);
        }
        return null;
    }

    /**
     * Update stored user information
     */
    async updateUser(user: UserDTO): Promise<void> {
        await this.globalState.update(USER_KEY, JSON.stringify(user));
        
        if (this.memoryCache) {
            this.memoryCache.user = user;
            await this.globalState.update(TOKEN_KEY, JSON.stringify(this.memoryCache));
        }
    }

    /**
     * Clear all stored authentication data
     */
    async clearTokens(): Promise<void> {
        this.memoryCache = null;
        await this.globalState.update(TOKEN_KEY, undefined);
        await this.globalState.update(USER_KEY, undefined);
    }

    /**
     * Check if user is authenticated (has valid tokens)
     */
    async isAuthenticated(): Promise<boolean> {
        const tokens = await this.getTokens();
        return tokens !== null && tokens.expiresAt > Date.now();
    }

    /**
     * Get token expiration time
     */
    async getExpirationTime(): Promise<number | null> {
        const tokens = await this.getTokens();
        return tokens?.expiresAt ?? null;
    }

    /**
     * Get time until token expires (in milliseconds)
     */
    async getTimeUntilExpiration(): Promise<number> {
        const expiresAt = await this.getExpirationTime();
        if (!expiresAt) {
            return 0;
        }
        return Math.max(0, expiresAt - Date.now());
    }
}
