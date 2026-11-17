"""Точка входа: python bot.py"""
import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

import config
from handlers import router


async def main():
    if not config.BOT_TOKEN:
        raise SystemExit("Укажите BOT_TOKEN в файле .env (см. README.md)")
    bot = Bot(config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
