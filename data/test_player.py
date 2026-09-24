"""Check that player color layers are generated from masks at runtime."""

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
script = (ROOT / "player.js").read_text(encoding="utf-8")
assert script.startswith("window.GravityFourPlayer = ")
player = json.loads(script[len("window.GravityFourPlayer = "):].rstrip(";\n"))
assert player["defaults"] == {
    "hair": "hair6", "eyes": "eye15", "mouth": "mouth1",
    "skinColor": "#FFB985", "hairColor": "#000000", "clothColor": "#009B0C",
}
assert len(player["options"]["hair"]) == 11
assert len(player["options"]["eyes"]) == 15
assert len(player["options"]["mouth"]) == 9
assert [len(player["palettes"][key]) for key in ("skin", "hair", "cloth")] == [4, 13, 16]
for mask in (player["layerMasks"]["skin"], player["layerMasks"]["cloth"],
             *player["layerMasks"]["hair"].values()):
    assert re.fullmatch(r"[0-9a-f]{64}", mask)
assert "parts" not in player
files = {Path(path).name for values in player["files"].values() for path in values.values()}
assert len(files) == 24
part_dir = ROOT / "characters" / "player-parts"
assert {path.name for path in part_dir.glob("*.png")} == files
for name in files:
    with Image.open(part_dir / name) as image:
        assert image.size == (16, 16) and image.mode == "RGBA"
for path in (*player["expressions"].values(), player["tearFile"]):
    assert (ROOT / path).exists()
page = (ROOT / "index.html").read_text(encoding="utf-8")
for prefix in ("player", "editor", "victory-player"):
    for part in ("skin", "hair", "cloth"):
        assert f'<canvas class="portrait-layer" id="{prefix}-{part}"' in page
    for part in ("eyes", "mouth"):
        assert f'id="{prefix}-{part}"' in page
assert page.count('id="player-tear"') == 1
print("Player color masks, 24 shared expression parts, and portrait layers passed")
