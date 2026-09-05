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
doc = pymupdf.open(os.path.join(b, "out.pdf"))

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
    ("soc",  "sec",  "Summary of Changes"),
    ("socA", "sub",  "A.  Penalties that were reduced"),
    ("socB", "sub",  "B.  Provisions withdrawn as contrary to law"),
    ("socC", "sub",  "C.  What is new in this edition"),
    ("socD", "sub",  "D.  Benefits and standards brought up to current law"),

    ("p1",   "part", "INTRODUCTION AND GENERAL POLICIES"),
    ("s1_1", "sec",  "1.1  Objective and Scope"),
    ("s1_2", "sec",  "1.2  Responsibility for Implementation"),
    ("s1_3", "sec",  "1.3  Equal Employment Opportunity"),
    ("s1_4", "sec",  "1.4  Policy on Probationary Employment"),
    ("s1_5", "sec",  "1.5  Definition of Terms"),
    ("s1_6", "sec",  "1.6  Manual Revisions and Suggestions"),

    ("p2",   "part", "COMPANY ETHICAL STANDARDS"),
    ("s2_1", "sec",  "2.1  Our Values in Practice"),
    ("s2_2", "sec",  "2.2  Standards of Business Conduct"),
    ("s2_3", "sec",  "2.3  Conflict of Interest"),
    ("s2_4", "sec",  "2.4  Gifts, Commissions and Entertainment"),
    ("s2_5", "sec",  "2.5  Confidentiality and Data Privacy"),
    ("s2_6", "sec",  "2.6  Company Property and Resources"),
    ("s2_7", "sec",  "2.7  Conduct Towards Clients and the Public"),
    ("s2_8", "sec",  "2.8  Respect in the Workplace"),
    ("s2_9", "sec",  "2.9  Social Media and Public Communication"),
    ("s2_10", "sec", "2.10  Reporting Concerns and Protection"),

    ("p3",   "part", "THE DISCIPLINARY PROCESS"),
    ("s3_1", "sec",  "3.1  Principles of Corrective Discipline"),
    ("s3_2", "sec",  "3.2  Disciplinary Actions Defined"),
    ("s3_3", "sec",  "3.3  Classification of Offenses"),
    ("s3_4", "sec",  "3.4  Schedule of Penalties"),
    ("s3_5", "sec",  "3.5  Mitigating and Aggravating Circumstances"),
    ("s3_6", "sec",  "3.6  Due Process"),
    ("s3_7", "sec",  "3.7  The Administrative Review Panel"),
    ("s3_8", "sec",  "3.8  Preventive Suspension"),
    ("s3_9", "sec",  "3.9  Appeal"),
    ("s3_10", "sec", "3.10  Habitual Delinquency"),
    ("s3_11", "sec", "3.11  Prescription and Clearing of Records"),
    ("s3_12", "sec", "3.12  Restitution and the Prohibition on Fines"),
    ("s3_13", "sec", "3.13  Management Prerogative and Employee Rights"),

    ("p4",   "part", "SCHEDULE OF OFFENSES"),
    ("s4_1", "sec",  "4.1  Offenses Against Attendance"),
    ("s4_2", "sec",  "4.2  Offenses on Timekeeping"),
    ("s4_3", "sec",  "4.3  Offenses Against Health, Safety"),
    ("s4_4", "sec",  "4.4  Offenses Related to Job Performance"),
    ("s4_5", "sec",  "4.5  Offenses Against Company and Client Property"),
    ("s4_6", "sec",  "4.6  Offenses Against Honesty and Integrity"),
    ("s4_7", "sec",  "4.7  Offenses Against Proper Conduct"),
    ("s4_8", "sec",  "4.8  Accountability of Supervisors"),

    ("p5",   "part", "WORKPLACE STANDARDS AND BENEFITS"),
    ("s5_1", "sec",  "5.1  Hours of Work, Attendance"),
    ("s5_2", "sec",  "5.2  Overtime, Undertime and Rest Days"),
    ("s5_3", "sec",  "5.3  Leaves of Absence"),
    ("s5_4", "sec",  "5.4  Payroll and Timekeeping"),
    ("s5_5", "sec",  "5.5  Holiday Pay Rules"),
    ("s5_6", "sec",  "5.6  Statutory Benefits"),
    ("s5_7", "sec",  "5.7  Occupational Safety and Health"),
    ("s5_8", "sec",  "5.8  Drug-Free Workplace"),
    ("s5_9", "sec",  "5.9  Anti-Sexual Harassment and Safe Spaces"),
    ("s5_10", "sec", "5.10  Mental Health and Non-Discrimination"),

    ("p6",   "part", "EMPLOYMENT ACTIONS AND SEPARATION"),
    ("s6_1", "sec",  "6.1  Promotions, Transfers and Reclassification"),
    ("s6_2", "sec",  "6.2  Performance Evaluation"),
    ("s6_3", "sec",  "6.3  Termination by the Employer"),
    ("s6_4", "sec",  "6.4  Resignation"),
    ("s6_5", "sec",  "6.5  Final Pay, Clearance"),

    ("p7",   "part", "FORMS AND REFERENCE"),
    ("anxA", "form", "NOTICE TO EXPLAIN"),
    ("anxB", "form", "EMPLOYEE WRITTEN EXPLANATION"),
    ("anxC", "form", "NOTICE OF ADMINISTRATIVE CONFERENCE"),
    ("anxD", "form", "CASE EVALUATION FORM"),
    ("anxE", "form", "NOTICE OF DECISION"),
    ("anxF", "form", "COMPLIANCE CHECKLIST AS HEADCOUNT GROWS"),
    ("anxG", "form", "EMPLOYEE ACKNOWLEDGMENT AND CONFORME"),
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

json.dump(out, open(os.path.join(b, "pagemap.json"), "w"), indent=1)
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
