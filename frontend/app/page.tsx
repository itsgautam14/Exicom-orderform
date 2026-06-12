"use client";

import { useState } from "react";
import OrderFormBuilder from "@/components/OrderFormBuilder";
import CatalogAdmin from "@/components/CatalogAdmin";

export default function Home() {
  const [tab, setTab] = useState<"order" | "admin">("order");

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="logo-chip">e</span>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-slate-800">
                exicom <span className="font-light text-slate-400">| Order Form Builder</span>
              </div>
              <div className="text-[11px] text-slate-400">EVSE Commercial Documents</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-xl bg-slate-100/70 p-1">
            <button onClick={() => setTab("order")} className={`tab ${tab === "order" ? "tab-active" : ""}`}>
              Order Form
            </button>
            <button onClick={() => setTab("admin")} className={`tab ${tab === "admin" ? "tab-active" : ""}`}>
              Catalog / Pricing
            </button>
          </nav>
        </div>
      </header>

      {tab === "order" ? <OrderFormBuilder /> : <CatalogAdmin />}
    </main>
  );
}
