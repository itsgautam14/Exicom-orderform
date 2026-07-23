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
    ("orders", "packing_details", "TEXT DEFAULT ''"),
    ("orders", "customer_phone", "VARCHAR(32) DEFAULT ''"),
    ("orders", "customer_email", "VARCHAR(255) DEFAULT ''"),
    ("orders", "customer_postal_code", "VARCHAR(32) DEFAULT ''"),
    ("order_trackings", "quote_number", "VARCHAR(64) DEFAULT ''"),
    ("order_trackings", "currency", "VARCHAR(8) DEFAULT ''"),
    ("order_trackings", "current_stage", "VARCHAR(32) DEFAULT 'so_created'"),
    ("order_trackings", "doc_data", "BYTEA"),
    ("order_trackings", "doc_filename", "VARCHAR(255) DEFAULT ''"),
    ("order_trackings", "doc_content_type", "VARCHAR(100) DEFAULT ''"),
]


def _backfill_tracking() -> None:
    """Give every SO Created quotation its SO Order Tracking row.

    A tracking row is only ever meant to exist for a quote that's actually
    reached "Order Received" (status so_created) — this catches ones that
    reached that status before crud.mark_so_created's sync existed. Idempotent
    — matches by quote_number, so re-running on every startup just refreshes
    partner/market/kam/date/value, never duplicates a row or touches the
    manual dispatch/delivery/remarks fields.
    """
    from app import crud, models  # local import: crud isn't needed at module load

    db = SessionLocal()
    try:
        for obj in db.query(models.Order).filter(models.Order.status == "so_created").all():
            crud._sync_tracking_from_order(db, obj)
        # Rows created before the fulfillment tracker existed have no stage
        # history yet — seed "so_created" so the tracker isn't blank for them.
        for row in db.query(models.OrderTracking).filter(~models.OrderTracking.stage_events.any()).all():
            row.stage_events.append(models.TrackingStageEvent(stage="so_created"))
        db.commit()
    finally:
        db.close()


def _remove_premature_tracking() -> None:
    """One-time cleanup: tracking rows used to get created from every quote
    save/autosave/approval, not just "Order Received". Delete any row that's
    linked to a real order (non-blank quote_number) whose order never actually
    reached so_created — those were never legitimate tracking rows. Rows with
    a blank quote_number (added by hand or via Excel import) are left alone.
    """
    from app import models

    db = SessionLocal()
    try:
        so_created_numbers = {
            q for (q,) in db.query(models.Order.quote_number).filter(models.Order.status == "so_created")
        }
        stale = [
            row for row in db.query(models.OrderTracking).filter(models.OrderTracking.quote_number != "").all()
            if row.quote_number not in so_created_numbers
        ]
        for row in stale:
            db.delete(row)
        if stale:
            db.commit()
            print(f"Removed {len(stale)} tracking row(s) from orders that never reached SO Created.")
    finally:
        db.close()


def run() -> None:
    with engine.begin() as conn:
        for table, column, ddl in _COLUMNS:
            conn.execute(text(
                f'ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS {column} {ddl}'
            ))
    _backfill_tracking()
    _remove_premature_tracking()
    print("Schema migration complete.")


if __name__ == "__main__":
    run()
