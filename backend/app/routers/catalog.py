"""Catalog (product + pricing) endpoints — used by the backend team."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("", response_model=list[schemas.CatalogProductOut])
def list_products(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.list_products(db, active_only=active_only)


@router.post("", response_model=schemas.CatalogProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: schemas.CatalogProductCreate, db: Session = Depends(get_db)):
    return crud.create_product(db, payload)


@router.get("/{product_id}", response_model=schemas.CatalogProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return obj


@router.put("/{product_id}", response_model=schemas.CatalogProductOut)
def update_product(product_id: str, payload: schemas.CatalogProductUpdate, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return crud.update_product(db, obj, payload)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    obj = crud.get_product(db, product_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    crud.delete_product(db, obj)
