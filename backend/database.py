"""
SQLite database layer for IntelliPark DSS.
Tables:
  officers        - registered patrol officers
  officer_locations - GPS pings (rolling, keeps last 500 per officer)
  assignments     - hotspot assignments with status lifecycle
  assignment_log  - full audit trail of status changes
"""

import aiosqlite
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "intellipark.db")


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS officers (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            badge       TEXT UNIQUE NOT NULL,
            unit_name   TEXT NOT NULL,
            password    TEXT NOT NULL,
            status      TEXT DEFAULT 'off_duty',
            last_seen   TEXT,
            fcm_token   TEXT
        )""")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS officer_locations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            officer_id  TEXT NOT NULL,
            lat         REAL NOT NULL,
            lng         REAL NOT NULL,
            accuracy    REAL,
            timestamp   TEXT NOT NULL,
            FOREIGN KEY (officer_id) REFERENCES officers(id)
        )""")

        await db.execute("""
        CREATE INDEX IF NOT EXISTS idx_loc_officer
        ON officer_locations(officer_id, timestamp DESC)
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            hotspot_id      INTEGER NOT NULL,
            junction        TEXT NOT NULL,
            lat             REAL NOT NULL,
            lng             REAL NOT NULL,
            risk_level      TEXT NOT NULL,
            risk_score      REAL NOT NULL,
            officer_id      TEXT NOT NULL,
            officer_name    TEXT NOT NULL,
            unit_name       TEXT NOT NULL,
            road_distance_km REAL,
            eta_minutes     INTEGER,
            status          TEXT DEFAULT 'pending',
            assigned_at     TEXT NOT NULL,
            accepted_at     TEXT,
            arrived_at      TEXT,
            completed_at    TEXT,
            notes           TEXT,
            FOREIGN KEY (officer_id) REFERENCES officers(id)
        )""")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS assignment_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            officer_id    TEXT NOT NULL,
            from_status   TEXT,
            to_status     TEXT NOT NULL,
            timestamp     TEXT NOT NULL,
            note          TEXT,
            FOREIGN KEY (assignment_id) REFERENCES assignments(id)
        )""")

        # Seed default officers matching the patrol units in main.py
        officers = [
            ("A1", "SI Pradeep Nair",   "BTP-A1", "Unit Alpha-1",   "officer123"),
            ("A2", "HC Sunita Reddy",   "BTP-A2", "Unit Alpha-2",   "officer123"),
            ("B1", "SI Mohan Gowda",    "BTP-B1", "Unit Bravo-1",   "officer123"),
            ("B2", "ASI Kavitha R.",    "BTP-B2", "Unit Bravo-2",   "officer123"),
            ("C1", "HC Rajan M.",       "BTP-C1", "Unit Charlie-1", "officer123"),
        ]
        import hashlib
        for oid, name, badge, unit, pw in officers:
            hashed = hashlib.sha256(pw.encode()).hexdigest()
            await db.execute("""
            INSERT OR IGNORE INTO officers (id, name, badge, unit_name, password, status)
            VALUES (?, ?, ?, ?, ?, 'available')
            """, (oid, name, badge, unit, hashed))

        await db.commit()
    print("[DB] SQLite initialised at", DB_PATH)
