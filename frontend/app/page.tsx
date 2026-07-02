"use client";

import { useState } from "react";
import OrderFormBuilder from "@/components/OrderFormBuilder";
import CatalogGate from "@/components/CatalogGate";

export default function Home() {
  const [tab, setTab] = useState<"order" | "admin">("order");

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8 flex-shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-slate-800">
                exicom <span className="hidden font-light text-slate-400 sm:inline">| Order Form Builder</span>
              </div>
            </div>
          </div>
          <nav className="flex flex-shrink-0 gap-1 rounded-xl bg-slate-100/70 p-1">
            <button onClick={() => setTab("order")} className={`tab ${tab === "order" ? "tab-active" : ""}`}>
              <span className="hidden sm:inline">Order Form</span>
              <span className="sm:hidden">Order</span>
            </button>
            <button onClick={() => setTab("admin")} className={`tab ${tab === "admin" ? "tab-active" : ""}`}>
              <span className="hidden sm:inline">Catalog / Pricing</span>
              <span className="sm:hidden">Catalog</span>
            </button>
          </nav>
        </div>
      </header>

      {tab === "order" ? <OrderFormBuilder /> : <CatalogGate />}
    </main>
  );
}
