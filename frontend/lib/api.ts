import type { CatalogProduct, LogisticsRate, OrderInput, OrderOut, OrderPublish, OrderTracking } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- admin auth -------------------------------------------------------------

const ADMIN_PW_KEY = "catalog_admin_pw";

/** Admin password header (read from sessionStorage after a successful unlock). */
function adminHeaders(): Record<string, string> {
  const pw = typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_PW_KEY) : null;
  return pw ? { "X-Admin-Password": pw } : {};
}

// ---- catalog ----------------------------------------------------------------

export const api = {
  // Verify the admin password against the backend (password never ships to the client).
  verifyAdmin: (password: string): Promise<boolean> =>
    fetch(`${BASE}/api/catalog/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).then((r) => r.ok),

  listCatalog: (): Promise<CatalogProduct[]> =>
    fetch(`${BASE}/api/catalog`).then(json<CatalogProduct[]>),

  createCatalog: (p: Partial<CatalogProduct>): Promise<CatalogProduct> =>
    fetch(`${BASE}/api/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(p),
    }).then(json<CatalogProduct>),

  updateCatalog: (id: string, p: Partial<CatalogProduct>): Promise<CatalogProduct> =>
    fetch(`${BASE}/api/catalog/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(p),
    }).then(json<CatalogProduct>),

  deleteCatalog: (id: string): Promise<void> =>
    fetch(`${BASE}/api/catalog/${id}`, { method: "DELETE", headers: adminHeaders() }).then(() => undefined),

  // ---- logistics rates ----

  listLogistics: (): Promise<LogisticsRate[]> =>
    fetch(`${BASE}/api/logistics`).then(json<LogisticsRate[]>),

  createLogistics: (r: Partial<LogisticsRate>): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(r),
    }).then(json<LogisticsRate>),

  updateLogistics: (id: string, r: Partial<LogisticsRate>): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(r),
    }).then(json<LogisticsRate>),

  approveLogistics: (id: string): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics/${id}/approve`, { method: "POST", headers: adminHeaders() }).then(json<LogisticsRate>),

  deleteLogistics: (id: string): Promise<void> =>
    fetch(`${BASE}/api/logistics/${id}`, { method: "DELETE", headers: adminHeaders() }).then(() => undefined),

  // ---- orders ----

  // Atomically reserve the next globally-unique quote number from the server.
  nextQuoteNumber: (): Promise<{ period: string; sequence: number; quote_number: string }> =>
    fetch(`${BASE}/api/orders/next-number`, { method: "POST" }).then(
      json<{ period: string; sequence: number; quote_number: string }>
    ),

  createOrder: (o: OrderInput): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    }).then(json<OrderOut>),

  // ---- saved orders (admin "Orders" panel) ----

  // Update an existing saved quote (re-save after an edit).
  updateOrder: (id: string, o: OrderInput): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    }).then(json<OrderOut>),

  // Pass createdBy to scope to one sales person's own quotes (Past Quotes);
  // omit it for the admin Approvals view (all quotes).
  listOrders: (createdBy?: string): Promise<OrderOut[]> =>
    fetch(`${BASE}/api/orders${createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : ""}`, {
      headers: adminHeaders(),
    }).then(json<OrderOut[]>),

  publishOrder: (id: string, body: OrderPublish): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(body),
    }).then(json<OrderOut>),

  // Advance an approved quotation to the final "SO Created" state.
  markSoCreated: (id: string): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/so-created`, { method: "POST", headers: adminHeaders() }).then(json<OrderOut>),

  // Reject a draft quotation awaiting pricing approval.
  rejectOrder: (id: string): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/reject`, { method: "POST", headers: adminHeaders() }).then(json<OrderOut>),

  deleteOrder: (id: string): Promise<void> =>
    fetch(`${BASE}/api/orders/${id}`, { method: "DELETE", headers: adminHeaders() }).then(() => undefined),

  // Saved-order PDF (admin only) → blob for download / view.
  orderPdfBlob: (id: string): Promise<Blob> =>
    fetch(`${BASE}/api/orders/${id}/pdf`, { headers: adminHeaders() }).then((r) => {
      if (!r.ok) throw new Error("PDF generation failed");
      return r.blob();
    }),

  // live HTML preview of an unsaved order
  previewHtml: (o: OrderInput): Promise<string> =>
    fetch(`${BASE}/api/orders/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    }).then((r) => r.text()),

  // PDF URL for an unsaved order (POST → blob)
  pdfBlob: (o: OrderInput): Promise<Blob> =>
    fetch(`${BASE}/api/orders/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    }).then((r) => {
      if (!r.ok) throw new Error("PDF generation failed");
      return r.blob();
    }),

  // ---- order tracking (Approvals → SO Created; admin only) ----

  listTracking: (): Promise<OrderTracking[]> =>
    fetch(`${BASE}/api/tracking`, { headers: adminHeaders() }).then(json<OrderTracking[]>),

  createTracking: (r: Partial<OrderTracking>): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(r),
    }).then(json<OrderTracking>),

  updateTracking: (id: string, r: Partial<OrderTracking>): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(r),
    }).then(json<OrderTracking>),

  deleteTracking: (id: string): Promise<void> =>
    fetch(`${BASE}/api/tracking/${id}`, { method: "DELETE", headers: adminHeaders() }).then(() => undefined),

  // Bulk import from an .xlsx file (sent as the raw request body).
  importTracking: (file: File | Blob): Promise<{ imported: number; skipped: number; errors: string[] }> =>
    fetch(`${BASE}/api/tracking/import`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...adminHeaders() },
      body: file,
    }).then(json<{ imported: number; skipped: number; errors: string[] }>),

  // Signed quotation / PO document. No Content-Type set on upload — the
  // browser must generate the multipart boundary itself.
  uploadTrackingDocument: (id: string, file: File): Promise<OrderTracking> => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/api/tracking/${id}/document`, {
      method: "POST",
      headers: adminHeaders(),
      body: form,
    }).then(json<OrderTracking>);
  },

  // Fulfillment stage tracker: so_created -> in_production -> fg_ready -> dispatched.
  advanceTrackingStage: (id: string, stage: string, remarks: string): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ stage, remarks }),
    }).then(json<OrderTracking>),
};

export const API_BASE = BASE;
