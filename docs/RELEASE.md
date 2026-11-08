# Release: from a content change to live jeby.us

Owner: the jeby-us project session. Gate: James approves in Desk. GitHub Pages serves the repository root of `main`, so **merging to main is the deploy**. Never push to main directly.

Python 3.10+ is the only requirement. Use `python` on Windows, `python3` on macOS/Linux.

| # | Step | Command | Check |
| --- | --- | --- | --- |
| 1 | Edit source under `_src/` only: `jeby/src/content.py`, `jai/src/jai_content.py`, the generators. Never hand-edit built files in the repository root. | `git checkout -b <branch>` | `git status` shows changes only under `_src/` (and `docs/`) |
| 2 | Build both sites. | `python _src/build.py` | `_src/jeby/out` and `_src/jai/out` exist; page counts match the layout in `_src/README.md` (jeby.us: 8 HTML pages, 17 top-level entries; JA Insights: 7 pages) |
| 3 | Preview locally (this runs step 2 too). | `preview.cmd` (Windows) or `./preview.sh` (macOS/Linux), or by hand: `python -m http.server 8080 --directory _src/jeby/out` and `python -m http.server 8081 --directory _src/jai/out` | Open http://127.0.0.1:8080 and :8081; click the family strip both ways; check phone width (390). Ctrl+C stops both servers; say so in the ticket Report |
| 4 | Checks before a PR. | `python _src/check_links.py` | Prints `ok ... none dead` (exit 0). Also: the QR page decodes with two readers; `PREVIEW_SLOTS` is `False`; `CONFIG["booking"]` and `SUPPORT["providers"]` are as James decided |
| 5 | Publish build, commit, PR. | `python _src/build.py --publish`, then `git add -A && git commit`, `git push origin <branch>`, open a pull request | Root and source are in the same commit; the PR description lists the checks that ran and their output |
| 6 | Approval. | James approves in Desk (an approve ask) with the preview link he opened | Nobody merges on an inferred yes |
| 7 | Merge = deploy, then verify live. | Merge the PR on GitHub | Fetch https://jeby.us, the About page and /qr; the Drew QR image and the old URL still work; record the commit sha in the ticket |
| 8 | jainsights.com goes live first, from its own repository and CNAME (DNS at Squarespace). | Publish `_src/jai/out` to that repository | https://jainsights.com loads before jeby.us ships, so no family link points at an empty site |

Clean-checkout rule: before step 5, run steps 2 and 4 from a fresh clone on Windows and on macOS.
