/**
 * MokkyBuddy Extension - Type Definitions
 * Shared interfaces and types for the extension
 */

import { ChildProcessWithoutNullStreams } from 'child_process';

// ============================================
// API Mode Types
// ============================================

export type ApiMode = 'file' | 'database' | 'saas';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type Environment = 'local' | 'dev' | 'test' | 'prod';

// ============================================
// Environment Configuration Types
// ============================================

export interface EnvironmentEndpoints {
    gatewayUrl: string;
    mockServerBaseUrl: string;
}

export interface EnvironmentConfig {
    local: EnvironmentEndpoints;
    dev: EnvironmentEndpoints;
    test: EnvironmentEndpoints;
    prod: EnvironmentEndpoints;
}

// ============================================
// Authentication Types
// ============================================

export interface LoginRequest {
    usernameOrEmail: string;
    password: string;
    tenantName: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    firstname?: string;
    lastname?: string;
    tenantName: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
}

export interface UserDTO {
    id: string;
    username: string;
    email: string;
    firstname?: string;
    lastname?: string;
    tenantId?: string;
    roles?: string[];
}

export interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user?: UserDTO;
}

// ============================================
// Server Types
// ============================================

export interface ServerDTO {
    id?: string;
    name: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

export interface ServerDef {
    // Common fields
    id?: string;
    name: string;
    port: number;
    javaPath: string;
    apiList: ApiDef[];
    
    // Local server management (file/database mode)
    process?: ChildProcessWithoutNullStreams;
    running?: boolean;
    
    // SAAS mode
    isSaas?: boolean;
    description?: string;
    baseUrl?: string;
}

export interface UiServer {
    name: string;
    port: number;
    javaPath: string;
    apiList: ApiDef[];
}

// ============================================
// API Route Types
// ============================================

export interface ApiDef {
    id?: string;
    method: HttpMethod;
    path: string;
    response?: any;
    expectedBody?: any;
    jsonSchema?: any;
    serverId?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    delay?: number;
}

export interface MockRouteDTO {
    id?: string;
    serverId?: string;
    method: string;
    path: string;
    response?: any;
    expectedBody?: any;
    jsonSchema?: any;
    statusCode?: number;
    headers?: Record<string, string>;
    delay?: number;
    createdAt?: string;
    updatedAt?: string;
}

// ============================================
// KPI Types
// ============================================

export interface KpiServerDTO {
    totalServers: number;
    activeServers: number;
    serversCreatedToday: number;
    serversCreatedThisWeek: number;
}

export interface KpiProductApiDTO {
    totalApis: number;
    apisByMethod: Record<string, number>;
    apisCreatedToday: number;
    apisCreatedThisWeek: number;
}

export interface KpiDashboard {
    servers: KpiServerDTO;
    apis: KpiProductApiDTO;
    user?: UserDTO;
}

// ============================================
// Paginated Response Types
// ============================================

export interface PagedResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
}

// ============================================
// Error Types
// ============================================

export interface ApiError {
    status: number;
    message: string;
    code?: string;
    details?: Record<string, any>;
}

export class MokkyBuddyError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'MokkyBuddyError';
    }
}

export class AuthenticationError extends MokkyBuddyError {
    constructor(message: string = 'Authentication failed') {
        super(message, 'AUTH_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

export class NetworkError extends MokkyBuddyError {
    constructor(message: string = 'Network error') {
        super(message, 'NETWORK_ERROR', 0);
        this.name = 'NetworkError';
    }
}

// ============================================
// Tree Item Types
// ============================================

export type TreeItemType = 
    | 'rootNode'
    | 'userInfoNode'
    | 'kpiNode'
    | 'serverNode'
    | 'saasServerNode'
    | 'localServerNode'
    | 'apiNode'
    | 'responseNode'
    | 'expectedBodyNode'
    | 'schemaNode'
    | 'actionNode'
    | 'addApiNode'
    | 'loginNode'
    | 'modeNode';

// ============================================
// Configuration Types
// ============================================

export interface MokkyBuddyConfig {
    javaPath: string;
    serverPort: number;
    apiMode: ApiMode;
    saas: {
        environment: Environment;
        tenantName: string;
        autoRefreshToken: boolean;
        endpoints: EnvironmentConfig;
    };
}

// Helper to get current environment endpoints
export function getEnvironmentEndpoints(config: MokkyBuddyConfig): EnvironmentEndpoints {
    return config.saas.endpoints[config.saas.environment];
}

// ============================================
// Event Types
// ============================================

export interface AuthStateChangedEvent {
    isLoggedIn: boolean;
    user?: UserDTO;
}

export interface ServerStateChangedEvent {
    serverId?: string;
    running: boolean;
    port?: number;
}
