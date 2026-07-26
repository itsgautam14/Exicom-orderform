"use client";

import { useEffect, useState } from "react";
import CatalogAdmin from "@/components/CatalogAdmin";
import { api } from "@/lib/api";

const ADMIN_PW_KEY = "catalog_admin_pw";

export default function CatalogGate() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Stay unlocked for the rest of the browser session (password kept only in sessionStorage).
  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_PW_KEY)) setUnlocked(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ok = await api.verifyAdmin(pw);
      if (ok) {
        sessionStorage.setItem(ADMIN_PW_KEY, pw); // used as the X-Admin-Password header
        setUnlocked(true);
      } else {
        setError("Incorrect password. Try again.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function lock() {
    sessionStorage.removeItem(ADMIN_PW_KEY);
    setUnlocked(false);
    setPw("");
  }

  if (unlocked) {
    return (
      <div>
        <div className="mx-auto max-w-4xl px-4 pt-4 lg:px-6">
          <button className="text-xs font-semibold text-slate-400 hover:text-red-500" onClick={lock}>
            🔒 Lock catalog
          </button>
        </div>
        <CatalogAdmin />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-start justify-center p-6">
      <form onSubmit={submit} className="card mt-16 w-full max-w-sm">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Exicom" className="h-8 w-8" /> Admin access
        </div>
        <p className="mb-4 text-sm text-slate-500">
          The product catalog &amp; pricing is restricted. Enter the admin password to continue.
        </p>
        <label className="lbl">Password</label>
        <input
          className="inp"
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(""); }}
          placeholder="••••••••"
        />
        {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !pw}>
          {busy ? "Checking…" : "Unlock Catalog"}
        </button>
      </form>
    </div>
  );
}
