import pymupdf, os, sys
b = os.path.dirname(os.path.abspath(__file__))
d = pymupdf.open(os.path.join(b, "out-fil.pdf"))
out = os.path.join(b, "pv")
for f in os.listdir(out):
    os.remove(os.path.join(out, f))
for i in range(d.page_count):
    d[i].get_pixmap(dpi=90).save(os.path.join(out, "v%02d.png" % (i + 1)))
print("pages", d.page_count)
