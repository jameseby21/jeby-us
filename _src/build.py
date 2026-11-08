"""Builds jeby.us and jainsights.com from this folder. Python 3.10+, no other dependencies.

    python3 _src/build.py            build both sites into _src/jeby/out and _src/jai/out
    python3 _src/build.py --publish  also copy the jeby.us build into the repository root, which GitHub Pages serves
    python3 _src/build.py --check    build, then list root files that differ from the build; exit 1 if any do
"""
import pathlib, shutil, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent


def build_files(out):
    """Every file the build publishes, as paths relative to out."""
    return sorted(p.relative_to(out) for p in out.rglob("*") if p.is_file())


def differing(out, root):
    """Published files whose root copy is missing or has different bytes, as posix paths."""
    return [rel.as_posix() for rel in build_files(out)
            if not (root / rel).is_file() or (root / rel).read_bytes() != (out / rel).read_bytes()]


def publish(out, root):
    """Make root match the build, file by file.  A folder is never deleted and re-created: on Windows a
    held-open file makes rmtree fail halfway and the copy that followed raised FileExistsError (JEBYUS-0060).
    Unchanged files are left alone, so a locked file only matters when it has to change."""
    changed = differing(out, root)
    for name in changed:
        dest = root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out / name, dest)
    return changed


def main(argv):
    out, root = HERE / "jeby" / "out", HERE.parent
    for site in ("jeby", "jai"):                  # jai reuses jeby's content and assets, so jeby builds first
        subprocess.run([sys.executable, "build.py"], cwd=HERE / site, check=True)
    if "--publish" in argv:
        changed = publish(out, root)
        print("published the jeby.us build to", root, f"({len(changed)} files changed)")
        for name in changed: print("  ", name)
        left = differing(out, root)
        if left: sys.exit(f"publish left {len(left)} files different: {', '.join(left)}")
    if "--check" in argv:
        diff = differing(out, root)
        for name in diff: print("differs:", name)
        print(f"{len(diff)} files differ")
        if diff: sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
