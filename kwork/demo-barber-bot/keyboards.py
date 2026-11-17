"""Кнопки бота."""
from datetime import date

from aiogram.types import (InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton,
                           ReplyKeyboardMarkup)
from aiogram.utils.keyboard import InlineKeyboardBuilder

import config
import texts

BTN_BOOK = "📅 Записаться"
BTN_PRICES = "✂️ Услуги и цены"
BTN_MY = "🗂 Мои записи"
BTN_CONTACTS = "📍 Контакты"


def main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BTN_BOOK)],
                  [KeyboardButton(text=BTN_PRICES), KeyboardButton(text=BTN_MY)],
                  [KeyboardButton(text=BTN_CONTACTS)]],
        resize_keyboard=True,
    )


def services() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for code, (title, price, _) in config.SERVICES.items():
        kb.button(text=f"{title} — {price} ₽", callback_data=f"svc:{code}")
    kb.adjust(1)
    return kb.as_markup()


def days(days_list: list[date]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for d in days_list:
        kb.button(text=texts.day_label(d), callback_data=f"day:{d.isoformat()}")
    kb.button(text="⬅️ Назад", callback_data="back:services")
    kb.adjust(2)
    return kb.as_markup()


def slots(slot_list: list[str]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for s in slot_list:
        kb.button(text=s, callback_data=f"time:{s}")
    kb.adjust(4)
    kb.row(InlineKeyboardButton(text="⬅️ Другой день", callback_data="back:days"))
    return kb.as_markup()


def share_phone() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Отправить мой номер", request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )


def confirm() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Подтвердить", callback_data="confirm:yes"),
        InlineKeyboardButton(text="✖️ Отмена", callback_data="confirm:no"),
    ]])


def my_bookings(bookings) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for b in bookings:
        kb.button(text=f"Отменить {b['day'][8:10]}.{b['day'][5:7]} {b['start']}",
                  callback_data=f"cancel:{b['id']}")
    kb.adjust(1)
    return kb.as_markup()


def admin_days(days_list: list[date]) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for d in days_list:
        kb.button(text=texts.day_label(d), callback_data=f"adm_day:{d.isoformat()}")
    kb.adjust(2)
    return kb.as_markup()


def admin_cancel(bookings) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for b in bookings:
        kb.button(text=f"❌ {b['start']} {b['name']}", callback_data=f"adm_cancel:{b['id']}")
    kb.adjust(1)
    return kb.as_markup()
