"use client";

import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { PAYMENT_PRESETS, isCustomPaymentTerm } from "@/lib/payment";
import type { OrderOut, OrderPublish } from "@/lib/types";

const TRANSPORT_MODES = ["Airways", "Sea Freight"];

// A draft's approval_reason is a comma list of "logistics" / "pricebook" / "payment".
// This tab only ever handles the logistics side; pricing sign-off happens in
// the Pricing Approval tab instead.
function isLogisticsDraft(reason?: string): boolean {
  return (reason || "").split(",").map((r) => r.trim()).includes("logistics");
}

type SubTab = "pending" | "approved";

export default function PendingLogistic() {
  const [subTab, setSubTab] = useState<SubTab>("pending");
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<OrderOut | null>(null);
  const [draftEdits, setDraftEdits] = useState<OrderPublish>({});
  const [paymentCustom, setPaymentCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setOrders(await api.listOrders());
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  const logisticOrders = orders.filter((o) => isLogisticsDraft(o.approval_reason));
  const pending = logisticOrders.filter((o) => o.status === "draft");
  const approved = logisticOrders.filter((o) => o.status !== "draft");
  const visible = subTab === "pending" ? pending : approved;

  function openReview(o: OrderOut) {
    const paymentText = o.payment_term_text || o.payment_terms || "";
    setPaymentCustom(isCustomPaymentTerm(o.payment_term_type, paymentText));
    setReviewing(o);
    setDraftEdits({
      incoterms: o.incoterms,
      transport_mode: o.transport_mode || "Sea Freight",
      transport_country: o.transport_country || o.ship_to_country || o.bill_to_country || "",
      port_of_loading: o.port_of_loading || "",
      port_of_destination: o.port_of_destination || "",
      freight_charge: o.freight_charge || 0,
      payment_terms: paymentText,
      unit_rate: undefined,
    });
  }

  function setE<K extends keyof OrderPublish>(k: K, v: OrderPublish[K]) {
    setDraftEdits((e) => ({ ...e, [k]: v }));
  }

  const isAir = (draftEdits.transport_mode || "").toLowerCase().startsWith("air");
  const rateUnit = isAir ? "box" : "pallet";

  // Auto-compute the Transportation Cost whenever a per-unit rate is entered,
  // mirroring the Order Form's own rate × qty math.
  useEffect(() => {
    if (draftEdits.unit_rate == null || !reviewing) return;
    const qty = reviewing.transport_qty || 0;
    setDraftEdits((e) => ({ ...e, freight_charge: Math.round((e.unit_rate || 0) * qty) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEdits.unit_rate]);

  async function publish() {
    if (!reviewing) return;
    if (!draftEdits.freight_charge || draftEdits.freight_charge <= 0) {
      if (!confirm("Transportation cost is still 0. Approve anyway?")) return;
    }
    setBusy(true);
    try {
      const payload: OrderPublish = {
        ...draftEdits,
        payment_term_type: paymentCustom ? "custom" : "predefined",
        payment_term_text: draftEdits.payment_terms || "",
      };
      await api.publishOrder(reviewing.id, payload);
      setReviewing(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number, cur: string) => `${cur} ${Math.round(n || 0).toLocaleString("en-US")}`;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">Pending Logistic</h1>
        <p className="hidden text-sm text-slate-500 sm:block">
          Quotes waiting on a logistics rate. Approving one saves the rate as that country&apos;s
          standing rate in the Logistics tab too, so future quotes auto-fill.
        </p>
      </div>

      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-slate-100/70 p-1">
        <button
          onClick={() => setSubTab("pending")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            subTab === "pending" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pending{pending.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{pending.length}</span>}
        </button>
        <button
          onClick={() => setSubTab("approved")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            subTab === "approved" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Approved
        </button>
      </div>

      {reviewing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">
            Logistic Request — <span className="text-slate-500">{reviewing.quote_number}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Customer</div>
              <div className="font-semibold text-slate-800">{reviewing.prepared_for || reviewing.bill_to_company || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Country</div>
              <div className="text-slate-700">{reviewing.bill_to_country || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Total</div>
              <div className="font-semibold text-slate-800">{money(reviewing.grand_total, reviewing.currency)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">KAM</div>
              <div className="text-slate-700">{reviewing.proposed_by || "—"}</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase text-slate-400">Products (Part Code × Qty)</div>
            <ul className="mt-0.5 text-sm text-slate-700">
              {reviewing.items.map((it, i) => (
                <li key={i}>
                  {it.product_code || "—"} <span className="text-slate-400">— {it.product_name}</span> × {it.quantity}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase text-slate-400">Packing Details</div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{reviewing.packing_details || "—"}</p>
          </div>

          <a
            className="mt-3 inline-block text-xs font-semibold text-exicom-tealDark hover:underline"
            href={`${API_BASE}/api/orders/${reviewing.id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Quotation ↗
          </a>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="lbl">Transport Mode</label>
              <select className="inp" value={draftEdits.transport_mode || ""} onChange={(e) => setE("transport_mode", e.target.value)}>
                {TRANSPORT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Country</label>
              <input className="inp" value={draftEdits.transport_country || ""} onChange={(e) => setE("transport_country", e.target.value)} />
            </div>
            <div>
              <label className="lbl">Quantity ({isAir ? "boxes" : "pallets"})</label>
              <input className="inp cursor-not-allowed bg-slate-100 text-slate-500" readOnly value={reviewing.transport_qty || 0} />
            </div>
            <div>
              <label className="lbl">Rate to Provide (INR / {rateUnit})</label>
              <input
                className="inp"
                type="number"
                step="1"
                value={draftEdits.unit_rate ?? ""}
                onChange={(e) => setE("unit_rate", e.target.value === "" ? undefined : Math.round(parseFloat(e.target.value)))}
                placeholder="e.g. 1500"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                Saved as {draftEdits.transport_country || "this country"}&apos;s standing {isAir ? "air" : "sea"} rate.
              </p>
            </div>
            <div>
              <label className="lbl">Transportation Cost ({reviewing.currency})</label>
              <input
                className="inp"
                type="number"
                step="1"
                value={draftEdits.freight_charge ?? 0}
                onChange={(e) => setE("freight_charge", e.target.value === "" ? 0 : Math.round(parseFloat(e.target.value)))}
              />
            </div>
            <div>
              <label className="lbl">Port of Loading</label>
              <input className="inp" value={draftEdits.port_of_loading || ""} onChange={(e) => setE("port_of_loading", e.target.value)} />
            </div>
            <div>
              <label className="lbl">Port of Destination</label>
              <input className="inp" value={draftEdits.port_of_destination || ""} onChange={(e) => setE("port_of_destination", e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <label className="lbl">Payment Terms</label>
            <select
              className="inp"
              value={paymentCustom ? "__custom__" : (draftEdits.payment_terms || "")}
              onChange={(e) => {
                if (e.target.value === "__custom__") setPaymentCustom(true);
                else { setPaymentCustom(false); setE("payment_terms", e.target.value); }
              }}
            >
              {PAYMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            {paymentCustom && (
              <textarea
                className="inp mt-2"
                rows={3}
                value={draftEdits.payment_terms || ""}
                onChange={(e) => setE("payment_terms", e.target.value)}
                placeholder="Enter custom payment terms…"
              />
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={publish} disabled={busy}>
              {busy ? "Approving…" : "✓ Approve"}
            </button>
            <button className="btn" onClick={() => setReviewing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          {subTab === "pending" ? "No pending logistic requests." : "No approved logistic requests yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2">Quote #</th>
                <th className="px-4 py-2">Part Code</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2">Packing Details</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2 text-right">Rate Provided</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold text-slate-800">{o.quote_number}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {o.items.map((it) => it.product_code).filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {o.items.reduce((s, it) => s + (it.quantity || 0), 0)}
                  </td>
                  <td className="max-w-[200px] px-4 py-2 text-slate-600">{o.packing_details || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{o.transport_country || o.bill_to_country || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{o.transport_mode || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-slate-600">
                    {o.freight_charge ? money(o.freight_charge, o.currency) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {subTab === "pending" && (
                      <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => openReview(o)}>
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
