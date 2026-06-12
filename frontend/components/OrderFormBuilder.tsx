"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CatalogProduct, OrderInput, OrderItem } from "@/lib/types";

const EMPTY_ITEM: OrderItem = {
  product_code: "",
  code_note: "",
  product_name: "",
  description: "",
  unit_price: 0,
  quantity: 1,
  unit: "Nos.",
};

const DEFAULT_ORDER: OrderInput = {
  quote_number: "Q-00000007",
  prepared_for: "Antoine Sleiman",
  proposed_by: "Zouheir Fathallah",
  offer_valid_through: "12/07/2026",
  incoterms: "EXW",
  currency: "USD",
  tax_rate: 0,
  bill_to_company: "Al Attiya Motors & Trading Co.",
  bill_to_address: "Building 175, Zone 38, Street 150, Al Rayyan Road,\nDoha",
  bill_to_country: "Qatar",
  ship_to_company: "EXICOM LOGISTICS WAREHOUSE",
  ship_to_gst: "36AAACH2448G1ZS",
  ship_to_address: "Plot No. S-105 to S-112, Mansanpally Cross Road\nMaheshwaram Rangareddy, Telangana - 501359",
  ship_to_country: "India",
  payment_terms: "Advance payment.",
  warranty:
    "36 months from date of commissioning (or 39 months from date of dispatch, whichever is earlier).",
  validity: "This offer is valid for 30 days from the date of issue.",
  lead_time: "Lead times are from order acceptance. EXW Gurugram, India.",
  po_required: false,
  po_number: "",
  po_amount: "",
  items: [
    {
      product_code: "HE518585",
      code_note: "Spin Air AC Charger\n22 kW / Type 2 / Light Cyan",
      product_name: "Spin Air 22kW AC Charger",
      description: "Power: 22 kW (3-Phase)\nConnector: Type 2 / 5m Cable\nWifi only",
      unit_price: 342,
      quantity: 5,
      unit: "Nos.",
    },
    {
      product_code: "HE518581",
      code_note: "Spin Air AC Charger\n7.5 kW / Type 2 / Light Cyan",
      product_name: "Spin Air 7kW AC Charger",
      description: "Power: 7.5 kW (1-Phase)\nConnector: Type 2 / 5m Cable\nWifi only",
      unit_price: 258,
      quantity: 5,
      unit: "Nos.",
    },
  ],
};

export default function OrderFormBuilder() {
  const [order, setOrder] = useState<OrderInput>(DEFAULT_ORDER);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

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
    const tax = (subtotal * (order.tax_rate || 0)) / 100;
    return { subtotal, tax, grand: subtotal + tax };
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
    setItem(i, {
      product_code: p.product_code,
      code_note: p.code_note,
      product_name: p.product_name,
      description: p.description,
      unit_price: p.unit_price,
      unit: p.unit,
    });
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
    setBusy(true);
    try {
      const saved = await api.createOrder(order);
      alert(`Order saved. ID: ${saved.id}`);
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
    <div className="flex">
      {/* ---------------- EDITOR ---------------- */}
      <aside className="scroll-rail h-[calc(100vh-65px)] w-[470px] flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-5">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex gap-2 border-b border-slate-100 bg-white/85 px-5 py-3 backdrop-blur">
          <button className="btn btn-primary flex-1" onClick={downloadPdf} disabled={busy}>
            {busy ? "Working…" : "⤓  Download PDF"}
          </button>
          <button className="btn flex-1" onClick={saveOrder} disabled={busy}>
            Save Order
          </button>
        </div>

        {/* Header fields */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">1</span> Quote Information</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quote Number" v={order.quote_number} on={(v) => set("quote_number", v)} />
            <Field label="Offer Valid Through" v={order.offer_valid_through} on={(v) => set("offer_valid_through", v)} />
            <Field label="Prepared For" v={order.prepared_for} on={(v) => set("prepared_for", v)} />
            <Field label="Proposed By" v={order.proposed_by} on={(v) => set("proposed_by", v)} />
            <div>
              <label className="lbl">Incoterms</label>
              <select className="inp" value={order.incoterms} onChange={(e) => set("incoterms", e.target.value)}>
                {["EXW", "FOB", "CIF", "DDP", "DAP"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Currency</label>
              <select className="inp" value={order.currency} onChange={(e) => set("currency", e.target.value)}>
                {["USD", "EUR", "GBP", "INR", "AED", "QAR"].map((x) => <option key={x}>{x}</option>)}
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
          <div className="section-title"><span className="section-badge">2</span> Bill To</div>
          <Field label="Company Name" v={order.bill_to_company} on={(v) => set("bill_to_company", v)} />
          <Area label="Address" v={order.bill_to_address} on={(v) => set("bill_to_address", v)} />
          <Field label="Country" v={order.bill_to_country} on={(v) => set("bill_to_country", v)} />
        </div>

        {/* Ship To */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">3</span> Ship To (ExWorks)</div>
          <Field label="Company Name" v={order.ship_to_company} on={(v) => set("ship_to_company", v)} />
          <Field label="GST / Tax ID" v={order.ship_to_gst} on={(v) => set("ship_to_gst", v)} />
          <Area label="Address" v={order.ship_to_address} on={(v) => set("ship_to_address", v)} />
          <Field label="Country" v={order.ship_to_country} on={(v) => set("ship_to_country", v)} />
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

              {catalog.length > 0 && (
                <div className="mb-2">
                  <label className="lbl">Fill from Catalog</label>
                  <select className="inp bg-teal-50" defaultValue=""
                    onChange={(e) => { fillFromCatalog(i, e.target.value); e.target.value = ""; }}>
                    <option value="">— select product —</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>{c.product_code} — {c.product_name}</option>
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
                  <input className="inp" type="number" value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="lbl">Unit Price</label>
                  <input className="inp" type="number" step="0.01" value={it.unit_price}
                    onChange={(e) => setItem(i, { unit_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <Field label="Unit" v={it.unit} on={(v) => setItem(i, { unit: v })} />
              </div>
            </div>
          ))}
          <button className="w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-exicom-teal hover:bg-exicom-teal/5 hover:text-exicom-tealDark"
            onClick={addItem}>+ Add order line</button>

          <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
            <Row k="Subtotal" v={`${cur} ${fmt(totals.subtotal)}`} />
            <Row k={`Tax (${order.tax_rate}%)`} v={`${cur} ${fmt(totals.tax)}`} />
            <div className="mt-1 flex items-center justify-between rounded-md bg-gradient-to-r from-exicom-teal to-exicom-tealDark px-3 py-2 text-white">
              <span className="text-xs font-bold uppercase tracking-wide">Total</span>
              <span className="text-sm font-extrabold">{cur} {fmt(totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">5</span> Terms &amp; Conditions</div>
          <Field label="Payment Terms" v={order.payment_terms} on={(v) => set("payment_terms", v)} />
          <Area label="Warranty" v={order.warranty} on={(v) => set("warranty", v)} rows={2} />
          <Field label="Validity" v={order.validity} on={(v) => set("validity", v)} />
          <Field label="Production Lead Times" v={order.lead_time} on={(v) => set("lead_time", v)} />
        </div>

        {/* PO */}
        <div className="card mb-4">
          <div className="section-title"><span className="section-badge">6</span> Purchase Order</div>
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
      <section className="scroll-rail h-[calc(100vh-65px)] flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-[210mm]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
              Live preview · same WeasyPrint template as the PDF
            </div>
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
              A4 · {order.currency} {fmt(totals.grand)}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-900/5 shadow-[0_10px_40px_-12px_rgba(10,20,30,0.25)]">
            <iframe
              title="preview"
              className="w-full bg-white"
              style={{ height: "297mm" }}
              srcDoc={previewHtml}
            />
          </div>
        </div>
      </section>
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
