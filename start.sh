#!/usr/bin/env bash
# Exam Klickdummy – Start unter macOS / Linux
# Lädt beim ersten Start PocketBase herunter und startet den lokalen Server.
set -euo pipefail
PB_VERSION="${PB_VERSION:-0.40.5}"
PORT="${PORT:-8090}"
cd "$(dirname "$0")"

if [ ! -x ./pocketbase ]; then
  case "$(uname -s)" in
    Darwin) OS=darwin ;;
    Linux)  OS=linux ;;
    *) echo "Nicht unterstütztes Betriebssystem: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) ARCH=amd64 ;;
    arm64|aarch64) ARCH=arm64 ;;
    armv7l) ARCH=armv7 ;;
    *) echo "Nicht unterstützte Architektur: $(uname -m)"; exit 1 ;;
  esac
  URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
  echo "Lade PocketBase ${PB_VERSION} (${OS}/${ARCH}) …"
  curl -fL "$URL" -o pocketbase.zip
  unzip -o -q pocketbase.zip pocketbase
  rm pocketbase.zip
  chmod +x pocketbase
fi

echo ""
echo "  Exam Klickdummy läuft unter:  http://localhost:${PORT}"
echo "  PocketBase-Admin (optional):     http://localhost:${PORT}/_/"
echo "  Beenden mit Strg+C"
echo ""
exec ./pocketbase serve --http "0.0.0.0:${PORT}" --dir ./pb_data --publicDir ./pb_public --hooksDir ./pb_hooks --migrationsDir ./pb_migrations
