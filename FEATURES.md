# MokkyBuddy API Runner - Features

## v2.0.0 - SAAS Integration Release

### 🚀 Three Operating Modes

#### File Mode (Default)
- Store mock API routes in local JSON files
- Fast and simple for local development
- No external dependencies required
- Automatic config persistence

#### Database Mode
- Store routes in local H2 database
- Useful for larger route collections
- CRUD operations via REST API
- Supports route upload from JSON files

#### SAAS Mode (NEW)
- Connect to MokkyBuddy cloud platform
- Multi-tenant support
- JWT authentication with auto-refresh
- Manage multiple mock servers
- Sync local routes to cloud
- View KPI dashboard

---

## Core Features

### 🖥️ Local Server Management
- Start/stop mock servers with one click
- Configure server port dynamically
- View real-time server logs in output channel
- Automatic port conflict detection

### 📡 API Route Management
- Add, edit, and delete mock routes
- Support for all HTTP methods: GET, POST, PUT, DELETE, PATCH
- Configure response body, expected body, and JSON schema
- Preview JSON in VS Code editor
- Load/save route configurations

### 🌲 Tree View Interface
- Intuitive sidebar navigation
- Collapsible server and route hierarchy
- Color-coded HTTP methods
- Quick actions for common operations
- Mode indicator with one-click switching

---

## SAAS Mode Features

### 🔐 Authentication
- Secure JWT-based login
- Token stored in VS Code SecretStorage
- Automatic token refresh before expiration
- Multi-tenant support

### 🖥️ Multi-Server Support
- Create and manage multiple mock servers in the cloud
- Each server has a unique endpoint URL
- View server statistics and metadata
- Delete servers when no longer needed

### ☁️ Route Synchronization
- Upload routes from local JSON files to cloud
- Sync local server routes to SAAS server
- Bulk route operations

### 📊 KPI Dashboard
- View total servers and APIs
- Track creation statistics (daily/weekly)
- API distribution by HTTP method

---

## Commands

| Command | Description |
|---------|-------------|
| `MokkyBuddy: Select API Mode` | Switch between file, database, and saas modes |
| `MokkyBuddy: Start/Stop Server` | Toggle local server state |
| `MokkyBuddy: Set Server Port` | Change local server port |
| `MokkyBuddy: Add API Route` | Create new mock route |
| `MokkyBuddy: Delete API Route` | Remove a mock route |
| `MokkyBuddy: Save API Config` | Export routes to JSON file |
| `MokkyBuddy: Load API Config` | Import routes from JSON file |
| `MokkyBuddy: Preview JSON` | View JSON in editor |
| `MokkyBuddy: Login to SAAS` | Authenticate with cloud platform |
| `MokkyBuddy: Logout from SAAS` | Clear authentication tokens |
| `MokkyBuddy: Create New Server` | Create server in cloud (SAAS) |
| `MokkyBuddy: Delete Server` | Delete cloud server (SAAS) |
| `MokkyBuddy: Sync Routes to Cloud` | Upload local routes to cloud server |
| `MokkyBuddy: Show KPI Dashboard` | View statistics (SAAS) |
| `MokkyBuddy: Refresh Servers` | Reload server list |

---

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mokkyBuddy.javaPath` | string | `java` | Path to Java executable |
| `mokkyBuddy.serverPort` | number | `8081` | Local server port |
| `mokkyBuddy.apiMode` | enum | `file` | Operating mode: file, database, saas |
| `mokkyBuddy.saas.gatewayUrl` | string | `https://api.mokkybuddy.stapedev.it` | SAAS Gateway URL |
| `mokkyBuddy.saas.tenantName` | string | `default` | Tenant name for multi-tenant |
| `mokkyBuddy.saas.autoRefreshToken` | boolean | `true` | Auto-refresh JWT tokens |
| `mokkyBuddy.saas.mockServerBaseUrl` | string | `https://mock.mokkybuddy.stapedev.it` | Mock server base URL |

---

## Architecture

```
src/
├── extension.ts              # Main entry point
├── auth/
│   ├── tokenStorage.ts       # SecretStorage wrapper for JWT
│   └── authService.ts        # Login/logout/refresh logic
├── api/
│   ├── gatewayClient.ts      # HTTP client for Gateway
│   ├── serverApi.ts          # Server CRUD operations
│   └── routeApi.ts           # Route CRUD operations
├── providers/
│   ├── serverTreeProvider.ts # TreeView data provider
│   └── loginPanel.ts         # Login webview panel
├── models/
│   └── types.ts              # TypeScript interfaces
└── utils/
    ├── config.ts             # Configuration manager
    └── logger.ts             # Logging utilities
```

---

## Requirements

- VS Code 1.79.0 or higher
- Java JDK 17+ (for file/database modes)
- Internet connection (for SAAS mode)

---

## Changelog

### v2.0.0
- Added SAAS mode with cloud integration
- Multi-server support
- JWT authentication system
- KPI dashboard
- Route synchronization
- Modular architecture refactoring
- Improved error handling

### v1.x
- Local file and database modes
- Basic server management
- Route CRUD operations
