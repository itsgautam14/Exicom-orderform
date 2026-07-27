"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { OrderTracking } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "INR", "MYR"];

const STAGES: { key: string; label: string }[] = [
  { key: "so_created", label: "Sales Order Created" },
  { key: "in_production", label: "In Production" },
  { key: "fg_ready", label: "FG Ready" },
  { key: "dispatched", label: "Dispatched" },
];

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

// For a <input type="date"> value — local date only, "YYYY-MM-DD". The time
// of day is never hand-entered — it's kept from whenever the stage was
// actually recorded (see mergeDateKeepTime).
function toDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Apply a hand-picked date on top of the original timestamp's time-of-day,
// so editing the date never touches the actual click time it was recorded at.
function mergeDateKeepTime(dateStr: string, originalIso: string): string {
  const orig = new Date(originalIso);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, orig.getHours(), orig.getMinutes(), orig.getSeconds(), orig.getMilliseconds())
    .toISOString();
}

// Most recent remark left for a row's current stage, so the list reflects
// whatever the Stage dropdown is showing without opening the detail view.
function latestStageRemark(row: OrderTracking) {
  return [...(row.stage_events || [])].reverse().find((e) => e.stage === row.current_stage && e.remarks);
}

const BLANK: Partial<OrderTracking> = {
  partner: "", market: "", kam: "", ordered: "", specifications: "",
  date_of_order: "", value: null, currency: "", notes: "",
};

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export default function OrderTracking() {
  const [rows, setRows] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<OrderTracking> | null>(null);
  const [viewing, setViewing] = useState<OrderTracking | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("so_created");
  const [stageRemarks, setStageRemarks] = useState("");
  const [editingRemark, setEditingRemark] = useState<
    { eventId: string; text: string; date: string; originalIso: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

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
  const stats = useMemo(() => ({ count: rows.length }), [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.partner, r.market, r.kam, r.ordered, r.specifications, r.notes]
        .some((v) => (v || "").toLowerCase().includes(needle))
    );
  }, [rows, q]);

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

  // Quick stage change directly from the list, without opening the detail view.
  async function changeStage(row: OrderTracking, stage: string) {
    if (stage === row.current_stage) return;
    try {
      await api.advanceTrackingStage(row.id, stage, "");
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // Keep the open detail card in sync whenever the underlying row refreshes.
  useEffect(() => {
    if (!viewing) return;
    const fresh = rows.find((r) => r.id === viewing.id);
    if (fresh) setViewing(fresh);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default the stage selector to "the one after wherever this order currently
  // is" each time a different row is opened — but leave it alone otherwise so
  // it doesn't jump around while the user is picking a stage to edit.
  useEffect(() => {
    if (!viewing) return;
    const idx = STAGES.findIndex((s) => s.key === viewing.current_stage);
    setSelectedStage((STAGES[idx + 1] || STAGES[idx] || STAGES[0]).key);
  }, [viewing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !viewing) return;
    setBusy(true);
    try {
      const updated = await api.uploadTrackingDocument(viewing.id, file);
      setViewing(updated);
      reload();
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteDoc() {
    if (!viewing || !confirm("Delete the uploaded document?")) return;
    setBusy(true);
    try {
      const updated = await api.deleteTrackingDocument(viewing.id);
      setViewing(updated);
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveStage(stage: string) {
    if (!viewing) return;
    setBusy(true);
    try {
      const updated = await api.advanceTrackingStage(viewing.id, stage, stageRemarks);
      setViewing(updated);
      setStageRemarks("");
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEditedRemark() {
    if (!viewing || !editingRemark) return;
    setBusy(true);
    try {
      // Only the date is hand-picked — the time of day is kept from the
      // original timestamp, never manually entered.
      const createdAt = editingRemark.date
        ? mergeDateKeepTime(editingRemark.date, editingRemark.originalIso)
        : undefined;
      const updated = await api.updateStageRemark(viewing.id, editingRemark.eventId, editingRemark.text, createdAt);
      setViewing(updated);
      setEditingRemark(null);
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
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
          <button className="btn btn-primary" onClick={() => { setEditing({ ...BLANK }); setViewing(null); }}>+ Add Order</button>
        </div>
      </div>

      {/* dashboard cards */}
      <div className="mb-5 grid grid-cols-1 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tracked Orders</div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{stats.count}</div>
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
              <label className="lbl">Currency</label>
              <select className="inp" value={editing.currency || ""} onChange={(e) => setF("currency", e.target.value)}>
                <option value="">—</option>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {areaField("Ordered", "ordered")}
            {areaField("Specifications", "specifications")}
            {areaField("Remarks (pending / blocker)", "notes")}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* detail view: document + fulfillment stage tracker */}
      {viewing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="section-title mb-0">{viewing.partner || "Order"}</div>
              <p className="text-xs text-slate-500">
                {viewing.quote_number ? `Quote ${viewing.quote_number}` : "Manually added order"}
              </p>
            </div>
            <button className="btn" onClick={() => { setViewing(null); setEditingRemark(null); }}>Close</button>
          </div>

          {/* signed document */}
          <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Signed Quotation / PO Document
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {viewing.doc_filename ? (
                <a
                  className="text-sm font-semibold text-exicom-teal hover:underline"
                  href={`${API_BASE}/api/tracking/${viewing.id}/document`}
                  target="_blank" rel="noopener noreferrer"
                >
                  📄 View {viewing.doc_filename}
                </a>
              ) : (
                <span className="text-sm text-slate-400">No document uploaded yet.</span>
              )}
              <input ref={docInput} type="file" className="hidden" onChange={onUploadDoc} />
              <button className="btn" disabled={busy} onClick={() => docInput.current?.click()}>
                {viewing.doc_filename ? "Replace File" : "Upload File"}
              </button>
              {viewing.doc_filename && (
                <button className="text-xs font-semibold text-red-500 hover:text-red-700" disabled={busy} onClick={onDeleteDoc}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* fulfillment stage tracker */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fulfillment Tracker
            </div>
            <p className="mb-3 text-xs text-slate-400">Click a stage below to record it manually.</p>
            {(() => {
              // Defensive: older/in-flight API responses may not include stage_events yet.
              const events = viewing.stage_events || [];
              const currentIdx = STAGES.findIndex((s) => s.key === viewing.current_stage);
              const stageDate = (key: string) =>
                events.find((e) => e.stage === key)?.created_at;
              const selected = STAGES.find((s) => s.key === selectedStage) || STAGES[0];
              const selectedStageRemarks = events.filter((e) => e.stage === selected.key && e.remarks);
              return (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {STAGES.map((s, i) => {
                      const primaryEvent = events.find((e) => e.stage === s.key);
                      const reachedAt = primaryEvent?.created_at;
                      const nextReachedAt = STAGES[i + 1] ? stageDate(STAGES[i + 1].key) : undefined;
                      const done = reachedAt != null;
                      const active = i === currentIdx;
                      const isSelected = s.key === selectedStage;
                      const duration = reachedAt
                        ? daysBetween(reachedAt, nextReachedAt || new Date().toISOString())
                        : null;
                      // Extra remarks beyond the primary event (rare — a stage
                      // re-triggered more than once); the primary's own remark
                      // is edited inline with its date below instead.
                      const stageRemarks = events.filter(
                        (e) => e.stage === s.key && e.remarks && e.id !== primaryEvent?.id
                      );
                      return (
                        <div
                          key={s.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedStage(s.key)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedStage(s.key)}
                          className={`cursor-pointer rounded-lg border p-2.5 text-left transition ${
                            isSelected
                              ? "border-exicom-teal ring-2 ring-exicom-teal/40 bg-exicom-teal/5"
                              : active
                              ? "border-exicom-teal bg-exicom-teal/5"
                              : done
                              ? "border-slate-200 hover:border-exicom-teal/40"
                              : "border-dashed border-slate-200 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <span className={`inline-block h-2 w-2 rounded-full ${done ? "bg-exicom-teal" : "bg-slate-300"}`} />
                            {s.label}
                          </div>
                          {primaryEvent && editingRemark?.eventId === primaryEvent.id ? (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="date"
                                className="inp !py-1 !text-[11px]"
                                value={editingRemark.date}
                                onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                              />
                              <textarea
                                className="inp mt-1 !py-1 !text-[11px]"
                                rows={2}
                                placeholder="Remarks (optional)…"
                                value={editingRemark.text}
                                onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                              />
                              <div className="mt-1 flex gap-2">
                                <button
                                  type="button" disabled={busy}
                                  className="text-[10px] font-semibold text-exicom-teal hover:underline"
                                  onClick={saveEditedRemark}
                                >
                                  {busy ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                                  onClick={() => setEditingRemark(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {reachedAt ? fmtDateTime(reachedAt) : "Not reached yet"}{" "}
                              {primaryEvent && (
                                <button
                                  type="button"
                                  className="font-semibold text-exicom-teal hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRemark({
                                      eventId: primaryEvent.id,
                                      text: primaryEvent.remarks,
                                      date: toDateOnly(primaryEvent.created_at),
                                      originalIso: primaryEvent.created_at,
                                    });
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              {primaryEvent?.remarks && (
                                <div className="mt-0.5 italic">"{primaryEvent.remarks}"</div>
                              )}
                            </div>
                          )}
                          {duration != null && (
                            <div className="mt-1 text-[11px] font-semibold text-slate-600">
                              {active ? `${duration} day${duration === 1 ? "" : "s"} so far` : `Took ${duration} day${duration === 1 ? "" : "s"}`}
                            </div>
                          )}
                          {stageRemarks.length > 0 && (
                            <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                              {stageRemarks.map((e) =>
                                editingRemark?.eventId === e.id ? (
                                  <div key={e.id}>
                                    <input
                                      type="date"
                                      className="inp mb-1 !py-1 !text-[11px]"
                                      value={editingRemark.date}
                                      onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                                    />
                                    <textarea
                                      className="inp !py-1 !text-[11px]"
                                      rows={2}
                                      value={editingRemark.text}
                                      onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                                    />
                                    <div className="mt-1 flex gap-2">
                                      <button
                                        type="button" disabled={busy}
                                        className="text-[10px] font-semibold text-exicom-teal hover:underline"
                                        onClick={saveEditedRemark}
                                      >
                                        {busy ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                                        onClick={() => setEditingRemark(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div key={e.id} className="text-[11px] italic text-slate-500">
                                    "{e.remarks}"{" "}
                                    <span className="not-italic text-slate-400">({fmtDateTime(e.created_at)})</span>{" "}
                                    <button
                                      type="button"
                                      className="not-italic text-[10px] font-semibold text-exicom-teal hover:underline"
                                      onClick={() => setEditingRemark({ eventId: e.id, text: e.remarks, date: toDateOnly(e.created_at), originalIso: e.created_at })}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {selectedStageRemarks.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {selectedStageRemarks.map((e) => (
                          <div key={e.id} className="text-xs italic text-slate-500">
                            "{e.remarks}"{" "}
                            <span className="not-italic text-slate-400">({fmtDateTime(e.created_at)})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="lbl mt-3">
                      Remarks for “{selected.label}” {selected.key === "in_production" ? "(reason for delay, notes, etc.)" : "(optional)"}
                    </label>
                    <textarea
                      className="inp" rows={2} value={stageRemarks}
                      onChange={(e) => setStageRemarks(e.target.value)}
                      placeholder="Why is it moving now / any delay reason…"
                    />
                    <button
                      className="btn btn-primary mt-2" disabled={busy}
                      onClick={() => saveStage(selected.key)}
                    >
                      {busy ? "Saving…" : `Save “${selected.label}”`}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* every remark across all stages, in one place */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              All Remarks
            </div>
            {(() => {
              const allRemarks = (viewing.stage_events || []).filter((e) => e.remarks);
              if (allRemarks.length === 0) {
                return <p className="text-xs text-slate-400">No remarks recorded yet.</p>;
              }
              const stageLabel = (key: string) => STAGES.find((s) => s.key === key)?.label || key;
              return (
                <div className="space-y-1.5">
                  {allRemarks.map((e) =>
                    editingRemark?.eventId === e.id ? (
                      <div key={e.id}>
                        <span className="rounded bg-exicom-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-exicom-tealDark">
                          {stageLabel(e.stage)}
                        </span>
                        <input
                          type="date"
                          className="inp mt-1 !py-1 !text-xs"
                          value={editingRemark.date}
                          onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                        />
                        <textarea
                          className="inp mt-1 !py-1 !text-xs"
                          rows={2}
                          value={editingRemark.text}
                          onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                        />
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button" disabled={busy}
                            className="text-[11px] font-semibold text-exicom-teal hover:underline"
                            onClick={saveEditedRemark}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                            onClick={() => setEditingRemark(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={e.id} className="text-xs text-slate-600">
                        <span className="rounded bg-exicom-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-exicom-tealDark">
                          {stageLabel(e.stage)}
                        </span>{" "}
                        <span className="italic">"{e.remarks}"</span>{" "}
                        <span className="text-slate-400">({fmtDateTime(e.created_at)})</span>{" "}
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-exicom-teal hover:underline"
                          onClick={() => setEditingRemark({ eventId: e.id, text: e.remarks, date: toDateOnly(e.created_at), originalIso: e.created_at })}
                        >
                          Edit
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* filters + list — hidden while viewing an order's details */}
      {!viewing && (
        <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="inp max-w-xs flex-1" placeholder="Search partner, market, KAM, remarks…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">KAM</th>
                <th className="px-3 py-2">Ordered</th>
                <th className="px-3 py-2">Order Date</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Remarks</th>
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
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.date_of_order || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">
                    {r.value == null ? "—" : `${r.currency ? r.currency + " " : ""}${fmtNum(r.value)}`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <select
                      className="inp !w-auto !py-1 !text-xs"
                      value={r.current_stage}
                      onChange={(e) => changeStage(r, e.target.value)}
                    >
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-500">
                    {(() => {
                      const remark = latestStageRemark(r);
                      return remark ? (
                        <>
                          <span className="italic">"{remark.remarks}"</span>{" "}
                          <span className="text-xs text-slate-400">({fmtDateTime(remark.created_at)})</span>
                        </>
                      ) : "—";
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="mr-2 text-xs font-semibold text-exicom-teal hover:text-exicom-ink" onClick={() => { setViewing(r); setEditing(null); setEditingRemark(null); }}>View</button>
                    <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(r.id)}>Delete</button>
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
          className="inp" type="number" step="1"
          value={v === null || v === undefined ? "" : (v as number)}
          onChange={(e) => setF(k, (e.target.value === "" ? null : Math.round(parseFloat(e.target.value))) as OrderTracking[typeof k])}
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
