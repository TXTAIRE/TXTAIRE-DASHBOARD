"""Catch headings stranded at the foot of a page with nothing under them.

A Part banner or section heading that is the last thing on a page reads as a mistake --
Part III shipped that way once, alone at the bottom of page 12. Body text is 10.5pt; any
heading is larger, so "is the lowest text on the page bigger than body text" is a reliable
test without needing to know which heading style it is.
"""
import os
import pymupdf

b = os.path.dirname(os.path.abspath(__file__))
d = pymupdf.open(os.path.join(b, "out-emp.pdf"))
FOOTER_TOP = 0.93
BODY_PT = 10.5

bad = []
for i in range(2, d.page_count):  # skip the cover section, which is a designed layout
    page = d[i]
    h = page.rect.height
    lowest = None
    for blk in page.get_text("dict").get("blocks", []):
        for line in blk.get("lines", []):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            if not spans:
                continue
            y = line["bbox"][3] / h
            if y >= FOOTER_TOP:
                continue
            size = max(s.get("size", 0) for s in spans)
            text = "".join(s.get("text", "") for s in spans).strip()
            if lowest is None or y > lowest[0]:
                lowest = (y, size, text)
    if lowest and lowest[1] > BODY_PT + 0.4:
        bad.append((i + 1, lowest))

print("checked %d pages" % d.page_count)
if bad:
    print("STRANDED HEADINGS (page ends on a heading):")
    for p, (y, size, text) in bad:
        print("  PDF p%-3d  %.1fpt at %.0f%% down:  %s" % (p, size, 100 * y, text[:60]))
else:
    print("OK: no page ends on a heading.")
