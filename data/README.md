# 四方争覇 / GRAVITY FOUR

Open `../index.html` in a browser. The game uses HTML5 Canvas, CSS, and vanilla JavaScript. No build step or dependencies are required to play.

## Publishing

Publish only these project-root items: `index.html`, `help.html`, `style.css`, `game.js`, `characters.js`, `yodaka.woff`, and the complete `characters/` directory. Keep `data/` out of the published output. It holds the editable character manifest and PSD, font source and TTF, generators, tests, previews, source exports, ZIP archives, and handoff notes. `.git` and `.gitattributes` remain at the root for version control and are not game assets.

## Tournaments

Choose a tournament on the title screen. You are one of the entrants and must win every round.

| Tournament | Entrants | Opponents by rank |
| --- | ---: | --- |
| Beginner | 8 | 7 beginner |
| Regular | 16 | 7 beginner, 8 regular |
| Champion | 32 | 7 beginner, 8 regular, 16 champion |

The Champion tournament has 16 strong opponents, half of all entrants. Other matches are simulated from each character's strength rating, with some chance of an upset. A loss ends the run; a draw replays the current match.

All 99 characters have individual profiles in `data/characters.json`. The browser loads the generated `../characters.js`; run `python data/build_roster.py` from the project root after editing the manifest to refresh the browser roster. Profiles include strength, search depth, mistake rate, attack, defense, trick, edge exploration, use of opposing stones as support, unusual moves, center preference, consistency, and talkativeness.

## Rules

- The board has 10 × 10 intersections. The opening move has 36 choices along the perimeter.
- A move is legal when a continuous line of stones connects its intersection to any of the four board edges. Either color can provide support.
- Three separate runs of exactly four stones, or one run of five stones, wins. Runs may intersect.
- On desktop, click an open intersection. On touch devices, tap an intersection, then press **PLACE**.

## Pixel font

`data/yodaka.ttf` and the published `yodaka.woff` contain the uppercase, lowercase, and numeric glyphs extracted from `data/yodaka-source.png`, plus the punctuation needed by the interface. They also include 16 × 16 pixel glyphs for the four title characters, 四方争覇. The game loads the WOFF file.

## Checks

Run `node data/test.mjs` to verify the roster, tournament composition, rules, desktop play, touch confirmation, and COM responses.
