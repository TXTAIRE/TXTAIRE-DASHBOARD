# Code of Discipline — document build

Builds the two PDFs served by the portal and handed to employees:

| Output | Pages | Ships to |
| --- | --- | --- |
| `out.pdf` — English | 45 | `assets/docs/code-of-discipline-2026-en.pdf` |
| `out-fil.pdf` — Filipino | 47 | `assets/docs/code-of-discipline-2026-fil.pdf` |

Both are the same document in two languages: 8 categories, 102 offenses, identical
class split (A 14 / B 20 / C 29 / D 39). The Filipino offense wording is read from
`fil-offenses.json`, which is generated from the app's own `labelFil` fields, so the
PDF and the portal cannot drift apart. Do not re-translate offense text by hand.

## Requirements

- Node (for `docx`) — `npm install` in this directory
- Python with PyMuPDF — `pip install pymupdf`
- **Microsoft Word.** The DOCX to PDF step drives Word over COM. There is no
  LibreOffice on the build machine, and the output differs between the two, so
  swapping renderers means re-verifying page numbers from scratch.

## Building

Run from this directory. The build is two passes, because the table of contents
has to state page numbers that are only known after the document is laid out.

```
node make.js out.docx pagemap.json     # pass 1: build with the previous page map
python fixids.py out.docx              # REQUIRED - see "Gotchas"
powershell -File topdf.ps1 -In out.docx -Out out.pdf
python pagemap.py out.pdf              # resolve where headings actually landed
node make.js out.docx pagemap.json     # pass 2: rebuild with the corrected map
python fixids.py out.docx
powershell -File topdf.ps1 -In out.docx -Out out.pdf
python pagemap.py out.pdf              # must now report no change = converged
```

The Filipino edition is the same sequence with `make-fil.js`, `topdf-fil.ps1`,
`pagemap-fil.py` and `out-fil.*`.

`topdf.ps1` throws a COM exception on `Quit` after a successful export. It is
harmless — check for the `PAGES=` line, which means the export completed.

## Checks — run all of these before shipping

None of these are cosmetic. Each one exists because a defect shipped past a
reviewer who was eyeballing the document instead of measuring it.

| Script | Catches |
| --- | --- |
| `pagemap.py` | TOC entries that resolve to the wrong page, or run backwards |
| `orphans.py` | a page whose last line is a heading (stranded Part banner) |
| `blanks.py` | pages with no content |
| `fill.py` | pages that end well above the bottom margin |
| `pv.py` | renders pages to PNG for a visual pass |

Use the `fil-` prefixed copies for the Filipino edition.

## Gotchas

These cost real time to find. Please read before changing the layout code.

**`fixids.py` is not optional.** `docx-js` emits `wp:docPr id="1"` for every image.
Where one page carries two drawings, Word's PDF export silently drops the collision
— no error, the image is simply absent. This is how the cover logo went missing from
a delivered PDF. `fixids.py` renumbers every drawing id uniquely across the document
body, headers and footers. Run it after every `make*.js` and before every export.

**The TOC resolver matches on heading formatting, not on text.** Matching by string
picks up prose mentions of a heading before the heading itself, and picks up the TOC
listing on the TOC's own second page. `pagemap.py` matches font size and colour
(part = 13pt white, form = 12pt white, section = 11.5pt navy, sub = 10.5pt green)
and skips cover pages. It also asserts the resolved numbers run forward and fails
loudly if not — a contents listing that goes backwards means something matched wrong.

**`keepNext` binds to the next paragraph, whatever that is.** A Part banner followed
by an empty spacer paragraph pins the banner *to the spacer*, and both sit alone at
the foot of the page. Put the spacing on the banner itself (`spacing.before/after`
plus `keepLines`); do not reintroduce spacer paragraphs between a banner and its body.
`orphans.py` exists to catch this.

**A trailing `pageBreak()` can produce a blank page.** When content happens to fill a
page exactly, the break paragraph starts another one. Use `pageBreakBefore()` on the
following block instead of a break after the previous one.

**Word's PositionalTab is not reliable.** The Filipino footer's right-aligned
`PositionalTab` collapsed on export, printing the page number jammed against the
strap — with markup byte-identical to the English footer, which worked. Use an
explicit right tab stop at the content width (`W`) instead.

**Filipino notes must not restate their own row.** The portal has no separate note
column, so `labelFil` carries its caveats inline. A note written against the English
layout ends up repeating the offense it annotates. `fil-part4.js` warns at build time
when a note overlaps its own offense text by more than 60%.

**Watch for homoglyphs in the Filipino text.** Cyrillic characters reached a draft
inside an otherwise-Latin word. Scan the built PDF's text layer for non-Latin
scripts; only em/en dash, bullet, thin space, arrow, middle dot and the peso sign
should appear above ASCII.

## Current baseline

| Edition | Pages | Delivered file |
| --- | --- | --- |
| English | 46 | `assets/docs/code-of-discipline-2026-en.pdf` |
| Filipino | 47 | `assets/docs/code-of-discipline-2026-fil.pdf` |

Both are reproducible from this tree with the committed lockfile. `pagemap.json` and
`pagemap-fil.json` match the delivered documents.

The English edition was 45 pages until it was regenerated from this pipeline. The
extra page is real and expected — see the history below, which is worth reading
before you assume a rebuild has gone wrong.

## History: how the English edition gained a page

Not the library. `docx` has exactly one published version satisfying the `^9.7.1`
range the original build declared — 9.7.1 itself — so every build runs identical
library code. There was nothing to bisect.

The cause was `lib.js`, which **both editions share**. Building the Filipino edition
modified it: the language-table refactor (`STRINGS` / `setLang` / `S()`) and the
`partHead` spacing fix for the stranded Part III banner. Both changed English metrics
slightly, and that accumulated into one extra page. The pre-Filipino `lib.js` no
longer exists — it was never committed and the scratchpad was cleaned — so the
45-page layout was not recoverable, and the 46-page document was regenerated,
re-verified and delivered in its place.

Regenerating also exposed a second defect that the 45-page build had not shown: the
footer's `PositionalTab` collapsed on **44 of 46 pages**, printing the page number
jammed against the strap. Same markup, same library, different result — see the
`PositionalTab` note under Gotchas. `make.js` now uses an explicit right tab stop,
matching `make-fil.js`.

### The lesson worth keeping

Two things, both learned the hard way here:

`lib.js` is shared. A change made for one edition silently repaginates the other, and
nothing in the build fails to tell you — both editions still converge and still pass
every check. If you edit `lib.js`, rebuild **both** editions and compare page counts
against the baseline table before shipping either one.

`PositionalTab` is not deterministic across builds. It worked in the 45-page English
build and collapsed in the next one with no change to the markup. Neither the page
map, the orphan check nor the fill check notices a footer that has gone wrong; only
looking at a rendered page does. Render at least one page and look at the footer
before shipping.
