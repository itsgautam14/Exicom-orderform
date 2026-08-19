"""SQLAlchemy ORM models — the PostgreSQL schema."""
from __future__ import annotations

import datetime as dt
import uuid
from typing import Optional

from sqlalchemy import (
    String, Text, Integer, Numeric, Boolean, DateTime, ForeignKey, LargeBinary, func,
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
    customer_phone: Mapped[str] = mapped_column(String(32), default="")
    customer_email: Mapped[str] = mapped_column(String(255), default="")
    customer_postal_code: Mapped[str] = mapped_column(String(32), default="")
    eori_number: Mapped[str] = mapped_column(String(32), default="")  # EUR only, optional
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
    payment_term_type: Mapped[str] = mapped_column(String(16), default="predefined")  # predefined | custom
    payment_term_text: Mapped[str] = mapped_column(Text, default="")  # actual text shown in the PDF
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
    packing_details: Mapped[str] = mapped_column(Text, default="")

    # Purchase order
    po_required: Mapped[bool] = mapped_column(Boolean, default=False)
    # Auto-generated (not user-entered) the moment "PO/Order Received" is
    # clicked — see crud.mark_so_created. Fixed after that, like quote_date.
    po_number: Mapped[str] = mapped_column(String(64), default="")
    po_amount: Mapped[str] = mapped_column(String(64), default="")
    po_date: Mapped[str] = mapped_column(String(64), default="")

    # Approval workflow:
    #   draft     — logistics couldn't be filled (CIF with no transport cost); needs an admin.
    #   submitted — a complete quotation saved by a sales person.
    #   approved  — an admin filled the missing logistics and published it.
    status: Mapped[str] = mapped_column(String(16), default="submitted", index=True)
    # Why a draft needs admin sign-off: comma list of "logistics" / "pricebook".
    approval_reason: Mapped[str] = mapped_column(String(64), default="")
    # Why the sales person quoted below pricebook. Internal only — never in the PDF.
    approval_note: Mapped[str] = mapped_column(Text, default="")
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
    eur_discount: Mapped[str] = mapped_column(String(8), default="")  # EUR only: "with" / "without" / ""
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


class OrderTracking(Base):
    """Post-sale order tracking rows (from the 'order tracking' sheet).

    Auto-created/refreshed from a quotation's data as soon as it's saved from the
    Order Form (see crud._sync_tracking_from_order), and also filled in manually
    or bulk-imported from Excel for partners with no quotation on file.
    """
    __tablename__ = "order_trackings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    # Links back to Order.quote_number when this row was generated from a quotation.
    # Blank for rows added manually or imported from Excel.
    quote_number: Mapped[str] = mapped_column(String(64), default="", index=True)
    partner: Mapped[str] = mapped_column(String(255), default="")
    market: Mapped[str] = mapped_column(String(128), default="")
    kam: Mapped[str] = mapped_column(String(128), default="")
    ordered: Mapped[str] = mapped_column(Text, default="")
    # Product code(s) from the linked Order's line items — auto-filled like
    # `ordered`, never hand-typed (see crud._sync_tracking_from_order).
    part_code: Mapped[str] = mapped_column(String(255), default="")
    specifications: Mapped[str] = mapped_column(Text, default="")
    date_of_order: Mapped[str] = mapped_column(String(64), default="")
    # Plain hand-entered date, not part of the Fulfillment Tracker stage
    # pipeline (that was tried and reverted — see git history) — just an
    # input field alongside date_of_order ("SO Creation").
    advance_received_date: Mapped[str] = mapped_column(String(64), default="")
    value: Mapped[Optional[float]] = mapped_column(Numeric(16, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), default="")
    # Total ordered quantity (across all line items) — divides into `value` to
    # get a per-unit price for splitting across the dispatch slots below.
    # Auto-filled from the linked Order's items when synced from a real quote;
    # editable by hand for manually-added / Excel-imported rows.
    total_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Transport mode (Airways / Sea Freight), fetched from the linked Order's
    # Quote Form logistics section — not user-entered here.
    transport_mode: Mapped[str] = mapped_column(String(32), default="")
    date_of_dispatch: Mapped[str] = mapped_column(String(64), default="")
    ex_date_of_delivery: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(64), default="", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    # Locked fields — only settable through the password-gated
    # /planned-dates endpoint (see routers/tracking.py), never through the
    # regular open update_tracking path.
    planned_production_date: Mapped[str] = mapped_column(String(64), default="")
    planned_dispatch_date: Mapped[str] = mapped_column(String(64), default="")
    # Freely editable by anyone, unlike the two fields above.
    expected_dispatch_date: Mapped[str] = mapped_column(String(64), default="")

    # Whether this order dispatches in multiple tranches — null until the user
    # answers the Yes/No prompt shown before Dispatch Details; only "Yes"
    # reveals the 3 dispatch slots below.
    dispatch_in_tranches: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Legacy fixed 3-slot dispatch columns — superseded by the TrackingDispatch
    # table (see `dispatches` below), which supports any number of slots. Kept
    # only so migrate.py can copy any pre-existing data out of them; no longer
    # read or written anywhere else.
    dispatch1_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dispatch1_date: Mapped[str] = mapped_column(String(64), default="")
    dispatch1_kam: Mapped[str] = mapped_column(String(128), default="")
    dispatch2_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dispatch2_date: Mapped[str] = mapped_column(String(64), default="")
    dispatch2_kam: Mapped[str] = mapped_column(String(128), default="")
    dispatch3_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dispatch3_date: Mapped[str] = mapped_column(String(64), default="")
    dispatch3_kam: Mapped[str] = mapped_column(String(128), default="")

    # Single consolidated dispatch for orders that ship as one bulk lot
    # (dispatch_in_tranches == False) — tracks product + quantity instead of
    # the 3 generic tranche slots above.
    bulk_product: Mapped[str] = mapped_column(String(255), default="")
    bulk_part_code: Mapped[str] = mapped_column(String(64), default="")
    bulk_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bulk_date: Mapped[str] = mapped_column(String(64), default="")
    bulk_kam: Mapped[str] = mapped_column(String(128), default="")

    # Fulfillment pipeline: in_production -> fg_ready -> dispatched -> shipment -> receipt.
    # See TrackingStageEvent for the timestamped history (duration + remarks per stage).
    current_stage: Mapped[str] = mapped_column(String(32), default="in_production")

    # Signed quotation / PO document, stored inline (small files — no object
    # storage configured). doc_filename is blank when nothing's been uploaded.
    doc_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    doc_filename: Mapped[str] = mapped_column(String(255), default="")
    doc_content_type: Mapped[str] = mapped_column(String(100), default="")

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    stage_events: Mapped[list["TrackingStageEvent"]] = relationship(
        back_populates="tracking", cascade="all, delete-orphan",
        order_by="TrackingStageEvent.created_at", lazy="selectin",
    )
    dispatches: Mapped[list["TrackingDispatch"]] = relationship(
        back_populates="tracking", cascade="all, delete-orphan",
        order_by="TrackingDispatch.created_at", lazy="selectin",
    )


class TrackingStageEvent(Base):
    """One row per stage a tracked order has passed through, so the UI can show
    how long it sat in each stage and why (remarks — e.g. reason for a delay)."""
    __tablename__ = "tracking_stage_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("order_trackings.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(32))  # in_production | fg_ready | dispatched | shipment | receipt
    remarks: Mapped[str] = mapped_column(Text, default="")
    # Who logged this stage entry — hand-entered, not inferred from anywhere else.
    kam: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tracking: Mapped["OrderTracking"] = relationship(back_populates="stage_events")


class TrackingDispatch(Base):
    """One dispatch tranche for an order shipping dispatch_in_tranches=True.

    Replaces the old fixed dispatch1/2/3 columns with an open-ended list, so a
    tracked order can have as many partial-dispatch slots as it actually ships
    in instead of a hard cap of 3. No KAM here — unlike the fulfillment stage
    log, dispatch slots don't record who logged them.
    """
    __tablename__ = "tracking_dispatches"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tracking_id: Mapped[str] = mapped_column(ForeignKey("order_trackings.id", ondelete="CASCADE"), index=True)
    qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    date: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tracking: Mapped["OrderTracking"] = relationship(back_populates="dispatches")
