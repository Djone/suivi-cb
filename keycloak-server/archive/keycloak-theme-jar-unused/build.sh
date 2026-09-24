#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
rm -f suivi-bancaire-theme.jar
jar --create --file suivi-bancaire-theme.jar META-INF theme
echo "Generated $(pwd)/suivi-bancaire-theme.jar"
