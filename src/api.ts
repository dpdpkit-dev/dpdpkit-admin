// Client for the admin endpoints in dpdpkit-spec/openapi.yaml. Paths are relative to the API base.

export type RequestStatus = "received" | "identity_pending" | "in_progress" | "completed" | "rejected";

export interface RightsRequest {
  id: string;
  principal: string;
  kind: string;
  status: RequestStatus;
  assignee?: string | null;
  identity_verified?: boolean | null;
  opened_at: string;
  due_at: string;
  closed_at?: string | null;
  overdue: boolean;
}

export type RequestUpdate =
  | { action: "assign"; assignee: string }
  | { action: "start" }
  | { action: "verify_identity"; verified: boolean }
  | { action: "respond"; message: string }
  | { action: "reject"; message: string };

export interface ConsentStat {
  purpose: string;
  notice_version: number | null;
  grants: number;
  denials: number;
  withdrawals: number;
}

export interface PreviewItem {
  schedule_id: string;
  principal: string;
  purpose: string;
  action: "warn" | "erase";
  at: string;
  status: string;
}

export interface AttentionItem {
  schedule_id: string;
  principal: string;
  purpose: string;
  reason: string | null;
}

export interface RetentionPreview {
  items: PreviewItem[];
  needs_attention: AttentionItem[];
}

export interface LedgerVerification {
  ok: boolean;
  checked: number;
  failed_row?: string | null;
  chain?: string | null;
  reason?: string | null;
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

export interface NoticePurpose {
  id: string;
  title: string;
  data_items: string[];
  legal_basis: string;
  required: boolean;
}

export interface Notice {
  version: number;
  locale: string;
  content_hash: string;
  published_at: string;
  title: string;
  purposes: NoticePurpose[];
  available_locales: string[];
}

const BASE_KEY = "dpdpkit-admin:api-base";
export const DEFAULT_API_BASE = "/dpdp";

// The adapters serve this bundle at <prefix>/admin/ui/ and the API at <prefix>, so the prefix is known from the URL.
export function defaultApiBase(pathname = window.location.pathname): string {
  const mounted = /^(.*)\/admin\/ui(?:\/.*)?$/.exec(pathname);
  return mounted ? (mounted[1] ?? "") : DEFAULT_API_BASE;
}

export function getApiBase(): string {
  try {
    return localStorage.getItem(BASE_KEY) ?? defaultApiBase();
  } catch {
    return defaultApiBase();
  }
}

export function setApiBase(base: string): void {
  const cleaned = base.trim().replace(/\/+$/, "");
  if (cleaned) localStorage.setItem(BASE_KEY, cleaned);
  else localStorage.removeItem(BASE_KEY);
}

// Django needs its CSRF token on writes from a signed-in session. Other backends ignore the header.
function csrfHeader(): Record<string, string> {
  const token = /(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie)?.[1];
  return token ? { "x-csrftoken": token } : {};
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const write = init?.method !== undefined && init.method !== "GET";
  const res = await fetch(`${getApiBase()}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { ...init?.headers, ...(write ? csrfHeader() : {}) },
  });
  if (res.ok) return res;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new Error(body?.error?.message ?? `${path} failed (${res.status})`);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await send(path, init)).json()) as T;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  requests: async () => (await call<{ items: RightsRequest[] }>("/admin/requests")).items,
  updateRequest: (id: string, update: RequestUpdate) =>
    call<RightsRequest>(`/admin/requests/${encodeURIComponent(id)}`, jsonBody("PATCH", update)),
  consentStats: async () => (await call<{ items: ConsentStat[] }>("/admin/consent/stats")).items,
  retention: () => call<RetentionPreview>("/admin/retention/preview"),
  verifyLedger: () => call<LedgerVerification>("/admin/ledger/verify", { method: "POST" }),
  incidents: async () => (await call<{ items: Incident[] }>("/admin/incidents")).items,
  createIncident: (body: IncidentCreate) => call<Incident>("/admin/incidents", jsonBody("POST", body)),
  incidentReport: async (id: string) => (await send(`/admin/incidents/${encodeURIComponent(id)}/report`)).text(),
  notice: () => call<Notice>("/notices/current"),
  auditExport: async () => {
    const res = await send("/admin/audit/export");
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
    return { name: name ?? "dpdpkit-evidence.zip", blob: await res.blob() };
  },
};
