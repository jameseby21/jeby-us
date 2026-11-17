# Recipe data model

Every recipe on jeby.us is data, not prose. The page renders from these files. Nothing
is hand-written HTML, because the same recipe has to render in two languages, two unit
systems, and three view modes.

## Layout

```
recipes/
  _schema/
    recipe.schema.json      the contract
    README.md               this file
  <category>/
    _category.json          the category and its variants
    <variant-slug>/
      es.json               one file per language version
      en.json
```

A **category** is the thing a person searches for: brisket, steak, cornbread.
A **variant** is a real alternative inside it: brisket smoked vs brisket roasted,
steak by cut and method. Categories exist from the first recipe, even with one
variant, because retrofitting them later means rewriting every URL.

## Language versions are peers, not translations

`en.json` and `es.json` are **equal-status versions of the same recipe**, not a source
and a derivative. Each carries `authored: true|false`.

This is deliberate and it is the opposite of how most sites do it. The reasons:

1. **Cut names do not translate.** Flap is *vacío* in Argentina, close to *arrachera*
   in Mexico, something else again in Colombia. There is no correct single answer, and
   a translation layer will produce a confident wrong one that sends somebody to the
   butcher for the wrong piece of meat. The term index (COOK-09) carries regional
   variants; the recipe references a term id, never a bare noun.
2. **A recipe written in Spanish by a native speaker does not read like a translated
   one.** The site's whole editorial position is that it does not pad or fake. A
   machine-translated recipe is exactly the thing it claims not to be.
3. Some recipes will only ever exist in one language. That is allowed. A missing
   version renders as a link to the one that exists, not as an error.

## Numbers are never translated

Every quantity is `{value, unit}`, never a string. The renderer converts per locale:
°F/°C, lb/g, cups/ml. Translators never touch a number, because that is where
translation introduces errors you cannot see. This is also why `en.json` and `es.json`
can disagree on wording but never on a temperature.

## Required fields that no other recipe format has

| Field | Why it exists |
| --- | --- |
| `steps[].applies_to` | Which items this step acts on. **Required even when the answer is "none"** — "no meat moves yet" is an answer, and its absence is the single most common gap. |
| `steps[].not_required` | The negative instruction. When a step people expect is unnecessary or harmful, say so where they would wonder, not in a footnote. |
| `steps[].elasticity` | `fixed` / `floor` / `ceiling` / `hold`. Drives the re-anchoring scheduler (COOK-12). A `hold` step is where a running-late cook absorbs a delay. |
| `steps[].kind` | `must` / `optional`. Drives both the view filter and graceful degradation under a tight serving time (COOK-13). |
| `equipment[].no_substitute` | Honest exceptions. A recipe claiming everything is swappable is as useless as one claiming nothing is. |
| `source` | Where a recipe came from when it did not come from James. Non-negotiable on anything adapted. |

## Attribution

`source` is required whenever the recipe is not James's own. It carries `name`, `url`,
and `relationship` (`adapted` / `as-published` / `original`). Procedures and ingredient
lists are not themselves protected, but another person's written expression is — so an
adapted recipe is restated in this schema in James's own words and credits the source.
Never paste a source's prose into `body`.
