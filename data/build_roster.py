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
    character.pop('faceFile', None)
    character['winFile'] = 'win.png'
    character['loseFile'] = 'lose.png'
    for key in ('scanFile', 'winScanFile', 'loseScanFile'):
        character.pop(key, None)
for character in characters:
    character['profile']['tearful'] = False
for character in sorted(characters, key=lambda c: (-c['profile']['expressiveness'], c['name']))[:20]:
    character['profile']['tearful'] = True

# Ease the strongest 60 opponents while preserving the weaker 39 profiles.
for character in sorted(characters, key=lambda c: (-c['profile']['strength'], c['name']))[:60]:
    character['profile']['mistake'] = min(100, character['profile']['mistake'] + 14)

# Keep the two entry-level tiers more forgiving without changing champions.
for character in characters:
    profile = character['profile']
    if profile['rank'] == 'beginner':
        profile['mistake'] = min(100, profile['mistake'] + 20)
    elif profile['rank'] == 'regular':
        profile['mistake'] = min(100, profile['mistake'] + 18)

manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
roster = [{'id': c['id'], 'name': c['name'], 'file': c['file'], 'hair': c['hair'],
           'eyes': c['eyes'], 'mouth': c['mouth'], 'winFile': c['winFile'],
           'loseFile': c['loseFile'], 'profile': c['profile'],
           **{key: c[key] for key in ('normalMask', 'winMask', 'loseMask') if key in c}}
          for c in characters]
(root.parent / 'characters.js').write_text('window.GravityFourRoster = ' + json.dumps(roster, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print('Profiles:', {tier: sum(c['profile']['rank'] == tier for c in characters) for tier in ('beginner', 'regular', 'champion')})
