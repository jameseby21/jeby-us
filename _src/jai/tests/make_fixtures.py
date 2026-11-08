"""Builds the synthetic fixtures for the free report tests (CONS-0048 and friends).
Everything is made up and seeded: no real data, same output on every run.
    python _src/jai/tests/make_fixtures.py
Writes, next to this file under fixtures/:
    sales_planted.csv + sales_planted.truth.json   sale_observations shape with planted problems
    sales_clean.csv                                 the same generator with nothing planted
    venues.csv + venues.truth.json                  venues export shape with planted problems
Row numbers in the truth files are 0-based body indexes (the header is not counted)."""
import csv, json, math, pathlib, random

OUT = pathlib.Path(__file__).parent / "fixtures"; OUT.mkdir(exist_ok=True)

# ---------- sales (sale_observations shape)
CITIES = {  # median dollars per square foot
    "Miami": 430, "Coral Gables": 620, "Hialeah": 330, "Miami Beach": 780, "Doral": 400, "Sunny Isles Beach": 700}
CITY_W = {"Miami": 30, "Coral Gables": 14, "Hialeah": 18, "Miami Beach": 14, "Doral": 14, "Sunny Isles Beach": 10}
TYPES = {"Single family": 1.0, "Condo": 1.15, "Townhouse": 0.95}
SOURCES = ["MLS", "County records", "Broker feed"]
STREETS = ["Palm Ave", "Ocean Dr", "Bayshore Blvd", "Coral Way", "Sunset Dr", "Pine St", "Lake Rd", "Harbor Ln"]
HEADER = ["observation_id", "sale_price", "sale_date", "city", "address", "living_area_sqft", "beds", "baths", "lot_size_sqft", "property_type", "source"]

def sales(rng, n):
    rows = []
    for i in range(n):
        city = rng.choices(list(CITIES), [CITY_W[c] for c in CITIES])[0]
        ptype = rng.choices(list(TYPES), [50, 35, 15])[0]
        area = int(min(6000, max(500, math.exp(rng.gauss(math.log(1500), 0.28)))))
        ppsf = CITIES[city] * TYPES[ptype] * math.exp(rng.gauss(0, 0.15))
        price = int(round(area * ppsf, -3))
        beds = max(1, min(7, round(area / 520 + rng.gauss(0, 0.6))))
        baths = max(1, min(6, round(beds * 0.75 + rng.gauss(0, 0.5))))
        lot = "" if ptype == "Condo" else int(area * rng.uniform(2.5, 6))
        day = rng.randrange(0, 730)
        y, d = (2024, day) if day < 366 else (2025, day - 366)
        month_len = [31, 29 if y == 2024 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        m = 0
        while d >= month_len[m]: d -= month_len[m]; m += 1
        rows.append([f"SO-{100000 + i}", price, f"{y}-{m + 1:02d}-{d + 1:02d}", city, f"{rng.randrange(100, 9900)} {rng.choice(STREETS)}",
                     area, beds, baths, lot, ptype, rng.choices(SOURCES, [70, 20, 10])[0]])
    return rows

def write(name, header, rows):
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n"); w.writerow(header); w.writerows(rows)

def plant_sales(rows, rng):
    truth = {}
    sib = [i for i, r in enumerate(rows) if r[3] == "Sunny Isles Beach"]
    for i in sib: rows[i][1] *= 10                        # a whole city entered with an extra zero
    truth["city_unit_error"] = sib
    pool = [i for i, r in enumerate(rows) if r[3] in ("Miami", "Hialeah", "Doral") and i not in sib]
    pick = rng.sample(pool, 8)
    for i in pick[:3]: rows[i][1] *= 100                  # cents entered as dollars
    for i in pick[3:4]: rows[i][1] *= 1000                # thousands
    truth["x100"], truth["x1000"] = pick[:3], pick[3:4]
    for i in pick[4:8]: rows[i][5] = max(100, rows[i][5] // 10)   # living area short a digit: only the ratio shows it
    truth["area_typo"] = pick[4:8]
    d = rng.sample([i for i in range(len(rows)) if i not in sib and i not in pick], 3)
    rows[d[0]][2], rows[d[1]][2], rows[d[2]][2] = "2062-03-14", "2071-11-02", "1899-06-01"
    truth["future_date"], truth["ancient_date"] = d[:2], d[2:]
    return truth

rng = random.Random(20261108)
base = sales(rng, 1500)
clean = [r[:] for r in base]
write("sales_clean.csv", HEADER, clean)
planted = [r[:] for r in base]
truth = plant_sales(planted, random.Random(7))
write("sales_planted.csv", HEADER, planted)
(OUT / "sales_planted.truth.json").write_text(json.dumps(truth, indent=1), encoding="utf-8")

# ---------- venues export (12 columns)
VH = ["venue_name", "category", "address_line_1", "address_line_2", "city", "state_code", "postal_code", "latitude", "longitude", "place_id", "vip_id", "td_linxID"]
CHAINS = [("Starbucks", "Coffee"), ("Publix", "Grocery"), ("Walgreens", "Pharmacy"), ("Cafe Bustelo Stand", "Coffee"), ("Planet Fitness", "Gym"), ("Chipotle", "Restaurant")]
CITY_ZIP = {"Miami": ("33130", 25.77, -80.19), "Hialeah": ("33012", 25.86, -80.28), "Doral": ("33166", 25.82, -80.35), "Coral Gables": ("33134", 25.72, -80.27), "Miami Beach": ("33139", 25.79, -80.13)}
vr = random.Random(99); venues = []
for i in range(600):
    city = vr.choice(list(CITY_ZIP)); zc, lat, lon = CITY_ZIP[city]
    if vr.random() < 0.55: name, cat = vr.choice(CHAINS)
    else: name, cat = f"{vr.choice(['Casa','La','El','Blue','Sol','Golden'])} {vr.choice(['Bistro','Market','Studio','Grill','Bakery','Salon'])} {vr.randrange(1, 400)}", vr.choice(["Restaurant", "Retail", "Services"])
    vip = str(vr.randrange(10000, 99999)) if vr.random() < 0.8 else f"VIP-{vr.randrange(1000, 9999)}"   # mixed id types, planted on purpose
    venues.append([name, cat, f"{vr.randrange(100, 9900)} {vr.choice(STREETS)}", "" if vr.random() < 0.9 else f"Suite {vr.randrange(1, 40)}", city, "FL", zc,
                   round(lat + vr.uniform(-.04, .04), 6), round(lon + vr.uniform(-.04, .04), 6), f"ChIJ{vr.getrandbits(60):015x}", vip, f"LX{vr.randrange(10**8, 10**9)}"])
vt = {}
cvs_addr = "1200 Brickell Ave"; start = 100
for k, nm in enumerate(["CVS Pharmacy", "CVS Pharmacy", "CVS  Pharmacy", "CVS  Pharmacy", "CVS", "CVS"]):
    r = venues[start + k]; r[0], r[1], r[2], r[3], r[4], r[6] = nm, "Pharmacy", cvs_addr, "", "Miami", "33131"
vt["cvs_all"] = list(range(start, start + 6)); vt["cvs_spacing"] = [start + 2, start + 3]; vt["cvs_short"] = [start + 4, start + 5]
write("venues.csv", VH, venues)
(OUT / "venues.truth.json").write_text(json.dumps(vt, indent=1), encoding="utf-8")
print("fixtures written to", OUT)
