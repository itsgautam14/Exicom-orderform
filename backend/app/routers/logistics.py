"""Logistics (per-country transport rate) endpoints.

Reads are public (the order form needs approved rates). Writes require the admin
password. New/edited rates are created as `pending`; an admin approves them via
the approve endpoint before the order form will use them.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import require_admin
from app.database import get_db

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.get("", response_model=list[schemas.LogisticsRateOut])
def list_rates(db: Session = Depends(get_db)):
    return crud.list_logistics(db)


@router.post("", response_model=schemas.LogisticsRateOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_rate(payload: schemas.LogisticsRateCreate, db: Session = Depends(get_db)):
    return crud.create_logistics(db, payload)


@router.put("/{rate_id}", response_model=schemas.LogisticsRateOut,
            dependencies=[Depends(require_admin)])
def update_rate(rate_id: str, payload: schemas.LogisticsRateUpdate, db: Session = Depends(get_db)):
    obj = crud.get_logistics(db, rate_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics rate not found")
    return crud.update_logistics(db, obj, payload)


@router.post("/{rate_id}/approve", response_model=schemas.LogisticsRateOut,
             dependencies=[Depends(require_admin)])
def approve_rate(rate_id: str, db: Session = Depends(get_db)):
    obj = crud.get_logistics(db, rate_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics rate not found")
    return crud.approve_logistics(db, obj)


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_rate(rate_id: str, db: Session = Depends(get_db)):
    obj = crud.get_logistics(db, rate_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logistics rate not found")
    crud.delete_logistics(db, obj)
