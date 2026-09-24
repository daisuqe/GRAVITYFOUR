"""Check that every character in the source sheet reaches the published font."""

from pathlib import Path

from fontTools.ttLib import TTFont


root = Path(__file__).resolve().parent.parent
font = TTFont(root / "yodaka.woff")
cmap = font.getBestCmap()
source_rows = (
    "0123456789",
    "!\"#$%&'()=*",
    "+-×÷/＼~^|\\@",
    "{}[]「」;:<>,",
    ".?・_　百千万円",
    "一二三四五六七八九十",
)
for character in "".join(source_rows):
    glyph_name = cmap.get(ord(character))
    assert glyph_name, f"Missing {character!r}"
    if character != "　":
        assert font["glyf"][glyph_name].numberOfContours, f"Empty {character!r}"

assert font["glyf"][cmap[ord("　")]].numberOfContours == 0
print("YODAKA source glyphs are present in yodaka.woff")
