/**
 * MokkyBuddy Extension - Gateway API Client
 * Base HTTP client for communicating with the MokkyBuddy Gateway
 */

import fetch, { Response } from 'node-fetch';
import { ApiKeyService } from '../auth/apiKeyService';
import { ConfigManager } from '../utils/config';
import { log, logError } from '../utils/logger';
import { ApiError, MokkyBuddyError, NetworkError, AuthenticationError } from '../models/types';

export class GatewayClient {
    private static instance: GatewayClient;

    private constructor() {}

    /**
     * Get the GatewayClient singleton instance
     */
    static getInstance(): GatewayClient {
        if (!GatewayClient.instance) {
            GatewayClient.instance = new GatewayClient();
        }
        return GatewayClient.instance;
    }

    /**
     * Get the base URL for the gateway
     */
    private getBaseUrl(): string {
        const baseUrl = ConfigManager.getInstance().getGatewayUrl();
        return `${baseUrl}/api`;
    }

    /**
     * Get authorization headers with API Key
     */
    private getAuthHeaders(): Record<string, string> {
        const apiKey = ApiKeyService.getInstance().getApiKey();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }

        return headers;
    }

    /**
     * Handle API response
     */
    private async handleResponse<T>(response: Response): Promise<T> {
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json() as T;
            }
            return {} as T;
        }

        // Handle error responses
        let errorMessage = `HTTP ${response.status}`;
        let errorCode: string | undefined;

        try {
            const errorBody = await response.json() as ApiError;
            errorMessage = errorBody.message || errorMessage;
            errorCode = errorBody.code;
        } catch {
            errorMessage = await response.text() || errorMessage;
        }

        if (response.status === 401) {
            throw new AuthenticationError(errorMessage);
        }

        throw new MokkyBuddyError(errorMessage, errorCode, response.status);
    }

    /**
     * Make a GET request
     */
    async get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean>): Promise<T> {
        const url = new URL(`${this.getBaseUrl()}${endpoint}`);
        
        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        log(`📤 GET ${url.pathname}`);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            return await this.handleResponse<T>(response);
        } catch (error: any) {
            if (error instanceof MokkyBuddyError) {
                throw error;
            }
            logError(`GET ${endpoint} failed:`, error);
            throw new NetworkError(error.message);
        }
    }

    /**
     * Make a POST request
     */
    async post<T>(endpoint: string, body?: any): Promise<T> {
        log(`📤 POST ${endpoint}`);

        try {
            const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: body ? JSON.stringify(body) : undefined
            });

            return await this.handleResponse<T>(response);
        } catch (error: any) {
            if (error instanceof MokkyBuddyError) {
                throw error;
            }
            logError(`POST ${endpoint} failed:`, error);
            throw new NetworkError(error.message);
        }
    }

    /**
     * Make a PUT request
     */
    async put<T>(endpoint: string, body?: any): Promise<T> {
        log(`📤 PUT ${endpoint}`);

        try {
            const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: body ? JSON.stringify(body) : undefined
            });

            return await this.handleResponse<T>(response);
        } catch (error: any) {
            if (error instanceof MokkyBuddyError) {
                throw error;
            }
            logError(`PUT ${endpoint} failed:`, error);
            throw new NetworkError(error.message);
        }
    }

    /**
     * Make a DELETE request
     */
    async delete<T>(endpoint: string): Promise<T> {
        log(`📤 DELETE ${endpoint}`);

        try {
            const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            return await this.handleResponse<T>(response);
        } catch (error: any) {
            if (error instanceof MokkyBuddyError) {
                throw error;
            }
            logError(`DELETE ${endpoint} failed:`, error);
            throw new NetworkError(error.message);
        }
    }

    /**
     * Upload a file
     */
    async uploadFile(endpoint: string, filePath: string, fieldName: string = 'file'): Promise<void> {
        const FormData = (await import('form-data')).default;
        const fs = await import('fs');

        log(`📤 UPLOAD ${endpoint}`);

        try {
            const form = new FormData();
            form.append(fieldName, fs.createReadStream(filePath));

            const apiKey = ApiKeyService.getInstance().getApiKey();
            const headers: Record<string, string> = {
                ...form.getHeaders()
            };

            if (apiKey) {
                headers['X-API-Key'] = apiKey;
            }

            const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
                method: 'POST',
                headers,
                body: form
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new MokkyBuddyError(`Upload failed: ${errorText}`, undefined, response.status);
            }
        } catch (error: any) {
            if (error instanceof MokkyBuddyError) {
                throw error;
            }
            logError(`UPLOAD ${endpoint} failed:`, error);
            throw new NetworkError(error.message);
        }
    }
}
