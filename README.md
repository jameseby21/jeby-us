# jeby-us

The source and the published pages of [jeby.us](https://jeby.us) (James Eby) and the build of [jainsights.com](https://jainsights.com) (JA Insights). GitHub Pages serves the repository root, which is the built jeby.us; everything the sites are built from is in [`_src/`](_src/README.md).

## Get started

- [Quickstart](docs/QUICKSTART.md): a clean clone to both sites running locally, then the checks.
- [Useful commands](docs/COMMANDS.md): every command a person or an agent runs, with what it does and when.
- [Release process](docs/RELEASE.md) and [architecture](_src/ARCHITECTURE.md).
- [Documentation ownership map](docs/doc-ownership.yaml): which document section owns each file under `_src/`, `docs/` and `.github/`; `python _src/check_docs.py` checks it (standards rule 20).

## What is free, what is paid, and under which license

Everything in this repository is free: the sites, their source and the free data report, which analyses a CSV or Excel file in your own browser (the file never leaves your device; it reads 10,000 rows at a time). What is paid is the work JA Insights LLC sells, such as consulting, the Data health check across a whole file and anything built for a client; that layer is a separate private edition that depends on this one and is not copied from it. A client always keeps their own data in an open format, and usually the code or configuration built for them, and loses the hosted service, support and updates. The code (build scripts, JavaScript, CSS, tests) is [MIT](LICENSE); the words, photographs, illustrations and brand marks are [CC BY-NC-SA 4.0](LICENSE-CONTENT.md). Copyright (c) 2026 JA Insights LLC.

## Contributing

Outside contributions come under the same licenses and need a `Signed-off-by` line on each commit (the [Developer Certificate of Origin](https://developercertificate.org)).
