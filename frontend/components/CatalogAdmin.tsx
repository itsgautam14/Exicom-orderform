"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CatalogProduct } from "@/lib/types";

const BLANK: Partial<CatalogProduct> = {
  product_code: "",
  code_note: "",
  product_name: "",
  description: "",
  unit_price: 0,
  currency: "USD",
  unit: "Nos.",
  category: "",
  is_active: true,
};

export default function CatalogAdmin() {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [editing, setEditing] = useState<Partial<CatalogProduct> | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      setItems(await api.listCatalog());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.product_name?.trim()) { alert("Product name is required"); return; }
    try {
      if (editing.id) await api.updateCatalog(editing.id, editing);
      else await api.createCatalog(editing);
      setEditing(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function del(id: string) {
    if (!confirm("Delete this product from the catalog?")) return;
    await api.deleteCatalog(id);
    reload();
  }

  function setF<K extends keyof CatalogProduct>(k: K, v: CatalogProduct[K]) {
    setEditing((e) => ({ ...(e || {}), [k]: v }));
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Product Catalog &amp; Pricing</h1>
          <p className="text-sm text-slate-500">
            Backend team manages product costs here. These prices auto-fill Order Forms.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...BLANK })}>
          + New Product
        </button>
      </div>

      {editing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">{editing.id ? "Edit Product" : "New Product"}</div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Product Code" v={editing.product_code || ""} on={(v) => setF("product_code", v)} />
            <F label="Category" v={editing.category || ""} on={(v) => setF("category", v)} />
          </div>
          <A label="Code Sub-text" v={editing.code_note || ""} on={(v) => setF("code_note", v)} />
          <F label="Product Name" v={editing.product_name || ""} on={(v) => setF("product_name", v)} />
          <A label="Description" v={editing.description || ""} on={(v) => setF("description", v)} rows={3} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="lbl">Unit Price</label>
              <input className="inp" type="number" step="0.01" value={editing.unit_price ?? 0}
                onChange={(e) => setF("unit_price", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="lbl">Currency</label>
              <select className="inp" value={editing.currency || "USD"} onChange={(e) => setF("currency", e.target.value)}>
                {["USD", "EUR", "GBP", "INR", "AED", "QAR"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <F label="Unit" v={editing.unit || "Nos."} on={(v) => setF("unit", v)} />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={save}>Save Product</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500">No products yet. Add one, or run the backend seed script.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-exicom-teal">{p.product_code}</td>
                  <td className="px-4 py-2 font-semibold text-slate-800">{p.product_name}</td>
                  <td className="px-4 py-2 text-slate-500">{p.category}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {p.currency} {p.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => setEditing(p)}>Edit</button>
                    <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(p.id)}>Delete</button>
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

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <input className="inp" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
function A({ label, v, on, rows = 2 }: { label: string; v: string; on: (v: string) => void; rows?: number }) {
  return (
    <div className="mb-2">
      <label className="lbl">{label}</label>
      <textarea className="inp" rows={rows} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
