# -*- coding: utf-8 -*-
"""Render the HR framework pages as PNG images (PowerPoint / print ready)."""

import os
from PIL import Image, ImageDraw, ImageFont
from content import FRAMEWORKS

HERE = os.path.dirname(os.path.abspath(__file__))

# Everything below is laid out in 1x design units; S multiplies them at draw
# time, so a higher scale gives a genuinely sharper render (not an upscale).
S = float(os.environ.get("SCALE", "1"))
OUT = os.path.join(HERE, "images" if S == 1 else "images-print")
os.makedirs(OUT, exist_ok=True)

FDIR = "C:/Windows/Fonts/"
BOLD = FDIR + "segoeuib.ttf"
SEMI = FDIR + "seguisb.ttf"
REG = FDIR + "segoeui.ttf"

_cache = {}
_hires = {}
def F(path, size):
    """Font at design size (used for measuring); its scaled twin does the drawing."""
    k = (path, size)
    if k not in _cache:
        f = ImageFont.truetype(path, size)
        _cache[k] = f
        _hires[id(f)] = f if S == 1 else ImageFont.truetype(path, max(1, int(round(size * S))))
    return _cache[k]


class Scaled:
    """ImageDraw wrapper: takes design-unit coordinates, draws at S."""

    def __init__(self, d):
        self.d = d

    def _box(self, b):
        return [v * S for v in b]

    def _kw(self, kw):
        if "width" in kw:
            kw["width"] = max(1, int(round(kw["width"] * S)))
        return kw

    def rectangle(self, box, **kw):
        self.d.rectangle(self._box(box), **self._kw(kw))

    def rounded_rectangle(self, box, radius=0, **kw):
        self.d.rounded_rectangle(self._box(box), radius * S, **self._kw(kw))

    def ellipse(self, box, **kw):
        self.d.ellipse(self._box(box), **self._kw(kw))

    def text(self, xy, txt, font=None, fill=None):
        self.d.text((xy[0] * S, xy[1] * S), txt, font=_hires[id(font)], fill=fill)

W = 2000
M = 70
CW = W - 2 * M
GAP = 20
COLW = (CW - 4 * GAP) // 5

HEAD = ["#1D6A8A", "#8B1A58", "#B87409", "#A2382C", "#48205C"]
BODY = ["#25789B", "#9C2069", "#A66A08", "#B04034", "#572A6E"]
INK = "#3B3B3B"
GREEN = "#1E7145"
SOFT = "#F1F3F4"
LINE = "#D8DCDE"

# ---------------------------------------------------------------- text utils
_scratch = ImageDraw.Draw(Image.new("RGB", (10, 10)))

def wrap(text, font, maxw):
    lines = []
    for para in text.split("\n"):
        words, cur = para.split(), ""
        for w in words:
            t = (cur + " " + w).strip()
            if _scratch.textlength(t, font=font) <= maxw or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines

def draw_lines(d, xy, lines, font, fill, lh, align="left", boxw=0):
    x, y = xy
    for ln in lines:
        if align == "center":
            d.text((x + (boxw - _scratch.textlength(ln, font=font)) / 2, y), ln, font=font, fill=fill)
        else:
            d.text((x, y), ln, font=font, fill=fill)
        y += lh
    return y

# ---------------------------------------------------------------- metrics
FT = F(BOLD, 60)      # title
FB = F(REG, 21)       # legal basis
FDL = F(BOLD, 19)     # section label
FD = F(REG, 25)       # description
FH = F(BOLD, 29)      # phase title
FBD = F(SEMI, 22)     # phase bullets
FOL = F(BOLD, 18)     # output label
FO = F(REG, 21)       # output text
FN = F(SEMI, 19)      # footer note
FTAG = F(BOLD, 22)    # corner tag

LH_B, LH_D, LH_H, LH_BD, LH_O, LH_N = 27, 34, 36, 30, 28, 26
BULLET_GAP = 14
PAD = 22

def measure(fw):
    m = {}
    m["basis"] = wrap(fw["basis"], FB, CW)
    m["desc"] = wrap(fw["what"], FD, CW - 2 * PAD - 16)
    m["note"] = wrap(fw["note"], FN, CW - 2 * PAD - 16)
    m["top"] = 52 + 82 + len(m["basis"]) * LH_B + 18 + (PAD + 26 + 10 + len(m["desc"]) * LH_D + PAD) + 34
    m["head_h"] = 0
    m["body_h"] = 0
    m["out_h"] = 0
    for p in fw["phases"]:
        hl = wrap(p["name"], FH, COLW - 30)
        m["head_h"] = max(m["head_h"], 30 + 44 + 14 + len(hl) * LH_H + 24)
        bh = PAD + 4
        for b in p["body"]:
            bh += len(wrap(b, FBD, COLW - 2 * PAD - 26)) * LH_BD + BULLET_GAP
        m["body_h"] = max(m["body_h"], bh + PAD)
        oh = 10 + 26 + 8 + len(wrap(p["out"], FO, COLW - 2 * 18)) * LH_O + 18
        m["out_h"] = max(m["out_h"], oh)
    return m

MS = [measure(fw) for fw in FRAMEWORKS]
TOP = max(m["top"] for m in MS)
HEAD_H = max(m["head_h"] for m in MS)
BODY_H = max(m["body_h"] for m in MS)
OUT_H = max(m["out_h"] for m in MS)
NOTE_H = max(PAD + len(m["note"]) * LH_N + PAD for m in MS)
H = TOP + HEAD_H + 16 + BODY_H + 32 + OUT_H + 30 + NOTE_H + 46

# ---------------------------------------------------------------- page
def render(idx, fw, m):
    img = Image.new("RGB", (int(W * S), int(H * S)), "white")
    d = Scaled(ImageDraw.Draw(img))

    # header rule + title
    d.rectangle([0, 0, W, 12], fill=GREEN)
    d.text((M, 52), fw["title"], font=FT, fill="#404040")
    tag = "HR FRAMEWORK  %02d / %02d" % (idx + 1, len(FRAMEWORKS))
    d.text((W - M - _scratch.textlength(tag, font=FTAG), 74), tag, font=FTAG, fill=GREEN)

    y = 52 + 82
    y = draw_lines(d, (M, y), m["basis"], FB, "#6B6B6B", LH_B) + 18

    # description panel
    bh = PAD + 26 + 10 + len(m["desc"]) * LH_D + PAD
    d.rounded_rectangle([M, y, M + CW, y + bh], 10, fill=SOFT)
    d.rectangle([M, y, M + 10, y + bh], fill=GREEN)
    d.text((M + 28, y + PAD - 4), "WHAT IT IS AND WHY IT MATTERS", font=FDL, fill=GREEN)
    draw_lines(d, (M + 28, y + PAD + 32), m["desc"], FD, "#333333", LH_D)

    ftop = TOP
    for i, p in enumerate(fw["phases"]):
        x = M + i * (COLW + GAP)
        hc, bc = HEAD[i], BODY[i]
        hb = ftop + HEAD_H
        bt = hb + 16

        # body block first, then header on top so the tab overlaps
        d.rounded_rectangle([x, bt, x + COLW, bt + BODY_H], 8, fill=bc)
        d.rounded_rectangle([x, ftop, x + COLW, hb], 8, fill=hc)
        cx = x + COLW // 2
        d.ellipse([cx - 27, hb - 27, cx + 27, hb + 27], fill=hc)
        if i < 4:  # side connector knob
            ky = ftop + int(HEAD_H * 0.55)
            d.ellipse([x + COLW - 13, ky - 13, x + COLW + 13, ky + 13], fill=hc)

        # number badge
        by = ftop + 30
        d.ellipse([cx - 23, by, cx + 23, by + 46], fill="white")
        n = str(i + 1)
        d.text((cx - _scratch.textlength(n, font=F(BOLD, 27)) / 2, by + 7), n, font=F(BOLD, 27), fill=hc)

        hl = wrap(p["name"], FH, COLW - 30)
        draw_lines(d, (x, by + 58), hl, FH, "white", LH_H, "center", COLW)

        ty = bt + PAD + 4
        for b in p["body"]:
            bl = wrap(b, FBD, COLW - 2 * PAD - 26)
            d.ellipse([x + PAD, ty + 9, x + PAD + 9, ty + 18], fill="white")
            draw_lines(d, (x + PAD + 26, ty), bl, FBD, "white", LH_BD)
            ty += len(bl) * LH_BD + BULLET_GAP

        # output card
        oy = bt + BODY_H + 32
        d.rounded_rectangle([x, oy, x + COLW, oy + OUT_H], 8, fill="white", outline=LINE, width=2)
        d.rectangle([x + 2, oy + 2, x + COLW - 2, oy + 10], fill=hc)
        d.text((x + 18, oy + 20), "OUTPUT", font=FOL, fill=hc)
        draw_lines(d, (x + 18, oy + 54), wrap(p["out"], FO, COLW - 36), FO, "#333333", LH_O)

    ny = TOP + HEAD_H + 16 + BODY_H + 32 + OUT_H + 30
    d.rounded_rectangle([M, ny, M + CW, ny + NOTE_H], 10, fill="#FBF3E2")
    d.rectangle([M, ny, M + 10, ny + NOTE_H], fill="#B87409")
    draw_lines(d, (M + 28, ny + PAD - 2), m["note"], FN, "#6B4A05", LH_N)

    f = os.path.join(OUT, fw["file"] + ".png")
    img.save(f, "PNG")
    return f


# ---------------------------------------------------------------- index page
def render_index():
    img = Image.new("RGB", (int(W * S), int(H * S)), "white")
    d = Scaled(ImageDraw.Draw(img))
    d.rectangle([0, 0, W, 12], fill=GREEN)
    d.text((M, 52), "HR FRAMEWORK LIBRARY", font=FT, fill="#404040")
    sub = ("Eight process frameworks aligned with the Labor Code of the Philippines, DOLE issuances "
           "and related special laws. Each page carries the legal basis, what the process is, a five-step "
           "process, and the output required at every step.")
    y = draw_lines(d, (M, 140), wrap(sub, FB, CW), FB, "#6B6B6B", LH_B) + 34

    cols, cw = 4, (CW - 3 * GAP) // 4
    pal = HEAD + HEAD[:3]

    def gist(fw):
        return fw["what"].split(". ")[0].rstrip(".") + "."

    def steps_of(fw):
        return "  >  ".join(p["name"].replace("\n", " ") for p in fw["phases"])

    ch = 0
    for fw in FRAMEWORKS:
        ch = max(ch, 128 + len(wrap(gist(fw), F(REG, 20), cw - 40)) * 27 + 14 + 28
                 + len(wrap(steps_of(fw), F(SEMI, 18), cw - 40)) * 25 + 24)

    for i, fw in enumerate(FRAMEWORKS):
        r, c = divmod(i, cols)
        x = M + c * (cw + GAP)
        yy = y + r * (ch + GAP)
        col = pal[i % len(pal)]
        d.rounded_rectangle([x, yy, x + cw, yy + ch], 10, fill="white", outline=LINE, width=2)
        d.rounded_rectangle([x, yy, x + cw, yy + 108], 10, fill=col)
        d.rectangle([x, yy + 80, x + cw, yy + 108], fill=col)
        num = "%02d" % (i + 1)
        d.text((x + 20, yy + 14), num, font=F(BOLD, 34), fill="#FFFFFF")
        tl = wrap(fw["title"], F(BOLD, 24), cw - 104)
        draw_lines(d, (x + 84, yy + 22 if len(tl) > 1 else yy + 36), tl, F(BOLD, 24), "white", 31)
        steps = steps_of(fw)
        ly = draw_lines(d, (x + 20, yy + 128), wrap(gist(fw), F(REG, 20), cw - 40), F(REG, 20), "#3B3B3B", 27)
        d.text((x + 20, ly + 14), "PROCESS", font=F(BOLD, 16), fill=col)
        draw_lines(d, (x + 20, ly + 42), wrap(steps, F(SEMI, 18), cw - 40), F(SEMI, 18), "#555555", 25)

    ny = y + 2 * (ch + GAP) + 10
    note = ("HOW TO USE: Print one page per process and post it where the work happens. The five columns are the "
            "official sequence, the OUTPUT card under each column is the document that proves the step was done, "
            "and the amber bar carries the compliance reminder. Review annually or whenever a law, DOLE order or "
            "agency circular changes.")
    nl = wrap(note, FN, CW - 2 * PAD - 16)
    nh = PAD + len(nl) * LH_N + PAD
    d.rounded_rectangle([M, ny, M + CW, ny + nh], 10, fill=SOFT)
    d.rectangle([M, ny, M + 10, ny + nh], fill=GREEN)
    draw_lines(d, (M + 28, ny + PAD - 2), nl, FN, "#444444", LH_N)

    f = os.path.join(OUT, "00-index.png")
    img.crop((0, 0, int(W * S), int(min(H, ny + nh + 46) * S))).save(f, "PNG")
    return f


if __name__ == "__main__":
    print("canvas: %d x %d" % (W, H))
    print(render_index())
    for i, (fw, m) in enumerate(zip(FRAMEWORKS, MS)):
        print(render(i, fw, m))
