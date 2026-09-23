"""Assign stable opponent personalities and export a file-friendly browser roster."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest_path = root / 'characters.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
characters = manifest['characters']
assert len(characters) == 99
order = sorted(characters, key=lambda c: hashlib.sha256(c['name'].encode()).digest())
for index, character in enumerate(order):
    tier = ('beginner', 'regular', 'champion')[index // 33]
    seed = hashlib.sha256(('GRAVITYFOUR:' + character['name']).encode()).digest()
    varied = lambda offset, low, high: low + seed[offset] % (high - low + 1)
    if tier == 'beginner':
        strength = varied(0, 20, 42)
        depth = 1
        mistake = varied(1, 19, 39)
    elif tier == 'regular':
        strength = varied(0, 43, 68)
        depth = 2
        mistake = varied(1, 7, 18)
    else:
        strength = varied(0, 69, 95)
        depth = 3
        mistake = varied(1, 0, 6)
    character['profile'] = {
        'rank': tier, 'strength': strength, 'depth': depth,
        'mistake': mistake,
        'attack': varied(2, 20, 100),
        'defense': varied(3, 20, 100),
        'trick': varied(4, 15, 100),
        'edgeExplore': varied(5, 0, 100),
        'ride': varied(6, 0, 100),
        'unusual': varied(7, 0, 100),
        'center': varied(8, 0, 100),
        'consistency': varied(9, 35, 100),
        'talkativeness': varied(11, 0, 8) if seed[10] % 5 == 0 else varied(11, 25, 75),
    }
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
roster = [{'id': c['id'], 'name': c['name'], 'file': c['file'], 'profile': c['profile']} for c in characters]
(root.parent / 'characters.js').write_text('window.GravityFourRoster = ' + json.dumps(roster, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('Profiles:', {tier: sum(c['profile']['rank'] == tier for c in characters) for tier in ('beginner', 'regular', 'champion')})
