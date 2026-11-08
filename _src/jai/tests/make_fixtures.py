"""Builds the synthetic fixtures for the free report tests (CONS-0048 and friends).
Everything is made up and seeded: no real data, same output on every run.
    python _src/jai/tests/make_fixtures.py
Writes, next to this file under fixtures/:
    sales_planted.csv + sales_planted.truth.json   sale_observations shape with planted problems
    sales_clean.csv                                 the same generator with nothing planted
    venues.csv + venues.truth.json                  venues export shape with planted problems
    sales_county.csv + sales_county.truth.json      county sales file shape (CONS-0058/0059/0063): a nominal $100 cluster, same-address
                                                    duplicates under new ids, near-duplicates, repeat sales and a few domain problems
Row numbers in the truth files are 0-based body indexes (the header is not counted)."""
import csv, datetime, json, math, pathlib, random

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

# ---------- county sales file (nominal transfers, same-address duplicates under new ids, repeat sales, domain problems)
CS_H = ["sale_id", "folio", "address", "unit", "city", "zip", "sale_date", "sale_price", "living_area_sqft", "beds", "baths", "property_type", "source"]
CS_CITY = {"Sweetwater": ("33172", 300), "Hialeah": ("33012", 340), "Miami": ("33130", 450), "Doral": ("33166", 420), "Coral Gables": ("33134", 640), "Miami Beach": ("33139", 800), "Homestead": ("33030", 260), "Kendall": ("33186", 400)}
CS_W = [16, 14, 22, 12, 10, 8, 10, 14]
CS_STREETS = ["Palm Street", "Ocean Drive", "Bayshore Boulevard", "Coral Way", "Sunset Avenue", "Pine Street", "Lake Road", "Harbor Lane", "Oak Court", "Main Street"]
def cs_date(r, y0=2023):
    day = r.randrange(0, 1095); return (datetime.date(y0, 1, 1) + datetime.timedelta(days=day)).isoformat()
def county(n):
    r = random.Random(424242); rows = []; seen = set()
    while len(rows) < n:
        city = r.choices(list(CS_CITY), CS_W)[0]; zc, ppsf = CS_CITY[city]
        num = r.randrange(100, 9900); street = r.choice(CS_STREETS); unit = "" if r.random() < 0.8 else f"{r.randrange(1, 40)}"
        key = (num, street, unit, city)
        if key in seen: continue
        seen.add(key)
        area = int(min(5500, max(500, math.exp(r.gauss(math.log(1400), 0.3)))))
        price = int(round(area * ppsf * math.exp(r.gauss(0, 0.2)), -3))
        beds = max(1, min(6, round(area / 520 + r.gauss(0, 0.5)))); baths = max(1, min(5, round(beds * 0.75 + r.gauss(0, 0.4))))
        folio = f"{r.randrange(10, 40)}-{r.randrange(1000, 9999)}-{r.randrange(100, 999):03d}-{r.randrange(1000, 9999)}"
        rows.append([f"S-{len(rows) + 1:06d}", folio, f"{num} {street}", unit, city, zc, cs_date(r), price, area, beds, baths, r.choices(["Single family", "Condo", "Townhouse"], [50, 35, 15])[0], r.choices(["County records", "MLS"], [80, 20])[0]])
    return rows
def plant_county(rows):
    r = random.Random(31337); t = {}; n0 = len(rows); idx = list(range(n0)); r.shuffle(idx); take = lambda k: [idx.pop() for _ in range(k)]
    nom = take(280)
    for j, i in enumerate(nom): rows[i][7] = 100 if j < 200 else 10 if j < 240 else 1 if j < 260 else 0     # deeds between family, trusts, foreclosures
    t["nominal"] = nom
    x100 = take(6)
    for i in x100: rows[i][7] *= 100
    t["x100"] = x100
    big = take(1)[0]; rows[big][7] = 150000000; t["over_100m"] = [big]
    d1850 = take(1)[0]; rows[d1850][6] = "1850-01-01"; t["ancient_date"] = [d1850]
    beds = take(1)[0]; rows[beds][9] = 999; t["beds_999"] = [beds]
    badzip = take(3)
    for i in badzip: rows[i][5] = rows[i][5][:4]
    t["bad_zip"] = badzip
    mism = [i for i in take(30) if rows[i][4] == "Miami"][:4]
    for i in mism: rows[i][5] = "33012"                      # a Hialeah zip on a Miami address
    t["city_zip_mismatch"] = mism
    badparcel = take(3)
    for i in badparcel: rows[i][1] = rows[i][1].replace("-", "")
    t["bad_parcel"] = badparcel
    sources = [i for i in take(300) if i not in nom and rows[i][7] > 1000]
    rep = sources[:25]; extra = []
    for i in rep:                                           # repeat sales: same address, later date, higher price
        o = rows[i]; d = datetime.date.fromisoformat(o[6]) + datetime.timedelta(days=r.randrange(200, 900))
        extra.append([f"S-{n0 + len(extra) + 1:06d}", o[1], o[2], o[3], o[4], o[5], d.isoformat(), int(round(o[7] * r.uniform(1.04, 1.35), -3)), o[8], o[9], o[10], o[11], o[12]])
    t["repeat_first"] = rep; t["repeat_second"] = list(range(n0, n0 + len(extra)))
    rows.extend(extra)
    dsrc = sources[25:37]; dups = []
    for i in dsrc:                                          # the same sale entered again under a new id
        o = rows[i][:]; o[0] = f"S-{len(rows) + len(dups) + 1:06d}"; dups.append(o)
    t["dup_first"] = dsrc; t["dup_second"] = list(range(len(rows), len(rows) + len(dups)))
    rows.extend(dups)
    nsrc = sources[37:43]; near = []
    for i in nsrc:                                          # same sale, address written differently
        o = rows[i][:]; o[0] = f"S-{len(rows) + len(near) + 1:06d}"; o[2] = o[2].upper().replace("STREET", "ST").replace("AVENUE", "AVE").replace("BOULEVARD", "BLVD").replace("ROAD", "RD").replace("DRIVE", "DR").replace("LANE", "LN").replace("COURT", "CT"); near.append(o)
    t["near_first"] = nsrc; t["near_second"] = list(range(len(rows), len(rows) + len(near)))
    rows.extend(near)
    return t
cs = county(2000); cs_truth = plant_county(cs)
write("sales_county.csv", CS_H, cs)
(OUT / "sales_county.truth.json").write_text(json.dumps(cs_truth, indent=1), encoding="utf-8")
print("fixtures written to", OUT)
