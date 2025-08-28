#!/usr/bin/env bash
set -euo pipefail

JAVA_VERSION=$1
REPO="stapeDev/it.stapedev.api.mokkybuddy"
TARGET_DIR="plugin/resources"
TARGET_FILE="$TARGET_DIR/mokkyBuddyAPI.jar"

mkdir -p "$TARGET_DIR"

# Funzione per ottenere release ID
get_release_id() {
  local TAG=$1
  curl -s -H "Authorization: token $JAVA_APP_PAT" \
       -H "Accept: application/vnd.github+json" \
       "https://api.github.com/repos/$REPO/releases/tags/$TAG" \
       | jq -r '.id'
}

# Prova release stabile
RELEASE_ID=$(get_release_id "v$JAVA_VERSION")

# Se non esiste, prova pre-release
if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" == "null" ]; then
  echo "Stable release not found for version $JAVA_VERSION, trying pre-release..."
  RELEASE_ID=$(get_release_id "v$JAVA_VERSION-pre")
  if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" == "null" ]; then
    echo "Release not found for version $JAVA_VERSION or $JAVA_VERSION-pre!"
    exit 1
  fi
fi

# Scarica l’asset .jar
ASSET_URL=$(curl -s -H "Authorization: token $JAVA_APP_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases/$RELEASE_ID/assets" \
  | jq -r '.[] | select(.name | endswith(".jar")) | .url')

curl -L -H "Authorization: token $JAVA_APP_PAT" \
  -H "Accept: application/octet-stream" \
  "$ASSET_URL" -o "$TARGET_FILE"

echo "Downloaded JAR to $TARGET_FILE"

# Passa in plugin e aggiungi il file con percorso relativo
cd plugin
RELATIVE_PATH="${TARGET_FILE#plugin/}"  # rimuove 'plugin/' dal percorso
git add "$RELATIVE_PATH"

if git diff --cached --quiet; then
  echo "No changes in JAR to commit"
else
  git commit -m "Update JAR for version $JAVA_VERSION [skip ci]"
  git push origin HEAD
fi
