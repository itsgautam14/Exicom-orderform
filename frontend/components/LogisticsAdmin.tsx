"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PAYMENT_PRESETS, isCustomPaymentTerm } from "@/lib/payment";
import type { LogisticsRate, OrderOut, OrderPublish } from "@/lib/types";

const BLANK: Partial<LogisticsRate> = {
  country: "",
  sea_rate: null,
  air_up_to_500: null,
  air_above_500: null,
};

const TRANSPORT_MODES = ["Airways", "Sea Freight"];

// A draft's approval_reason is a comma list of "logistics" / "pricebook" / "payment".
// Logistic Approval only ever handles the logistics side; pricing sign-off happens
// in the Pricing Approval tab instead.
function isLogisticsDraft(reason?: string): boolean {
  return (reason || "").split(",").map((r) => r.trim()).includes("logistics");
}

type SubTab = "rates" | "pricing";

export default function LogisticsAdmin() {
  const [subTab, setSubTab] = useState<SubTab>("rates");

  const [items, setItems] = useState<LogisticsRate[]>([]);
  const [editing, setEditing] = useState<Partial<LogisticsRate> | null>(null);
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [publishing, setPublishing] = useState<OrderOut | null>(null);
  const [draftEdits, setDraftEdits] = useState<OrderPublish>({});
  const [publishPaymentCustom, setPublishPaymentCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setItems(await api.listLogistics());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function reloadOrders() {
    setOrdersLoading(true);
    try {
      setOrders(await api.listOrders());
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }
  useEffect(() => { reloadOrders(); }, []);

  const logisticsDrafts = orders.filter((o) => o.status === "draft" && isLogisticsDraft(o.approval_reason));

  async function save() {
    if (!editing) return;
    if (!editing.country?.trim()) { alert("Country is required"); return; }
    try {
      if (editing.id) await api.updateLogistics(editing.id, editing);
      else await api.createLogistics(editing);
      setEditing(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function del(id: string) {
    if (!confirm("Delete this country's logistics rates?")) return;
    try { await api.deleteLogistics(id); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  function openPublish(o: OrderOut) {
    const paymentText = o.payment_term_text || o.payment_terms || "";
    setPublishPaymentCustom(isCustomPaymentTerm(o.payment_term_type, paymentText));
    setPublishing(o);
    setDraftEdits({
      incoterms: o.incoterms,
      transport_mode: o.transport_mode || "Sea Freight",
      transport_country: o.transport_country || o.ship_to_country || o.bill_to_country || "",
      port_of_loading: o.port_of_loading || "",
      port_of_destination: o.port_of_destination || "",
      freight_charge: o.freight_charge || 0,
      payment_terms: paymentText,
    });
  }

  function setE<K extends keyof OrderPublish>(k: K, v: OrderPublish[K]) {
    setDraftEdits((e) => ({ ...e, [k]: v }));
  }

  async function publish() {
    if (!publishing) return;
    if (!draftEdits.freight_charge || draftEdits.freight_charge <= 0) {
      if (!confirm("Transportation cost is still 0. Publish anyway?")) return;
    }
    setBusy(true);
    try {
      const payload: OrderPublish = {
        ...draftEdits,
        payment_term_type: publishPaymentCustom ? "custom" : "predefined",
        payment_term_text: draftEdits.payment_terms || "",
      };
      await api.publishOrder(publishing.id, payload);
      setPublishing(null);
      reloadOrders();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number, cur: string) =>
    `${cur} ${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function setF<K extends keyof LogisticsRate>(k: K, v: LogisticsRate[K]) {
    setEditing((e) => ({ ...(e || {}), [k]: v }));
  }
  // number field helper: empty string → null
  function numField(k: keyof LogisticsRate, label: string) {
    const val = editing?.[k];
    return (
      <div>
        <label className="lbl">{label}</label>
        <input
          className="inp"
          type="number"
          step="0.01"
          value={val === null || val === undefined ? "" : (val as number)}
          onChange={(e) => setF(k, (e.target.value === "" ? null : parseFloat(e.target.value)) as LogisticsRate[typeof k])}
          placeholder="—"
        />
      </div>
    );
  }

  const fmt = (n: number | null) =>
    n === null || n === undefined ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pending = items.filter((r) => r.status !== "approved").length;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/70 p-1">
        <button
          onClick={() => setSubTab("rates")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            subTab === "rates" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Logistics Rates
        </button>
        <button
          onClick={() => setSubTab("pricing")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            subTab === "pricing" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Logistic Approval
          {logisticsDrafts.length > 0 && (
            <span className="ml-1.5 text-xs text-slate-400">{logisticsDrafts.length}</span>
          )}
        </button>
      </div>

      {subTab === "rates" ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800">
                Logistics Rates
                {pending > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
                    {pending} awaiting prices
                  </span>
                )}
              </h1>
              <p className="hidden text-sm text-slate-500 sm:block">
                Per-country transport rates (INR). Rates you fill in here go <b>live immediately</b>. Countries
                flagged by a draft quote appear as <b>Awaiting prices</b> until you fill them.
              </p>
            </div>
            <button className="btn btn-primary flex-shrink-0" onClick={() => setEditing({ ...BLANK })}>
              + New Country
            </button>
          </div>

          {editing && (
            <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
              <div className="section-title">{editing.id ? "Edit Rates" : "New Country"}</div>
              <div className="mb-2">
                <label className="lbl">Country</label>
                <input className="inp" value={editing.country || ""} onChange={(e) => setF("country", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {numField("sea_rate", "Sea (INR / pallet)")}
                {numField("air_up_to_500", "Air ≤500 kg (INR / box)")}
                {numField("air_above_500", "Air >500 kg (INR / box)")}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Leave a field blank if that mode isn&apos;t offered for this country.</p>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-primary" onClick={save}>Save &amp; Activate</button>
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">
              No logistics rates yet. Add a country, or run the backend seed.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Country</th>
                    <th className="px-4 py-2 text-right">Sea / pallet</th>
                    <th className="px-4 py-2 text-right">Air ≤500 kg</th>
                    <th className="px-4 py-2 text-right">Air &gt;500 kg</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-2 font-semibold text-slate-800">{r.country}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{fmt(r.sea_rate)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{fmt(r.air_up_to_500)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{fmt(r.air_above_500)}</td>
                      <td className="px-4 py-2">
                        {r.status === "approved" ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Awaiting prices</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {r.status !== "approved" && (
                          <button className="mr-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => setEditing(r)}>Fill prices</button>
                        )}
                        <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => setEditing(r)}>Edit</button>
                        <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4">
            <h1 className="text-lg font-bold text-slate-800">
              Logistic Approval
              {logisticsDrafts.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
                  {logisticsDrafts.length} awaiting
                </span>
              )}
            </h1>
            <p className="hidden text-sm text-slate-500 sm:block">
              Drafts needing sign-off for a missing CIF transport cost. Fill in the transport details to publish.
            </p>
          </div>

          {publishing && (
            <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
              <div className="section-title">
                Complete &amp; Publish — <span className="text-slate-500">{publishing.quote_number}</span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Fill in the transport cost for <b>{publishing.bill_to_country || "the destination"}</b>{" "}
                (in {publishing.currency}), then publish. This marks the order <b>Approved</b>.
                <br />
                <span className="text-slate-400">
                  Tip: this country was added to the <b>Logistics Rates</b> tab as <i>pending</i> — set its
                  standing rates there so future quotes auto-fill.
                </span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="lbl">Transport Mode</label>
                  <select className="inp" value={draftEdits.transport_mode || ""} onChange={(e) => setE("transport_mode", e.target.value)}>
                    {TRANSPORT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Destination Country</label>
                  <input className="inp" value={draftEdits.transport_country || ""} onChange={(e) => setE("transport_country", e.target.value)} />
                </div>
                <div>
                  <label className="lbl">Transportation Cost ({publishing.currency})</label>
                  <input
                    className="inp"
                    type="number"
                    step="0.01"
                    value={draftEdits.freight_charge ?? 0}
                    onChange={(e) => setE("freight_charge", e.target.value === "" ? 0 : parseFloat(e.target.value))}
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
                  value={publishPaymentCustom ? "__custom__" : (draftEdits.payment_terms || "")}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") setPublishPaymentCustom(true);
                    else { setPublishPaymentCustom(false); setE("payment_terms", e.target.value); }
                  }}
                >
                  {PAYMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                {publishPaymentCustom && (
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
                  {busy ? "Publishing…" : "✓ Publish (Approve)"}
                </button>
                <button className="btn" onClick={() => setPublishing(null)}>Cancel</button>
              </div>
            </div>
          )}

          {ordersLoading ? (
            <p className="text-slate-500">Loading…</p>
          ) : logisticsDrafts.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No drafts waiting on logistic approval.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Quote #</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Country</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {logisticsDrafts.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold text-slate-800">{o.quote_number}</td>
                      <td className="px-4 py-2 text-slate-700">{o.prepared_for || o.bill_to_company || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{o.bill_to_country || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">{money(o.grand_total, o.currency)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => openPublish(o)}>
                          Complete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
