# Сайты для бизнеса

- `docs/index.html` — сайт-визитка с примерами и ценами
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
Свой домен: `vlsite.ru` (куплен на reg.ru, файл `docs/CNAME`). Сайты: `https://vlsite.ru/`, `https://vlsite.ru/<slug>/`.
DNS в reg.ru: четыре A-записи `@` → 185.199.108.153 / 109.153 / 110.153 / 111.153 и CNAME `www` → `valerkadz.github.io`.
Старые адреса `valerkadz.github.io/1/...` автоматически перенаправляются на домен.
