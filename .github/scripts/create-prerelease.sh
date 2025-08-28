#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="plugin"
RELEASE_VERSION=$1

cd "$PLUGIN_DIR"

# Aggiorna branch corrente
git add -A
git config user.name "github-actions"
git config user.email "github-actions@github.com"
if ! git diff --cached --quiet; then
  git commit -m "Prepare pre-release $RELEASE_VERSION [skip ci]" || echo "No changes to commit"
  git push origin HEAD --force-with-lease
fi

# Crea branch pre-release
git checkout -B pre-release/$RELEASE_VERSION
git push origin pre-release/$RELEASE_VERSION --force-with-lease

# Crea tag pre-release
TAG=v$RELEASE_VERSION-pre
if git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag -f "$TAG" -m "Pre-release $RELEASE_VERSION"
else
  git tag -a "$TAG" -m "Pre-release $RELEASE_VERSION"
fi
git push origin "$TAG" --force
