#!/usr/bin/env bash
set -euo pipefail

POM_FILE=${1:-app/pom.xml}

VERSION=$(mvn -f "$POM_FILE" help:evaluate -Dexpression=project.version -q -DforceStdout)
VERSION_CLEAN=${VERSION/-SNAPSHOT/}

echo "Java App version: $VERSION_CLEAN"
echo "version=$VERSION_CLEAN" >> "$GITHUB_OUTPUT"
