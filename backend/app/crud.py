"""Database operations and total computation."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas


# ----------------------------- Totals ----------------------------------------

def compute_totals(order: models.Order) -> dict:
    """Return a plain dict of the order plus computed line/subtotal/tax/grand totals.

    This is the single source of truth used both by the API response and the
    PDF template, so the document and the JSON always agree.
    """
    items = []
    subtotal = 0.0
    for it in order.items:
        line_total = float(it.unit_price) * int(it.quantity)
        subtotal += line_total
        items.append({
            "id": it.id,
            "position": it.position,
            "product_code": it.product_code,
            "code_note": it.code_note,
            "product_name": it.product_name,
            "description": it.description,
            "unit_price": float(it.unit_price),
            "quantity": int(it.quantity),
            "unit": it.unit,
            "line_total": line_total,
        })

    tax_rate = float(order.tax_rate or 0)
    tax_amount = round(subtotal * tax_rate / 100.0, 2)
    freight_charge = round(float(order.freight_charge or 0), 2)
    insurance_charge = round(float(order.insurance_charge or 0), 2)
    grand_total = round(subtotal + freight_charge + insurance_charge + tax_amount, 2)

    return {
        "id": order.id,
        "quote_number": order.quote_number,
        "prepared_for": order.prepared_for,
        "proposed_by": order.proposed_by,
        "quote_date": order.quote_date,
        "offer_valid_through": order.offer_valid_through,
        "incoterms": order.incoterms,
        "currency": order.currency,
        "tax_rate": tax_rate,
        "bill_to_company": order.bill_to_company,
        "bill_to_gst": order.bill_to_gst,
        "bill_to_address": order.bill_to_address,
        "bill_to_country": order.bill_to_country,
        "ship_to_company": order.ship_to_company,
        "ship_to_gst": order.ship_to_gst,
        "ship_to_address": order.ship_to_address,
        "ship_to_country": order.ship_to_country,
        "payment_terms": order.payment_terms,
        "warranty": order.warranty,
        "validity": order.validity,
        "lead_time": order.lead_time,
        "transport_mode": order.transport_mode or "",
        "transport_country": order.transport_country or "",
        "transport_qty": float(order.transport_qty or 0),
        "port_of_loading": order.port_of_loading or "",
        "port_of_destination": order.port_of_destination or "",
        "freight_charge": freight_charge,
        "insurance_charge": insurance_charge,
        "po_required": order.po_required,
        "po_number": order.po_number,
        "po_amount": order.po_amount,
        "items": items,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
        "grand_total": grand_total,
    }


# ----------------------------- Catalog ---------------------------------------

def list_products(db: Session, active_only: bool = False) -> list[models.CatalogProduct]:
    stmt = select(models.CatalogProduct)
    if active_only:
        stmt = stmt.where(models.CatalogProduct.is_active.is_(True))
    stmt = stmt.order_by(models.CatalogProduct.product_name)
    return list(db.scalars(stmt))


def get_product(db: Session, product_id: str) -> models.CatalogProduct | None:
    return db.get(models.CatalogProduct, product_id)


def create_product(db: Session, data: schemas.CatalogProductCreate) -> models.CatalogProduct:
    obj = models.CatalogProduct(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_product(db: Session, obj: models.CatalogProduct, data: schemas.CatalogProductUpdate):
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


def delete_product(db: Session, obj: models.CatalogProduct) -> None:
    db.delete(obj)
    db.commit()


# ----------------------------- Orders ----------------------------------------

def list_orders(db: Session) -> list[models.Order]:
    stmt = select(models.Order).order_by(models.Order.created_at.desc())
    return list(db.scalars(stmt))


def get_order(db: Session, order_id: str) -> models.Order | None:
    return db.get(models.Order, order_id)


def _apply_items(order: models.Order, items: list[schemas.OrderItemIn]) -> None:
    order.items = [
        models.OrderItem(position=i, **it.model_dump())
        for i, it in enumerate(items)
    ]


def create_order(db: Session, data: schemas.OrderCreate) -> models.Order:
    payload = data.model_dump(exclude={"items"})
    obj = models.Order(**payload)
    _apply_items(obj, data.items)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_order(db: Session, obj: models.Order, data: schemas.OrderUpdate) -> models.Order:
    for k, v in data.model_dump(exclude={"items"}).items():
        setattr(obj, k, v)
    _apply_items(obj, data.items)
    db.commit()
    db.refresh(obj)
    return obj


def delete_order(db: Session, obj: models.Order) -> None:
    db.delete(obj)
    db.commit()
