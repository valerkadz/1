"""Тексты и форматирование — всё, что видит клиент, в одном месте."""
from datetime import date

import config

WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
          "августа", "сентября", "октября", "ноября", "декабря"]


def day_label(d: date, today: date | None = None) -> str:
    today = today or date.today()
    if d == today:
        prefix = "Сегодня"
    elif (d - today).days == 1:
        prefix = "Завтра"
    else:
        prefix = WEEKDAYS[d.weekday()]
    return f"{prefix}, {d.day} {MONTHS[d.month - 1][:3]}"


def day_full(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} ({WEEKDAYS[d.weekday()]})"


def booking_line(b) -> str:
    title, price, _ = config.SERVICES[b["service"]]
    return f"{day_full(date.fromisoformat(b['day']))}, {b['start']} — {title}, {price} ₽"


WELCOME = (
    f"Здравствуйте! Это бот {config.SHOP_NAME} 💈\n\n"
    "Здесь можно записаться на стрижку за минуту, посмотреть цены и свои записи."
)

PRICES = "✂️ <b>Услуги и цены</b>\n\n" + "\n".join(
    f"• {title} — {price} ₽ ({minutes} мин)" for title, price, minutes in config.SERVICES.values()
)

CONTACTS = (
    f"📍 <b>{config.SHOP_NAME}</b>\n\n"
    f"Адрес: {config.ADDRESS}\n"
    f"Телефон: {config.PHONE}\n"
    f"Часы работы: {config.WORK_HOURS}"
)
