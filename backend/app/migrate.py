"""Lightweight, idempotent schema migrations.

`Base.metadata.create_all` creates missing *tables* but never alters existing
ones, so when we add columns to a model we must add them to already-deployed
databases here. Every statement uses `ADD COLUMN IF NOT EXISTS`, so running
this repeatedly is safe.
"""
from __future__ import annotations

from sqlalchemy import text

from app.database import engine, SessionLocal

# (table, column, SQL type + default) tuples
_COLUMNS = [
    ("catalog_products", "prices", "JSONB DEFAULT '{}'::jsonb"),
    ("orders", "bill_to_gst", "VARCHAR(64) DEFAULT ''"),
    ("orders", "quote_date", "VARCHAR(64) DEFAULT ''"),
    ("orders", "transport_mode", "VARCHAR(32) DEFAULT ''"),
    ("orders", "transport_country", "VARCHAR(64) DEFAULT ''"),
    ("orders", "transport_qty", "NUMERIC(14,2) DEFAULT 0"),
    ("order_items", "input_cable", "VARCHAR(8) DEFAULT ''"),
    ("order_items", "discount_pct", "NUMERIC(6,2) DEFAULT 0"),
    ("order_items", "eur_discount", "VARCHAR(8) DEFAULT ''"),
    ("orders", "port_of_loading", "VARCHAR(128) DEFAULT ''"),
    ("orders", "port_of_destination", "VARCHAR(128) DEFAULT ''"),
    ("orders", "freight_charge", "NUMERIC(14,2) DEFAULT 0"),
    ("orders", "insurance_charge", "NUMERIC(14,2) DEFAULT 0"),
    ("orders", "status", "VARCHAR(16) DEFAULT 'submitted'"),
    ("orders", "comments", "TEXT DEFAULT ''"),
    ("orders", "approval_reason", "VARCHAR(64) DEFAULT ''"),
    ("orders", "approval_note", "TEXT DEFAULT ''"),
    ("orders", "created_by", "VARCHAR(64) DEFAULT ''"),
    ("orders", "payment_term_type", "VARCHAR(16) DEFAULT 'predefined'"),
    ("orders", "payment_term_text", "TEXT DEFAULT ''"),
    ("order_trackings", "quote_number", "VARCHAR(64) DEFAULT ''"),
    ("order_trackings", "currency", "VARCHAR(8) DEFAULT ''"),
    ("order_trackings", "current_stage", "VARCHAR(32) DEFAULT 'so_created'"),
    ("order_trackings", "doc_data", "BYTEA"),
    ("order_trackings", "doc_filename", "VARCHAR(255) DEFAULT ''"),
    ("order_trackings", "doc_content_type", "VARCHAR(100) DEFAULT ''"),
]


def _backfill_tracking() -> None:
    """Give every already-saved quotation its SO Order Tracking row.

    New quotations get this automatically at save time (see
    crud._sync_tracking_from_order); this catches quotations that were saved
    before that existed. Idempotent — matches by quote_number, so re-running
    on every startup just refreshes partner/market/kam/date/value, never
    duplicates a row or touches the manual dispatch/delivery/status fields.
    """
    from app import crud, models  # local import: crud isn't needed at module load

    db = SessionLocal()
    try:
        for obj in db.query(models.Order).all():
            crud._sync_tracking_from_order(db, obj)
        # Rows created before the fulfillment tracker existed have no stage
        # history yet — seed "so_created" so the tracker isn't blank for them.
        for row in db.query(models.OrderTracking).filter(~models.OrderTracking.stage_events.any()).all():
            row.stage_events.append(models.TrackingStageEvent(stage="so_created"))
        db.commit()
    finally:
        db.close()


def run() -> None:
    with engine.begin() as conn:
        for table, column, ddl in _COLUMNS:
            conn.execute(text(
                f'ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS {column} {ddl}'
            ))
    _backfill_tracking()
    print("Schema migration complete.")


if __name__ == "__main__":
    run()
