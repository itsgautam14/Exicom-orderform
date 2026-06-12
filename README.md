# Exicom Order Form Generator

A production web app that generates Order Form PDFs **visually identical** to the
reference `Exicom_Q0000007.pdf`, with a managed product catalog so the backend
team can set material costs that auto-fill every order.

**Stack:** Next.js + TypeScript + Tailwind (frontend) · FastAPI (backend) ·
PostgreSQL (database) · **HTML + WeasyPrint** (PDF engine).

---

## What is dynamic vs. fixed

**Dynamic (entered per order):** header (Prepared For, Offer Valid Through, Proposed
By, Quote Number, Incoterms), Bill To / Ship To (company, address, country, GST),
order items (code, name, description, unit price, qty, currency), terms (payment,
warranty, validity, lead time), and the PO section (required, number, amount).

**Auto-calculated:** line totals, subtotal, tax, grand total.

**Fixed template content (always rendered):** Exicom logo, company information block,
footer, bank details page, terms structure, address labels, and table headers — all
defined in `backend/app/pdf/generator.py` + `backend/app/pdf/templates/order_form.html`.

---

## Layout fidelity

The PDF is produced from `backend/app/pdf/templates/order_form.html` by WeasyPrint.
It reproduces the source 1:1:

- **Page 1** — header (logo left / ORDER FORM + meta right), company info, thick rule,
  Address Information (Bill To / Ship To), Order Items table with teal header row,
  Subtotal / Tax / **TOTAL** (teal) totals block, Terms & Conditions, Purchase Order
  section with PO Number / PO Amount fields and signature line.
- **Page 2** — Bank Details box and the centered company footer line.

A4, 13/14/12/14 mm margins, Helvetica/Arial stack (DejaVu/Liberation bundled in Docker
for deterministic rendering).

---

## Quick start (Docker — recommended)

```bash
cd exicom-orderform
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- The catalog is seeded automatically on first boot.

## Manual / local dev

### Backend

WeasyPrint needs native libraries. On Debian/Ubuntu:
```bash
sudo apt-get install -y libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
  libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info fonts-dejavu
```
On Windows, follow the WeasyPrint GTK install notes (https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows).

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # point DATABASE_URL at your Postgres
python -m app.seed              # create tables + seed catalog
uvicorn app.main:app --reload   # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev                         # http://localhost:3000
```

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/catalog` | list catalog products |
| POST   | `/api/catalog` | create product (price) |
| PUT    | `/api/catalog/{id}` | update product |
| DELETE | `/api/catalog/{id}` | delete product |
| GET    | `/api/orders` | list saved orders (with totals) |
| POST   | `/api/orders` | save an order |
| GET    | `/api/orders/{id}` | get a saved order |
| PUT    | `/api/orders/{id}` | update a saved order |
| DELETE | `/api/orders/{id}` | delete |
| GET    | `/api/orders/{id}/pdf` | **render saved order to PDF** |
| GET    | `/api/orders/{id}/preview` | render saved order to HTML |
| POST   | `/api/orders/pdf` | render an **unsaved** order to PDF |
| POST   | `/api/orders/preview` | render an **unsaved** order to HTML (used by live preview) |

---

## Database schema

- **catalog_products** — `id, product_code, code_note, product_name, description,
  unit_price, currency, unit, category, is_active, created_at, updated_at`
- **orders** — header + bill-to + ship-to + terms + PO fields
- **order_items** — `order_id, position, product_code, code_note, product_name,
  description, unit_price, quantity, unit` (totals are computed, never stored, so
  the JSON and the PDF can never drift apart)

See `backend/app/models.py`. Tables are auto-created on startup; for real production
use Alembic migrations.

---

## How the pieces connect

1. Backend team sets prices in **Catalog / Pricing** (`CatalogAdmin`).
2. Sales builds an order in **Order Form**; "Fill from Catalog" pulls code, name,
   description, unit price, and unit straight from the catalog.
3. The editor posts the order to `/api/orders/preview` (debounced) and shows the
   returned HTML in an iframe — **the exact same template WeasyPrint uses for the PDF**,
   so the preview is the PDF.
4. **Download PDF** posts to `/api/orders/pdf`; **Save Order** persists it and you can
   re-download anytime from `/api/orders/{id}/pdf`.
