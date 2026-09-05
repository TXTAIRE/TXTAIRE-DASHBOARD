"""Report prose the content modules produce but the built DOCX does not contain.

This exists because of a real loss. note() renders an item written as [ 'a string' ] as an
EMPTY paragraph: it treats an array item as a list of TextRuns, and docx drops a bare
string in that position without raising anything. Three prohibitions in Section 3.12 --
no fines, no withholding of pay for hours actually worked, no liquidated damages for
short resignation notice -- were written that way, and were silently absent from every
edition built before this check existed. Nothing else caught it: the page map converged,
no page ended on a heading, no page was blank, the fill numbers were normal, and the
section still had its heading and its label, so it looked complete on the page.

Run it against every edition after every build.

    python dropcheck.py out.docx
    python dropcheck.py out-fil.docx fil
    python dropcheck.py out-emp.docx employee
    python dropcheck.py out-fil-emp.docx fil-employee

Image relationship ids and OOXML namespace URIs are produced by the modules but never
appear as document text; they are filtered rather than reported.
"""
import html
import json
import os
import re
import subprocess
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())

docx = sys.argv[1] if len(sys.argv) > 1 else "out.docx"
# The edition argument names a language, an audience, or both:
#   (omitted) | fil | employee | fil-employee
edition = sys.argv[2] if len(sys.argv) > 2 else "full"
parts = edition.split("-")
lang = "fil" if "fil" in parts else "en"
aud = "employee" if "employee" in parts else "full"

env = dict(os.environ, CODE_LANG=lang, CODE_AUDIENCE=aud)
res = subprocess.run(["node", "produced.js"], cwd=HERE, capture_output=True,
                     text=True, encoding="utf8", env=env)
if res.returncode != 0:
    print("could not run produced.js:\n" + res.stderr[:800])
    sys.exit(1)
produced = json.loads(res.stdout)

x = zipfile.ZipFile(os.path.join(HERE, docx)).read("word/document.xml").decode("utf8")
in_doc = {norm(html.unescape(r)) for r in re.findall(r"<w:t[^>]*>([^<]*)</w:t>", x)}

NOISE = ("schemas.openxmlformats.org", "rId{", ".jpg", ".png")
dropped = [(w, s) for w, s in produced
           if norm(s) not in in_doc and not any(n in s for n in NOISE)]

print("%s: %d prose runs produced, %d absent from the document"
      % (docx, len(produced), len(dropped)))
for where, s in dropped:
    print("  LOST [%s] %s" % (where, s[:150]))
if not dropped:
    print("OK: every paragraph the modules produce reached the document.")
sys.exit(1 if dropped else 0)
