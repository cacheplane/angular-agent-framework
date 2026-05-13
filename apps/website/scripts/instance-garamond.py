"""
Generate apps/website/src/app/EBGaramond-Bold.ttf from the upstream EB
Garamond variable font.

Why this script exists:
- Satori (the engine behind Next.js ImageResponse) crashes on variable-weight
  TTFs with "Cannot read properties of undefined (reading '256')".
- Google Fonts only serves Garamond as woff2, which Satori also can't decode.
- So we instance the upstream variable font to a single weight (Bold, 700)
  and strip the now-unused variable-font tables, producing a static TTF
  Satori parses cleanly.

The output is committed to the repo and consumed by
apps/website/src/app/opengraph-image.tsx at request time.

Usage:
    pip install --user fonttools
    python3 apps/website/scripts/instance-garamond.py

Re-run if the upstream font is updated.
"""
import os
import tempfile
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

UPSTREAM_URL = "https://github.com/google/fonts/raw/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf"
TARGET_WEIGHT = 700
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src",
    "app",
    "EBGaramond-Bold.ttf",
)


def main() -> None:
    print(f"Downloading variable TTF from {UPSTREAM_URL}")
    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        with urllib.request.urlopen(UPSTREAM_URL) as response:
            tmp.write(response.read())
        src_path = tmp.name

    try:
        print(f"Instancing to wght={TARGET_WEIGHT}")
        font = TTFont(src_path)
        static = instantiateVariableFont(font, {"wght": TARGET_WEIGHT})

        # Drop variable-font tables that no longer serve a purpose and that
        # Satori doesn't need. Shaves ~300KB off the file.
        for tag in ("STAT", "fvar", "MVAR", "HVAR"):
            if tag in static:
                del static[tag]

        print(f"Writing {OUTPUT_PATH}")
        static.save(OUTPUT_PATH)
        size_kb = os.path.getsize(OUTPUT_PATH) // 1024
        print(f"Done — {size_kb} KB")
    finally:
        os.unlink(src_path)


if __name__ == "__main__":
    main()
