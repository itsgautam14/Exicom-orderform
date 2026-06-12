"""Order CRUD + PDF / HTML rendering endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, HTMLResponse
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.pdf.generator import render_order_pdf, render_order_html

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return [crud.compute_totals(o) for o in crud.list_orders(db)]


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    obj = crud.create_order(db, payload)
    return crud.compute_totals(obj)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return crud.compute_totals(obj)


@router.put("/{order_id}", response_model=schemas.OrderOut)
def update_order(order_id: str, payload: schemas.OrderUpdate, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    obj = crud.update_order(db, obj, payload)
    return crud.compute_totals(obj)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: str, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    crud.delete_order(db, obj)


@router.get("/{order_id}/pdf")
def order_pdf(order_id: str, db: Session = Depends(get_db)):
    obj = crud.get_order(db, order_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    data = crud.compute_totals(obj)
    pdf_bytes = render_order_pdf(data)
    filename = f"Exicom_{data['quote_number'] or order_id}.pdf"
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


@router.post("/preview", response_class=HTMLResponse)
def preview_unsaved(payload: schemas.OrderCreate):
    """Render HTML preview for an in-progress order without persisting it."""
    items = []
    subtotal = 0.0
    for i, it in enumerate(payload.items):
        line_total = float(it.unit_price) * int(it.quantity)
        subtotal += line_total
        items.append({**it.model_dump(), "id": str(i), "position": i, "line_total": line_total})
    tax_amount = round(subtotal * float(payload.tax_rate or 0) / 100.0, 2)
    data = {
        **payload.model_dump(exclude={"items"}),
        "id": "preview",
        "items": items,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
        "grand_total": round(subtotal + tax_amount, 2),
    }
    return HTMLResponse(render_order_html(data))


@router.post("/pdf")
def pdf_unsaved(payload: schemas.OrderCreate):
    """Generate a PDF for an in-progress order without persisting it."""
    items = []
    subtotal = 0.0
    for i, it in enumerate(payload.items):
        line_total = float(it.unit_price) * int(it.quantity)
        subtotal += line_total
        items.append({**it.model_dump(), "id": str(i), "position": i, "line_total": line_total})
    tax_amount = round(subtotal * float(payload.tax_rate or 0) / 100.0, 2)
    data = {
        **payload.model_dump(exclude={"items"}),
        "id": "preview",
        "items": items,
        "subtotal": round(subtotal, 2),
        "tax_amount": tax_amount,
        "grand_total": round(subtotal + tax_amount, 2),
    }
    pdf_bytes = render_order_pdf(data)
    filename = f"Exicom_{data['quote_number'] or 'order'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
