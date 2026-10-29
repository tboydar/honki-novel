#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""產生 docs/ 靜態網站：重生之 Debug 博士逆轉台北（GitHub Pages 用）。可重複執行。"""
import html, json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "novel")
CHAP = os.path.join(SRC, "chapters")
DOCS = os.path.join(ROOT, "docs")
IMG = os.path.join(DOCS, "images")
VERSION = "v20261029.4"
TITLE = "重生之 Debug 博士逆轉台北"
TAGLINE = "帶著八十年的記憶，再戰一次台北。"
SITE_URL = "https://tboydar.github.io/honki-novel/"
DESC = ("2061 年，八十歲的 Debug 博士死在沒有人相信真相的台北；再睜眼，他回到投票前三十三天。"
        "這一世，他帶著一個講台灣國語的洋人 AI 妹妹，要讓「深偽之夜」永遠不會發生。都市重生 × 科技選戰 × 打詐快意小說。")

def esc(s): return html.escape(s, quote=True)
def read(p):
    with open(p, encoding="utf-8") as f: return f.read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(s)
def cjk(s): return len(re.findall(r"[一-鿿]", s))
def inline(s):
    """跳脫後處理 **粗體**"""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc(s))

# ---------------- 資料 ----------------
def load_outline():
    text = read(os.path.join(SRC, "outlines.md"))
    out = {}
    for m in re.finditer(r"^## (\d\d)｜(.+?)\n時間：(.+?)\n(.*?)(?=^## \d\d｜|\Z)", text, re.S | re.M):
        no, full, when = m.group(1), m.group(2).strip(), m.group(3).strip()
        label, _, name = full.partition("　")
        out[no] = {"no": no, "full": full, "label": label, "name": name or full, "when": when}
    return out

def load_lessons():
    text = read(os.path.join(SRC, "lessons.md"))
    out = {}
    for m in re.finditer(r"^## (\d\d)｜(.+?)\n(.*?)(?=^## |\Z)", text, re.S | re.M):
        items = [ln[2:].strip() for ln in m.group(3).splitlines() if ln.startswith("- ")]
        out[m.group(1)] = {"title": m.group(2).strip(), "items": items}
    src = re.search(r"^## 資料來源\n(.*)", text, re.S | re.M)
    sources = [ln[2:].strip() for ln in src.group(1).splitlines() if ln.startswith("- ")] if src else []
    return out, sources

OUT = load_outline()
LESSONS, SOURCES = load_lessons()
NOS = [n for n in sorted(OUT) if os.path.exists(os.path.join(CHAP, f"{n}.md"))]

def load_storyboard(no):
    """novel/storyboards/NN.json → 有圖的分鏡格 [(img, beat, caption)]"""
    p = os.path.join(SRC, "storyboards", f"{no}.json")
    if not os.path.exists(p): return []
    import json
    out = []
    for i, panel in enumerate(json.loads(read(p)), 1):
        img = f"images/sb/{no}-{i}.jpg"
        if os.path.exists(os.path.join(DOCS, img)):
            out.append((img, panel.get("beat", ""), panel["caption"]))
    return out

SB = {no: load_storyboard(no) for no in NOS}

CHARACTERS = [
    ("Debug 博士", "主角", "本名程一凡，科技 YouTuber 兼大學講師，跨陣營「真相守護聯盟」技術召集人。圓框眼鏡、深藍連帽外套、胸前一隻瓢蟲徽章。前世八十歲死在後真相的台北，今世重生回投票前三十三天。口頭禪：「我們來 debug 一下。」"),
    ("艾莉絲", "金手指", "來自 2061 年的洋人 AI 妹妹，寄宿在Debug 博士的眼鏡上，只有他看得到。超級智慧，但中文是看夜市影片學的，滿口台灣國語，畢生心願是吃一碗滷肉飯。"),
    ("秀蘭嬤", "萬華滷肉飯", "巷口滷肉飯攤的阿嬤，Debug 博士學生時代的飯票恩人。前世被一支深偽投資影片騙光退休金——這一世，絕不。"),
    ("林曉晴", "開源志工", "資料記者、開源社群志工，最討厭作秀的政治人物。直到她看見Debug 博士把照妖鏡開源給所有陣營。"),
    ("阿凱", "吐槽擔當", "Debug 博士以前的學生，前端工程師，愛耍嘴皮子但可靠，飯糰不離手。"),
    ("Kevin", "被打臉專業戶", "百萬訂閱科技網紅，第一章就嗆「技術召集人？超級外行吧」，然後……被打臉打到懷疑人生。"),
    ("莫無影", "反派", "幻鏡科技執行長、深偽集團「鏡淵」首腦。永遠戴著一張完美得不像真人的臉。「我有十萬張臉。」"),
]

# ---------------- 樣式 ----------------
FONT_LINKS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  '<link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&family=Noto+Serif+TC:wght@400;700;900&display=swap" rel="stylesheet">')

FAVICON = ("<link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
           "<rect width='32' height='32' rx='4' fill='%23c8322f'/><rect x='4' y='4' width='24' height='24' rx='2' fill='none' stroke='%23f4ecdc' stroke-width='2'/>"
           "<text x='16' y='22' text-anchor='middle' font-size='15' font-family='serif' font-weight='700' fill='%23f4ecdc'>D</text></svg>\">")

# 設計系統：國潮漫劇（墨、宣紙、朱砂、金；霞鶩文楷＋思源宋體；小圓角＋硬邊位移陰影）
CSS_BASE = """
:root{
  --bg:#f4ecdc; --card:#fbf6ea; --ink:#141210; --muted:#5f574b; --line:rgba(20,18,16,.18);
  --seal:#c8322f; --gold:#c9962e; --panel:#141210; --on-panel:#f4ecdc;
  --dot:radial-gradient(rgba(20,18,16,.10) 1px,transparent 1.2px);
  --hard:4px 4px 0 var(--ink);
  color-scheme:light;
}
:root[data-theme="dark"]{
  --bg:#15120f; --card:#1f1a15; --ink:#efe6d4; --muted:#b3a893; --line:rgba(239,230,212,.18);
  --seal:#e04b3f; --gold:#d9a93f; --panel:#0c0a08; --on-panel:#efe6d4;
  --dot:radial-gradient(rgba(239,230,212,.07) 1px,transparent 1.2px);
  --hard:4px 4px 0 #000;
  color-scheme:dark;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);background-image:var(--dot);background-size:7px 7px;
  font-family:'Noto Serif TC','Songti TC','PMingLiU',serif;line-height:1.95;text-wrap:pretty}
a{color:var(--seal);text-underline-offset:.2em}
img{max-width:100%;display:block}
.display{font-family:'LXGW WenKai TC','Noto Serif TC',serif}
.seal{display:inline-block;background:var(--seal);color:#f4ecdc;border-radius:3px;padding:.02rem .5rem;
  font-size:.82rem;letter-spacing:.14em;font-family:'LXGW WenKai TC',serif;box-shadow:inset 0 0 0 2px rgba(244,236,220,.35)}
.topbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:30;background:var(--bg);border-bottom:2px solid var(--ink)}
.topbar .wrap{max-width:68rem;margin:0 auto;padding:.45rem 1rem;display:flex;align-items:center;gap:.6rem}
.topbar .brand{font-weight:700;text-decoration:none;color:var(--ink);letter-spacing:.04em;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar .brand b{color:var(--seal)}
.tbtn{all:unset;cursor:pointer;border:2px solid var(--ink);border-radius:4px;padding:.1rem .6rem;min-height:1.9rem;
  font-size:.85rem;color:var(--ink);white-space:nowrap;display:inline-flex;align-items:center;transition:transform .16s ease-out,box-shadow .16s ease-out}
.tbtn:hover{transform:translate(-1px,-1px);box-shadow:2px 2px 0 var(--ink)}
.tbtn:focus-visible,.btn:focus-visible,a:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.btn{display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;padding:.45rem 1.2rem;border:2px solid var(--ink);border-radius:4px;
  font-weight:700;letter-spacing:.08em;text-decoration:none;color:var(--ink);background:var(--card);box-shadow:var(--hard);
  transition:transform .16s ease-out,box-shadow .16s ease-out;cursor:pointer;font:inherit;font-weight:700}
.btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
.btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
.btn.primary{background:var(--seal);color:#f4ecdc}
footer.site{border-top:2px solid var(--ink);margin-top:3.5rem;padding:1.6rem 1rem 2.2rem;text-align:center;
  color:var(--muted);font-size:.85rem;line-height:1.9}
footer.site p{margin:.2rem auto;max-width:46rem}
footer.site .ver{letter-spacing:.14em;font-family:'LXGW WenKai TC',serif}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
"""

CSS_READ = CSS_BASE + """
.progress{position:fixed;left:0;top:0;height:4px;background:var(--seal);width:0;z-index:40}
main.read{max-width:40rem;margin:0 auto;padding:1.4rem 1.1rem 2rem}
.cover{margin:0 0 1.4rem}
.cover img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;border:3px solid var(--ink);box-shadow:var(--hard)}
.kicker{display:flex;align-items:center;gap:.6rem;margin:0 0 .2rem;color:var(--muted);font-size:.92rem;flex-wrap:wrap}
h1.title{font-size:clamp(1.9rem,6vw,2.6rem);line-height:1.35;margin:.3rem 0 .4rem;letter-spacing:.02em}
.when{color:var(--muted);margin:0 0 1.8rem;font-size:.95rem}
.tools{display:flex;gap:.5rem;flex-wrap:wrap;margin:0 0 1.6rem}
article.body{font-size:var(--fs,1.1rem)}
article.body p{margin:0 0 1.15em;text-align:justify;transition:background .2s}
article.body p.speaking{background:color-mix(in srgb,var(--gold) 22%,transparent)}
article.body .sys{margin:1.4em 0;padding:.65em 1em;border-radius:3px;background:var(--panel);color:#f2d27a;
  font-family:'LXGW WenKai TC','Noto Serif TC',serif;font-weight:700;font-size:.98em;line-height:1.7;border:2px solid var(--ink);
  box-shadow:4px 4px 0 var(--seal)}
article.body hr.scene{border:0;text-align:center;margin:2.2em 0}
article.body hr.scene::after{content:"◆　◇　◆";color:var(--seal);letter-spacing:.3em;font-size:.8rem}
.world-entry{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin:0 0 1.8rem;padding:.75rem 1rem;
  border:2px dashed var(--ink);border-radius:4px;font-size:.92rem;color:var(--muted);line-height:1.7}
.world-entry span{flex:1;min-width:12rem}
.lesson{margin:2.8rem 0 0;border:3px solid var(--ink);border-radius:4px;background:var(--card);box-shadow:var(--hard)}
.lesson h2{margin:0;padding:.6rem 1rem;background:var(--panel);color:var(--on-panel);font-size:1.12rem;letter-spacing:.06em}
.lesson h2 small{display:inline-block;background:var(--seal);color:#f4ecdc;font-size:.75rem;letter-spacing:.16em;font-weight:400;
  padding:0 .45rem;border-radius:2px;margin-right:.5rem;vertical-align:.15em}
.lesson ul{margin:0;padding:.9rem 1.1rem .9rem 2.2rem;font-size:.98rem;line-height:1.85}
.lesson li{margin:.35em 0}
.lesson li::marker{color:var(--seal)}
.lesson .more{padding:0 1.1rem 1rem;font-size:.9rem}
.ending{margin:2.4rem 0 0;padding:1.1rem 1.2rem;border:3px double var(--seal);text-align:center;border-radius:4px}
.ending .n{font-family:'LXGW WenKai TC',serif;font-size:1.6rem;color:var(--seal);letter-spacing:.1em}
.pager{display:flex;justify-content:space-between;gap:1rem;margin-top:2.4rem;padding-top:1.2rem;border-top:2px solid var(--ink)}
.pager a{text-decoration:none;font-weight:700;max-width:48%;color:var(--ink)}
.pager a:hover{color:var(--seal)}
.pager .r{text-align:right;margin-left:auto}
.hint{text-align:center;color:var(--muted);font-size:.8rem;margin-top:1rem}
.sb{position:relative;left:50%;transform:translateX(-50%);width:min(68rem,calc(100vw - 2rem));margin:0 0 2.4rem}
.sb-h{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:0 0 .9rem;font-size:1.3rem}
.sb-h span{background:var(--seal);color:#f4ecdc;padding:.05rem .7rem;border-radius:3px;letter-spacing:.12em}
.sb-h small{color:var(--muted);font-size:.88rem;font-weight:400}
.sb-h .tbtn{margin-left:auto}
.sb-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem}
.sb-grid li:nth-child(4n+1) figure{transform:rotate(-.4deg)} .sb-grid li:nth-child(4n+3) figure{transform:rotate(.35deg)}
.sb-grid figure{margin:0;background:var(--panel);border:3px solid var(--ink);border-radius:3px;overflow:hidden;box-shadow:var(--hard)}
.sb-grid img{width:100%;height:auto;aspect-ratio:7/4;object-fit:cover}
.sb-grid figcaption{background:#fbf6ea;color:#141210;padding:.5rem .75rem .6rem;font-family:'LXGW WenKai TC','Noto Serif TC',serif;
  font-weight:700;font-size:1.02rem;line-height:1.55;border-top:3px solid #141210}
.sb-grid figcaption b{display:inline-block;background:#c8322f;color:#f4ecdc;font-size:.72rem;padding:0 .45rem;margin-right:.4rem;
  border-radius:2px;vertical-align:.15em;letter-spacing:.1em}
.sb-grid li.on figure{box-shadow:4px 4px 0 var(--seal);outline:3px solid var(--gold)}
.sb-skip{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;font-size:.86rem;margin:.7rem 0 0;color:var(--muted)}
.comic-ch{margin:0 0 3rem}
.comic-ch h2{font-size:1.3rem;margin:0 0 .8rem}
.comic-ch h2 a{color:var(--ink);text-decoration:none}
"""

CSS_INDEX = CSS_BASE + """
.hero{position:relative;min-height:min(82vh,46rem);display:flex;align-items:flex-end;overflow:hidden;background:var(--panel);
  border-bottom:3px solid var(--ink)}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero::before{content:"";position:absolute;inset:0;z-index:1;background-image:radial-gradient(rgba(0,0,0,.35) 1px,transparent 1.3px);
  background-size:5px 5px;mix-blend-mode:multiply;opacity:.55}
.hero::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(12,10,8,0) 30%,rgba(12,10,8,.88) 100%)}
.hero .in{position:relative;z-index:2;max-width:68rem;margin:0 auto;padding:2rem 1.2rem 2.4rem;width:100%;color:#f4ecdc}
.stamp{display:inline-flex;flex-direction:column;align-items:center;border:3px solid #e04b3f;color:#ff6a5c;border-radius:4px;
  padding:.25rem .7rem;transform:rotate(-4deg);font-family:'LXGW WenKai TC',serif;line-height:1.25;background:rgba(12,10,8,.35)}
.stamp b{font-size:1.15rem;letter-spacing:.12em}
.stamp small{font-size:.72rem;letter-spacing:.2em}
.hero h1{margin:.6rem 0 0;font-size:clamp(2.6rem,9vw,5.4rem);line-height:1.08;letter-spacing:.02em;color:#f4ecdc;
  text-shadow:4px 4px 0 #c8322f,0 0 30px rgba(0,0,0,.5)}
.hero h1 em{font-style:normal;color:#f2d27a}
.hero .tag2{font-size:clamp(1.05rem,3vw,1.5rem);margin:.9rem 0 .3rem;color:#f4ecdc}
.hero .tag2 b{color:#f2d27a}
.hero .sub{max-width:40rem;color:#e6dcc8;font-size:1rem;margin:.4rem 0 1.4rem}
.cta{display:flex;gap:.8rem;flex-wrap:wrap}
.hero .btn{border-color:#f4ecdc;box-shadow:4px 4px 0 #000}
.hero .btn:not(.primary){background:rgba(12,10,8,.55);color:#f4ecdc}
main.wrap{max-width:68rem;margin:0 auto;padding:0 1.1rem}
section{margin-top:3.6rem}
h2.sec{display:flex;align-items:baseline;gap:.7rem;font-size:clamp(1.5rem,4vw,2.1rem);margin:0 0 1.2rem;letter-spacing:.06em}
h2.sec .seal{font-size:.8rem}
.panel{background:var(--card);border:3px solid var(--ink);border-radius:4px;box-shadow:var(--hard);padding:1.1rem 1.3rem;line-height:2}
.panel p{margin:.3rem 0}
.chars{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:1rem}
.char{background:var(--card);border:2px solid var(--ink);border-radius:4px;padding:.85rem 1rem}
.char h3{margin:0;font-size:1.2rem;display:flex;align-items:baseline;gap:.5rem}
.char p{margin:.35rem 0 0;font-size:.93rem;color:var(--muted);line-height:1.8}
.char h3 small{font-size:.72rem;color:#f4ecdc;background:var(--seal);border-radius:2px;padding:0 .45rem;font-weight:400;letter-spacing:.08em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1.2rem}
.card{background:var(--card);border:3px solid var(--ink);border-radius:4px;overflow:hidden;display:flex;flex-direction:column;
  transition:transform .16s ease-out,box-shadow .16s ease-out;text-decoration:none;color:var(--ink);box-shadow:var(--hard)}
.card:hover{transform:translate(-3px,-3px);box-shadow:7px 7px 0 var(--seal)}
.card .pic{aspect-ratio:16/9;background:var(--panel);overflow:hidden;border-bottom:3px solid var(--ink)}
.card .pic img{width:100%;height:100%;object-fit:cover}
.card .ph{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:var(--panel);color:var(--gold);font-size:1.4rem}
.card .bd{padding:.75rem .95rem 1rem;display:flex;flex-direction:column;gap:.25rem;flex:1}
.card .meta{display:flex;justify-content:space-between;gap:.5rem;font-size:.8rem;color:var(--muted);align-items:center}
.card h3{margin:.1rem 0;font-size:1.14rem;line-height:1.5}
.card .teaser{font-size:.88rem;color:var(--muted);line-height:1.75;margin:0}
.lessons-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.7rem;counter-reset:l}
.lessons-grid a{display:flex;gap:.6rem;align-items:baseline;text-decoration:none;color:var(--ink);background:var(--card);
  border:2px solid var(--ink);border-radius:4px;padding:.55rem .8rem;font-size:.96rem;line-height:1.55;transition:transform .16s ease-out,box-shadow .16s ease-out}
.lessons-grid a:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--ink)}
.lessons-grid a::before{counter-increment:l;content:counter(l,decimal-leading-zero);font-family:'LXGW WenKai TC',serif;color:var(--seal);font-weight:700}
.worldcard{display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:center;text-decoration:none;color:var(--on-panel);
  border:3px solid var(--ink);border-radius:4px;padding:1.4rem 1.5rem;background:var(--panel);box-shadow:6px 6px 0 var(--seal);
  background-image:radial-gradient(rgba(244,236,220,.09) 1px,transparent 1.3px);background-size:6px 6px}
.worldcard h3{margin:0;font-size:1.4rem;color:#f2d27a}
.worldcard p{margin:.3rem 0 0;color:#d9cfbb;font-size:.95rem}
.worldcard .go{border:2px solid #f4ecdc;border-radius:4px;padding:.5rem 1rem;font-weight:700;white-space:nowrap}
@media (max-width:560px){.worldcard{grid-template-columns:1fr}}
.wl{display:grid;gap:1rem}
.wl-dial{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.wl-dial label{font-family:'LXGW WenKai TC',serif;font-size:1.1rem}
.wl-dial input{font:inherit;font-size:1.2rem;width:7.5rem;min-height:2.75rem;padding:.3rem .6rem;border:2px solid var(--ink);border-radius:4px;
  background:var(--bg);color:var(--ink);letter-spacing:.1em}
.wl-out{display:grid;gap:.4rem}
.wl-no{font-family:'LXGW WenKai TC',serif;font-size:clamp(2rem,7vw,3.2rem);color:var(--seal);line-height:1.1;letter-spacing:.06em}
.wl-text{font-size:1.06rem;line-height:1.95}
.wl-text b{color:var(--seal)}
.wl-state{font-size:.88rem;color:var(--muted)}
.disclaimer{font-size:.9rem;color:var(--muted)}
.disclaimer strong{color:var(--ink)}
"""

THEME_JS = """<script>
(function(){
  var KEY='honki-theme';
  try{var t=localStorage.getItem(KEY);if(t)document.documentElement.dataset.theme=t;
    else if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.dataset.theme='dark';}catch(e){}
  window.toggleTheme=function(){var r=document.documentElement;var n=r.dataset.theme==='dark'?'light':'dark';
    r.dataset.theme=n;try{localStorage.setItem(KEY,n)}catch(e){}};
})();
</script>"""

def head(title, desc, css, og_image="images/banner.jpg", path=""):
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{SITE_URL}{og_image}">
<meta property="og:url" content="{SITE_URL}{path}">
<meta name="twitter:card" content="summary_large_image">
{FAVICON}
{FONT_LINKS}
{THEME_JS}
<style>{css}</style>
</head>
<body>"""

def topbar(extra=""):
    return f"""<header class="topbar"><div class="wrap">
<a class="brand display" href="index.html">《<b>重生之 Debug 博士</b>逆轉台北》</a>
{extra}<button class="tbtn" onclick="toggleTheme()" aria-label="切換深色模式">◐</button>
</div></header>"""

def footer():
    return f"""<footer class="site">
<p>《{TITLE}》為架空小說，人物、組織、事件純屬虛構，不影射任何真實人物。</p>
<p>本站非競選廣告，未受任何候選人、政黨或競選團隊出資或委託，與任何陣營無關。</p>
<p>由人類企劃與編輯，搭配 AI 工具協作生成文字與插圖。小說文字與插圖採 CC BY-NC-SA 4.0；網站程式碼採 MIT 授權。</p>
<p class="ver">{VERSION}</p>
</footer>"""

def img_src(no):
    p = os.path.join(IMG, f"cover-{no}.jpg")
    return f"images/cover-{no}.jpg" if os.path.exists(p) else None

# ---------------- 正文轉 HTML ----------------
def body_html(md):
    out = []
    for ln in md.splitlines():
        t = ln.strip()
        if not t or t.startswith("# "):
            continue
        if re.fullmatch(r"[—\-－＊*◆◇·・\s]{2,}", t):
            out.append('<hr class="scene">')
        elif t.startswith("【") and t.endswith("】"):
            out.append(f'<div class="sys">{inline(t)}</div>')
        else:
            out.append(f"<p>{inline(t)}</p>")
    return "\n".join(out)

def lesson_html(no, link_all=True):
    L = LESSONS.get(no)
    if not L: return ""
    lis = "\n".join(f"<li>{inline(i)}</li>" for i in L["items"])
    more = '<p class="more"><a href="lessons.html">→ 看全部的Debug 小教室</a></p>' if link_all else ""
    return f"""<aside class="lesson" id="lesson-{no}">
<h2 class="display"><small>Debug 小教室</small>{esc(L['title'])}</h2>
<ul>
{lis}
</ul>
{more}
</aside>"""

def storyboard_grid(no):
    items = "\n".join(
        f'<li><figure><img src="{img}" alt="{esc(cap)}" loading="lazy" width="896" height="512">'
        f'<figcaption><b>{i:02d}・{esc(beat)}</b>{esc(cap)}</figcaption></figure></li>'
        for i, (img, beat, cap) in enumerate(SB.get(no, []), 1))
    return f'<ol class="sb-grid">\n{items}\n</ol>'

def storyboard_html(no):
    if not SB.get(no): return ""
    audio = f"audio/sb-{no}.mp3"
    has_audio = os.path.exists(os.path.join(DOCS, audio))
    btn = (f'<button class="tbtn" data-sb-audio="{audio}" aria-label="播放本章旁白">▶ 聽旁白</button>' if has_audio else "")
    credit = "<span>旁白為 AI 合成配音，非任何真人聲音</span>" if has_audio else "<span></span>"
    return f"""<section class="sb" aria-label="一分鐘悅讀">
<h2 class="sb-h display"><span>一分鐘悅讀</span><small>{len(SB[no])} 格漫劇分鏡，先睹為快</small>{btn}</h2>
{storyboard_grid(no)}
<p class="sb-skip">{credit}<a href="#body">↓ 讀完整正文</a></p>
</section>"""

def ending_html(no, next_no):
    if next_no: return ""
    return """<aside class="ending"><p class="n">結局 之一</p>
<p>這個故事有一萬種結局，你剛讀完的，是第一種。</p>
<p><a class="btn" href="index.html#worldlines">轉動世界線，看看其他九千九百九十九種 →</a></p></aside>"""

# ---------------- 閱讀頁 ----------------
READ_JS = """<script>
(function(){
  var bar=document.querySelector('.progress');
  function upd(){var h=document.documentElement;var m=h.scrollHeight-h.clientHeight;bar.style.width=(m>0?h.scrollTop/m*100:0)+'%';}
  addEventListener('scroll',upd,{passive:true});upd();
  document.addEventListener('keydown',function(e){
    if(e.altKey||e.ctrlKey||e.metaKey||/input|textarea/i.test(e.target.tagName))return;
    var a=e.key==='ArrowLeft'?document.querySelector('a[rel=prev]'):e.key==='ArrowRight'?document.querySelector('a[rel=next]'):null;
    if(a){location.href=a.href;}
  });
  var KEY='honki-fs',sizes=['1rem','1.08rem','1.18rem','1.3rem'],i=1;
  try{var s=localStorage.getItem(KEY);if(s!==null)i=+s;}catch(e){}
  function apply(){document.documentElement.style.setProperty('--fs',sizes[i]);}
  apply();
  window.cycleFont=function(){i=(i+1)%sizes.length;apply();try{localStorage.setItem(KEY,i)}catch(e){}};
  /* 分鏡旁白：依播放進度依序點亮格子 */
  document.querySelectorAll('[data-sb-audio]').forEach(function(b){
    var au=new Audio(b.dataset.sbAudio), li=b.closest('.sb').querySelectorAll('.sb-grid li');
    function mark(){var n=li.length,k=au.duration?Math.min(n-1,Math.floor(au.currentTime/au.duration*n)):0;
      li.forEach(function(x,j){x.classList.toggle('on',j===k&&!au.paused);});}
    au.addEventListener('timeupdate',mark);
    au.addEventListener('ended',function(){b.textContent='▶ 聽旁白';li.forEach(function(x){x.classList.remove('on');});});
    b.addEventListener('click',function(){if(au.paused){au.play();b.textContent='❚❚ 暫停旁白';}else{au.pause();b.textContent='▶ 聽旁白';mark();}});
  });
  /* 裝置語音朗讀全文（使用讀者裝置內建語音） */
  var rb=document.getElementById('readAloud');
  if(rb&&'speechSynthesis' in window){
    var ps=[].slice.call(document.querySelectorAll('article.body p, article.body .sys')),idx=0,on=false;
    function voice(){var v=speechSynthesis.getVoices();return v.find(function(x){return /zh[-_]TW/i.test(x.lang)})||v.find(function(x){return /^zh/i.test(x.lang)});}
    function stop(){on=false;speechSynthesis.cancel();ps.forEach(function(p){p.classList.remove('speaking');});rb.textContent='朗讀全文';}
    function next(){if(!on||idx>=ps.length){stop();return;}var p=ps[idx];ps.forEach(function(x){x.classList.toggle('speaking',x===p);});
      var u=new SpeechSynthesisUtterance(p.textContent);u.lang='zh-TW';var v=voice();if(v)u.voice=v;u.rate=1.05;
      u.onend=function(){idx++;next();};speechSynthesis.speak(u);}
    rb.addEventListener('click',function(){if(on){stop();return;}on=true;idx=0;rb.textContent='停止朗讀';next();});
  }else if(rb){rb.hidden=true;}
})();
</script>"""

def read_page(no, prev_no, next_no):
    o = OUT[no]
    md = read(os.path.join(CHAP, f"{no}.md"))
    cover = img_src(no)
    cover_html = f'<figure class="cover"><img src="{cover}" alt="{esc(o["full"])} 插圖"></figure>' if cover else ""
    prev = (f'<a rel="prev" href="s{prev_no}.html">← {esc(OUT[prev_no]["label"])}</a>' if prev_no
            else '<a href="index.html">↑ 回首頁</a>')
    nxt = (f'<a rel="next" class="r" href="s{next_no}.html">{esc(OUT[next_no]["label"])} →</a>' if next_no
           else '<a class="r" href="index.html">全書完・回首頁 ↑</a>')
    first = re.sub(r"\s+", "", next((l for l in md.splitlines() if l.strip() and not l.startswith("#")), ""))[:70]
    desc = f"{o['full']}｜{TITLE}：{first}"
    og = cover or "images/banner.jpg"
    return (head(f"{o['full']}｜{TITLE}", desc, CSS_READ, og, f"s{no}.html")
        + '<div class="progress"></div>'
        + topbar('<button class="tbtn" onclick="cycleFont()" aria-label="調整字級">字級</button>')
        + f"""
<main class="read">
{cover_html}
<p class="kicker"><span class="seal">{esc(o['label'])}</span><span>約 {cjk(md):,} 字</span></p>
<h1 class="title display">{esc(o['name'])}</h1>
<p class="when">時間：{esc(o['when'])}</p>
{storyboard_html(no)}
<div class="tools"><button class="tbtn" id="readAloud" aria-label="用裝置語音朗讀全文">朗讀全文</button><a class="tbtn" href="world/">3D 多重世界線 →</a></div>
<article class="body" id="body">
{body_html(md)}
</article>
{ending_html(no, next_no)}
{lesson_html(no)}
<nav class="pager">{prev}{nxt}</nav>
<p class="hint">鍵盤 ← → 可翻章</p>
</main>
""" + footer() + READ_JS + "\n</body>\n</html>\n")

# ---------------- 小教室總覽 ----------------
def lessons_page():
    blocks = []
    for no in sorted(LESSONS):
        o = OUT.get(no)
        link = f'<p class="more"><a href="s{no}.html">→ 閱讀對應章節：{esc(o["full"])}</a></p>' if o and no in NOS else ""
        blocks.append(lesson_html(no, link_all=False).replace("</aside>", link + "</aside>"))
    src = "\n".join(f"<li>{inline(s)}</li>" for s in SOURCES)
    return (head(f"Debug 小教室｜{TITLE}", "十三堂防詐、深偽辨識、資料素養與選舉法規常識，跟著小說一起學。", CSS_READ, path="lessons.html")
        + topbar() + f"""
<main class="read">
<p class="kicker"><span class="seal">附錄</span><span>十三堂實用課</span></p>
<h1 class="title display">Debug 小教室</h1>
<p class="when">小說是虛構的，這裡的知識是真的。防詐、深偽辨識、資料素養、選舉法規常識——每章一堂，五分鐘學會。</p>
{''.join(blocks)}
<aside class="lesson"><h2 class="display"><small>參考資料</small>資料來源</h2><ul>{src}</ul>
<p class="more">法規內容為一般性整理，實際適用以全國法規資料庫與中央選舉委員會公告為準。</p></aside>
</main>
""" + footer() + "\n</body>\n</html>\n")

# ---------------- 漫劇版 ----------------
def comic_page():
    chs = "\n".join(f"""<section class="comic-ch" id="c{no}">
<h2 class="display"><a href="s{no}.html"><span class="seal">{esc(OUT[no]['label'])}</span>　{esc(OUT[no]['name'])}</a></h2>
{storyboard_grid(no)}
<p class="sb-skip"><a href="s{no}.html">讀完整正文 →</a></p>
</section>""" for no in NOS if SB.get(no))
    n = sum(len(SB[no]) for no in NOS)
    return (head(f"漫劇版｜{TITLE}", f"全書 {n} 格 AI 漫劇分鏡，五分鐘看完《{TITLE}》。", CSS_READ, path="comic.html")
        + topbar() + f"""
<main class="read">
<p class="kicker"><span class="seal">漫劇版</span><span>{n} 格分鏡</span></p>
<h1 class="title display">五分鐘看完全書</h1>
<p class="when">每章八格：鉤子、蓄勢、蓄勢、轉折、快意、揭曉、動情、懸念。看到想看的，點進去讀完整正文。</p>
<div class="sb">
{chs}
</div>
</main>
""" + footer() + "\n</body>\n</html>\n")


# 一萬條世界線：四組各十個元素，編號 n（1～10000）的四位數字依序選出 A/B/C/D；#0001 為正史
WORLDLINES = {
    "A": ["投票前三十三天的記者會後台", "黑客松開幕前一小時", "秀蘭嬤接到詐騙電話的前三分鐘", "十年前的大學課堂講台上",
          "深偽之夜開始前的最後一分鐘", "一節卡在隧道裡的捷運車廂", "夜市收攤後的滷肉飯攤前", "跨年夜倒數舞台的後方",
          "颱風夜停電的公寓頂樓", "2061 年病床上的最後一秒（人沒回去，只有記憶傳了回去）"],
    "B": ["住在眼鏡裡、滿口夜市腔的洋人 AI 妹妹艾莉絲", "一隻會說話的瓢蟲徽章", "一支只能預知三秒鐘的舊手機", "一對聽得見謊言雜音的耳朵",
          "一本會自己寫字的筆記本", "秀蘭嬤祖傳的照妖滷鍋", "一台只會說真話的掃地機器人", "一支能讓時間暫停十秒的機械錶",
          "一副看得見轉傳路線的眼鏡", "什麼都沒有，只有八十年的記憶"],
    "C": ["戴著十萬張臉的莫無影與鏡淵", "把謊言做成珍珠奶茶的連鎖店", "能複製任何聲音的鸚鵡詐騙集團", "自稱來自 2099 年的另一個自己",
          "學會說謊的全市紅綠燈系統", "只轉傳、不查證的早安圖工廠", "把每支影片都調成真實度 100% 的濾鏡 App", "一隻專吃真相的夜市流浪貓（其實是程式）",
          "收買演算法的神秘經紀公司", "自己的拖延症"],
    "D": ["天亮了，台北自己選", "秀蘭嬤開了全台第一家「先查證再上菜」的滷肉飯店", "艾莉絲終於用味覺感測器吃到第一口滷肉飯", "照妖鏡裝進每一支手機，詐騙集團集體轉行賣雞排",
          "Debug 博士又死了一次，這次笑著醒在 2061 年", "Kevin 成了全台最強的闢謠網紅", "整座城市學會了先說一句「真的假的？」", "莫無影摘下面具，原來他也是被騙的人",
          "2061 年，台北成了全世界最難說謊的城市", "一切重來——世界線跳到下一個編號"],
}
WORLD3D = {1: "taipei", 168: "island", 2061: "cosmos", 5050: "continents", 9999: "sand"}

WL_JS = """<script>
(function(){
  var W=%s, S=%s;
  var inp=document.getElementById('wlInput'),no=document.getElementById('wlNo'),tx=document.getElementById('wlText'),st=document.getElementById('wlState');
  function show(n){n=Math.max(1,Math.min(10000,n|0||1));var k=n-1,a=Math.floor(k/1000)%%10,b=Math.floor(k/100)%%10,c=Math.floor(k/10)%%10,d=k%%10;
    if(n===10000){a=b=c=d=9;}
    inp.value=n;no.textContent='世界線 #'+String(n).padStart(4,'0');
    tx.innerHTML='在<b>'+W.A[a]+'</b>重生，金手指是<b>'+W.B[b]+'</b>，對手是<b>'+W.C[c]+'</b>。<br>結局：<b>'+W.D[d]+'</b>。';
    var s3=S[n]?' <a href="world/#'+S[n]+'">這條世界線有 3D 場景 →</a>':'';
    st.innerHTML=(n===1?'已開啟：正史，就是你正在讀的這一部。':'尚未開啟。也許下一個版本，會寫到這一條。')+s3;
    try{history.replaceState(null,'','#wl-'+n);}catch(e){}}
  document.getElementById('wlGo').onclick=function(){show(+inp.value);};
  document.getElementById('wlRand').onclick=function(){show(1+Math.floor(Math.random()*10000));};
  document.getElementById('wlHome').onclick=function(){show(1);};
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')show(+inp.value);});
  var m=location.hash.match(/^#wl-(\\d+)/);show(m?+m[1]:1);
})();
</script>"""


# ---------------- 首頁 ----------------
def index_page():
    banner = "images/banner.jpg" if os.path.exists(os.path.join(IMG, "banner.jpg")) else (img_src("00") or "")
    hero_img = f'<img src="{banner}" alt="台北夜空與倒轉的全息時鐘">' if banner else ""
    cards = []
    for no in NOS:
        o = OUT[no]
        md = read(os.path.join(CHAP, f"{no}.md"))
        teaser = re.sub(r"\s+", "", next((l for l in md.splitlines() if l.strip() and not l.startswith("#")), ""))[:54]
        c = img_src(no)
        pic = f'<div class="pic"><img src="{c}" alt="" loading="lazy"></div>' if c else f'<div class="ph display">{esc(o["label"])}</div>'
        cards.append(f"""<a class="card" href="s{no}.html">{pic}<div class="bd">
<div class="meta"><span>{esc(o['label'])}</span><span>{cjk(md):,} 字</span></div>
<h3 class="display">{esc(o['name'])}</h3><p class="teaser">{esc(teaser)}……</p></div></a>""")
    chars = "\n".join(f'<div class="char"><h3 class="display">{esc(n)}<small>{esc(r)}</small></h3><p>{esc(d)}</p></div>'
                      for n, r, d in CHARACTERS)
    lessons = "\n".join(f'<a href="s{no}.html#lesson-{no}" title="{esc(OUT[no]["label"])}">{esc(LESSONS[no]["title"])}</a>'
                        for no in NOS if no in LESSONS)
    total = sum(cjk(read(os.path.join(CHAP, f"{n}.md"))) for n in NOS)
    first = NOS[0] if NOS else "00"
    return (head(f"{TITLE}｜都市重生 × 科技選戰", DESC, CSS_INDEX, path="") + topbar() + f"""
<section class="hero" style="margin-top:0">
{hero_img}
<div class="in">
<span class="stamp"><b>結局 之一</b><small>共 一萬 種</small></span>
<h1 class="display">重生之<br><em>Debug 博士</em><br>逆轉台北</h1>
<p class="tag2 display">{TAGLINE}這一世，我要讓<b>深偽之夜</b>永遠不會發生！</p>
<p class="sub">{esc(DESC)}</p>
<div class="cta"><a class="btn primary" href="s{first}.html">開始閱讀</a>{'<a class="btn" href="comic.html">五分鐘漫劇版</a>' if any(SB.values()) else ''}<a class="btn" href="world/">3D 多重世界線</a></div>
</div>
</section>
<main class="wrap">
<section>
<h2 class="sec display">緣起</h2>
<div class="panel">
<p>某天早上，一位朋友在臉書留言許願：「想看一部中國網文風格的博士重生小說。」</p>
<p>既然來了，那就來吧。於是有了這部小說——<strong>網文的骨架</strong>：重生、系統、打臉、反轉；<strong>台灣的血肉</strong>：滷肉飯、捷運、夜市阿姨與 165；<strong>還有一顆有用的心</strong>：每一章都附一堂「Debug 小教室」，讀完這部快意小說，順便學會怎麼不被深偽和詐騙騙。</p>
<p>全書 {len(NOS)} 章，約 {total:,} 字。</p>
</div>
</section>
<section>
<h2 class="sec display">登場人物</h2>
<div class="chars">
{chars}
</div>
</section>
<section id="toc">
<h2 class="sec display">章節目錄</h2>
<div class="grid">
{''.join(cards)}
</div>
</section>
<section id="worldlines">
<h2 class="sec display">一萬條世界線 <span class="seal">之一已開啟</span></h2>
<div class="panel wl">
<p>重生會改變一切。每一個選擇，都讓故事岔出另一條世界線——這個故事一共有一萬種結局，你正在讀的，是 <strong>#0001</strong>。輸入一個編號，看看另一個宇宙的 Debug 博士過得怎樣。</p>
<div class="wl-dial"><label for="wlInput">世界線 #</label><input id="wlInput" type="number" min="1" max="10000" value="1" inputmode="numeric">
<button class="btn" id="wlGo">前往</button><button class="btn primary" id="wlRand">隨機一條</button><button class="btn" id="wlHome">回到正史</button></div>
<div class="wl-out" aria-live="polite"><div class="wl-no" id="wlNo">世界線 #0001</div><p class="wl-text" id="wlText"></p><p class="wl-state" id="wlState"></p></div>
</div>
</section>
<section>
<h2 class="sec display">3D 多重世界</h2>
<a class="worldcard" href="world/"><div><h3 class="display">五條世界線，五個宇宙</h3>
<p>逆轉台北的深偽獵人、浮在雲上的夜市小島、十三顆星球的星海、五色大陸，還有一粒沙裡的整個世界。附場景音效與旁白。</p></div>
<span class="go">進入 3D →</span></a>
</section>
<section>
<h2 class="sec display">Debug 小教室</h2>
<div class="lessons-grid">
{lessons}
</div>
<p style="margin-top:.8rem"><a href="lessons.html">→ 一頁看完全部小教室與資料來源</a></p>
</section>
<section>
<h2 class="sec display">聲明</h2>
<div class="disclaimer">
<p><strong>純屬虛構。</strong>本作為架空小說，所有人物、公司、組織與事件皆為虛構，不影射任何真實人物。</p>
<p><strong>不是競選廣告。</strong>本站未受任何候選人、政黨或競選團隊出資、委託或授權；書中不出現真實政黨與候選人姓名、不引用任何民調、不寫開票結果，也不呼籲投票給任何人。</p>
<p><strong>插圖。</strong>全部插圖皆為原創生成，人物皆非真人肖像。</p>
<p><strong>遇到詐騙請撥 165，緊急狀況請撥 110。</strong>選舉資訊以中央選舉委員會公告為準。</p>
</div>
</section>
</main>
""" + footer() + (WL_JS % (json.dumps(WORLDLINES, ensure_ascii=False), json.dumps(WORLD3D))) + "\n</body>\n</html>\n")

def main():
    os.makedirs(IMG, exist_ok=True)
    for i, no in enumerate(NOS):
        prev_no = NOS[i - 1] if i > 0 else None
        next_no = NOS[i + 1] if i + 1 < len(NOS) else None
        write(os.path.join(DOCS, f"s{no}.html"), read_page(no, prev_no, next_no))
    write(os.path.join(DOCS, "lessons.html"), lessons_page())
    if any(SB.values()):
        write(os.path.join(DOCS, "comic.html"), comic_page())
    write(os.path.join(DOCS, "index.html"), index_page())
    open(os.path.join(DOCS, ".nojekyll"), "w").close()
    print(f"built {len(NOS)} chapters + index + lessons → docs/  ({VERSION})")

if __name__ == "__main__":
    main()
