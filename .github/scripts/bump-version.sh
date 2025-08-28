#!/usr/bin/env bash
set -euo pipefail

JAVA_VERSION=$1
PLUGIN_DIR="plugin"
cd "$PLUGIN_DIR"

CURRENT_VERSION=$(jq -r '.version' package.json)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
RANGE=${LAST_TAG:+$LAST_TAG..HEAD}
COMMITS=$(git log $RANGE --pretty=format:"%s%b" || true)

semver_gt() {
  [ "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

if echo "$COMMITS" | grep -q 'BREAKING CHANGE'; then
  npm version major --no-git-tag-version
elif echo "$COMMITS" | grep -q '^feat'; then
  npm version minor --no-git-tag-version
elif echo "$COMMITS" | grep -q '^fix'; then
  npm version patch --no-git-tag-version
else
  if semver_gt "$JAVA_VERSION" "$CURRENT_VERSION"; then
    npm version $JAVA_VERSION --no-git-tag-version
  else
    npm version patch --no-git-tag-version
  fi
fi

# Aggiorna branch locale
git config user.name "github-actions"
git config user.email "github-actions@github.com"
git add package.json vss-extension.json || git add package.json
if ! git diff --cached --quiet; then
  git commit -m "Bump plugin version to $(jq -r '.version' package.json) [skip ci]" || true
fi

# Output finale
echo "release_version=$(jq -r '.version' package.json)" >> $GITHUB_OUTPUT