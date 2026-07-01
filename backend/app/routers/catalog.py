"""Catalog (product + pricing) endpoints — used by the backend team.

Reads are public (the order form needs them). Writes require the admin
password, supplied via the `X-Admin-Password` header and checked against
`settings.admin_password` — the password lives on the server only.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def require_admin(x_admin_password: str = Header(default="")) -> None:
    if x_admin_password != settings.admin_password:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin password")


@router.post("/verify")
def verify_admin(payload: schemas.AdminAuth):
    """Check an admin password (used by the catalog gate to unlock the UI)."""
    if payload.password != settings.admin_password:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin password")
    return {"ok": True}


@router.get("", response_model=list[schemas.CatalogProductOut])
def list_products(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.list_products(db, active_only=active_only)


@router.post("", response_model=schemas.CatalogProductOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
def create_product(payload: schemas.CatalogProductCreate, db: Session = Depends(get_db)):
    return crud.create_product(db, payload)


@router.get("/{product_id}", response_model=schemas.CatalogProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return obj


@router.put("/{product_id}", response_model=schemas.CatalogProductOut,
            dependencies=[Depends(require_admin)])
def update_product(product_id: str, payload: schemas.CatalogProductUpdate, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return crud.update_product(db, obj, payload)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_product(product_id: str, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    crud.delete_product(db, obj)
