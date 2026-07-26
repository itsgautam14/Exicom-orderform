"use client";

import { useState } from "react";
import * as auth from "@/lib/auth";
import type { User } from "@/lib/types";

/**
 * Two-step login: username + password triggers an emailed OTP, then the
 * 6-digit code (with a resend option) completes the login and stores the
 * session (see lib/auth.ts).
 */
export default function Login({ onLoggedIn }: { onLoggedIn: (user: User) => void }) {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await auth.login(username, password);
      setInfo(res.message || "Check your email for the login code.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await auth.verifyOtp(username, otp);
      onLoggedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const res = await auth.login(username, password);
      setInfo(res.message || "A new code has been sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-start justify-center p-6">
      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="card mt-16 w-full max-w-sm">
          <div className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8" /> Log in
          </div>
          <p className="mb-4 text-sm text-slate-500">Enter your username and password to continue.</p>

          <label className="lbl">Username</label>
          <input
            className="inp"
            autoFocus
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            placeholder="username"
          />

          <label className="lbl mt-3">Password</label>
          <input
            className="inp"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="••••••••"
          />

          {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !username || !password}>
            {busy ? "Sending code…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="card mt-16 w-full max-w-sm">
          <div className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8" /> Check your email
          </div>
          <p className="mb-4 text-sm text-slate-500">{info || `Enter the 6-digit code sent to ${username}'s email.`}</p>

          <label className="lbl">6-digit code</label>
          <input
            className="inp tracking-widest"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={otp}
            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
            placeholder="123456"
          />

          {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || otp.length !== 6}>
            {busy ? "Verifying…" : "Verify & log in"}
          </button>
          <div className="mt-3 flex items-center justify-between text-xs">
            <button type="button" className="font-semibold text-slate-400 hover:text-slate-600" onClick={() => setStep("credentials")}>
              ← Back
            </button>
            <button type="button" className="font-semibold text-teal-600 hover:text-teal-700" onClick={resend} disabled={busy}>
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
