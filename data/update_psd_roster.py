"""Map an updated portrait PSD onto the existing 99 character identities."""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "GRAVITYFOUR-characters"))
from psd_reader import groups, load_psd  # noqa: E402

psd = load_psd(ROOT / "human01.psd")
parts = groups(psd)
hair_names = [layer["name"] for layer in parts["hair"]]
eye_names = [layer["name"] for layer in parts["eyes"]]
assert len(hair_names) == 15 and len(eye_names) == 18
hair_by_number = {int(re.fullmatch(r"hair(\d+)[mw]?", name).group(1)): name
                  for name in hair_names}
assert len(hair_by_number) == 15

path = ROOT / "characters.json"
manifest = json.loads(path.read_text(encoding="utf-8"))
characters = manifest["characters"]
assert len(characters) == 99
for character in characters:
    number = int(re.fullmatch(r"hair(\d+)[mw]?", character["hair"]).group(1))
    character["hair"] = hair_by_number[number]

ordered = sorted(characters, key=lambda c: hashlib.sha256(c["name"].encode()).digest())
chosen = set()
for hair in hair_names[11:]:
    selection = []
    mouths = set()
    for character in ordered:
        if character["name"] in chosen or character["mouth"] in mouths:
            continue
        selection.append(character)
        mouths.add(character["mouth"])
        if len(selection) == 6:
            break
    assert len(selection) == 6
    for character in selection:
        character["hair"] = hair
        chosen.add(character["name"])

for eye_offset, eye in enumerate(eye_names[15:]):
    for character in ordered[eye_offset * 8:(eye_offset + 1) * 8]:
        character["eyes"] = eye

for character in characters:
    if character["hair"].endswith("w") and character["mouth"] == "mouth8":
        character["mouth"] = "mouth9"

manifest["source_sha256"] = psd["sha256"]
path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Updated 99 characters for", len(hair_names), "hair and", len(eye_names), "eye parts")
