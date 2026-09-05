"""Give every drawing in the .docx a unique id.

docx-js emits `<wp:docPr id="1">` for every image it writes, so a document with more than
one picture ends up with repeated ids. The OOXML spec requires them to be unique within a
part, and while Word tolerates the duplicates on screen, its PDF export drops the
collisions: the cover page carried two drawings with id="1" -- the logo and the cover
photo -- and the exported PDF kept only one of them. The cover shipped without its logo.

This renumbers every wp:docPr (and the pic:cNvPr inside it) sequentially across the whole
package, then rewrites the archive. Run it after make.js and before converting to PDF.
"""

import re
import shutil
import sys
import zipfile

PARTS = re.compile(r"^word/(document|header\d*|footer\d*)\.xml$")


def renumber(path):
    with zipfile.ZipFile(path) as z:
        items = [(i, z.read(i.filename)) for i in z.infolist()]

    counter = [0]

    def bump(match):
        counter[0] += 1
        return '%s id="%d"' % (match.group(1), counter[0])

    changed = 0
    out = []
    for info, data in items:
        if PARTS.match(info.filename):
            xml = data.decode("utf-8")
            new, n = re.subn(r'(<wp:docPr|<pic:cNvPr) id="\d+"', bump, xml)
            if n:
                changed += n
                data = new.encode("utf-8")
        out.append((info, data))

    tmp = path + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for info, data in out:
            z.writestr(info, data)
    shutil.move(tmp, path)
    return changed


if __name__ == "__main__":
    target = sys.argv[1]
    print("renumbered %d drawing ids in %s" % (renumber(target), target))
