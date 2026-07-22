"use client";

import { useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { OrderOut } from "@/lib/types";

type StatusFilter = "all" | "draft" | "submitted" | "approved" | "so_created" | "pricing";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-700" },
  submitted: { label: "Submitted", cls: "bg-sky-100 text-sky-700" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  so_created: { label: "SO Created", cls: "bg-violet-100 text-violet-700" },
  rejected: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
};

// The last 6 digits of a quote number are the HHMMSS the quote was issued at
// (e.g. "2026-july-22-135527" → 13:55).
function quoteTime(quoteNumber: string): string {
  const m = quoteNumber.match(/(\d{2})(\d{2})\d{2}$/);
  return m ? `${m[1]}:${m[2]}` : "—";
}

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

// A draft's approval_reason is a comma list of "logistics" / "pricebook" / "payment".
// Approvals handles the pricing side; logistics sign-off happens in the Logistics tab.
function reasonList(reason?: string): string[] {
  return (reason || "").split(",").map((r) => r.trim()).filter(Boolean);
}
function isPricingDraft(reason?: string): boolean {
  return reasonList(reason).some((r) => r === "pricebook" || r === "payment");
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status || "—", cls: "bg-slate-100 text-slate-600" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

/**
 * mode="mine"  → Past Quotes: every quotation the team has made, every status
 *                including drafts, open to anyone — browse, download, edit a
 *                draft/submitted quote. No approval actions here.
 * mode="admin" → Approvals: Pricing Approval — drafts needing sign-off for a
 *                price below pricebook or custom payment terms. Logistics
 *                sign-off (missing CIF transport cost) is handled in the
 *                Logistics tab instead.
 */
export default function OrdersAdmin({ mode = "mine", onEdit }: { mode?: "mine" | "admin"; onEdit?: (o: OrderOut) => void }) {
  const isAdmin = mode === "admin";
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>(isAdmin ? "pricing" : "all");
  const [reviewing, setReviewing] = useState<OrderOut | null>(null); // the draft being reviewed
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setOrders(await api.listOrders());
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  const counts = useMemo(() => {
    const c = { all: orders.length, draft: 0, submitted: 0, approved: 0, so_created: 0, pricing: 0 } as Record<StatusFilter, number>;
    for (const o of orders) {
      if (o.status in c) (c as Record<string, number>)[o.status]++;
      if (o.status === "draft" && isPricingDraft(o.approval_reason)) c.pricing++;
    }
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (isAdmin) {
        if (o.status !== "draft" || !isPricingDraft(o.approval_reason)) return false;
      } else if (filter !== "all" && o.status !== filter) {
        return false;
      }
      if (!needle) return true;
      return [o.quote_number, o.prepared_for, o.bill_to_company, o.bill_to_country, o.proposed_by]
        .some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [orders, q, filter, isAdmin]);

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

  async function approve(o: OrderOut) {
    setBusy(true);
    try {
      await api.publishOrder(o.id, {});
      setReviewing(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(o: OrderOut) {
    if (!confirm(`Reject quote ${o.quote_number}? The sales person will see it as Rejected.`)) return;
    setBusy(true);
    try {
      await api.rejectOrder(o.id);
      setReviewing(null);
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

  const money = (n: number, cur: string) =>
    `${cur} ${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const MINE_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "submitted", label: "Submitted" },
    { key: "approved", label: "Approved" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">
            {isAdmin ? "Pricing Approval" : "Past Quotes"}
            {isAdmin && counts.pricing > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
                {counts.pricing} awaiting
              </span>
            )}
          </h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            {isAdmin ? (
              <>Drafts needing sign-off for a price below pricebook or custom payment terms. Logistics sign-off
              (missing CIF transport cost) is handled in the <b>Logistics</b> tab.</>
            ) : (
              <>Quotation history for the whole team — every status, including <b>Drafts</b>. Search, view and download.</>
            )}
          </p>
        </div>
        <button className="btn flex-shrink-0" onClick={reload}>↻ Refresh</button>
      </div>

      {/* filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!isAdmin && (
          <div className="flex gap-1 rounded-xl bg-slate-100/70 p-1">
            {MINE_FILTERS.map((f) => (
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
        )}
        <input
          className="inp max-w-xs flex-1"
          placeholder="Search quote #, customer, country, KAM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* pricing review card */}
      {reviewing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">
            Review Quotation — <span className="text-slate-500">{reviewing.quote_number}</span>
          </div>
          {reviewing.approval_reason && (
            <div className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
              Needs approval: {reasonText(reviewing.approval_reason)}
            </div>
          )}
          {reviewing.approval_note && (
            <div className="mb-3 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">Sales reason (internal):</span>{" "}
              <span className="whitespace-pre-wrap">{reviewing.approval_note}</span>
            </div>
          )}
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
              <div className="text-[11px] font-semibold uppercase text-slate-400">KAM Name</div>
              <div className="text-slate-700">{reviewing.proposed_by || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Total</div>
              <div className="font-semibold text-slate-800">{money(reviewing.grand_total, reviewing.currency)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Date</div>
              <div className="text-slate-700">{reviewing.quote_date || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-slate-400">Time</div>
              <div className="text-slate-700">{quoteTime(reviewing.quote_number)}</div>
            </div>
          </div>
          <a
            className="mt-3 inline-block text-xs font-semibold text-exicom-tealDark hover:underline"
            href={`${API_BASE}/api/orders/${reviewing.id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Quotation ↗
          </a>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary" onClick={() => approve(reviewing)} disabled={busy}>
              {busy ? "Working…" : "✓ Approve"}
            </button>
            <button
              className="btn bg-rose-50 text-rose-700 hover:bg-rose-100"
              onClick={() => reject(reviewing)}
              disabled={busy}
            >
              ✕ Reject
            </button>
            <button className="btn" onClick={() => setReviewing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          {isAdmin
            ? "No drafts waiting on pricing approval."
            : `No orders ${filter !== "all" ? `with status "${filter}"` : "yet"}.`}
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
                      <button className="mr-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => setReviewing(o)}>
                        Review
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
    </div>
  );
}
