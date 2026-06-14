"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CatalogProduct, OrderInput, OrderItem } from "@/lib/types";

/** Currencies the pricebook carries. */
const CURRENCIES = ["USD", "EUR", "INR", "MYR"];

/** Incoterms offered in the dropdown. */
const INCOTERMS = ["EXW", "FOB", "CIF", "DDP", "DAP"];

/** Resolve the catalog price for a given currency + quantity (MoQ tier). */
function priceFor(p: CatalogProduct, currency: string, qty: number): number | null {
  const tiers = p.prices?.[currency];
  if (!tiers || tiers.length === 0) return null;
  for (const [min, max, price] of tiers) {
    if (qty >= min && (max == null || qty <= max)) return price;
  }
  return tiers[0][2]; // qty below the lowest bracket → use the first tier
}

const EMPTY_ITEM: OrderItem = {
  product_code: "",
  code_note: "",
  product_name: "",
  description: "",
  unit_price: 0,
  quantity: 1,
  unit: "Nos.",
};

function todayPlus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-GB").replace(/\//g, "/");
}

function nextQuoteNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `Q-${yy}${mm}${dd}-${rand}`;
}

const BLANK_ORDER = (): OrderInput => ({
  quote_number: nextQuoteNumber(),
  prepared_for: "",
  proposed_by: "",
  offer_valid_through: todayPlus30(),
  incoterms: "EXW",
  currency: "USD",
  tax_rate: 0,
  bill_to_company: "",
  bill_to_address: "",
  bill_to_country: "",
  ship_to_company: "EXICOM LOGISTICS WAREHOUSE",
  ship_to_gst: "36AAACH2448G1ZS",
  ship_to_address: "Plot No. S-105 to S-112, Mansanpally Cross Road\nMaheshwaram Rangareddy, Telangana - 501359",
  ship_to_country: "India",
  payment_terms: "Advance payment.",
  warranty: "36 months from date of commissioning (or 39 months from date of dispatch, whichever is earlier).",
  validity: "This offer is valid for 30 days from the date of issue.",
  lead_time: "Lead times are from order acceptance. EXW Gurugram, India.",
  transport_mode: "",
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
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const debounce = useRef<ReturnType<typeof setTimeout>>();

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

  const categories = useMemo(
    () => [...new Set(catalog.map((c) => c.category).filter(Boolean))].sort(),
    [catalog]
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
  // Changing incoterms keeps any incoterm reference in the lead-time line in sync.
  function setIncoterms(next: string) {
    setOrder((o) => {
      const re = new RegExp(`\\b(${INCOTERMS.join("|")})\\b`, "g");
      const lead_time = o.lead_time.replace(re, next); // no-op when no token present
      return { ...o, incoterms: next, lead_time };
    });
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

  async function downloadPdf() {
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
    if (!order.bill_to_company) { alert("Please fill in the customer (Bill To) company name before saving."); return; }
    if (!order.prepared_for) { alert("Please fill in who this quote is Prepared For."); return; }
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
              onClick={() => { if (confirm("Start a new blank order? Unsaved changes will be lost.")) { setOrder(BLANK_ORDER()); setItemFilters({}); } }}
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
            <Field label="Offer Valid Through" v={order.offer_valid_through} on={(v) => set("offer_valid_through", v)} />
            <Field label="Prepared For (Customer) *" v={order.prepared_for} on={(v) => set("prepared_for", v)} />
            <Field label="Proposed By (Sales Rep) *" v={order.proposed_by} on={(v) => set("proposed_by", v)} />
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
          <Area label="Address *" v={order.bill_to_address} on={(v) => set("bill_to_address", v)} />
          <Field label="Country *" v={order.bill_to_country} on={(v) => set("bill_to_country", v)} />
        </div>

        {/* Ship To */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">3</span> Ship To (ExWorks)</div>
          <Field label="Company Name" v={order.ship_to_company} on={(v) => set("ship_to_company", v)} />
          <Field label="GST / Tax ID" v={order.ship_to_gst} on={(v) => set("ship_to_gst", v)} />
          <Area label="Address" v={order.ship_to_address} on={(v) => set("ship_to_address", v)} />
          <Field label="Country" v={order.ship_to_country} on={(v) => set("ship_to_country", v)} />
        </div>

        {/* Logistics — only shown when CIF is selected */}
        {order.incoterms === "CIF" && (
          <div className="card mb-4 border-exicom-teal/30 bg-teal-50/30">
            <div className="section-title">
              <span className="section-badge">4</span> Logistics
              <span className="ml-2 rounded-full bg-exicom-teal/10 px-2 py-0.5 text-[10px] font-semibold text-exicom-tealDark">CIF</span>
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
            <div className="grid grid-cols-2 gap-2">
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="lbl">Freight Charge</label>
                <input className="inp" type="number" step="0.01" min="0" value={order.freight_charge}
                  onChange={(e) => set("freight_charge", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="lbl">Insurance Charge</label>
                <input className="inp" type="number" step="0.01" min="0" value={order.insurance_charge}
                  onChange={(e) => set("insurance_charge", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Freight &amp; insurance are added to the subtotal. Tax applies to the product subtotal only.
            </p>
          </div>
        )}

        {/* Items */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">{order.incoterms === "CIF" ? "5" : "4"}</span> Order Items</div>
          {order.items.map((it, i) => (
            <div key={i} className="item-block">
              <div className="mb-2 flex items-center justify-between">
                <span className="item-chip">Item {i + 1}</span>
                <button className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500" onClick={() => removeItem(i)}>✕</button>
              </div>

              {catalog.length > 0 && (
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
                  <select
                    className="inp bg-teal-50/60"
                    defaultValue=""
                    onChange={(e) => { fillFromCatalog(i, e.target.value); e.target.value = ""; }}
                  >
                    <option value="">
                      {itemFilters[i]
                        ? `— select ${itemFilters[i]} —`
                        : "— select product from catalog —"}
                    </option>
                    {catalog
                      .filter((c) => !itemFilters[i] || c.category === itemFilters[i])
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
                  <label className="lbl">Qty</label>
                  <input className="inp" type="number" min="1" value={it.quantity}
                    onChange={(e) => setQuantity(i, parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="lbl">Unit Price ({order.currency})</label>
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
              <Row k={`Freight (${order.transport_mode || "CIF"})`} v={`${cur} ${fmt(totals.freight)}`} />
            )}
            {totals.insurance > 0 && (
              <Row k="Insurance" v={`${cur} ${fmt(totals.insurance)}`} />
            )}
            <Row k={`Tax (${order.tax_rate}%)`} v={`${cur} ${fmt(totals.tax)}`} />
            <div className="mt-1 flex items-center justify-between rounded-md bg-gradient-to-r from-exicom-teal to-exicom-tealDark px-3 py-2 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Total</span>
              <span className="text-sm font-extrabold">{cur} {fmt(totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">{order.incoterms === "CIF" ? "6" : "5"}</span> Terms &amp; Conditions</div>
          <Field label="Payment Terms" v={order.payment_terms} on={(v) => set("payment_terms", v)} />
          <Area label="Warranty" v={order.warranty} on={(v) => set("warranty", v)} rows={2} />
          <Field label="Validity" v={order.validity} on={(v) => set("validity", v)} />
          <Field label="Production Lead Times" v={order.lead_time} on={(v) => set("lead_time", v)} />
        </div>

        {/* PO */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">{order.incoterms === "CIF" ? "7" : "6"}</span> Purchase Order</div>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={order.po_required} onChange={(e) => set("po_required", e.target.checked)} />
            PO required
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="PO Number" v={order.po_number} on={(v) => set("po_number", v)} />
            <Field label="PO Amount" v={order.po_amount} on={(v) => set("po_amount", v)} />
          </div>
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
            <span className="flex-shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
              A4 · {order.currency} {fmt(totals.grand)}
            </span>
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
function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <input className="inp" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
function Area({ label, v, on, rows = 3 }: { label: string; v: string; on: (v: string) => void; rows?: number }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <textarea className="inp" rows={rows} value={v} onChange={(e) => on(e.target.value)} />
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
