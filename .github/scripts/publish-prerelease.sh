#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="plugin"
cd "$PLUGIN_DIR"

VERSION=$(jq -r '.version' package.json)
echo "Publishing VSCode plugin as pre-release: $VERSION"

npm ci
npx @vscode/vsce publish --pre-release

echo "Pre-release $VERSION published successfully"
