@echo off
rem Build both sites, then serve jeby.us on 8080 and JA Insights on 8081. Ctrl+C stops both.
cd /d "%~dp0"
python _src\build.py || exit /b 1
echo.
echo jeby.us        http://127.0.0.1:8080
echo JA Insights    http://127.0.0.1:8081
echo Press Ctrl+C to stop both.
start "" /b python -m http.server 8081 --bind 127.0.0.1 --directory _src\jai\out
python -m http.server 8080 --bind 127.0.0.1 --directory _src\jeby\out
