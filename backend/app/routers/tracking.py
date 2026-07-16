"""Order-tracking endpoints: manual CRUD + bulk Excel import.

Open to the team (no admin password) so anyone can log and view tracked orders.
The Excel import reads the raw request body (no python-multipart needed).
"""
from __future__ import annotations

import datetime as dt
import io
import re

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.get("", response_model=list[schemas.OrderTrackingOut])
def list_tracking(db: Session = Depends(get_db)):
    return crud.list_trackings(db)


@router.post("", response_model=schemas.OrderTrackingOut, status_code=status.HTTP_201_CREATED)
def create_tracking(payload: schemas.OrderTrackingCreate, db: Session = Depends(get_db)):
    return crud.create_tracking(db, payload)


@router.put("/{tracking_id}", response_model=schemas.OrderTrackingOut)
def update_tracking(tracking_id: str, payload: schemas.OrderTrackingUpdate, db: Session = Depends(get_db)):
    obj = crud.get_tracking(db, tracking_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tracking row not found")
    return crud.update_tracking(db, obj, payload)


@router.delete("/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracking(tracking_id: str, db: Session = Depends(get_db)):
    obj = crud.get_tracking(db, tracking_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tracking row not found")
    crud.delete_tracking(db, obj)


# --- Excel import ------------------------------------------------------------

# Normalised header text -> model field.
_HEADER_FIELD = {
    "partner": "partner",
    "market": "market",
    "kam": "kam",
    "ordered": "ordered",
    "specifications": "specifications",
    "dateoforder": "date_of_order",
    "value": "value",
    "dateofdispatch": "date_of_dispatch",
    "exdateofdelivery": "ex_date_of_delivery",
    "status": "status",
}


def _norm(h) -> str:
    return re.sub(r"[^a-z0-9]", "", str(h or "").lower())


def _field_for(header) -> str | None:
    key = _norm(header)
    if key in _HEADER_FIELD:
        return _HEADER_FIELD[key]
    if key.startswith("notes"):
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


@router.post("/import")
async def import_tracking(request: Request, db: Session = Depends(get_db)):
    """Bulk-import tracking rows from an uploaded .xlsx (raw body)."""
    data = await request.body()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file uploaded")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not read the Excel file")
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"imported": 0}

    # First non-empty row is the header; map its columns to fields.
    header = rows[0]
    col_field = {i: _field_for(h) for i, h in enumerate(header)}
    if not any(col_field.values()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No recognisable column headers found")

    parsed: list[dict] = []
    for row in rows[1:]:
        rec: dict = {}
        for i, cell in enumerate(row):
            field = col_field.get(i)
            if not field:
                continue
            rec[field] = _to_value(cell) if field == "value" else _to_text(cell)
        # skip fully-empty rows
        if any(str(v).strip() for v in rec.values() if v is not None):
            parsed.append(rec)

    count = crud.bulk_create_trackings(db, parsed) if parsed else 0
    return {"imported": count}
