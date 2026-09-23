# GRAVITYFOUR character data handoff

## Objective

Place the revised 99 character sprites and manifest in
`E:\User\Daisuke\Unity\GRAVITYFOUR\data`.

## Ready-to-copy output

- Source folder: `E:\User\Daisuke\Unity\FUDE\GRAVITYFOUR-characters`
- ZIP: `E:\User\Daisuke\Unity\FUDE\GRAVITYFOUR-99-faces-v2.zip`
- PSD source: `E:\User\Daisuke\Unity\GRAVITYFOUR\data\human01.psd`
- PSD SHA-256: `7719c46d359d4e6867a4c25eb9d10fc37c9f3eb9257d9141cc7c74d20a48c4aa`

Copy `characters/` (99 PNG files) and `characters.json` into the target `data/` folder. The other files are optional supporting material: `contact-sheet.png`, `gallery.html`, `generate.py`, `psd_reader.py`, `characters-v1.json`, and `README.md`. Do not overwrite existing project files without inspecting them first.

## Changes made

- Rebuilt KUKA with hair1, mouth2, eye2 and new palette colors. KUKA and VONA exchanged complete face combinations to preserve uniqueness.
- Rebuilt all 10 characters that used the retired mouth6 layer: SAVI, BUBI, PESI, DEPI, TAZA, TIHI, DERI, NUFU, KOFE, and VEBA.
- Changed clothing colors for ROLA and DOSI because each matched its hair color.
- Kept all 99 four-letter names. Color and part changes are logged in `characters.json` under `changes`.

## Verified

- 99 manifest records, 99 PNG files, 99 PNG files in the ZIP.
- 99 distinct hair/mouth combinations. Every pair of characters differs in at least two of hair, mouth, and eyes.
- No character uses mouth6. No character has identical hair and clothing colors.
- The contact sheet was visually checked.

## Access issue

The task that produced these files was launched with `FUDE` as its writable workspace. After `GRAVITYFOUR` was added to the FUDE project, a direct copy to `E:\User\Daisuke\Unity\GRAVITYFOUR\data\characters.json` still returned `Access to the path ... is denied`. The file was **not** placed in the target. Use a new task started from the GRAVITYFOUR project with Local selected, then copy the ready-to-copy output into its `data` folder.
