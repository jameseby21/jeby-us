"""Builds jainsights.com as static pages. out/ is the deployable site. Product data is shared with jeby.us (site2 LAB)."""
import html, json, pathlib, shutil, sys
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT / "src")); sys.path.insert(0, str(ROOT.parent / "jeby" / "src"))
import jai_content as J
from content import LAB
sys.path.insert(0, str(ROOT.parent / "brand"))
import brand as BR  # marks.json: the cycling rule's candidates
E = html.escape
OUT = ROOT / "out"; shutil.rmtree(OUT, ignore_errors=True); (OUT / "assets").mkdir(parents=True, exist_ok=True)
RATE = J.CONFIG["rate"]; EMAIL = J.CONFIG["email"]
money = lambda n: f"${n:,.0f}"
PK = {p["id"]: p for p in J.PACKAGES}
price = lambda p: money(p["hours"] * RATE) + ("/mo" if p["monthly"] else "")
PRODUCTS = [it for g in LAB for it in g["items"] if it.get("jai")]
ALL_PROJECTS = [it for g in LAB for it in g["items"]]

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600'
         '&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">')
NAV = [("services", "Services"), ("report", "Free report"), ("products", "Products"), ("approach", "Approach"), ("about", "About")]
ARROW = '<span class="arrow" aria-hidden="true">→</span>'
MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>'
SCOTTIE = ('<svg viewBox="214 60 176 186" aria-hidden="true"><path d="M225 182 248 70l53 42 55-42 22 112c-10 31-35 49-77 49s-67-18-76-49Z" fill="none" stroke="#121212" stroke-width="14" stroke-linejoin="round"/>'
           '<path d="m254 102 28 57 19-29 20 29 29-57M272 180c20 20 39 20 59 0" fill="none" stroke="#121212" stroke-width="9" stroke-linecap="round"/>'
           '<g class="eyes"><circle cx="274" cy="151" r="7" fill="#b3121a"/><circle cx="329" cy="151" r="7" fill="#b3121a"/></g><path d="m292 168 9 8 9-8Z" fill="#b3121a"/></svg>')

def booking(subject):
    b = J.CONFIG["booking"]; url = b.get(b["provider"]) if b["provider"] != "email" else ""
    if url: return f'href="{E(url)}" target="_blank" rel="noopener"'
    return f'href="mailto:{EMAIL}?subject={E(subject)}" data-email="{EMAIL}" data-subject="{E(subject)}"'

def header(active):
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'<a href="{k}.html"{cur(k)}>{n}</a>' for k, n in NAV)
    links += '<a data-x="jeby" data-p="index.html" data-family-only="B">jeby.us ↗</a>'
    pop = "".join(f'<a href="{k}.html">{n}</a>' for k, n in NAV + [("contact", "Contact")])
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="jai-head"><div class="wrap">
  <a class="wordmark" href="index.html" aria-label="JA Insights, home"><span class="wm"><b>JA</b>Insights</span><span class="tag">Data · Automation · Growth</span></a>
  <nav class="jnav" aria-label="Main">{links}</nav>
  <a class="btn red small head-cta" href="contact.html"{cur("contact")}>Book a call</a>
  <button class="menu-btn" type="button" popovertarget="jnavpop" aria-label="Open menu">{MENU}</button>
  <div class="jnav-pop" id="jnavpop" popover>{pop}</div>
</div></header>'''

def footer():
    svc = "".join(f'<li><a href="services.html#{l["id"]}">{E(l["title"])}</a></li>' for l in J.LINES)
    return f'''<footer class="jai-foot"><div class="wrap">
  <div><a class="wordmark" href="index.html"><span class="wm"><b>JA</b>Insights</span><span class="tag">Data · Automation · Growth</span></a>
    <small>JA Insights LLC · Miami, Florida · <a href="#" data-copy-email="{EMAIL}">{EMAIL}</a></small>
    <div class="scottie">{SCOTTIE}<span>Drew double-checked the math.</span></div></div>
  <div><h3>Services</h3><ul>{svc}</ul></div>
  <div><h3>Practice</h3><ul><li><a href="approach.html">Approach and pricing</a></li><li><a href="products.html">Products</a></li><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li></ul></div>
  <div><h3>Family</h3><ul><li><a data-x="jeby" data-p="index.html">jeby.us</a> · the founder</li><li><a data-x="jeby" data-p="lab.html">jebyLabs</a> · free versions</li><li>jeby Real Estate</li><li><a href="{J.CONFIG["linkedin"]}" target="_blank" rel="noopener">LinkedIn</a></li></ul></div>
</div></footer>'''

def page(key, title, desc, body):
    ld = ""
    if key == "index":
        ld = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@type": "ProfessionalService", "name": "JA Insights",
              "url": "https://jainsights.com/", "email": EMAIL, "areaServed": "US", "address": {"@type": "PostalAddress", "addressLocality": "Miami", "addressRegion": "FL", "addressCountry": "US"},
              "founder": {"@type": "Person", "name": "James Eby", "url": "https://jeby.us/"}, "priceRange": f"${RATE}/hour"}) + "</script>"
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta name="theme-color" content="#fafaf7">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:type" content="website">
<link rel="canonical" href="https://jainsights.com/{"" if key == "index" else key}">{BR.favicon_links("jai")}
{FONTS}<link rel="stylesheet" href="assets/jai.css">
<script type="speculationrules">{{"prerender":[{{"where":{{"href_matches":"/*"}},"eagerness":"moderate"}}]}}</script>{ld}
</head><body>{header(key)}<main id="main">{body}</main>{footer()}
<script src="assets/jai.js" defer></script>{'<script src="assets/records.js" defer></script><script src="assets/rules.js" defer></script><script src="assets/domain.js" defer></script><script src="assets/shape.js" defer></script><script src="assets/pack.js" defer></script><script src="assets/report.js" defer></script>' if key == "report" else ""}<script src="assets/brand.js" defer></script><script src="assets/family.js" data-site="jai" defer></script></body></html>'''
    (OUT / f"{key}.html").write_text(doc, encoding="utf-8")

def mark(it):
    t = BR.tile(it["id"], themed=False)
    if t: return t
    if it.get("mark_img"): return f'<span class="mark" style="background:{it["accent"]}"><img src="assets/{it["mark_img"]}" alt=""></span>'
    return f'<span class="mark" style="background:{it["accent"]}">{E(it["mark"])}</span>'

def figure():
    """Fig. 1: twelve months of sales; points land, the trend draws, then the duplicated August invoice gets circled."""
    vals = [41, 44, 43, 47, 50, 49, 53, 108, 55, 58, 57, 61]
    x0, x1, y0, y1, vmax = 46, 540, 268, 24, 120
    X = lambda i: x0 + i * (x1 - x0) / 11; Y = lambda v: y0 - (v / vmax) * (y0 - y1)
    pts = "".join(f'<circle class="pt" cx="{X(i):.1f}" cy="{Y(v):.1f}" r="{7 if i == 7 else 5.5}" style="animation-delay:{.15 + i * .07:.2f}s"/>' for i, v in enumerate(vals))
    clean = [v for i, v in enumerate(vals) if i != 7]; xs = [i for i in range(12) if i != 7]
    mx = sum(xs) / len(xs); my = sum(clean) / len(clean)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, clean)) / sum((x - mx) ** 2 for x in xs); a = my - b * mx
    trend = f'M{X(0):.1f} {Y(a):.1f} L{X(11):.1f} {Y(a + b * 11):.1f}'
    months = "".join(f'<text class="tick" x="{X(i):.1f}" y="290" text-anchor="middle">{m}</text>' for i, m in enumerate("JFMAMJJASOND"))
    grid = "".join(f'<line class="axis" x1="{x0 - 10}" x2="{x1 + 10}" y1="{Y(v):.1f}" y2="{Y(v):.1f}"/>'
                   f'<text class="tick" x="{x0 - 16}" y="{Y(v) + 4:.1f}" text-anchor="end">{v}k</text>' for v in (0, 40, 80, 120))
    cx, cy = X(7), Y(108)
    ring = f'<path class="ring" d="M{cx - 22:.1f} {cy + 4:.1f} C{cx - 24:.1f} {cy - 22:.1f} {cx + 22:.1f} {cy - 26:.1f} {cx + 23:.1f} {cy - 2:.1f} C{cx + 24:.1f} {cy + 22:.1f} {cx - 16:.1f} {cy + 26:.1f} {cx - 24:.1f} {cy - 6:.1f}"/>'
    note = f'<text class="note" x="{cx - 34:.1f}" y="{cy + 2:.1f}" text-anchor="end">entered twice</text><path class="ring" style="stroke-width:1.6" d="M{cx - 32:.1f} {cy - 4:.1f} q12 -6 8 -2"/>'
    return f'''<figure class="fig" aria-labelledby="fig1c"><svg viewBox="0 0 560 300" role="img" aria-label="Monthly sales rising from 41 to 61 thousand, with an August spike to 108 thousand circled and labelled entered twice.">
{grid}{months}{pts}<path class="trend" d="{trend}"/>{ring}{note}</svg>
<figcaption id="fig1c"><span><b>Fig. 1</b> Monthly sales for a sample client. The August spike was one invoice, entered twice.</span><span>Illustration</span></figcaption></figure>'''

def rate_table(ids=None, cls=""):
    rows = "".join(f'<tr><td><b>{E(p["name"])}</b><span>{E(p["what"])}</span></td><td>{p["hours"]} h{"/mo" if p["monthly"] else ""}</td><td>{price(p)}</td></tr>'
                   for p in J.PACKAGES if not ids or p["id"] in ids)
    return f'<table class="card {cls}"><thead><tr><th>Package</th><th>Hours</th><th>Price</th></tr></thead><tbody>{rows}</tbody></table>'

def steps():
    return '<div class="steps">' + "".join(f'<div class="step"><span class="when">{E(w)}</span><b>{E(t)}</b><p>{E(d)}</p></div>' for t, d, w in J.STEPS) + "</div>"

def band(title, subject):
    return f'''<section class="block"><div class="wrap"><div class="band"><h2>{title}</h2><div class="cta" style="margin:0">
<a class="btn red" {booking(subject)}>Book a free 30-minute call {ARROW}</a><a class="btn" href="approach.html#pricing">See how pricing works</a></div></div></div></section>'''

def page_head(label, title, lede):
    return f'<div class="wrap"><div class="page-head"><span class="label">{label}</span><h1 class="page-title">{title}</h1><p class="lede">{lede}</p></div></div>'

def mini_sheet():
    """A small drawing of the report: it prints itself, then circles the odd month."""
    pts = [30, 34, 33, 38, 36, 64, 40, 43, 42, 47]
    X = lambda i: 40 + i * 26; Y = lambda v: 238 - v * 1.3
    line = "M" + " L".join(f"{X(i)} {Y(v):.0f}" for i, v in enumerate(pts))
    dots = "".join(f'<circle class="pt" cx="{X(i)}" cy="{Y(v):.0f}" r="4" style="animation-delay:{.2 + i * .06:.2f}s"/>' for i, v in enumerate(pts))
    cx, cy = X(5), Y(64)
    checks = "".join(f'<g transform="translate(176 {92 + i * 18})"><circle r="6" fill="{c}"/><rect x="12" y="-3" width="{w}" height="6" rx="3" fill="#dcdad3"/></g>' for i, (c, w) in enumerate([("#b3121a", 70), ("#b3121a", 56), ("#a86b00", 64), ("#2e7d4f", 48)]))
    return f'''<figure class="fig mini" aria-hidden="true"><svg viewBox="0 0 320 290"><rect x="6" y="6" width="308" height="278" fill="#fff" stroke="#dcdad3"/>
<text x="24" y="38" font-family="Newsreader,Georgia,serif" font-size="17" fill="#121212"><tspan fill="#b3121a" font-weight="600">JA</tspan> Insights</text><text x="296" y="38" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="8" fill="#6c6b66">ONE-PAGE REPORT</text>
<line x1="24" x2="296" y1="48" y2="48" stroke="#121212" stroke-width="1.5"/>
<g font-family="IBM Plex Mono,monospace" font-size="7" fill="#6c6b66"><text x="24" y="70">ROWS</text><text x="94" y="70">COLUMNS</text><text x="164" y="70">DATES</text><text x="234" y="70">TOTAL</text></g>
<g font-family="Newsreader,Georgia,serif" font-size="13" fill="#121212"><text x="24" y="84">1,329</text><text x="94" y="84">7</text><text x="164" y="84">2025</text><text x="234" y="84">47.9K</text></g>
<rect x="24" y="92" width="130" height="6" rx="3" fill="#121212"/><rect x="24" y="106" width="110" height="6" rx="3" fill="#dcdad3"/><rect x="24" y="120" width="120" height="6" rx="3" fill="#dcdad3"/><rect x="24" y="134" width="96" height="6" rx="3" fill="#dcdad3"/>
{checks}<line x1="24" x2="296" y1="238" y2="238" stroke="#dcdad3"/><path class="trend" d="{line}"/>{dots}
<path class="ring" d="M{cx - 14} {cy + 3}C{cx - 15} {cy - 14} {cx + 14} {cy - 16} {cx + 15} {cy - 1}C{cx + 16} {cy + 14} {cx - 10} {cy + 16} {cx - 16} {cy - 4}"/><text class="note" x="{cx + 20}" y="{cy - 6}" style="font-size:14px">1.7× typical</text>
<text x="296" y="270" text-anchor="end" font-family="IBM Plex Sans,sans-serif" font-size="8" fill="#6c6b66">made in your browser · nothing uploaded</text></svg></figure>'''

# Home
facts = "".join(f"<div><b>{E(a)}</b><span>{E(b)}</span></div>" for a, b in J.FACTS)
cols = "".join(f'''<div><span class="label"><b>0{i + 1}</b> · {E(l["tab"])}</span><h3>{E(l["title"])}</h3><p>{E(l["line"])} {E(l["body"])}</p>
<span class="meta">Typical: <b>{E(PK[l["from"]]["name"])}</b>, {PK[l["from"]]["hours"]} h × ${RATE} = <b>{price(PK[l["from"]])}</b></span>
<a href="services.html#{l["id"]}">{E(l["tab"])} in detail {ARROW}</a></div>''' for i, l in enumerate(J.LINES[:3]))
prod_strip = "".join(f'<a class="prod-chip" href="products.html#{it["id"]}">{mark(it)}<span><b>{E(it["name"])}</b><small>{E(J.PRODUCT_NOTES[it["id"]][0])}</small></span></a>' for it in PRODUCTS)
page("index", "JA Insights · Data work you can check", "Dashboards, analysis and automation for small businesses and teams in Miami and remote. One published rate; every quote shows its math.", f'''
<div class="wrap"><section class="hero"><div><span class="label">{J.HERO["label"]}</span><h1>{J.HERO["title"]}</h1><p class="lede">{J.HERO["lede"]}</p>
<div class="cta"><a class="btn red" {booking("Intro call")}>Book a free 30-minute call {ARROW}</a><a class="btn" href="services.html">See services and prices</a></div></div>
{figure()}</section><div class="facts">{facts}</div></div>
<section class="block" style="padding-top:48px"><div class="wrap teaser"><div><span class="label"><b>●</b> Free · private · instant</span><h2>See what your data says, <span class="u">before you pay anyone</span>.</h2>
<p class="lede">Add a spreadsheet and get a one-page report: duplicates, gaps, spelling variants, the trend and anything unusual. It runs on your device, so nothing is uploaded.</p>
<div class="cta"><a class="btn red" href="report.html">Try the free report {ARROW}</a><a class="btn" href="report.html#sample">See a sample</a></div></div>{mini_sheet()}</div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>Three kinds of work, <span class="u">done carefully</span>.</h2><p>Most projects are one of these. Training for teams is the fourth, and the rest is quoted the same way.</p></div><div class="cols3">{cols}</div></div></section>
<section class="block" style="background:var(--paper-2)"><div class="wrap rate"><div class="bigrate"><span class="label">The rate</span><b>${RATE}<small> / hour</small></b>
<p>One rate for every kind of work. Each package below is just hours × ${RATE}, and a custom quote is built the same way.</p>
<div class="cta" style="margin-top:14px"><a class="btn" href="services.html#estimate">Build an estimate {ARROW}</a></div></div>{rate_table(["health", "dashboard", "analysis", "care"])}</div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>How a project <span class="u">runs</span>.</h2><p>Four steps, and you know the cost before step three starts.</p></div>{steps()}</div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>Free at jebyLabs. <span class="u">Supported here</span>.</h2><p>Every project James builds has a free, open edition on jeby.us. JA Insights offers the paid, hosted and supported editions, where there is one.</p></div>
<div class="prod-strip">{prod_strip}</div></div></section>
{band("Have a question your data should answer?", "Intro call")}''')

# Services
tabs = "".join(f'<button role="tab" id="t-{l["id"]}" aria-controls="p-{l["id"]}" data-hash="{l["id"]}">{E(l["tab"])}</button>' for l in J.LINES)
panels = "".join(f'''<div class="tabpanel" role="tabpanel" id="p-{l["id"]}" aria-labelledby="t-{l["id"]}"><div class="svc"><div><span class="label">{E(l["tools"])}</span><h3 style="margin-top:12px">{E(l["title"])}</h3>
<p class="lede" style="font-size:18px">{E(l["line"])} {E(l["body"])}</p><ul>{"".join(f"<li>{E(d)}</li>" for d in l["does"])}</ul>
<p style="margin-top:20px" class="meta">Typical package: <b>{E(PK[l["from"]]["name"])}</b>, {PK[l["from"]]["hours"]} h × ${RATE} = <b>{price(PK[l["from"]])}</b></p></div>
<div class="fit"><div><span class="label"><b>●</b> A good fit</span><p style="margin-top:8px">{E(l["fit"])}</p></div><div class="no"><span class="label">Not a fit</span><p style="margin-top:8px">{E(l["nofit"])}</p></div>
<a class="btn red" {booking("Intro call: " + l["title"])}>Talk about {E(l["tab"].lower())} {ARROW}</a></div></div></div>''' for l in J.LINES)
opts = "".join(f'''<label class="opt"><input type="checkbox" data-name="{E(p["name"])}" data-h="{p["hours"]}" data-monthly="{1 if p["monthly"] else 0}"{" checked" if p["id"] == "dashboard" else ""}>
<span><b>{E(p["name"])}</b><span>{E(p["what"])}</span></span><em>{p["hours"]} h · {price(p)}</em></label>''' for p in J.PACKAGES)
page("services", "Services and prices · JA Insights", "Dashboards, analysis, automation and training, each with a typical package priced as hours times one published rate.",
     page_head("Services", "What JA Insights does, and what it costs.", f"Four kinds of work, one rate of ${RATE} an hour, and a quote that's the hours times the rate. Each service says who it suits and who it doesn't.") + f'''
<section class="block" style="padding-top:40px"><div class="wrap"><div class="tabs" role="tablist" aria-label="Service lines" data-tabs>{tabs}</div>{panels}</div></section>
<section class="block" id="rate-card" style="background:var(--paper-2)"><div class="wrap"><div class="block-head"><h2>Rate card</h2><p>Hours are the only number set per package. Prices are hours × ${RATE}, so you can check every one.</p></div>{rate_table()}</div></section>
<section class="block" id="estimate-block"><div class="wrap"><div class="block-head"><h2>Build an <span class="u">estimate</span>.</h2><p>Tick what you might need. The receipt adds it up the same way a real quote does.</p></div>
<div class="estimator"><div class="opts" id="estimate" data-rate="{RATE}">{opts}</div>
<div class="receipt" id="receipt" aria-live="polite"><span class="stamp">Checked</span><h4>Estimate</h4><div class="label" style="margin-bottom:12px">JA Insights · rate ${RATE}/h</div><div id="receipt-lines"></div>
<p class="small">An estimate, not a quote. The written quote after a call is built the same way, and it's fixed unless the scope changes.</p></div></div></div></section>
{band("Not sure which one fits?", "Intro call")}''')

# Free report
page("report", "Free one-page report · JA Insights", "Add a spreadsheet and get a one-page report on it in seconds. It runs in your browser; nothing is uploaded.",
     page_head("Free report", "Your data, on one page.", "Add a spreadsheet and get a one-page report in seconds: what's in it, what looks wrong, and what's worth a closer look. It runs on your device, so your file isn't uploaded, stored or seen by anyone, James included.") + f'''
<section class="block" id="report-block" style="padding-top:36px"><div class="wrap" id="report-app" data-rate="{RATE}" data-max-rows="{J.CONFIG["report_rows"]}" data-max-cols="{J.CONFIG["report_cols"]}">
<div class="intake" id="report-intake">
  <label class="drop" id="report-drop" for="report-file"><input type="file" id="report-file" class="sr-only" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls">
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 4h17l9 9v31H12z" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M29 4v9h9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 22h16M17 28h16M17 34h10" stroke="currentColor" stroke-width="2"/></svg>
    <b>Drop a CSV or Excel file here</b><span>or click to choose one · free for up to {J.CONFIG["report_rows"]:,} rows and {J.CONFIG["report_cols"]} columns</span></label>
  <div class="intake-side"><button class="btn" type="button" id="report-sample">Try it on a made-up café's sales {ARROW}</button>
    <div class="private"><span class="label"><b>●</b> Private by design</span><ul><li>Your file is read by code on this page, on your device.</li><li>Nothing is uploaded, stored or logged, and this site has no analytics.</li><li>Close the tab and it's gone.</li></ul>
    <p class="meta">Check it yourself: load this page, turn off Wi-Fi, then add your file. It still works.</p></div></div>
</div>
<p class="pack-line print-hide">Rule pack: <b id="pack-name">none</b> <label class="rec-link"><input type="file" id="report-pack" accept=".json,application/json" class="sr-only">Load a rule pack (optional)</label></p>
<p class="status-line" id="report-status" role="status"></p>
<div id="report-out" hidden></div>
</div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>What it checks</h2><p>The same first pass a Data health check starts with, done automatically. A person still reads the data in the paid version.</p></div>
<div class="cols3"><div><span class="label"><b>01</b> · Duplicates</span><h3>Rows entered twice</h3><p>Exact repeats, and the sneakier kind: the same sale under two different IDs.</p></div>
<div><span class="label"><b>02</b> · Consistency</span><h3>Gaps and spellings</h3><p>Empty cells, empty columns, numbers stored as text, and “Brickell” versus “brickell ”.</p></div>
<div><span class="label"><b>03</b> · Shape</span><h3>Trend and outliers</h3><p>The total over time with any unusual period circled, the biggest groups, and values far outside the rest.</p></div></div></div></section>''')

# Products
def product(it):
    note, now = J.PRODUCT_NOTES[it["id"]]
    ask = f'<a class="btn red small" {booking("About " + it["name"])}>{"Ask about it" if now else "Tell me when it ships"} {ARROW}</a>'
    return f'''<details class="row" id="{it["id"]}" name="products"><summary>{mark(it)}<span class="who">{E(it["name"])}<span>{E(note)}</span></span><span class="lead">{E(it["paid"])}</span><span class="chev" aria-hidden="true"></span></summary>
<div class="row-body"><p>{E(it["detail"])}</p><div class="tiers"><div class="tier"><span class="label">Free · jebyLabs</span><p>{E(it["open"])}</p></div>
<div class="tier paid"><span class="label"><b>●</b> Paid · JA Insights</span><p>{E(it["paid"])}</p></div></div>
<div class="row-links">{ask}<a class="btn small" data-x="jeby" data-p="lab.html#{it["id"]}">Free version at jebyLabs {ARROW}</a></div></div></details>'''
free_only = ", ".join(E(it["name"]) for it in ALL_PROJECTS if not it.get("jai"))
page("products", "Products · JA Insights", "Paid, hosted and supported editions of James Eby's open projects. The free editions live at jebyLabs on jeby.us.",
     page_head("Products", "Paid editions of open projects.", "Each of these starts as a free, open project at jebyLabs. The paid edition adds what costs money to run: hosting, curated data, support and time. Only what's marked “now” is for sale today.") + f'''
<section class="block" style="padding-top:40px"><div class="wrap"><div class="rows">{"".join(product(it) for it in PRODUCTS)}</div>
<p style="margin-top:22px;color:var(--muted)">Free only, with no paid edition: {free_only}. They're at <a data-x="jeby" data-p="lab.html">jebyLabs</a>.</p></div></section>
{band("Want one of these before it ships?", "Product interest")}''')

# Approach
principles = "".join(f"<div><b>{E(t)}</b><p>{E(d)}</p></div>" for t, d in J.PRINCIPLES)
mk = "".join(f"<tr><td>{E(a)}</td><td>{E(b)}/h</td></tr>" for a, b in J.MARKET["rows"])
faq = "".join(f'<details class="row plain" name="faq"><summary><span class="who">{E(q)}</span><span class="chev" aria-hidden="true"></span></summary><div class="row-body"><p>{E(a)}</p></div></details>' for q, a in J.FAQ)
src_t, src_u = J.MARKET["source"]
page("approach", "Approach and pricing · JA Insights", "How JA Insights works and prices: one published rate, quotes built from hours, sources shown, and you own the work.",
     page_head("Approach", "How the work is done, and how it's priced.", "Six rules that don't change from project to project, the process, and the rate next to what the market charges.") + f'''
<section class="block" style="padding-top:40px"><div class="wrap"><div class="grid3">{principles}</div></div></section>
<section class="block" style="background:var(--paper-2)"><div class="wrap"><div class="block-head"><h2>The process</h2><p>Nothing is billed before you approve a written quote.</p></div>{steps()}</div></section>
<section class="block" id="pricing"><div class="wrap rate"><div class="bigrate"><span class="label">Pricing, compared</span><b>${RATE}<small> / hour</small></b>
<p>Above freelance generalists, below regional consultancies. You get a senior analyst for every hour, and no account manager in between.</p></div>
<div><table class="card"><thead><tr><th>Who</th><th>Typical rate</th></tr></thead><tbody>{mk}<tr><td><b>JA Insights</b></td><td><b>${RATE}/h</b></td></tr></tbody></table>
<p style="margin-top:14px;color:var(--muted);font-size:14px">Market ranges from <a href="{src_u}" target="_blank" rel="noopener">{E(src_t)}</a>, which also puts a single dashboard at {E(J.MARKET["dash"])} and {E(J.MARKET["smb"])}. JA Insights' versions: {price(PK["dashboard"])} and {price(PK["bisetup"])}.</p></div></div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>Questions people ask</h2><p>Straight answers. If yours isn't here, ask it on the call.</p></div><div class="rows">{faq}</div></div></section>
{band("Ready when you are.", "Intro call")}''')

# About
kv = "".join(f"<dt>{E(a)}</dt><dd>{E(b)}</dd>" for a, b in J.ABOUT["facts"])
fname, fbio = J.ABOUT["founder"]
fam = [("jeby.us", "James's own site: work history, teaching, research and the person behind it.", "jeby", "index.html"),
       ("jebyLabs", "The free, open editions of every project, on jeby.us.", "jeby", "lab.html"),
       ("jeby Real Estate", "Real-estate work in Miami Springs and Virginia Gardens, and the home of jRE.", None, None)]
famc = "".join(f'<div><span class="label">Family</span><h3>{E(n)}</h3><p>{E(d)}</p>' + (f'<a data-x="{x}" data-p="{p}">Visit {E(n)} {ARROW}</a>' if x else '<span class="meta">Site coming</span>') + "</div>" for n, d, x, p in fam)
page("about", "About · JA Insights", "JA Insights is a one-person data consultancy in Miami, run by statistician James Eby.",
     page_head("About", "A small practice, on purpose.", J.ABOUT["lede"] + " You talk to the person doing the work, from the first call to the handover.") + f'''
<section class="block" style="padding-top:40px"><div class="wrap"><div class="founder"><div class="mono-avatar" aria-hidden="true">JE</div><div><span class="label">Founder</span><h3 style="margin-top:8px">{E(fname)}</h3><p>{E(fbio)}</p>
<div class="cta" style="margin-top:18px"><a class="btn" data-x="jeby" data-p="about.html">Read James's story on jeby.us {ARROW}</a><a class="btn" data-x="jeby" data-p="professional.html">Work history</a></div></div></div></div></section>
<section class="block" style="padding-top:8px"><div class="wrap"><div class="block-head"><h2>The practice</h2><p>The facts, in one place.</p></div><dl class="kv">{kv}</dl></div></section>
<section class="block"><div class="wrap"><div class="block-head"><h2>Part of the jeby family</h2><p>Three names, one person, one way of working.</p></div><div class="cols3">{famc}</div></div></section>''')

# Contact
page("contact", "Contact · JA Insights", "Book a free 30-minute intro call with JA Insights, or send a note.",
     page_head("Contact", "Start with a 30-minute call.", "Free, with no pitch. You'll leave knowing whether this is the right fit, and roughly what it would cost.") + f'''
<section class="block" style="padding-top:40px"><div class="wrap estimator"><div>
<form class="opts" id="note" onsubmit="return false"><span class="label">Write a note · it opens in your email app</span>
<label class="opt" style="grid-template-columns:1fr;cursor:text"><span><b>Your name</b></span><input name="n" autocomplete="name" style="width:100%;font:inherit;padding:10px;border:1px solid var(--rule-2);border-radius:4px"></label>
<label class="opt" style="grid-template-columns:1fr;cursor:text"><span><b>What do you need?</b><span>A sentence is plenty.</span></span><textarea name="m" rows="4" style="width:100%;font:inherit;padding:10px;border:1px solid var(--rule-2);border-radius:4px"></textarea></label>
<button class="btn red" type="button" data-compose="{EMAIL}">Open in my email app {ARROW}</button>
<p style="color:var(--muted);font-size:14px">Nothing is sent from this page. Your email app opens with the note filled in, and you decide whether to send it.</p></form></div>
<div class="fit"><div><span class="label"><b>●</b> Book</span><p style="margin-top:8px">Pick a time for a free 30-minute video call.</p><p style="margin-top:12px"><a class="btn red small" {booking("Intro call")}>Book a call {ARROW}</a></p></div>
<div><span class="label">Email</span><p style="margin-top:8px"><a href="#" data-copy-email="{EMAIL}">{EMAIL}</a> · a reply within one business day.</p></div>
<div class="no"><span class="label">Helpful to have</span><p style="margin-top:8px">Where your data lives, who uses the numbers, and the decision you're trying to make. No files needed yet.</p></div></div></div></section>''')

# assets
S2 = ROOT.parent / "jeby" / "out" / "assets"; FAM = ROOT.parent / "family"
shutil.copy(ROOT / "src" / "jai.css", OUT / "assets" / "jai.css"); shutil.copy(ROOT / "src" / "jai.js", OUT / "assets" / "jai.js"); shutil.copy(ROOT / "src" / "report.js", OUT / "assets" / "report.js"); shutil.copy(ROOT / "src" / "records.js", OUT / "assets" / "records.js"); shutil.copy(ROOT / "src" / "domain.js", OUT / "assets" / "domain.js"); shutil.copy(ROOT / "src" / "pack.js", OUT / "assets" / "pack.js"); shutil.copy(ROOT / "src" / "rules.js", OUT / "assets" / "rules.js"); shutil.copy(ROOT / "src" / "shape.js", OUT / "assets" / "shape.js"); shutil.copy(ROOT / "src" / "report-worker.js", OUT / "assets" / "report-worker.js")
shutil.copytree(ROOT / "packs", OUT / "assets" / "packs")
shutil.copy(FAM / "family.js", OUT / "assets" / "family.js")
for f in ("plantriloquist.png", "musicalgames.svg", "lighting-lab.svg", "desk.svg"): shutil.copy(S2 / f, OUT / "assets" / f)
BR.copy_assets(OUT / "assets")
shutil.copy(OUT / "assets" / "brand" / "jai-monogram-light.svg", OUT / "assets" / "favicon.svg")  # for anything that asks for /assets/favicon.svg
(OUT / "CNAME").write_text("jainsights.com\n", encoding="utf-8")
(OUT / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: https://jainsights.com/sitemap.xml\n", encoding="utf-8")
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    "".join(f"<url><loc>https://jainsights.com/{'' if k == 'index' else k}</loc></url>" for k in ("index", "services", "report", "products", "approach", "about", "contact")) + "</urlset>", encoding="utf-8")
print("built", sorted(p.name for p in OUT.glob("*.html")))
