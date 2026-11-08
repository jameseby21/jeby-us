# Site source: jeby.us and jainsights.com

Everything both sites are built from. GitHub Pages serves the repository root (the built jeby.us); this folder starts with an underscore, so Pages never publishes it.

## Build

Python 3.10 or newer, nothing else to install.

```
python3 _src/build.py            # builds both sites into _src/jeby/out and _src/jai/out
python3 _src/build.py --publish  # also copies the jeby.us build into the repository root
```

Commit the root after `--publish`; that commit is what goes live on jeby.us.

## Layout

| Path | What it is |
| --- | --- |
| `jeby/src/content.py` | Every word and setting on jeby.us: contact links, booking, the story, the Lab projects, prices, the QR prompt |
| `jeby/build.py`, `jeby/src/site.css`, `jeby/src/site.js` | The jeby.us page generator, styles and behaviour |
| `jeby/static/` | Images and files copied as they are: the Drew photo, the Drew QR, the poster PDF, project marks |
| `jai/src/jai_content.py` | Every word and price on jainsights.com. Prices are hours × the one rate, computed at build time |
| `jai/build.py`, `jai/src/jai.css`, `jai/src/jai.js`, `jai/src/report.js`, `jai/src/records.js`, `jai/src/domain.js`, `jai/src/rules.js`, `jai/src/shape.js`, `jai/src/pack.js` | The jainsights.com generator, styles, behaviour and the in-browser free report (`report.js` reads and analyses; `records.js` is the records table, editing and export; `domain.js` holds the column roles, thresholds, the eight data-quality classes and every check's rule in one block at the top for Joe and Chaz to edit; `rules.js` is data only (header, role, unit, gate, ledger and name-normalization rules, one section each); every insight carries its justification (roles, units, n, method) and passes the gate defined there (`GATE`, run by `domain.js`) or is listed under Not shown with the reason; `shape.js` decides whether the first row is a header, skips title rows, names columns of a headerless file by role and refuses a column name that looks like a value, and recognizes a ledger (a date, a signed money column and a description: kind transactions, where a sign is a direction) and works out its money out and in, months, merchants, recurring charges, duplicates, running balance and date gaps; it also finds the merchant or name behind a description (processor prefixes, reference codes, store numbers, cities: the rules are `NORMALIZE` in `rules.js`), groups by it, and lists a name written more than one way as an FYI with a Merge button, not a defect; `pack.js` reads optional rule packs from `jai/packs/*.json`, none loaded by default, loaded with `?pack=real-estate` or the file picker) |
| `brand/marks.json`, `brand/marks/`, `brand/brand.py`, `brand/brand.js` | Every brand mark and favicon candidate for both sites, and the rotation that shows one per session (the cycling rule). Add or retire a candidate in `marks.json` only |
| `check_text.py` | The text floor for both sites: renders every built page at 1440 and 390 px in headless Edge or Chrome and fails on any text under 12 px or below 4.5:1 contrast (`python _src/check_text.py`, after `build.py`). Caption grays live in `--muted` (`site.css`, `jai.css`) and in `family/family.js`; SVG words are kept at 12 px by `fitSvgText` in `jai/src/jai.js` |
| `jai/tests/` | Report tests: `run.js` (Node, no DOM), `browser.js` (headless Edge or Chrome), synthetic fixtures made by `make_fixtures.py`. No real data |
| `family/family.js` | How the two sites link: the shared "jeby family" strip (option C, the default), or one site (A) or sister sites (B) |
| `research/src/` | The galaxy-cluster slideshow on jeby.us/research |
| `ARCHITECTURE.md`, `architecture/` | Diagrams of the hosting, the build, both sites, the family links and the free report, with the tech stack and brand assets. `architecture/` holds each diagram's Mermaid source and SVG render |

The Lab projects in `jeby/src/content.py` feed both sites: the free edition on jeby.us/lab and the paid edition on jainsights.com/products.

## Switches

- `PREVIEW_SLOTS` in `jeby/src/content.py`: `True` shows empty draft slots and unconfigured sponsor buttons, for previews only. Keep `False` for anything published.
- `CONFIG["booking"]` on both sites: `email` until a Cal.com (or Calendly, or form) link exists.
- `SUPPORT["providers"]`: a sponsor button appears once its URL is filled in.
- `CONFIG["report_rows"]` and `CONFIG["report_cols"]` in `jai/src/jai_content.py`: the free report's limits.

## jainsights.com

The JA Insights build in `_src/jai/out` is served from its own repository with its own GitHub Pages site and `CNAME` (`jainsights.com`). The domain's DNS lives at Squarespace. Go-live order: jainsights.com first, then jeby.us, so the family links never point at an empty site.

## Release

How a change goes from `_src` to live: [docs/RELEASE.md](../docs/RELEASE.md). Local preview: `preview.cmd` (Windows) or `./preview.sh`.
