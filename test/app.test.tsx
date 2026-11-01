import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { defaultApiBase, setApiBase } from "../src/api";
import { App } from "../src/App";
import { slaLabel } from "../src/screens";

// Responses use the shapes in dpdpkit-spec/openapi.yaml. e2e/ checks them against a real backend.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.location.hash = "";
});

function stubFetch(routes: Record<string, unknown>) {
  const stub = vi.fn(async (url: string, _init?: RequestInit) => {
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    return key
      ? { ok: true, status: 200, json: async () => routes[key] }
      : { ok: false, status: 404, json: async () => ({ error: { code: "not_found", message: "not found" } }) };
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

function rightsRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    principal: "u_42",
    kind: "erasure",
    status: "received",
    assignee: null,
    opened_at: "2026-01-01T00:00:00Z",
    due_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    closed_at: null,
    overdue: true,
    ...overrides,
  };
}

test("renders the shell with all seven screens in the nav", () => {
  stubFetch({ "/admin/requests": { items: [] }, "/admin/retention/preview": { items: [], needs_attention: [] } });
  render(<App />);
  expect(screen.getByRole("heading", { name: "dpdpkit admin" })).toBeTruthy();
  const links = screen.getAllByRole("link").map((a) => a.textContent);
  expect(links).toEqual([
    "Overview",
    "Request queue",
    "Consent analytics",
    "Retention monitor",
    "Incident register",
    "Audit export",
    "Settings",
  ]);
});

test("overview counts open and overdue requests, and retention work", async () => {
  stubFetch({
    "/admin/requests": {
      items: [rightsRequest(), rightsRequest({ id: "r2", closed_at: "2026-01-02T00:00:00Z", overdue: false })],
    },
    "/admin/retention/preview": {
      items: [{ schedule_id: "s1", principal: "u1", purpose: "m", action: "erase", at: "2026-02-01T00:00:00Z", status: "scheduled" }],
      needs_attention: [{ schedule_id: "s2", principal: "u2", purpose: "m", reason: "handler failed" }],
    },
  });
  render(<App />);
  expect(await screen.findByText("Open requests: 1")).toBeTruthy();
  expect(screen.getByText("Overdue requests: 1")).toBeTruthy();
  expect(await screen.findByText("Upcoming erasures: 1")).toBeTruthy();
  expect(screen.getByText("Needs attention: 1")).toBeTruthy();
});

test("request queue shows SLA state and warns that responding to an erasure erases data", async () => {
  stubFetch({ "/admin/requests": { items: [rightsRequest()] } });
  window.location.hash = "#/requests";
  render(<App />);
  expect(await screen.findByText("r1")).toBeTruthy();
  expect(screen.getByText(/overdue by 3d/)).toBeTruthy();
  expect(screen.getByText(/erases this person's data/)).toBeTruthy();
});

test("request actions send the action the backend expects, and need a message to complete", async () => {
  const stub = stubFetch({ "/admin/requests": { items: [rightsRequest()] }, "/admin/requests/r1": rightsRequest() });
  window.location.hash = "#/requests";
  render(<App />);
  const respond = (await screen.findByRole("button", { name: "Respond and complete" })) as HTMLButtonElement;
  expect(respond.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Response or rejection reason/), { target: { value: "Done" } });
  fireEvent.click(respond);
  await vi.waitFor(() => {
    const patch = stub.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ action: "respond", message: "Done" });
  });
});

test("closed requests have no actions", async () => {
  stubFetch({
    "/admin/requests": { items: [rightsRequest({ status: "completed", closed_at: "2026-01-02T00:00:00Z", overdue: false })] },
  });
  window.location.hash = "#/requests";
  render(<App />);
  expect(await screen.findByText("completed")).toBeTruthy();
  expect(screen.queryByText("Manage r1")).toBeNull();
});

test("consent analytics lists counts per purpose and notice version", async () => {
  stubFetch({
    "/admin/consent/stats": { items: [{ purpose: "marketing", notice_version: 2, grants: 7, denials: 1, withdrawals: 3 }] },
  });
  window.location.hash = "#/consent";
  render(<App />);
  expect(await screen.findByText("marketing")).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy();
});

test("shows an error with retry when the API fails", async () => {
  stubFetch({});
  window.location.hash = "#/consent";
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toContain("not found");
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("a response in an unexpected shape shows an error and keeps the navigation", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  stubFetch({ "/admin/retention/preview": { unexpected: true } });
  window.location.hash = "#/retention";
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toContain("could not be displayed");
  expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
  vi.restoreAllMocks();
});

test("audit export verifies the ledger and reports a broken one", async () => {
  stubFetch({ "/admin/ledger/verify": { ok: false, checked: 12, failed_row: "ce_7", reason: "hash mismatch" } });
  window.location.hash = "#/audit";
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Verify ledger" }));
  expect(await screen.findByText(/failed at row ce_7 after 12 entries: hash mismatch/)).toBeTruthy();
});

test("incident register shows clocks and a draft report", async () => {
  const soon = new Date(Date.now() + 5.5 * 3_600_000).toISOString();
  const late = new Date(Date.now() - 2.5 * 3_600_000).toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/report")
        ? { ok: true, status: 200, text: async () => "# Draft breach report" }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              items: [{ id: "i1", title: "Leaked bucket", aware_at: late, board_report_due: soon, cert_in_report_due: late }],
            }),
          },
    ),
  );
  window.location.hash = "#/incidents";
  render(<App />);
  expect(await screen.findByText("Leaked bucket")).toBeTruthy();
  expect(screen.getByText("5h left")).toBeTruthy();
  expect(screen.getByText("overdue by 3h")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View draft report i1" }));
  expect(await screen.findByText("# Draft breach report")).toBeTruthy();
});

test("settings shows the current notice and purposes read-only", async () => {
  stubFetch({
    "/notices/current": {
      version: 3,
      locale: "en",
      content_hash: "a".repeat(64),
      published_at: "2026-03-01T00:00:00Z",
      title: "Privacy notice",
      available_locales: ["en", "hi"],
      purposes: [{ id: "m", title: "Marketing", data_items: ["email"], legal_basis: "consent", required: false }],
    },
  });
  window.location.hash = "#/settings";
  render(<App />);
  expect(await screen.findByText("Marketing")).toBeTruthy();
  expect(screen.getByText("Version: 3")).toBeTruthy();
  expect(screen.getByText("Languages: en, hi")).toBeTruthy();
});

test("the API base follows the adapter's mount path unless overridden", () => {
  expect(defaultApiBase("/dpdp/admin/ui/")).toBe("/dpdp");
  expect(defaultApiBase("/compliance/admin/ui/index.html")).toBe("/compliance");
  expect(defaultApiBase("/admin/ui/")).toBe("");
  expect(defaultApiBase("/")).toBe("/dpdp");
  setApiBase("/custom/");
  expect(localStorage.getItem("dpdpkit-admin:api-base")).toBe("/custom");
  setApiBase("");
  expect(localStorage.getItem("dpdpkit-admin:api-base")).toBeNull();
});

test("slaLabel formats days", () => {
  const now = Date.parse("2026-01-10T00:00:00Z");
  expect(slaLabel("2026-01-12T00:00:00Z", now)).toBe("2d left");
  expect(slaLabel("2026-01-10T00:00:00Z", now)).toBe("due today");
});
