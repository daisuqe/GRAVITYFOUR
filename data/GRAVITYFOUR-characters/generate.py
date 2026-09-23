"""Build 99 face sprites from human01.psd.

Run from any directory:
    python generate.py E:/User/Daisuke/Unity/GRAVITYFOUR/data/human01.psd
"""

import base64
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import random
import sys

from PIL import Image, ImageDraw, ImageFont

from psd_reader import groups, load_psd, palette, rgba_pixels


ROOT = Path(__file__).resolve().parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"E:\User\Daisuke\Unity\GRAVITYFOUR\data\human01.psd"
)
OUTPUT = ROOT / "characters"
SEED = 20260923
COUNT = 99


def rgb_hex(color):
    return "#{:02X}{:02X}{:02X}".format(*color)


def render_avatar(psd, skin, eyes, mouth, hair, cloth, colors):
    width, height = psd["width"], psd["height"]
    out = bytearray(width * height * 4)
    for layer, replacement in (
        (skin, colors["skin"]), (eyes, None), (mouth, None),
        (hair, colors["hair"]), (cloth, colors["cloth"]),
    ):
        source = rgba_pixels(psd, layer)
        for pos in range(width * height):
            at = pos * 4
            alpha = source[at + 3]
            if not alpha:
                continue
            rgb = replacement if replacement is not None else source[at:at + 3]
            out[at:at + 4] = bytes((*rgb, alpha))
    return Image.frombytes("RGBA", (width, height), bytes(out))


def names_for(rng):
    consonants = "BDFGHKLMNPRSTVZ"
    vowels = "AEIOU"
    syllables = [c + v for c in consonants for v in vowels]
    candidates = [first + second for first in syllables for second in syllables
                  if first != second]
    rng.shuffle(candidates)
    return candidates[:COUNT]


def create_sheet(records, font_path):
    columns, tile_w, tile_h = 9, 126, 150
    rows = (len(records) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_w, rows * tile_h), "#EADFCB")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(font_path), 24)
    for number, record in enumerate(records):
        x = (number % columns) * tile_w
        y = (number // columns) * tile_h
        draw.rectangle((x + 3, y + 3, x + tile_w - 4, y + tile_h - 4),
                       fill="#F6EDD9", outline="#9F8768", width=1)
        sprite = Image.open(OUTPUT / record["file"]).convert("RGBA")
        sprite = sprite.resize((112, 112), Image.Resampling.NEAREST)
        sheet.paste(sprite, (x + 7, y + 7), sprite)
        text_x = x + (tile_w - draw.textlength(record["name"], font=font)) / 2
        draw.text((text_x, y + 125), record["name"], font=font, fill="#3C2D23")
    sheet.save(ROOT / "contact-sheet.png")


def create_gallery(records):
    cards = []
    for record in records:
        detail = (
            f'{record["hair"]}, {record["mouth"]}, {record["eyes"]}; '
            f'hair {record["colors"]["hair"]}, '
            f'cloth {record["colors"]["cloth"]}, '
            f'skin {record["colors"]["skin"]}'
        )
        cards.append(
            f'<figure title="{html.escape(detail)}"><img src="characters/{record["file"]}" '
            f'alt="{record["name"]}" width="16" height="16"><figcaption>{record["name"]}</figcaption></figure>'
        )
    page = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>99 FACES</title><style>
@font-face{font-family:yodaka;src:url("__EMBEDDED_FONT__") format("woff")}
*{box-sizing:border-box}body{margin:0;padding:22px;background:#eadfcb;color:#3c2d23;font-family:yodaka,monospace}
h1{font-size:clamp(26px,5vw,46px);font-weight:400;text-align:center;margin:0 0 26px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:14px;max-width:1300px;margin:auto}
figure{margin:0;padding:8px;background:#f6edd9;border:1px solid #9f8768;text-align:center}
img{display:block;width:100%;height:auto;aspect-ratio:1;image-rendering:pixelated}
figcaption{font-size:24px;margin:8px 0 2px}
</style></head><body><h1>99 FACES</h1><main>""" + "".join(cards) + "</main></body></html>"
    font_data = base64.b64encode((SOURCE.parent.parent / "yodaka.woff").read_bytes()).decode("ascii")
    page = page.replace("__EMBEDDED_FONT__", "data:font/woff;base64," + font_data)
    (ROOT / "gallery.html").write_text(page, encoding="utf-8")


def main():
    psd = load_psd(SOURCE)
    if (psd["width"], psd["height"]) != (16, 16):
        raise ValueError("Expected 16 x 16 source")
    layer_groups = groups(psd)
    hair_layers = layer_groups["hair"]
    # The PSD keeps the retired layer for reference. Never use it in new faces.
    mouth_layers = [layer for layer in layer_groups["mouth"]
                    if not layer["name"].startswith("mouth6")]
    eye_layers = layer_groups["eyes"]
    assert (len(hair_layers), len(mouth_layers), len(eye_layers)) == (11, 9, 15)
    for entries in (hair_layers, mouth_layers, eye_layers):
        assert len({rgba_pixels(psd, layer) for layer in entries}) == len(entries)

    base_skin = next(layer for layer in psd["layers"] if layer["name"] == "skin")
    base_cloth = next(layer for layer in psd["layers"] if layer["name"] == "cloth")
    palettes = {
        "hair": palette(psd, "hair color"),
        "cloth": palette(psd, "cloth color"),
        "skin": palette(psd, "skin color"),
    }
    assert tuple(map(len, (palettes["hair"], palettes["cloth"], palettes["skin"]))) == (13, 16, 4)

    previous = json.loads((ROOT / "characters-v1.json").read_text(encoding="utf-8"))
    records = previous["characters"]
    assert len(records) == COUNT and len({r["name"] for r in records}) == COUNT
    hair_by_name = {layer["name"]: layer for layer in hair_layers}
    mouth_by_name = {layer["name"]: layer for layer in mouth_layers}
    eye_by_name = {layer["name"]: layer for layer in eye_layers}
    changes = []

    # There are now exactly 11 x 9 valid hair/mouth pairs. Each retired-mouth
    # character gets the one pair missing for its current hair.
    used_pairs = {(r["hair"], r["mouth"]) for r in records
                  if r["mouth"] in mouth_by_name}
    retired = [r for r in records if r["mouth"].startswith("mouth6")]
    assert len(retired) == 10 and len(used_pairs) == 89
    original_mouth_names = [f"mouth{i}" for i in range(1, 11)]
    for record in retired:
        missing = [name for name in mouth_by_name
                   if (record["hair"], name) not in used_pairs]
        assert len(missing) == 1, (record["name"], missing)
        old = {part: record[part] for part in ("hair", "mouth", "eyes")}
        record["mouth"] = missing[0]
        hair_index = next(i for i, layer in enumerate(hair_layers)
                          if layer["name"] == record["hair"])
        mouth_index = original_mouth_names.index(record["mouth"])
        record["eyes"] = eye_layers[(hair_index + mouth_index) % len(eye_layers)]["name"]
        used_pairs.add((record["hair"], record["mouth"]))
        changes.append({"name": record["name"], "reason": "retired mouth6",
                        "before": old,
                        "after": {part: record[part] for part in old}})

    # Give KUKA a clearly different hair, mouth and eyes while keeping all
    # 99 unique pair assignments by exchanging a complete face combination.
    kuka = next(r for r in records if r["name"] == "KUKA")
    partner = next(r for r in records if r["hair"] == "hair1" and r["mouth"] == "mouth2")
    for record, other in ((kuka, partner), (partner, kuka)):
        changes.append({"name": record["name"], "reason": "KUKA redesign",
                        "before": {part: record[part] for part in ("hair", "mouth", "eyes")},
                        "after": {part: other[part] for part in ("hair", "mouth", "eyes")}})
    for part in ("hair", "mouth", "eyes"):
        kuka[part], partner[part] = partner[part], kuka[part]

    rng = random.Random(SEED + 1)
    for record in records:
        colors = record["colors"]
        if record["name"] == "KUKA" or colors["hair"] == colors["cloth"]:
            old = dict(colors)
            if record["name"] == "KUKA":
                colors["hair"] = rgb_hex(rng.choice(palettes["hair"]))
                colors["skin"] = rgb_hex(rng.choice(palettes["skin"]))
            choices = [color for color in palettes["cloth"]
                       if rgb_hex(color) not in
                       {colors["hair"], colors["cloth"], colors["skin"]}]
            colors["cloth"] = rgb_hex(rng.choice(choices))
            changes.append({"name": record["name"], "reason": "color update",
                            "before": old, "after": dict(colors)})
        assert colors["hair"] != colors["cloth"]

    combinations = [(r["hair"], r["mouth"], r["eyes"]) for r in records]
    assert len(set((hair, mouth) for hair, mouth, _ in combinations)) == COUNT
    for pos, first in enumerate(combinations):
        for second in combinations[pos + 1:]:
            assert sum(a != b for a, b in zip(first, second)) >= 2

    OUTPUT.mkdir(exist_ok=True)
    image_hashes = set()
    for number, record in enumerate(records, 1):
        name = record["name"]
        colors = {part: tuple(bytes.fromhex(record["colors"][part][1:]))
                  for part in ("hair", "cloth", "skin")}
        sprite = render_avatar(
            psd, base_skin, eye_by_name[record["eyes"]],
            mouth_by_name[record["mouth"]], hair_by_name[record["hair"]],
            base_cloth, colors,
        )
        file_name = name + ".png"
        sprite.save(OUTPUT / file_name)
        digest = hashlib.sha256(sprite.tobytes()).hexdigest()
        if digest in image_hashes:
            raise ValueError("Duplicate rendered image: " + name)
        image_hashes.add(digest)
        assert record["id"] == number and record["file"] == file_name
        record["sha256"] = digest
    manifest = {
        "source": str(SOURCE), "source_sha256": psd["sha256"],
        "seed": SEED, "count": len(records),
        "palette_sizes": {part: len(options) for part, options in palettes.items()},
        "changes": changes,
        "characters": records,
    }
    (ROOT / "characters.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    font_path = SOURCE.parent / "yodaka.ttf"
    create_sheet(records, font_path)
    create_gallery(records)
    print("Generated", len(records), "unique 16x16 sprites")
    print("Part usage:", {
        part: dict(Counter(record[part] for record in records))
        for part in ("hair", "mouth", "eyes")
    })
    print("Preview:", ROOT / "contact-sheet.png")


if __name__ == "__main__":
    main()
