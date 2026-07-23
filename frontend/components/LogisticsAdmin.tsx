"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LogisticsRate } from "@/lib/types";

const BLANK: Partial<LogisticsRate> = {
  country: "",
  sea_rate: null,
  air_up_to_500: null,
  air_above_500: null,
};

// Country logistics rate data only — the approval workflow for pending
// requests now lives in its own top-level "Pending Logistic" tab.
export default function LogisticsAdmin() {
  const [items, setItems] = useState<LogisticsRate[]>([]);
  const [editing, setEditing] = useState<Partial<LogisticsRate> | null>(null);
  const [loading, setLoading] = useState(true);

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
          step="1"
          value={val === null || val === undefined ? "" : (val as number)}
          onChange={(e) => setF(k, (e.target.value === "" ? null : Math.round(parseFloat(e.target.value))) as LogisticsRate[typeof k])}
          placeholder="—"
        />
      </div>
    );
  }

  const fmt = (n: number | null) =>
    n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-US");
  const pending = items.filter((r) => r.status !== "approved").length;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">
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
            flagged by a request in <b>Pending Logistic</b> appear as <b>Awaiting prices</b> until priced —
            approving a request there also fills the country&apos;s rate here automatically.
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
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
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
    </div>
  );
}
