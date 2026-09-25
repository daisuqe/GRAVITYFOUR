"""Build the 99-character contact sheet from current published portrait layers."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
records = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]
assert len(records) == 99

columns, tile_width, tile_height = 9, 126, 150
rows = (len(records) + columns - 1) // columns
sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "#07110d")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype(str(ROOT / "yodaka.ttf"), 22)

for index, record in enumerate(records):
    x = index % columns * tile_width
    y = index // columns * tile_height
    draw.rectangle((x + 3, y + 3, x + tile_width - 4, y + tile_height - 4),
                   fill="#10251a", outline="#428e66", width=1)
    portrait = Image.open(PROJECT / "characters" / record["file"]).convert("RGBA")
    for part in ("eyes", "mouth"):
        layer = Image.open(PROJECT / "characters" / "player-parts" /
                           (record[part] + ".png")).convert("RGBA")
        portrait.alpha_composite(layer)
    portrait = portrait.resize((112, 112), Image.Resampling.NEAREST)
    sheet.paste(portrait, (x + 7, y + 7), portrait)
    name = record["name"]
    name_width = draw.textlength(name, font=font)
    draw.text((x + (tile_width - name_width) / 2, y + 125), name,
              font=font, fill="#d6ffe7")

output = ROOT / "GRAVITYFOUR-characters" / "contact-sheet.png"
sheet.save(output)
print(f"Saved {len(records)} characters to {output} ({sheet.width}x{sheet.height})")
