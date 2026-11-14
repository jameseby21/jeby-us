# Site source: jeby.us and jainsights.com

Everything both sites are built from. GitHub Pages serves the repository root (the built jeby.us); this folder starts with an underscore, so Pages never publishes it.

## Build

Python 3.10 or newer, nothing else to install.

```
python3 _src/build.py            # builds both sites into _src/jeby/out and _src/jai/out
python3 _src/build.py --publish  # also makes the repository root match the jeby.us build
```

Commit the root after `--publish`; that commit is what goes live on jeby.us. `python3 _src/build.py --check` lists any root file that differs from the build (exit 1); a GitHub Actions workflow runs it on every pull request, so a hand-edited or half-published root cannot merge.

## Layout

| Path | What it is |
| --- | --- |
| `jeby/src/content.py` | Every word and setting on jeby.us: contact links, booking, the Lab projects, prices, the QR prompt. Voice rule (James, 2026-11-08): personal pages call him James and link to work rather than describe it; "jeby" introduces him on professional pages only. The story and support text stay here but aren't rendered |
| `jeby/build.py`, `jeby/src/site.css`, `jeby/src/site.js` | The jeby.us page generator, styles and behaviour |
| `jeby/static/` | Images and files copied as they are: the Drew photo, the Drew QR, the poster PDF, project marks |
| `jai/src/screening.js` | The screen that runs before any statistics (CONS-0045): one line per pattern (licensed identifiers such as TDLinx, D-U-N-S, MLS, credit-bureau and Nielsen ids; personal data; government ids; card numbers; credentials and tokens; minors), the class of each and the reason shown to the visitor. A flagged column is left out of the report, the table and the export unless it is in a class that allows the visitor to confirm they hold the rights; government ids, card numbers, credentials and minors have no override. It reads names and a sample of values to decide and keeps only the names; it makes no network call. The same list is the reference for the standards rule STD-0041 |
| `jai/src/sources.js` | The "How to supplement your data" list at the end of every report: free and paid, open and licensed sources, in groups chosen by what the report detected (places, dates, money, a ledger, any file). It is data only, with the rules for editing it in its header; Joe and Chaz edit it without touching code |
| `jai/src/jai_content.py` | Every word and price on jainsights.com. Prices are hours × the one rate, computed at build time |
| `jai/build.py`, `jai/src/jai.css`, `jai/src/jai.js`, `jai/src/report.js`, `jai/src/records.js`, `jai/src/domain.js`, `jai/src/rules.js`, `jai/src/shape.js`, `jai/src/pack.js` | The jainsights.com generator, styles, behaviour and the in-browser free report (`report.js` reads and analyses; `records.js` is the records table, editing (a double-click on a computer, a tap on a phone, where one field opens in a sheet at the bottom of the screen) and export; `domain.js` holds the column roles, thresholds, the eight data-quality classes and every check's rule in one block at the top for Joe and Chaz to edit; `rules.js` is data only (header, role, unit, gate, ledger and name-normalization rules, one section each); the same name at the same address (or, with no address column, the same coordinates) is one place entered more than once, a duplicate, while the same name at different places is a spelling variant (`placeDuplicates` in `domain.js`; the rule is in the finding's text); the grouping (`grouping` in the analysis, drawn by `groupHTML` in `report.js`) groups by one column or nests the biggest kinds of a second column under each group, with the share of the total, the rows, the mean, a top N with an Other bucket, count distinct as a measure and an optional second measure; Worth a look is five items (`pickWorth` in `report.js`): a seeded random sample, or the largest by the measure, never a row QA marks Fix, each with a Search news button whose query is built from a name, a street (without its number), a city or a category column only and is shown on hover (free edition: opens Google News in a new tab on click, nothing else leaves the browser); every insight carries its justification (roles, units, n, method) and passes the gate defined there (`GATE`, run by `domain.js`) or is listed under Not shown with the reason; `shape.js` decides whether the first row is a header, skips title rows, names columns of a headerless file by role and refuses a column name that looks like a value, and recognizes a ledger (a date, a signed money column and a description: kind transactions, where a sign is a direction) and works out its money out and in, months, merchants, recurring charges, duplicates, running balance and date gaps; it also finds the merchant or name behind a description (processor prefixes, reference codes, store numbers, cities: the rules are `NORMALIZE` in `rules.js`), groups by it, and lists a name written more than one way as an FYI with a Merge button, not a defect; `pack.js` reads optional rule packs from `jai/packs/*.json`, none loaded by default, loaded with `?pack=real-estate` or the file picker) |
| `brand/marks.json`, `brand/marks/`, `brand/brand.py`, `brand/brand.js` | Every brand mark and favicon candidate for both sites, and the rotation that shows one per session (the cycling rule). Add or retire a candidate in `marks.json` only |
| `check_text.py` | The text floor for both sites: renders every built page at 1440 and 390 px in headless Edge or Chrome and fails on any text under 12 px or below 4.5:1 contrast (`python _src/check_text.py`, after `build.py`). Caption grays live in `--muted` (`site.css`, `jai.css`) and in `family/family.js`; SVG words are kept at 12 px by `fitSvgText` in `jai/src/jai.js` |
| `check_docs.py`, `../docs/doc-ownership.yaml` | The doc-ownership map (which document section owns each file under `_src/`, `docs/` and `.github/`) and its dependency-free check: `python3 _src/check_docs.py` prints `<n> files, 0 unowned, 0 problems`. Add a row to the map in the same change as any new file |
| `jai/tests/` | Report tests: `run.js` (Node, no DOM), `browser.js` (headless Edge or Chrome), synthetic fixtures made by `make_fixtures.py`. No real data |
| `family/family.js` | How the two sites link: the shared "jeby family" strip (option C, the default), or one site (A) or sister sites (B) |
| `research/src/` | The galaxy-cluster slideshow on jeby.us/research. Each slide's text is in `slides.js` (title, body, an "In the animation" line, the key result); keep it short enough to fit the 640 px text panel |
| `ARCHITECTURE.md`, `architecture/` | Diagrams of the hosting, the build, both sites, the family links and the free report, with the tech stack and brand assets. `architecture/` holds each diagram's Mermaid source and SVG render |

The Lab projects in `jeby/src/content.py` feed both sites: the free edition on jeby.us/lab and the paid edition on jainsights.com/products.

## Switches

- `PREVIEW_SLOTS` in `jeby/src/content.py`: `True` shows empty draft slots and unconfigured sponsor buttons, for previews only. Keep `False` for anything published.
- `CONFIG["booking"]` on both sites: `email` until a Cal.com (or Calendly, or form) link exists.
- `SUPPORT["providers"]`: a sponsor button appears once its URL is filled in.
- `CONFIG["report_rows"]` and `CONFIG["report_cols"]` in `jai/src/jai_content.py`: the free report's limits. A file over `report_rows` is not cut: the report reads it as pieces of that size (piece 1 of N, Next and Previous piece), screening each piece and keeping what an earlier piece flagged out of the later ones; only the header and one piece are held in the page, and the next piece is read from the file the visitor already chose (`slicePiece` in `report.js`).

## jainsights.com

The JA Insights build in `_src/jai/out` is served from its own repository with its own GitHub Pages site and `CNAME` (`jainsights.com`). The domain's DNS lives at Squarespace. Go-live order: jainsights.com first, then jeby.us, so the family links never point at an empty site.

## Release

How a change goes from `_src` to live: [docs/RELEASE.md](../docs/RELEASE.md). Local preview: `preview.cmd` (Windows) or `./preview.sh`.
