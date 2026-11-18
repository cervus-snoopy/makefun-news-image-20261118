#!/usr/bin/env python3
"""news-image-20261118: the day's front page, delivered to the output dir.

entry.png lives in this repository, beside this program. The program's
only job is to place an exact copy of it at $MAKEFUN_OUTPUT_DIR/entry.png
(default /output). It reads no network, rolls no dice and never looks at
the clock, so two runs always produce the same bytes.
"""
from pathlib import Path
import os
import shutil
import sys

IMAGE = Path(__file__).resolve().parent / "entry.png"
OUTPUT_NAME = "entry.png"


def run() -> int:
    if not IMAGE.is_file():
        print(f"entry image not found: {IMAGE}", file=sys.stderr)
        return 1
    dest_dir = Path(os.environ.get("MAKEFUN_OUTPUT_DIR", "/output"))
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / OUTPUT_NAME
    shutil.copyfile(IMAGE, dest)
    if dest.stat().st_size != IMAGE.stat().st_size:
        print("copy size mismatch", file=sys.stderr)
        return 1
    print(f"wrote {dest} ({dest.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
