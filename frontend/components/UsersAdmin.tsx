"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["sales_ops", "manager", "logistics", "scm", "admin"];

const ROLE_LABEL: Record<Role, string> = {
  sales_ops: "Sales Ops",
  manager: "Manager",
  logistics: "Logistics",
  scm: "SCM",
  admin: "Admin",
};

type NewUser = { username: string; email: string; full_name: string; password: string; role: Role };
const BLANK: NewUser = { username: "", email: "", full_name: "", password: "", role: "sales_ops" };

// Admin-only "administration control" panel: create accounts, assign roles,
// reset passwords, deactivate/delete people.
export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<NewUser | null>(null);
  const [resetting, setResetting] = useState<{ id: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      setError((e as Error).message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function createUser() {
    if (!creating) return;
    if (!creating.username.trim() || !creating.password) {
      alert("Username and password are required");
      return;
    }
    setBusy(true);
    try {
      await api.createUser(creating);
      setCreating(null);
      reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: User, role: Role) {
    try {
      await api.updateUser(u.id, { role });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function toggleActive(u: User) {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function saveReset() {
    if (!resetting || !resetting.password) return;
    setBusy(true);
    try {
      await api.updateUser(resetting.id, { password: resetting.password });
      setResetting(null);
      alert("Password reset.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(u: User) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(u.id);
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Users</h1>
          <p className="hidden text-sm text-slate-500 sm:block">
            Create accounts and assign roles. New users log in with their username and password, then a
            6-digit code emailed to them.
          </p>
        </div>
        <button className="btn btn-primary flex-shrink-0" onClick={() => setCreating({ ...BLANK })}>
          + New User
        </button>
      </div>

      {creating && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">New User</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="lbl">Username</label>
              <input
                className="inp"
                value={creating.username}
                onChange={(e) => setCreating({ ...creating, username: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Full Name</label>
              <input
                className="inp"
                value={creating.full_name}
                onChange={(e) => setCreating({ ...creating, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Email</label>
              <input
                className="inp"
                type="email"
                value={creating.email}
                onChange={(e) => setCreating({ ...creating, email: e.target.value })}
                placeholder="Needed to receive the login code"
              />
            </div>
            <div>
              <label className="lbl">Password</label>
              <input
                className="inp"
                type="password"
                value={creating.password}
                onChange={(e) => setCreating({ ...creating, password: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Role</label>
              <select
                className="inp"
                value={creating.role}
                onChange={(e) => setCreating({ ...creating, role: e.target.value as Role })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={createUser}>
              {busy ? "Creating…" : "Create User"}
            </button>
            <button className="btn" onClick={() => setCreating(null)}>Cancel</button>
          </div>
        </div>
      )}

      {resetting && (
        <div className="card mb-5 border-exicom-teal/40 bg-slate-50">
          <div className="section-title">Reset Password</div>
          <label className="lbl">New Password</label>
          <input
            className="inp"
            type="password"
            value={resetting.password}
            onChange={(e) => setResetting({ ...resetting, password: e.target.value })}
          />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={busy || !resetting.password} onClick={saveReset}>
              {busy ? "Saving…" : "Save Password"}
            </button>
            <button className="btn" onClick={() => setResetting(null)}>Cancel</button>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">No users yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2">Username</th>
                <th className="px-4 py-2">Full Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-800">{u.username}</td>
                  <td className="px-4 py-2 text-slate-700">{u.full_name || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{u.email || "—"}</td>
                  <td className="px-4 py-2">
                    <select
                      className="inp !py-1 !text-xs"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                      }`}
                      onClick={() => toggleActive(u)}
                      title="Click to toggle"
                    >
                      {u.is_active ? "Active" : "Deactivated"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      className="mr-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() => setResetting({ id: u.id, password: "" })}
                    >
                      Reset Password
                    </button>
                    <button className="text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => del(u)}>
                      Delete
                    </button>
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
