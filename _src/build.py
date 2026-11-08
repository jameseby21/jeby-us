"""Builds jeby.us and jainsights.com from this folder. Python 3.10+, no other dependencies.

    python3 _src/build.py            build both sites into _src/jeby/out and _src/jai/out
    python3 _src/build.py --publish  also copy the jeby.us build into the repository root, which GitHub Pages serves
"""
import pathlib, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent
for site in ("jeby", "jai"):                      # jai reuses jeby's content and assets, so jeby builds first
    subprocess.run([sys.executable, "build.py"], cwd=HERE / site, check=True)
if "--publish" in sys.argv:
    root, out = HERE.parent, HERE / "jeby" / "out"
    for item in out.iterdir():
        dest = root / item.name
        if item.is_dir(): shutil.rmtree(dest, ignore_errors=True); shutil.copytree(item, dest)
        else: shutil.copy2(item, dest)
    print("published the jeby.us build to", root)
