#!/usr/bin/env bash
# Neue Version setzen, committen und (falls ein Remote eingerichtet ist) nach GitHub pushen.
# Aufruf:  tools/release.sh 8.1 "Kurzbeschreibung der Änderungen"
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:?Version angeben, z. B. 8.1}"; MSG="${2:-Version $V}"
python3 tools/set-version.py "$V"
git add -A
git commit -m "v$V: $MSG"
if git remote get-url origin >/dev/null 2>&1; then git push origin HEAD:main; echo "Gepusht – GitHub Pages wird automatisch aktualisiert."; else echo "Kein Remote 'origin' eingerichtet – nur lokal committet."; fi
