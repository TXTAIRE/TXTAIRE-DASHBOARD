"""Split the annexes out of a built Code of Discipline into one PDF per form.

    python split-forms.py out.pdf forms/en
    python split-forms.py out-fil.pdf forms/fil

HR prints these one at a time -- a Notice to Explain for one case, a performance sheet for
one employee for one month -- so each annex is also published on its own.

The pages are CUT FROM THE BUILT DOCUMENT rather than rebuilt from the source modules. A
second build path would be a second thing to keep in step, and the first time the two
diverged, HR would be handing an employee a form that differs from the one in the Code
they signed for. Extracting means each form is, page for page, the form in the Code --
including its footer, which still carries the page number it occupies there, so a signed
sheet can always be traced back to the edition it came from.

A form runs from its banner page to the page before the next banner. Nothing is assumed
about how many pages a form takes: Annex D runs to two pages and Annex 08's trade sheets to
one, and both come out whole. Annex labels are lettered (A-G) or numbered (08, the
performance-evaluation family, whose sheets are Forms CD-08a to CD-08e), so the banner test
below accepts either.
"""
import os
import re
import sys

import pymupdf

src = sys.argv[1] if len(sys.argv) > 1 else "out.pdf"
outdir = sys.argv[2] if len(sys.argv) > 2 else "forms"

HERE = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(HERE, src)
out_path = os.path.join(HERE, outdir)
os.makedirs(out_path, exist_ok=True)

doc = pymupdf.open(src_path)


# A form banner is a HEADING, not any line that happens to say "Annex": formHead() renders
# it at 12pt in white on the blue bar. Matching on the words alone also caught prose that
# merely mentions an annex -- "the form in Annex 08", "a Notice to Explain that omits any of
# the elements in Annex A is legally defective" -- and cut the document in the wrong
# places. This is the same size-and-colour test the page-map resolver uses.
WHITE = 0xFFFFFF
BANNER_PT = 12.0


def banner_of(page):
    """The form banner on this page, or None."""
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            text = "".join(
                span["text"] for span in line["spans"]
                if abs(span["size"] - BANNER_PT) < 0.3 and span["color"] == WHITE
            )
            text = " ".join(text.split())
            if re.match(r"^Annex\s+(?:[A-Z]|\d{1,2})\b", text, re.I):
                return text
    return None


def slug(banner):
    s = banner.replace("—", "-").replace("–", "-")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    s = re.sub(r"^annex-", "annex-", s)
    return re.sub(r"-+", "-", s)


# Walk the document once: each banner opens a form, and the next banner closes it.
forms = []
for i in range(doc.page_count):
    b = banner_of(doc[i])
    if b is None:
        continue
    if forms and forms[-1]["banner"] == b:
        forms[-1]["end"] = i          # a form that runs past one page
    else:
        forms.append({"banner": b, "start": i, "end": i})

if not forms:
    print("No annex banners found in " + src + " -- nothing to split.")
    sys.exit(1)

# A form ends where the next one begins.
for a, b in zip(forms, forms[1:]):
    a["end"] = b["start"] - 1
forms[-1]["end"] = doc.page_count - 1

written = []
for n, f in enumerate(forms, 1):
    out = pymupdf.open()
    out.insert_pdf(doc, from_page=f["start"], to_page=f["end"])
    name = "%02d-%s.pdf" % (n, slug(f["banner"]))
    path = os.path.join(out_path, name)
    out.save(path)
    out.close()
    pages = f["end"] - f["start"] + 1
    written.append((name, pages, f["start"] + 1, f["end"] + 1))

print("%s -> %s" % (src, outdir))
for name, pages, a, b in written:
    print("  %-56s %d page%s  (from pages %d-%d)" % (name, pages, "" if pages == 1 else "s", a, b))
print("  %d files" % len(written))
