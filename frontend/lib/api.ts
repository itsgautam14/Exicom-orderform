import type { CatalogProduct, LogisticsRate, OrderInput, OrderOut, OrderPublish } from "./types";

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

  listOrders: (): Promise<OrderOut[]> =>
    fetch(`${BASE}/api/orders`, { headers: adminHeaders() }).then(json<OrderOut[]>),

  publishOrder: (id: string, body: OrderPublish): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify(body),
    }).then(json<OrderOut>),

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
};

export const API_BASE = BASE;
