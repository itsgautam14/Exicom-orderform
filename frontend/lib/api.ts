import type { CatalogProduct, OrderInput, OrderOut } from "./types";

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

  // ---- orders ----

  createOrder: (o: OrderInput): Promise<OrderOut> =>
    fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(o),
    }).then(json<OrderOut>),

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
