"use client";

import { useEffect, useState, type ReactNode } from "react";
import { authApi, AUTH_TOKEN_KEY } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type Step = "checking" | "email" | "otp" | "authed";

/**
 * Gates the whole app behind a passwordless email-OTP login. Anyone can sign
 * up — entering an email (+ phone) creates the account on first use; the OTP
 * arrives by email (see backend/app/email_util.py). Admin vs member doesn't
 * branch on anything yet — that split is still to be defined.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setStep("email");
      return;
    }
    authApi
      .me(token)
      .then((u) => {
        setUser(u);
        setStep("authed");
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setStep("email");
      });
  }, []);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authApi.requestOtp(email.trim().toLowerCase(), phone.trim());
      setNotice(`Code sent to ${email.trim()} — check your inbox.`);
      setStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token, user: u } = await authApi.verifyOtp(email.trim().toLowerCase(), otp.trim());
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setUser(u);
      setStep("authed");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) authApi.logout(token).catch(() => {});
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    setEmail("");
    setPhone("");
    setOtp("");
    setNotice("");
    setStep("email");
  }

  if (step === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  if (step === "authed" && user) {
    return (
      <div>
        <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-500">
          <span>
            Signed in as <b className="text-slate-700">{user.email}</b>
          </span>
          <button className="font-semibold text-slate-400 hover:text-red-500" onClick={logout}>
            Log out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Exicom" className="h-12 w-12" />
          <div className="text-xl font-extrabold tracking-tight text-slate-800">exicom</div>
          <div className="text-sm text-slate-500">beautifully engineered · Quote Form Builder</div>
        </div>

        <form onSubmit={step === "email" ? handleRequestOtp : handleVerifyOtp} className="card">
          {step === "email" ? (
            <>
              <div className="section-title">Sign in</div>
              <label className="lbl">Email</label>
              <input
                className="inp mb-3"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@exicom.in"
              />
              <label className="lbl">Phone Number</label>
              <input
                className="inp"
                type="tel"
                required
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                placeholder="+91 98765 43210"
              />
            </>
          ) : (
            <>
              <div className="section-title">Enter verification code</div>
              <p className="mb-3 text-xs text-slate-500">
                We sent a 6-digit code to <b>{email}</b>.
              </p>
              <label className="lbl">Verification Code</label>
              <input
                className="inp text-center text-lg tracking-[0.3em]"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="••••••"
              />
            </>
          )}

          {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}
          {notice && step === "otp" && <p className="mt-2 text-xs font-semibold text-emerald-600">{notice}</p>}

          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy}>
            {busy ? "Please wait…" : step === "email" ? "Send Code" : "Verify & Continue"}
          </button>
          {step === "otp" && (
            <button
              type="button"
              className="btn mt-2 w-full"
              onClick={() => { setStep("email"); setOtp(""); setError(""); setNotice(""); }}
            >
              ← Change email
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
