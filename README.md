# Mokky Buddy API Runner

[![Version](https://img.shields.io/badge/version-1.0.30-blue)](https://marketplace.visualstudio.com/items?itemName=stapedev.mokky-buddy-api-runner)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.70+-purple)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Mokky Buddy API Runner** is a VS Code extension that lets you run a local mock API server, manage endpoints, and preview responses directly inside your editor.

---

## Features

- Start/stop a local mock server with a single click.
- Configure the server port individually.
- Add, edit, and delete API endpoints.
- Load and save API configurations in JSON format.
- Tree view UI to browse servers and APIs.
- Preview JSON responses and schemas directly in VS Code.
- Output channel logs server and API events.
- Quick action icons next to server name: **Add**, **Load**, **Save**.

---

## Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=stapedev.mokky-buddy-api-runner) or using the VSIX.
2. Make sure Java JDK 17 is installed.
3. Configure `mokkyBuddy.javaPath` in settings if needed.

---

## Quick Start

1. Open **Mokky Buddy Server View** from the sidebar.
2. Your server appears as `Localhost:PORT` with action icons:
   - **➕ Add**: Add a new API
   - **📂 Load**: Load API config from JSON
   - **💾 Save**: Save API config to JSON
3. Click **▶ Start Server** to start the mock server.
4. Expand API endpoints to view response, expected body, schema, and delete API.
5. Change the server port via **Change Port** command (`Ctrl+Shift+P`).

---

## Commands

- `Mokky Buddy: Toggle Server` — Start/stop server
- `Mokky Buddy: Add API` — Add a new API endpoint
- `Mokky Buddy: Delete API` — Remove an API endpoint
- `Mokky Buddy: Save API Config` — Save config to file
- `Mokky Buddy: Load API Config` — Load config from file
- `Mokky Buddy: Preview JSON` — Preview JSON response or schema
- `Mokky Buddy: Change Port` — Change server port

---

## Configuration

| Setting | Type | Description |
|---------|------|-------------|
| `mokkyBuddy.javaPath` | string | Path to Java executable |
| `mokkyBuddy.serverPort` | number | Default port for server |

---

## Requirements

- VS Code 1.70+
- Java JDK 17

---

## Contributing

Contributions welcome! Please follow existing coding style. Report issues on GitHub.

---

## License

MIT License
