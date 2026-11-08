@echo off
rem Build, then serve both sites (jeby.us on 8080, JA Insights on 8081) in this one window. Ctrl+C stops them.
rem Tags: preview.cmd jai   (only JA Insights)   preview.cmd jeby   (only jeby.us)   preview.cmd --no-serve   (build only)
cd /d "%~dp0"
python _src\preview.py %*
