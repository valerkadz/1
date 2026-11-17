"""Хранение записей в SQLite и расчёт свободного времени."""
import sqlite3
from datetime import date, datetime, timedelta

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    day TEXT NOT NULL,       -- YYYY-MM-DD
    start TEXT NOT NULL,     -- HH:MM
    minutes INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
"""


def connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    return conn


def _to_min(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def free_slots(conn, day: date, service: str, now: datetime | None = None) -> list[str]:
    """Время начала, на которое можно записаться на услугу в этот день."""
    now = now or datetime.now()
    duration = config.SERVICES[service][2]
    open_m = config.OPEN_TIME.hour * 60 + config.OPEN_TIME.minute
    close_m = config.CLOSE_TIME.hour * 60 + config.CLOSE_TIME.minute
    busy = [
        (_to_min(r["start"]), _to_min(r["start"]) + r["minutes"])
        for r in conn.execute("SELECT start, minutes FROM bookings WHERE day = ?", (day.isoformat(),))
    ]
    slots = []
    for start in range(open_m, close_m - duration + 1, config.SLOT_MINUTES):
        end = start + duration
        if day == now.date() and start <= now.hour * 60 + now.minute:
            continue
        if any(start < b_end and b_start < end for b_start, b_end in busy):
            continue
        slots.append(f"{start // 60:02d}:{start % 60:02d}")
    return slots


def add_booking(conn, user_id, name, phone, service, day: date, start: str) -> int | None:
    """Сохраняет запись. Возвращает None, если время уже заняли."""
    if start not in free_slots(conn, day, service):
        return None
    cur = conn.execute(
        "INSERT INTO bookings (user_id, name, phone, service, day, start, minutes, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, phone, service, day.isoformat(), start,
         config.SERVICES[service][2], datetime.now().isoformat(timespec="seconds")),
    )
    conn.commit()
    return cur.lastrowid


def user_bookings(conn, user_id: int, today: date | None = None):
    today = today or date.today()
    return conn.execute(
        "SELECT * FROM bookings WHERE user_id = ? AND day >= ? ORDER BY day, start",
        (user_id, today.isoformat()),
    ).fetchall()


def day_bookings(conn, day: date):
    return conn.execute(
        "SELECT * FROM bookings WHERE day = ? ORDER BY start", (day.isoformat(),)
    ).fetchall()


def get_booking(conn, booking_id: int):
    return conn.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()


def cancel_booking(conn, booking_id: int, user_id: int | None = None) -> bool:
    """Удаляет запись. Если передан user_id — только свою."""
    if user_id is None:
        cur = conn.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    else:
        cur = conn.execute("DELETE FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user_id))
    conn.commit()
    return cur.rowcount > 0


def upcoming_days(start: date | None = None) -> list[date]:
    start = start or date.today()
    return [start + timedelta(days=i) for i in range(config.DAYS_AHEAD)]
