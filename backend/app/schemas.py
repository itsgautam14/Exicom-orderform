"""Pydantic schemas for request / response validation."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# ----------------------------- Admin auth ------------------------------------

class AdminAuth(BaseModel):
    password: str = ""


# ----------------------------- Catalog ---------------------------------------

class CatalogProductBase(BaseModel):
    product_code: str = ""
    code_note: str = ""
    product_name: str
    description: str = ""
    unit_price: float = 0
    currency: str = "USD"
    unit: str = "Nos."
    category: str = ""
    prices: dict = {}
    is_active: bool = True


class CatalogProductCreate(CatalogProductBase):
    pass


class CatalogProductUpdate(BaseModel):
    product_code: Optional[str] = None
    code_note: Optional[str] = None
    product_name: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    prices: Optional[dict] = None
    is_active: Optional[bool] = None


class CatalogProductOut(CatalogProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ----------------------------- Logistics rates -------------------------------

class LogisticsRateBase(BaseModel):
    country: str
    sea_rate: Optional[float] = None
    air_up_to_500: Optional[float] = None
    air_above_500: Optional[float] = None


class LogisticsRateCreate(LogisticsRateBase):
    pass


class LogisticsRateUpdate(BaseModel):
    country: Optional[str] = None
    sea_rate: Optional[float] = None
    air_up_to_500: Optional[float] = None
    air_above_500: Optional[float] = None


class LogisticsRateOut(LogisticsRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str


# ----------------------------- Order items -----------------------------------

class OrderItemIn(BaseModel):
    product_code: str = ""
    code_note: str = ""
    product_name: str = ""
    description: str = ""
    unit_price: float = 0
    quantity: int = 1
    unit: str = "Nos."
    discount_pct: float = 0
    input_cable: str = ""


class OrderItemOut(OrderItemIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    position: int = 0
    line_total: float = 0


# ----------------------------- Orders ----------------------------------------

class OrderBase(BaseModel):
    quote_number: str = Field(..., examples=["Q-00000007"])
    prepared_for: str = ""
    proposed_by: str = ""
    quote_date: str = ""
    offer_valid_through: str = ""
    incoterms: str = "EXW"
    currency: str = "USD"
    tax_rate: float = 0

    bill_to_company: str = ""
    bill_to_gst: str = ""
    bill_to_address: str = ""
    bill_to_country: str = ""

    ship_to_company: str = ""
    ship_to_gst: str = ""
    ship_to_address: str = ""
    ship_to_country: str = ""

    payment_terms: str = ""
    payment_term_type: str = "predefined"  # predefined | custom
    payment_term_text: str = ""
    warranty: str = ""
    validity: str = ""
    lead_time: str = ""
    comments: str = ""

    # Logistics (CIF only)
    transport_mode: str = ""
    transport_country: str = ""
    transport_qty: float = 0
    port_of_loading: str = ""
    port_of_destination: str = ""
    freight_charge: float = 0
    insurance_charge: float = 0

    po_required: bool = False
    po_number: str = ""
    po_amount: str = ""

    created_by: str = ""


class OrderCreate(OrderBase):
    items: list[OrderItemIn] = []


class OrderUpdate(OrderCreate):
    pass


class OrderPublish(BaseModel):
    """Fields an admin can set while publishing a draft (all optional)."""
    incoterms: Optional[str] = None
    transport_mode: Optional[str] = None
    transport_country: Optional[str] = None
    transport_qty: Optional[float] = None
    port_of_loading: Optional[str] = None
    port_of_destination: Optional[str] = None
    freight_charge: Optional[float] = None
    insurance_charge: Optional[float] = None
    payment_terms: Optional[str] = None
    payment_term_type: Optional[str] = None
    payment_term_text: Optional[str] = None


class OrderOut(OrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str = "submitted"
    approval_reason: str = ""
    items: list[OrderItemOut] = []
    # computed
    subtotal: float = 0
    tax_amount: float = 0
    grand_total: float = 0


# ----------------------------- Order tracking --------------------------------

class OrderTrackingBase(BaseModel):
    partner: str = ""
    market: str = ""
    kam: str = ""
    ordered: str = ""
    specifications: str = ""
    date_of_order: str = ""
    value: Optional[float] = None
    date_of_dispatch: str = ""
    ex_date_of_delivery: str = ""
    status: str = ""
    notes: str = ""


class OrderTrackingCreate(OrderTrackingBase):
    pass


class OrderTrackingUpdate(BaseModel):
    partner: Optional[str] = None
    market: Optional[str] = None
    kam: Optional[str] = None
    ordered: Optional[str] = None
    specifications: Optional[str] = None
    date_of_order: Optional[str] = None
    value: Optional[float] = None
    date_of_dispatch: Optional[str] = None
    ex_date_of_delivery: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class OrderTrackingOut(OrderTrackingBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
