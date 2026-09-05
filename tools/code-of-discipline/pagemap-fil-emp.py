"""Resolve the printed page number of every table-of-contents entry.

The first version of this searched each page's raw text for the entry's title and took
the first hit. That was wrong in two ways, and both shipped:

  1. The contents listing itself matched. The TOC runs to two pages, and only the first
     carries the words "TABLE OF CONTENTS", so skipping "pages up to the last TOC page"
     skipped only page one. Every entry listed on the second TOC page then matched
     against that page and resolved to page 3.

  2. Prose that merely MENTIONS a section matched. "Part II - Company Ethical Standards"
     is a row label in the Summary of Changes, so Part II resolved to a page before
     Part I.

So match the actual HEADING, not the text. Every heading style in this document has a
distinct (font size, colour) pair, and no body text, table cell or contents line shares
one -- which makes the heading unambiguous no matter how often its wording appears
elsewhere. Sizes below are points; docx `size` is half-points, hence the halving.

  partHead   size 26 -> 13.0pt  white   PART I ... / ANNEXES banner
  formHead   size 24 -> 12.0pt  white   Annex A ... G form titles
  secHead    size 23 -> 11.5pt  navy    numbered sections, and "Summary of Changes"
  subHead    size 21 -> 10.5pt  green   Summary of Changes subsections A-D
"""

import json
import os
import re

import pymupdf

b = os.path.dirname(os.path.abspath(__file__))
doc = pymupdf.open(os.path.join(b, "out-fil-emp.pdf"))

OFFSET = 2   # the cover section occupies PDF pages 1-2; the body restarts at printed page 1
SKIP = 2     # never look at those cover pages

WHITE = 0xFFFFFF
NAVY = 0x16386E
GREEN = 0x1B6B2E

# kind -> (point size, colour)
STYLES = {
    "part": (13.0, WHITE),
    "form": (12.0, WHITE),
    "sec": (11.5, NAVY),
    "sub": (10.5, GREEN),
}

TARGETS = [

    ("p1",   "part", "PANIMULA AT PANGKALAHATANG PATAKARAN"),
    ("s1_1", "sec",  "1.1  Layunin at Saklaw"),
    ("s1_2", "sec",  "1.2  Pananagutan sa Pagpapatupad"),
    ("s1_3", "sec",  "1.3  Pantay na Oportunidad"),
    ("s1_4", "sec",  "1.4  Patakaran sa Probationary"),
    ("s1_5", "sec",  "1.5  Kahulugan ng mga Termino"),
    ("s1_6", "sec",  "1.6  Pagbabago sa Manwal"),

    ("p2",   "part", "PAMANTAYANG ETIKAL NG KOMPANYA"),
    ("s2_1", "sec",  "2.1  Ang mga Pagpapahalaga"),
    ("s2_2", "sec",  "2.2  Pamantayan sa Pagnenegosyo"),
    ("s2_3", "sec",  "2.3  Conflict of Interest"),
    ("s2_4", "sec",  "2.4  Regalo, Komisyon"),
    ("s2_5", "sec",  "2.5  Kompidensyalidad at Data Privacy"),
    ("s2_6", "sec",  "2.6  Ari-arian at Gamit ng Kompanya"),
    ("s2_7", "sec",  "2.7  Pakikitungo sa Kliyente"),
    ("s2_8", "sec",  "2.8  Paggalang sa Lugar ng Trabaho"),
    ("s2_9", "sec",  "2.9  Social Media"),
    ("s2_10", "sec", "2.10  Pag-report ng Alalahanin"),

    ("p3",   "part", "ANG PROSESO NG DISIPLINA"),
    ("s3_1", "sec",  "3.1  Mga Prinsipyo ng Nagwawastong Disiplina"),
    ("s3_2", "sec",  "3.2  Kahulugan ng mga Aksyong Disiplinaryo"),
    ("s3_3", "sec",  "3.3  Pag-uuri ng mga Paglabag"),
    ("s3_4", "sec",  "3.4  Talaan ng mga Parusa"),
    ("s3_5", "sec",  "3.5  Mga Pampagaan"),
    ("s3_6", "sec",  "3.6  Tamang Proseso"),
    ("s3_7", "sec",  "3.7  Ang Administrative Review Panel"),
    ("s3_8", "sec",  "3.8  Preventive Suspension"),
    ("s3_9", "sec",  "3.9  Apela"),
    ("s3_10", "sec", "3.10  Paulit-ulit na Paglabag"),
    ("s3_11", "sec", "3.11  Palugit at Paglilinis"),
    ("s3_12", "sec", "3.12  Pagbabayad ng Pinsala"),
    ("s3_13", "sec", "3.13  Karapatan ng Pamunuan"),

    ("p4",   "part", "TALAAN NG MGA PAGLABAG"),
    ("s4_1", "sec",  "4.1  Mga Paglabag sa Attendance"),
    ("s4_2", "sec",  "4.2  Mga Paglabag sa Time Record"),
    ("s4_3", "sec",  "4.3  Mga Paglabag sa Kalusugan"),
    ("s4_4", "sec",  "4.4  Mga Paglabag sa Performance"),
    ("s4_5", "sec",  "4.5  Mga Paglabag sa Ari-arian"),
    ("s4_6", "sec",  "4.6  Mga Paglabag sa Katapatan"),
    ("s4_7", "sec",  "4.7  Mga Paglabag sa Asal at Ugali"),
    ("s4_8", "sec",  "4.8  Pananagutan ng mga Supervisor"),

    ("p5",   "part", "PAMANTAYAN AT BENEPISYO SA TRABAHO"),
    ("s5_1", "sec",  "5.1  Oras ng Trabaho"),
    ("s5_2", "sec",  "5.2  Overtime, Undertime"),
    ("s5_3", "sec",  "5.3  Mga Leave"),
    ("s5_4", "sec",  "5.4  Payroll at Timekeeping"),
    ("s5_5", "sec",  "5.5  Panuntunan sa Holiday Pay"),
    ("s5_6", "sec",  "5.6  Mga Benepisyo Ayon sa Batas"),
    ("s5_7", "sec",  "5.7  Kaligtasan at Kalusugan"),
    ("s5_8", "sec",  "5.8  Lugar ng Trabahong Walang Droga"),
    ("s5_9", "sec",  "5.9  Laban sa Sexual Harassment"),
    ("s5_10", "sec", "5.10  Mental Health"),

    ("p6",   "part", "MGA AKSYON SA TRABAHO AT PAGHIHIWALAY"),
    ("s6_1", "sec",  "6.1  Promotion, Transfer"),
    ("s6_2", "sec",  "6.2  Pagsusuri ng Performance"),
    ("s6_3", "sec",  "6.3  Pagtatapos ng Trabaho"),
    ("s6_4", "sec",  "6.4  Pagbibitiw"),
    ("s6_5", "sec",  "6.5  Huling Sahod"),

    ("p7",   "part", "MGA FORM AT SANGGUNIAN"),
    ("anxA", "form", "NOTICE TO EXPLAIN"),
    ("anxB", "form", "NAKASULAT NA PALIWANAG NG EMPLEYADO"),
    ("anxC", "form", "ABISO NG ADMINISTRATIVE CONFERENCE"),
    ("anxD", "form", "CASE EVALUATION FORM"),
    ("anxE", "form", "NOTICE OF DECISION"),
    ("anxG", "form", "PAGKILALA AT PAGSANG-AYON NG EMPLEYADO"),
]


def norm(s):
    return re.sub(r"\s+", " ", s).strip().lower()


def heading_lines(page):
    """Every text line on the page, as (normalised text, point size, colour)."""
    out = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            text = norm("".join(s.get("text", "") for s in spans))
            if not text:
                continue
            lead = max(spans, key=lambda s: s.get("size", 0))
            out.append((text, round(lead.get("size", 0), 1), lead.get("color", 0)))
    return out


pages = [heading_lines(doc[i]) for i in range(doc.page_count)]

out, missing = {}, []
for key, kind, needle in TARGETS:
    want_size, want_color = STYLES[kind]
    n = norm(needle)
    hit = None
    for i in range(SKIP, doc.page_count):
        for text, size, color in pages[i]:
            if n in text and abs(size - want_size) < 0.3 and color == want_color:
                hit = i
                break
        if hit is not None:
            break
    if hit is None:
        missing.append((key, kind, needle))
    else:
        out[key] = hit + 1 - OFFSET

# A contents listing must run forward. If entry N lands on an earlier page than entry
# N-1, something matched the wrong thing -- which is exactly how both original bugs
# would have looked. Fail loudly rather than shipping a plausible-looking wrong number.
order = [(k, out[k]) for k, _, _ in TARGETS if k in out]
regressions = [
    (order[i - 1], order[i]) for i in range(1, len(order)) if order[i][1] < order[i - 1][1]
]

json.dump(out, open(os.path.join(b, "pagemap-fil-emp.json"), "w"), indent=1)
print("mapped %d of %d" % (len(out), len(TARGETS)))
if missing:
    print("MISSING:")
    for k, kind, v in missing:
        print("   %-6s %-5s %s" % (k, kind, v))
if regressions:
    print("OUT OF ORDER (a heading resolved to an earlier page than the one before it):")
    for prev, cur in regressions:
        print("   %s p%d  ->  %s p%d" % (prev[0], prev[1], cur[0], cur[1]))
if not missing and not regressions:
    print("OK: every entry resolved, and page numbers run forward.")
