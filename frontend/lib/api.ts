import type { CatalogProduct, LogisticsRate, OrderInput, OrderOut, OrderPublish, OrderTracking, User } from "./types";
import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- auth -------------------------------------------------------------------

/** Bearer-token header for the current logged-in user (see lib/auth.ts). */
function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---- catalog ----------------------------------------------------------------

export const api = {
  // ---- auth / users ----

  getMe: (): Promise<User> =>
    fetch(`${BASE}/api/auth/me`, { headers: authHeaders() }).then(json<User>),

  listUsers: (): Promise<User[]> =>
    fetch(`${BASE}/api/users`, { headers: authHeaders() }).then(json<User[]>),

  createUser: (u: {
    username: string;
    email?: string;
    full_name?: string;
    password: string;
    role: string;
    is_active?: boolean;
  }): Promise<User> =>
    fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(u),
    }).then(json<User>),

  updateUser: (
    id: string,
    u: Partial<{ email: string; full_name: string; role: string; is_active: boolean; password: string }>
  ): Promise<User> =>
    fetch(`${BASE}/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(u),
    }).then(json<User>),

  deleteUser: (id: string): Promise<void> =>
    fetch(`${BASE}/api/users/${id}`, { method: "DELETE", headers: authHeaders() }).then(() => undefined),

  listCatalog: (): Promise<CatalogProduct[]> =>
    fetch(`${BASE}/api/catalog`).then(json<CatalogProduct[]>),

  createCatalog: (p: Partial<CatalogProduct>): Promise<CatalogProduct> =>
    fetch(`${BASE}/api/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(p),
    }).then(json<CatalogProduct>),

  updateCatalog: (id: string, p: Partial<CatalogProduct>): Promise<CatalogProduct> =>
    fetch(`${BASE}/api/catalog/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(p),
    }).then(json<CatalogProduct>),

  deleteCatalog: (id: string): Promise<void> =>
    fetch(`${BASE}/api/catalog/${id}`, { method: "DELETE", headers: authHeaders() }).then(() => undefined),

  // ---- logistics rates ----

  listLogistics: (): Promise<LogisticsRate[]> =>
    fetch(`${BASE}/api/logistics`).then(json<LogisticsRate[]>),

  createLogistics: (r: Partial<LogisticsRate>): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(r),
    }).then(json<LogisticsRate>),

  updateLogistics: (id: string, r: Partial<LogisticsRate>): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(r),
    }).then(json<LogisticsRate>),

  approveLogistics: (id: string): Promise<LogisticsRate> =>
    fetch(`${BASE}/api/logistics/${id}/approve`, { method: "POST", headers: authHeaders() }).then(json<LogisticsRate>),

  deleteLogistics: (id: string): Promise<void> =>
    fetch(`${BASE}/api/logistics/${id}`, { method: "DELETE", headers: authHeaders() }).then(() => undefined),

  // ---- orders ----

  // Atomically reserve the next globally-unique quote number from the server.
  nextQuoteNumber: (): Promise<{ period: string; sequence: number; quote_number: string }> =>
    fetch(`${BASE}/api/orders/next-number`, { method: "POST" }).then(
      json<{ period: string; sequence: number; quote_number: string }>
    ),

  createOrder: (o: OrderInput): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(o),
    }).then(json<OrderOut>),

  // ---- saved orders (admin "Orders" panel) ----

  // Update an existing saved quote (re-save after an edit).
  updateOrder: (id: string, o: OrderInput): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(o),
    }).then(json<OrderOut>),

  // Pass createdBy to scope to one sales person's own quotes (Past Quotes);
  // omit it for the admin Approvals view (all quotes).
  listOrders: (createdBy?: string): Promise<OrderOut[]> =>
    fetch(`${BASE}/api/orders${createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : ""}`, {
      headers: authHeaders(),
    }).then(json<OrderOut[]>),

  publishOrder: (id: string, body: OrderPublish): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }).then(json<OrderOut>),

  // Advance an approved quotation to the final "SO Created" state.
  markSoCreated: (id: string): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/so-created`, { method: "POST", headers: authHeaders() }).then(json<OrderOut>),

  // Reject a draft quotation awaiting pricing approval.
  rejectOrder: (id: string): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/reject`, { method: "POST", headers: authHeaders() }).then(json<OrderOut>),

  deleteOrder: (id: string): Promise<void> =>
    fetch(`${BASE}/api/orders/${id}`, { method: "DELETE", headers: authHeaders() }).then(() => undefined),

  // Saved-order PDF → blob for download / view. po=true drops the Exicom
  // logo/letterhead (used for the PO/Order Received download).
  orderPdfBlob: (id: string, po = false): Promise<Blob> =>
    fetch(`${BASE}/api/orders/${id}/pdf${po ? "?po=true" : ""}`, { headers: authHeaders() }).then(async (r) => {
      if (!r.ok) {
        const detail = await r.json().then((d) => d.detail).catch(() => null);
        throw new Error(detail || "PDF generation failed");
      }
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
    fetch(`${BASE}/api/tracking`, { headers: authHeaders() }).then(json<OrderTracking[]>),

  createTracking: (r: Partial<OrderTracking>): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(r),
    }).then(json<OrderTracking>),

  updateTracking: (id: string, r: Partial<OrderTracking>): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(r),
    }).then(json<OrderTracking>),

  deleteTracking: (id: string): Promise<void> =>
    fetch(`${BASE}/api/tracking/${id}`, { method: "DELETE", headers: authHeaders() }).then(() => undefined),

  // Bulk import from an .xlsx file (sent as the raw request body).
  importTracking: (file: File | Blob): Promise<{ imported: number; skipped: number; errors: string[] }> =>
    fetch(`${BASE}/api/tracking/import`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", ...authHeaders() },
      body: file,
    }).then(json<{ imported: number; skipped: number; errors: string[] }>),

  // Signed quotation / PO document. No Content-Type set on upload — the
  // browser must generate the multipart boundary itself.
  uploadTrackingDocument: (id: string, file: File): Promise<OrderTracking> => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/api/tracking/${id}/document`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    }).then(json<OrderTracking>);
  },

  deleteTrackingDocument: (id: string): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking/${id}/document`, { method: "DELETE", headers: authHeaders() }).then(json<OrderTracking>),

  // Fulfillment stage tracker: so_created -> in_production -> fg_ready -> dispatched.
  // Any stage can be set directly — ops fills these in manually, not strictly in order.
  advanceTrackingStage: (id: string, stage: string, remarks: string): Promise<OrderTracking> =>
    fetch(`${BASE}/api/tracking/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ stage, remarks }),
    }).then(json<OrderTracking>),
};

export const API_BASE = BASE;
