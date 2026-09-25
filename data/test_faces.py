"""Verify PSD expression layers and generated portrait variants."""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "GRAVITYFOUR-characters"))
from psd_reader import load_psd, rgba_pixels  # noqa: E402

psd = load_psd(ROOT / "human01.psd")
layers = {layer["name"]: layer for layer in psd["layers"] if layer["group_type"] == 0}
records = json.loads((ROOT / "characters.json").read_text(encoding="utf-8"))["characters"]
assert len(records) == 99
assert len({record["hair"] for record in records}) == 15
assert len({record["eyes"] for record in records}) == 18
assert all(record["profile"]["gender"] == (
    "male" if record["hair"].endswith("m") else
    "female" if record["hair"].endswith("w") else "unspecified"
) for record in records)
assert all(record["mouth"] != "mouth8" for record in records if record["hair"].endswith("w"))
assert sum(record["profile"]["tearful"] for record in records) == 20
assert {record["winFile"] for record in records} == {"win.png"}
assert {record["loseFile"] for record in records} == {"lose.png"}
assert not list((ROOT.parent / "characters").glob("*-win.png"))
assert not list((ROOT.parent / "characters").glob("*-lose.png"))
assert not list((ROOT.parent / "characters").glob("*-face.png"))
tear = (134, 237, 255, 255)
tear_image = Image.open(ROOT.parent / "characters" / "tear.png").convert("RGBA")
assert tear_image.getpixel((11, 8)) == tear
assert sum(pixel[3] > 0 for pixel in tear_image.getdata()) == 1
eye_over_hair = 0

for record in records:
    images = {key: Image.open(ROOT.parent / "characters" / record[key]).convert("RGBA")
              for key in ("file", "winFile", "loseFile")}
    normal = Image.new("RGBA", (16, 16))
    for part in ("eyes", "mouth"):
        normal.alpha_composite(Image.open(ROOT.parent / "characters" / "player-parts" /
                                          f"{record[part]}.png").convert("RGBA"))
    images["normal"] = normal
    assert all(image.size == (16, 16) for image in images.values())
    assert images["normal"].tobytes() != images["winFile"].tobytes()
    assert images["normal"].tobytes() != images["loseFile"].tobytes()
    assert all(images[key].getpixel((0, 0))[3] == 0
               for key in ("normal", "winFile", "loseFile"))
    assert images["loseFile"].getpixel((11, 8))[3] == 0
    for expression_key, mask_key in (("normal", "normalMask"),
                                     ("winFile", "winMask"),
                                     ("loseFile", "loseMask")):
        mask = bytes.fromhex(record[mask_key])
        assert len(mask) == 32
        expression = images[expression_key]
        if expression_key == "loseFile" and record["profile"]["tearful"]:
            expression = Image.alpha_composite(expression, tear_image)
        combined = Image.alpha_composite(images["file"], expression)
        for index in range(256):
            visible = combined.getpixel((index % 16, index // 16))[3] > 0
            assert bool(mask[index // 8] & (128 >> (index % 8))) == visible
        for suffix in ("face-scan", "win-scan", "lose-scan"):
            assert not (ROOT.parent / "characters" / f"{record['name']}-{suffix}.png").exists()

    eyes = rgba_pixels(psd, layers[record["eyes"]])
    hair = rgba_pixels(psd, layers[record["hair"]])
    mouth = rgba_pixels(psd, layers[record["mouth"]])
    for index in range(16 * 9):
        offset = index * 4
        if eyes[offset + 3] and hair[offset + 3] and not mouth[offset + 3]:
            assert images["normal"].getpixel((index % 16, index // 16)) == tuple(eyes[offset:offset + 4])
            eye_over_hair += 1
    for index in range(16 * 16):
        offset = index * 4
        if images["normal"].getpixel((index % 16, index // 16))[3]:
            assert eyes[offset + 3] or mouth[offset + 3]

assert eye_over_hair > 0
print("99 layered portraits and 20 tear assignments passed")
