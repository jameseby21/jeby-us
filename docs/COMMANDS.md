# Useful commands: jeby-us

Every command a person or an agent runs day to day. Use `python3` for `python` on macOS/Linux.

## Daily
| Command | What it does | When |
| --- | --- | --- |
| `preview.cmd` / `./preview.sh` | builds both sites, then serves both from one process: jeby.us on http://127.0.0.1:8080 and JA Insights on http://127.0.0.1:8081; tags pick the sites: `preview.cmd jai` (only JA Insights), `preview.cmd jeby` (only jeby.us), `--no-serve` (build only), `--no-build` (serve the existing build), `--live-links` (keep the real https://jeby.us and https://jainsights.com links); Ctrl+C stops them | every session that changes content |
| `python _src/preview.py [jeby] [jai] [--no-build] [--no-serve] [--live-links]` | what the two scripts call; same tags | when a script is not available |
| `python _src/build.py` | builds into `_src/jeby/out` and `_src/jai/out` | after every source edit |
| `python _src/test_build.py` | unit tests for the publish and drift steps of `build.py` and the drift check (temporary folders, including a file held open) | after any change to `_src/build.py` |
| `python _src/check_docs.py` | the doc-ownership check: every file under `_src/`, `docs/` and `.github/` matches a rule in `docs/doc-ownership.yaml`, every rule matches a file and names a document and heading that exist, and `README.md` links the map; prints `<n> files, 0 unowned, 0 problems`, exit 0, otherwise lists each problem and exits 1; plain Python, no install | before every PR, and whenever a file is added, moved or removed |
| `python _src/test_check_docs.py` | unit tests for that check (temporary folders) and a check that this checkout has 0 unowned files | after any change to `_src/check_docs.py` |
| `python _src/check_links.py` | fails on any dead internal or family link | before every PR |
| `python _src/check_text.py [--site jeby\|jai] [--widths 1440 390] [--list]` | after a build, renders every page of both sites (and the free report with its made-up sample loaded) in headless Edge or Chrome at 1440 and 390 px, jeby.us in both themes, and counts visible text under 12 px (SVG words after scaling) and text below 4.5:1 contrast (3:1 for large text); exit 0 when both counts are 0, 1 otherwise, `NOT RUN` with exit 0 when no browser; serves the two build folders from 127.0.0.1 on free ports, uses one temporary profile, and stops only the processes that carry it and removes it afterwards; the report's print stylesheet is not measured | before every PR that touches CSS, copy or a chart |
| `node _src/jai/tests/run.js` | free report logic tests on synthetic fixtures (outliers, table model, edits, export, notable records, header detection, roles, the insight gate, ledgers, name normalization, slices for the interactive findings and the URL hash); plain Node, no install | after any change to `jai/src/report.js`, `records.js`, `domain.js`, `shape.js` or `rules.js` |
| `python _src/build.py` then `node _src/jai/tests/browser.js` | renders the built report in headless Edge or Chrome, served from `_src/jai/out` by a throw-away local server on a free port 127.0.0.1 (so the Web Worker starts; also checks the file:// fallback) (one temporary profile; afterwards every process that carries that profile folder is stopped and the folder removed, nothing else is touched; also checks the 10,000-row table, a 390 px phone width measured against the fixed 390 px layout width (so a rotated stamp that grows the page is caught), print to PDF as one Letter page with and without edits, the rate label at three widths, the supplement section, screening, grouping and Search news; and the interactive layer: click a bar, a finding, a health line or a column name and the report is worked out for that slice, Back and Forward by the URL hash, the hover numbers, Compare, Tab and Enter, a reload from the link, a 390 px phone width); prints NOT RUN when no browser or Node older than 22 | before a PR that changes the report page |
| `python _src/build.py` then `node _src/brand/check_brand.js` | drives headless Edge or Chrome over `_src/jeby/out` (127.0.0.1, free port, temporary profile removed after) and checks the jeby.us favicon: one of the two candidates, never the previous session's, kept across pages, follows the logo and the light toggle, a click on the mark cycles and sticks, no error with storage blocked; `NOT RUN` with exit 0 when no browser | before a PR that touches `_src/brand/` |
| `python _src/build.py` then `python _src/og.py [--check]` | regenerates `_src/jeby/static/og.png` (1200 x 630) as a screenshot of the built Home page in the dark theme; `--check` renders to a temporary file and writes nothing in the repo | when Home's first screen changes |
| `node _src/jai/tests/bench.js <path-to-csv> [--pack real-estate]` | benchmark of the free report engine on one CSV: finding counts by data-quality class, with a rule pack the overlap, pack-only and generic-only findings, up to three example reasons each; prints no address, id or name, and writes nothing (the path is only an argument) | when comparing the generic engine with a rule pack on a real file kept outside the repo |
| `python _src/jai/tests/make_fixtures.py` | regenerates the seeded synthetic fixtures under `_src/jai/tests/fixtures/` | only when the fixture shape changes |
| none for lint or format | no linter or formatter is configured; `python _src/check_text.py`, `python _src/check_links.py` and `python _src/check_docs.py` are the gates | before every commit |

## Data and environment
| Command | What it does | Notes |
| --- | --- | --- |
| none | there is no database or environment; every word lives in `_src/jeby/src/content.py` and `_src/jai/src/jai_content.py` | |

## Build, release, docs
| Command | What it does | Notes |
| --- | --- | --- |
| `python _src/build.py --check` | builds, then lists every file in the repository root that differs from the build (`differs: <path>`) and prints `N files differ`; exit 1 when N is above 0; also runs on every pull request in `.github/workflows/drift.yml` | before a PR that touches `_src/` or the root |
| `python _src/build.py --publish` | also makes the repository root (what GitHub Pages serves) match the jeby.us build, file by file; unchanged files are not touched, no folder is deleted, and it prints the files it changed | only on a branch, only per [RELEASE.md](RELEASE.md); merging to main is the deploy |
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
| stale Desk install | `drew doctor` (exit 1 when stale), then `drew upgrade` (it refuses while the Desk UI is running) |
| port in use | `netstat -ano \| findstr :8080` then stop only your own PID: `taskkill /PID <pid> /F` (macOS: `lsof -i :8080`, `kill <pid>`) |
| build fails on the wrong Python | `python -I _src/build.py` with a plain interpreter, not a project venv |
