"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { CatalogProduct } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "INR", "MYR"];

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

type SortKey = "product_code" | "product_name" | "unit_price";

export default function CatalogAdmin() {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [editing, setEditing] = useState<Partial<CatalogProduct> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "product_code", dir: 1 });

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

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (p) =>
          (!cat || p.category === cat) &&
          (!q || `${p.product_code} ${p.product_name} ${p.category}`.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const r =
          sort.key === "unit_price"
            ? a.unit_price - b.unit_price
            : String(a[sort.key]).localeCompare(String(b[sort.key]), undefined, { numeric: true });
        return r * sort.dir;
      });
  }, [items, search, cat, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }));
  }

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
    try {
      await api.deleteCatalog(id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function setF<K extends keyof CatalogProduct>(k: K, v: CatalogProduct[K]) {
    setEditing((e) => ({ ...(e || {}), [k]: v }));
  }

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto max-w-6xl p-4 pb-24 lg:p-6 lg:pb-6">
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">
            Product Catalog &amp; Pricing
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-semibold text-slate-500">
              {items.length}
            </span>
          </h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            Backend team manages product costs here. These prices auto-fill Order Forms.
          </p>
        </div>
        <button className="btn btn-primary flex-shrink-0" onClick={() => setEditing({ ...BLANK })}>
          + New Product
        </button>
      </div>

      {/* editor */}
      {editing && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">{editing.id ? "Edit Product" : "New Product"}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <F label="Product Code" v={editing.product_code || ""} on={(v) => setF("product_code", v)} />
            <F label="Category" v={editing.category || ""} on={(v) => setF("category", v)} />
          </div>
          <A label="Code Sub-text" v={editing.code_note || ""} on={(v) => setF("code_note", v)} />
          <F label="Product Name" v={editing.product_name || ""} on={(v) => setF("product_name", v)} />
          <A label="Description" v={editing.description || ""} on={(v) => setF("description", v)} rows={3} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="lbl">Base Unit Price</label>
              <input className="inp" type="number" step="0.01" value={editing.unit_price ?? 0}
                onChange={(e) => setF("unit_price", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="lbl">Base Currency</label>
              <select className="inp" value={editing.currency || "USD"} onChange={(e) => setF("currency", e.target.value)}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <F label="Unit" v={editing.unit || "Nos."} on={(v) => setF("unit", v)} />
          </div>
          {editing.prices && Object.keys(editing.prices).length > 0 && (
            <div className="mt-1 rounded-md bg-white p-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Pricebook tiers (from Excel):</span>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(editing.prices).map(([c, tiers]) => (
                  <span key={c}>
                    <b className="text-exicom-tealDark">{c}</b> {tiers.map((t) => t[2]).join(" / ")}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-slate-400">
                These drive the Order Form&apos;s currency &amp; quantity auto-pricing. Editing the base price above
                won&apos;t change these tiers — re-run the seed script to update them.
              </p>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={save}>Save Product</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* toolbar: search + category chips */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="inp sm:max-w-xs"
          placeholder="🔍  Search code, name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!cat} onClick={() => setCat("")}>All ({items.length})</Chip>
          {categories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c} ({items.filter((i) => i.category === c).length})
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">
          No products loaded. The database may be unavailable, or run the backend seed script.
        </p>
      ) : (
        <>
          <div className="mb-2 text-xs text-slate-400">
            Showing {filtered.length} of {items.length} products
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <Th onClick={() => toggleSort("product_code")} sort={sort} k="product_code">Code</Th>
                  <Th onClick={() => toggleSort("product_name")} sort={sort} k="product_name">Name</Th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Currencies</th>
                  <Th onClick={() => toggleSort("unit_price")} sort={sort} k="unit_price" right>Base Price</Th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const priceKeys = Object.keys(p.prices || {}).filter((k) => k !== "EUR_ND");
                  const curs = priceKeys.length ? priceKeys : [p.currency];
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-exicom-teal">{p.product_code}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800">{p.product_name}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{p.category}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {curs.map((c) => (
                            <span key={c} className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-exicom-tealDark">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-slate-700">
                        {p.currency} {fmt(p.unit_price)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <button className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => setEditing(p)}>Edit</button>
                        <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(p.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No products match your search / filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children, onClick, sort, k, right,
}: {
  children: ReactNode;
  onClick: () => void;
  sort: { key: SortKey; dir: 1 | -1 };
  k: SortKey;
  right?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th
      className={`cursor-pointer select-none px-4 py-2 transition hover:text-slate-700 ${right ? "text-right" : ""}`}
      onClick={onClick}
    >
      {children}
      <span className="text-exicom-teal">{active ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</span>
    </th>
  );
}

function Chip({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? "border-exicom-teal bg-exicom-teal text-white"
          : "border-slate-200 bg-white text-slate-500 hover:border-exicom-teal hover:text-exicom-teal"
      }`}
    >
      {children}
    </button>
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
