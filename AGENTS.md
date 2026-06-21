# Repository Guidelines

## Project Scope
Mokky Buddy API Runner is a VS Code extension for managing MokkyBuddy cloud mock servers and routes from the editor.

## Agent Context
- Read `.github/copilot-instructions.md` before changing extension code.
- Keep command IDs, activation events, tree view IDs, and contribution points synchronized with `package.json`.
- Use VS Code Extension API patterns already present in `src/`.
- Do not hardcode API keys or user credentials; use VS Code secret/configuration APIs where appropriate.

## Build And Test
- Install dependencies: `npm install`
- Compile: `npm run compile`
- Package build: `npm run package`
- Type check: `npm run check-types`
- Lint: `npm run lint`
- Test: `npm test`

## Coding Notes
- TypeScript with strong typing is expected.
- Prefer `async`/`await`, explicit return types, and defensive handling of nullable API responses.
- When adding commands, update `activationEvents`, `contributes.commands`, and relevant menus.
- Keep generated/compiled output in `dist/` consistent with the existing build pipeline.
