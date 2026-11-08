#!/usr/bin/env bash
# Build both sites, then serve jeby.us on 8080 and JA Insights on 8081. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
python3 _src/build.py
python3 -m http.server 8081 --bind 127.0.0.1 --directory _src/jai/out >/dev/null 2>&1 &
trap 'kill $! 2>/dev/null' EXIT
echo; echo "jeby.us      http://127.0.0.1:8080"; echo "JA Insights  http://127.0.0.1:8081"; echo "Press Ctrl+C to stop both."
python3 -m http.server 8080 --bind 127.0.0.1 --directory _src/jeby/out
