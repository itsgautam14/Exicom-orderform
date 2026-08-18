"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import type { OrderTracking } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "INR", "MYR"];

// Advance Payment only ever captures a date (see stageEditKind below);
// Shipment ("Shipment ID") only ever captures a tracking ID.
const STAGES: { key: string; label: string }[] = [
  { key: "advance_payment", label: "Advance Payment" },
  { key: "in_production", label: "In Production" },
  { key: "fg_ready", label: "FG Ready" },
  { key: "dispatched", label: "Dispatched" },
  { key: "shipment", label: "Shipment ID" },
  { key: "receipt", label: "Receipt" },
];

// Short form used in the Logs table's Activity column.
const STAGE_SHORT_LABEL: Record<string, string> = {
  advance_payment: "Advance Payment",
  in_production: "In Production",
  fg_ready: "FG Ready",
  dispatched: "Dispatched",
  shipment: "Shipment ID",
  receipt: "Receipt",
  planned_dates: "Planned Dates",
  dispatch_details: "Dispatch Details",
};

// What a stage's remarks form/edit form should capture: a plain date
// (Advance Payment), a single-line tracking ID (Shipment), or the usual
// free-text remarks + KAM (everything else).
function stageEditKind(stage: string): "date_only" | "id_only" | "full" {
  if (stage === "advance_payment") return "date_only";
  if (stage === "shipment") return "id_only";
  return "full";
}

// Logs table's Stages column for pseudo-stages logged outside the real
// in_production→receipt pipeline (see STAGES) — planned-date edits and the
// multi-dispatch Yes/No answer.
const LOG_EXTRA_STAGE_LABEL: Record<string, string> = {
  planned_dates: "Planned Dates",
  dispatch_details: "Dispatch Details",
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// A plain "YYYY-MM-DD" (as stored/sent to <input type="date">) shown as DD-MM-YYYY.
function fmtDateOnly(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
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

// Green while on/before the tentative dispatch date, amber 1 day past it,
// red 2+ days past — purely today vs. the hand-entered date, nothing else.
function delayColor(dateStr?: string): "green" | "amber" | "red" | null {
  if (!dateStr) return null;
  const tentative = new Date(dateStr);
  if (Number.isNaN(tentative.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tentative.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - tentative.getTime()) / 86400000);
  if (diffDays <= 0) return "green";
  if (diffDays === 1) return "amber";
  return "red";
}

// Status for Planned/Expected Dispatch Date: Green while more than 2 days
// remain, Amber once within 2 days of the date (before or up to 2 days
// after), Red once more than 2 days overdue.
function dispatchStatusColor(dateStr?: string): "green" | "amber" | "red" | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const daysRemaining = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (daysRemaining > 2) return "green";
  if (daysRemaining >= -2) return "amber";
  return "red";
}

const BLANK: Partial<OrderTracking> = {
  partner: "", market: "", kam: "", ordered: "", specifications: "",
  date_of_order: "", value: null, currency: "", notes: "", total_quantity: null,
};

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export default function OrderTracking() {
  const [rows, setRows] = useState<OrderTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<OrderTracking> | null>(null);
  const [viewing, setViewing] = useState<OrderTracking | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("advance_payment");
  const [stageRemarks, setStageRemarks] = useState("");
  const [stageKam, setStageKam] = useState("");
  const [stageDateInput, setStageDateInput] = useState(""); // Advance Payment's date-only entry
  const [editingRemark, setEditingRemark] = useState<
    { eventId: string; text: string; date: string; originalIso: string; kam: string } | null
  >(null);
  const [editingDispatch, setEditingDispatch] = useState<string | "bulk" | "new" | null>(null);
  const [dispatchDraft, setDispatchDraft] = useState<{ qty: number | null; date: string }>({
    qty: null, date: "",
  });
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set());
  const [editingPlanned, setEditingPlanned] = useState<"production" | "dispatch" | null>(null);
  const [plannedDraft, setPlannedDraft] = useState("");
  const [editingExpected, setEditingExpected] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const stageRemarksRef = useRef<HTMLTextAreaElement>(null);
  const stageIdRef = useRef<HTMLInputElement>(null); // Shipment ID's tracking-ID input
  const stageDateRef = useRef<HTMLInputElement>(null); // Advance Payment's date input
  // Whichever of the above is showing for the currently selected stage —
  // used by the "Edit" link on a not-yet-reached stage to jump to it.
  const activeStageFieldRef =
    selectedStage === "advance_payment" ? stageDateRef : selectedStage === "shipment" ? stageIdRef : stageRemarksRef;

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
  // Answers (or re-answers) the "dispatch in tranches?" prompt gating Dispatch Details.
  async function setDispatchInTranches(value: boolean) {
    if (!viewing) return;
    setBusy(true);
    try {
      const updated = await api.updateTracking(viewing.id, { dispatch_in_tranches: value });
      setViewing(updated);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
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

  // Close any open dispatch editor when switching to a different order.
  useEffect(() => {
    setEditingDispatch(null);
  }, [viewing?.id]);

  function startEditDispatch(n: string | "bulk" | "new") {
    if (!viewing) return;
    if (n === "bulk") {
      // Product/quantity/part code are fetched from the order itself — only
      // the date is ever hand-entered here.
      setDispatchDraft({ qty: null, date: viewing.bulk_date || "" });
      setEditingDispatch("bulk");
      return;
    }
    if (n === "new") {
      setDispatchDraft({ qty: null, date: "" });
      setEditingDispatch("new");
      return;
    }
    const d = (viewing.dispatches || []).find((x) => x.id === n);
    setDispatchDraft({ qty: d?.qty ?? null, date: d?.date || "" });
    setEditingDispatch(n);
  }

  async function saveDispatch() {
    if (!viewing || !editingDispatch) return;
    setBusy(true);
    try {
      let updated: OrderTracking;
      if (editingDispatch === "bulk") {
        updated = await api.updateTracking(viewing.id, {
          // Keep bulk_product/bulk_part_code/bulk_qty in sync with the order
          // itself — never hand-entered.
          bulk_product: viewing.ordered,
          bulk_part_code: viewing.part_code,
          bulk_qty: viewing.total_quantity,
          bulk_date: dispatchDraft.date,
        });
      } else if (editingDispatch === "new") {
        updated = await api.addTrackingDispatch(viewing.id, dispatchDraft.qty, dispatchDraft.date);
      } else {
        updated = await api.updateTrackingDispatch(viewing.id, editingDispatch, dispatchDraft.qty, dispatchDraft.date);
      }
      setViewing(updated);
      setEditingDispatch(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDispatch(dispatchId: string) {
    if (!viewing || !confirm("Remove this dispatch slot?")) return;
    setBusy(true);
    try {
      const updated = await api.deleteTrackingDispatch(viewing.id, dispatchId);
      setViewing(updated);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteLogEntry(eventId: string) {
    if (!viewing || !confirm("Delete this log entry? This cannot be undone.")) return;
    setBusy(true);
    try {
      const updated = await api.deleteStageRemark(viewing.id, eventId);
      setViewing(updated);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEditPlanned(which: "production" | "dispatch") {
    if (!viewing) return;
    setPlannedDraft((which === "production" ? viewing.planned_production_date : viewing.planned_dispatch_date) || "");
    setEditingPlanned(which);
  }

  async function savePlanned() {
    if (!viewing || !editingPlanned) return;
    setBusy(true);
    try {
      const body =
        editingPlanned === "production"
          ? { planned_production_date: plannedDraft }
          : { planned_dispatch_date: plannedDraft };
      const updated = await api.updateTracking(viewing.id, body);
      setViewing(updated);
      setEditingPlanned(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEditExpected() {
    if (!viewing) return;
    setExpectedDraft(viewing.expected_dispatch_date || "");
    setEditingExpected(true);
  }

  async function saveExpected() {
    if (!viewing) return;
    setBusy(true);
    try {
      const updated = await api.updateTracking(viewing.id, { expected_dispatch_date: expectedDraft });
      setViewing(updated);
      setEditingExpected(false);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
    // Advance Payment happens before production planning even exists, so it's
    // exempt from the "planned dates filled in" gate the other stages need.
    if (
      stage !== "advance_payment" &&
      (!viewing.planned_production_date || !viewing.planned_dispatch_date || !viewing.expected_dispatch_date)
    ) {
      alert("Fill in Planned Production Date, Planned Dispatch Date and Expected Dispatch Date (see Planned Dates above) before adding a remark.");
      return;
    }
    setBusy(true);
    try {
      const createdAt = stage === "advance_payment" ? stageDateInput || undefined : undefined;
      const updated = await api.advanceTrackingStage(viewing.id, stage, stageRemarks, stageKam, createdAt);
      setViewing(updated);
      // Stay on the stage that was just saved instead of letting the
      // default-selector effect jump elsewhere — this is the stage the
      // latest remark belongs to, so it's what should stay on screen.
      setSelectedStage(stage);
      setStageRemarks("");
      setStageKam("");
      setStageDateInput("");
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
      // If nothing was written in Notes, still leave a trace of what
      // happened instead of a blank log row — except Advance Payment, which
      // is date-only by design and should never gain placeholder remarks.
      const eventStage = viewing.stage_events?.find((e) => e.id === editingRemark.eventId)?.stage || "";
      const dateChanged = editingRemark.date !== toDateOnly(editingRemark.originalIso);
      const text =
        stageEditKind(eventStage) === "date_only"
          ? ""
          : editingRemark.text.trim() || (dateChanged ? "Date changed" : "Edit option used");
      const updated = await api.updateStageRemark(
        viewing.id, editingRemark.eventId, text, createdAt, editingRemark.kam
      );
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

      {/* editor */}
      {editing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">{editing.id ? "Edit Order" : "New Order"}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {textField("Partner", "partner")}
            {textField("Country", "market")}
            {textField("KAM", "kam")}
            {dateField("SO Creation", "date_of_order")}
            {numField("Value", "value")}
            <div>
              <label className="lbl">Currency</label>
              <select className="inp" value={editing.currency || ""} onChange={(e) => setF("currency", e.target.value)}>
                <option value="">—</option>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {numField("Total Quantity", "total_quantity")}
            {textField("Part Code", "part_code")}
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
          <div className={`mb-5 rounded-lg border bg-white p-3 ${viewing.doc_filename ? "border-slate-200" : "border-rose-300"}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Signed Quotation / PO Document <span className="text-rose-500">*</span>
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
                <span className="text-sm font-semibold text-rose-600">Required — no document uploaded yet.</span>
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

          {/* planned & expected dates */}
          <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Planned Dates
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-semibold text-slate-700">
                  Planned Production Date <span className="text-rose-500">*</span>
                </div>
                {editingPlanned === "production" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className="inp !w-auto" type="date" value={plannedDraft} onChange={(e) => setPlannedDraft(e.target.value)} />
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" disabled={busy} onClick={savePlanned}>
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={() => setEditingPlanned(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">{viewing.planned_production_date ? fmtDateOnly(viewing.planned_production_date) : "—"}</span>
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" onClick={() => startEditPlanned("production")}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-semibold text-slate-700">
                  Planned Dispatch Date <span className="text-rose-500">*</span>
                </div>
                {editingPlanned === "dispatch" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className="inp !w-auto" type="date" value={plannedDraft} onChange={(e) => setPlannedDraft(e.target.value)} />
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" disabled={busy} onClick={savePlanned}>
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={() => setEditingPlanned(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      {(() => {
                        const color = dispatchStatusColor(viewing.planned_dispatch_date);
                        return color ? (
                          <span
                            className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                              color === "green" ? "bg-emerald-500" : color === "amber" ? "bg-amber-500" : "bg-rose-500"
                            }`}
                          />
                        ) : null;
                      })()}
                      {viewing.planned_dispatch_date ? fmtDateOnly(viewing.planned_dispatch_date) : "—"}
                    </span>
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" onClick={() => startEditPlanned("dispatch")}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-semibold text-slate-700">
                  Expected Dispatch Date <span className="text-rose-500">*</span>
                </div>
                {editingExpected ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className="inp !w-auto" type="date" value={expectedDraft} onChange={(e) => setExpectedDraft(e.target.value)} />
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" disabled={busy} onClick={saveExpected}>
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={() => setEditingExpected(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      {(() => {
                        const color = dispatchStatusColor(viewing.expected_dispatch_date);
                        return color ? (
                          <span
                            className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                              color === "green" ? "bg-emerald-500" : color === "amber" ? "bg-amber-500" : "bg-rose-500"
                            }`}
                          />
                        ) : null;
                      })()}
                      {viewing.expected_dispatch_date ? fmtDateOnly(viewing.expected_dispatch_date) : "—"}
                    </span>
                    <button className="text-xs font-semibold text-exicom-teal hover:underline" onClick={startEditExpected}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* dispatch details — gated behind a one-time Yes/No prompt */}
          {viewing.dispatch_in_tranches == null ? (
            <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dispatch Details
              </div>
              <p className="mb-3 text-sm text-slate-600">Are there multiple dispatches in this order?</p>
              <div className="flex gap-2">
                <button className="btn btn-primary" disabled={busy} onClick={() => setDispatchInTranches(true)}>
                  Yes
                </button>
                <button className="btn" disabled={busy} onClick={() => setDispatchInTranches(false)}>
                  No
                </button>
              </div>
            </div>
          ) : viewing.dispatch_in_tranches === false ? (
            <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dispatch Details
              </div>
              <p className="mb-3 text-sm text-slate-500">
                Are there multiple dispatches in this order?{" "}
                <button className="font-semibold text-slate-700" disabled>
                  No
                </button>{" "}
                /{" "}
                <button
                  className="font-semibold text-exicom-teal hover:underline"
                  onClick={() => setDispatchInTranches(true)}
                >
                  Yes
                </button>
              </p>

              {/* bulk order — single consolidated dispatch */}
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Bulk Order Dispatch
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {(() => {
                  const bulkColor = delayColor(viewing.bulk_date);
                  // The whole order ships in one go, so product/part code/quantity/price
                  // are fetched straight from the order — nothing to type in.
                  const bulkProduct = viewing.ordered || "—";
                  const bulkPartCode = viewing.part_code || "—";
                  const bulkQty = viewing.total_quantity ?? null;
                  const bulkPrice = viewing.value ?? null;

                  if (editingDispatch === "bulk") {
                    return (
                      <div className="p-3">
                        <div className="mb-2 text-xs font-semibold text-slate-700">Bulk Order</div>
                        <div className="mb-3 text-xs text-slate-500">
                          Product: <span className="font-semibold text-slate-700">{bulkProduct}</span>{" "}
                          · Part Code: <span className="font-semibold text-slate-700">{bulkPartCode}</span>{" "}
                          · Quantity: <span className="font-semibold text-slate-700">{bulkQty ?? "—"}</span>{" "}
                          (fetched from the order)
                        </div>
                        <div>
                          <label className="lbl">Tentative Dispatch Date</label>
                          <input
                            className="inp" type="date" value={dispatchDraft.date}
                            onChange={(e) => setDispatchDraft((d) => ({ ...d, date: e.target.value }))}
                          />
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          Mode: <span className="font-semibold text-slate-700">{viewing.transport_mode || "—"}</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="btn btn-primary" disabled={busy} onClick={saveDispatch}>
                            {busy ? "Saving…" : "Save"}
                          </button>
                          <button className="btn" onClick={() => setEditingDispatch(null)}>Cancel</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 p-3 text-sm">
                      <div className="flex min-w-[90px] items-center gap-2 font-semibold text-slate-700">
                        <span
                          className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                            bulkColor === "green" ? "bg-emerald-500" : bulkColor === "amber" ? "bg-amber-500" : bulkColor === "red" ? "bg-rose-500" : "bg-slate-300"
                          }`}
                        />
                        Bulk Order
                      </div>
                      <div className="text-slate-500">
                        Product: <span className="font-medium text-slate-700">{bulkProduct}</span>
                      </div>
                      <div className="text-slate-500">Part Code: <span className="font-medium text-slate-700">{bulkPartCode}</span></div>
                      <div className="text-slate-500">Qty: <span className="font-medium text-slate-700">{bulkQty ?? "—"}</span></div>
                      <div className="text-slate-500">
                        Date:{" "}
                        <span className={`font-medium ${bulkColor === "amber" ? "text-amber-700" : bulkColor === "red" ? "text-rose-700" : "text-slate-700"}`}>
                          {viewing.bulk_date ? fmtDateOnly(viewing.bulk_date) : "—"}
                        </span>
                      </div>
                      <div className="text-slate-500">Mode: <span className="font-medium text-slate-700">{viewing.transport_mode || "—"}</span></div>
                      <div className="text-slate-500">
                        Price:{" "}
                        <span className="font-medium text-slate-700">
                          {bulkPrice == null ? "—" : `${viewing.currency || ""} ${fmtNum(bulkPrice)}`}
                        </span>
                      </div>
                      <button
                        className="ml-auto text-xs font-semibold text-exicom-teal hover:underline"
                        onClick={() => startEditDispatch("bulk")}
                      >
                        Edit
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
          <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dispatch Details
              </div>
              <div className="text-xs text-slate-400">
                Multiple dispatches?{" "}
                <button className="font-semibold text-slate-700" disabled>
                  Yes
                </button>{" "}
                /{" "}
                <button
                  className="font-semibold text-exicom-teal hover:underline"
                  onClick={() => setDispatchInTranches(false)}
                >
                  No
                </button>
              </div>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Product: <span className="font-semibold text-slate-700">{viewing.ordered || "—"}</span>{" "}
              · Part Code: <span className="font-semibold text-slate-700">{viewing.part_code || "—"}</span>{" "}
              · Total Quantity: <span className="font-semibold text-slate-700">{viewing.total_quantity ?? "—"}</span>{" "}
              — split this across the slots below.
            </p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {(viewing.dispatches || []).map((d, idx) => {
                const color = delayColor(d.date);
                const price =
                  d.qty && viewing.value != null && viewing.total_quantity
                    ? (viewing.value / viewing.total_quantity) * d.qty
                    : null;

                if (editingDispatch === d.id) {
                  return (
                    <div key={d.id} className="p-3">
                      <div className="mb-2 text-xs font-semibold text-slate-700">Dispatch {idx + 1}</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="lbl">Quantity</label>
                          <input
                            className="inp" type="number" step="1"
                            value={dispatchDraft.qty === null ? "" : dispatchDraft.qty}
                            onChange={(e) =>
                              setDispatchDraft((dr) => ({
                                ...dr,
                                qty: e.target.value === "" ? null : Math.round(parseFloat(e.target.value)),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="lbl">Tentative Dispatch Date</label>
                          <input
                            className="inp" type="date" value={dispatchDraft.date}
                            onChange={(e) => setDispatchDraft((dr) => ({ ...dr, date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Part Code: <span className="font-semibold text-slate-700">{viewing.part_code || "—"}</span>{" "}
                        · Mode: <span className="font-semibold text-slate-700">{viewing.transport_mode || "—"}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="btn btn-primary" disabled={busy} onClick={saveDispatch}>
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button className="btn" onClick={() => setEditingDispatch(null)}>Cancel</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-3 text-sm">
                    <div className="flex min-w-[90px] items-center gap-2 font-semibold text-slate-700">
                      <span
                        className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                          color === "green" ? "bg-emerald-500" : color === "amber" ? "bg-amber-500" : color === "red" ? "bg-rose-500" : "bg-slate-300"
                        }`}
                      />
                      Dispatch {idx + 1}
                    </div>
                    <div className="text-slate-500">Qty: <span className="font-medium text-slate-700">{d.qty ?? "—"}</span></div>
                    <div className="text-slate-500">
                      Date:{" "}
                      <span className={`font-medium ${color === "amber" ? "text-amber-700" : color === "red" ? "text-rose-700" : "text-slate-700"}`}>
                        {d.date ? fmtDateOnly(d.date) : "—"}
                      </span>
                    </div>
                    <div className="text-slate-500">Part Code: <span className="font-medium text-slate-700">{viewing.part_code || "—"}</span></div>
                    <div className="text-slate-500">Mode: <span className="font-medium text-slate-700">{viewing.transport_mode || "—"}</span></div>
                    <div className="text-slate-500">
                      Price:{" "}
                      <span className="font-medium text-slate-700">
                        {price == null ? "—" : `${viewing.currency || ""} ${fmtNum(price)}`}
                      </span>
                    </div>
                    <div className="ml-auto flex gap-3">
                      <button
                        className="text-xs font-semibold text-exicom-teal hover:underline"
                        onClick={() => startEditDispatch(d.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs font-semibold text-red-500 hover:text-red-700"
                        onClick={() => deleteDispatch(d.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {editingDispatch === "new" && (
                <div className="p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">New Dispatch</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="lbl">Quantity</label>
                      <input
                        className="inp" type="number" step="1"
                        value={dispatchDraft.qty === null ? "" : dispatchDraft.qty}
                        onChange={(e) =>
                          setDispatchDraft((dr) => ({
                            ...dr,
                            qty: e.target.value === "" ? null : Math.round(parseFloat(e.target.value)),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="lbl">Tentative Dispatch Date</label>
                      <input
                        className="inp" type="date" value={dispatchDraft.date}
                        onChange={(e) => setDispatchDraft((dr) => ({ ...dr, date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Part Code: <span className="font-semibold text-slate-700">{viewing.part_code || "—"}</span>{" "}
                    · Mode: <span className="font-semibold text-slate-700">{viewing.transport_mode || "—"}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary" disabled={busy} onClick={saveDispatch}>
                      {busy ? "Adding…" : "Add"}
                    </button>
                    <button className="btn" onClick={() => setEditingDispatch(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
            {editingDispatch !== "new" && (
              <button
                className="mt-2 text-xs font-semibold text-exicom-teal hover:underline"
                onClick={() => startEditDispatch("new")}
              >
                + Add Dispatch
              </button>
            )}
          </div>
          )}

          {/* fulfillment stage tracker */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fulfillment Tracker
            </div>
            <p className="mb-2 text-xs text-slate-400">Select a stage below to view/record it.</p>
            {(() => {
              // Defensive: older/in-flight API responses may not include stage_events yet.
              const events = viewing.stage_events || [];
              const currentIdx = STAGES.findIndex((s) => s.key === viewing.current_stage);
              const stageDate = (key: string) =>
                events.find((e) => e.stage === key)?.created_at;
              const selected = STAGES.find((s) => s.key === selectedStage) || STAGES[0];
              const selectedIdx = STAGES.findIndex((s) => s.key === selected.key);
              const primaryEvent = events.find((e) => e.stage === selected.key);
              const reachedAt = primaryEvent?.created_at;
              const nextReachedAt = STAGES[selectedIdx + 1] ? stageDate(STAGES[selectedIdx + 1].key) : undefined;
              const done = reachedAt != null;
              const active = selectedIdx === currentIdx;
              const duration = reachedAt
                ? daysBetween(reachedAt, nextReachedAt || new Date().toISOString())
                : null;
              // Extra remarks beyond the primary event (rare — a stage
              // re-triggered more than once); the primary's own remark
              // is edited inline with its date below instead.
              const extraStageRemarks = events.filter(
                (e) => e.stage === selected.key && e.remarks && e.id !== primaryEvent?.id
              );
              return (
                <>
                  {/* stage picker */}
                  <div className="mb-3 flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500">Stage</label>
                    <select
                      className="inp !w-auto !py-1 !text-xs"
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value)}
                    >
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>

                  {/* selected stage's card */}
                  <div
                    className={`rounded-lg border p-3 text-left ${
                      active
                        ? "border-exicom-teal bg-exicom-teal/5"
                        : done
                        ? "border-slate-200"
                        : "border-dashed border-slate-200 opacity-60"
                    }`}
                  >
                    {primaryEvent && editingRemark?.eventId === primaryEvent.id ? (
                      <div>
                        <input
                          type="date"
                          className="inp !py-1 !text-[11px]"
                          value={editingRemark.date}
                          onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                        />
                        {stageEditKind(selected.key) !== "date_only" && (
                          <textarea
                            className="inp mt-1 !py-1 !text-[11px]"
                            rows={2}
                            placeholder={stageEditKind(selected.key) === "id_only" ? "Tracking ID…" : "Remarks (optional)…"}
                            value={editingRemark.text}
                            onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                          />
                        )}
                        {stageEditKind(selected.key) === "full" && (
                          <input
                            className="inp mt-1 !py-1 !text-[11px]"
                            placeholder="Done by (KAM)…"
                            value={editingRemark.kam}
                            onChange={(ev) => setEditingRemark({ ...editingRemark, kam: ev.target.value })}
                          />
                        )}
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
                      <div className="text-[11px] text-slate-500">
                        {reachedAt ? fmtDateTime(reachedAt) : "Not reached yet"}{" "}
                        {primaryEvent ? (
                          <button
                            type="button"
                            className="font-semibold text-exicom-teal hover:underline"
                            onClick={() => {
                              setEditingRemark({
                                eventId: primaryEvent.id,
                                text: primaryEvent.remarks,
                                date: toDateOnly(primaryEvent.created_at),
                                originalIso: primaryEvent.created_at,
                                kam: primaryEvent.kam || "",
                              });
                            }}
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="font-semibold text-exicom-teal hover:underline"
                            onClick={() => {
                              activeStageFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                              activeStageFieldRef.current?.focus();
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {primaryEvent?.remarks && (
                          <div className={selected.key === "shipment" ? "mt-0.5 font-mono" : "mt-0.5 italic"}>
                            {selected.key === "shipment" ? primaryEvent.remarks : `"${primaryEvent.remarks}"`}
                          </div>
                        )}
                      </div>
                    )}
                    {duration != null && (
                      <div className="mt-1 text-[11px] font-semibold text-slate-600">
                        {active ? `${duration} day${duration === 1 ? "" : "s"} so far` : `Took ${duration} day${duration === 1 ? "" : "s"}`}
                      </div>
                    )}
                    {extraStageRemarks.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {extraStageRemarks.map((e) =>
                          editingRemark?.eventId === e.id ? (
                            <div key={e.id}>
                              <input
                                type="date"
                                className="inp mb-1 !py-1 !text-[11px]"
                                value={editingRemark.date}
                                onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                              />
                              {stageEditKind(selected.key) !== "date_only" && (
                                <textarea
                                  className="inp !py-1 !text-[11px]"
                                  rows={2}
                                  placeholder={stageEditKind(selected.key) === "id_only" ? "Tracking ID…" : undefined}
                                  value={editingRemark.text}
                                  onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                                />
                              )}
                              {stageEditKind(selected.key) === "full" && (
                                <input
                                  className="inp mt-1 !py-1 !text-[11px]"
                                  placeholder="Done by (KAM)…"
                                  value={editingRemark.kam}
                                  onChange={(ev) => setEditingRemark({ ...editingRemark, kam: ev.target.value })}
                                />
                              )}
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
                                onClick={() => setEditingRemark({ eventId: e.id, text: e.remarks, date: toDateOnly(e.created_at), originalIso: e.created_at, kam: e.kam || "" })}
                              >
                                Edit
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {selected.key === "advance_payment" ? (
                      <>
                        <label className="lbl">Advance Payment Date</label>
                        <input
                          ref={stageDateRef}
                          type="date" className="inp !w-auto"
                          value={stageDateInput}
                          onChange={(e) => setStageDateInput(e.target.value)}
                        />
                      </>
                    ) : selected.key === "shipment" ? (
                      <>
                        <label className="lbl">Tracking ID</label>
                        <input
                          ref={stageIdRef}
                          className="inp font-mono" value={stageRemarks}
                          onChange={(e) => setStageRemarks(e.target.value)}
                          placeholder="Enter the shipment tracking ID…"
                        />
                      </>
                    ) : (
                      <>
                        <label className="lbl">
                          Remarks for “{selected.label}” (optional)
                        </label>
                        <textarea
                          ref={stageRemarksRef}
                          className="inp" rows={2} value={stageRemarks}
                          onChange={(e) => setStageRemarks(e.target.value)}
                          placeholder="Why is it moving now / any delay reason…"
                        />
                        <label className="lbl mt-2">Done by (KAM)</label>
                        <input className="inp" value={stageKam} onChange={(e) => setStageKam(e.target.value)} />
                      </>
                    )}
                    <button
                      className="btn btn-primary mt-2" disabled={busy}
                      onClick={() => saveStage(selected.key)}
                    >
                      {busy ? "Saving…" : `Save “${selected.label}”`}
                    </button>
                  </div>

                  {/* logs — every stage transition, in order, KAM + timestamp + note */}
                  {events.length > 0 && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Logs
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                            <th className="px-3 py-2">Stages</th>
                            <th className="px-3 py-2">Activity</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Done by</th>
                            <th className="px-3 py-2">Notes</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...events]
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((e) =>
                            editingRemark?.eventId === e.id ? (
                              <tr key={e.id} className="border-t border-slate-100">
                                <td colSpan={6} className="px-3 py-2">
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <div>
                                      <label className="lbl">Date</label>
                                      <input
                                        type="date"
                                        className="inp !py-1 !text-xs"
                                        value={editingRemark.date}
                                        onChange={(ev) => setEditingRemark({ ...editingRemark, date: ev.target.value })}
                                      />
                                    </div>
                                    {stageEditKind(e.stage) === "full" && (
                                      <div>
                                        <label className="lbl">Done by (KAM)</label>
                                        <input
                                          className="inp !py-1 !text-xs"
                                          value={editingRemark.kam}
                                          onChange={(ev) => setEditingRemark({ ...editingRemark, kam: ev.target.value })}
                                        />
                                      </div>
                                    )}
                                    {stageEditKind(e.stage) !== "date_only" && (
                                      <div>
                                        <label className="lbl">{stageEditKind(e.stage) === "id_only" ? "Tracking ID" : "Notes"}</label>
                                        <input
                                          className="inp !py-1 !text-xs"
                                          value={editingRemark.text}
                                          onChange={(ev) => setEditingRemark({ ...editingRemark, text: ev.target.value })}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button" disabled={busy}
                                      className="text-xs font-semibold text-exicom-teal hover:underline"
                                      onClick={saveEditedRemark}
                                    >
                                      {busy ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                                      onClick={() => setEditingRemark(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr key={e.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-semibold text-slate-700">
                                  {STAGES.find((s) => s.key === e.stage)?.label || LOG_EXTRA_STAGE_LABEL[e.stage] || e.stage}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {STAGE_SHORT_LABEL[e.stage] || e.stage}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDateTime(e.created_at)}</td>
                                <td className="px-3 py-2 text-slate-600">{e.kam || "—"}</td>
                                <td className="px-3 py-2 text-slate-600">{e.remarks || "—"}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    className="mr-3 text-xs font-semibold text-exicom-teal hover:underline"
                                    onClick={() =>
                                      setEditingRemark({
                                        eventId: e.id,
                                        text: e.remarks,
                                        date: toDateOnly(e.created_at),
                                        originalIso: e.created_at,
                                        kam: e.kam || "",
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-red-500 hover:text-red-700"
                                    onClick={() => deleteLogEntry(e.id)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* KPI summary — days spent in each stage, red flag at 2+ days */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Summary
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(() => {
                const events = viewing.stage_events || [];
                const stageDate = (key: string) => events.find((e) => e.stage === key)?.created_at;
                return STAGES.map((s, i) => {
                  const reachedAt = stageDate(s.key);
                  const nextReachedAt = STAGES[i + 1] ? stageDate(STAGES[i + 1].key) : undefined;
                  const done = reachedAt != null;
                  const duration = reachedAt
                    ? daysBetween(reachedAt, nextReachedAt || new Date().toISOString())
                    : null;
                  const delayed = duration != null && duration >= 2;
                  return (
                    <div
                      key={s.key}
                      className={`rounded-lg border p-3 ${delayed ? "border-rose-300 bg-rose-50" : "border-slate-200"}`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {s.label}
                      </div>
                      <div className={`mt-1 text-2xl font-bold ${delayed ? "text-rose-700" : "text-slate-800"}`}>
                        {duration == null ? "—" : `${duration}`}
                        {duration != null && <span className="text-xs font-semibold"> day{duration === 1 ? "" : "s"}</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {done ? "Reached" : "Not reached yet"}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* filters + list — hidden while viewing an order's details */}
      {!viewing && (
        <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="inp max-w-xs flex-1" placeholder="Search partner, country, KAM, remarks…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">KAM</th>
                <th className="px-3 py-2">Ordered</th>
                <th className="px-3 py-2">SO Creation</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Planned / Expected</th>
                <th className="w-96 px-3 py-2">Remarks</th>
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
                    {(() => {
                      const stageLabel = STAGES.find((s) => s.key === r.current_stage)?.label || r.current_stage;
                      return <span className="text-sm font-semibold text-slate-700">{stageLabel}</span>;
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {(() => {
                      const plannedColor = dispatchStatusColor(r.planned_dispatch_date);
                      const expectedColor = dispatchStatusColor(r.expected_dispatch_date);
                      const dotClass = (color: "green" | "amber" | "red" | null) =>
                        `inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                          color === "green" ? "bg-emerald-500" : color === "amber" ? "bg-amber-500" : color === "red" ? "bg-rose-500" : "bg-slate-300"
                        }`;
                      return (
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span title={r.planned_dispatch_date ? fmtDateOnly(r.planned_dispatch_date) : "—"} className={dotClass(plannedColor)} />
                            <span className="text-slate-500">Planned</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span title={r.expected_dispatch_date ? fmtDateOnly(r.expected_dispatch_date) : "—"} className={dotClass(expectedColor)} />
                            <span className="text-slate-500">Expected</span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="w-96 max-w-sm px-3 py-1.5 align-top text-slate-500">
                    {(() => {
                      const remark = latestStageRemark(r);
                      if (!remark) return "—";
                      const expanded = expandedRemarks.has(r.id);
                      const isLong = remark.remarks.length > 140;
                      return (
                        <div>
                          <span
                            style={
                              expanded
                                ? undefined
                                : {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }
                            }
                          >
                            "{remark.remarks}"
                          </span>{" "}
                          <span className="text-xs text-slate-400">({fmtDateTime(remark.created_at)})</span>
                          {isLong && (
                            <button
                              type="button"
                              className="ml-1 text-xs font-semibold text-exicom-teal hover:underline"
                              onClick={() =>
                                setExpandedRemarks((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(r.id)) next.delete(r.id);
                                  else next.add(r.id);
                                  return next;
                                })
                              }
                            >
                              {expanded ? "Read less" : "Read more"}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="mr-2 text-xs font-semibold text-exicom-teal hover:text-exicom-ink" onClick={() => { setViewing(r); setEditing(null); setEditingRemark(null); }}>Edit</button>
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
