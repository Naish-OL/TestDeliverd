// End-to-end tests for the local UI. Development-mode runs are real (they start
// demo processes); every live run is answered by a route mock in the browser,
// and the server refuses live runs anyway (UI_DEV_ONLY).
import { expect, test, type Page, type Route } from "@playwright/test";

/** Answers /api/run in the browser, recording each request, so nothing reaches the server. */
async function mockRuns(page: Page, output = "[live] mocked run\nDone.\n") {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/run", async (route: Route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "output", text: output })}\n${JSON.stringify({ type: "exit", code: 0, ms: 12 })}\n`,
    });
  });
  return requests;
}

const runButton = (page: Page) => page.locator("#run");
const consoleOut = (page: Page) => page.locator("#demo-panel .console");
const runStatus = (page: Page) => page.locator("#run-status");

test.beforeEach(async ({ page }) => {
  // Start every test in development mode on the first demo.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/");
  await expect(page.locator(".item").first()).toBeVisible();
});

test.describe("layout", () => {
  test("lists every demo in catalogue order with its development support", async ({ page }) => {
    await expect(page.locator(".item .name")).toHaveText([
      "approve", "approve-with-changes", "approve-callback", "confirm", "collect", "review", "flow",
      "gate", "publish", "webhook-receiver", "adapters", "errors",
    ]);
    await expect(page.locator('[data-demo="publish"] .badge')).toHaveText("live only");
    await expect(page.locator('[data-demo="errors"] .badge')).toHaveText("offline");
    await expect(page.locator('[data-demo="gate"] .badge')).toHaveText("dev");
  });

  test("shows the SDK version and starts in development mode", async ({ page }) => {
    await expect(page.locator("#sdk")).toContainText("@deliverd/sdk");
    await expect(page.locator('[data-mode="development"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#banner")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/live/);
  });
});

test.describe("development runs", () => {
  test("runs a demo and streams its output", async ({ page }) => {
    await page.locator('[data-demo="approve-with-changes"]').click();
    await runButton(page).click();
    await expect(consoleOut(page)).toContainText("amount: 1240 → 1200");
    await expect(runStatus(page)).toContainText("Exit 0");
    await expect(runStatus(page)).toContainText("development, approved");
  });

  test("the outcome pills change what the imaginary approver does", async ({ page }) => {
    await page.locator('[data-outcome="rejected"]').click();
    await expect(consoleOut(page)).toContainText("DELIVERD_DEV_OUTCOME=rejected npm run demo approve");
    await runButton(page).click();
    await expect(consoleOut(page)).toContainText("Not deploying (rejected)");
  });

  test("Stop kills a waiting demo", async ({ page }) => {
    // The timeout outcome waits five seconds before giving up.
    await page.locator('[data-outcome="timeout"]').click();
    await runButton(page).click();
    await expect(runStatus(page)).toContainText("Running");
    await page.locator("#stop").click();
    await expect(runStatus(page)).toHaveText("Stopped");
    await expect(runButton(page)).toBeVisible();
  });

  test("a live-only demo explains itself in development mode", async ({ page }) => {
    await page.locator('[data-demo="publish"]').click();
    await expect(page.locator("#demo-panel .note")).toContainText("doesn't simulate");
    await runButton(page).click();
    await expect(consoleOut(page)).toContainText("isn't simulated");
    await expect(runStatus(page)).toContainText("Exit 1");
  });
});

test.describe("live mode", () => {
  test("switching shows the banner and recolours the page", async ({ page }) => {
    await page.locator('[data-mode="live"]').click();
    await expect(page.locator("#banner")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/live/);
    await expect(page.locator(".pill")).toHaveCount(0);
    await expect(page.locator("#demo-panel .note")).toContainText("Sends a real request");
    await expect(consoleOut(page)).toContainText("DELIVERD_MODE=live npm run demo approve");
  });

  test("a live run that contacts people needs a second click, and Escape disarms it", async ({ page }) => {
    const requests = await mockRuns(page);
    await page.locator('[data-mode="live"]').click();

    await runButton(page).click();
    await expect(runButton(page)).toHaveText("Confirm: run live");
    await expect(runButton(page)).toHaveClass(/armed/);
    await page.keyboard.press("Escape");
    await expect(runButton(page)).toHaveText("Run live…");

    // Switching demo or mode also disarms.
    await runButton(page).click();
    await page.locator('[data-demo="confirm"]').click();
    await expect(runButton(page)).toHaveText("Run live…");
    expect(requests).toHaveLength(0);
  });

  test("a confirmed live run sends mode, no outcome, and confirmLive", async ({ page }) => {
    const requests = await mockRuns(page);
    await page.locator('[data-mode="live"]').click();
    await runButton(page).click();
    await runButton(page).click();
    await expect(consoleOut(page)).toContainText("mocked run");
    await expect(runStatus(page)).toContainText("live");
    expect(requests).toEqual([{ demo: "approve", mode: "live", confirmLive: true }]);
  });

  test("an offline demo runs on one click even in live mode", async ({ page }) => {
    const requests = await mockRuns(page);
    await page.locator('[data-mode="live"]').click();
    await page.locator('[data-demo="errors"]').click();
    await expect(page.locator("#demo-panel .note")).toContainText("nothing is sent to Deliverd");
    await runButton(page).click();
    await expect(consoleOut(page)).toContainText("mocked run");
    expect(requests).toHaveLength(1);
  });

  test("the chosen mode and demo survive a reload", async ({ page }) => {
    await page.locator('[data-mode="live"]').click();
    await page.locator('[data-demo="gate"]').click();
    await page.reload();
    await expect(page.locator('[data-mode="live"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-demo="gate"]')).toHaveAttribute("aria-current", "true");
  });
});

test.describe("test matrix", () => {
  test("runs every case and shows a case's output with the expected text highlighted", async ({ page }) => {
    await page.locator('[data-tab="tests"]').click();
    const total = await page.locator(".cell").count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator("#n-total")).toHaveText(String(total));

    await page.locator("#run-all").click();
    await expect(page.locator("#run-all")).toHaveText("Running…");
    await expect(page.locator("#run-all")).toHaveText("Run all tests", { timeout: 110_000 });
    await expect(page.locator("#n-fail")).toHaveText("0");
    await expect(page.locator("#n-pass")).toHaveText(String(total));
    await expect(page.locator("#test-count")).toHaveText("all passing");

    // Offline and live-only demos are labelled "run", not with an outcome.
    await expect(page.locator("tr", { has: page.locator("th", { hasText: /^errors$/ }) }).locator(".cell")).toContainText("run");

    await page.locator(".cell").first().click();
    await expect(page.locator("#test-detail")).toContainText("Passed");
    await expect(page.locator("#test-detail mark")).toHaveText("Deploying");
  });

  test("a single case can be re-run from its detail panel", async ({ page }) => {
    await page.locator('[data-tab="tests"]').click();
    await page.locator('[data-case="20"]').click(); // gate with denied
    await expect(page.locator("#test-detail")).toContainText("Not run yet");
    await page.locator("#run-one").click();
    await expect(page.locator("#test-detail")).toContainText("Passed");
    await expect(page.locator("#test-detail mark")).toHaveText("Not refunding (denied)");
  });
});

test.describe("server guards", () => {
  test("refuses live runs, cross-origin posts and non-JSON", async ({ request }) => {
    const live = await request.post("/api/run", { data: { demo: "approve", mode: "live", confirmLive: true } });
    expect(live.status()).toBe(403);
    expect(await live.json()).toEqual({ error: "Live runs are disabled (UI_DEV_ONLY)." });

    const crossOrigin = await request.post("/api/run", {
      data: { demo: "errors", mode: "development" },
      headers: { origin: "https://evil.example" },
    });
    expect(crossOrigin.status()).toBe(403);

    const form = await request.post("/api/run", {
      data: "demo=errors",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(form.status()).toBe(415);

    const unknown = await request.post("/api/run", { data: { demo: "../../etc", mode: "development" } });
    expect(unknown.status()).toBe(404);
  });

  test("refuses a foreign Host header", async ({ request }) => {
    const res = await request.get("/api/status", { headers: { host: "evil.example:4399" } });
    expect(res.status()).toBe(403);
  });
});
