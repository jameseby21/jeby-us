"""Recipes for jeby.us/cooking: load _src/jeby/recipes/, validate every file against recipes/_schema/recipe.schema.json,
and render the Cooking index and one page per recipe (JEBYUS-0083). Docs: _src/README.md#recipes.

The data is the cooking thread's tree (COOK-16): one folder per category with _category.json, one folder per variant,
one file per language (en.json, es.json). Quantities are {value, unit} and are printed in the units the data gives;
nothing is converted, so no oven temperature needs snapping yet. Language versions are peers: a recipe that exists only
in Spanish renders in Spanish and is marked on the index; nothing is machine-translated. verdict and would_change are
James's words: a null one renders nothing. Photos render only where the data says usable: true and the file exists.
No third-party package: the validator below covers the JSON Schema keywords the schema uses (type, required, enum,
properties, items, $ref), so a new keyword in the schema fails the build instead of passing silently."""
import html, json, pathlib

E = html.escape
DIR = pathlib.Path(__file__).parent / "recipes"
KNOWN = {"$schema", "$id", "$defs", "$ref", "title", "description", "type", "required", "properties", "items", "enum", "default"}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "integer": int, "number": (int, float)}


class RecipeError(ValueError):
    pass


def validate(obj, node, root, where="$"):
    """Every problem in obj against the schema node, as 'path: problem' strings (empty list = valid)."""
    unknown = set(node) - KNOWN
    if unknown: return [f"{where}: schema keyword(s) {sorted(unknown)} not supported by cooking.validate"]
    if "$ref" in node:
        ref = node["$ref"]
        if not ref.startswith("#/"): return [f"{where}: only local $ref is supported, got {ref}"]
        target = root
        for part in ref[2:].split("/"): target = target[part]
        return validate(obj, target, root, where)
    errs = []
    t = node.get("type")
    if t:
        ok = isinstance(obj, TYPES[t]) and not (t in ("integer", "number") and isinstance(obj, bool))
        if not ok: return [f"{where}: expected {t}, got {type(obj).__name__}"]
    if "enum" in node and obj not in node["enum"]: errs.append(f"{where}: {obj!r} is not one of {node['enum']}")
    if isinstance(obj, dict):
        errs += [f"{where}: missing required field '{k}'" for k in node.get("required", []) if k not in obj]
        for k, sub in node.get("properties", {}).items():
            # Null verdict / would_change means "not written yet"; the schema types them as strings when present.
            if k in obj and not (obj[k] is None and k in ("verdict", "would_change")):
                errs += validate(obj[k], sub, root, f"{where}.{k}")
    if isinstance(obj, list) and "items" in node:
        for i, x in enumerate(obj): errs += validate(x, node["items"], root, f"{where}[{i}]")
    return errs


def load(base=DIR):
    """Categories (brisket first, then by name), each with its variants and the language versions found on disk.
    Raises RecipeError listing every schema problem; a build never publishes an invalid recipe."""
    schema = json.loads((base / "_schema" / "recipe.schema.json").read_text(encoding="utf-8"))
    cats, errs = [], []
    for cdir in sorted((p for p in base.iterdir() if p.is_dir() and not p.name.startswith("_")), key=lambda p: (p.name != "brisket", p.name)):
        cat = json.loads((cdir / "_category.json").read_text(encoding="utf-8"))
        variants = []
        for v in cat["variants"]:
            versions = {}
            for f in sorted((cdir / v["slug"]).glob("*.json")):
                r = json.loads(f.read_text(encoding="utf-8"))
                rel = f.relative_to(base).as_posix()
                errs += [f"{rel} {e}" for e in validate(r, schema, schema)]
                if r.get("id") != f"{cat['category']}/{v['slug']}/{f.stem}": errs.append(f"{rel} $.id: {r.get('id')!r} does not match its path")
                if r.get("lang") != f.stem: errs.append(f"{rel} $.lang: {r.get('lang')!r} does not match the file name")
                versions[f.stem] = r
            if versions: variants.append({**v, "versions": versions})
        if variants: cats.append({**cat, "variants": variants})
    if errs: raise RecipeError("recipe data failed the schema:\n  " + "\n  ".join(errs))
    return cats


def page_key(cat, variant, lang):
    """File stem of a recipe page: cooking-<category>-<variant>, with -<lang> only when a variant has two languages."""
    k = f"cooking-{cat['category']}-{variant['slug']}"
    return k if len(variant["versions"]) == 1 or lang == "en" else f"{k}-{lang}"


# ---------------------------------------------------------------- formatting
L = {
    "en": {"ingredients": "Ingredients", "equipment": "Equipment", "steps": "Steps", "targets": "Temperatures", "rest": "Rest",
           "yield": "Makes", "servings": "servings", "source": "Recipe", "for": "For", "or": "Or", "no_sub": "No substitute",
           "not_req": "Not needed", "estimate": "Time estimate", "time": "Time", "probe": "When the probe reads",
           "visual": "Go by sight", "tactile": "Go by feel", "pull": "Pull at", "ceiling": "no higher than",
           "lid": "Lid", "vents": "Vents", "zone": "Zone", "temp": "Temp", "verdict": "Verdict", "would_change": "What I'd change",
           "rel": {"original": "Original", "adapted": "Adapted", "as-published": "As published"}, "photo": "Photo",
           "lang_name": {"en": "English", "es": "Spanish"}, "status": {"draft": "Draft", "planned": "Planned", "live": "Live"}},
    "es": {"ingredients": "Ingredientes", "equipment": "Equipo", "steps": "Pasos", "targets": "Temperaturas", "rest": "Reposo",
           "yield": "Rinde", "servings": "porciones", "source": "Receta", "for": "Para", "or": "O", "no_sub": "Sin sustituto",
           "not_req": "No hace falta", "estimate": "Tiempo estimado", "time": "Tiempo", "probe": "Cuando la sonda marque",
           "visual": "A la vista", "tactile": "Al tacto", "pull": "Sacar a", "ceiling": "no más de",
           "lid": "Tapa", "vents": "Ventilación", "zone": "Zona", "temp": "Temp.", "verdict": "Veredicto", "would_change": "Qué cambiaría",
           "rel": {"original": "Original", "adapted": "Adaptada", "as-published": "Tal como se publicó"}, "photo": "Foto",
           "lang_name": {"en": "inglés", "es": "español"}, "status": {"draft": "Borrador", "planned": "Planeada", "live": "Publicada"}},
}
UNITS = {"en": {"tbsp": "tbsp", "tsp": "tsp", "cup": ("cup", "cups"), "C": "°C", "F": "°F"},
         "es": {"tbsp": "cda.", "tsp": "cdta.", "cup": ("taza", "tazas"), "C": "°C", "F": "°F"}}
COUNT = {"clove", "leaf", "whole"}   # the ingredient's own name already says what is counted ("Dientes de ajo", "Cebolla grande")
FRAC = {0.25: "¼", 0.5: "½", 0.75: "¾"}


def num(v, lang):
    whole, part = int(v), round(v - int(v), 4)
    if part == 0: return str(whole)
    if part in FRAC: return (str(whole) if whole else "") + FRAC[part]
    s = f"{v:g}"
    return s.replace(".", ",") if lang == "es" else s


def qty(q, lang):
    """{value, unit, max?} as text in the data's own unit: 2–2½ kg, 255 °F, 3 tbsp."""
    n = num(q["value"], lang) + (f"–{num(q['max'], lang)}" if q.get("max") is not None else "")
    u = q["unit"]
    if u in COUNT: return n
    lab = UNITS[lang].get(u, u)
    if isinstance(lab, tuple): lab = lab[0] if q["value"] == 1 and q.get("max") is None else lab[1]
    return f"{n} {lab}"


def minutes(m, lang):
    if m < 60: return f"{m} min"
    h = m / 60
    return f"{num(h, lang) if h != int(h) else int(h)} h"


def paras(text):
    return "".join(f"<p>{E(p.strip())}</p>" for p in text.split("\n\n") if p.strip())


# ---------------------------------------------------------------- rendering
def attribution(src, t):
    """The source block exactly as the data gives it: name (linked when a url is given), relationship, note, embed."""
    name = E(src["name"])
    if src.get("url"): name = f'<a href="{E(src["url"])}" rel="noopener">{name}</a>'
    note = f'<p>{E(src["note"])}</p>' if src.get("note") else ""
    emb = src.get("embed") or {}
    video = ""
    if emb.get("platform") == "youtube" and emb.get("id"):
        cap = f'<figcaption>{E(emb["caption"])}</figcaption>' if emb.get("caption") else ""
        video = f'<figure class="embed"><iframe src="https://www.youtube-nocookie.com/embed/{E(emb["id"])}" title="{E(src["name"])}" loading="lazy" allowfullscreen></iframe>{cap}</figure>'
    return f'<aside class="attrib" aria-label="{t["source"]}"><span class="eyebrow">{t["source"]} · {E(t["rel"][src["relationship"]])}</span><p class="attrib-name">{name}</p>{note}{video}</aside>'


def gate_html(s, t, lang):
    """A temperature, sight or feel gate leads with its condition; the clock time follows as an estimate."""
    g = s.get("gate") or {"kind": "time"}
    est = E(g["estimate_note"]) if g.get("estimate_note") else ""
    dur = minutes(s["duration_min"], lang) if s.get("duration_min") else ""
    if g["kind"] == "time":
        if not (dur or est): return ""
        return f'<p class="cond time"><b>{t["time"]}{": " + dur if dur else ""}</b>{" · " + est if est else ""}</p>'
    if g["kind"] == "internal_temp":
        head = f'{t["probe"]} {qty(g["value"], lang)}' if g.get("value") else t["probe"]
    else:
        head = t[g["kind"]]
    test = f'<span class="cond-test">{E(g["test"])}</span>' if g.get("test") else ""
    when = f'<span class="cond-est">{t["estimate"]}{": " + dur if dur else ""}{" · " + est if est else ""}</span>' if (dur or est) else ""
    return f'<p class="cond gated"><b>{E(head)}</b>{test}{when}</p>'


def state_html(st, t, lang):
    if not st: return ""
    bits = [(t["lid"], st.get("lid")), (t["vents"], st.get("vents")), (t["zone"], st.get("zone")), (t["temp"], qty(st["temp"], lang) if st.get("temp") else None)]
    return '<ul class="rstate">' + "".join(f"<li><span>{a}</span> {E(b)}</li>" for a, b in bits if b and b != "n/a") + "</ul>"


def recipe_body(cat, variant, r, others):
    """One recipe page. others: [(lang, href)] for the variant's other language versions."""
    lang = r["lang"]; t = L[lang]
    src = r.get("source")
    prom = (src or {}).get("credit_prominence", "header")
    head_attr = attribution(src, t) if src and prom in ("header", "inline") else ""
    foot_attr = attribution(src, t) if src and prom == "footer" else ""
    alt = "".join(f'<a class="btn small" href="{h}" hreflang="{l}">{E(L[l]["lang_name"][l].capitalize())}</a>' for l, h in others)
    yld = r.get("yield") or {}
    yline = f'<p class="note">{t["yield"]} {yld["servings"]} {t["servings"]}{". " + E(yld["note"]) if yld.get("note") else ""}</p>' if yld.get("servings") else ""

    def alts(x): return f'<span class="alts">{t["or"]}: {E("; ".join(x["alternatives"]))}</span>' if x.get("alternatives") else ""
    ingr = "".join(f'<li><b class="amt">{qty(i["amount"], lang) if i.get("amount") else ""}</b><span>{E(i["item"])}{", " + E(i["prep"]) if i.get("prep") else ""}{alts(i)}</span></li>' for i in r.get("ingredients", []))
    nosub = f'<span class="chip">{t["no_sub"]}</span>'
    equip = "".join(f'<li><b>{E(e["item"])}</b>{nosub if e.get("no_substitute") else ""}{"<span>" + E(e["why"]) + "</span>" if e.get("why") else ""}{alts(e)}</li>' for e in r.get("equipment", []))
    targets = "".join(f'<li><b>{E(x["applies_to"])}</b><span>{t["pull"]} {qty(x["pull"], lang)}{", " + t["ceiling"] + " " + qty(x["ceiling"], lang) if x.get("ceiling") else ""}</span>{"<span>" + E(x["note"]) + "</span>" if x.get("note") else ""}</li>' for x in r.get("targets", []))
    rest = r.get("rest")
    rest_html = ""
    if rest:
        rng = " – ".join(qty(rest[k], lang) for k in ("min", "max") if rest.get(k))
        bits = [f'<b>{E(rest["applies_to"])}</b>' if rest.get("applies_to") else "", f"<span>{rng}</span>" if rng else "",
                f'<span>{E(rest["surface"])}</span>' if rest.get("surface") else ""]
        rest_html = f'<section class="rsec" aria-labelledby="r-rest"><h2 id="r-rest">{t["rest"]}</h2><div class="tile rest">{"".join(bits)}{paras(rest["note"]) if rest.get("note") else ""}</div></section>'
    steps = []
    for n, s in enumerate(r["steps"], 1):
        nr = f'<div class="notreq"><span class="eyebrow">{t["not_req"]}</span>{paras(s["not_required"])}</div>' if s.get("not_required") else ""
        steps.append(f'<li class="rstep" id="{E(s["id"])}"><span class="rnum" aria-hidden="true">{n}</span><div><h3>{E(s["title"])}</h3>'
                     f'<p class="for"><span>{t["for"]}:</span> {E(s["applies_to"])}</p>{gate_html(s, t, lang)}{state_html(s.get("equipment_state"), t, lang)}'
                     f'{paras(s["body"]) if s.get("body") else ""}{nr}</div></li>')
    photos = "".join(f'<figure class="photo"><img src="assets/recipes/{E(p["file"])}" alt="{E(p.get("caption", ""))}" loading="lazy">'
                     f'<figcaption>{E(p.get("caption", ""))}{" · " + t["photo"] + ": " + E(p["credit"]["photographer"]) if p.get("credit", {}).get("photographer") else ""}</figcaption></figure>'
                     for p in usable_photos(r))
    words = "".join(f'<div class="tile"><span class="eyebrow">{t[k]}</span>{paras(r[k])}</div>' for k in ("verdict", "would_change") if r.get(k))
    sec = lambda key, inner, cls="rlist": f'<section class="rsec" aria-labelledby="r-{key}"><h2 id="r-{key}">{t[key]}</h2><ul class="{cls}">{inner}</ul></section>' if inner else ""
    return f'''
<section class="wrap page-head recipe-head">
  <div class="eyebrow"><a href="cooking.html">Cooking</a> · {E(cat["title"].get(lang) or cat["title"]["en"])} · {E(variant["title"].get(lang) or variant["title"]["en"])}</div>
  <h1 class="page-title">{E(r["title"])}</h1>
  {f'<p class="lede">{E(r["subtitle"])}</p>' if r.get("subtitle") else ""}
  {yline}{f'<div class="actions">{alt}</div>' if alt else ""}
  {head_attr}
</section>
<section class="wrap block recipe" style="padding-top:0">
  {photos}{words}
  <div class="recipe-cols">{sec("ingredients", ingr)}{sec("equipment", equip)}</div>
  {sec("targets", targets)}
  <section class="rsec" aria-labelledby="r-steps"><h2 id="r-steps">{t["steps"]}</h2><ol class="rsteps">{"".join(steps)}</ol></section>
  {rest_html}
  {foot_attr}
</section>'''


def usable_photos(r):
    """Only photos the data marks usable: true and published, with no one else to clear, whose file is in recipes/photos/."""
    return [p for p in r.get("photos", []) if p.get("usable") is True and p.get("published", True) and not p.get("others_present")
            and (DIR / "photos" / p["file"]).is_file()]


def index_body(cats, lede):
    """The Cooking index: one card per recipe (one per variant and language), brisket first."""
    groups = []
    for cat in cats:
        cards = []
        for v in cat["variants"]:
            for lang, r in sorted(v["versions"].items(), key=lambda kv: kv[0] != "en"):
                tags = [f'<span class="chip">{E(L["en"]["status"].get(v.get("status"), v.get("status", "")))}</span>'] if v.get("status") else []
                if lang != "en": tags.append(f'<span class="chip lang" lang="en">{E(L["en"]["lang_name"][lang].capitalize())}</span>')
                summ = (v.get("summary") or {}).get("en", "")
                cards.append(f'<a class="tile span-6 recipe-card" href="{page_key(cat, v, lang)}.html"><div class="eyebrow">{E(cat["title"]["en"])} · {E(v["title"]["en"])}</div>'
                             f'<h3 lang="{lang}">{E(r["title"])}</h3>{f"<p>{E(summ)}</p>" if summ else ""}<div class="chips">{"".join(tags)}</div><span class="go">Open {"<span class=arrow aria-hidden=true>→</span>"}</span></a>')
        blurb = (cat.get("blurb") or {}).get("en", "")
        groups.append(f'<section class="block" aria-labelledby="c-{E(cat["category"])}"><div class="block-head"><div><h2 id="c-{E(cat["category"])}">{E(cat["title"]["en"])}</h2>{f"<p class=muted>{E(blurb)}</p>" if blurb else ""}</div></div><div class="bento">{"".join(cards)}</div></section>')
    return f'''
<section class="wrap page-head">
  <div class="eyebrow">Cooking</div>
  <h1 class="page-title">Cooking.</h1>
  <p class="lede">{E(lede)}</p>
</section>
<div class="wrap" style="padding-bottom:40px">{"".join(groups)}</div>'''


def pages(cats):
    """(key, lang, title, description, body) for every recipe page."""
    out = []
    for cat in cats:
        for v in cat["variants"]:
            for lang, r in v["versions"].items():
                others = [(l, page_key(cat, v, l) + ".html") for l in v["versions"] if l != lang]
                out.append((page_key(cat, v, lang), lang, f'{r["title"]} · Cooking · jeby.us', r.get("subtitle") or r["title"], recipe_body(cat, v, r, others)))
    return out


def random_items(cats):
    return [{"id": f"recipe-{page_key(c, v, l)}", "kind": "Recipe", "title": r["title"], "text": r.get("subtitle", ""), "href": f"{page_key(c, v, l)}.html", "lang": l}
            for c in cats for v in c["variants"] for l, r in v["versions"].items()]
