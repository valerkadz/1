#!/usr/bin/env python3
"""Собирает сайты для клиентов из файлов data/*.json в папку ../docs/<slug>/index.html.

Новый клиент = новый JSON (скопируй любой из data/ и поменяй тексты).
Запуск:  python3 sites/build.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT.parent / "docs"
e = html.escape


def digits(phone):
    return re.sub(r"\D", "", phone)


def render(d):
    t = d["theme"]
    phone_digits = digits(d.get("phone", ""))
    wa = (f"https://wa.me/{phone_digits}?text=" + e("Здравствуйте! Хочу записаться")) if phone_digits else None
    tg = f"https://t.me/{d['telegram']}" if d.get("telegram") else None
    booking = d.get("booking_url") or wa or tg
    map_url = "https://yandex.ru/maps/?text=" + e(f"{d['city']}, {d['address']}")

    services = ""
    for group in d["services"]:
        if group.get("scale"):
            n = len(group["items"])
            rows = "".join(
                f"""<li class="scale-row"><b class="size">{e(s['name'])}</b><div class="bar"><i style="width:{int(35 + 65 * k / max(1, n - 1))}%"></i></div><span>{e(s['price'])}</span></li>"""
                for k, s in enumerate(group["items"])
            )
            note = f'<p class="group-note">{e(group["note"])}</p>' if group.get("note") else ""
            services += f"""<div class="card price-group"><h3>{e(group['title'])}</h3><ul>{rows}</ul>{note}</div>"""
            continue
        rows = "".join(
            f"""<li><div><b>{e(s['name'])}</b>{f'<small>{e(s["note"])}</small>' if s.get('note') else ''}</div><span>{e(s['price'])}</span></li>"""
            for s in group["items"]
        )
        note = f'<p class="group-note">{e(group["note"])}</p>' if group.get("note") else ""
        services += f"""<div class="card price-group"><h3>{e(group['title'])}</h3><ul>{rows}</ul>{note}</div>"""

    features = "".join(
        f"""<div class="feature"><div class="f-ico">{f['icon']}</div><h3>{e(f['title'])}</h3><p>{e(f['text'])}</p></div>"""
        for f in d["features"]
    )
    photos = any(g.get("img") for g in d["gallery"])
    gallery = "".join(
        (f"""<figure class="g-item photo"><img src="{e(g['img'])}" alt="{e(g.get('label', d['name']))}" loading="lazy">{f'<figcaption>{e(g["label"])}</figcaption>' if g.get('label') else ''}</figure>"""
         if g.get("img") else
         f"""<figure class="g-item" style="background:{g.get('bg', 'var(--grad)')}"><span>{g['icon']}</span><figcaption>{e(g['label'])}</figcaption></figure>""")
        for g in d["gallery"]
    )
    reviews = "" if not d.get("reviews") else "".join(
        f"""<blockquote class="card review"><div class="stars">★★★★★</div><p>«{e(r['text'])}»</p><cite>{e(r['name'])}</cite></blockquote>"""
        for r in d["reviews"]
    )
    team = ""
    if d.get("team"):
        team_items = "".join(
            f"""<div class="member"><div class="avatar">{m['icon']}</div><b>{e(m['name'])}</b><small>{e(m['role'])}</small></div>"""
            for m in d["team"]
        )
        team = f"""<section id="team"><div class="wrap"><h2>{e(d.get('team_title', 'Команда'))}</h2><div class="team">{team_items}</div></div></section>"""

    demo = ""
    if d.get("demo"):
        demo = """<div class="demo-bar">Пример сайта. Название, контакты и отзывы вымышлены.</div>"""

    socials = ""
    if wa and booking != wa:
        socials += f'<a class="btn ghost" href="{wa}" target="_blank" rel="noopener">WhatsApp</a>'
    if tg and booking != tg:
        socials += f'<a class="btn ghost" href="{tg}" target="_blank" rel="noopener">Telegram</a>'
    for label, url in [l for l in d.get("links", []) if l[1] != booking]:
        socials += f'<a class="btn ghost" href="{e(url)}" target="_blank" rel="noopener">{e(label)}</a>'
    if d.get("vk"):
        socials += f'<a class="btn ghost" href="https://vk.com/{e(d["vk"])}" target="_blank" rel="noopener">ВКонтакте</a>'

    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(d['name'])} — {e(d['kind'])} во {e(d['city_in'])}</title>
<meta name="description" content="{e(d['seo'])}">
<meta property="og:title" content="{e(d['name'])} — {e(d['kind'])}">
<meta property="og:description" content="{e(d['seo'])}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>{d['hero_icon']}</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family={t['font_head'].replace(' ', '+')}:wght@600;700;800&family={t.get('font_body', 'Manrope').replace(' ', '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: {t['bg']}; --surface: {t['surface']}; --text: {t['text']}; --muted: {t['muted']};
  --accent: {t['accent']}; --accent-text: {t['accent_text']}; --line: {t['line']};
  --grad: {t['grad']}; --on-grad: {t.get('on_grad', '#ffffff')};
  --head: "{t['font_head']}", Georgia, serif;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html {{ scroll-behavior: smooth; }}
body {{ background: var(--bg); color: var(--text); font: 16px/1.6 "{t.get('font_body', 'Manrope')}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }}
a {{ color: inherit; }}
.wrap {{ max-width: 1080px; margin: 0 auto; padding: 0 20px; }}
h1, h2, h3 {{ font-family: var(--head); line-height: 1.15; }}
h2 {{ font-size: clamp(28px, 5vw, 40px); margin-bottom: 28px; }}
section {{ padding: 72px 0; }}
.demo-bar {{ background: #111; color: #fff; text-align: center; font-size: 13px; padding: 6px 12px; }}
header.top {{ position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }}
.top .wrap {{ display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 16px; }}
.logo {{ font-family: var(--head); font-weight: 800; font-size: 22px; text-decoration: none; display: flex; align-items: center; gap: 8px; }}
nav a {{ text-decoration: none; margin-left: 22px; color: var(--muted); font-weight: 600; font-size: 15px; }}
nav a:hover {{ color: var(--text); }}
.btn {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 26px; border-radius: 999px; background: var(--accent); color: var(--accent-text); font-weight: 700; text-decoration: none; border: 2px solid var(--accent); transition: transform .15s, box-shadow .15s; }}
.btn:hover {{ transform: translateY(-2px); box-shadow: 0 10px 24px -10px var(--accent); }}
.btn.ghost {{ background: transparent; color: var(--text); border-color: var(--line); }}
.btn.small {{ padding: 9px 18px; font-size: 14px; }}
.hero {{ padding: 64px 0 80px; }}
.hero .wrap {{ display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center; }}
.eyebrow {{ display: inline-block; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }}
.hero h1 {{ font-size: clamp(38px, 7vw, 64px); margin-bottom: 18px; }}
.hero p.lead {{ font-size: 19px; color: var(--muted); max-width: 520px; margin-bottom: 30px; }}
.hero .actions {{ display: flex; flex-wrap: wrap; gap: 12px; }}
.hero-meta {{ display: flex; flex-wrap: wrap; gap: 26px; margin-top: 34px; color: var(--muted); font-size: 14px; }}
.hero-meta b {{ display: block; color: var(--text); font-size: 22px; font-family: var(--head); }}
.hero-art {{ aspect-ratio: 4/5; border-radius: 32px; background: var(--grad); display: grid; place-items: center; position: relative; overflow: hidden; box-shadow: 0 40px 80px -40px rgba(0,0,0,.45); }}
.hero-art span {{ font-size: clamp(110px, 18vw, 180px); filter: drop-shadow(0 20px 30px rgba(0,0,0,.25)); }}
.hero-art::before, .hero-art::after {{ content: ""; position: absolute; border-radius: 50%; background: rgba(255,255,255,.14); }}
.hero-art::before {{ width: 70%; height: 56%; top: -12%; right: -18%; }}
.hero-art::after {{ width: 50%; height: 40%; bottom: -10%; left: -12%; }}
.badge {{ position: absolute; left: 18px; bottom: 18px; background: var(--surface); color: var(--text); padding: 12px 16px; border-radius: 16px; font-size: 14px; font-weight: 600; box-shadow: 0 10px 30px -10px rgba(0,0,0,.3); }}
.card {{ background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 26px; }}
.prices {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
.price-group h3 {{ font-size: 22px; margin-bottom: 14px; }}
.price-group ul {{ list-style: none; }}
.price-group li {{ display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px dashed var(--line); }}
.price-group li:first-child {{ border-top: none; }}
.price-group li small {{ display: block; color: var(--muted); font-size: 13px; }}
.price-group li span {{ font-weight: 700; white-space: nowrap; }}
.features {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }}
.feature {{ padding: 6px; }}
.f-ico {{ width: 56px; height: 56px; border-radius: 18px; background: var(--grad); display: grid; place-items: center; font-size: 28px; margin-bottom: 14px; }}
.feature h3 {{ font-size: 20px; margin-bottom: 6px; }}
.feature p {{ color: var(--muted); }}
.gallery {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }}
.g-item {{ aspect-ratio: 1; border-radius: 22px; display: grid; place-items: center; position: relative; overflow: hidden; }}
.g-item:first-child {{ grid-row: span 2; aspect-ratio: auto; }}
.g-item span {{ font-size: 64px; }}
.g-item figcaption {{ position: absolute; left: 12px; bottom: 12px; background: rgba(0,0,0,.45); color: #fff; font-size: 13px; padding: 4px 10px; border-radius: 999px; }}
.team {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 20px; text-align: center; }}
.avatar {{ width: 110px; height: 110px; margin: 0 auto 12px; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 52px; }}
.member small {{ display: block; color: var(--muted); }}
.reviews {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }}
.review .stars {{ color: #f5b301; letter-spacing: 2px; margin-bottom: 8px; }}
.review cite {{ display: block; margin-top: 12px; font-style: normal; font-weight: 700; }}
.cta {{ background: var(--grad); border-radius: 32px; padding: 48px 32px; text-align: center; color: var(--on-grad); }}
.cta h2 {{ margin-bottom: 12px; }}
.cta p {{ opacity: .9; margin-bottom: 26px; font-size: 18px; }}
.cta .btn {{ background: #fff; color: #111; border-color: #fff; }}
.contacts {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
.contacts dl {{ display: grid; gap: 16px; }}
.contacts dt {{ color: var(--muted); font-size: 14px; }}
.contacts dd {{ font-weight: 700; font-size: 18px; }}
.map {{ border-radius: 24px; background: var(--grad); min-height: 260px; display: grid; place-items: center; text-align: center; color: var(--on-grad); text-decoration: none; font-weight: 700; padding: 20px; }}
.map span {{ display: block; font-size: 48px; }}
footer {{ padding: 32px 0 100px; color: var(--muted); font-size: 14px; border-top: 1px solid var(--line); }}
footer .wrap {{ display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }}
.hero-art.photo::before, .hero-art.photo::after {{ display: none; }}
.hero-art.photo img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
.gallery.photos {{ grid-template-columns: repeat(4, 1fr); }}
.g-item.photo {{ aspect-ratio: 3/4; grid-row: auto; cursor: zoom-in; background: var(--line); }}
.g-item.photo img {{ width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }}
.g-item.photo:hover img {{ transform: scale(1.05); }}
.lightbox {{ position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.9); display: none; align-items: center; justify-content: center; padding: 20px; cursor: zoom-out; }}
.lightbox.on {{ display: flex; }}
.lightbox img {{ max-width: 100%; max-height: 100%; border-radius: 16px; }}
.group-note {{ color: var(--muted); font-size: 14px; margin-top: 10px; }}
.scale-row {{ align-items: center; }}
.scale-row .size {{ width: 44px; text-transform: uppercase; }}
.scale-row .bar {{ flex: 1; height: 10px; border-radius: 99px; background: var(--line); overflow: hidden; }}
.scale-row .bar i {{ display: block; height: 100%; border-radius: 99px; background: var(--grad); }}
.sticky-cta {{ display: none; }}
.sticky-cta.hide {{ opacity: 0; pointer-events: none; transform: translateY(20px); }}
.sticky-cta {{ transition: opacity .25s, transform .25s; }}
@media (max-width: 820px) {{
  nav {{ display: none; }}
  .hero {{ padding: 32px 0 56px; }}
  .hero .wrap {{ grid-template-columns: 1fr; gap: 32px; }}
  .hero-art {{ aspect-ratio: 16/11; order: -1; }}
  section {{ padding: 52px 0; }}
  .gallery, .gallery.photos {{ grid-template-columns: 1fr 1fr; }}
  .contacts {{ grid-template-columns: 1fr; }}
  .sticky-cta {{ display: flex; position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 30; box-shadow: 0 12px 30px -8px rgba(0,0,0,.45); }}
  .top .btn.small {{ display: none; }}
}}
</style>
</head>
<body>
{demo}
<header class="top"><div class="wrap">
  <a class="logo" href="#">{d['hero_icon']} {e(d['name'])}</a>
  <nav><a href="#prices">Цены</a><a href="#about">О нас</a><a href="#gallery">Работы</a>{'<a href="#reviews">Отзывы</a>' if d.get('reviews') else ''}<a href="#contacts">Контакты</a></nav>
  <a class="btn small" href="{booking}" target="_blank" rel="noopener">{e(d['cta'])}</a>
</div></header>

<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">{e(d['kind'])} · {e(d['district'])}</span>
    <h1>{e(d['headline'])}</h1>
    <p class="lead">{e(d['tagline'])}</p>
    <div class="actions">
      <a class="btn" href="{booking}" target="_blank" rel="noopener">{e(d['cta'])}</a>
      <a class="btn ghost" href="#prices">Смотреть цены</a>
    </div>
    <div class="hero-meta">{''.join(f'<div><b>{e(m[0])}</b>{e(m[1])}</div>' for m in d.get('stats', []))}</div>
  </div>
  <div class="hero-art{' photo' if d.get('hero_img') else ''}">{f'<img src="{e(d["hero_img"])}" alt="{e(d["name"])}">' if d.get('hero_img') else f'<span>{d["hero_icon"]}</span>'}<div class="badge">{e(d['badge'])}</div></div>
</div></section>

<section id="prices"><div class="wrap">
  <h2>Услуги и цены</h2>
  <div class="prices">{services}</div>
</div></section>

<section id="about"><div class="wrap">
  <h2>{e(d['about_title'])}</h2>
  <div class="features">{features}</div>
</div></section>

<section id="gallery"><div class="wrap">
  <h2>{e(d.get('gallery_title', 'Наши работы'))}</h2>
  <div class="gallery{' photos' if photos else ''}">{gallery}</div>
</div></section>

{team}

{f'<section id="reviews"><div class="wrap"><h2>Отзывы</h2><div class="reviews">{reviews}</div></div></section>' if reviews else ''}

<section><div class="wrap">
  <div class="cta">
    <h2>{e(d['cta_title'])}</h2>
    <p>{e(d['cta_text'])}</p>
    <a class="btn" href="{booking}" target="_blank" rel="noopener">{e(d['cta'])}</a>
  </div>
</div></section>

<section id="contacts"><div class="wrap">
  <h2>Контакты</h2>
  <div class="contacts">
    <div class="card"><dl>
      <div><dt>Адрес</dt><dd>{e(d['city'])}, {e(d['address'])}</dd></div>
      {f'<div><dt>Телефон</dt><dd><a href="tel:+{phone_digits}">{e(d["phone"])}</a></dd></div>' if phone_digits else ''}
      <div><dt>Часы работы</dt><dd>{e(d['hours'])}</dd></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="{booking}" target="_blank" rel="noopener">{e(d['cta'])}</a>{socials}</div>
    </dl></div>
    <a class="map" href="{map_url}" target="_blank" rel="noopener"><div><span>📍</span>Открыть на Яндекс Картах</div></a>
  </div>
</div></section>

<footer><div class="wrap"><span>© {e(d['name'])}, {e(d['city'])}</span><span>{e(d['hours'])}</span></div></footer>
<div class="lightbox" id="lb"><img alt=""></div>
<a class="btn sticky-cta hide" id="sticky" href="{booking}" target="_blank" rel="noopener">{e(d['cta'])}</a>
<script>
(function () {{
  var b = document.getElementById('sticky');
  function u() {{ b.classList.toggle('hide', window.scrollY < 500 || (innerHeight + scrollY) > document.body.scrollHeight - 200); }}
  addEventListener('scroll', u, {{ passive: true }}); u();
  var lb = document.getElementById('lb');
  document.querySelectorAll('.g-item.photo img').forEach(function (im) {{
    im.addEventListener('click', function () {{ lb.firstChild.src = im.src; lb.classList.add('on'); }});
  }});
  lb.addEventListener('click', function () {{ lb.classList.remove('on'); }});
}})();
</script>
</body>
</html>
"""


def main():
    OUT.mkdir(exist_ok=True)
    for f in sorted((ROOT / "data").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        dest = OUT / d["slug"]
        dest.mkdir(parents=True, exist_ok=True)
        img_src = ROOT / "assets" / d["slug"]
        if img_src.is_dir():
            (dest / "img").mkdir(exist_ok=True)
            for im in img_src.iterdir():
                (dest / "img" / im.name).write_bytes(im.read_bytes())
        (dest / "index.html").write_text(render(d), encoding="utf-8")
        print("✓", d["slug"])


if __name__ == "__main__":
    main()
