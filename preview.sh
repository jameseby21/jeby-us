#!/usr/bin/env bash
# Build, then serve both sites (jeby.us on 8080, JA Insights on 8081) from this one process. Ctrl+C stops them.
# Tags: ./preview.sh jai   (only JA Insights)   ./preview.sh jeby   (only jeby.us)   ./preview.sh --no-serve   (build only)
cd "$(dirname "$0")"
exec python3 _src/preview.py "$@"
