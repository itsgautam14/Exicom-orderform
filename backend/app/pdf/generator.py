"""PDF generation using Jinja2 + WeasyPrint.

Renders the Order Form template to a faithful A4 PDF identical to the
reference Exicom_Q0000007.pdf.
"""
from __future__ import annotations

import io
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from app.pdf.logo import EXICOM_LOGO_SVG
from app.config import settings

TEMPLATE_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


# ---- fixed template content that appears on every generated PDF -------------

COMPANY_INFO = {
    "name": "Exicom Tele-Systems Limited",
    "address": (
        "Plot No. S-105 to S-112, Mansanpally Cross Road, "
        "Maheswaram Rangareddy, Telangana – 501359, India"
    ),
    "cin": "L64203HP1994PLC014541",
    "gstin": "06AAACH2448G1ZV",
    "phone": "+91 124 6615200",
    "email": "evse@exicom.in",
    "website": "www.exicom.com",
    "footer_address": "Plot 38, Institutional Area, Sector 32, Gurugram, Haryana – 122015, India",
}

BANK_DETAILS = {
    "account_holder": "Exicom Tele-Systems Limited",
    "bank_branch": "Punjab National Bank – Branch: Nehru Place, New Delhi - 110019",
    "iban": "1529008700062787",
    "swift": "PUNBINBBDNP",
    "currency_note": "USD (as per PO)",
}


def render_order_pdf(order: dict) -> bytes:
    """Render an order dict into PDF bytes.

    `order` is expected to already contain computed line_total / subtotal /
    tax_amount / grand_total values (see crud.compute_totals).
    """
    template = _env.get_template("order_form.html")
    html_str = template.render(
        order=order,
        company=COMPANY_INFO,
        bank=BANK_DETAILS,
        logo_svg=EXICOM_LOGO_SVG,
    )
    pdf_io = io.BytesIO()
    HTML(string=html_str, base_url=str(TEMPLATE_DIR)).write_pdf(pdf_io)
    return pdf_io.getvalue()


def render_order_html(order: dict) -> str:
    """Return the rendered HTML (useful for live browser preview)."""
    template = _env.get_template("order_form.html")
    return template.render(
        order=order,
        company=COMPANY_INFO,
        bank=BANK_DETAILS,
        logo_svg=EXICOM_LOGO_SVG,
    )
