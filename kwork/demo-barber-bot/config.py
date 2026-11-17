"""Настройки бота. Токен и ID администратора берутся из файла .env."""
import os
from datetime import time

from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
# ID администратора в Telegram (узнать можно у бота @userinfobot)
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
DB_PATH = os.getenv("DB_PATH", "bookings.db")

SHOP_NAME = "Барбершоп «Борода»"
ADDRESS = "ул. Ленина, 15 (демо-адрес)"
PHONE = "+7 900 000-00-00"
WORK_HOURS = "Ежедневно 10:00–21:00"

# Услуги: код -> (название, цена в рублях, длительность в минутах)
SERVICES = {
    "haircut": ("Мужская стрижка", 1200, 60),
    "beard": ("Стрижка бороды", 700, 30),
    "combo": ("Стрижка + борода", 1700, 90),
    "kids": ("Детская стрижка", 900, 45),
}

OPEN_TIME = time(10, 0)
CLOSE_TIME = time(21, 0)
SLOT_MINUTES = 30
DAYS_AHEAD = 7
