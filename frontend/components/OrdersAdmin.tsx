"use client";

import { useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { CatalogProduct, OrderOut } from "@/lib/types";

// Same tier-lookup logic as the Order Form, so the review card can show what
// the pricebook says a line should cost (for comparison against what was quoted).
const EUR_ND_KEY = "EUR_ND";
function priceFor(p: CatalogProduct, currency: string, qty: number): number | null {
  const tiers = p.prices?.[currency];
  if (!tiers || tiers.length === 0) return null;
  for (const [min, max, price] of tiers) {
    if (qty >= min && (max == null || qty <= max)) return price;
  }
  return tiers[0][2];
}
function pricebookPrice(p: CatalogProduct | undefined, currency: string, qty: number, eurDiscount?: string): number | null {
  if (!p) return null;
  if (currency === "EUR" && eurDiscount === "without" && p.prices?.[EUR_ND_KEY]?.length) {
    return priceFor(p, EUR_ND_KEY, qty);
  }
  return priceFor(p, currency, qty);
}

type StatusFilter = "all" | "draft" | "submitted" | "approved" | "so_created" | "pending" | "pricingApproved" | "rejected";

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

// Only a still-editable quote can be changed in place — once it's Submitted
// (or later Approved / SO Created), Duplicate is the way to reuse its details.
function isEditable(status: string): boolean {
  return status === "draft" || status === "rejected";
}

// Past Quotes has no separate Approved tab — an approved draft just joins the
// Submitted tab (it already cleared sign-off in Pricing Approval; the status
// badge still says "Approved" so it's clear it went through that step).
function isSubmittedGroup(status: string): boolean {
  return status === "submitted" || status === "approved";
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
  const [filter, setFilter] = useState<StatusFilter>(isAdmin ? "pending" : "all");
  const [reviewing, setReviewing] = useState<OrderOut | null>(null); // the draft being reviewed
  // The review card only makes sense on the Pending tab — close it on switching away.
  useEffect(() => { if (filter !== "pending") setReviewing(null); }, [filter]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
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
  // Only the review card needs it, but it's a small, rarely-changing list.
  useEffect(() => { if (isAdmin) api.listCatalog().then(setCatalog).catch(() => setCatalog([])); }, [isAdmin]);

  const counts = useMemo(() => {
    const c = {
      all: orders.length, draft: 0, submitted: 0, approved: 0, so_created: 0,
      pending: 0, pricingApproved: 0, rejected: 0,
    } as Record<StatusFilter, number>;
    for (const o of orders) {
      if (o.status in c) (c as Record<string, number>)[o.status]++;
      if (isPricingDraft(o.approval_reason)) {
        if (o.status === "draft") c.pending++;
        if (o.status === "approved" || o.status === "so_created") c.pricingApproved++;
      }
    }
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (isAdmin) {
        if (filter === "pending" && !(o.status === "draft" && isPricingDraft(o.approval_reason))) return false;
        if (filter === "pricingApproved" && !((o.status === "approved" || o.status === "so_created") && isPricingDraft(o.approval_reason))) return false;
        if (filter === "rejected" && o.status !== "rejected") return false;
      } else if (filter === "submitted" ? !isSubmittedGroup(o.status) : filter !== "all" && o.status !== filter) {
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

  // The customer confirmed the PO against this quotation — graduates it into
  // SO Order Tracking (a tracking row already exists from when it was first
  // saved; this just flips the order's own status to reflect it's a real order).
  async function markOrderReceived(o: OrderOut) {
    if (!confirm(`Mark ${o.quote_number} as Order Received? It'll show in SO Order Tracking.`)) return;
    try {
      await api.markSoCreated(o.id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const money = (n: number, cur: string) => `${cur} ${Math.round(n || 0).toLocaleString("en-US")}`;

  const MINE_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Drafts" },
    { key: "submitted", label: "Submitted" },
  ];
  const ADMIN_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "pricingApproved", label: "Approved" },
    { key: "rejected", label: "Reject" },
  ];
  const FILTERS = isAdmin ? ADMIN_FILTERS : MINE_FILTERS;

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">
            {isAdmin ? "Pricing Approval" : "Past Quotes"}
            {isAdmin && counts.pending > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">
                {counts.pending} awaiting
              </span>
            )}
          </h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            {isAdmin ? (
              <>Drafts needing sign-off for a price below pricebook or custom payment terms. Logistics sign-off
              (missing CIF transport cost) is handled in the <b>Logistics</b> tab.</>
            ) : (
              <>Quotation history for the whole team — every status, including <b>Drafts</b>. Search, view and generate PDFs.</>
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
              {f.label}{" "}
              <span className="text-xs text-slate-400">
                {!isAdmin && f.key === "submitted" ? counts.submitted + counts.approved : counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <input
          className="inp max-w-xs flex-1"
          placeholder="Search quote #, customer, country, KAM…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* pricing review card — Pending tab only */}
      {reviewing && filter === "pending" && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="mb-3 flex items-center justify-between">
            <div className="section-title mb-0">
              Review Quotation — <span className="text-slate-500">{reviewing.quote_number}</span>
            </div>
            <button className="btn flex-shrink-0" onClick={() => setReviewing(null)}>✕ Close</button>
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
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Products</div>
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-[10px] font-semibold text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5">Product</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                    <th className="px-2 py-1.5 text-right">Quoted Price</th>
                    <th className="px-2 py-1.5 text-right">Pricebook Price</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewing.items.map((it, i) => {
                    const p = catalog.find((c) => c.product_code === it.product_code);
                    const book = pricebookPrice(p, reviewing.currency, it.quantity, it.eur_discount);
                    const below = book != null && it.unit_price < book - 1e-6;
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 text-slate-700">{it.product_name || it.product_code || "—"}</td>
                        <td className="px-2 py-1.5 text-right text-slate-600">{it.quantity}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold ${below ? "text-rose-600" : "text-slate-700"}`}>
                          {reviewing.currency} {Math.round(it.unit_price).toLocaleString("en-US")}
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-500">
                          {book == null ? "—" : `${reviewing.currency} ${Math.round(book).toLocaleString("en-US")}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          </div>
        </div>
      )}

      {reviewing && filter === "pending" ? null : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          {isAdmin
            ? filter === "pending"
              ? "No drafts waiting on pricing approval."
              : filter === "pricingApproved"
                ? "No approved quotations yet."
                : "No rejected quotations."
            : `No orders ${filter !== "all" ? `with status "${filter}"` : "yet"}.`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2">Quote #</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Country</th>
                <th className="px-4 py-2">Incoterms</th>
                {isAdmin && <th className="px-4 py-2">Products</th>}
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
                  {isAdmin && (
                    <td className="max-w-[220px] px-4 py-2 text-slate-600">
                      {o.items.map((it) => it.product_name || it.product_code).filter(Boolean).join(", ") || "—"}
                    </td>
                  )}
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
                    {!isAdmin && onEdit && isEditable(o.status) && (
                      <button className="mr-2 text-xs font-semibold text-exicom-tealDark hover:underline" onClick={() => onEdit(o)}>
                        Edit
                      </button>
                    )}
                    {isAdmin && o.status === "draft" && (
                      <button className="mr-2 text-xs font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => setReviewing(o)}>
                        Review
                      </button>
                    )}
                    {!isAdmin && filter === "submitted" && isSubmittedGroup(o.status) && (
                      <button className="mr-2 text-xs font-semibold text-violet-600 hover:text-violet-800" onClick={() => markOrderReceived(o)}>
                        Order Received
                      </button>
                    )}
                    {!isAdmin && onEdit && filter === "submitted" && isSubmittedGroup(o.status) && (
                      <button
                        className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                        title="Create a new order pre-filled from this one"
                        onClick={() => onEdit({ ...o, id: "", quote_number: "", created_by: "" })}
                      >
                        Duplicate
                      </button>
                    )}
                    {!isAdmin && (
                      <>
                        <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => downloadPdf(o)}>
                          Generate PDF
                        </button>
                        <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(o)}>Delete</button>
                      </>
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
