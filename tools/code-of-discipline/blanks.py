import pymupdf, os, re, sys
b=os.path.dirname(os.path.abspath(__file__))
src=sys.argv[1] if len(sys.argv)>1 else "out.pdf"   # any edition
d=pymupdf.open(os.path.join(b,src))
for i in range(d.page_count):
    t=re.sub(r"\s+"," ",d[i].get_text()).strip()
    # strip running header/footer
    t=t.replace("CODE OF DISCIPLINE","").replace("TXTAIRE OPC | Code of Discipline | Series 2, 2026 Edition","")
    t=re.sub(r"\d+ \| Page","",t).strip()
    if len(t) < 260:
        print("page %2d  chars=%3d  %s" % (i+1, len(t), t[:150]))
