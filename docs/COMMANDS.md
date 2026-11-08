# Useful commands: jeby-us

Every command a person or an agent runs day to day. Use `python3` for `python` on macOS/Linux.

## Daily
| Command | What it does | When |
| --- | --- | --- |
| `preview.cmd` / `./preview.sh` | builds both sites, then serves both from one process: jeby.us on http://127.0.0.1:8080 and JA Insights on http://127.0.0.1:8081; tags pick the sites: `preview.cmd jai` (only JA Insights), `preview.cmd jeby` (only jeby.us), `--no-serve` (build only), `--no-build` (serve the existing build), `--live-links` (keep the real origins; by default the preview rewrites https://jeby.us and https://jainsights.com in HTML, JS and CSS to the local ports, so a test page never leads to the live sites); Ctrl+C stops them | every session that changes content |
| `python _src/preview.py [jeby] [jai] [--no-build] [--no-serve]` | what the two scripts call; same tags | when a script is not available |
| `python _src/build.py` | builds into `_src/jeby/out` and `_src/jai/out` | after every source edit |
| `python _src/check_links.py` | fails on any dead internal or family link | before every PR |
| `node _src/jai/tests/run.js` | free report logic tests on synthetic fixtures (outliers, table model, edits, export, notable records); plain Node, no install | after any change to `jai/src/report.js` or `records.js` |
| `python _src/build.py` then `node _src/jai/tests/browser.js` | renders the built report in headless Edge or Chrome (one temporary profile; afterwards every process that carries that profile folder is stopped and the folder removed, nothing else is touched; also checks the 10,000-row table, a 390 px phone width and print); prints NOT RUN when no browser or Node older than 22 | before a PR that changes the report page |
| `python _src/jai/tests/make_fixtures.py` | regenerates the seeded synthetic fixtures under `_src/jai/tests/fixtures/` | only when the fixture shape changes |

## Data and environment
| Command | What it does | Notes |
| --- | --- | --- |
| none | there is no database or environment; every word lives in `_src/jeby/src/content.py` and `_src/jai/src/jai_content.py` | |

## Build, release, docs
| Command | What it does | Notes |
| --- | --- | --- |
| `python _src/build.py --publish` | also copies the jeby.us build into the repository root, which is what GitHub Pages serves | only on a branch, only per [RELEASE.md](RELEASE.md); merging to main is the deploy |
| `git push origin <branch>` | pushes a branch | never push to main |

## Desk
| Command | What it does |
| --- | --- |
| `drew next --project jeby-us` | the next ready ticket for this project |
| `drew claim <ID>` / `drew report <ID> --file report.md` | take a ticket; hand it back with proof |
| `drew snap <ID>` | attach a screenshot as evidence |

## Troubleshooting one-liners
| Symptom | Command |
| --- | --- |
| port in use | `netstat -ano \| findstr :8080` then stop only your own PID: `taskkill /PID <pid> /F` (macOS: `lsof -i :8080`, `kill <pid>`) |
| build fails on the wrong Python | `python -I _src/build.py` with a plain interpreter, not a project venv |
