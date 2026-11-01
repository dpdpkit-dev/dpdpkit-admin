import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { slaLabel } from "../src/screens";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = "";
});

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => url.endsWith(k));
      return key
        ? { ok: true, status: 200, json: async () => routes[key] }
        : { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

test("renders the shell with all six screens in the nav", () => {
  stubFetch({ "/admin/requests": [], "/admin/retention/preview": [] });
  render(<App />);
  expect(screen.getByRole("heading", { name: "dpdpkit admin" })).toBeTruthy();
  const links = screen.getAllByRole("link").map((a) => a.textContent);
  expect(links).toEqual([
    "Overview",
    "Request queue",
    "Consent analytics",
    "Retention monitor",
    "Audit export",
    "Settings",
  ]);
});

test("request queue lists requests with SLA state", async () => {
  const due = new Date(Date.now() - 3 * 86_400_000).toISOString();
  stubFetch({
    "/admin/requests": [{ id: "r1", type: "erase", status: "open", assignee: null, due_at: due }],
  });
  window.location.hash = "#/requests";
  render(<App />);
  expect(await screen.findByText("r1")).toBeTruthy();
  expect(screen.getByText(/overdue by 3d/)).toBeTruthy();
});

test("shows an error with retry when the API fails", async () => {
  stubFetch({});
  window.location.hash = "#/consent";
  render(<App />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

test("audit export verifies the ledger", async () => {
  stubFetch({ "/admin/ledger/verify": { ok: true, checked: 12, first_bad_index: null } });
  window.location.hash = "#/audit";
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Verify ledger" }));
  expect(await screen.findByText(/12 entries intact/)).toBeTruthy();
});

test("slaLabel formats days", () => {
  const now = Date.parse("2026-01-10T00:00:00Z");
  expect(slaLabel("2026-01-12T00:00:00Z", now)).toBe("2d left");
  expect(slaLabel("2026-01-10T00:00:00Z", now)).toBe("due today");
});
