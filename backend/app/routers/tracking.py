"""Order-tracking endpoints: manual CRUD + bulk Excel import.

Lives under the Approvals module's "SO Order Tracking" tab. Writes require the
admin password. The Excel import reads the raw request body (no python-multipart
needed).
"""
from __future__ import annotations

import datetime as dt
import io
import re

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.get("", response_model=list[schemas.OrderTrackingOut], dependencies=[Depends(require_admin)])
def list_tracking(db: Session = Depends(get_db)):
    return crud.list_trackings(db)


@router.post("", response_model=schemas.OrderTrackingOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_tracking(payload: schemas.OrderTrackingCreate, db: Session = Depends(get_db)):
    return crud.create_tracking(db, payload)


@router.put("/{tracking_id}", response_model=schemas.OrderTrackingOut,
            dependencies=[Depends(require_admin)])
def update_tracking(tracking_id: str, payload: schemas.OrderTrackingUpdate, db: Session = Depends(get_db)):
    obj = crud.get_tracking(db, tracking_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tracking row not found")
    return crud.update_tracking(db, obj, payload)


@router.delete("/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_tracking(tracking_id: str, db: Session = Depends(get_db)):
    obj = crud.get_tracking(db, tracking_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tracking row not found")
    crud.delete_tracking(db, obj)


# --- Excel import ------------------------------------------------------------

def _norm(h) -> str:
    return re.sub(r"[^a-z0-9]", "", str(h or "").lower())


def _field_for(header) -> str | None:
    """Map a header cell to a model field, tolerant of wording variations."""
    key = _norm(header)
    if not key:
        return None
    if key.startswith("partner"):
        return "partner"
    if key.startswith("market"):
        return "market"
    if key.startswith("kam"):
        return "kam"
    if key.startswith("ordered"):
        return "ordered"
    if key.startswith("spec"):
        return "specifications"
    if "dateoforder" in key or key == "orderdate":
        return "date_of_order"
    if key == "value" or "amount" in key:
        return "value"
    if key.startswith("currency") or key in ("curr", "ccy"):
        return "currency"
    if "dispatch" in key:
        return "date_of_dispatch"
    # "Expected Delivery" / "EX-Date of delivery" / any "…delivery"
    if "delivery" in key:
        return "ex_date_of_delivery"
    if key.startswith("status"):
        return "status"
    if key.startswith("note") or key.startswith("remark"):
        return "notes"
    return None


def _to_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _to_value(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^0-9.\-]", "", str(v))
    try:
        return float(s) if s not in ("", "-", ".", "-.") else None
    except ValueError:
        return None


def _key(*parts) -> tuple:
    return tuple((p or "").strip().lower() for p in parts)


@router.post("/import", dependencies=[Depends(require_admin)])
async def import_tracking(request: Request, db: Session = Depends(get_db)):
    """Bulk-import tracking rows from an uploaded .xlsx (raw body).

    Ignores blank rows, validates the required Partner column, skips duplicates
    (same Partner + Ordered + Date of Order), and returns a per-row summary.
    """
    data = await request.body()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file uploaded.")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read the file — please upload a valid .xlsx.")
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"imported": 0, "skipped": 0, "errors": ["The sheet is empty."]}

    header = rows[0]
    col_field = {i: _field_for(h) for i, h in enumerate(header)}
    mapped = {f for f in col_field.values() if f}
    if not mapped:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No recognisable columns. Expected: Partner, Market, KAM, Ordered, Specifications, "
            "Date of Order, Value, Currency, Date of Dispatch, Expected Delivery, Status, Remarks.",
        )
    if "partner" not in mapped:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing required column: Partner.")

    # Existing rows → dedupe against the database.
    existing = {
        _key(t.partner, t.ordered, t.date_of_order) for t in crud.list_trackings(db)
    }

    parsed: list[dict] = []
    errors: list[str] = []
    skipped = 0
    seen: set = set()
    for ridx, row in enumerate(rows[1:], start=2):
        rec: dict = {}
        for i, cell in enumerate(row):
            field = col_field.get(i)
            if not field:
                continue
            rec[field] = _to_value(cell) if field == "value" else _to_text(cell)

        # Ignore completely blank rows.
        if not any(str(v).strip() for v in rec.values() if v is not None):
            continue
        # Required column validation.
        if not (rec.get("partner") or "").strip():
            errors.append(f"Row {ridx}: Partner is required.")
            continue

        key = _key(rec.get("partner"), rec.get("ordered"), rec.get("date_of_order"))
        if key in existing or key in seen:
            skipped += 1
            continue
        seen.add(key)
        parsed.append(rec)

    imported = crud.bulk_create_trackings(db, parsed) if parsed else 0
    return {"imported": imported, "skipped": skipped, "errors": errors}
