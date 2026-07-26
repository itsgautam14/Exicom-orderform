"use client";

import { useState } from "react";
import * as auth from "@/lib/auth";
import type { User } from "@/lib/types";

type Step = "credentials" | "otp" | "signup" | "signupDone";

/**
 * Two-step login: username + password triggers an emailed OTP, then the
 * 6-digit code (with a resend option) completes the login and stores the
 * session (see lib/auth.ts). Also offers self-service sign up — the user
 * picks their own password, but the account stays inactive until an admin
 * assigns a role and activates it from the Users tab.
 */
export default function Login({ onLoggedIn }: { onLoggedIn: (user: User) => void }) {
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suFullName, setSuFullName] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

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

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (suPassword !== suConfirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await auth.signup(suUsername, suEmail, suFullName, suPassword);
      setUsername(suUsername);
      setStep("signupDone");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-start justify-center p-6">
      {step === "credentials" && (
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
          <p className="mt-3 text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="font-semibold text-teal-600 hover:text-teal-700"
              onClick={() => { setError(""); setStep("signup"); }}
            >
              Sign up
            </button>
          </p>
        </form>
      )}

      {step === "otp" && (
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

      {step === "signup" && (
        <form onSubmit={submitSignup} className="card mt-16 w-full max-w-sm">
          <div className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8" /> Sign up
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Choose your own password. An admin still needs to assign your role and activate your account
            before you can log in.
          </p>

          <label className="lbl">Username</label>
          <input
            className="inp"
            autoFocus
            value={suUsername}
            onChange={(e) => { setSuUsername(e.target.value); setError(""); }}
            placeholder="username"
          />

          <label className="lbl mt-3">Full Name</label>
          <input
            className="inp"
            value={suFullName}
            onChange={(e) => setSuFullName(e.target.value)}
          />

          <label className="lbl mt-3">Email</label>
          <input
            className="inp"
            type="email"
            value={suEmail}
            onChange={(e) => { setSuEmail(e.target.value); setError(""); }}
            placeholder="you@company.com"
          />

          <label className="lbl mt-3">Password</label>
          <input
            className="inp"
            type="password"
            value={suPassword}
            onChange={(e) => { setSuPassword(e.target.value); setError(""); }}
            placeholder="••••••••"
          />

          <label className="lbl mt-3">Confirm Password</label>
          <input
            className="inp"
            type="password"
            value={suConfirm}
            onChange={(e) => { setSuConfirm(e.target.value); setError(""); }}
            placeholder="••••••••"
          />

          {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary mt-4 w-full"
            disabled={busy || !suUsername || !suEmail || !suPassword || !suConfirm}
          >
            {busy ? "Creating account…" : "Sign up"}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
            onClick={() => { setError(""); setStep("credentials"); }}
          >
            ← Back to login
          </button>
        </form>
      )}

      {step === "signupDone" && (
        <div className="card mt-16 w-full max-w-sm">
          <div className="mb-1 flex items-center gap-2 text-lg font-bold text-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Exicom" className="h-8 w-8" /> Account created
          </div>
          <p className="mb-4 text-sm text-slate-500">
            An admin needs to assign your role and activate your account before you can log in. You&apos;ll
            be able to log in with the username and password you just chose once that happens.
          </p>
          <button className="btn btn-primary w-full" onClick={() => setStep("credentials")}>
            Back to login
          </button>
        </div>
      )}
    </div>
  );
}
