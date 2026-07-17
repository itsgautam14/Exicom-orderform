"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { OrderTracking } from "@/lib/types";

const STATUS_OPTIONS = ["Pending", "In Production", "Dispatched", "Delivered", "On Hold", "Cancelled"];

const BLANK: Partial<OrderTracking> = {
  partner: "", market: "", kam: "", ordered: "", specifications: "",
  date_of_order: "", value: null, date_of_dispatch: "", ex_date_of_delivery: "",
  status: "", notes: "",
};

function statusClass(s: string): string {
  const k = (s || "").toLowerCase();
  if (k.includes("deliver")) return "bg-emerald-100 text-emerald-700";
  if (k.includes("dispatch")) return "bg-sky-100 text-sky-700";
  if (k.includes("production") || k.includes("pending")) return "bg-amber-100 text-amber-700";
  if (k.includes("cancel")) return "bg-rose-100 text-rose-700";
  if (k.includes("hold")) return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
}

const fmtNum = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrderTracking() {
  const [rows, setRows] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<Partial<OrderTracking> | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setRows(await api.listTracking());
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  // ---- dashboard stats ----
  const stats = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + (r.value || 0), 0);
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const key = r.status?.trim() || "—";
      byStatus[key] = (byStatus[key] || 0) + 1;
    }
    return { count: rows.length, totalValue, byStatus };
  }, [rows]);

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status?.trim()).filter(Boolean))) as string[],
    [rows]
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && (r.status || "").trim() !== statusFilter) return false;
      if (!needle) return true;
      return [r.partner, r.market, r.kam, r.ordered, r.specifications, r.notes]
        .some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [rows, q, statusFilter]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) await api.updateTracking(editing.id, editing);
      else await api.createTracking(editing);
      setEditing(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del(id: string) {
    if (!confirm("Delete this tracking row?")) return;
    try { await api.deleteTracking(id); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setBusy(true);
    try {
      const { imported, skipped, errors } = await api.importTracking(file);
      const lines = [`Imported ${imported} row${imported === 1 ? "" : "s"} from ${file.name}.`];
      if (skipped) lines.push(`Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"} (already in the system).`);
      if (errors?.length) lines.push("", "Rows with errors:", ...errors.slice(0, 20).map((e) => "• " + e));
      alert(lines.join("\n"));
      reload(); // refresh the table
    } catch (err) {
      alert("Import failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setF<K extends keyof OrderTracking>(k: K, v: OrderTracking[K]) {
    setEditing((e) => ({ ...(e || {}), [k]: v }));
  }

  return (
    <div className="mx-auto max-w-7xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Order Tracking</h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            Track dispatched orders — enter rows manually or import an Excel file.
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <input ref={fileInput} type="file" accept=".xlsx" className="hidden" onChange={onImportFile} />
          <button className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>⤒ Import Excel</button>
          <button className="btn btn-primary" onClick={() => setEditing({ ...BLANK })}>+ Add Order</button>
        </div>
      </div>

      {/* dashboard cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tracked Orders</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{stats.count}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Value</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{fmtNum(stats.totalValue)}</div>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">By Status</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(stats.byStatus).length === 0 ? (
              <span className="text-sm text-slate-400">—</span>
            ) : (
              Object.entries(stats.byStatus).map(([s, n]) => (
                <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(s)}`}>
                  {s}: {n}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* editor */}
      {editing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">{editing.id ? "Edit Order" : "New Order"}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {textField("Partner", "partner")}
            {textField("Market", "market")}
            {textField("KAM", "kam")}
            {dateField("Date of Order", "date_of_order")}
            {numField("Value", "value")}
            <div>
              <label className="lbl">Status</label>
              <input className="inp" list="track-status" value={editing.status || ""} onChange={(e) => setF("status", e.target.value)} />
              <datalist id="track-status">{STATUS_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            {dateField("Date of Dispatch", "date_of_dispatch")}
            {dateField("Expected Delivery", "ex_date_of_delivery")}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {areaField("Ordered", "ordered")}
            {areaField("Specifications", "specifications")}
            {areaField("Notes (pending / blocker)", "notes")}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="inp max-w-xs flex-1" placeholder="Search partner, market, KAM, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={reload}>↻</button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
          No tracked orders yet. Add one, or import an Excel file.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">KAM</th>
                <th className="px-3 py-2">Ordered</th>
                <th className="px-3 py-2">Specifications</th>
                <th className="px-3 py-2">Order Date</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2">Dispatch</th>
                <th className="px-3 py-2">Expected Delivery</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-semibold text-slate-800">{r.partner || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.market || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.kam || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.ordered || "—"}</td>
                  <td className="max-w-[200px] px-3 py-2 text-slate-600">{r.specifications || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.date_of_order || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{r.value == null ? "—" : fmtNum(r.value)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.date_of_dispatch || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.ex_date_of_delivery || "—"}</td>
                  <td className="px-3 py-2">
                    {r.status ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(r.status)}`}>{r.status}</span> : "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-500">{r.notes || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => setEditing(r)}>Edit</button>
                    <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ---- small field renderers (share `editing`/`setF`) ----
  function textField(label: string, k: keyof OrderTracking) {
    return (
      <div>
        <label className="lbl">{label}</label>
        <input className="inp" value={(editing?.[k] as string) || ""} onChange={(e) => setF(k, e.target.value as OrderTracking[typeof k])} />
      </div>
    );
  }
  function dateField(label: string, k: keyof OrderTracking) {
    return (
      <div>
        <label className="lbl">{label}</label>
        <input className="inp" type="date" value={(editing?.[k] as string) || ""} onChange={(e) => setF(k, e.target.value as OrderTracking[typeof k])} />
      </div>
    );
  }
  function numField(label: string, k: keyof OrderTracking) {
    const v = editing?.[k];
    return (
      <div>
        <label className="lbl">{label}</label>
        <input
          className="inp" type="number" step="0.01"
          value={v === null || v === undefined ? "" : (v as number)}
          onChange={(e) => setF(k, (e.target.value === "" ? null : parseFloat(e.target.value)) as OrderTracking[typeof k])}
        />
      </div>
    );
  }
  function areaField(label: string, k: keyof OrderTracking) {
    return (
      <div>
        <label className="lbl">{label}</label>
        <textarea className="inp" rows={2} value={(editing?.[k] as string) || ""} onChange={(e) => setF(k, e.target.value as OrderTracking[typeof k])} />
      </div>
    );
  }
}
