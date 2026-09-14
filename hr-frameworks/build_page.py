# -*- coding: utf-8 -*-
"""Build a single self-contained HTML viewer with every framework image embedded."""

import base64, html, os
from content import FRAMEWORKS

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "images")


def b64(name):
    with open(os.path.join(IMG, name), "rb") as fh:
        return "data:image/png;base64," + base64.b64encode(fh.read()).decode("ascii")


def esc(s):
    return html.escape(s, quote=True)


CSS = """
*,*::before,*::after{box-sizing:border-box;}
:root{
  --ground:#F6F8F5; --surface:#FFFFFF; --sunk:#ECF1ED;
  --ink:#1F262A; --muted:#5B6A62; --hair:#D8E0DA;
  --accent:#1E7145; --accent-soft:#E3EFE8; --accent-ink:#155638;
  --amber:#8F5C08; --amber-soft:#FAF2E1; --amber-hair:#E8D6AE;
  --shadow:0 1px 2px rgba(22,40,30,.05), 0 18px 40px -26px rgba(22,40,30,.45);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#11151A; --surface:#191F23; --sunk:#212A2E;
    --ink:#E6EDE8; --muted:#9DABA3; --hair:#2D3A35;
    --accent:#5DB88C; --accent-soft:#1B3128; --accent-ink:#8FD3AE;
    --amber:#D9A954; --amber-soft:#2A2317; --amber-hair:#4A3D22;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 40px -26px rgba(0,0,0,.8);
  }
}
:root[data-theme="dark"]{
  --ground:#11151A; --surface:#191F23; --sunk:#212A2E;
  --ink:#E6EDE8; --muted:#9DABA3; --hair:#2D3A35;
  --accent:#5DB88C; --accent-soft:#1B3128; --accent-ink:#8FD3AE;
  --amber:#D9A954; --amber-soft:#2A2317; --amber-hair:#4A3D22;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 40px -26px rgba(0,0,0,.8);
}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:"Source Sans 3","Segoe UI",system-ui,sans-serif;
  font-size:17px; line-height:1.6; -webkit-font-smoothing:antialiased;
}
h1,h2,h3,.face{font-family:"Archivo","Segoe UI",system-ui,sans-serif;}
a{color:var(--accent-ink); text-underline-offset:3px;}
:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:4px;}

.shell{display:grid; grid-template-columns:290px minmax(0,1fr); gap:48px; max-width:1500px; margin:0 auto; padding:0 32px 96px;}

/* ---- rail ---- */
.rail{position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:40px 0 40px; display:flex; flex-direction:column; gap:22px;}
.brand{display:flex; flex-direction:column; gap:6px;}
.brand .mark{font-family:"Archivo"; font-weight:700; font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent);}
.brand h1{margin:0; font-size:26px; line-height:1.15; font-weight:700; letter-spacing:-.01em; text-wrap:balance;}
.brand p{margin:0; font-size:14px; color:var(--muted);}
.toc{display:flex; flex-direction:column; gap:2px; border-top:1px solid var(--hair); padding-top:14px;}
.toc a{display:grid; grid-template-columns:30px 1fr; gap:10px; align-items:baseline; padding:8px 10px; border-radius:7px; text-decoration:none; color:var(--ink); font-size:15px; line-height:1.35;}
.toc a span{font-family:"Archivo"; font-variant-numeric:tabular-nums; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.04em;}
.toc a:hover{background:var(--sunk);}
.toc a.on{background:var(--accent-soft); color:var(--accent-ink); font-weight:600;}
.toc a.on span{color:var(--accent-ink);}
.rail footer{margin-top:auto; font-size:12.5px; color:var(--muted); border-top:1px solid var(--hair); padding-top:14px;}

/* ---- main ---- */
main{padding:40px 0 0; min-width:0;}
.lede{background:var(--surface); border:1px solid var(--hair); border-radius:14px; padding:30px 34px; box-shadow:var(--shadow); margin-bottom:14px;}
.lede h2{margin:0 0 10px; font-size:21px; font-weight:600; letter-spacing:-.01em;}
.lede p{margin:0 0 14px; max-width:70ch; color:var(--muted);}
.lede p:last-child{margin-bottom:0;}
.howto{display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-top:20px; padding-top:20px; border-top:1px solid var(--hair);}
.howto div{font-size:14.5px; line-height:1.5;}
.howto b{display:block; font-family:"Archivo"; font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin-bottom:5px;}

section.fw{padding-top:56px;}
.head{display:flex; align-items:baseline; gap:14px; flex-wrap:wrap;}
.num{font-family:"Archivo"; font-weight:700; font-size:13px; letter-spacing:.14em; color:var(--accent); font-variant-numeric:tabular-nums;}
.head h2{margin:0; font-size:32px; font-weight:700; letter-spacing:-.02em; text-wrap:balance;}
.gist{margin:12px 0 0; max-width:74ch; color:var(--muted);}
.laws{display:flex; flex-wrap:wrap; gap:7px; margin:16px 0 0; padding:0; list-style:none;}
.laws li{font-size:12.5px; line-height:1; padding:7px 10px; border:1px solid var(--hair); border-radius:999px; background:var(--surface); color:var(--muted);}
.laws li:first-child{background:var(--accent-soft); border-color:transparent; color:var(--accent-ink); font-weight:600;}

figure{margin:22px 0 0; background:var(--surface); border:1px solid var(--hair); border-radius:14px; padding:12px; box-shadow:var(--shadow);}
figure img{display:block; width:100%; height:auto; border-radius:7px; cursor:zoom-in;}
figcaption{display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; font-size:13px; color:var(--muted); padding:12px 8px 4px;}

.reminder{display:flex; gap:12px; margin-top:16px; padding:16px 18px; background:var(--amber-soft); border:1px solid var(--amber-hair); border-left:4px solid var(--amber); border-radius:10px; font-size:15px; color:var(--ink);}
.reminder b{font-family:"Archivo"; font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--amber); white-space:nowrap; padding-top:3px;}

/* ---- lightbox ---- */
dialog.zoom{border:none; padding:0; background:transparent; max-width:98vw; max-height:98vh;}
dialog.zoom::backdrop{background:rgba(10,16,13,.86);}
dialog.zoom img{display:block; width:min(1900px,96vw); height:auto; border-radius:8px; cursor:zoom-out;}

@media (max-width:1020px){
  .shell{grid-template-columns:1fr; gap:0; padding:0 20px 64px;}
  .rail{position:static; height:auto; padding:32px 0 8px;}
  .toc{display:none;}
  .head h2{font-size:26px;}
}
@media print{
  .rail,.lede .howto{display:none;}
  .shell{display:block; padding:0;}
  section.fw{break-after:page; padding-top:0;}
  figure{border:none; box-shadow:none; padding:0;}
  body{background:#fff; color:#000;}
}
@media (prefers-reduced-motion:reduce){*{animation:none !important; transition:none !important;}}
"""

JS = """
const links=[...document.querySelectorAll('.toc a')];
const io=new IntersectionObserver(es=>{
  es.forEach(e=>{ if(e.isIntersecting){
    links.forEach(l=>l.classList.toggle('on', l.getAttribute('href')==='#'+e.target.id));
  }});
},{rootMargin:'-15% 0px -70% 0px'});
document.querySelectorAll('section.fw').forEach(s=>io.observe(s));

const dlg=document.getElementById('zoom'), big=dlg.querySelector('img');
document.querySelectorAll('figure img').forEach(im=>{
  im.addEventListener('click',()=>{ big.src=im.src; big.alt=im.alt; dlg.showModal(); });
});
dlg.addEventListener('click',()=>dlg.close());
"""


def build():
    toc, secs = [], []
    for i, fw in enumerate(FRAMEWORKS):
        n = "%02d" % (i + 1)
        sid = fw["file"]
        toc.append('<a href="#%s"><span>%s</span>%s</a>' % (sid, n, esc(fw["title"].title())))

        laws = [p.strip() for p in fw["basis"].replace("LEGAL BASIS: ", "").split("|")]
        chips = "".join("<li>%s</li>" % esc(l) for l in laws)
        steps = " &rsaquo; ".join(esc(p["name"].replace("\n", " ")) for p in fw["phases"])
        secs.append("""
<section class="fw" id="{sid}">
  <div class="head"><p class="num">{n} / 08</p><h2>{title}</h2></div>
  <p class="gist">{gist}</p>
  <ul class="laws">{chips}</ul>
  <figure>
    <img src="{src}" alt="{title} framework: {steps}" loading="lazy">
    <figcaption><span>{steps}</span><span>Click to enlarge &middot; {fname}.png</span></figcaption>
  </figure>
  <p class="reminder"><b>Compliance</b><span>{note}</span></p>
</section>""".format(sid=sid, n=n, title=esc(fw["title"].title()), gist=esc(fw["what"]),
                     chips=chips, src=b64(fw["file"] + ".png"), steps=steps,
                     fname=fw["file"], note=esc(fw["note"].replace("REMINDER: ", ""))))

    page = """<title>PH HR Framework Library</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Sans+3:wght@400;600&display=swap">
<style>%s</style>
<div class="shell">
  <aside class="rail">
    <div class="brand">
      <p class="mark">Philippines &middot; HR Operations</p>
      <h1>HR Framework Library</h1>
      <p>Eight processes, five steps each, with the output that proves every step.</p>
    </div>
    <nav class="toc">%s</nav>
    <footer>Built on the Labor Code of the Philippines, DOLE department orders and related special laws. Contribution rates and agency circulars change &mdash; verify current issuances before applying.</footer>
  </aside>

  <main>
    <div class="lede">
      <h2>One page per process, ready to post</h2>
      <p>Each framework runs left to right through five steps. The colored column is what to do; the card beneath it is the document the step must produce, so an audit trail builds itself as the work happens. The amber bar carries the compliance point most often missed.</p>
      <p>The images are 2000&nbsp;px PNGs sized for A4 landscape &mdash; drop them into a deck, print them, or pin them where the work is done.</p>
      <div class="howto">
        <div><b>Legal basis</b>The statute, article or department order each step answers to.</div>
        <div><b>Five steps</b>The official sequence, numbered in order of execution.</div>
        <div><b>Output</b>The record that proves the step was completed.</div>
        <div><b>Compliance</b>The failure point that turns a valid action into a violation.</div>
      </div>
    </div>
    %s
  </main>
</div>
<dialog class="zoom" id="zoom"><img src="" alt=""></dialog>
<script>%s</script>
""" % (CSS, "".join(toc), "".join(secs), JS)

    out = os.path.join(HERE, "library.html")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(page)
    print(out, "%.1f MB" % (os.path.getsize(out) / 1048576.0))


if __name__ == "__main__":
    build()
