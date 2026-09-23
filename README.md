# 四方争覇 / GRAVITY FOUR

Open `index.html` in a browser. The game uses HTML5 Canvas, CSS, and vanilla JavaScript. No build step or dependencies are required to play.

On desktop, click an open intersection to place a stone. On touch devices, tap an intersection, then press **PLACE** in the lower right.

## Rules

- The board has 10 × 10 intersections. The opening move has 36 choices along the perimeter.
- A move is legal when a continuous line of stones connects its intersection to any of the four board edges. Either color can provide support.
- Three separate runs of exactly four stones, or one run of five stones, wins. Runs may intersect.

## Opponent profiles

The visible settings are currently removed. The AI still accepts `depth`, `mistake`, and `trick` parameters. Presets remain available for future opponents. For example, from the browser console:

```js
Object.assign(GravityFour.settings, GravityFour.presets.expert)
```

Reload the page to start a new match.

## Pixel font

`yodaka.ttf` and `yodaka.woff` contain the uppercase, lowercase, and numeric glyphs extracted from `kaisyo02-source.png`, plus the punctuation needed by the interface. They also include 16 × 16 pixel glyphs for the four title characters, 四方争覇. The game loads the WOFF file. Run `python build_font.py` with Pillow and fontTools to regenerate both font files.

## Checks

Run `node test.mjs` to verify opening moves, support rules, wins, desktop play, touch confirmation, and COM responses.
