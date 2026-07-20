"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getCreatorId } from "@/lib/creator";
import { PAYMENT_PRESETS, isCustomPaymentTerm } from "@/lib/payment";
import OrderTracking from "@/components/OrderTracking";
import type { OrderOut, OrderPublish } from "@/lib/types";

type StatusFilter = "all" | "draft" | "submitted" | "approved" | "so_created";

const TRANSPORT_MODES = ["Airways", "Sea Freight"];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
  submitted: { label: "Submitted", cls: "bg-sky-100 text-sky-700" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  so_created: { label: "SO Created", cls: "bg-violet-100 text-violet-700" },
};

const REASON_LABEL: Record<string, string> = {
  logistics: "logistics missing",
  pricebook: "below pricebook",
  payment: "custom payment terms",
};
function reasonText(reason?: string): string {
  return (reason || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => REASON_LABEL[r] || r)
    .join(" · ");
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status || "—", cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

/**
 * mode="mine"  → each sales person's own Past Quotes (scoped by creator id, no approval actions).
 * mode="admin" → the Approvals view: every quote, with Complete/Publish + Delete (behind the admin gate).
 */
export default function OrdersAdmin({ mode = "admin", onEdit }: { mode?: "mine" | "admin"; onEdit?: (o: OrderOut) => void }) {
  const isAdmin = mode === "admin";
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [publishing, setPublishing] = useState<OrderOut | null>(null); // the draft being completed
  const [draftEdits, setDraftEdits] = useState<OrderPublish>({});
  const [publishPaymentCustom, setPublishPaymentCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setOrders(await api.listOrders(isAdmin ? undefined : getCreatorId()));
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  const counts = useMemo(() => {
    const c = { all: orders.length, draft: 0, submitted: 0, approved: 0, so_created: 0 } as Record<StatusFilter, number>;
    for (const o of orders) if (o.status in c) (c as Record<string, number>)[o.status]++;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!needle) return true;
      return [o.quote_number, o.prepared_for, o.bill_to_company, o.bill_to_country, o.proposed_by]
        .some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [orders, q, filter]);

  async function downloadPdf(o: OrderOut) {
    try {
      const blob = await api.orderPdfBlob(o.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Exicom_${o.quote_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    }
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
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(o: OrderOut) {
    if (!confirm(`Delete order ${o.quote_number}? This cannot be undone.`)) return;
    try {
      await api.deleteOrder(o.id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function markSoCreated(o: OrderOut) {
    if (!confirm(`Mark ${o.quote_number} as SO Created?`)) return;
    try {
      await api.markSoCreated(o.id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function setE<K extends keyof OrderPublish>(k: K, v: OrderPublish[K]) {
    setDraftEdits((e) => ({ ...e, [k]: v }));
  }

  const money = (n: number, cur: string) =>
    `${cur} ${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "submitted", label: "Submitted" },
    { key: "approved", label: "Approved" },
    { key: "so_created", label: "SO Order Tracking" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">
            {isAdmin ? "Approvals" : "Past Quotes"}
            {isAdmin && counts.draft > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
                {counts.draft} draft{counts.draft > 1 ? "s" : ""} awaiting
              </span>
            )}
          </h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            {isAdmin ? (
              <>Every quotation the team generates is here. A <b>Draft</b> needs sign-off (missing logistics or a
              price below pricebook) — review and publish it to <b>Approved</b>.</>
            ) : (
              <>Your historical quotations — search, view and download. Approval is handled by the admin.</>
            )}
          </p>
        </div>
        <button className="btn flex-shrink-0" onClick={reload}>↻ Refresh</button>
      </div>

      {/* filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100/70 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filter === f.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f.label} <span className="text-xs text-slate-400">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        {!(isAdmin && filter === "so_created") && (
          <input
            className="inp max-w-xs flex-1"
            placeholder="Search quote #, customer, country, KAM…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </div>

      {/* The "SO Order Tracking" tab embeds the full Order Tracking interface. */}
      {isAdmin && filter === "so_created" ? (
        <OrderTracking />
      ) : (
      <>

      {/* publish editor */}
      {publishing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">
            Complete &amp; Publish — <span className="text-slate-500">{publishing.quote_number}</span>
          </div>
          {publishing.approval_reason && (
            <div className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
              Needs approval: {reasonText(publishing.approval_reason)}
              {publishing.approval_reason.includes("pricebook") && (
                <span className="font-normal"> — one or more lines are priced below pricebook; review before approving.</span>
              )}
            </div>
          )}
          {publishing.approval_note && (
            <div className="mb-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">Sales reason (internal):</span>{" "}
              <span className="whitespace-pre-wrap">{publishing.approval_note}</span>
            </div>
          )}
          <p className="mb-3 text-xs text-slate-500">
            Fill in the transport cost for <b>{publishing.bill_to_country || "the destination"}</b>{" "}
            (in {publishing.currency}), then publish. This marks the order <b>Approved</b>.
            <br />
            <span className="text-slate-400">
              Tip: this country was added to the <b>Logistics</b> tab as <i>pending</i> — set its
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

          {/* Payment Terms — same dropdown + Custom… behaviour as the Quote Form */}
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

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          No orders {filter !== "all" ? `with status "${filter}"` : "yet"}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Quote #</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Incoterms</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">KAM</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-semibold text-slate-800">{o.quote_number}</td>
                  <td className="px-4 py-2 text-slate-700">{o.prepared_for || o.bill_to_company || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{o.bill_to_country || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{o.incoterms}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">{money(o.grand_total, o.currency)}</td>
                  <td className="px-4 py-2 text-slate-600">{o.proposed_by || "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                    {o.status === "draft" && o.approval_reason && (
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600">
                        {reasonText(o.approval_reason)}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {onEdit && (isAdmin || o.status === "draft" || o.status === "submitted") && (
                      <button className="mr-2 text-xs font-semibold text-exicom-tealDark hover:underline" onClick={() => onEdit(o)}>
                        Edit
                      </button>
                    )}
                    {isAdmin && o.status === "draft" && (
                      <button className="mr-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => openPublish(o)}>
                        Complete
                      </button>
                    )}
                    {isAdmin && o.status === "approved" && (
                      <button className="mr-2 text-xs font-semibold text-violet-600 hover:text-violet-800" onClick={() => markSoCreated(o)}>
                        Mark SO Created
                      </button>
                    )}
                    <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => downloadPdf(o)}>
                      {o.status === "approved" || o.status === "so_created" ? "Download again" : "Download"}
                    </button>
                    {isAdmin && (
                      <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(o)}>Delete</button>
                    )}
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
