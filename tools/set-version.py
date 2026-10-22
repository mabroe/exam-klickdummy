#!/usr/bin/env python3
"""Setzt die Version des Klickdummys an allen Stellen und versieht alle Skript-/CSS-Adressen
mit ?v=<Version>. Dadurch lädt jeder Browser nach einem Update garantiert die neuen Dateien
(kein veralteter Cache). Aufruf:  python3 tools/set-version.py 5.1"""
import re, sys, pathlib
v = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent.parent
pub = root / "pb_public"
spec = re.compile(r'''((?:from\s+|import\s*\(\s*|import\s+)["'])(\.{1,2}/[^"'?]+\.m?js)(?:\?v=[^"']*)?(["'])''')
for f in list((pub / "js").rglob("*.js")):
    if "vendor" in f.parts: continue
    s = f.read_text(encoding="utf-8")
    n = spec.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}", s)
    if f.name == "app.js": n = re.sub(r'export const VERSION = "[^"]*"', f'export const VERSION = "{v}"', n)
    if f.name == "data.js": n = re.sub(r'export const APP_VERSION = "[^"]*"', f'export const APP_VERSION = "{v}"', n)
    if n != s: f.write_text(n, encoding="utf-8")
idx = pub / "index.html"; s = idx.read_text(encoding="utf-8")
s = re.sub(r'(href="css/app\.css|src="js/main\.js)(\?v=[^"]*)?"', lambda m: f'{m.group(1)}?v={v}"', s); idx.write_text(s, encoding="utf-8")
hk = root / "pb_hooks" / "main.pb.js"; s = hk.read_text(encoding="utf-8")
s = re.sub(r'\{ version: "[^"]*" \}', f'{{ version: "{v}" }}', s); hk.write_text(s, encoding="utf-8")
print("Version gesetzt:", v)
