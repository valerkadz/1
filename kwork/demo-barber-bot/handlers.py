"""Логика диалога с клиентом и админ-команды."""
import html
import re
from datetime import date

from aiogram import Bot, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message

import config
import db
import keyboards as kb
import texts

router = Router()
conn = db.connect()


class Booking(StatesGroup):
    service = State()
    day = State()
    time = State()
    name = State()
    phone = State()
    confirm = State()


# ---------- Главное меню ----------

@router.message(CommandStart())
async def start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(texts.WELCOME, reply_markup=kb.main_menu())


@router.message(F.text == kb.BTN_PRICES)
async def prices(message: Message):
    await message.answer(texts.PRICES)


@router.message(F.text == kb.BTN_CONTACTS)
async def contacts(message: Message):
    await message.answer(texts.CONTACTS)


@router.message(F.text == kb.BTN_MY)
async def my_bookings(message: Message):
    items = db.user_bookings(conn, message.from_user.id)
    if not items:
        await message.answer("У вас пока нет записей. Нажмите «📅 Записаться» 🙂")
        return
    lines = "\n".join(f"• {texts.booking_line(b)}" for b in items)
    await message.answer(f"🗂 <b>Ваши записи</b>\n\n{lines}", reply_markup=kb.my_bookings(items))


@router.callback_query(F.data.startswith("cancel:"))
async def cancel_own(call: CallbackQuery, bot: Bot):
    booking_id = int(call.data.split(":")[1])
    booking = db.get_booking(conn, booking_id)
    if booking and db.cancel_booking(conn, booking_id, call.from_user.id):
        await call.message.edit_text(f"Запись отменена:\n{texts.booking_line(booking)}")
        await notify_admin(bot, f"❌ Клиент отменил запись\n{texts.booking_line(booking)}\n"
                                f"{html.escape(booking['name'])}, {booking['phone']}")
    else:
        await call.answer("Запись не найдена", show_alert=True)
    await call.answer()


# ---------- Запись: услуга → день → время → имя → телефон ----------

@router.message(F.text == kb.BTN_BOOK)
async def book_start(message: Message, state: FSMContext):
    await state.clear()
    await state.set_state(Booking.service)
    await message.answer("Выберите услугу:", reply_markup=kb.services())


@router.callback_query(Booking.service, F.data.startswith("svc:"))
async def choose_service(call: CallbackQuery, state: FSMContext):
    await state.update_data(service=call.data.split(":")[1])
    await state.set_state(Booking.day)
    await call.message.edit_text("Выберите день:", reply_markup=kb.days(db.upcoming_days()))
    await call.answer()


@router.callback_query(F.data == "back:services")
async def back_services(call: CallbackQuery, state: FSMContext):
    await state.set_state(Booking.service)
    await call.message.edit_text("Выберите услугу:", reply_markup=kb.services())
    await call.answer()


@router.callback_query(Booking.day, F.data.startswith("day:"))
async def choose_day(call: CallbackQuery, state: FSMContext):
    day = date.fromisoformat(call.data.split(":", 1)[1])
    data = await state.get_data()
    slots = db.free_slots(conn, day, data["service"])
    if not slots:
        await call.answer("На этот день свободного времени нет, выберите другой", show_alert=True)
        return
    await state.update_data(day=day.isoformat())
    await state.set_state(Booking.time)
    await call.message.edit_text(f"{texts.day_full(day)}\nВыберите время:", reply_markup=kb.slots(slots))
    await call.answer()


@router.callback_query(F.data == "back:days")
async def back_days(call: CallbackQuery, state: FSMContext):
    await state.set_state(Booking.day)
    await call.message.edit_text("Выберите день:", reply_markup=kb.days(db.upcoming_days()))
    await call.answer()


@router.callback_query(Booking.time, F.data.startswith("time:"))
async def choose_time(call: CallbackQuery, state: FSMContext):
    await state.update_data(time=call.data.split(":", 1)[1])
    await state.set_state(Booking.name)
    await call.message.edit_reply_markup()
    await call.message.answer("Как к вам обращаться? Напишите имя:")
    await call.answer()


@router.message(Booking.name, F.text, ~F.text.startswith("/"))
async def enter_name(message: Message, state: FSMContext):
    name = message.text.strip()[:50]
    if len(name) < 2:
        await message.answer("Напишите, пожалуйста, имя 🙂")
        return
    await state.update_data(name=name)
    await state.set_state(Booking.phone)
    await message.answer("Отправьте номер телефона кнопкой ниже или напишите его:",
                         reply_markup=kb.share_phone())


@router.message(Booking.phone, ~F.text.startswith("/"))
async def enter_phone(message: Message, state: FSMContext):
    phone = message.contact.phone_number if message.contact else (message.text or "")
    digits = re.sub(r"\D", "", phone)
    if not 10 <= len(digits) <= 15:
        await message.answer("Похоже, в номере ошибка. Пример: +7 900 123-45-67")
        return
    await state.update_data(phone=phone)
    await state.set_state(Booking.confirm)
    d = await state.get_data()
    title, price, _ = config.SERVICES[d["service"]]
    await message.answer("Почти готово!", reply_markup=kb.main_menu())
    await message.answer(
        "Проверьте запись:\n\n"
        f"✂️ {title} — {price} ₽\n"
        f"📅 {texts.day_full(date.fromisoformat(d['day']))}, {d['time']}\n"
        f"👤 {html.escape(d['name'])}, {html.escape(phone)}",
        reply_markup=kb.confirm(),
    )


@router.callback_query(Booking.confirm, F.data.startswith("confirm:"))
async def confirm(call: CallbackQuery, state: FSMContext, bot: Bot):
    d = await state.get_data()
    await state.clear()
    if call.data == "confirm:no":
        await call.message.edit_text("Запись отменена. Если передумаете — нажмите «📅 Записаться».")
        await call.answer()
        return
    day = date.fromisoformat(d["day"])
    booking_id = db.add_booking(conn, call.from_user.id, d["name"], d["phone"], d["service"], day, d["time"])
    if booking_id is None:
        await call.message.edit_text("Ой, это время только что заняли 😔 Нажмите «📅 Записаться» и выберите другое.")
        await call.answer()
        return
    booking = db.get_booking(conn, booking_id)
    await call.message.edit_text(
        f"✅ Вы записаны!\n\n{texts.booking_line(booking)}\n📍 {config.ADDRESS}\n\n"
        "Отменить запись можно в разделе «🗂 Мои записи»."
    )
    await notify_admin(bot, f"🆕 <b>Новая запись</b>\n{texts.booking_line(booking)}\n"
                            f"👤 {html.escape(d['name'])}, {html.escape(d['phone'])}")
    await call.answer()


# ---------- Администратор ----------

async def notify_admin(bot: Bot, text: str):
    if config.ADMIN_ID:
        await bot.send_message(config.ADMIN_ID, text)


def is_admin(user_id: int) -> bool:
    return config.ADMIN_ID != 0 and user_id == config.ADMIN_ID


@router.message(Command("admin"))
async def admin(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer("🔧 Админ-панель. Выберите день, чтобы посмотреть записи:",
                         reply_markup=kb.admin_days(db.upcoming_days()))


@router.callback_query(F.data.startswith("adm_day:"))
async def admin_day(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return await call.answer()
    day = date.fromisoformat(call.data.split(":", 1)[1])
    items = db.day_bookings(conn, day)
    if not items:
        await call.message.answer(f"{texts.day_full(day)}: записей нет")
    else:
        lines = "\n".join(
            f"{b['start']} — {config.SERVICES[b['service']][0]}, {html.escape(b['name'])}, {b['phone']}"
            for b in items)
        await call.message.answer(f"📋 <b>{texts.day_full(day)}</b>\n\n{lines}",
                                  reply_markup=kb.admin_cancel(items))
    await call.answer()


@router.callback_query(F.data.startswith("adm_cancel:"))
async def admin_cancel(call: CallbackQuery, bot: Bot):
    if not is_admin(call.from_user.id):
        return await call.answer()
    booking = db.get_booking(conn, int(call.data.split(":")[1]))
    if booking and db.cancel_booking(conn, booking["id"]):
        await call.message.answer(f"Запись отменена: {texts.booking_line(booking)}")
        await bot.send_message(booking["user_id"],
                               f"К сожалению, ваша запись отменена:\n{texts.booking_line(booking)}\n"
                               f"Позвоните нам: {config.PHONE}")
    await call.answer()
