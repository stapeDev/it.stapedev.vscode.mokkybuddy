# Copilot Instructions for Mokky Buddy API Runner

## Purpose

This file provides instructions to GitHub Copilot on how to assist with coding in the Mokky Buddy VS Code extension project. The goal is to improve code suggestions and maintain consistent coding patterns.

## Project Overview

- **Language:** TypeScript
- **Environment:** VS Code Extension API
- **Features:**
  - Local mock API server
  - Tree view for endpoints
  - Commands to start/stop server, add/delete APIs
  - JSON preview and editing
  - Configuration for Java path and server port

## Coding Guidelines

- Use **TypeScript** with strong typing
- Always check for `undefined` or `null` when dealing with API responses
- Keep functions small and focused
- Use **async/await** for asynchronous operations
- Follow VS Code Extension API naming conventions (`extension.ts`, `activate`, `deactivate`)

## File & Folder Conventions

- `src/` — source code
- `resources/` — icons, JAR files, JSON samples
- `dist/` — compiled output
- `vss-extension.json` — VS Code extension manifest
- `package.json` — NPM project config

## Suggested Patterns

- Use `vscode.window.showInformationMessage()` for user notifications
- Use `vscode.TreeDataProvider` for tree views
- Place reusable logic in separate helper files
- Log server events to an output channel

## Copilot Hints

- Always suggest **type annotations** for variables and function returns
- Prefer **descriptive variable and function names**
- Suggest JSON schemas when creating API endpoints
- For new commands, include proper activation events in `package.json`
- Keep code modular and maintainable

---

**Note:** Copilot should prioritize patterns already present in the codebase and follow the existing code style.
