#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="plugin"
cd "$PLUGIN_DIR"

VERSION=$(jq -r '.version' package.json)

# Aggiorna README badge
sed -i "s/badge\/version-[0-9]\+\.[0-9]\+\.[0-9]\+/badge\/version-$VERSION/" README.md || true

# Recupera log dai commit Java app
cd ../app
git fetch --tags --prune || true
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
RANGE=${LAST_TAG:+$LAST_TAG..HEAD}
FEATS=$(git log $RANGE --grep '^feat' --pretty=format:"- %s (%an)" --reverse || true)
FIXES=$(git log $RANGE --grep '^fix' --pretty=format:"- %s (%an)" --reverse || true)
CHORES=$(git log $RANGE --grep '^chore' --pretty=format:"- %s (%an)" --reverse || true)
BREAKING=$(git log $RANGE --grep 'BREAKING CHANGE' --pretty=format:"- %s (%an)" --reverse || true)
cd ../plugin

[ ! -f CHANGELOG.md ] && echo "# Changelog" > CHANGELOG.md
TMP=$(mktemp)
echo "## Version $VERSION ($(date +'%Y-%m-%d'))" >> "$TMP"
[ -n "$FEATS" ] && echo -e "\n### Features\n$FEATS" >> "$TMP"
[ -n "$FIXES" ] && echo -e "\n### Fixes\n$FIXES" >> "$TMP"
[ -n "$CHORES" ] && echo -e "\n### Chores\n$CHORES" >> "$TMP"
[ -n "$BREAKING" ] && echo -e "\n### BREAKING CHANGES\n$BREAKING" >> "$TMP"
cat "$TMP" CHANGELOG.md > CHANGELOG.new
mv CHANGELOG.new CHANGELOG.md
rm -f "$TMP"
