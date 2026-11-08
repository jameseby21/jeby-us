# Quickstart: jeby-us (jeby.us and jainsights.com)

Goal: a stranger on a clean machine sees both sites running locally in under fifteen minutes.

## Prerequisites (with minimum versions)
- Windows 11 tested (macOS/Linux: the same commands with `python3`; not tested here)
- Python 3.10 or newer (tested on 3.13); no packages to install
- Git
- Node 22 or newer and Edge or Chrome, only for the optional browser tests (tested on Node 24)
- No accounts or keys. Fonts load from Google Fonts when online.

## Install
```powershell
# Windows
git clone https://github.com/jameseby21/jeby-us.git
cd jeby-us
```
```bash
# macOS / Linux
git clone https://github.com/jameseby21/jeby-us.git
cd jeby-us
```

## Run
```
preview.cmd        (Windows)
./preview.sh       (macOS / Linux)
```
Both sites by default. Add a tag for one site: `preview.cmd jai` (JA Insights only, http://127.0.0.1:8081) or `preview.cmd jeby` (jeby.us only, http://127.0.0.1:8080); `--no-serve` builds and starts nothing.

Open http://127.0.0.1:8080 (jeby.us) and http://127.0.0.1:8081 (JA Insights). You should see the jeby.us home page with the family strip at the top, and the JA Insights home page. Ctrl+C stops both servers.

## Verify
```
python _src/build.py
python _src/check_links.py
node _src/jai/tests/run.js
```
Expected: `built [...]` twice (17 entries for jeby.us, 7 pages for JA Insights), then `ok: ... none dead`, then `162 passed, 0 failed` (the last line needs Node; the browser tests are in [COMMANDS.md](COMMANDS.md)).

## If it fails
| You see | It means | Do |
| --- | --- | --- |
| `FileExistsError` from `build.py --publish` on Windows | a folder in the repository root could not be deleted before it was copied again (something holds it open) | `git status`, delete that one folder, run `--publish` again, then `git status` to see only the files you meant to change |
| `UnicodeEncodeError` during build | an old checkout without the Windows fixes | `git pull` the branch |
| `Address already in use` | port 8080 or 8081 is taken | stop your own earlier preview, or run `python -m http.server <other port> --directory _src/jeby/out` |
| `check_links.py` lists dead links | a page or asset the HTML points at is missing | fix the source in `_src/`, rebuild |
| Build runs in the wrong Python | a project venv is first on PATH | use a plain interpreter: `python -I _src/build.py` |

## Next
- [Useful commands](COMMANDS.md)
- [Release process](RELEASE.md), [architecture](../_src/ARCHITECTURE.md), [source README](../_src/README.md)
