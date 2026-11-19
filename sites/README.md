# Сайты для бизнеса

- `docs/index.html` — сайт-визитка с примерами и ценами (замените `YOUR_TELEGRAM` на свой ник)
- `docs/barber/`, `docs/nails/`, `docs/cafe/` — демо-сайты (собираются из `sites/data/*.json`)
- `sites/SALES.md` — как искать клиентов, тексты сообщений, ответы на возражения, объявление для Авито
- `sites/promo/` — картинки для Авито

## Новый сайт для клиента

1. Скопировать любой файл из `sites/data/` (например, `barber.json` → `client-name.json`)
2. Поменять `slug` (будет адресом: `.../client-name/`), тексты, услуги, цены, телефон, цвета
3. Для настоящего клиента поставить `"demo": false`
4. `python3 sites/build.py` → появится `docs/client-name/index.html`

## Публикация (GitHub Pages, бесплатно)

GitHub → репозиторий → Settings → Pages → Source: «Deploy from a branch» →
ветка `claude/upbeat-turing-es951x`, папка `/docs` → Save.
Через 1–2 минуты сайты будут доступны по адресу `https://valerkadz.github.io/1/`.
