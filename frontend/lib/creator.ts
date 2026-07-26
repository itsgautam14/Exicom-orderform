// A stable, per-browser identifier so a sales person sees only the quotes they
// created (in the "Past Quotes" tab). Not a security boundary — just scoping.
const KEY = "creator_id";

export function getCreatorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}
