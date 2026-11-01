import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const USER = { "X-User": "u_42" };

async function openRequest(request: APIRequestContext, kind = "access"): Promise<string> {
  const res = await request.post("/dpdp/requests", { headers: USER, data: { kind, details: {} } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

// A screen that throws would still let the page load, so any uncaught error fails the test.
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

async function open(page: Page, screen: string, heading: string) {
  await page.goto(`/#/${screen}`);
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
}

test("overview counts real requests", async ({ page, request }) => {
  await openRequest(request);
  await open(page, "overview", "Overview");
  await expect(page.getByText(/^Open requests: [1-9]/)).toBeVisible();
  await expect(page.getByText(/^Upcoming erasures: \d+/)).toBeVisible();
  await expect(page.getByText(/^Needs attention: \d+/)).toBeVisible();
});

test("a request is assigned, started and completed from the queue", async ({ page, request }) => {
  const id = await openRequest(request);
  await open(page, "requests", "Request queue");
  const row = page.getByRole("row").filter({ hasText: id });
  await expect(row).toContainText("received");
  await row.getByText(`Manage ${id}`).click();

  await row.getByLabel("Assign to").fill("dpo@example.in");
  await row.getByRole("button", { name: "Assign" }).click();
  await expect(row).toContainText("dpo@example.in");

  await row.getByText(`Manage ${id}`).click();
  await row.getByRole("button", { name: "Start" }).click();
  await expect(row).toContainText("in progress");

  await row.getByText(`Manage ${id}`).click();
  await row.getByLabel(/Response or rejection reason/).fill("Your data is attached.");
  await row.getByRole("button", { name: "Respond and complete" }).click();
  await expect(row).toContainText("completed");
  await expect(row.getByText(`Manage ${id}`)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a request can be rejected with a reason", async ({ page, request }) => {
  const id = await openRequest(request);
  await open(page, "requests", "Request queue");
  const row = page.getByRole("row").filter({ hasText: id });
  await row.getByText(`Manage ${id}`).click();
  await row.getByLabel(/Response or rejection reason/).fill("Not a valid request.");
  await row.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(row).toContainText("rejected");
});

test("consent analytics counts a grant and its withdrawal", async ({ page, request }) => {
  const grant = await request.post("/dpdp/consents", {
    headers: USER,
    data: { decisions: [{ purpose: "marketing", granted: true }] },
  });
  expect(grant.status()).toBe(201);
  expect((await request.post("/dpdp/consents/marketing/withdraw", { headers: USER })).status()).toBe(200);
  await open(page, "consent", "Consent analytics");
  const row = page.getByRole("row").filter({ hasText: "marketing" });
  await expect(row).toBeVisible();
  const cells = await row.getByRole("cell").allTextContents();
  expect(Number(cells[2])).toBeGreaterThanOrEqual(1); // grants
  expect(Number(cells[4])).toBeGreaterThanOrEqual(1); // withdrawals
});

test("retention monitor renders", async ({ page }) => {
  await open(page, "retention", "Retention monitor");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
});

test("an incident is recorded and its draft report opened", async ({ page }) => {
  await open(page, "incidents", "Incident register");
  await page.getByLabel("Title").fill("Leaked bucket");
  await page.getByLabel("Aware at").fill("2026-11-01T09:30");
  await page.getByRole("button", { name: "Record incident" }).click();
  const row = page.getByRole("row").filter({ hasText: "Leaked bucket" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /View draft report/ }).click();
  await expect(page.getByText(/dpdpkit never submits to the Board/)).toBeVisible();
  await expect(page.locator("pre")).toContainText("Leaked bucket");
});

test("the ledger verifies and the evidence pack downloads", async ({ page }) => {
  await open(page, "audit", "Audit export");
  await page.getByRole("button", { name: "Verify ledger" }).click();
  await expect(page.getByText(/^Ledger verified: \d+ entries intact\.$/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download evidence pack" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^dpdpkit-evidence-.*\.zip$/);
  expect(readFileSync(await download.path()).subarray(0, 2).toString()).toBe("PK"); // a real zip, not an error body
});

test("a failed evidence pack download shows the error and saves nothing", async ({ page }) => {
  await open(page, "audit", "Audit export");
  await page.route("**/admin/audit/export", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "forbidden", message: "the admin role is required" } }),
    }),
  );
  let saved = false;
  page.on("download", () => {
    saved = true;
  });
  await page.getByRole("button", { name: "Download evidence pack" }).click();
  await expect(page.getByText("Download failed: the admin role is required")).toBeVisible();
  expect(saved).toBe(false);
});

for (const [screen, heading] of [
  ["overview", "Overview"],
  ["requests", "Request queue"],
  ["consent", "Consent analytics"],
  ["retention", "Retention monitor"],
  ["incidents", "Incident register"],
  ["audit", "Audit export"],
  ["settings", "Settings"],
] as const) {
  test(`${heading} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await open(page, screen, heading);
    await expect(page.getByRole("status")).toHaveCount(0); // finished loading
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
}

test("settings shows the current notice and purposes", async ({ page }) => {
  await open(page, "settings", "Settings");
  await expect(page.getByText(/^Version: \d+/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "consent" }).first()).toBeVisible();
});
