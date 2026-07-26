"""Order CRUD + PDF / HTML rendering endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, HTMLResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import require_roles
from app.database import get_db
from app.pdf.generator import render_order_pdf, render_order_html

router = APIRouter(prefix="/api/orders", tags=["orders"])

_MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]


@router.post("/next-number")
def next_quote_number(db: Session = Depends(get_db)):
    """Atomically hand out the next globally-unique quote number for the current month.

    Format: ``{year}-{month}-{NN}`` (e.g. ``2026-july-02``). The frontend appends a
    ``-HHMMSS`` time stamp so numbers stay unique even across concurrent sales people.
    """
    now = datetime.now()
    period = f"{now.year}-{_MONTHS[now.month - 1]}"
    value = db.execute(
        text(
            "INSERT INTO quote_counters (period, value) VALUES (:p, 1) "
            "ON CONFLICT (period) DO UPDATE SET value = quote_counters.value + 1 "
            "RETURNING value"
        ),
        {"p": period},
    ).scalar_one()
    db.commit()
    return {"period": period, "sequence": value, "quote_number": f"{period}-{value:02d}"}


# The saved-order collection is the "Orders" / Approval panel — readable by
# sales_ops (own quotes only), manager, logistics (needs it for Pending
# Logistic) and admin.
@router.get("", response_model=list[schemas.OrderOut])
def list_orders(
    created_by: str | None = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("sales_ops", "manager", "logistics")),
):
    # A sales person only ever sees their own quotes — any client-supplied
    # `created_by` override is ignored for that role. Manager/logistics/admin
    # see everyone's (logistics needs full visibility to find CIF drafts
    # missing logistics on the Pending Logistic tab).
    if user.role == "sales_ops":
        created_by = user.username
    return [crud.compute_totals(o) for o in crud.list_orders(db, created_by=created_by)]


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: schemas.OrderCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("sales_ops", "manager")),
):
    payload.created_by = user.username
    obj = crud.create_order(db, payload)
    return crud.compute_totals(obj)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("sales_ops", "manager", "logistics")),
):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if user.role == "sales_ops" and obj.created_by != user.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to do this")
    return crud.compute_totals(obj)


@router.put("/{order_id}", response_model=schemas.OrderOut)
def update_order(
    order_id: str,
    payload: schemas.OrderUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("sales_ops", "manager")),
):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if user.role == "sales_ops" and obj.created_by != user.username:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to do this")
    if (obj.status or "") in ("approved", "so_created"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Approved quotations can no longer be edited — duplicate it instead."
        )
    # Ownership never changes on edit — keep whoever originally created it.
    payload.created_by = obj.created_by
    obj = crud.update_order(db, obj, payload)
    return crud.compute_totals(obj)


@router.post("/{order_id}/publish", response_model=schemas.OrderOut,
             dependencies=[Depends(require_roles("logistics"))])
def publish_order(order_id: str, payload: schemas.OrderPublish, db: Session = Depends(get_db)):
    """Fill in the missing logistics and mark the draft as approved."""
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    obj = crud.publish_order(db, obj, payload)
    return crud.compute_totals(obj)


@router.post("/{order_id}/so-created", response_model=schemas.OrderOut,
             dependencies=[Depends(require_roles("admin"))])
def mark_so_created(order_id: str, db: Session = Depends(get_db)):
    """Mark a quotation as Order Received — the customer confirmed the PO
    against it, so it graduates to the final SO Created state. Allowed from
    either Submitted (no sign-off was needed) or Approved (sign-off is done)."""
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if (obj.status or "") not in ("submitted", "approved"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only submitted or approved quotations can be marked Order Received"
        )
    obj = crud.mark_so_created(db, obj)
    return crud.compute_totals(obj)


@router.post("/{order_id}/reject", response_model=schemas.OrderOut,
             dependencies=[Depends(require_roles("admin"))])
def reject_order(order_id: str, db: Session = Depends(get_db)):
    """Reject a draft quotation awaiting pricing approval."""
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if (obj.status or "") != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft quotations can be rejected")
    obj = crud.reject_order(db, obj)
    return crud.compute_totals(obj)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_roles("admin"))])
def delete_order(order_id: str, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    crud.delete_order(db, obj)


@router.get("/{order_id}/pdf")
def order_pdf(order_id: str, po: bool = False, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if (obj.status or "") == "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This quote is still a draft awaiting approval — no PDF yet."
        )
    data = crud.compute_totals(obj)
    pdf_bytes = render_order_pdf(data, po_mode=po)
    prefix = "PO" if po else "Exicom"
    filename = f"{prefix}_{data['quote_number'] or order_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{order_id}/preview", response_class=HTMLResponse)
def order_preview(order_id: str, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    data = crud.compute_totals(obj)
    return HTMLResponse(render_order_html(data))


def _build_order_data(payload: schemas.OrderCreate, db: Session | None = None) -> dict:
    """Shared computation for preview and pdf endpoints.

    When ``db`` is given (the download path) the status also reflects a
    below-pricebook price; the frequent live preview skips that DB lookup.
    """
    items = []
    subtotal = 0.0
    input_cable_total = 0.0
    for i, it in enumerate(payload.items):
        disc = float(it.discount_pct or 0)
        line_total = round(float(it.unit_price) * int(it.quantity) * (1 - disc / 100.0))
        subtotal += line_total
        if (it.input_cable or "") == "Yes":
            input_cable_total += crud.INPUT_CABLE_PRICE * int(it.quantity)
        items.append({**it.model_dump(), "id": str(i), "position": i, "line_total": line_total})
    tax_amount = round(subtotal * float(payload.tax_rate or 0) / 100.0)
    input_cable_total = round(input_cable_total)
    freight_charge = round(float(payload.freight_charge or 0))
    insurance_charge = round(float(payload.insurance_charge or 0))
    grand_total = round(subtotal + input_cable_total + freight_charge + insurance_charge + tax_amount)

    logistics_missing = crud.is_logistics_missing(payload.incoterms, freight_charge)
    below = db is not None and crud.below_pricebook_items(db, payload.currency, payload.items)
    custom_payment = (payload.payment_term_type or "") == "custom"
    status = "draft" if (logistics_missing or below or custom_payment) else "submitted"

    return {
        **payload.model_dump(exclude={"items"}),
        "id": "preview",
        "status": status,
        "items": items,
        "subtotal": round(subtotal),
        "input_cable_total": input_cable_total,
        "tax_amount": tax_amount,
        "freight_charge": freight_charge,
        "insurance_charge": insurance_charge,
        "grand_total": grand_total,
    }


@router.post("/preview", response_class=HTMLResponse)
def preview_unsaved(payload: schemas.OrderCreate):
    """Render HTML preview for an in-progress order without persisting it."""
    return HTMLResponse(render_order_html(_build_order_data(payload)))


@router.post("/pdf")
def pdf_unsaved(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    """Generate a PDF for an in-progress order without persisting it."""
    data = _build_order_data(payload, db)
    pdf_bytes = render_order_pdf(data)
    filename = f"Exicom_{data['quote_number'] or 'order'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
