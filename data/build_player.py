"""Generate selectable player portrait layers and palette metadata."""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
sys.path.insert(0, str(ROOT / "GRAVITYFOUR-characters"))
sys.dont_write_bytecode = True
from psd_reader import groups, load_psd, palette  # noqa: E402
from build_faces import alpha_mask, tint_layer  # noqa: E402


def main():
    psd = load_psd(ROOT / "human01.psd")
    if (psd["width"], psd["height"]) != (16, 16):
        raise ValueError("Expected a 16 x 16 portrait source")
    layers = {part["name"]: part for part in psd["layers"] if part["group_type"] == 0}
    grouped = groups(psd)
    options = {
        "hair": [layer["name"] for layer in grouped["hair"]],
        "eyes": [layer["name"] for layer in grouped["eyes"]],
        "mouth": [layer["name"] for layer in grouped["mouth"]
                  if layer["name"].startswith("mouth") and layer["name"][5:].isdigit()],
    }
    palettes = {part: ["#" + bytes(color).hex().upper()
                       for color in palette(psd, part + " color")]
                for part in ("skin", "hair", "cloth")}
    defaults = {"hair": "hair6w", "eyes": "eye15", "mouth": "mouth1",
                "skinColor": palettes["skin"][1], "hairColor": "#000000",
                "clothColor": palettes["cloth"][5]}
    output = PROJECT / "characters" / "player-parts"
    output.mkdir(parents=True, exist_ok=True)
    files = {"eyes": {}, "mouth": {}}

    def save(image, filename):
        image.save(output / filename)
        return "characters/player-parts/" + filename

    for part in ("eyes", "mouth"):
        for name in options[part]:
            files[part][name] = save(tint_layer(psd, layers[name]), name + ".png")
    expressions = {"win": "characters/win.png", "lose": "characters/lose.png"}
    tear_file = "characters/tear.png"
    Image.alpha_composite(Image.new("RGBA", (16, 16)), tint_layer(psd, layers["win"])).save(PROJECT / expressions["win"])
    Image.alpha_composite(Image.new("RGBA", (16, 16)), tint_layer(psd, layers["lose"], hide_tear=True)).save(PROJECT / expressions["lose"])
    tear_image = Image.new("RGBA", (16, 16))
    tear_image.putpixel((11, 8), (134, 237, 255, 255))
    tear_image.save(PROJECT / tear_file)
    empty = Image.new("RGBA", (16, 16))
    layer_masks = {
        "skin": alpha_mask(tint_layer(psd, layers["skin"]), empty),
        "cloth": alpha_mask(tint_layer(psd, layers["cloth"]), empty),
        "hair": {name: alpha_mask(tint_layer(psd, layers[name]), empty)
                 for name in options["hair"]},
    }
    masks = {}
    for hair in options["hair"]:
        body = Image.new("RGBA", (16, 16))
        for name in ("skin", hair, "cloth"):
            body.alpha_composite(tint_layer(psd, layers[name]))
        normal_masks = {}
        for mouth in options["mouth"]:
            normal = Image.new("RGBA", (16, 16))
            for name in options["eyes"]:
                normal.alpha_composite(tint_layer(psd, layers[name]))
            normal.alpha_composite(tint_layer(psd, layers[mouth]))
            normal_masks[mouth] = alpha_mask(body, normal)
        masks[hair] = {
            "normal": normal_masks,
            "win": alpha_mask(body, tint_layer(psd, layers["win"])),
            "lose": alpha_mask(body, tint_layer(psd, layers["lose"])),
        }
    player = {"defaults": defaults, "options": options, "palettes": palettes,
              "layerMasks": layer_masks, "files": files,
              "expressions": expressions, "tearFile": tear_file, "masks": masks}
    (PROJECT / "player.js").write_text(
        "window.GravityFourPlayer = "
        + json.dumps(player, ensure_ascii=False, separators=(",", ":"))
        + ";\n", encoding="utf-8")
    print("Generated selectable player parts and expressions")


if __name__ == "__main__":
    main()
