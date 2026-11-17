"""Проверка без Telegram: прогоняем полный сценарий записи через фейковую сессию."""
import asyncio
import datetime as dt
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["ADMIN_ID"] = "999"
os.environ["BOT_TOKEN"] = "42:TEST"

from aiogram import Bot, Dispatcher, methods
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.types import CallbackQuery, Chat, Contact, Message, Update, User

import db
import handlers

USER = User(id=1, is_bot=False, first_name="Иван")
CHAT = Chat(id=1, type="private")
NOW = dt.datetime(2026, 1, 1, 12, 0)


class FakeSession(BaseSession):
    def __init__(self):
        super().__init__()
        self.calls = []

    async def make_request(self, bot, method, timeout=None):
        self.calls.append(method)
        if isinstance(method, (methods.SendMessage, methods.EditMessageText)):
            chat_id = getattr(method, "chat_id", 1) or 1
            return Message(message_id=len(self.calls), date=NOW, text=method.text,
                           chat=Chat(id=chat_id, type="private"))
        return True

    async def stream_content(self, *a, **k):
        yield b""

    async def close(self):
        pass


def msg(text=None, contact=None, uid=[0]):
    uid[0] += 1
    return Update(update_id=uid[0], message=Message(
        message_id=uid[0], date=NOW, chat=CHAT, from_user=USER, text=text, contact=contact))


def cb(data, uid=[1000]):
    uid[0] += 1
    m = Message(message_id=1, date=NOW, chat=CHAT, text="x")
    return Update(update_id=uid[0], callback_query=CallbackQuery(
        id=str(uid[0]), from_user=USER, chat_instance="c", message=m, data=data))


def texts_of(session):
    return [c.text for c in session.calls if isinstance(c, (methods.SendMessage, methods.EditMessageText))]


async def main():
    session = FakeSession()
    bot = Bot("42:TEST", session=session, default=DefaultBotProperties(parse_mode="HTML"))
    dp = Dispatcher()
    dp.include_router(handlers.router)
    day = (dt.date.today() + dt.timedelta(days=1)).isoformat()

    steps = [msg("/start"), msg("📅 Записаться"), cb("svc:combo"), cb(f"day:{day}"),
             cb("time:14:00"), msg("Иван"), msg(contact=Contact(phone_number="+79001234567",
             first_name="Иван", user_id=1)), cb("confirm:yes")]
    for u in steps:
        await dp.feed_update(bot, u)

    out = texts_of(session)
    assert any("Вы записаны" in t for t in out), out
    admin = [c for c in session.calls if isinstance(c, methods.SendMessage) and c.chat_id == 999]
    assert admin and "Новая запись" in admin[0].text, "админ не получил уведомление"

    # Время 14:00–15:30 занято: 14:30 и 15:00 недоступны, 13:00 (до 14:00) недоступна для combo (90 мин)
    slots = db.free_slots(handlers.conn, dt.date.fromisoformat(day), "combo")
    assert "14:00" not in slots and "15:00" not in slots and "13:00" not in slots and "15:30" in slots
    assert "12:30" in slots

    # Мои записи и отмена
    session.calls.clear()
    await dp.feed_update(bot, msg("🗂 Мои записи"))
    assert "Ваши записи" in texts_of(session)[0]
    bid = db.user_bookings(handlers.conn, 1)[0]["id"]
    await dp.feed_update(bot, cb(f"cancel:{bid}"))
    assert not db.user_bookings(handlers.conn, 1)

    # Неверный телефон
    session.calls.clear()
    for u in [msg("📅 Записаться"), cb("svc:beard"), cb(f"day:{day}"), cb("time:10:00"),
              msg("Пётр"), msg("123")]:
        await dp.feed_update(bot, u)
    assert "ошибка" in texts_of(session)[-1]

    # Админка: не-админ ничего не получает
    session.calls.clear()
    await dp.feed_update(bot, msg("/admin"))
    assert not texts_of(session)
    print("Все проверки пройдены ✅")


asyncio.run(main())
