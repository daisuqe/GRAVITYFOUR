"""Select one fixed-date observance and a short cup title for every calendar date.

Source: https://adayisaholiday.com/holidays.json (retrieved 2026-09-23).
Review the generated daily-cups.csv before publishing daily-cups.js.
"""

import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
items = json.loads((ROOT / "calendar-source.json").read_text(encoding="utf-8"))
by_date = {}
for item in items:
    by_date.setdefault(item["date"], []).append(item)

exclude = re.compile(
    r"\b(week|weekend|first|second|third|fourth|last|monday|tuesday|wednesday|"
    r"thursday|friday|saturday|sunday|equinox|solstice|lunar|easter|ramadan|"
    r"passover|diwali|thanksgiving|ash wednesday|shrove|changing|movable|"
    r"birth anniversary|anniversary of|memorial|remembrance|mourning|"
    r"suicide|cancer|violence|genocide|holocaust|mutilation|hunger|"
    r"disease|abuse|trafficking|victims|war|terror|disability|death|"
    r"fighting|parkinson|meningitis|asthma|lupus|vitiligo|zoonoses|"
    r"rabies|cerebral palsy|arthritis|trauma|pneumonia|diabetes|"
    r"epidemic|bipolar|anti-corruption|sex workers|patient safety|"
    r"intellectual property|hot dog|chili day|king cake|"
    r"poetry at work|read aloud|wear red|pisco sour|spay day|"
    r"book day \(uk|social work day|world math day|thingyan|circus day|"
    r"space day|password day|public gardens day|belly dance day|"
    r"pizza party day|baking day|gin day|cream tea day|kebab day|"
    r"ice cream day|blues music day|ipa day|honey bee day|"
    r"burger day|chianti day|401\(k\)|dance day|maritime day|"
    r"smile day|sight day|chess day|lemur day|stout day|numbat day|"
    r"jukebox day|flossing day|choral day|flower day|toast day|"
    r"kidney day|day of pink|pinhole photography|guide dog day|"
    r"mural day|train day|child's day|red panda day|bison day|"
    r"quality day|day of listening|laboratory animals|no tobacco|"
    r"hypertension|sjogren|401|"
    r"oreo|lego|star wars|play-doh|sailor moon)\b",
    re.I,
)
favourites = re.compile(
    r"\b(flower|chess|checkers|space|star|moon|sun|ocean|sea|river|forest|"
    r"tree|bird|cat|dog|bee|butterfly|panda|penguin|dolphin|tiger|"
    r"music|art|book|dance|poetry|science|robot|video game|puzzle|"
    r"pizza|chocolate|coffee|tea|cake|cookie|ice cream|donut|potato|"
    r"friendship|smile|kindness|color|colour|light|planet|earth|rainbow|"
    r"crystal|diamond|gem|arcade|pixel|kite|balloon|train|bicycle)\b",
    re.I,
)


def theme(name):
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\s*\([^)]*\)", "", name)
    text = re.sub(r"^(National|International|World|Global|Universal|Great American)\s+", "", text, flags=re.I)
    text = re.sub(r"^(Day of|Day for|Day to)\s+", "", text, flags=re.I)
    text = re.sub(r"\s+(Day|Awareness Day|Appreciation Day|Celebration Day)$", "", text, flags=re.I)
    text = re.sub(r"^(The|A|An)\s+", "", text, flags=re.I)
    text = re.sub(r"[^A-Za-z0-9 '&-]", "", text).strip(" -'&")
    text = re.sub(r"\s+", " ", text)
    return text.upper()


def score(item):
    name = item["name"]
    label = theme(name)
    return (
        int(bool(favourites.search(name))) * 35
        + (8 if item["category"] == "UN/International" else 0)
        + (4 if name.startswith("World ") else 0)
        - max(0, len(label) - 18) * 2
        - max(0, len(label.split()) - 2) * 4
        - (10 if "Awareness" in name else 0)
        - (15 if "United States" in name else 0)
    )


rows = []
overrides = {
    "01-06": {"occasion": "National Take Down the Christmas Tree Day", "cup": "CHRISTMAS TREE CUP"},
    "02-11": {"occasion": "International Day of Women and Girls in Science", "cup": "SCIENCE CUP"},
    "03-17": {"occasion": "St. Patrick's Day", "cup": "SHAMROCK CUP"},
    "03-20": {"occasion": "International Day of Happiness", "cup": "HAPPINESS CUP"},
    "03-21": {"occasion": "National Flower Day", "cup": "FLOWER CUP"},
    "04-20": {"occasion": "National Pineapple Upside-down Cake Day", "cup": "PINEAPPLE CAKE CUP"},
    "04-24": {"occasion": "National Pigs-in-a-Blanket Day", "cup": "PIGS IN A BLANKET CUP"},
    "05-01": {"occasion": "May Day", "cup": "MAY DAY CUP"},
    "05-07": {"occasion": "National Tourism Day", "cup": "TOURISM CUP"},
    "05-09": {"occasion": "National Butterscotch Brownie Day", "cup": "BROWNIE CUP"},
    "05-31": {"occasion": "National Smile Day", "cup": "SMILE CUP"},
    "06-07": {"occasion": "National Chocolate Ice Cream Day", "cup": "CHOCOLATE ICE CREAM CUP"},
    "07-20": {"occasion": "World Chess Day", "cup": "CHESS CUP"},
    "07-23": {"occasion": "National Vanilla Ice Cream Day", "cup": "VANILLA ICE CREAM CUP"},
    "08-29": {"occasion": "International Day Against Nuclear Tests", "cup": "PEACE CUP"},
    "08-31": {"occasion": "National Trail Mix Day", "cup": "TRAIL MIX CUP"},
    "09-09": {"occasion": "International Sudoku Day", "cup": "SUDOKU CUP"},
    "09-19": {"occasion": "International Talk Like a Pirate Day", "cup": "PIRATE CUP"},
    "09-30": {"occasion": "International Translation Day", "cup": "TRANSLATION CUP"},
    "10-02": {"occasion": "National Fried Scallops Day", "cup": "SCALLOP CUP"},
    "10-03": {"occasion": "National Butterfly and Hummingbird Day", "cup": "BUTTERFLY CUP"},
    "10-04": {"occasion": "World Animal Day", "cup": "ANIMAL CUP"},
    "11-12": {"occasion": "National French Dip Day", "cup": "FRENCH DIP CUP"},
    "11-14": {"occasion": "National Pickle Day", "cup": "PICKLE CUP"},
    "11-27": {"occasion": "National Electric Guitar Day", "cup": "ELECTRIC GUITAR CUP"},
    "12-15": {"occasion": "National Cupcake Day", "cup": "CUPCAKE CUP"},
    "12-16": {"occasion": "National Chocolate Covered Anything Day", "cup": "CHOCOLATE CUP"},
    "12-25": {"occasion": "Christmas Day", "cup": "CHRISTMAS CUP"},
    "12-26": {"occasion": "National Candy Cane Day", "cup": "CANDY CANE CUP"},
    "12-30": {"occasion": "National Bicarbonate of Soda Day", "cup": "BAKING SODA CUP"},
}
for date in sorted(by_date):
    if date in overrides:
        rows.append({"date": date, **overrides[date]})
        continue
    choices = [item for item in by_date[date]
               if item["category"] in ("Secular/Cultural", "UN/International")
               and not exclude.search(item["name"])
               and 3 <= len(theme(item["name"])) <= 34]
    if not choices:
        choices = [item for item in by_date[date]
                   if item["category"] == "National" and not exclude.search(item["name"])]
    if not choices:
        raise ValueError("No fixed-date observance: " + date)
    selected = sorted(choices, key=lambda item: (-score(item), len(theme(item["name"])), item["name"]))[0]
    rows.append({"date": date, "occasion": selected["name"], "cup": theme(selected["name"]) + " CUP"})

assert len(rows) == 366
with (ROOT / "daily-cups.csv").open("w", encoding="utf-8", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=("date", "occasion", "cup"))
    writer.writeheader()
    writer.writerows(rows)
(ROOT.parent / "daily-cups.js").write_text(
    "window.GravityFourCups = " + json.dumps({row["date"]: [row["cup"], row["occasion"]] for row in rows},
                                             ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print("Selected", len(rows), "fixed calendar dates")
