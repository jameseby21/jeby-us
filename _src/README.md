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
| `jai/build.py`, `jai/src/jai.css`, `jai/src/jai.js`, `jai/src/report.js` | The jainsights.com generator, styles, behaviour and the in-browser free report |
| `family/family.js` | How the two sites link: the shared "jeby family" strip (option C, the default), or one site (A) or sister sites (B) |
| `research/src/` | The galaxy-cluster slideshow on jeby.us/research |
| `print/` | Print artwork: `make_print.py` builds the business card and the Drew QR sticker as CMYK PDFs from the original Drew QR and the site fonts. Specs: [docs/DESIGN.md](../docs/DESIGN.md#print) |
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
