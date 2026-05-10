/**
 * MokkyBuddy Extension - Server API
 * API client for server management operations
 */

import { GatewayClient } from './gatewayClient';
import { 
    ServerDTO, 
    PagedResponse, 
    KpiServerDTO 
} from '../models/types';
import { log } from '../utils/logger';

export class ServerApi {
    private static instance: ServerApi;
    private client: GatewayClient;

    private constructor() {
        this.client = GatewayClient.getInstance();
    }

    /**
     * Get the ServerApi singleton instance
     */
    static getInstance(): ServerApi {
        if (!ServerApi.instance) {
            ServerApi.instance = new ServerApi();
        }
        return ServerApi.instance;
    }

    /**
     * Create a new server
     */
    async createServer(server: ServerDTO): Promise<string> {
        log(`🖥️ Creating server: ${server.name}`);
        const response = await this.client.post<string>('/mokky/server/', server);
        log(`✅ Server created with ID: ${response}`);
        return response;
    }

    /**
     * Delete a server
     */
    async deleteServer(serverId: string): Promise<void> {
        log(`🗑️ Deleting server: ${serverId}`);
        await this.client.delete(`/mokky/server/${serverId}/`);
        log(`✅ Server deleted: ${serverId}`);
    }

    /**
     * Get all servers with optional filtering and pagination
     */
    async getServers(options?: {
        name?: string;
        isPaged?: boolean;
        page?: number;
        size?: number;
    }): Promise<ServerDTO[] | PagedResponse<ServerDTO>> {
        log('📋 Fetching servers...');
        
        const params: Record<string, string | number | boolean> = {};
        
        if (options?.name) {
            params.name = options.name;
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

        const response = await this.client.get<ServerDTO[] | PagedResponse<ServerDTO>>('/mokky/server/', params);
        
        if (Array.isArray(response)) {
            log(`✅ Fetched ${response.length} servers`);
        } else {
            log(`✅ Fetched ${response.content.length} servers (page ${response.number + 1}/${response.totalPages})`);
        }
        
        return response;
    }

    /**
     * Get all servers as a simple list (no pagination)
     */
    async getAllServers(): Promise<ServerDTO[]> {
        const response = await this.getServers({ isPaged: false });
        return Array.isArray(response) ? response : response.content;
    }

    /**
     * Get server KPI
     */
    async getKpi(): Promise<KpiServerDTO> {
        log('📊 Fetching server KPI...');
        const kpi = await this.client.get<KpiServerDTO>('/mokky/server/kpi');
        log(`✅ KPI: ${kpi.totalServers} total servers, ${kpi.activeServers} active`);
        return kpi;
    }

    /**
     * Search servers by name
     */
    async searchServers(name: string): Promise<ServerDTO[]> {
        const response = await this.getServers({ name, isPaged: false });
        return Array.isArray(response) ? response : response.content;
    }
}
