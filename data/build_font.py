"""Convert the supplied 6px-grid lettering sheet into a usable pixel font."""

from pathlib import Path

from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


ROOT = Path(__file__).parent
IMAGE = Image.open(ROOT / "yodaka-source.png").convert("RGB")
INK = (148, 171, 255)
ORIGIN_X, ORIGIN_Y, SOURCE_PIXEL = 42, 258, 6
UNIT = 140


def pixel(x, y):
    return IMAGE.getpixel(
        (ORIGIN_X + SOURCE_PIXEL * x + 3, ORIGIN_Y + SOURCE_PIXEL * y + 3)
    ) == INK


def column_runs(row, start, stop):
    active = [any(pixel(x, y) for y in range(row, row + 5)) for x in range(start, stop)]
    runs = []
    first = None
    for offset, on in enumerate(active + [False]):
        if on and first is None:
            first = start + offset
        elif not on and first is not None:
            runs.append((first, start + offset))
            first = None
    return runs


patterns = {}
for row, letters in zip((0, 6, 12, 18, 24, 30),
                        ("ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY", "Z")):
    runs = column_runs(row, 0, 35)
    assert len(runs) == len(letters), (row, runs)
    for letter, (left, right) in zip(letters, runs):
        patterns[letter] = [
            "".join("#" if pixel(x, y) else "." for x in range(left, right))
            for y in range(row, row + 5)
        ]

for row, letters in zip((0, 6, 12, 18, 24, 30),
                        ("abcde", "fghij", "klmno", "pqrst", "uvwxy", "z")):
    runs = column_runs(row, 35, 65)
    assert len(runs) == len(letters), (row, runs)
    for letter, (left, right) in zip(letters, runs):
        patterns[letter] = [
            "".join("#" if pixel(x, y) else "." for x in range(left, right))
            for y in range(row, row + 5)
        ]

runs = column_runs(36, 0, 65)
assert len(runs) == 10, runs
for digit, (left, right) in zip("0123456789", runs):
    patterns[digit] = [
        "".join("#" if pixel(x, y) else "." for x in range(left, right))
        for y in range(36, 41)
    ]

# Simple punctuation in the same 5-row grid.
patterns.update({
    ".": ["...", "...", "...", "...", ".#."],
    ":": ["...", ".#.", "...", ".#.", "..."],
    "/": ["....#", "...#.", "..#..", ".#...", "#...."],
    "-": [".....", ".....", ".###.", ".....", "....."],
    "!": [".#.", ".#.", ".#.", "...", ".#."],
    "?": [".###.", "#...#", "...#.", ".....", "..#.."],
    "(": ["..#", ".#.", "#..", ".#.", "..#"],
    ")": ["#..", ".#.", "..#", ".#.", "#.."],
})

# Katakana occupy the right-hand 5 x 5 grid on the supplied sheet.
# Rows are 36 source pixels apart; each source pixel is a 6 x 6 square.
kana_rows = (
    "アイウエオ", "カキクケコ", "サシスセソ", "タチツテト", "ナニヌネノ",
    "ハヒフヘホ", "マミムメモ", "ヤ ユ ヨ", "ラリルレロ", "ワヰヱヲン",
    "ァィゥェォ", "ッャュョヮ", "ー    ",
    "ガギグゲゴ", "ザジズゼゾ", "ダヂヅデド", "バビブベボ", "パピプペポ",
)
for row, letters in enumerate(kana_rows):
    for col, char in enumerate(letters):
        if char == " ":
            continue
        pattern = ["".join(
            "#" if IMAGE.getpixel((690 + 36 * col + SOURCE_PIXEL * x + 3,
                                   42 + 36 * row + SOURCE_PIXEL * y + 3)) == INK else "."
            for x in range(5)) for y in range(5)]
        assert any("#" in line for line in pattern), (row, col, char)
        patterns[char] = pattern

# Hiragana use the same 5 x 5 layout, one block (216 source pixels) left of the katakana.
hira_rows = (
    "あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの",
    "はひふへほ", "まみむめも", "や ゆ よ", "らりるれろ", "わゐゑをん",
    "ぁぃぅぇぉ", "っゃゅょゎ", "     ",
    "がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ",
)
for row, letters in enumerate(hira_rows):
    for col, char in enumerate(letters):
        if char == " ":
            continue
        pattern = ["".join(
            "#" if IMAGE.getpixel((474 + 36 * col + SOURCE_PIXEL * x + 3,
                                   42 + 36 * row + SOURCE_PIXEL * y + 3)) == INK else "."
            for x in range(5)) for y in range(5)]
        assert any("#" in line for line in pattern), (row, col, char)
        patterns[char] = pattern

# Punctuation absent from the sheet, drawn on the same five-row pixel grid.
patterns.update({
    "、": ["...", "...", "...", "#..", ".#."],
    "。": ["...", "...", "###", "#.#", "###"],
    "・": ["...", "...", ".#.", "...", "..."],
    "！": [".#.", ".#.", ".#.", "...", ".#."],
    "？": [".###.", "#...#", "...#.", ".....", "..#.."],
    "…": [".....", ".....", ".....", ".....", "#.#.#"],
    "♪": ["..###", "..#.#", "..#.#", ".##.#", "##..."],
    "（": ["...#.", "..#..", ".#...", "..#..", "...#."],
    "）": [".#...", "..#..", "...#.", "..#..", ".#..."],
    "～": [".....", ".....", "#.#.#", ".#.#.", "....."],
    "〜": [".....", ".....", "#.#.#", ".#.#.", "....."],
    "·": [".....", ".....", "..#..", ".....", "....."],
    "—": [".....", ".....", "#####", ".....", "....."],
})

# Left-bottom symbols and numerals are taken from the supplied sheet.
# The two separate ink runs of the double quote form one character.
source_rows = (
    (42, list('!"#$%&\'()=*')),
    (48, list('+-×÷/＼~^|\\@')),
    (54, list('{}[]「」;:<>,') ),
    (60, list('.?・_百千万円')),
    (66, list('一二三四五六七八九十')),
)
for source_row, characters in source_rows:
    runs = column_runs(source_row, 0, 66)
    if source_row == 42:
        runs[1:3] = [(runs[1][0], runs[2][1])]
    assert len(runs) == len(characters), (source_row, runs, characters)
    for character, (left, right) in zip(characters, runs):
        patterns[character] = [
            ''.join('#' if pixel(x, y) else '.' for x in range(left, right))
            for y in range(source_row, source_row + 5)
        ]
patterns['　'] = ['.....'] * 5

# Hand-corrected glyphs (override the sheet / earlier drafts).
patterns["ゼ"] = ["..#.#", ".#...", "#####", ".#..#", ".###."]
patterns["♪"] = ["..##.", "..#.#", "..#.#", "###..", "###.."]
patterns["~"] = patterns["~"][1:] + ["." * len(patterns["~"][0])]  # sit one dot higher than on the sheet
patterns["～"] = patterns["〜"] = list(patterns["~"])

# Hand-drawn additions not on the sheet.
patterns.update({
    "`": ["#.", ".#", "..", "..", ".."],
    "ヴ": [".#.#.", "###.#", "#.#..", "..#..", ".#..."],
    "ヵ": [".....", "..#..", ".####", "..#.#", "..#.#"],
    "ヶ": [".....", ".#...", ".####", ".#.#.", "...#."],
    "ヽ": [".....", ".#...", "..#..", "...#.", "...#."],
    "ヾ": ["..#.#", "#.#.#", ".#...", "..#..", "..#.."],
    "ゔ": ["##.#.", "....#", "###..", "...#.", "###.."],
    "ゝ": [".....", "#....", ".#...", "..#..", ".#..."],
    "ゞ": ["..#.#", "#.#.#", ".#...", "..#..", ".#..."],
    "゛": ["..#..", "#..#.", ".#...", ".....", "....."],
    "゜": ["###..", "#.#..", "###..", ".....", "....."],
})

# Symbols drawn on a 5 x 5 grid.
patterns.update({
    "→": ["..#..", "...#.", "#####", "...#.", "..#.."],
    "←": ["..#..", ".#...", "#####", ".#...", "..#.."],
    "↑": ["..#..", ".###.", "#.#.#", "..#..", "..#.."],
    "↓": ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
    "×": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "＋": ["..#..", "..#..", "#####", "..#..", "..#.."],
    "－": [".....", ".....", "#####", ".....", "....."],
    "÷": ["..#..", ".....", "#####", ".....", "..#.."],
    "♠": ["..#..", ".###.", "#####", "..#..", ".###."],
    "☘": [".###.", "#####", "#####", "..#..", ".###."],
    "♦": ["..#..", ".###.", "#####", ".###.", "..#.."],
    "❤": [".#.#.", "#####", "#####", ".###.", "..#.."],
    "★": ["..#..", "#####", ".###.", ".#.#.", "#...#"],
    "〇": [".###.", "#...#", "#...#", "#...#", ".###."],
    "□": ["#####", "#...#", "#...#", "#...#", "#####"],
    "△": ["..#..", ".#.#.", ".#.#.", "#...#", "#####"],
    "●": [".###.", "#####", "#####", "#####", ".###."],
    "■": ["#####", "#####", "#####", "#####", "#####"],
    "▲": [".....", "..#..", ".###.", "#####", "....."],
    "▼": [".....", "#####", ".###.", "..#..", "....."],
    "▶": [".#...", ".##..", ".###.", ".##..", ".#..."],
    "◀": ["...#.", "..##.", ".###.", "..##.", "...#."],
    "▽": ["#####", "#...#", ".#.#.", ".#.#.", "..#.."],
    "▷": ["##...", "#.##.", "#...#", "#.##.", "##..."],
    "◁": ["...##", ".##.#", "#...#", ".##.#", "...##"],
    "＝": [".....", "#####", ".....", "#####", "....."],
    "≠": ["...#.", "#####", "..#..", "#####", ".#..."],
    "√": ["..###", "..#..", "#.#..", ".##..", "..#.."],
    "π": ["#####", ".#.#.", ".#.#.", ".#.#.", "#..##"],
})

patterns.update({
    "✓": [".....", "....#", "...#.", "#.#..", ".#..."],
    "✕": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "♂": [".####", "...##", "###.#", "#.#.#", "###.."],
    "♀": [".###.", ".#.#.", ".###.", "#####", "..#.."],
    "※": ["#.#.#", ".#.#.", "#.#.#", ".#.#.", "#.#.#"],
    "〒": ["#####", ".....", "#####", "..#..", "..#.."],
    "♫": [".####", ".####", ".#..#", "##.##", "##.##"],
})

# Science / Greek symbols, plus a redrawn む.
patterns.update({
    "℃": [".#.#.", "#.#.#", ".##..", "..#.#", "...#."],
    "Ω": [".###.", "#...#", "#...#", ".#.#.", "##.##"],
    "米": ["#.#.#", "..#..", "#####", "..#..", "#.#.#"],
    "α": [".....", ".##.#", "#..#.", "#..#.", ".##.#"],
    "β": [".##..", "#..#.", "#.#..", "#..#.", "#.#.."],
    "γ": [".....", "##..#", "..#.#", "...#.", "...#."],
    "θ": [".##..", "#..#.", "####.", "#..#.", ".##.."],
    "λ": [".#...", "..#..", "..#..", ".#.#.", ".#..#"],
    "μ": [".#.#.", ".#.#.", ".##.#", ".#...", ".#..."],
    "Σ": ["#####", ".#..#", "..#..", ".#..#", "#####"],
    "む": [".#..#", "###..", ".#..#", "##..#", "####."],
})

# Marks, math, currency and more Greek.
patterns.update({
    "々": [".####", ".#..#", "#...#", "..##.", "....#"],
    "〃": [".#...", ".#.#.", "#..#.", "..#..", "....."],
    "―": [".....", ".....", "#####", ".....", "....."],
    "‐": [".....", ".....", ".###.", ".....", "....."],
    "±": ["..#..", ".###.", "..#..", ".....", ".###."],
    "≧": [".#...", "..#..", ".#...", ".....", ".##.."],
    "≦": ["..#..", ".#...", "..#..", ".....", ".##.."],
    "∞": [".....", ".#.#.", "#.#.#", ".#.#.", "....."],
    "∠": ["....#", "...#.", "..#..", ".#...", "#####"],
    "≒": [".#...", "#####", ".....", "#####", "...#."],
    "⊥": ["..#..", "..#..", "..#..", "..#..", "#####"],
    "￥": ["#...#", ".#.#.", "#####", "#####", "..#.."],
    "€": [".####", "###.#", ".#...", "###.#", ".####"],
    "δ": ["..##.", ".#...", "..##.", ".#.#.", ".###."],
    "ε": ["..##.", ".#...", "..##.", ".#...", "..##."],
    "η": [".....", "#.##.", ".#..#", ".#..#", "....#"],
    "ρ": ["..##.", ".#..#", ".#..#", ".###.", ".#..."],
    "σ": ["...#.", ".##..", "#..#.", "#..#.", ".##.."],
    "τ": ["....#", ".###.", "#.#..", "..#..", "...#."],
    "φ": ["#.##.", "#.#.#", ".###.", "..#..", "..#.."],
    "ω": [".....", ".#.#.", "#...#", "#.#.#", ".#.#."],
    "Δ": ["..#..", ".#.#.", ".#.#.", "#...#", "#####"],
    "Θ": [".###.", "#...#", "###.#", "#...#", ".###."],
    "Λ": ["..#..", ".#.#.", ".#.#.", "#...#", "#...#"],
    "Π": ["####.", "#..#.", "#..#.", "#..#.", "#..#."],
    "Φ": ["..#..", ".###.", "#.#.#", ".###.", "..#.."],
    "Ψ": ["#.#.#", "#.#.#", ".###.", "..#..", "..#.."],
    "∫": ["...#.", "..#..", "..#..", "..#..", ".#..."],
    "∑": ["#####", ".#...", "..#..", ".#...", "#####"],
    "∏": ["#####", ".#.#.", ".#.#.", ".#.#.", ".#.#."],
})

# Same dots under another code point.
for alias, base in (("♣", "☘"), ("☆", "★"), ("♡", "❤"), ("♥", "❤"), ("♤", "♠"), ("♢", "♦"), ("♧", "☘"), ("¥", "￥")):
    patterns[alias] = list(patterns[base])

patterns["©"] = [".###.", "#.#.#", "##..#", "#.#.#", ".###."]  # copyright notice on the title screen
patterns["°"] = patterns["。"][::-1]  # degree sign: the full stop turned upside down

# Every printable ASCII character and its full-width twin (U+FF01-FF5E) share a glyph when only one was drawn.
for code in range(0x21, 0x7F):
    half, full = chr(code), chr(code + 0xFEE0)
    if half in patterns and full not in patterns:
        patterns[full] = list(patterns[half])
    elif full in patterns and half not in patterns:
        patterns[half] = list(patterns[full])


def glyph_for(rows, unit=UNIT, left=70):
    pen = TTGlyphPen(None)
    if rows:
        width = len(rows[0])
        for row, line in enumerate(rows):
            col = 0
            while col < width:
                if line[col] != "#":
                    col += 1
                    continue
                end = col + 1
                while end < width and line[end] == "#":
                    end += 1
                x0, x1 = left + col * unit, left + end * unit
                y0, y1 = (len(rows) - 1 - row) * unit, (len(rows) - row) * unit
                pen.moveTo((x0, y0))
                pen.lineTo((x1, y0))
                pen.lineTo((x1, y1))
                pen.lineTo((x0, y1))
                pen.closePath()
                col = end
    return pen.glyph()


glyph_names = {char: f"uni{ord(char):04X}" for char in patterns}
glyph_names[" "] = "space"
glyph_order = [".notdef", "space"] + list(dict.fromkeys(glyph_names[char] for char in patterns))
glyphs = {".notdef": glyph_for([]), "space": glyph_for([])}
glyphs.update({glyph_names[char]: glyph_for(rows) for char, rows in patterns.items()})
metrics = {".notdef": (840, 0), "space": (420, 0)}
metrics.update({
    glyph_names[char]: ((len(rows[0]) + 1) * UNIT, 70)
    for char, rows in patterns.items()
})

font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(glyph_order)
font.setupCharacterMap({ord(char): glyph_names[char] for char in glyph_names})
font.setupGlyf(glyphs)
font.setupHorizontalMetrics(metrics)
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({
    "familyName": "yodaka",
    "styleName": "Regular",
    "uniqueFontIdentifier": "yodaka 1.1",
    "fullName": "yodaka",
    "psName": "yodaka-Regular",
    "version": "Version 1.1",
})
font.setupOS2(
    sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200,
    sxHeight=700, sCapHeight=700,
)
font.setupPost()
font.setupMaxp()

ttf = ROOT / "yodaka.ttf"
font.save(ttf)
font.font.flavor = "woff"
font.save(ROOT.parent / "yodaka.woff")
print(f"Wrote {ttf.name} and yodaka.woff ({len(patterns)} visible glyphs)")
