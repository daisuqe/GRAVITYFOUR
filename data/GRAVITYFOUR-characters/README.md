# GRAVITYFOUR — 99 characters

- `characters/`: 99 transparent 16 × 16 PNG sprites, named with pronounceable four-letter names.
- `contact-sheet.png`: all 99 sprites on one sheet.
- `gallery.html`: enlarged visual index. Hover over a face for its layer choices and colors.
- `characters.json`: name, selected PSD layers, palette colors, and image digest for each character.
- `characters-v1.json`: original assignments, retained so the revised set can be regenerated.
- `generate.py` and `psd_reader.py`: reproducible generator. Run `python generate.py <path-to-human01.psd>`.

The source is `GRAVITYFOUR/data/human01.psd`. The retired `mouth6` layer is excluded, leaving 11 hair, 9 mouth, and 15 eye choices. Eye color variants count as different eye choices. Every pair among the 99 characters differs in at least two of those three layer choices. KUKA's hair, mouth, and eyes were redesigned. Hair and clothing never use the same color. All colors come from their respective `* color` layers.
