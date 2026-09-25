# 四方争覇 / GRAVITY FOUR

Open `../index.html` in a browser. The game uses HTML5 Canvas, CSS, and vanilla JavaScript. No build step or dependencies are required to play.

## Publishing

Publish only these project-root items: `index.html`, `help.html`, `style.css`, `game.js`, `audio.js`, `characters.js`, `player.js`, `daily-cups.js`, `trophy.svg`, `yodaka.woff`, and the complete `characters/` directory. Keep `data/` out of the published output. It holds the editable character manifest and PSD, font source and TTF, generators, tests, previews, source exports, ZIP archives, and handoff notes. `.git` and `.gitattributes` remain at the root for version control and are not game assets.

## Tournaments

Choose a tournament on the title screen. You are one of the entrants and must win every round.

| Tournament | Entrants | Opponents by rank |
| --- | ---: | --- |
| Beginner | 8 | 7 beginner |
| Regular | 16 | 7 beginner, 8 regular |
| Champion | 32 | 7 beginner, 8 regular, 16 champion |

The Champion tournament has 16 strong opponents, half of all entrants. Other matches are simulated from each character's strength rating, with some chance of an upset. A loss ends the run; a draw replays the current match.

The daily cup name comes from one fixed-date observance for each calendar date; February 29 has its own entry. `daily-cups.js` is the published calendar, `data/daily-cups.csv` records the date and observance behind each name, and `data/calendar-source.json` is the nonpublished research source from [Every Day is a Holiday](https://adayisaholiday.com/holidays.json), retrieved 2026-09-23. `python data/build_daily_cups.py` regenerates the calendar after reviewing fixed-date exclusions and overrides. `data/japan-cups.csv` replaces unfamiliar names with themes readily understood in Japan and prioritizes fixed Japanese dates. The interface shows the date and cup name; the source occasion remains in the nonpublished CSV. Japanese holidays were checked against the [Cabinet Office](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html), traditional fixed dates against the [National Astronomical Observatory of Japan](https://eco.mtk.nao.ac.jp/koyomi/wiki/C0E1B6E7.html), and August 15 against the [Ministry of Health, Labour and Welfare](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hokabunya/senbotsusha/seido01/index.html). UN observance dates can be checked against the [United Nations list](https://www.un.org/en/observances/list-days-weeks).

The local calendar date fixes each tournament roster for the day. Each region changes day at its local midnight. Entrant positions, the player seat, and simulated winners are redrawn for each attempt, so later opponents and bracket results can change. The trophy room stores each day's best placement, lifetime best placement, and number of first-place finishes in this browser's localStorage. A first-place count increases for every completed championship run, including repeats on the same date. The HISTORY page lists local dates, cups, each tournament's best rank, and a daily score. For a tournament with n round wins, its daily best earns 2^n - 1 points; the total score sums those daily best scores across all dates.

All 99 characters have individual profiles in `data/characters.json`. The browser loads the generated `../characters.js`; run `python data/build_roster.py` from the project root after editing the manifest to refresh the browser roster. Profiles include strength, search depth, mistake rate, attack, defense, trick, edge exploration, use of opposing stones as support, unusual moves, center preference, consistency, talkativeness, friendliness, taunting, expressiveness, quirks, personality type, and voice style. The opening greeting is always spoken; later lines follow talkativeness, personality, the score, immediate threats, and the way a match ends.

After editing `data/human01.psd`, run `python data/update_psd_roster.py`, `python data/build_player.py`, `python data/build_faces.py`, and `python data/build_roster.py` in that order. The PSD currently supplies 15 hair styles and 18 eye styles. Hair names ending in `m` or `w` mark male or female styles and guide character voices. The face builder writes one faceless body PNG per character. Normal expressions combine shared eye and mouth PNGs at display time. It shares one `characters/win.png` and one `characters/lose.png` across the roster. A separate one-pixel `characters/tear.png` layer is shown for 20 characters. The game layers each expression above the hair; bright/dark scanlines are drawn into a Canvas whenever a portrait or expression appears, using silhouette masks in `characters.js`. The builder also refreshes `data/GRAVITYFOUR-characters/gallery.html` with all three expressions. Run `python data/test_faces.py` to check the split assets. Run `python data/build_player.py` after PSD edits to refresh the shared eye and mouth PNGs in `characters/player-parts/`, the shared expressions, and the published `player.js` selection, body masks, and silhouette. The browser colors skin, hair, and clothing from those masks at display time. The current player uses skin color 2, black hair6, clothing color 6, eye15, and mouth1. The character editor uses shared face parts and runtime palette colors, saves the selection in browser localStorage, and keeps the portrait layered for win and lose expressions. Random Match picks a fresh opponent without changing tournament records.

## Rules

- The board has 9 × 9 intersections. The opening move has 32 choices along the perimeter.
- All four walls act as floors with gravity. A move is legal when a continuous line of stones connects its intersection to any board edge along a row or column. Either color can provide support.
- Three separate runs of exactly four stones, or one run of five stones, wins. Runs may intersect.
- On desktop, click an open intersection. On touch devices, tap an intersection, then press **PLACE**.

## Pixel font

`data/yodaka.ttf` and the published `yodaka.woff` contain uppercase, lowercase, numerals, symbols, and kanji extracted from `data/yodaka-source.png` (including the lower-left symbol grid), plus interface punctuation including full-width parentheses. The title characters 方争覇 retain their 16 × 16 pixel glyphs; 四 now uses the supplied source glyph. Katakana is extracted directly from the right-hand grid of `data/yodaka-source.png`; dialogue punctuation is drawn on the same pixel grid. The game loads the WOFF file.

## Checks

Run `node data/test_editor.mjs` and `python data/test_player.py` for the editor, random match, selectable layers, and win/lose faces. Run `node data/test.mjs` to verify the roster, fixed daily cup calendar, deterministic opponents, saved records, rules, desktop play, touch confirmation, and COM responses.
