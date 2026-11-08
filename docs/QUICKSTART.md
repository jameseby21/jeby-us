# Quickstart: jeby-us (jeby.us and jainsights.com)

Goal: a stranger on a clean machine sees both sites running locally in under fifteen minutes.

## Prerequisites (with minimum versions)
- Windows 11 or macOS/Linux
- Python 3.10 or newer (tested on 3.13); no packages to install
- Git
- No accounts or keys. Fonts load from Google Fonts when online.

## Install
```powershell
# Windows
git clone https://github.com/jameseby21/jeby-us.git
cd jeby-us; git checkout redesign/2026-11-family-sites
```
```bash
# macOS / Linux
git clone https://github.com/jameseby21/jeby-us.git
cd jeby-us && git checkout redesign/2026-11-family-sites
```

## Run
```
preview.cmd        (Windows)
./preview.sh       (macOS / Linux)

Both sites by default. Add a tag for one site: `preview.cmd jai` (JA Insights only, http://127.0.0.1:8081) or `preview.cmd jeby` (jeby.us only, http://127.0.0.1:8080); `--no-serve` builds and starts nothing. The preview rewrites the family links to the local ports while serving, so clicking JA Insights on the test jeby.us opens the test JA Insights (`--live-links` turns that off).
```
Open http://127.0.0.1:8080 (jeby.us) and http://127.0.0.1:8081 (JA Insights). You should see the jeby.us home page with the family strip at the top, and the JA Insights home page. Ctrl+C stops both servers.

## Verify
```
python _src/build.py
python _src/check_links.py
```
Expected: `built [...]` twice (17 entries for jeby.us, 7 pages for JA Insights), then `ok: ... none dead`.

## If it fails
| You see | It means | Do |
| --- | --- | --- |
| `FileExistsError` or `UnicodeEncodeError` during build | an old checkout without the Windows fixes | `git pull` the branch |
| `Address already in use` | port 8080 or 8081 is taken | stop your own earlier preview, or run `python -m http.server <other port> --directory _src/jeby/out` |
| `check_links.py` lists dead links | a page or asset the HTML points at is missing | fix the source in `_src/`, rebuild |
| Build runs in the wrong Python | a project venv is first on PATH | use a plain interpreter: `python -I _src/build.py` |

## Next
- [Useful commands](COMMANDS.md)
- [Release process](RELEASE.md), [architecture](../_src/ARCHITECTURE.md), [source README](../_src/README.md)
