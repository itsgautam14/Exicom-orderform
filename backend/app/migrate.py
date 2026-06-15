"""Lightweight, idempotent schema migrations.

`Base.metadata.create_all` creates missing *tables* but never alters existing
ones, so when we add columns to a model we must add them to already-deployed
databases here. Every statement uses `ADD COLUMN IF NOT EXISTS`, so running
this repeatedly is safe.
"""
from __future__ import annotations

from sqlalchemy import text

from app.database import engine

# (table, column, SQL type + default) tuples
_COLUMNS = [
    ("catalog_products", "prices", "JSONB DEFAULT '{}'::jsonb"),
    ("orders", "quote_date", "VARCHAR(64) DEFAULT ''"),
    ("orders", "transport_mode", "VARCHAR(32) DEFAULT ''"),
    ("orders", "port_of_loading", "VARCHAR(128) DEFAULT ''"),
    ("orders", "port_of_destination", "VARCHAR(128) DEFAULT ''"),
    ("orders", "freight_charge", "NUMERIC(14,2) DEFAULT 0"),
    ("orders", "insurance_charge", "NUMERIC(14,2) DEFAULT 0"),
]


def run() -> None:
    with engine.begin() as conn:
        for table, column, ddl in _COLUMNS:
            conn.execute(text(
                f'ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS {column} {ddl}'
            ))
    print("Schema migration complete.")


if __name__ == "__main__":
    run()
