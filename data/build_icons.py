"""Enlarge favicon-16.png into the other icon sizes without blurring (nearest neighbour, whole-number scales)."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
NEAREST = getattr(Image, "Resampling", Image).NEAREST
SOURCE = Image.open(ROOT / "favicon-16.png").convert("RGBA")
assert SOURCE.size == (16, 16), SOURCE.size


def scaled(factor, canvas=None):
    big = SOURCE.resize((16 * factor, 16 * factor), NEAREST)
    if canvas is None:
        return big
    # Pad to the exact size a platform asks for (iPhone: 180 = 16 x 11 + 4) by letting the
    # outer dots run slightly wider underneath, so the picture itself is never resampled.
    out = SOURCE.resize((canvas, canvas), NEAREST)
    offset = (canvas - big.width) // 2
    out.paste(big, (offset, offset))
    return out


targets = {
    "favicon-32.png": scaled(2),
    "favicon-48.png": scaled(3),
    "apple-touch-icon.png": scaled(11, 180),
    "icon-192.png": scaled(12),
}
for name, image in targets.items():
    image.save(ROOT / name)
    print(name, image.size)
