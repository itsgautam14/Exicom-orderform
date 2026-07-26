"use client";

import { useEffect, useState } from "react";
import OrderFormBuilder from "@/components/OrderFormBuilder";
import Login from "@/components/Login";
import CatalogAdmin from "@/components/CatalogAdmin";
import LogisticsAdmin from "@/components/LogisticsAdmin";
import OrdersAdmin from "@/components/OrdersAdmin";
import OrderTracking from "@/components/OrderTracking";
import PendingLogistic from "@/components/PendingLogistic";
import UsersAdmin from "@/components/UsersAdmin";
import * as auth from "@/lib/auth";
import type { OrderOut, Role, User } from "@/lib/types";

type Tab = "order" | "orders" | "approvals" | "tracking" | "pendingLogistic" | "catalog" | "logistics" | "users";

// Which tabs each role can see, and which tab they land on by default.
// `admin` always has every tab, handled separately below.
const ROLE_TABS: Record<Role, Tab[]> = {
  sales_ops: ["order", "orders"],
  manager: ["order", "orders", "tracking"],
  logistics: ["pendingLogistic", "logistics"],
  scm: [],
  admin: ["order", "orders", "approvals", "tracking", "pendingLogistic", "catalog", "logistics", "users"],
};

const TAB_LABEL: Record<Tab, { full: string; short: string }> = {
  order: { full: "Quote Form", short: "Quote" },
  orders: { full: "Past Quotes", short: "Quotes" },
  approvals: { full: "Pricing Approval", short: "Pricing Approval" },
  tracking: { full: "Order Tracking", short: "Tracking" },
  pendingLogistic: { full: "Pending Logistic", short: "Pending Log." },
  catalog: { full: "Catalogue|Pricing", short: "Catalogue" },
  logistics: { full: "Logistics", short: "Logistics" },
  users: { full: "Users", short: "Users" },
};

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = not checked yet
  const [tab, setTab] = useState<Tab | null>(null);
  const [editOrder, setEditOrder] = useState<OrderOut | null>(null);

  useEffect(() => {
    setUser(auth.getCurrentUser());
  }, []);

  if (user === undefined) return null; // avoid a login-screen flash on first paint

  if (!user) {
    return (
      <main className="min-h-screen">
        <Login onLoggedIn={setUser} />
      </main>
    );
  }

  const tabs = ROLE_TABS[user.role] || [];
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0];

  function logout() {
    auth.logout();
    setUser(null);
    setTab(null);
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 lg:gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8 flex-shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-extrabold tracking-tight text-slate-800">
                exicom <span className="hidden font-light text-slate-400 sm:inline">| beautifully engineered · Quote Form Builder</span>
              </div>
            </div>
          </div>
          <nav className="flex flex-shrink-0 flex-wrap justify-end gap-1 rounded-xl bg-slate-100/70 p-1">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`tab ${activeTab === t ? "tab-active" : ""}`}>
                <span className="hidden sm:inline">{TAB_LABEL[t].full}</span>
                <span className="sm:hidden">{TAB_LABEL[t].short}</span>
              </button>
            ))}
          </nav>
          <div className="flex flex-shrink-0 items-center gap-2 pl-1">
            <span className="hidden text-xs text-slate-500 md:inline">
              {user.full_name || user.username} <span className="text-slate-300">·</span> {user.role}
            </span>
            <button className="text-xs font-semibold text-slate-400 hover:text-red-500" onClick={logout}>
              🔒 Log out
            </button>
          </div>
        </div>
      </header>

      {tabs.length === 0 && (
        <p className="mx-auto mt-16 max-w-md rounded-lg bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
          Your account doesn&apos;t have access to any section yet. Ask an admin to assign you a role.
        </p>
      )}

      {activeTab === "order" && <OrderFormBuilder loadOrder={editOrder} onLoaded={() => setEditOrder(null)} />}
      {activeTab === "orders" && <OrdersAdmin mode="mine" onEdit={(o) => { setEditOrder(o); setTab("order"); }} />}
      {activeTab === "approvals" && <OrdersAdmin mode="admin" onEdit={(o) => { setEditOrder(o); setTab("order"); }} />}
      {activeTab === "tracking" && <OrderTracking readOnly={user.role !== "admin"} />}
      {activeTab === "pendingLogistic" && <PendingLogistic />}
      {activeTab === "catalog" && <CatalogAdmin />}
      {activeTab === "logistics" && <LogisticsAdmin />}
      {activeTab === "users" && <UsersAdmin />}
    </main>
  );
}
