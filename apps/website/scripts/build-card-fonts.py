"""
Generate the static, subsetted TTFs the social cards render with.

Why this script exists
----------------------
Satori (the engine behind Next.js ImageResponse) cannot decode woff2, which is
the only format Google Fonts serves, and it crashes on variable-weight TTFs
with "Cannot read properties of undefined (reading '256')". So every face a
card uses has to reach the renderer as a single static weight, stripped of its
variable tables, and committed.

Every face a card uses is bundled here rather than scraped from the Google
Fonts CSS API at render time. That was a network round trip inside an image
render, and when it failed there was no error — the card silently fell back to
whatever loaded, which is how a card whose eyebrow and pills are specified in
mono came out set in serif. Bundling removes the dependency.

The faces are the site's own: Archivo Black for display type, Archivo for
body, JetBrains Mono for the eyebrow and pills. Archivo Black is shipped by
Google as a *static* font — it has no `fvar` — so instancing is conditional;
running the instancer over it would fail rather than no-op. Archivo's variable
source carries a `wdth` axis alongside `wght`, which has to be pinned too, or
variable tables survive into the output and Satori chokes on them.

The fonts are subsetted to Latin plus the punctuation the site actually uses,
which is what keeps four faces under 150KB total rather than well over 1MB.
Blog post titles are the only unbounded text on a card; anything outside this
range falls back to Satori's bundled Noto Sans rather than failing.

Usage:
    pip install --user fonttools   # no brotli: this reads and writes TTF
    python3 apps/website/scripts/build-card-fonts.py

Re-run if an upstream font is updated, and commit the result.
"""

import os
import tempfile
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), "src", "app", "card", "fonts")

# Basic Latin, Latin-1 Supplement, and the General Punctuation the site uses
# (typographic quotes, en/em dashes, ellipsis, the middot separator).
UNICODES = "U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2030,U+2039,U+203A,U+20AC,U+00B7"

FACES = [
    {
        # Static — no `fvar`, so `build()` skips instancing for this one.
        "name": "ArchivoBlack-Regular.ttf",
        "url": "https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf",
        "weight": 400,
    },
    {
        "name": "Archivo-Regular.ttf",
        "url": "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf",
        "weight": 400,
    },
    {
        "name": "Archivo-SemiBold.ttf",
        "url": "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf",
        "weight": 600,
    },
    {
        "name": "JetBrainsMono-Bold.ttf",
        "url": "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
        "weight": 700,
    },
]


def build(face: dict) -> None:
    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        print(f"  downloading {face['url']}")
        with urllib.request.urlopen(face["url"]) as res:
            tmp.write(res.read())
        raw = tmp.name

    font = TTFont(raw)
    # Archivo Black ships static, with no `fvar`. Running the instancer over a
    # font with no axes is not a harmless no-op, so only instance when there is
    # something to instance. Every *other* axis the source carries has to be
    # pinned as well, or its variation tables survive for Satori to trip over.
    # Archivo carries `wdth` (pinned to the normal width); `opsz` is handled
    # too, since Google ships several text faces with an optical-size axis.
    if "fvar" in font:
        tags = {a.axisTag for a in font["fvar"].axes}
        axes = {"wght": face["weight"]}
        if "wdth" in tags:
            axes["wdth"] = 100
        if "opsz" in tags:
            axes["opsz"] = 14
        font = instantiateVariableFont(font, axes, updateFontNames=False, inplace=True)
    for table in ("fvar", "STAT", "MVAR", "HVAR", "VVAR", "gvar", "cvar", "avar"):
        if table in font:
            del font[table]

    options = subset.Options()
    options.set(layout_features=["*"], name_IDs=["*"], notdef_outline=True)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)

    out = os.path.join(OUT_DIR, face["name"])
    font.save(out)
    os.unlink(raw)
    print(f"  wrote {face['name']} ({os.path.getsize(out) // 1024}KB)")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for face in FACES:
        print(f"{face['name']} @ {face['weight']}")
        build(face)


if __name__ == "__main__":
    main()
