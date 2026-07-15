"""SQLAlchemy ORM models — the PostgreSQL schema."""
from __future__ import annotations

import datetime as dt
import uuid
from typing import Optional

from sqlalchemy import (
    String, Text, Integer, Numeric, Boolean, DateTime, ForeignKey, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class CatalogProduct(Base):
    """Backend-managed product catalog. Pricing lives here and auto-fills orders."""
    __tablename__ = "catalog_products"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    product_code: Mapped[str] = mapped_column(String(64), index=True)
    code_note: Mapped[str] = mapped_column(Text, default="")
    product_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    unit: Mapped[str] = mapped_column(String(32), default="Nos.")
    category: Mapped[str] = mapped_column(String(64), default="")
    # Multi-currency / multi-tier price matrix:
    #   { "USD": [[min_qty, max_qty_or_null, price], ...], "EUR": [...], ... }
    prices: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)

    # Header
    quote_number: Mapped[str] = mapped_column(String(64), index=True)
    prepared_for: Mapped[str] = mapped_column(String(255), default="")
    proposed_by: Mapped[str] = mapped_column(String(255), default="")
    quote_date: Mapped[str] = mapped_column(String(64), default="")
    offer_valid_through: Mapped[str] = mapped_column(String(64), default="")
    incoterms: Mapped[str] = mapped_column(String(16), default="EXW")
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0)

    # Bill to
    bill_to_company: Mapped[str] = mapped_column(String(255), default="")
    bill_to_gst: Mapped[str] = mapped_column(String(64), default="")
    bill_to_address: Mapped[str] = mapped_column(Text, default="")
    bill_to_country: Mapped[str] = mapped_column(String(128), default="")

    # Ship to
    ship_to_company: Mapped[str] = mapped_column(String(255), default="")
    ship_to_gst: Mapped[str] = mapped_column(String(64), default="")
    ship_to_address: Mapped[str] = mapped_column(Text, default="")
    ship_to_country: Mapped[str] = mapped_column(String(128), default="")

    # Terms
    payment_terms: Mapped[str] = mapped_column(Text, default="")
    warranty: Mapped[str] = mapped_column(Text, default="")
    validity: Mapped[str] = mapped_column(Text, default="")
    lead_time: Mapped[str] = mapped_column(Text, default="")
    comments: Mapped[str] = mapped_column(Text, default="")

    # Logistics (populated when incoterms = CIF)
    transport_mode: Mapped[str] = mapped_column(String(32), default="")
    transport_country: Mapped[str] = mapped_column(String(64), default="")
    transport_qty: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    port_of_loading: Mapped[str] = mapped_column(String(128), default="")
    port_of_destination: Mapped[str] = mapped_column(String(128), default="")
    freight_charge: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    insurance_charge: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    # Purchase order
    po_required: Mapped[bool] = mapped_column(Boolean, default=False)
    po_number: Mapped[str] = mapped_column(String(64), default="")
    po_amount: Mapped[str] = mapped_column(String(64), default="")

    # Approval workflow:
    #   draft     — logistics couldn't be filled (CIF with no transport cost); needs an admin.
    #   submitted — a complete quotation saved by a sales person.
    #   approved  — an admin filled the missing logistics and published it.
    status: Mapped[str] = mapped_column(String(16), default="submitted", index=True)
    # Why a draft needs admin sign-off: comma list of "logistics" / "pricebook".
    approval_reason: Mapped[str] = mapped_column(String(64), default="")
    # Per-browser creator id so a sales person sees only the quotes they made.
    created_by: Mapped[str] = mapped_column(String(64), default="", index=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan",
        order_by="OrderItem.position", lazy="selectin",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)

    product_code: Mapped[str] = mapped_column(String(64), default="")
    code_note: Mapped[str] = mapped_column(Text, default="")
    product_name: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit: Mapped[str] = mapped_column(String(32), default="Nos.")
    discount_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)  # per-line discount %
    input_cable: Mapped[str] = mapped_column(String(8), default="")  # "Yes" / "No" / ""

    order: Mapped["Order"] = relationship(back_populates="items")


class LogisticsRate(Base):
    """Per-country transportation rates (INR), managed via the logistics admin panel.

    New / edited rates start as ``pending`` and must be ``approved`` before the
    order form will use them for CIF auto-pricing.
    """
    __tablename__ = "logistics_rates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    country: Mapped[str] = mapped_column(String(128), index=True)
    sea_rate: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)      # per pallet
    air_up_to_500: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)  # per box, ≤500kg
    air_above_500: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)  # per box, >500kg
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | approved

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class QuoteCounter(Base):
    """Atomic per-month counter that hands out globally-unique quote sequence numbers."""
    __tablename__ = "quote_counters"

    period: Mapped[str] = mapped_column(String(16), primary_key=True)  # e.g. "2026-JUL"
    value: Mapped[int] = mapped_column(Integer, default=0)
