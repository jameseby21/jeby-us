"""Builds the synthetic fixtures for the free report tests (CONS-0048 and friends).
Everything is made up and seeded: no real data, same output on every run.
    python _src/jai/tests/make_fixtures.py
Writes, next to this file under fixtures/:
    sales_planted.csv + sales_planted.truth.json   sale_observations shape with planted problems
    sales_clean.csv                                 the same generator with nothing planted
    venues.csv + venues.truth.json                  venues export shape with planted problems
    records_mixed.csv + records_mixed.truth.json    no topic: normal, sparse, rich, duplicate, conflicting, outlier and corrupted records (CONS-0064)
    ledger_headerless.csv / ledger_header.csv / ledger_title.csv + ledger.truth.json
                                                    a made-up debit-card ledger (CONS-0071/0072/0073): no header row, with a header row, and with a title row above it
    numeric_header.csv                              a header made of years, over amounts (CONS-0071)
    sales_roles.csv                                 sales shape with year built, zip, a count column and a true area column (CONS-0070/0074)
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
        o = rows[i]; d = min(datetime.date.fromisoformat(o[6]) + datetime.timedelta(days=r.randrange(200, 600)), datetime.date(2026, 10, 31))
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

# ---------- mixed records (CONS-0064): normal, sparse, rich, duplicate, conflicting, outlier and corrupted records, no topic
MX_H = ["ref", "name", "city", "postal", "joined", "amount", "qty", "notes"]
def mixed():
    r = random.Random(555); rows = []; cities = ["Alder", "Birch", "Cedar", "Dunmore", "Elmont"]
    for i in range(400):
        city = r.choice(cities); amount = round(math.exp(r.gauss(math.log(80), 0.25)) * (1 + cities.index(city) * 0.15), 2)
        d = (datetime.date(2025, 1, 1) + datetime.timedelta(days=r.randrange(0, 300))).isoformat()
        rows.append([f"R{1000 + i}", f"Person {i}", city, f"{10000 + cities.index(city) * 111}", d, f"{amount:.2f}", str(r.randrange(1, 6)), ""])
    t = {}; idx = list(range(400)); r.shuffle(idx); take = lambda k: [idx.pop() for _ in range(k)]
    rich = take(5)
    for i in rich: rows[i][7] = "renewal discussed on call"               # rich: every field present
    t["rich"] = rich
    sparse = take(25)
    for i in sparse: rows[i][1] = rows[i][2] = rows[i][3] = rows[i][5] = rows[i][6] = ""   # sparse: only the key and a date
    t["sparse"] = sparse
    out = take(3)
    for i in out: rows[i][5] = f"{float(rows[i][5]) * 100:.2f}"           # contextual outliers: two digits too many
    t["outlier"] = out
    bad = take(3)
    for i, v in zip(bad, ["12x5", "n/a", "$ten"]): rows[i][5] = v           # corrupted: not numbers
    t["malformed_amount"] = bad
    baddate = take(2)
    for i in baddate: rows[i][4] = "2999-01-01"                          # corrupted: impossible dates
    t["malformed_date"] = baddate
    rep = take(16)
    for i in rep: rows[i][5] = "49.99"                                   # repeated value: one amount copied into many rows
    t["repeated_value"] = rep
    dups = take(5); extra = []
    for i in dups: extra.append(rows[i][:])                              # duplicates: exact copies
    t["duplicate_first"] = dups; t["duplicate_second"] = list(range(400, 405)); rows.extend(extra)
    conf = take(4); extra2 = []
    for i in conf:                                                       # conflicting: one ref on two different records
        o = rows[i][:]; o[1] = "Someone Else"; o[5] = f"{float(o[5]) * 1.3:.2f}" if o[5] and o[5].replace('.', '').isdigit() else "70.00"; extra2.append(o)
    t["conflict_first"] = conf; t["conflict_second"] = list(range(405, 409)); rows.extend(extra2)
    return rows, t
mx, mx_truth = mixed()
write("records_mixed.csv", MX_H, mx)
(OUT / "records_mixed.truth.json").write_text(json.dumps(mx_truth, indent=1), encoding="utf-8")

# ---------- a made-up debit-card ledger (CONS-0071, 0072, 0073): signed amounts, merchant strings with store numbers, cities and processor prefixes,
# a type column, a running balance and two blank trailing columns. Newest first, as banks export it. No real rows: every line is generated.
def ledger():
    r = random.Random(20181119); tx = []        # (date, description, amount, kind)
    d0 = datetime.date(2018, 1, 2); end = datetime.date(2018, 11, 19)
    day = d0
    while day <= end:
        if day.day in (5, 20) or (day.day == 19 and day.month == 11): tx.append((day, "PAYROLL ACME CORP", 2150.00, "ACH_CREDIT"))
        if day.day == 19 and day.month != 11: tx.append((day, "NETFLIX.COM" if day.month % 2 else "Netflix.com", -15.49, "DEBIT_CARD"))
        if day.day == 3: tx.append((day, "SPOTIFY USA", -10.99, "DEBIT_CARD"))
        if day.day == 9: tx.append((day, "PLANET FITNESS 04412 COLUMBUS IN", -24.99, "DEBIT_CARD"))
        day += datetime.timedelta(days=1)
    shops = [("KROGER {s} COLUMBUS IN 50910", 30, 18, 95), ("KROGER {s} INDIANAPOLIS IN 46204", 10, 18, 95), ("Kroger #{s}", 6, 18, 95), ("SHELL OIL {s} COLUMBUS IN", 24, 22, 58),
             ("SQ *BLUE BOTTLE COFFEE", 22, 4, 9), ("SQ *BLUE BOTTLE COFFEE SAN FRANCISCO CA", 6, 4, 9), ("TST* TACO PLACE {s} COLUMBUS IN", 14, 9, 31), ("VENMO* JORDAN", 7, 10, 80),
             ("VENMO*PAYMENT", 5, 10, 80), ("PAYPAL *EBAY", 8, 12, 140), ("AMAZON.COM*2K4TT1 SEATTLE WA", 12, 9, 120), ("AMZN Mktp US*1A2B3", 8, 9, 120), ("WAL-MART #{s}", 12, 14, 160)]
    for tmpl, n, lo, hi in shops:
        for _ in range(n):
            dd = d0 + datetime.timedelta(days=r.randrange(0, (end - d0).days + 1))
            tx.append((dd, tmpl.format(s=r.choice([710, 712, 1234, 4005])), -round(r.uniform(lo, hi), 2), "DEBIT_CARD"))
    tx.append((datetime.date(2018, 6, 14), "BEST BUY 000123 COLUMBUS IN", -1862.94, "DEBIT_CARD"))
    refund_day = datetime.date(2018, 8, 21)
    tx.append((refund_day, "KROGER 710 COLUMBUS IN 50910", -62.15, "DEBIT_CARD")); tx.append((refund_day, "KROGER 710 COLUMBUS IN 50910", 62.15, "DEBIT_CARD"))   # a purchase and its refund on the same day
    dup_day = datetime.date(2018, 9, 12)
    tx.append((dup_day, "TST* TACO PLACE 0042 COLUMBUS IN", -27.80, "DEBIT_CARD")); tx.append((dup_day, "TST* TACO PLACE 0042 COLUMBUS IN", -27.80, "DEBIT_CARD"))      # the same charge entered twice
    tx.sort(key=lambda t: (t[0], t[3] != "ACH_CREDIT", t[1], t[2]))
    bal = 5000.00; rows = []
    for dd, desc, amt, kind in tx:
        bal = round(bal + amt, 2)
        rows.append([("CREDIT" if amt > 0 else "DEBIT"), dd.strftime("%m/%d/%Y"), desc, f"{amt:.2f}", kind, f"{bal:.2f}", "", ""])
    rows.reverse()                                          # newest first
    return rows
LEDGER = ledger()
LH = ["Details", "Posting Date", "Description", "Amount", "Type", "Balance", "", ""]
def write_raw(name, header, rows, title=None):
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        if title: w.writerow([title])
        if header: w.writerow(header)
        w.writerows(rows)
write_raw("ledger_headerless.csv", None, LEDGER)
write_raw("ledger_header.csv", LH, LEDGER)
write_raw("ledger_title.csv", LH, LEDGER, title="Synthetic checking activity, Jan 2 to Nov 19 2018, made up for tests")
dupkey = [i for i, row in enumerate(LEDGER) if row[2].startswith("TST* TACO PLACE 0042") and row[3] == "-27.80"]
refund = [i for i, row in enumerate(LEDGER) if row[2].startswith("KROGER 710 COLUMBUS IN 50910") and row[1] == "08/21/2018"]
(OUT / "ledger.truth.json").write_text(json.dumps({"duplicate_rows": dupkey, "refund_pair": refund, "rows": len(LEDGER),
    "recurring": ["Netflix", "Spotify", "Planet Fitness"], "big_purchase": [i for i, row in enumerate(LEDGER) if row[3] == "-1862.94"]}, indent=1), encoding="utf-8")

# a header made of years, over amounts: a row of numbers on top is still a header (CONS-0071)
nr = random.Random(5)
write_raw("numeric_header.csv", ["2022", "2023", "2024"], [[f"{nr.uniform(900, 4000):.2f}" for _ in range(3)] for _ in range(14)])

# ---------- sales with year built, zip and a true area column (CONS-0070, 0074). "Sales (#)" is 1 on every row, as in the file that showed TOTAL SALES (#).
def sales_roles():
    r = random.Random(8080); rows = []
    cities = {"Miami": ("33130", 430), "Hialeah": ("33012", 330), "Doral": ("33166", 400), "Coral Gables": ("33134", 620), "Miami Beach": ("33139", 780)}
    for i in range(1200):
        city = r.choice(list(cities)); zc, ppsf = cities[city]
        area = int(min(6000, max(500, math.exp(r.gauss(math.log(1500), 0.28))))); yb = r.randrange(1925, 2023)
        price = int(round(area * ppsf * math.exp(r.gauss(0, 0.18)), -3))
        rows.append([f"{100000 + i * 7 + r.randrange(0, 5)}", (datetime.date(2024, 1, 1) + datetime.timedelta(days=r.randrange(0, 500))).isoformat(), city, zc, yb, area, r.randrange(1, 6), price, 1])
    return rows
write_raw("sales_roles.csv", ["Parcel", "Sale date", "City", "Zip", "Year built", "Living area sqft", "Beds", "Sale price", "Sales (#)"], sales_roles())
print("fixtures written to", OUT)

