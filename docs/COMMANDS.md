# Useful commands: jeby-us

Every command a person or an agent runs day to day. Use `python3` for `python` on macOS/Linux.

## Daily
| Command | What it does | When |
| --- | --- | --- |
| `preview.cmd` / `./preview.sh` | builds both sites, serves jeby.us on 8080 and JA Insights on 8081 | every session that changes content |
| `python _src/build.py` | builds into `_src/jeby/out` and `_src/jai/out` | after every source edit |
| `python _src/check_links.py` | fails on any dead internal or family link | before every PR |

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
