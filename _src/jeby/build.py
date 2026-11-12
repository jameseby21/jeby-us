"""Builds jeby.us as a small static multi-page site.  out/ is what goes to GitHub Pages; artifact/ is the preview."""
import html, json, pathlib, re, shutil, sys
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))
import content as C
sys.path.insert(0, str(ROOT.parent / "brand"))
import brand as BR  # marks.json: the cycling rule's candidates
BR.check_coverage([i["id"] for g in C.LAB for i in g["items"]])

OUT = ROOT / "out"; ART = ROOT / "artifact"
for d in (OUT, ART): shutil.rmtree(d, ignore_errors=True); (d / "assets").mkdir(parents=True, exist_ok=True)
E = html.escape
RS = ROOT.parent / "research" / "src"; ST = ROOT / "static"; FAM = ROOT.parent / "family"

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,0..100,0..1;1,9..144,300..700,0..100,0..1'
         '&family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=Geist+Mono:wght@400..600&display=swap">')
PAGES = [("professional", "Professional"), ("teach", "Teach"), ("lab", "Lab"), ("research", "Research"), ("about", "About")]

ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>'
ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>'
ICON_LI = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>'
ICON_GH = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>'
ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>'
ARROW = '<span class="arrow" aria-hidden="true">→</span>'
ICON_IG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'
ICON_REPORT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 17l2.5-3 2 2L17 11"/></svg>'

def booking(subject):
    b = C.CONFIG["booking"]; url = b.get(b["provider"]) if b["provider"] != "email" else ""
    if url: return f'href="{E(url)}" target="_blank" rel="noopener"'
    return f'href="mailto:{C.CONFIG["email"]}?subject={E(subject)}" data-email="{C.CONFIG["email"]}" data-subject="{E(subject)}"'

def header(active):
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'<a href="{k}.html"{cur(k)}>{n}</a>' for k, n in PAGES)
    links = links.replace('<a href="research.html"', '<a data-x="jai" data-p="index.html" data-family-only="A">Insights</a><a href="research.html"', 1)
    links += '<a data-x="jai" data-p="index.html" data-family-only="B">JA Insights ↗</a>'
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="wordmark" href="index.html" aria-label="jeby.us, home"><span class="j">ȷ<i></i></span>eby</a>
  <nav class="nav" aria-label="Main">{links}</nav>
  <div class="head-actions">
    <button class="icon-btn" type="button" data-theme-toggle aria-label="Switch between dark and light">{ICON_SUN}</button>
    <button class="icon-btn menu-btn" type="button" popovertarget="navpop" aria-label="Open menu">{ICON_MENU}</button>
  </div>
  <div id="navpop" class="nav-pop" popover><a href="index.html"{cur("home")}>Home</a>{links}</div>
</div></header>'''

def footer():
    site = "".join(f'<li><a href="{k}.html">{n}</a></li>' for k, n in PAGES)
    return f'''<footer class="site-footer"><div class="wrap">
  <div><p class="sig">No trackers and no pop-ups. Just pages.</p><small>© <span data-year>2026</span> James Eby · Miami, FL</small></div>
  <div><h3>Site</h3><ul><li><a href="index.html">Home</a></li>{site}</ul></div>
  <div><h3>Free</h3><ul><li><a data-x="jai" data-p="report.html">Data report</a></li><li><a href="qr.html">Dog QR prompt</a></li><li><a href="lab.html">Open-source projects</a></li></ul></div>
  <div><h3>Elsewhere</h3><ul><li><a href="{C.CONFIG["instagram"]}" target="_blank" rel="noopener">Instagram</a></li><li><a href="{C.CONFIG["linkedin"]}" target="_blank" rel="noopener">LinkedIn</a></li><li><a href="{C.CONFIG["github"]}" target="_blank" rel="noopener">GitHub</a></li>{f'<li><a href="{C.CONFIG["youtube"]}" target="_blank" rel="noopener">YouTube</a></li>' if C.CONFIG["youtube"] else ""}<li><a href="#" data-copy-email="{C.CONFIG["email"]}">Email</a></li></ul></div>
  <div><h3>Family</h3><ul><li><a data-x="jai" data-p="index.html">JA Insights</a> <span class="muted">· data consulting</span></li><li><a href="lab.html">jebyLabs</a> <span class="muted">· open source</span></li><li>jeby Real Estate</li><li>jeby Industries</li></ul></div>
</div></footer>'''

PERSON = {"@context": "https://schema.org", "@type": "Person", "name": "James Eby", "alternateName": "jeby", "url": "https://jeby.us/",
          "jobTitle": "Business intelligence leader and data scientist", "description": "Statistician in Miami, FL.",
          "address": {"@type": "PostalAddress", "addressLocality": "Miami", "addressRegion": "FL", "addressCountry": "US"},
          "alumniOf": {"@type": "CollegeOrUniversity", "name": "Carnegie Mellon University"}, "knowsLanguage": ["en", "es"],
          "sameAs": [C.CONFIG["instagram"], C.CONFIG["linkedin"], C.CONFIG["github"]]}

def page(key, title, desc, body, extra_head="", extra_js="", artifact=False):
    head = f'''<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta name="theme-color" content="#0c0b0a">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:image" content="https://jeby.us/og.png"><meta property="og:url" content="https://jeby.us/{'' if key=='home' else key}">
<meta name="twitter:card" content="summary_large_image">
{BR.favicon_links("jeby", default_theme="dark")}
{FONTS}
<link rel="stylesheet" href="assets/site.css">
{extra_head}
<script type="speculationrules">{{"prerender":[{{"where":{{"href_matches":"/*"}},"eagerness":"moderate"}}]}}</script>'''
    if key == "home": head += f'\n<script type="application/ld+json">{json.dumps(PERSON)}</script>'
    bodyhtml = f'{header(key)}\n<main id="main">{body}</main>\n{footer()}\n<script src="assets/site.js" defer></script><script src="assets/brand.js" defer></script><script src="assets/family.js" data-site="jeby" defer></script>{extra_js}'
    if artifact:
        return f'{head}\n<meta name="claude:viewport-fit-sides" content="cover">\n<div data-page="{key}" class="artifact-body">{bodyhtml}</div><script>document.body.dataset.page="{key}"</script>'
    return f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n{head}\n</head>\n<body data-page="{key}">\n{bodyhtml}\n</body>\n</html>\n'

# ---------------------------------------------------------------- shared bits
drew_src = (ST / "drew-tongue.svg").read_text(encoding="utf-8")
drew_svg = re.sub(r"<style>.*?</style>", "", drew_src, flags=re.S).replace('class="tongue"', 'class="tongue-anim"').replace('id="mouth"', 'id="drew-mouth"').replace("url(#mouth)", "url(#drew-mouth)")
drew_svg = re.sub(r'<svg ([^>]*?) width="512" height="504"', r'<svg \1', drew_svg).replace("<title>Drew sticking his tongue out</title>", "")
DREW = '<div class="drew-photo"><img src="assets/james-drew-600.jpg" alt="Drew, a black Scottish Terrier, in James&#39;s arms in a Miami backyard" width="600" height="750" loading="lazy"></div>'

def mark(item):
    t = BR.tile(item["id"], themed=True)
    if t:
        return t
    if item.get("mark_img"):
        return f'<span class="mark" style="background:#0b0b0f"><img src="assets/{item["mark_img"]}" alt=""></span>'
    return f'<span class="mark" style="background:{item["accent"]}">{E(item["mark"])}</span>'

MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
fmt = lambda d: f"{MON[d[1]-1]} {d[0]}" if d else "Present"

def rows(items, name=None):
    out = []
    for e in items:
        nm = f' name="{name}"' if name else ""
        out.append(f'''<details class="row"{nm}><summary><span class="who">{E(e["org"])}<span>{E(e["title"])}</span></span><span class="lead">{E(e["lead"])}</span><span class="when">{fmt(e["start"])} – {fmt(e["end"])}</span><span class="chev" aria-hidden="true"></span></summary>
<div class="row-body"><div><ul>{"".join(f"<li>{E(b)}</li>" for b in e["bullets"])}</ul><div class="chips">{"".join(f'<span class="chip">{E(t)}</span>' for t in e["tags"])}</div></div></div></details>''')
    return f'<div class="rows">{"".join(out)}</div>'

# ---------------------------------------------------------------- home
def free_strip(title="Free things"):
    return f'''<section class="wrap free-strip" aria-labelledby="free-h">
  <div class="free-head"><div class="eyebrow" id="free-h"><b>●</b> {title}</div></div>
  <div class="free-grid">
    <a class="free-card" data-x="jai" data-p="report.html"><span class="free-ico" aria-hidden="true">{ICON_REPORT}</span><span><b>A one-page report on your data</b><small>Drop in a spreadsheet. It never leaves your browser.</small></span>{ARROW}</a>
    <a class="free-card" href="qr.html"><span class="free-ico qr" aria-hidden="true"><img src="drew-qr.png" alt=""></span><span><b>The dog QR prompt</b><small>How I turned Drew into a QR code that scans.</small></span>{ARROW}</a>
    <a class="free-card" href="lab.html"><span class="free-ico marks-mini" aria-hidden="true">{"".join(mark(i) for g in C.LAB for i in g["items"][:1])}</span><span><b>{sum(len(g["items"]) for g in C.LAB)} open projects</b><small>Every one has a free version.</small></span>{ARROW}</a>
  </div>
</section>'''

stars = "".join(f'<circle cx="{(i*73)%400}" cy="{(i*131)%300}" r="{0.6 + (i%5)*0.35}" fill="{["#eeecf2","#4084ff","#ff2b3d"][i%7==0 and 2 or (i%5==0 and 1) or 0]}" opacity="{0.25 + (i%4)*0.18:.2f}"/>' for i in range(90))
home = f'''
<section class="hero wrap">
  <div class="eyebrow">Miami, FL</div>
  <h1 class="page-title">James <span style="white-space:nowrap"><em>Eby</em><span class="dot-slot" aria-hidden="true"></span></span></h1>
  <ul class="disciplines" aria-label="Some of what I spend time on">{"".join(f'<li><a href="{E(h)}">{E(d)}</a></li>' for d, h in C.DISCIPLINES)}</ul>
  <p class="lede">{E(C.HERO)}</p>
  <p class="hero-work">Work: <a href="professional.html">Professional</a> · <a data-x="jai" data-p="index.html">JA Insights</a> · <a href="teach.html">Teach</a></p>
</section>
{free_strip()}
<section class="wrap block" aria-label="Start here">
  <div class="bento">
    <div class="tile span-7 about-tile">
      <picture class="me"><img src="assets/james-drew-600.jpg" srcset="assets/james-drew-600.jpg 600w, assets/james-drew.jpg 1000w" sizes="(max-width:640px) 90vw, 280px" alt="James holding Drew, his black Scottish Terrier, in a Miami backyard" width="600" height="750" loading="lazy"></picture>
      <div class="about-text"><div class="eyebrow">About</div>
      <h2>Hi, I'm James.</h2>
      <p>{E(C.ABOUT_SHORT)}</p>
      <dl class="facts">{"".join(f"<dt>{E(a)}</dt><dd>{E(b)}</dd>" for a, b in C.FACTS)}</dl>
      <a class="go" href="about.html">More about me {ARROW}</a></div>
    </div>
    <div class="tile span-5 drew-tile">
      <div class="eyebrow">{E(C.DREW["role"])}</div>
      {DREW}
      <h2>{E(C.DREW["title"])}</h2>
      <p>{E(C.DREW["short"])}</p>
    </div>
    <div class="tile span-4 work-tile">
      <div class="eyebrow">Work</div>
      <h3>Kept on its own pages.</h3>
      <ul class="work-links">
        <li><a href="professional.html"><b>Professional</b><span>Experience and résumé</span>{ARROW}</a></li>
        <li><a data-x="jai" data-p="index.html"><b>JA Insights</b><span>Data consulting</span>{ARROW}</a></li>
        <li><a href="teach.html"><b>Teach</b><span>Tutoring and mentorship</span>{ARROW}</a></li>
      </ul>
    </div>
    <a class="tile span-8" href="lab.html">
      <div class="eyebrow">Lab</div>
      <h3>Things I build in my spare time</h3>
      <p>A real-estate database, a band game, keyboard lighting, a houseplant that heckles people. Each one has a free version.</p>
      <div class="marks">{"".join(mark(i) for g in C.LAB for i in g["items"] if i["id"] != "jebyus")}</div>
      <span class="go">All {sum(len(g["items"]) for g in C.LAB)} projects {ARROW}</span>
    </a>
    <a class="tile span-12 research-tile" href="research.html">
      <svg class="starfield" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{stars}</svg>
      <div class="eyebrow">Research · Carnegie Mellon, 2015</div>
      <h3 style="max-width:18ch">Weighing galaxy clusters by how their galaxies move</h3>
      <p style="max-width:52ch">My undergraduate poster, rebuilt so the figures move. The short version: the standard calibration counted each cluster about ten times.</p>
      <span class="go">Open the slideshow {ARROW}</span>
    </a>
  </div>
</section>
<section class="wrap block" aria-labelledby="now-h">
  <div class="block-head"><div><div class="eyebrow">November 2026</div><h2 id="now-h">Now</h2></div></div>
  <ul class="now">{"".join(f'<li><b>{E(a)}</b><span>{E(b)} <a class="now-go" href="{l}" aria-label="{E(a)}: more">{ARROW}</a></span></li>' for a, b, l in C.NOW)}</ul>
</section>'''

# ---------------------------------------------------------------- professional
timeline = []
for e in C.EXPERIENCE: timeline.append({**e, "kind": "teaching" if e["id"] == "codekids" else "work"})
for e in C.VENTURES: timeline.append({**e, "kind": "venture" if e["id"] in ("jre", "jai") else "project"})
email = C.CONFIG["email"]
pdf_btn = f'<a class="btn small" href="{C.CONFIG["resume_pdf"]}" download>Résumé PDF</a>' if C.CONFIG["resume_pdf"] else ""
sheet_jobs = lambda items: "".join(f'<div class="job"><div class="l1"><b>{E(e["org"])}</b><span>{fmt(e["start"])} – {fmt(e["end"])}</span></div><div class="l2">{E(e["title"])}</div><ul>{"".join(f"<li>{E(b)}</li>" for b in e["bullets"])}</ul></div>' for e in items)
pro = f'''
<section class="wrap page-head">
  <div class="eyebrow">Professional</div>
  <h1 class="page-title">{E(C.PRO["headline"])}</h1>
  <p class="lede">{E(C.PRO["summary"])}</p>
  <div class="actions">
    <a class="btn solid" href="#" data-copy-email="{email}">{ICON_MAIL} Email me</a>
    <a class="btn" href="{C.CONFIG["linkedin"]}" target="_blank" rel="noopener">{ICON_LI} LinkedIn</a>
    <a class="btn" href="{C.CONFIG["github"]}" target="_blank" rel="noopener">{ICON_GH} GitHub</a>{pdf_btn}
  </div>
</section>
<section class="wrap"><div class="stats">{"".join(f"<div><b>{E(a)}</b><span>{E(b)}</span></div>" for a, b in C.PRO["stats"])}</div></section>
<section class="wrap block">
  <div class="sticky-tabs"><div class="tabs" role="tablist" data-tabs aria-label="Professional">
    <button role="tab" data-hash="experience" aria-controls="p-exp" id="t-exp">Experience</button>
    <button role="tab" data-hash="timeline" aria-controls="p-tl" id="t-tl">Timeline</button>
    <button role="tab" data-hash="resume" aria-controls="p-res" id="t-res">Résumé</button>
    <button role="tab" data-hash="skills" aria-controls="p-sk" id="t-sk">Skills and education</button>
  </div></div>
  <div class="tabpanel" role="tabpanel" id="p-exp" aria-labelledby="t-exp">
    <p class="muted" style="margin-bottom:18px">One line per role. Open any of them for the detail.</p>
    {rows(C.EXPERIENCE)}
    <h2 class="group-title">Ventures and projects</h2>
    {rows(C.VENTURES)}
  </div>
  <div class="tabpanel" role="tabpanel" id="p-tl" aria-labelledby="t-tl" hidden>
    <div class="tl-filters" role="group" aria-label="Filter timeline">
      <button type="button" data-k="all" aria-pressed="true">Everything</button><button type="button" data-k="work" aria-pressed="false">Employment</button>
      <button type="button" data-k="venture" aria-pressed="false">Founded</button><button type="button" data-k="project" aria-pressed="false">Projects</button><button type="button" data-k="teaching" aria-pressed="false">Teaching</button>
    </div>
    <div class="tl" id="tl"></div>
  </div>
  <div class="tabpanel" role="tabpanel" id="p-res" aria-labelledby="t-res" hidden>
    <article class="sheet" aria-label="Résumé">
      <header><div class="nm">James David Eby</div><div class="sub">Business Intelligence · Data Science · Analytics Leadership</div>
        <div class="contacts"><span>Miami, FL</span><span data-email="{email}" data-show>{email}</span><a href="https://jeby.us">jeby.us</a><a href="{C.CONFIG["linkedin"]}">linkedin.com/in/jeby-d</a></div></header>
      <h4>Summary</h4><p>{E(C.PRO["summary"])}</p>
      <h4>Experience</h4>{sheet_jobs(C.EXPERIENCE)}
      <h4>Ventures and projects</h4>{sheet_jobs(C.VENTURES)}
      <h4>Skills</h4><dl>{"".join(f"<dt>{E(a)}</dt><dd>{E(b)}</dd>" for a, b in C.SKILLS)}</dl>
      <h4>Education and teaching</h4><div class="job"><div class="l1"><b>{E(C.EDUCATION["school"])}</b><span>{C.EDUCATION["year"]}</span></div><div class="l2">{E(C.EDUCATION["degree"])}</div>
        <p>Coursework: {E(C.EDUCATION["coursework"])}</p><p>{E(C.EDUCATION["teaching"])}</p></div>
      <h4>Awards and activities</h4><ul>{"".join(f"<li>{E(a)}</li>" for a in C.AWARDS)}</ul>
    </article>
  </div>
  <div class="tabpanel" role="tabpanel" id="p-sk" aria-labelledby="t-sk" hidden>
    <div class="rows">{"".join(f'<div class="lab-item" style="grid-template-columns:160px minmax(0,1fr)"><b>{E(a)}</b><div class="chips" style="margin:0">{"".join(f"<span class=chip>{E(x.strip())}</span>" for x in b.split(","))}</div></div>' for a, b in C.SKILLS)}</div>
    <h2 class="group-title">Education</h2>
    <div class="lab-item" style="grid-template-columns:minmax(0,1fr) auto"><div><b>{E(C.EDUCATION["school"])}</b><p>{E(C.EDUCATION["degree"])}. {E(C.EDUCATION["teaching"])}</p></div><span class="status">{C.EDUCATION["year"]}</span></div>
    <h2 class="group-title">Awards and activities</h2>
    <div class="rows">{"".join(f'<div class="lab-item" style="grid-template-columns:minmax(0,1fr)"><p style="margin:0;color:var(--fg)">{E(a)}</p></div>' for a in C.AWARDS)}</div>
  </div>
</section>
<section class="wrap block"><div class="callout"><div><div class="eyebrow">Hiring</div><h3>Building or rebuilding an analytics team?</h3></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn solid" href="#" data-copy-email="{email}">{ICON_MAIL} Email me</a><a class="btn" href="{C.CONFIG["linkedin"]}" target="_blank" rel="noopener">{ICON_LI} LinkedIn</a></div></div></section>'''

# ---------------------------------------------------------------- teach
def price_table(rows_): return '<table class="price"><tbody>' + "".join(f"<tr><td>{E(a)}</td><td>{E(b)}</td></tr>" for a, b in rows_) + "</tbody></table>"
subjects = "".join(f'''<details class="row compact" name="subject"{" open" if i == 0 else ""}><summary><span class="who">{E(s["name"])}<span>{E(s["scope"])}</span></span><span class="when">{E(s["rows"][1][1].split(" ")[0])}/hr</span><span class="chev" aria-hidden="true"></span></summary>
<div class="row-body" style="grid-template-columns:1fr"><div style="grid-column:1">{price_table(s["rows"])}<p class="note">{E(s["note"])}</p><div style="margin-top:16px"><a class="btn small solid" {booking("Trial lesson: " + s["name"])}>Book a {s["rows"][0][0].lower()} {ARROW}</a></div></div></div></details>''' for i, s in enumerate(C.TUTORING))
packages = lambda items: '<div class="packages">' + "".join(f'<div class="pkg"><b>{E(a)}</b><em>{E(b)}</em><span>{E(c)}</span></div>' for a, b, c in items) + "</div>"
teach = f'''
<section class="wrap page-head">
  <div class="eyebrow">Teach</div>
  <h1 class="page-title">Tutoring in math, statistics and data.</h1>
  <p class="lede">One-on-one, online or in Miami, in English or Spanish. Every subject starts with a short, cheap trial lesson, so you find out whether we work well together before you pay for more.</p>
  <div class="actions"><a class="btn solid" {booking("Free 20-minute intro")}>Book a free 20-minute intro {ARROW}</a><a class="btn" href="#faq">Questions first</a></div>
</section>
<section class="wrap block">
  <div class="sticky-tabs"><div class="tabs" role="tablist" data-tabs aria-label="Offers">
    <button role="tab" data-hash="tutoring" aria-controls="o-tut" id="ot-tut">Tutoring</button>
    <button role="tab" data-hash="mentorship" aria-controls="o-men" id="ot-men">First-job mentorship</button>
    <button role="tab" data-hash="resumes" aria-controls="o-res" id="ot-res">Résumé services</button>
  </div></div>
  <div class="tabpanel" role="tabpanel" id="o-tut" aria-labelledby="ot-tut"><div class="offer-grid">
    <div class="why">
      <div><b>790 on SAT Math, a statistics degree from Carnegie Mellon</b><span>Good scores don't make a good tutor, but they do mean I won't be learning it alongside you.</span></div>
      <div><b>Six years of using it at work</b><span>So when someone asks what this is for, there's a real answer.</span></div>
      <div><b>English or Spanish</b><span>We stay on a topic until it clicks, in whichever language it clicks in. Clases en español.</span></div>
      <p class="note">Launch offer: 25% off for the first five students in each subject, in exchange for an honest written review.</p>
    </div>
    <div>{'<div class="rows">' + subjects + '</div>'}</div>
  </div></div>
  <div class="tabpanel" role="tabpanel" id="o-men" aria-labelledby="ot-men" hidden><div class="offer-grid">
    <div class="why">
      <div><b>From someone who has hired for the job</b><span>I founded two analytics teams and mentored the analysts in them. I interview for Director roles myself, so the advice is current.</span></div>
      <div><b>A portfolio that exists</b><span>You build one real project on public data, the kind interviewers ask about.</span></div>
      <div><b>Honest outcomes</b><span>Better interviews and a referral when you've earned it. No job guarantee, because nobody can honestly give one.</span></div>
    </div>
    <div>{packages(C.MENTORSHIP)}<div style="margin-top:20px"><a class="btn solid" {booking("Mentorship strategy call")}>Book a strategy call {ARROW}</a></div></div>
  </div></div>
  <div class="tabpanel" role="tabpanel" id="o-res" aria-labelledby="ot-res" hidden><div class="offer-grid">
    <div class="why">
      <div><b>Written the way hiring managers read</b><span>What you did and the number it moved, in words screening software can parse.</span></div>
      <div><b>Checked against the screening software</b><span>Every draft goes through a text-extraction check, so nothing important gets lost.</span></div>
      <div><b>Any field, any level</b><span>Tech and data roles are my specialty, but the method works anywhere.</span></div>
    </div>
    <div>{packages(C.RESUME_SERVICES)}<div style="margin-top:20px"><a class="btn solid" {booking("Résumé services")}>Start with a tune-up {ARROW}</a></div></div>
  </div></div>
</section>
<section class="wrap block" id="faq" aria-labelledby="faq-h">
  <div class="block-head"><h2 id="faq-h">Questions</h2></div>
  <div class="rows">{"".join(f'<details class="row faq" name="faq"><summary><span class="who">{E(q)}</span><span class="chev" aria-hidden="true"></span></summary><div class="row-body" style="grid-template-columns:1fr"><div style="grid-column:1"><p class="muted" style="color:var(--fg-2)">{E(a)}</p></div></div></details>' for q, a in C.FAQ)}</div>
</section>
<section class="wrap block"><div class="callout"><div><div class="eyebrow">Not sure where to start?</div><h3>Book a free 20-minute intro.</h3></div><a class="btn solid" {booking("Free 20-minute intro")}>Book the intro {ARROW}</a></div></section>'''

# ---------------------------------------------------------------- lab
def lab_item(it):
    links = []
    if it.get("page"): links.append(f'<a class="btn small" href="{it["page"]}">Open {ARROW}</a>')
    if it["code"]: links.append(f'<a class="btn small" href="{it["code"]}" target="_blank" rel="noopener">{ICON_GH} Code</a>')
    else: links.append('<span class="status">Code private for now</span>')
    if it["jai"]: links.append(f'<a class="btn small solid" data-x="jai" data-p="products.html#{it["jai"]}">Paid version at JA Insights {ARROW}</a>')
    tiers = f'''<div class="tiers"><div class="tier"><span class="eyebrow">Free · jebyLabs</span><p>{E(it["open"])}</p></div>
      <div class="tier{" paid" if it["paid"] else " none"}"><span class="eyebrow">Paid · JA Insights</span><p>{E(it["paid"] or "No paid version planned")}</p></div></div>'''
    return f'''<details class="row lab-row" id="{it["id"]}"><summary>{mark(it)}<span class="who">{E(it["name"])}<span>{E(it["status"])}</span></span><span class="lead">{E(it["line"])}</span><span class="chev" aria-hidden="true"></span></summary>
<div class="row-body lab-body"><div><p>{E(it["detail"])}</p><div class="chips">{"".join(f'<span class="chip">{E(t)}</span>' for t in it["stack"])}</div>{tiers}<div class="lab-links">{"".join(links)}</div></div></div></details>'''
groups = "".join(f'''<section class="lab-group"><h2 class="group-title">{E(g["group"])} · {len(g["items"])}</h2><div class="rows">{"".join(lab_item(it) for it in g["items"])}</div></section>''' for g in C.LAB)
nproj = sum(len(g["items"]) for g in C.LAB)
lab = f'''
<section class="wrap page-head">
  <div class="eyebrow">Lab</div>
  <h1 class="page-title">Every project, open by default.</h1>
  <p class="lede">{nproj} projects across data, games, hardware and tools. Each one gets a free version under jebyLabs, and where it makes sense, a supported paid version through <a data-x="jai" data-p="products.html">JA Insights</a>. Open any row for the details.</p>
  <div class="actions"><a class="btn" href="{C.CONFIG["github"]}" target="_blank" rel="noopener">{ICON_GH} All code on GitHub</a></div>
</section>
<section class="wrap block">{groups}</section>'''

# ---------------------------------------------------------------- research
research = f'''
<section class="wrap page-head">
  <div class="eyebrow">Research · Carnegie Mellon University, 2015</div>
  <h1 class="page-title">Predicting the masses of galaxy clusters.</h1>
  <p class="lede">My 2015 undergraduate poster at Carnegie Mellon, rebuilt so the figures move. The short version: the standard calibration counted each cluster about ten times, and counting each one honestly makes clusters a few percent lighter.</p>
</section>
<section class="wrap block" style="padding-top:0">{(RS / "section.html").read_text(encoding="utf-8")}</section>'''

# ---------------------------------------------------------------- story and support
def story_html():
    chs = []
    for c in C.STORY["chapters"]:
        extra = ""
        if c.get("break"):
            if C.HEALTH_DETAIL: extra += f"<p>{E(C.HEALTH_DETAIL)}</p>"
            elif C.PREVIEW_SLOTS: extra += '<p class="slot">Your words, if you want them here: what you\'re living with, in as much or as little detail as you like. Leave it empty and this box disappears.</p>'
            extra += f'<p class="turn">{E(c["after"])}</p>'
        chs.append(f'<li class="ch{" break" if c.get("break") else ""}"><span class="when">{E(c["when"])}</span><h3>{E(c["head"])}</h3><p>{E(c["body"])}</p>{extra}</li>')
    return f'''<section class="wrap block" id="story" aria-labelledby="story-h"><div class="story-grid">
  <div class="story-side"><div class="eyebrow">{E(C.STORY["title"])}</div><h2 id="story-h">How I got here, in five parts.</h2><p>The short version. If it lands with you, the end says how to help.</p></div>
  <ol class="story"><span class="runner" aria-hidden="true"></span>{"".join(chs)}</ol></div></section>'''

def support_html():
    pills = []
    for name, url in C.SUPPORT["providers"]:
        if url: pills.append(f'<a class="btn small" href="{E(url)}" target="_blank" rel="noopener">{E(name)}</a>')
        elif C.PREVIEW_SLOTS: pills.append(f'<span class="btn small pending" title="Not set up yet">{E(name)} · setting up</span>')
    sponsor = f'<li class="wide"><b>Sponsor the open work</b><span>Monthly or once, any amount.</span><div class="help-act">{"".join(pills)}</div></li>' if pills else ""
    return f'''<section class="wrap block" id="support" aria-labelledby="support-h"><div class="support">
  <div class="support-head"><div class="eyebrow">If this landed with you</div><h2 id="support-h">Four ways to help, from free to paid.</h2><p>{E(C.SUPPORT["note"])}</p></div>
  <ol class="help">
    <li><b>Share the story</b><span>It's free, and it helps the most.</span><div class="help-act"><button class="btn small solid" type="button" data-share="{E(C.SUPPORT["share_url"])}" data-title="James Eby: the story so far">Share {ARROW}</button></div></li>
    <li><b>Use or star a project</b><span>Stars and issues make the open work easier to find.</span><div class="help-act"><a class="btn small" href="{C.CONFIG["github"]}" target="_blank" rel="noopener">{ICON_GH} GitHub</a><a class="btn small" href="lab.html">The Lab</a></div></li>
    {sponsor}
    <li><b>Hire me, or book a lesson</b><span>Paid work keeps the open projects free.</span><div class="help-act"><a class="btn small" href="professional.html">Professional</a><a class="btn small" href="teach.html">Teach</a><a class="btn small" data-x="jai" data-p="index.html">JA Insights</a></div></li>
  </ol></div></section>'''

# ---------------------------------------------------------------- about
about = f'''
<section class="wrap page-head">
  <div class="eyebrow">About</div>
  <h1 class="page-title">Hi, I'm James.</h1>
</section>
<section class="wrap block" style="padding-top:0"><div class="about-grid">
  <div class="prose">{"".join(f"<p>{E(p)}</p>" for p in C.ABOUT_LONG)}<p class="work-line">Work lives on other pages: <a href="professional.html">Professional</a>, <a data-x="jai" data-p="index.html">JA Insights</a> and <a href="teach.html">Teach</a>.</p>
    <div class="tile" id="interests" style="margin-top:28px"><dl class="facts">{"".join(f"<dt>{E(a)}</dt><dd>{E(b)}</dd>" for a, b in C.FACTS)}</dl><a class="go" href="{C.CONFIG["instagram"]}" target="_blank" rel="noopener">@jeby_d on Instagram {ARROW}</a></div></div>
  <div style="display:grid;gap:16px">
    <figure class="photo"><img src="assets/james-drew.jpg" srcset="assets/james-drew-600.jpg 600w, assets/james-drew.jpg 1000w" sizes="(max-width:860px) 92vw, 460px" alt="James holding Drew, his black Scottish Terrier, in a Miami backyard" width="1000" height="1250"><figcaption>Drew and me.</figcaption></figure>
    <div class="tile drew-tile" id="drew"><div class="eyebrow">{E(C.DREW["role"])}</div>{DREW}<h2>{E(C.DREW["title"])}</h2><p>{E(C.DREW["short"])}</p></div>
  </div>
</div></section>
<section class="wrap block" id="contact" aria-labelledby="contact-h"><div class="callout"><div><div class="eyebrow">Contact</div><h3 id="contact-h">Email is the fastest way to reach me.</h3><p class="muted" style="margin-top:6px" data-email="{email}" data-show>{email}</p></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn solid" href="#" data-copy-email="{email}">{ICON_MAIL} Copy email</a><a class="btn" href="{C.CONFIG["linkedin"]}" target="_blank" rel="noopener">{ICON_LI} LinkedIn</a><a class="btn" href="{C.CONFIG["instagram"]}" target="_blank" rel="noopener">{ICON_IG} Instagram</a><a class="btn" href="{C.CONFIG["github"]}" target="_blank" rel="noopener">{ICON_GH} GitHub</a></div></div></section>'''


# ---------------------------------------------------------------- qr prompt (jeby.us/qr on printed codes, jeby.us/yt in video descriptions)
def qr_page(src):
    return f'''
<section class="wrap page-head qr-head">
  <div class="qr-copy"><div class="eyebrow">The Drew QR</div>
  <h1 class="page-title">{E(C.QR["title"])}.</h1>
  <p class="lede">{E(C.QR["lede"])}</p>
  <div class="actions"><button class="btn solid" type="button" data-copy-text="qr-prompt">Copy the prompt {ARROW}</button><a class="btn" href="{C.CONFIG["instagram"]}" target="_blank" rel="noopener">{ICON_IG} Follow @jeby_d</a></div></div>
  <figure class="qr-fig"><img src="drew-qr.png" alt="The Drew QR code, with Drew's face worked into the pattern" width="560" height="560"><figcaption>The original Drew QR.</figcaption></figure>
</section>
<section class="wrap block" style="padding-top:8px"><div class="prompt-card" data-src="{src}"><div class="prompt-bar"><span class="eyebrow">The prompt</span><button class="btn small" type="button" data-copy-text="qr-prompt">Copy</button></div>
<pre id="qr-prompt">{E(C.QR["prompt"])}</pre>
<p>Paste it into an assistant that can run code, attach your picture and swap in your link. Why code: an image model draws something that looks like a QR code. Code builds one that is one, then checks it.</p></div></section>
{free_strip("More free things")}'''
# ---------------------------------------------------------------- write
research_head = '<link rel="stylesheet" href="assets/research.css">'
research_js = '<script src="assets/research.js"></script><script>mountDeck(document.getElementById("rsdeck"), { cover: { eyebrow: "<b>●</b>&nbsp; Carnegie Mellon · Statistics · 2015", title: "Predicting the masses of galaxy clusters <span>with weighted regression</span>", sub: "Nobody can put a galaxy cluster on a scale. What you can measure is how fast its galaxies move, and that depends on where you\'re standing." } });</script>'
tl_js = f'<script>window.TIMELINE={json.dumps(timeline)}</script>'
SPECS = [
    ("home", "James Eby · jeby.us", "James Eby's personal site: Miami, Drew, side projects and a galaxy-cluster research slideshow.", home, "", ""),
    ("professional", "Professional · James Eby", "James Eby (jeby): business intelligence and data science leadership. Experience, timeline and résumé.", pro, "", tl_js),
    ("teach", "Teach · James Eby", "Math, SAT, statistics and data-analysis tutoring, first-job mentorship and résumé services in Miami and online, in English or Spanish.", teach, "", ""),
    ("lab", "Lab · jebyLabs", "jebyLabs: real-estate analytics, a band game, open-source tools and hardware experiments by James Eby.", lab, "", ""),
    ("research", "Research · James Eby", "Predicting the masses of galaxy clusters using weighted linear regression: an animated slideshow of the 2015 Carnegie Mellon poster.", research, research_head, research_js),
    ("about", "About · James Eby", "About James Eby, and Drew.", about, "", ""),
    ("qr", "The dog QR prompt · jeby.us", "How to turn your dog into a QR code that actually scans: a free prompt that makes the AI write, blend and test the code.", qr_page("qr"), "", ""),
    ("yt", "The dog QR prompt · jeby.us", "How to turn your dog into a QR code that actually scans: a free prompt that makes the AI write, blend and test the code.", qr_page("yt"), '<link rel="canonical" href="https://jeby.us/qr">', ""),
]
for key, title, desc, body, xh, xj in SPECS:
    fn = "index.html" if key == "home" else f"{key}.html"
    (OUT / fn).write_text(page(key, title, desc, body, xh, xj), encoding="utf-8")
    (ART / fn).write_text(page(key, title, desc, body, xh, xj, artifact=(key == "home")), encoding="utf-8")

# assets
for d in (OUT, ART):
    shutil.copy(ROOT / "src/site.css", d / "assets/site.css"); shutil.copy(ROOT / "src/site.js", d / "assets/site.js")
    (d / "assets/research.css").write_text((RS / "visuals.css").read_text(encoding="utf-8"), encoding="utf-8")
    (d / "assets/research.js").write_text("\n".join((RS / f).read_text(encoding="utf-8") for f in ["common.js", "model.js", "los-orbit.js", "slides.js"]), encoding="utf-8")
    shutil.copy(ST / "lighting-lab.svg", d / "assets/lighting-lab.svg")
    for f in ("desk.svg", "james-drew.jpg", "james-drew-600.jpg"): shutil.copy(ST / f, d / "assets" / f)
    shutil.copy(ST / "drew-qr.png", d / "drew-qr.png")
    for f in ("musicalgames.svg", "plantriloquist.png"): shutil.copy(FAM / "assets" / f, d / "assets" / f)
    shutil.copy(FAM / "family.js", d / "assets/family.js")
    shutil.copy(ST / "favicon.svg", d / "favicon.svg")
    BR.copy_assets(d / "assets")
    (d / "research").mkdir(exist_ok=True); shutil.copy(ST / "poster.pdf", d / "research/poster.pdf")
shutil.copy(ST / "og.png", OUT / "og.png"); shutil.copy(ST / "drew-qr.png", OUT / "drew-qr.png")
(OUT / "CNAME").write_text("jeby.us\n", encoding="utf-8")
(OUT / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: https://jeby.us/sitemap.xml\n", encoding="utf-8")
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join(f"  <url><loc>https://jeby.us/{'' if k == 'home' else k}</loc></url>\n" for k, *_ in SPECS if k != "yt") + "</urlset>\n", encoding="utf-8")
(OUT / "llms.txt").write_text(f"""# James Eby (jeby)
> James Eby's personal site, Miami, FL. Work is on the Professional page and at JA Insights.

- [Professional](https://jeby.us/professional): Director-level BI and data science; experience, timeline, résumé.
- [Teach](https://jeby.us/teach): tutoring (math, SAT/ACT math, statistics, data analysis), first-job mentorship, résumé services. English and Spanish.
- [Lab](https://jeby.us/lab): jebyLabs projects: Desk, jRE real-estate analytics, learningLabs (a free learning library with a data analysis course), a band game, Lighting Lab, Quorum, Plantriloquist, AppForge, a route optimizer and driver tracking for small businesses, and a dog territory app.
- [Research](https://jeby.us/research): Predicting the Masses of Galaxy Clusters Using Weighted Linear Regression (Carnegie Mellon, 2015).
- [About](https://jeby.us/about): James, and Drew.
- [Free data report](https://jainsights.com/report): a one-page report on any spreadsheet, run in the browser.
- [Dog QR prompt](https://jeby.us/qr): a prompt that makes an AI build a picture QR code that scans.
Contact: {C.CONFIG["email"]} · {C.CONFIG["instagram"]} · {C.CONFIG["linkedin"]} · {C.CONFIG["github"]}
""", encoding="utf-8")
print("built", sorted(p.name for p in OUT.iterdir()))
