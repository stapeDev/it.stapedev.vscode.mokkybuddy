#!/bin/bash
set -euo pipefail

# Directory plugin
PLUGIN_DIR="plugin"

# Passaggio opzionale della versione (può servire per log)
RELEASE_VERSION=${1:-$(jq -r '.version' "$PLUGIN_DIR/package.json")}

echo "Publishing pre-release version: $RELEASE_VERSION"

# Assicurati di essere nella cartella plugin
cd "$PLUGIN_DIR"

# Installa dipendenze pulite
npm ci

# Controlla la versione reale
ACTUAL_VERSION=$(jq -r '.version' package.json)
echo "Version in package.json: $ACTUAL_VERSION"

if [ "$ACTUAL_VERSION" != "$RELEASE_VERSION" ]; then
  echo "Warning: version mismatch! Using $ACTUAL_VERSION for publishing."
  RELEASE_VERSION="$ACTUAL_VERSION"
fi

# Esegui il publish come pre-release
npx @vscode/vsce publish --pre-release

echo "Pre-release $RELEASE_VERSION pubblicata correttamente su Marketplace."
