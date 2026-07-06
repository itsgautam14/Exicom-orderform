"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CatalogProduct, OrderInput, OrderItem } from "@/lib/types";

/** Currencies the pricebook carries. */
const CURRENCIES = ["USD", "EUR", "INR", "MYR"];

/** Incoterms offered in the dropdown. */
const INCOTERMS = ["EXW", "FOB", "CIF", "DDP", "DAP"];

/** FOB: fixed transportation cost in INR, converted live to the order currency. */
const FOB_TRANSPORT_INR = 17250;

/**
 * Transportation rates from the Exicom transport sheet, in INR (incl. local + 15% markup).
 *   sea = per pallet (WM³)
 *   air = per box (1 box = 10 kg), tiered by total shipment weight:
 *         upTo500 = 1–500 kg · above500 = over 500 kg
 * null = no rate published for that country/mode.
 */
type AirRate = { upTo500: number | null; above500: number | null };
const TRANSPORT_RATES: Record<string, { sea: number | null; air: AirRate }> = {
  Tunisia: { sea: 37554.4, air: { upTo500: 7072.5, above500: 6842.5 } },
  UAE: { sea: 29322.7, air: { upTo500: 5692.5, above500: 5175 } },
  Qatar: { sea: null, air: { upTo500: 6612.5, above500: 6325 } },
  "Saudi Arabia (KSA)": { sea: null, air: { upTo500: null, above500: null } },
  Netherlands: { sea: 24384.6, air: { upTo500: null, above500: null } },
  Malaysia: { sea: 23286.35, air: { upTo500: 1782.5, above500: 1552.5 } },
  Morocco: { sea: 26578.8, air: { upTo500: null, above500: null } },
};
const TRANSPORT_COUNTRIES = Object.keys(TRANSPORT_RATES);

/** Air rate per box (1 box = 10 kg): +500 kg tier kicks in above 50 boxes. */
function airRate(info: { air: AirRate }, boxes: number): number | null {
  return boxes * 10 > 500 ? info.air.above500 : info.air.upTo500;
}

/** Sea freight is priced per pallet; 1 pallet holds this many boxes. */
const BOXES_PER_PALLET = 20;

/** Classify an order line for the shipping-space calculation. */
type ItemType = "ac" | "spare" | "loadbal" | "inputcable" | "other";
function itemType(it: OrderItem, catalog: CatalogProduct[]): ItemType {
  const p = it.catalog_id ? catalog.find((c) => c.id === it.catalog_id) : undefined;
  const cat = p?.category || "";
  const code = p?.product_code || it.product_code || "";
  const name = (p?.product_name || it.product_name || "").toLowerCase();
  if (code === "HE-INCABLE" || /input cable/.test(name)) return "inputcable";
  if (/load balancing/.test(name)) return "loadbal";
  if (/spare kit/.test(name)) return "spare";
  if (cat === "AC Charger") return "ac";
  return "other";
}

/**
 * Shipping space in pallets, plus the air box count.
 * Ratios: 20 AC chargers = 1 pallet · 10 load-balancing kits = 1 pallet · 20 AC spare kits = 1 pallet.
 * AC spare kits ride free inside AC charger boxes (10 per AC charger). Input cable ships inside the
 * AC charger box → no logistics space.
 */
function shippingSpace(items: OrderItem[], catalog: CatalogProduct[]): { pallets: number; boxes: number } {
  let ac = 0, spare = 0, loadbal = 0, other = 0, boxes = 0;
  for (const it of items) {
    const q = it.quantity || 0;
    const t = itemType(it, catalog);
    if (t === "inputcable") continue;      // no logistics for the input cable
    boxes += q;                            // everything else counts as an air box
    if (t === "ac") ac += q;
    else if (t === "spare") spare += q;
    else if (t === "loadbal") loadbal += q;
    else other += q;
  }
  const freeSpare = Math.min(spare, 10 * ac); // spare kits packed inside AC charger boxes
  const paidSpare = spare - freeSpare;
  const pallets =
    ac / BOXES_PER_PALLET +
    loadbal / 10 +
    paidSpare / 20 +
    other / BOXES_PER_PALLET;
  return { pallets, boxes };
}

/** Standard payment-term presets; "Custom…" opens a free-text box. */
const PAYMENT_PRESETS = [
  "100% advance",
  "50% advance payment on PO release, 50% on material dispatch",
];

/** Fixed production lead time shown on every order form. */
const STANDARD_LEAD_TIME = "Production lead time is 4-6 weeks from PO acceptance";

/** Resolve the catalog price for a given currency + quantity (MoQ tier). */
function priceFor(p: CatalogProduct, currency: string, qty: number): number | null {
  const tiers = p.prices?.[currency];
  if (!tiers || tiers.length === 0) return null;
  for (const [min, max, price] of tiers) {
    if (qty >= min && (max == null || qty <= max)) return price;
  }
  return tiers[0][2]; // qty below the lowest bracket → use the first tier
}

/** Does the catalog product have pricing in the given currency? */
function hasCurrency(p: CatalogProduct, currency: string): boolean {
  if (p.prices && Object.keys(p.prices).length) return Boolean(p.prices[currency]?.length);
  return p.currency === currency; // fallback for products without a price matrix
}

/** Products shown only when the Accessories category is selected (e.g. the input cable). */
function isAccessoryOnly(p: CatalogProduct): boolean {
  return p.product_code === "HE-INCABLE";
}
/** Whether a product should appear given the active category filter. */
function passesCategory(p: CatalogProduct, activeFilter: string | undefined): boolean {
  if (activeFilter) return p.category === activeFilter;      // a chip is selected
  return !isAccessoryOnly(p);                                // no chip → hide accessory-only items
}

const EMPTY_ITEM: OrderItem = {
  product_code: "",
  code_note: "",
  product_name: "",
  description: "",
  unit_price: 0,
  quantity: 1,
  unit: "Nos.",
  input_cable: "",
};

function today(): string {
  return new Date().toLocaleDateString("en-GB");
}

function todayPlus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-GB").replace(/\//g, "/");
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Format: YYYY-MMM-001 (sequence editable from 001 to 999).
function nextQuoteNumber(): string {
  const now = new Date();
  return `${now.getFullYear()}-${MONTHS[now.getMonth()]}-001`;
}

const BLANK_ORDER = (): OrderInput => ({
  quote_number: nextQuoteNumber(),
  prepared_for: "",
  proposed_by: "",
  quote_date: today(),
  offer_valid_through: todayPlus30(),
  incoterms: "EXW",
  currency: "USD",
  tax_rate: 0,
  bill_to_company: "",
  bill_to_gst: "",
  bill_to_address: "",
  bill_to_country: "",
  ship_to_company: "",
  ship_to_gst: "",
  ship_to_address: "",
  ship_to_country: "",
  payment_terms: PAYMENT_PRESETS[0],
  warranty: "36 months from date of commissioning (or 39 months from date of dispatch, whichever is earlier).",
  validity: "This offer is valid for 30 days from the date of issue.",
  lead_time: STANDARD_LEAD_TIME,
  transport_mode: "",
  transport_country: "",
  transport_qty: 0,
  port_of_loading: "",
  port_of_destination: "",
  freight_charge: 0,
  insurance_charge: 0,
  po_required: false,
  po_number: "",
  po_amount: "",
  items: [{ ...EMPTY_ITEM }],
});

export default function OrderFormBuilder() {
  const [order, setOrder] = useState<OrderInput>(BLANK_ORDER);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [itemFilters, setItemFilters] = useState<Record<number, string>>({});
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [shipSameAsBill, setShipSameAsBill] = useState(false);
  const [paymentCustom, setPaymentCustom] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // When "same as Bill To" is on, mirror the Bill To address into Ship To
  // (and keep it in sync if the Bill To fields change afterwards).
  useEffect(() => {
    if (!shipSameAsBill) return;
    setOrder((o) => ({
      ...o,
      ship_to_company: o.bill_to_company,
      ship_to_gst: o.bill_to_gst,
      ship_to_address: o.bill_to_address,
      ship_to_country: o.bill_to_country,
    }));
  }, [shipSameAsBill, order.bill_to_company, order.bill_to_gst, order.bill_to_address, order.bill_to_country]);

  // Live FX rate: 1 INR -> order currency (transport rates are stored in INR).
  const [fx, setFx] = useState<{ rate: number; note: string }>({ rate: 1, note: "" });
  useEffect(() => {
    const cur = order.currency;
    if (cur === "INR") { setFx({ rate: 1, note: "INR — no conversion needed" }); return; }
    setFx({ rate: 0, note: "Fetching live FX rate…" }); // not ready until the fetch resolves
    let cancelled = false;
    (async () => {
      // primary: open.er-api.com  ·  fallback: frankfurter.dev
      for (const url of ["https://open.er-api.com/v6/latest/INR", `https://api.frankfurter.dev/v1/latest?base=INR&symbols=${cur}`]) {
        try {
          const d = await (await fetch(url)).json();
          const rate = d?.rates?.[cur];
          if (rate && !cancelled) {
            const stamp = d.date || d.time_last_update_utc?.slice(5, 16) || "today";
            setFx({ rate, note: `1 INR = ${rate.toFixed(5)} ${cur} · live (${stamp})` });
            return;
          }
        } catch { /* try next source */ }
      }
      if (!cancelled) setFx({ rate: 0, note: `⚠ Live FX unavailable for ${cur} — enter transport cost manually` });
    })();
    return () => { cancelled = true; };
  }, [order.currency]);

  // Auto-compute the transport cost from the rate sheet (INR) × quantity, converted to the order currency.
  useEffect(() => {
    if (order.incoterms !== "CIF" || !order.transport_country) return;
    const info = TRANSPORT_RATES[order.transport_country];
    const isAir = order.transport_mode === "Airways";
    const rateInr = info ? (isAir ? airRate(info, order.transport_qty || 0) : info.sea) : null;
    if (rateInr == null) {
      setOrder((o) => (o.freight_charge !== 0 ? { ...o, freight_charge: 0 } : o));
      return;
    }
    if (order.currency !== "INR" && !fx.rate) return; // FX not ready → leave for manual entry
    const inr = rateInr * (order.transport_qty || 0);
    const converted = +(inr * (order.currency === "INR" ? 1 : fx.rate)).toFixed(2);
    setOrder((o) => (o.freight_charge !== converted ? { ...o, freight_charge: converted } : o));
  }, [order.incoterms, order.transport_country, order.transport_mode, order.transport_qty, order.currency, fx.rate]);

  // FOB: a fixed transportation cost (INR 17,250) converted live to the order currency.
  useEffect(() => {
    if (order.incoterms !== "FOB") return;
    if (order.currency !== "INR" && !fx.rate) return; // FX not ready → leave for manual entry
    const converted = +(FOB_TRANSPORT_INR * (order.currency === "INR" ? 1 : fx.rate)).toFixed(2);
    setOrder((o) => (o.freight_charge !== converted ? { ...o, freight_charge: converted } : o));
  }, [order.incoterms, order.currency, fx.rate]);

  // Scale the A4 preview (794px wide) down to fit narrow screens.
  const A4_W = 794;
  const A4_H = 1123;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / A4_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobileView]);

  // Only categories that have at least one product priced in the selected currency.
  const categories = useMemo(
    () => [...new Set(
      catalog.filter((c) => hasCurrency(c, order.currency)).map((c) => c.category).filter(Boolean)
    )].sort(),
    [catalog, order.currency]
  );

  // load catalog for the "fill from catalog" pickers
  useEffect(() => {
    api.listCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  // debounced live preview from the backend (same WeasyPrint HTML the PDF uses)
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api
        .previewHtml(order)
        .then(setPreviewHtml)
        .catch((e) => setPreviewHtml(`<pre style="color:#c00;padding:20px">${e.message}</pre>`));
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [order]);

  const totals = useMemo(() => {
    const subtotal = order.items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    const freight = order.freight_charge || 0;
    const insurance = order.insurance_charge || 0;
    const tax = (subtotal * (order.tax_rate || 0)) / 100;
    return { subtotal, freight, insurance, tax, grand: subtotal + freight + insurance + tax };
  }, [order]);

  // Shipping space: pallets (sea) and box count (air), per the ratios in shippingSpace().
  const space = useMemo(() => shippingSpace(order.items, catalog), [order.items, catalog]);
  const palletCount = useMemo(() => Math.ceil(space.pallets), [space.pallets]);

  // Link the transport quantity to the order items:
  //   Airways → number of boxes (input cable excluded — it ships in the charger box)
  //   Sea     → number of pallets (see shippingSpace ratios)
  useEffect(() => {
    if (order.incoterms !== "CIF" || !order.transport_mode) return;
    const isAir = order.transport_mode === "Airways";
    const qty = isAir ? space.boxes : palletCount;
    setOrder((o) => (o.transport_qty !== qty ? { ...o, transport_qty: qty } : o));
  }, [order.incoterms, order.transport_mode, space.boxes, palletCount]);

  function set<K extends keyof OrderInput>(key: K, val: OrderInput[K]) {
    setOrder((o) => ({ ...o, [key]: val }));
  }
  function setItem(i: number, patch: Partial<OrderItem>) {
    setOrder((o) => ({
      ...o,
      items: o.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function addItem() {
    setOrder((o) => ({ ...o, items: [...o.items, { ...EMPTY_ITEM }] }));
  }
  function removeItem(i: number) {
    setOrder((o) => ({ ...o, items: o.items.filter((_, idx) => idx !== i) }));
  }
  function fillFromCatalog(i: number, productId: string) {
    const p = catalog.find((c) => c.id === productId);
    if (!p) return;
    const qty = order.items[i]?.quantity || 1;
    const price = priceFor(p, order.currency, qty);
    setItem(i, {
      product_code: p.product_code,
      code_note: p.code_note,
      product_name: p.product_name,
      description: p.description,
      unit_price: price ?? p.unit_price,
      unit: p.unit,
      catalog_id: p.id,
    });
  }
  // Quantity changes can move a line into a different MoQ price tier.
  function setQuantity(i: number, qty: number) {
    setOrder((o) => ({
      ...o,
      items: o.items.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, quantity: qty };
        if (it.catalog_id) {
          const p = catalog.find((c) => c.id === it.catalog_id);
          const price = p ? priceFor(p, o.currency, qty) : null;
          if (price != null) next.unit_price = price;
        }
        return next;
      }),
    }));
  }
  function setIncoterms(next: string) {
    // EXW has no logistics — clear transport fields. All other incoterms keep them.
    setOrder((o) =>
      next === "EXW"
        ? {
            ...o,
            incoterms: next,
            transport_mode: "",
            transport_country: "",
            transport_qty: 0,
            port_of_loading: "",
            port_of_destination: "",
            freight_charge: 0,
          }
        : { ...o, incoterms: next }
    );
  }
  // Changing the currency re-prices every catalog-linked line from the pricebook.
  function setCurrency(currency: string) {
    setOrder((o) => ({
      ...o,
      currency,
      items: o.items.map((it) => {
        if (!it.catalog_id) return it;
        const p = catalog.find((c) => c.id === it.catalog_id);
        const price = p ? priceFor(p, currency, it.quantity) : null;
        return price != null ? { ...it, unit_price: price } : it;
      }),
    }));
  }

  // Returns an error message listing any missing mandatory fields, or null when valid.
  function validate(): string | null {
    const miss: string[] = [];
    if (!order.quote_number.trim()) miss.push("Quote Number");
    if (!order.prepared_for.trim()) miss.push("Customer (SPOC)");
    if (!order.proposed_by.trim()) miss.push("KAM Name");
    if (!order.bill_to_company.trim()) miss.push("Bill To · Company Name");
    if (!order.bill_to_address.trim()) miss.push("Bill To · Address");
    if (!order.bill_to_country.trim()) miss.push("Bill To · Country");
    if (!order.ship_to_company.trim()) miss.push("Ship To · Company Name");
    if (!order.ship_to_address.trim()) miss.push("Ship To · Address");
    if (!order.ship_to_country.trim()) miss.push("Ship To · Country");
    order.items.forEach((it, i) => {
      if (!it.quantity || it.quantity <= 0) miss.push(`Item ${i + 1} · Quantity`);
      if (!it.unit_price || it.unit_price <= 0) miss.push(`Item ${i + 1} · Unit Price`);
    });
    return miss.length ? "Please complete these required fields:\n\n•  " + miss.join("\n•  ") : null;
  }

  async function downloadPdf() {
    const err = validate();
    if (err) { alert(err); return; }
    setBusy(true);
    try {
      const blob = await api.pdfBlob(order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Exicom_${order.quote_number || "order"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveOrder() {
    const err = validate();
    if (err) { alert(err); return; }
    setBusy(true);
    try {
      const saved = await api.createOrder(order);
      if (confirm(`Order ${order.quote_number} saved (ID: ${saved.id}).\n\nDownload PDF now?`)) {
        await downloadPdf();
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cur = order.currency;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col lg:flex-row">
      {/* ---------------- EDITOR ---------------- */}
      <aside
        className={`scroll-rail w-full flex-shrink-0 border-r border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-4 pb-24 lg:w-[470px] lg:h-[calc(100vh-65px)] lg:overflow-y-auto lg:p-5 lg:pb-5 ${
          mobileView === "edit" ? "block" : "hidden"
        } lg:block`}
      >
        <div className="z-10 -mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white/85 px-4 py-3 backdrop-blur lg:sticky lg:top-0 lg:-mx-5 lg:-mt-5 lg:px-5">
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={downloadPdf} disabled={busy}>
              {busy ? "Working…" : "⤓  Download PDF"}
            </button>
            <button className="btn flex-1" onClick={saveOrder} disabled={busy}>
              Save Order
            </button>
            <button
              className="btn flex-shrink-0 px-3 text-slate-400 hover:text-red-500 hover:bg-red-50"
              title="Start a new blank order"
              onClick={() => { if (confirm("Start a new blank order? Unsaved changes will be lost.")) { setOrder(BLANK_ORDER()); setItemFilters({}); setShipSameAsBill(false); setPaymentCustom(false); } }}
            >
              ✕ New
            </button>
          </div>
        </div>

        {/* Header fields */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">1</span> Quote Information</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quote Number *" v={order.quote_number} on={(v) => set("quote_number", v)} />
            <Field label="Date" v={order.quote_date} on={(v) => set("quote_date", v)} />
            <Field label="Offer Valid Through" v={order.offer_valid_through} on={(v) => set("offer_valid_through", v)} />
            <Field label="Customer (SPOC) *" v={order.prepared_for} on={(v) => set("prepared_for", v)} />
            <Field label="KAM Name *" v={order.proposed_by} on={(v) => set("proposed_by", v)} />
            <div>
              <label className="lbl">Incoterms</label>
              <select className="inp" value={order.incoterms} onChange={(e) => setIncoterms(e.target.value)}>
                {INCOTERMS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Currency</label>
              <select className="inp" value={order.currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Tax Rate (%)</label>
              <input className="inp" type="number" step="0.01" value={order.tax_rate}
                onChange={(e) => set("tax_rate", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">2</span> Bill To <span className="ml-1 text-[10px] font-normal text-slate-400">(Customer details)</span></div>
          <Field label="Company Name *" v={order.bill_to_company} on={(v) => set("bill_to_company", v)} />
          <Field label="Tax ID" v={order.bill_to_gst} on={(v) => set("bill_to_gst", v)} />
          <Area label="Address *" v={order.bill_to_address} on={(v) => set("bill_to_address", v)} />
          <Field label="Country *" v={order.bill_to_country} on={(v) => set("bill_to_country", v)} />
        </div>

        {/* Ship To */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">3</span> Ship To</div>
          <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={shipSameAsBill}
              onChange={(e) => setShipSameAsBill(e.target.checked)}
            />
            Same as Bill To
          </label>
          <Field label="Company Name *" v={order.ship_to_company} on={(v) => set("ship_to_company", v)} disabled={shipSameAsBill} />
          <Field label="Tax ID" v={order.ship_to_gst} on={(v) => set("ship_to_gst", v)} disabled={shipSameAsBill} />
          <Area label="Address *" v={order.ship_to_address} on={(v) => set("ship_to_address", v)} disabled={shipSameAsBill} />
          <Field label="Country *" v={order.ship_to_country} on={(v) => set("ship_to_country", v)} disabled={shipSameAsBill} />
        </div>

        {/* Items */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">4</span> Order Items</div>
          {order.items.map((it, i) => (
            <div key={i} className="item-block">
              <div className="mb-2 flex items-center justify-between">
                <span className="item-chip">Item {i + 1}</span>
                <button className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500" onClick={() => removeItem(i)}>✕</button>
              </div>

              {catalog.length === 0 ? (
                <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                  ⚠ No catalog products loaded. The product database may be unavailable — reload once it&apos;s back, or type the item details manually below.
                </p>
              ) : (
                <div className="mb-2 space-y-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setItemFilters((f) => ({ ...f, [i]: f[i] === cat ? "" : cat }))
                        }
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                          itemFilters[i] === cat
                            ? "border-exicom-teal bg-exicom-teal text-white"
                            : "border-slate-200 bg-white text-slate-500 hover:border-exicom-teal hover:text-exicom-teal"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    {itemFilters[i] && (
                      <button
                        type="button"
                        onClick={() => setItemFilters((f) => ({ ...f, [i]: "" }))}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-400 hover:text-red-500"
                      >
                        ✕ clear
                      </button>
                    )}
                  </div>
                  <input
                    className="inp"
                    placeholder={`🔍  Type product code or name (${order.currency})…`}
                    value={itemSearch[i] || ""}
                    onChange={(e) => setItemSearch((s) => ({ ...s, [i]: e.target.value }))}
                  />
                  {itemSearch[i] && (() => {
                    const q = itemSearch[i].toLowerCase();
                    const matches = catalog
                      .filter((c) =>
                        hasCurrency(c, order.currency) &&
                        passesCategory(c, itemFilters[i]) &&
                        `${c.product_code} ${c.product_name}`.toLowerCase().includes(q)
                      )
                      .sort((a, b) => a.product_code.localeCompare(b.product_code, undefined, { numeric: true }))
                      .slice(0, 30);
                    return (
                      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                        {matches.length === 0 ? (
                          <div className="px-3 py-2 text-[11px] text-amber-600">
                            No products match “{itemSearch[i]}” in {order.currency}. Try another term or switch currency.
                          </div>
                        ) : (
                          matches.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { fillFromCatalog(i, c.id); setItemSearch((s) => ({ ...s, [i]: "" })); }}
                              className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-teal-50"
                            >
                              <span className="font-mono text-[11px] font-semibold text-exicom-tealDark">{c.product_code}</span>
                              <span className="text-xs leading-snug text-slate-700">{c.product_name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })()}
                  <select
                    className="inp bg-teal-50/60"
                    value=""
                    onChange={(e) => { if (e.target.value) fillFromCatalog(i, e.target.value); }}
                  >
                    <option value="">
                      {itemFilters[i]
                        ? `— or pick from ${itemFilters[i]} (${order.currency}) —`
                        : `— or pick from list (${order.currency}) —`}
                    </option>
                    {catalog
                      .filter((c) => hasCurrency(c, order.currency) && passesCategory(c, itemFilters[i]))
                      .slice()
                      .sort((a, b) => a.product_code.localeCompare(b.product_code, undefined, { numeric: true }))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.product_code} — {c.product_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Product Code" v={it.product_code} on={(v) => setItem(i, { product_code: v })} />
                <Area label="Code Sub-text" v={it.code_note} on={(v) => setItem(i, { code_note: v })} rows={2} />
              </div>
              <Field label="Product Name" v={it.product_name} on={(v) => setItem(i, { product_name: v })} />
              <Area label="Description" v={it.description} on={(v) => setItem(i, { description: v })} rows={3} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="lbl">Qty *</label>
                  <input className="inp" type="number" min="1" value={it.quantity}
                    onChange={(e) => setQuantity(i, parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="lbl">Unit Price ({order.currency}) *</label>
                  <input className="inp" type="number" step="0.01" value={it.unit_price}
                    onChange={(e) => setItem(i, { unit_price: parseFloat(e.target.value) || 0, catalog_id: undefined })} />
                </div>
                <Field label="Unit" v={it.unit} on={(v) => setItem(i, { unit: v })} />
              </div>
              {(() => {
                if (!it.catalog_id) return null;
                const p = catalog.find((c) => c.id === it.catalog_id);
                if (!p) return null;
                const avail = Object.keys(p.prices || {});
                const hasCur = avail.includes(order.currency);
                const tiers = p.prices?.[order.currency];
                return (
                  <div className="mt-1 text-[10px] leading-relaxed">
                    {hasCur ? (
                      <span className="text-slate-400">
                        Pricebook {order.currency}
                        {tiers && tiers.length > 1
                          ? ` · auto-tiered by qty (${tiers.map((t) => (t[1] ? `${t[0]}-${t[1]}` : `${t[0]}+`) + `: ${t[2]}`).join(" | ")})`
                          : " · flat rate"}
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600">
                        ⚠ No {order.currency} price in pricebook for this product. Available: {avail.join(", ") || "none"}. Enter price manually or switch currency.
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
          <button className="w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-exicom-teal hover:bg-exicom-teal/5 hover:text-exicom-tealDark"
            onClick={addItem}>+ Add order line</button>

          <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
            <Row k="Subtotal" v={`${cur} ${fmt(totals.subtotal)}`} />
            {totals.freight > 0 && (
              <Row k={`Transportation (${order.transport_mode || order.incoterms})`} v={`${cur} ${fmt(totals.freight)}`} />
            )}
            <Row k={`Tax (${order.tax_rate}%)`} v={`${cur} ${fmt(totals.tax)}`} />
            <div className="mt-1 flex items-center justify-between rounded-md bg-gradient-to-r from-exicom-teal to-exicom-tealDark px-3 py-2 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Total</span>
              <span className="text-sm font-extrabold">{cur} {fmt(totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* Logistics — shown for every incoterm except EXW (after Order Items) */}
        {order.incoterms !== "EXW" && (
          <div className="card mb-4 border-exicom-teal/30 bg-teal-50/30">
            <div className="section-title">
              <span className="section-badge">5</span> Logistics
              <span className="ml-2 rounded-full bg-exicom-teal/10 px-2 py-0.5 text-[10px] font-semibold text-exicom-tealDark">{order.incoterms}</span>
            </div>
            <div className="mb-3">
              <label className="lbl">Transport Mode *</label>
              <div className="flex gap-2">
                {["Airways", "Sea Freight (Waterways)"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("transport_mode", mode)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      order.transport_mode === mode
                        ? "border-exicom-teal bg-exicom-teal text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-exicom-teal hover:text-exicom-teal"
                    }`}
                  >
                    {mode === "Airways" ? "✈  Airways" : "🚢  Sea Freight (Waterways)"}
                  </button>
                ))}
              </div>
            </div>
            {order.incoterms === "CIF" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="lbl">Destination Country</label>
                    <select className="inp" value={order.transport_country}
                      onChange={(e) => set("transport_country", e.target.value)}>
                      <option value="">— select —</option>
                      {TRANSPORT_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">{order.transport_mode === "Airways" ? "No. of Boxes" : "No. of Pallets"}</label>
                    <input className="inp cursor-not-allowed bg-slate-100 text-slate-500" readOnly
                      value={order.transport_qty || ""} placeholder="—" />
                  </div>
                </div>

                {/* live rate × qty × FX breakdown */}
                {(() => {
                  const info = TRANSPORT_RATES[order.transport_country];
                  const isAir = order.transport_mode === "Airways";
                  const rateInr = info ? (isAir ? airRate(info, order.transport_qty || 0) : info.sea) : null;
                  if (!order.transport_mode) {
                    return <p className="mt-2 text-[10px] text-slate-400">Select a transport mode (Air / Sea) above.</p>;
                  }
                  if (!order.transport_country) {
                    return <p className="mt-2 text-[10px] text-slate-400">Pick a destination country to auto-calculate the transport cost from the rate sheet.</p>;
                  }
                  if (rateInr == null) {
                    return <p className="mt-2 text-[10px] font-semibold text-amber-600">⚠ No {isAir ? "air" : "sea"} rate published for {order.transport_country}. Switch transport mode or enter the cost manually below.</p>;
                  }
                  const qtyUnit = isAir ? "box(es)" : "pallet(s)";
                  const rateUnit = isAir ? "box" : "WM³/pallet";
                  const inr = rateInr * (order.transport_qty || 0);
                  const conv = order.currency === "INR" ? inr : inr * fx.rate;
                  return (
                    <div className="mt-2 rounded-md bg-white/70 p-2 text-[10px] leading-relaxed text-slate-500">
                      Rate <b>INR {fmt(rateInr)}</b>/{rateUnit} × {order.transport_qty || 0} {qtyUnit} = <b>INR {fmt(inr)}</b>
                      {order.currency !== "INR" && fx.rate > 0 && <> → <b className="text-exicom-tealDark">{order.currency} {fmt(conv)}</b></>}
                      <br />{fx.note}
                      {isAir && <><br /><span className="text-slate-400">Air weight: {(order.transport_qty || 0) * 10} kg → {(order.transport_qty || 0) * 10 > 500 ? "+500 kg" : "1–500 kg"} rate tier (1 box = 10 kg).</span></>}
                      {!isAir && <><br /><span className="text-slate-400">Space: {space.pallets.toFixed(2)} → {palletCount} pallet(s). (20 AC chargers=1, 10 load-balancing kits=1, 20 spare kits=1; spare kits ride free in AC charger boxes; input cable = no logistics.)</span></>}
                      {!isAir && <><br /><span className="text-amber-600">Sea rate basis provisional — confirm pallet/volume calc with logistics.</span></>}
                    </div>
                  );
                })()}
              </>
            ) : order.incoterms === "FOB" ? (
              <div className="mt-2 rounded-md bg-white/70 p-2 text-[10px] leading-relaxed text-slate-500">
                FOB fixed transportation: <b>INR {FOB_TRANSPORT_INR.toLocaleString("en-IN")}</b>
                {order.currency !== "INR" && fx.rate > 0 && (
                  <> → <b className="text-exicom-tealDark">{order.currency} {fmt(FOB_TRANSPORT_INR * fx.rate)}</b></>
                )}
                <br />{fx.note}
              </div>
            ) : (
              <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-700">
                {order.incoterms}: enter the transportation cost manually below. (Automatic rate lookup applies to CIF only.)
              </p>
            )}

            <div className="mt-2">
              <label className="lbl">Transportation Cost ({order.currency}) · {order.incoterms === "CIF" || order.incoterms === "FOB" ? "auto, editable" : "enter manually"}</label>
              <input className="inp" type="number" step="0.01" min="0" value={order.freight_charge}
                onChange={(e) => set("freight_charge", parseFloat(e.target.value) || 0)} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field
                label={order.transport_mode === "Airways" ? "Airport of Loading" : "Port of Loading"}
                v={order.port_of_loading}
                on={(v) => set("port_of_loading", v)}
              />
              <Field
                label={order.transport_mode === "Airways" ? "Airport of Destination" : "Port of Destination"}
                v={order.port_of_destination}
                on={(v) => set("port_of_destination", v)}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {order.incoterms === "CIF" && "Boxes/pallets are linked to the order quantity. "}Transportation cost is added to the subtotal; tax applies to the product subtotal only.
            </p>
          </div>
        )}

        {/* Terms */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">{order.incoterms !== "EXW" ? "6" : "5"}</span> Terms &amp; Conditions</div>
          <div className="mb-2">
            <label className="lbl">Payment Terms</label>
            <select
              className="inp"
              value={paymentCustom ? "__custom__" : order.payment_terms}
              onChange={(e) => {
                if (e.target.value === "__custom__") setPaymentCustom(true);
                else { setPaymentCustom(false); set("payment_terms", e.target.value); }
              }}
            >
              {PAYMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
          </div>
          {paymentCustom && (
            <Area label="Custom Payment Terms" v={order.payment_terms} on={(v) => set("payment_terms", v)} rows={2} />
          )}
          <Area label="Warranty" v={order.warranty} on={(v) => set("warranty", v)} rows={2} />
          <Field label="Validity" v={order.validity} on={(v) => set("validity", v)} />
          <div className="mb-2">
            <label className="lbl">Production Lead Time (standard)</label>
            <input className="inp cursor-not-allowed bg-slate-100 text-slate-500" readOnly value={order.lead_time} />
          </div>
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            <b className="text-slate-600">Standard Terms</b> are automatically included on the order form:
            Documents · Scope of Supply · Freight and Insurance · Terms of Payment.
          </div>
        </div>

        {/* PO */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">{order.incoterms !== "EXW" ? "7" : "6"}</span> Purchase Order</div>
          <label className="lbl">Is a Purchase Order required?</label>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => set("po_required", true)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                order.po_required
                  ? "border-exicom-teal bg-exicom-teal text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-exicom-teal hover:text-exicom-teal"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setOrder((o) => ({ ...o, po_required: false, po_number: "", po_amount: "" }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                !order.po_required
                  ? "border-exicom-teal bg-exicom-teal text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-exicom-teal hover:text-exicom-teal"
              }`}
            >
              No
            </button>
          </div>
          {order.po_required ? (
            <div className="h-16" aria-hidden="true" />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
              ✍ No PO — the customer&apos;s <b>signature is mandatory</b>. A signature line is included on the order form for sign-off.
            </p>
          )}
        </div>
      </aside>

      {/* ---------------- PREVIEW ---------------- */}
      <section
        className={`scroll-rail w-full overflow-auto p-4 pb-24 lg:flex-1 lg:h-[calc(100vh-65px)] lg:p-8 lg:pb-8 ${
          mobileView === "preview" ? "block" : "hidden"
        } lg:block`}
      >
        <div ref={wrapRef} className="mx-auto" style={{ maxWidth: A4_W }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 lg:text-xs">
              <span className="flex h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-emerald-500"></span>
              <span className="hidden sm:inline">Live preview · same WeasyPrint template as the PDF</span>
              <span className="sm:hidden">Live preview</span>
            </div>
          </div>
          <div
            className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-900/5 shadow-[0_10px_40px_-12px_rgba(10,20,30,0.25)]"
            style={{ height: A4_H * scale }}
          >
            <iframe
              title="preview"
              className="bg-white"
              style={{
                width: A4_W,
                height: A4_H,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              srcDoc={previewHtml}
            />
          </div>
        </div>
      </section>

      {/* ---------- MOBILE EDIT / PREVIEW TOGGLE (hidden on desktop) ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileView("edit")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            mobileView === "edit"
              ? "bg-exicom-teal text-white shadow-sm"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          ✎ Edit
        </button>
        <button
          onClick={() => setMobileView("preview")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
            mobileView === "preview"
              ? "bg-exicom-teal text-white shadow-sm"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          👁 Preview
        </button>
      </div>
    </div>
  );
}

/* ---- small field helpers ---- */
function Field({ label, v, on, disabled }: { label: string; v: string; on: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <input
        className={`inp ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""}`}
        value={v}
        disabled={disabled}
        onChange={(e) => on(e.target.value)}
      />
    </div>
  );
}
function Area({ label, v, on, rows = 3, disabled }: { label: string; v: string; on: (v: string) => void; rows?: number; disabled?: boolean }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <textarea
        className={`inp ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : ""}`}
        rows={rows}
        value={v}
        disabled={disabled}
        onChange={(e) => on(e.target.value)}
      />
    </div>
  );
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-slate-900" : "text-slate-500"}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
