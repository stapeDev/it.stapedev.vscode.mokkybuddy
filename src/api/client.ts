/**
 * MokkyBuddy API Client - HTTP client for communicating with the MokkyBuddy Gateway
 */

import fetch from 'node-fetch';
import { ApiKeyManager } from '../auth/apiKeyManager';

export interface ServerDTO {
    id: string;
    name: string;
    description?: string;
    apis?: number;
}

export interface MockRouteDTO {
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    serverPath: string;
    userPath: string;
    responses?: any[];
    inputSchema?: any;
}

export interface KpiServerDTO {
    totalServers: number;
    totalApis: number;
    totalRequests: number;
    successRate: number;
    serverStats?: ServerStatDTO[];
}

export interface ServerStatDTO {
    serverId: string;
    serverName: string;
    apiCount: number;
    totalRequests: number;
    successRate: number;
}

export interface KpiRouteDTO {
    routeId: string;
    method: string;
    path: string;
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    successRate: number;
    averageResponseTime: number;
}

export class MokkyBuddyApiClient {
    constructor(private apiKeyManager: ApiKeyManager) {}

    private async getHeaders(): Promise<Record<string, string>> {
        const apiKey = await this.apiKeyManager.getApiKey();
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(apiKey && { 'X-API-Key': apiKey })
        };
    }

    private getBaseUrl(): string {
        return `${this.apiKeyManager.getGatewayUrl()}/api`;
    }

    // ============================================
    // Server Operations
    // ============================================

    async listServers(): Promise<ServerDTO[]> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/`, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to list servers: ${response.statusText}`);
            }

            const data: any = await response.json();
            return data.content || data || [];
        } catch (error) {
            console.error('Error listing servers:', error);
            throw error;
        }
    }

    async createServer(name: string, description?: string): Promise<string> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/`, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) {
                throw new Error(`Failed to create server: ${response.statusText}`);
            }

            const serverId = await response.text();
            return serverId;
        } catch (error) {
            console.error('Error creating server:', error);
            throw error;
        }
    }

    async deleteServer(serverId: string): Promise<void> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/`, {
                method: 'DELETE',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to delete server: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting server:', error);
            throw error;
        }
    }

    async getServerKpi(): Promise<KpiServerDTO> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/kpi`, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to get server KPI: ${response.statusText}`);
            }

            return (await response.json()) as KpiServerDTO;
        } catch (error) {
            console.error('Error getting server KPI:', error);
            throw error;
        }
    }

    // ============================================
    // Route Operations
    // ============================================

    async listRoutes(serverId: string): Promise<MockRouteDTO[]> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/`, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to list routes: ${response.statusText}`);
            }

            const data: any = await response.json();
            return data.content || data || [];
        } catch (error) {
            console.error('Error listing routes:', error);
            throw error;
        }
    }

    async createRoute(serverId: string, route: MockRouteDTO): Promise<string> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/`, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: JSON.stringify(route)
            });

            if (!response.ok) {
                throw new Error(`Failed to create route: ${response.statusText}`);
            }

            const routeId = await response.text();
            return routeId;
        } catch (error) {
            console.error('Error creating route:', error);
            throw error;
        }
    }

    async getRoute(serverId: string, routeId: string): Promise<MockRouteDTO> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/${routeId}/`, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to get route: ${response.statusText}`);
            }

            return (await response.json()) as MockRouteDTO;
        } catch (error) {
            console.error('Error getting route:', error);
            throw error;
        }
    }

    async updateRoute(serverId: string, routeId: string, route: MockRouteDTO): Promise<void> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/${routeId}/`, {
                method: 'PUT',
                headers: await this.getHeaders(),
                body: JSON.stringify(route)
            });

            if (!response.ok) {
                throw new Error(`Failed to update route: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error updating route:', error);
            throw error;
        }
    }

    async deleteRoute(serverId: string, routeId: string): Promise<void> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/${routeId}/`, {
                method: 'DELETE',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to delete route: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting route:', error);
            throw error;
        }
    }

    async getRouteKpi(serverId: string, routeId: string): Promise<KpiRouteDTO> {
        try {
            const response = await fetch(`${this.getBaseUrl()}/mokky/server/${serverId}/route/${routeId}/kpi`, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to get route KPI: ${response.statusText}`);
            }

            return (await response.json()) as KpiRouteDTO;
        } catch (error) {
            console.error('Error getting route KPI:', error);
            throw error;
        }
    }

    // ============================================
    // Test Route
    // ============================================

    async testRoute(serverId: string, routeId: string, mockServerUrl: string): Promise<any> {
        try {
            const route = await this.getRoute(serverId, routeId);
            const url = `${mockServerUrl}${route.serverPath}`;
            
            const response = await fetch(url, {
                method: route.method,
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            return {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: data
            };
        } catch (error) {
            console.error('Error testing route:', error);
            throw error;
        }
    }
}
