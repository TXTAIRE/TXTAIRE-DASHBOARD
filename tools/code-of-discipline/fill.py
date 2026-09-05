"""Report how full each page is, so sparse pages get found by measurement not by eye."""
import os
import pymupdf

b = os.path.dirname(os.path.abspath(__file__))
d = pymupdf.open(os.path.join(b, "out.pdf"))
FOOTER_TOP = 0.93   # ignore the running footer when measuring content depth

rows = []
for i in range(d.page_count):
    page = d[i]
    h = page.rect.height
    bottom = 0.0
    for blk in page.get_text("blocks"):
        y1 = blk[3] / h
        if y1 < FOOTER_TOP:
            bottom = max(bottom, y1)
    for img in page.get_images(full=True):
        try:
            for r in page.get_image_rects(img[0]):
                if r.y1 / h < FOOTER_TOP:
                    bottom = max(bottom, r.y1 / h)
        except Exception:
            pass
    rows.append((i + 1, bottom))

sparse = [(p, f) for p, f in rows if f < 0.62]
print("pages: %d   average fill: %.0f%%" % (d.page_count, 100 * sum(f for _, f in rows) / len(rows)))
print()
if sparse:
    print("SPARSE PAGES (content ends above 62%% of the page):")
    for p, f in sparse:
        head = " ".join(d[p - 1].get_text().split())[:64]
        print("  PDF p%-3d fill %3.0f%%   %s" % (p, 100 * f, head))
else:
    print("No sparse pages.")
