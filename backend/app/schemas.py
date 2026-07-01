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


# ----------------------------- Order items -----------------------------------

class OrderItemIn(BaseModel):
    product_code: str = ""
    code_note: str = ""
    product_name: str = ""
    description: str = ""
    unit_price: float = 0
    quantity: int = 1
    unit: str = "Nos."
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
    warranty: str = ""
    validity: str = ""
    lead_time: str = ""

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


class OrderCreate(OrderBase):
    items: list[OrderItemIn] = []


class OrderUpdate(OrderCreate):
    pass


class OrderOut(OrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    items: list[OrderItemOut] = []
    # computed
    subtotal: float = 0
    tax_amount: float = 0
    grand_total: float = 0
