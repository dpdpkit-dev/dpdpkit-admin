// Client for the admin endpoints in spec/openapi.yaml. Paths are relative to the configured API base.

export interface DsrRequest {
  id: string;
  type: "access" | "correct" | "erase" | "nominate" | "grievance";
  status: "open" | "in_progress" | "closed";
  assignee: string | null;
  due_at: string;
}

export interface ConsentStat {
  purpose: string;
  notice_version: string;
  grants: number;
  withdrawals: number;
}

export interface RetentionItem {
  id: string;
  subject: string;
  action: "warning" | "erasure" | "legal_hold" | "needs_attention";
  scheduled_at: string;
}

export interface LedgerVerification {
  ok: boolean;
  checked: number;
  first_bad_index: number | null;
}

export interface Incident {
  id: string;
  title: string;
  aware_at: string;
  board_report_due: string;
  cert_in_report_due?: string | null;
  status?: string;
}

export interface IncidentCreate {
  title: string;
  aware_at: string;
  description?: string;
  affected_count?: number;
}

const BASE_KEY = "dpdpkit-admin:api-base";
export const DEFAULT_API_BASE = "/dpdp";

export function getApiBase(): string {
  try {
    return localStorage.getItem(BASE_KEY) || DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

export function setApiBase(base: string): void {
  localStorage.setItem(BASE_KEY, base.trim().replace(/\/+$/, "") || DEFAULT_API_BASE);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { credentials: "same-origin", ...init });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function callText(path: string): Promise<string> {
  const res = await fetch(`${getApiBase()}${path}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.text();
}

export const api = {
  requests: () => call<DsrRequest[]>("/admin/requests"),
  closeRequest: (id: string) =>
    call<DsrRequest>(`/admin/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    }),
  consentStats: () => call<ConsentStat[]>("/admin/consent/stats"),
  retention: () => call<RetentionItem[]>("/admin/retention/preview"),
  verifyLedger: () => call<LedgerVerification>("/admin/ledger/verify", { method: "POST" }),
  incidents: async () => (await call<{ items: Incident[] }>("/admin/incidents")).items,
  createIncident: (body: IncidentCreate) =>
    call<Incident>("/admin/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  incidentReport: (id: string) => callText(`/admin/incidents/${encodeURIComponent(id)}/report`),
  auditExportUrl: () => `${getApiBase()}/admin/audit/export`,
};
