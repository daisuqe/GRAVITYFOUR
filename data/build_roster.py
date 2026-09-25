"""Assign stable opponent personalities and export a file-friendly browser roster."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest_path = root / 'characters.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
characters = manifest['characters']
assert len(characters) == 99
assert all(c['mouth'] != 'mouth8' for c in characters if c['hair'].endswith('w'))
order = sorted(characters, key=lambda c: hashlib.sha256(c['name'].encode()).digest())
for index, character in enumerate(order):
    level = min(5, index // 20 + 1)
    tier = 'beginner' if level <= 2 else 'regular' if level <= 4 else 'champion'
    seed = hashlib.sha256(('GRAVITYFOUR:' + character['name']).encode()).digest()
    varied = lambda offset, low, high: low + seed[offset] % (high - low + 1)
    strength_ranges = [(18, 32), (33, 47), (48, 63), (64, 79), (80, 95)]
    mistake_ranges = [(58, 73), (42, 58), (33, 47), (25, 38), (12, 23)]
    strength = varied(0, *strength_ranges[level - 1])
    depth = 1 if level <= 2 else 2 if level <= 4 else 3
    mistake = varied(1, *mistake_ranges[level - 1])
    character['profile'] = {
        'rank': tier, 'level': level, 'strength': strength, 'depth': depth,
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
    profile = character['profile']
    clamp = lambda value: max(0, min(100, round(value)))
    profile['friendliness'] = clamp(30 + profile['defense'] * .35 + profile['consistency'] * .15 - profile['attack'] * .2 + varied(12, -20, 20))
    profile['taunt'] = clamp(18 + profile['attack'] * .4 + profile['trick'] * .25 - profile['friendliness'] * .25 + varied(13, -18, 18))
    profile['expressiveness'] = clamp(20 + profile['talkativeness'] * .55 + varied(14, -15, 25))
    profile['quirk'] = varied(15, 0, 100)
    profile['personality'] = ('teasing' if profile['taunt'] >= 67 else
                              'friendly' if profile['friendliness'] >= 65 else
                              'thoughtful' if profile['depth'] == 3 and profile['consistency'] >= 65 else
                              'eccentric' if profile['quirk'] >= 72 else
                              'reserved' if profile['talkativeness'] <= 8 else 'competitive')
    profile['voice'] = ('quirky' if profile['quirk'] >= 84 else
                        'polite' if profile['friendliness'] >= 65 and seed[16] % 2 == 0 else
                        'casual' if profile['taunt'] >= 60 else 'plain')
    profile['gender'] = ('male' if character['hair'].endswith('m') else
                         'female' if character['hair'].endswith('w') else 'unspecified')
    character.pop('faceFile', None)
    character['winFile'] = 'win.png'
    character['loseFile'] = 'lose.png'
    for key in ('scanFile', 'winScanFile', 'loseScanFile'):
        character.pop(key, None)
for character in characters:
    character['profile']['tearful'] = False
for character in sorted(characters, key=lambda c: (-c['profile']['expressiveness'], c['name']))[:20]:
    character['profile']['tearful'] = True

manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
roster = [{'id': c['id'], 'name': c['name'], 'file': c['file'], 'hair': c['hair'],
           'eyes': c['eyes'], 'mouth': c['mouth'], 'winFile': c['winFile'],
           'loseFile': c['loseFile'], 'profile': c['profile'],
           **{key: c[key] for key in ('normalMask', 'winMask', 'loseMask') if key in c}}
          for c in characters]
(root.parent / 'characters.js').write_text('window.GravityFourRoster = ' + json.dumps(roster, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('Profiles:', {tier: sum(c['profile']['rank'] == tier for c in characters) for tier in ('beginner', 'regular', 'champion')})
