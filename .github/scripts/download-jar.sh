#!/usr/bin/env bash
set -euo pipefail

JAVA_VERSION=$1
REPO="stapeDev/it.stapedev.api.mokkybuddy"
TARGET_DIR="plugin/resources"
TARGET_FILE="$TARGET_DIR/mokkyBuddyAPI.jar"

mkdir -p "$TARGET_DIR"

RELEASE_ID=$(curl -s -H "Authorization: token $JAVA_APP_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/tags/v$JAVA_VERSION" \
  | jq -r '.id')

if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" == "null" ]; then
  echo "Release not found for version $JAVA_VERSION!"
  exit 1
fi

ASSET_URL=$(curl -s -H "Authorization: token $JAVA_APP_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/$RELEASE_ID/assets" \
  | jq -r '.[] | select(.name | endswith(".jar")) | .url')

curl -L -H "Authorization: token $JAVA_APP_PAT" \
  -H "Accept: application/octet-stream" \
  "$ASSET_URL" -o "$TARGET_FILE"

echo "Downloaded JAR to $TARGET_FILE"
