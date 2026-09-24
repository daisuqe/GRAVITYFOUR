"""Rebuild faceless bodies and interchangeable expressions from human01.psd."""

import hashlib
import html
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
sys.path.insert(0, str(ROOT / "GRAVITYFOUR-characters"))
from psd_reader import load_psd, rgba_pixels  # noqa: E402

TEAR_RGB = (134, 237, 255)


def tint_layer(psd, layer, color=None, hide_tear=False):
    pixels = bytearray(rgba_pixels(psd, layer))
    for offset in range(0, len(pixels), 4):
        if not pixels[offset + 3]:
            continue
        if hide_tear and tuple(pixels[offset:offset + 3]) == TEAR_RGB:
            pixels[offset + 3] = 0
        elif color is not None:
            pixels[offset:offset + 3] = color
    return Image.frombytes("RGBA", (psd["width"], psd["height"]), bytes(pixels))


def render(psd, record, layers, expression):
    colors = {part: bytes.fromhex(record["colors"][part][1:])
              for part in ("skin", "hair", "cloth")}
    face = Image.new("RGBA", (psd["width"], psd["height"]))
    if expression == "base":
        face.alpha_composite(tint_layer(psd, layers["skin"], colors["skin"]))
        face.alpha_composite(tint_layer(psd, layers[record["hair"]], colors["hair"]))
        face.alpha_composite(tint_layer(psd, layers["cloth"], colors["cloth"]))
    elif expression == "normal":
        face.alpha_composite(tint_layer(psd, layers[record["eyes"]]))
        face.alpha_composite(tint_layer(psd, layers[record["mouth"]]))
    else:
        face.alpha_composite(tint_layer(
            psd, layers[expression], hide_tear=expression == "lose"
            and not record["profile"]["tearful"]
        ))
    return face


def alpha_mask(body, expression):
    """Store only silhouette bits; scanline colors are made in the browser."""
    combined = Image.alpha_composite(body, expression)
    bits = []
    for start in range(0, 16 * 16, 8):
        value = 0
        for offset in range(8):
            index = start + offset
            if combined.getpixel((index % 16, index // 16))[3]:
                value |= 1 << (7 - offset)
        bits.append(value)
    return bytes(bits).hex()


def write_gallery(records):
    cards = []
    for record in records:
        portraits = []
        for label, file_key in (("NORMAL", None), ("WIN", "winFile"),
                                ("LOSE", "loseFile")):
            tear = ('<img src="../../characters/tear.png" alt="">'
                    if label == "LOSE" and record["profile"]["tearful"] else '')
            overlay = (f'<img src="../../characters/player-parts/{record["eyes"]}.png" alt="">'
                       f'<img src="../../characters/player-parts/{record["mouth"]}.png" alt="">'
                       if label == "NORMAL" else
                       f'<img src="../../characters/{record[file_key]}" alt="">')
            portraits.append(
                '<div class="state"><div class="portrait">'
                f'<img src="../../characters/{record["file"]}" alt="">'
                + overlay + tear +
                f'</div><span>{label}</span></div>'
            )
        cards.append(f'<article><h2>{html.escape(record["name"])}</h2>'
                     + '<div class="states">' + ''.join(portraits) + '</div></article>')
    page = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>CHARACTER EXPRESSIONS</title><style>'
            '@font-face{font-family:yodaka;src:url("../../yodaka.woff")}'
            '*{box-sizing:border-box}body{margin:0;padding:20px;background:#050a0b;color:#d5ffea;font-family:yodaka,monospace}'
            'h1{text-align:center;font-size:32px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}'
            'article{padding:12px;border:1px solid #287653;background:#0b1c16}h2{margin:0 0 10px;font-size:21px}'
            '.states{display:flex;justify-content:space-between;gap:8px}.state{text-align:center;font-size:12px}'
            '.portrait{position:relative;width:72px;height:72px;margin-bottom:5px}.portrait img{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}'
            '</style></head><body><h1>CHARACTER EXPRESSIONS</h1><main>'
            + ''.join(cards) + '</main></body></html>')
    (ROOT / "GRAVITYFOUR-characters" / "gallery.html").write_text(page,
                                                                  encoding="utf-8")


def main():
    psd = load_psd(ROOT / "human01.psd")
    if (psd["width"], psd["height"]) != (16, 16):
        raise ValueError("Expected a 16 x 16 portrait source")
    manifest_path = ROOT / "characters.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    records = manifest["characters"]
    if len(records) != 99 or sum(c["profile"]["tearful"] for c in records) != 20:
        raise ValueError("Expected 99 characters and exactly 20 tearful characters")
    psd_layers = {layer["name"]: layer for layer in psd["layers"]
                  if layer["group_type"] == 0}
    for name in ("skin", "cloth", "win", "lose"):
        if name not in psd_layers:
            raise ValueError("Missing PSD layer: " + name)
    variants = (("base", "file", "sha256"),
                ("normal", None, "faceSha256"),
                ("win", "winFile", "winSha256"),
                ("lose", "loseFile", "loseSha256"))
    output = PROJECT / "characters"
    output.mkdir(exist_ok=True)
    shared = {
        "win.png": Image.alpha_composite(Image.new("RGBA", (16, 16)), tint_layer(psd, psd_layers["win"])),
        "lose.png": Image.alpha_composite(Image.new("RGBA", (16, 16)), tint_layer(psd, psd_layers["lose"], hide_tear=True)),
        "tear.png": Image.new("RGBA", (16, 16)),
    }
    shared["tear.png"].putpixel((11, 8), (*TEAR_RGB, 255))
    for filename, face in shared.items():
        face.save(output / filename)
    for record in records:
        record.pop("faceFile", None)
        record["winFile"] = "win.png"
        record["loseFile"] = "lose.png"
        body = None
        for expression, file_key, hash_key in variants:
            filename = record[file_key] if file_key else None
            face = (shared[filename] if expression in ("win", "lose") else
                    render(psd, record, psd_layers, expression))
            if expression == "base":
                face.save(output / filename)
            record[hash_key] = hashlib.sha256(face.tobytes()).hexdigest()
            if expression == "base":
                body = face
            else:
                mask_face = Image.alpha_composite(face, shared["tear.png"]) if (
                    expression == "lose" and record["profile"]["tearful"]) else face
                record[expression + "Mask"] = alpha_mask(body, mask_face)
        for key in ("scanFile", "winScanFile", "loseScanFile"):
            record.pop(key, None)
    manifest["source_sha256"] = psd["sha256"]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    roster = [{key: record[key] for key in
               ("id", "name", "file", "eyes", "mouth", "winFile", "loseFile", "profile",
                "normalMask", "winMask", "loseMask")}
              for record in records]
    (PROJECT / "characters.js").write_text(
        'window.GravityFourRoster = ' + json.dumps(roster, ensure_ascii=False,
                                                 separators=(',', ':')) + ';\n',
        encoding="utf-8")
    write_gallery(records)
    print(f"Generated {len(records)} bodies; normal faces use shared eyes/mouth parts; "
          f"{sum(c['profile']['tearful'] for c in records)} have tears")


if __name__ == "__main__":
    main()
