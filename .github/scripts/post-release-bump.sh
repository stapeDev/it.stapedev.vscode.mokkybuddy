#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="plugin"
RELEASE_VERSION=$1
cd "$PLUGIN_DIR"

IFS='.' read -r MAJOR MINOR PATCH <<< "$RELEASE_VERSION"
NEXT_PATCH=$((PATCH+1))
NEXT_VERSION="$MAJOR.$MINOR.$NEXT_PATCH"

echo "Bumping package.json to next version: $NEXT_VERSION after pre-release $RELEASE_VERSION"

jq --arg v "$NEXT_VERSION" '.version=$v' package.json > package.tmp.json
mv package.tmp.json package.json

if [ -f vss-extension.json ]; then
  jq --arg v "$NEXT_VERSION" '.version=$v' vss-extension.json > vss-extension.tmp.json
  mv vss-extension.tmp.json vss-extension.json
fi

git config user.name "github-actions"
git config user.email "github-actions@github.com"
git add package.json vss-extension.json || git add package.json
git commit -m "Bump version to $NEXT_VERSION after pre-release $RELEASE_VERSION [skip ci]" || echo "No changes to commit"

git checkout -B "pre-release/$RELEASE_VERSION"
git push origin "pre-release/$RELEASE_VERSION" --force-with-lease
