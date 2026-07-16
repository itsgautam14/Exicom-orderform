"""Database operations and total computation."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas


# Input cable add-on: fixed price per unit (order currency).
INPUT_CABLE_PRICE = 10

# A line priced more than this fraction below the pricebook needs admin approval.
APPROVAL_DISCOUNT = 0.05  # 5%


# ----------------------------- Approval status -------------------------------

def is_logistics_missing(incoterms: str, freight_charge) -> bool:
    """A CIF order with no transport cost couldn't have its logistics filled."""
    return (incoterms or "").upper() == "CIF" and float(freight_charge or 0) <= 0


def order_status_for(incoterms: str, freight_charge) -> str:
    """Status from logistics completeness only (used by the live preview/pdf)."""
    return "draft" if is_logistics_missing(incoterms, freight_charge) else "submitted"


def pricebook_unit_price(product: "models.CatalogProduct", currency: str, qty: int):
    """The catalog list price for a product at the given currency and quantity.

    Mirrors the frontend ``priceFor``: pick the tier whose [min, max] brackets the
    quantity; fall back to the first tier when the qty is below the lowest bracket.
    Returns ``None`` when there's no price in that currency.
    """
    tiers = (product.prices or {}).get(currency)
    if not tiers:
        return None
    for lo, hi, price in tiers:
        if qty >= lo and (hi is None or qty <= hi):
            return float(price)
    return float(tiers[0][2])


def below_pricebook_items(db: Session, currency: str, items) -> bool:
    """True if any line is priced more than ``APPROVAL_DISCOUNT`` below pricebook."""
    for it in items:
        code = getattr(it, "product_code", "") or ""
        if not code:
            continue
        prod = db.query(models.CatalogProduct).filter(
            models.CatalogProduct.product_code == code
        ).first()
        if not prod:
            continue
        book = pricebook_unit_price(prod, currency, int(getattr(it, "quantity", 0) or 0))
        if book is None:
            continue
        # Compare the *effective* price the customer pays (after any line discount)
        # against the pricebook, allowing up to APPROVAL_DISCOUNT (5%) before flagging.
        disc = float(getattr(it, "discount_pct", 0) or 0)
        effective = float(getattr(it, "unit_price", 0) or 0) * (1 - disc / 100.0)
        threshold = book * (1 - APPROVAL_DISCOUNT)
        if effective < threshold - 1e-6:  # epsilon so exactly 5% isn't flagged
            return True
    return False


# ----------------------------- Totals ----------------------------------------

def compute_totals(order: models.Order) -> dict:
    """Return a plain dict of the order plus computed line/subtotal/tax/grand totals.

    This is the single source of truth used both by the API response and the
    PDF template, so the document and the JSON always agree.
    """
    items = []
    subtotal = 0.0
    input_cable_total = 0.0
    for it in order.items:
        disc = float(it.discount_pct or 0)
        line_total = round(float(it.unit_price) * int(it.quantity) * (1 - disc / 100.0), 2)
        subtotal += line_total
        if (it.input_cable or "") == "Yes":
            input_cable_total += INPUT_CABLE_PRICE * int(it.quantity)
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
            "discount_pct": disc,
            "input_cable": it.input_cable or "",
            "line_total": line_total,
        })

    tax_rate = float(order.tax_rate or 0)
    tax_amount = round(subtotal * tax_rate / 100.0, 2)
    input_cable_total = round(input_cable_total, 2)
    freight_charge = round(float(order.freight_charge or 0), 2)
    insurance_charge = round(float(order.insurance_charge or 0), 2)
    grand_total = round(subtotal + input_cable_total + freight_charge + insurance_charge + tax_amount, 2)

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
        "payment_term_type": order.payment_term_type or "predefined",
        "payment_term_text": order.payment_term_text or order.payment_terms or "",
        "warranty": order.warranty,
        "validity": order.validity,
        "lead_time": order.lead_time,
        "comments": order.comments or "",
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
        "status": order.status or "submitted",
        "approval_reason": order.approval_reason or "",
        "created_by": order.created_by or "",
        "items": items,
        "subtotal": round(subtotal, 2),
        "input_cable_total": input_cable_total,
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


# ----------------------------- Logistics rates -------------------------------

def list_logistics(db: Session) -> list[models.LogisticsRate]:
    stmt = select(models.LogisticsRate).order_by(models.LogisticsRate.country)
    return list(db.scalars(stmt))


def get_logistics(db: Session, rate_id: str) -> models.LogisticsRate | None:
    return db.get(models.LogisticsRate, rate_id)


def create_logistics(db: Session, data: schemas.LogisticsRateCreate) -> models.LogisticsRate:
    # Entered by the logistics handler in the (admin-gated) Logistics tab → active
    # immediately. Countries auto-flagged by a draft quote are added elsewhere as
    # `pending` (see _ensure_pending_logistics) until the handler prices them.
    obj = models.LogisticsRate(**data.model_dump(), status="approved")
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_logistics(db: Session, obj: models.LogisticsRate, data: schemas.LogisticsRateUpdate):
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    obj.status = "approved"  # the logistics handler is the authority — active immediately
    db.commit()
    db.refresh(obj)
    return obj


def approve_logistics(db: Session, obj: models.LogisticsRate) -> models.LogisticsRate:
    obj.status = "approved"
    db.commit()
    db.refresh(obj)
    return obj


def delete_logistics(db: Session, obj: models.LogisticsRate) -> None:
    db.delete(obj)
    db.commit()


# ----------------------------- Orders ----------------------------------------

def list_orders(db: Session, created_by: str | None = None) -> list[models.Order]:
    stmt = select(models.Order).order_by(models.Order.created_at.desc())
    if created_by:
        stmt = stmt.where(models.Order.created_by == created_by)
    return list(db.scalars(stmt))


def get_order(db: Session, order_id: str) -> models.Order | None:
    return db.get(models.Order, order_id)


def _apply_items(order: models.Order, items: list[schemas.OrderItemIn]) -> None:
    order.items = [
        models.OrderItem(position=i, **it.model_dump())
        for i, it in enumerate(items)
    ]


def _ensure_pending_logistics(db: Session, country: str) -> None:
    """Make sure a draft's destination country exists in the logistics table.

    When a quote is drafted because its transport cost is missing, we drop the
    country into the Logistics data as a ``pending`` row (with blank rates) so the
    admin can go there and mention the prices. Existing countries are left as-is.
    """
    country = (country or "").strip()
    if not country:
        return
    exists = db.query(models.LogisticsRate).filter(
        func.lower(models.LogisticsRate.country) == country.lower()
    ).first()
    if not exists:
        db.add(models.LogisticsRate(country=country, status="pending"))


def create_order(db: Session, data: schemas.OrderCreate) -> models.Order:
    payload = data.model_dump(exclude={"items"})
    obj = models.Order(**payload)
    _apply_items(obj, data.items)

    # The server decides whether a quote needs admin sign-off — never the client.
    # Two independent reasons: missing CIF logistics, and/or a price below pricebook.
    reasons = []
    logistics_missing = is_logistics_missing(obj.incoterms, obj.freight_charge)
    if logistics_missing:
        reasons.append("logistics")
    if below_pricebook_items(db, obj.currency, data.items):
        reasons.append("pricebook")
    obj.status = "draft" if reasons else "submitted"
    obj.approval_reason = ",".join(reasons)

    db.add(obj)
    if logistics_missing:
        # Route the missing-logistics country into the Logistics panel for pricing.
        _ensure_pending_logistics(
            db, obj.transport_country or obj.ship_to_country or obj.bill_to_country
        )
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


def publish_order(db: Session, obj: models.Order, data: schemas.OrderPublish) -> models.Order:
    """Admin fills in the missing logistics fields, then marks the order approved.

    Only the provided (logistics) fields are touched — the line items and the
    rest of the quotation the sales person built are left untouched.
    """
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    obj.status = "approved"
    db.commit()
    db.refresh(obj)
    return obj


def mark_so_created(db: Session, obj: models.Order) -> models.Order:
    """Advance an approved quotation to the final ``so_created`` state."""
    obj.status = "so_created"
    db.commit()
    db.refresh(obj)
    return obj


def delete_order(db: Session, obj: models.Order) -> None:
    db.delete(obj)
    db.commit()


# ----------------------------- Order tracking --------------------------------

def list_trackings(db: Session) -> list[models.OrderTracking]:
    stmt = select(models.OrderTracking).order_by(models.OrderTracking.created_at.desc())
    return list(db.scalars(stmt))


def get_tracking(db: Session, tracking_id: str) -> models.OrderTracking | None:
    return db.get(models.OrderTracking, tracking_id)


def create_tracking(db: Session, data: schemas.OrderTrackingCreate) -> models.OrderTracking:
    obj = models.OrderTracking(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_tracking(db: Session, obj: models.OrderTracking, data: schemas.OrderTrackingUpdate):
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


def delete_tracking(db: Session, obj: models.OrderTracking) -> None:
    db.delete(obj)
    db.commit()


def bulk_create_trackings(db: Session, rows: list[dict]) -> int:
    objs = [models.OrderTracking(**r) for r in rows]
    db.add_all(objs)
    db.commit()
    return len(objs)
