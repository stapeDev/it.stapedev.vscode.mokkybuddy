#!/usr/bin/env bash
set -euo pipefail

# Directory plugin
PLUGIN_DIR="plugin"

# Passaggio opzionale della versione (può servire per log)
RELEASE_VERSION=${1:-$(jq -r '.version' "$PLUGIN_DIR/package.json")}

echo "Publishing pre-release version: $RELEASE_VERSION"

# Spostati nella cartella plugin
cd "$PLUGIN_DIR"

# Forza package.json alla versione corretta
jq --arg v "$RELEASE_VERSION" '.version = $v' package.json > package.tmp.json
mv package.tmp.json package.json

# Aggiorna anche vss-extension.json se esiste
if [ -f "vss-extension.json" ]; then
  jq --arg v "$RELEASE_VERSION" '.version = $v' vss-extension.json > tmp.json
  mv tmp.json vss-extension.json
fi

# Installa le dipendenze pulite
npm ci

# Controlla la versione reale
ACTUAL_VERSION=$(jq -r '.version' package.json)
echo "Version in package.json: $ACTUAL_VERSION"

# Esegui il publish come pre-release
npx @vscode/vsce publish --pre-release

echo "Pre-release $ACTUAL_VERSION pubblicata correttamente su Marketplace."
