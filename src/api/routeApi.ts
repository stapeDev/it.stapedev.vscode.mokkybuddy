/**
 * MokkyBuddy Extension - Route API
 * API client for mock route management operations
 */

import { GatewayClient } from './gatewayClient';
import { 
    MockRouteDTO, 
    PagedResponse, 
    KpiProductApiDTO,
    HttpMethod 
} from '../models/types';
import { log } from '../utils/logger';

export class RouteApi {
    private static instance: RouteApi;
    private client: GatewayClient;

    private constructor() {
        this.client = GatewayClient.getInstance();
    }

    /**
     * Get the RouteApi singleton instance
     */
    static getInstance(): RouteApi {
        if (!RouteApi.instance) {
            RouteApi.instance = new RouteApi();
        }
        return RouteApi.instance;
    }

    /**
     * Create a new route for a server
     */
    async createRoute(serverId: string, route: MockRouteDTO): Promise<string> {
        log(`➕ Creating route: [${route.method}] ${route.path}`);
        const response = await this.client.post<string>(`/mokky/server/${serverId}/route/`, route);
        log(`✅ Route created with ID: ${response}`);
        return response;
    }

    /**
     * Delete a route
     */
    async deleteRoute(serverId: string, routeId: string): Promise<void> {
        log(`🗑️ Deleting route: ${routeId}`);
        await this.client.delete(`/mokky/server/${serverId}/route/${routeId}/`);
        log(`✅ Route deleted: ${routeId}`);
    }

    /**
     * Get a specific route
     */
    async getRoute(serverId: string, routeId: string): Promise<MockRouteDTO> {
        log(`📖 Fetching route: ${routeId}`);
        return await this.client.get<MockRouteDTO>(`/mokky/server/${serverId}/route/${routeId}/`);
    }

    /**
     * Get all routes for a server with optional filtering and pagination
     */
    async getRoutes(serverId: string, options?: {
        path?: string;
        method?: HttpMethod;
        isPaged?: boolean;
        page?: number;
        size?: number;
    }): Promise<MockRouteDTO[] | PagedResponse<MockRouteDTO>> {
        log(`📋 Fetching routes for server: ${serverId}`);
        
        const params: Record<string, string | number | boolean> = {};
        
        if (options?.path) {
            params.path = options.path;
        }
        if (options?.method) {
            params.method = options.method;
        }
        if (options?.isPaged !== undefined) {
            params.isPaged = options.isPaged;
        }
        if (options?.page !== undefined) {
            params.page = options.page;
        }
        if (options?.size !== undefined) {
            params.size = options.size;
        }

        const response = await this.client.get<MockRouteDTO[] | PagedResponse<MockRouteDTO>>(
            `/mokky/server/${serverId}/route/`, 
            params
        );
        
        if (Array.isArray(response)) {
            log(`✅ Fetched ${response.length} routes`);
        } else {
            log(`✅ Fetched ${response.content.length} routes (page ${response.number + 1}/${response.totalPages})`);
        }
        
        return response;
    }

    /**
     * Get all routes for a server as a simple list (no pagination)
     */
    async getAllRoutes(serverId: string): Promise<MockRouteDTO[]> {
        const response = await this.getRoutes(serverId, { isPaged: false });
        return Array.isArray(response) ? response : response.content;
    }

    /**
     * Upload routes from a JSON file
     */
    async uploadRoutes(serverId: string, filePath: string): Promise<void> {
        log(`📤 Uploading routes from: ${filePath}`);
        await this.client.uploadFile(`/mokky/server/${serverId}/route/load`, filePath);
        log('✅ Routes uploaded successfully');
    }

    /**
     * Get product API KPI
     */
    async getKpi(): Promise<KpiProductApiDTO> {
        log('📊 Fetching API KPI...');
        const kpi = await this.client.get<KpiProductApiDTO>('/mokky/product-api/kpi');
        log(`✅ KPI: ${kpi.totalApis} total APIs`);
        return kpi;
    }

    /**
     * Bulk create routes
     */
    async bulkCreateRoutes(serverId: string, routes: MockRouteDTO[]): Promise<string[]> {
        log(`➕ Creating ${routes.length} routes in bulk`);
        const ids: string[] = [];
        
        for (const route of routes) {
            const id = await this.createRoute(serverId, route);
            ids.push(id);
        }
        
        log(`✅ Created ${ids.length} routes`);
        return ids;
    }

    /**
     * Get routes filtered by method
     */
    async getRoutesByMethod(serverId: string, method: HttpMethod): Promise<MockRouteDTO[]> {
        const response = await this.getRoutes(serverId, { method, isPaged: false });
        return Array.isArray(response) ? response : response.content;
    }

    /**
     * Search routes by path
     */
    async searchRoutes(serverId: string, path: string): Promise<MockRouteDTO[]> {
        const response = await this.getRoutes(serverId, { path, isPaged: false });
        return Array.isArray(response) ? response : response.content;
    }
}
