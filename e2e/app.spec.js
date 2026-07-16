import { expect, test } from "@playwright/test";

const definition = (code = "X", scope = "A bounded scope", act = "THE SHARED ACT") => ({
  code,
  scope,
  constructor: "NOT",
  variables: { act },
  revision: 1,
  retired: false,
});

const snapshot = (wager) => ({
  code: wager.code,
  scope: wager.scope,
  constructor: wager.constructor,
  variables: { ...wager.variables },
  revision: wager.revision,
});

const emptyState = () => ({
  version: 3,
  revision: 0,
  wagers: [],
  ledger: [],
  day: null,
  nextNull: {},
  pendingReveal: null,
});

async function seed(page, state) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem("atdu3-state")) localStorage.setItem("atdu3-state", JSON.stringify(value));
  }, state);
}

async function expectNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test("first use binds and revises one formally valid Wager", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Wagers", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bind first Wager" }).click();
  await page.getByLabel("Code").fill("x");
  await page.getByLabel("Scope").fill("A bounded circumstance");
  await page.getByRole("button", { name: /DO X \/ DO NOT DO X/ }).click();
  await page.getByLabel(/Act/).fill("THE SHARED ACT");
  await expect(page.getByText("DO THE SHARED ACT", { exact: true })).toBeVisible();
  await expect(page.getByText("DO NOT DO THE SHARED ACT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bind Wager", exact: true }).click();

  await expect(page.getByRole("button", { name: "Revise" })).toBeVisible();
  await page.getByRole("button", { name: "Revise" }).click();
  await page.getByLabel(/Act/).fill("A REVISED ACT");
  await page.getByRole("button", { name: "Bind revision" }).click();
  await expect(page.getByText("DO A REVISED ACT", { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("the final authored choice hands off to Coin and remains revisable", async ({ page }) => {
  const wager = definition();
  const state = emptyState();
  state.wagers = [wager];
  state.day = {
    day: 1,
    date: "2026-07-16T00:00:00.000Z",
    wagers: {
      X: { mode: "O", side: null, seed: false, reference: null, referenceSide: null, nulled: false, definition: snapshot(wager) },
    },
  };
  await seed(page, state);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Day 1" })).toBeVisible();
  await page.getByRole("button", { name: /Side B/ }).click();
  await expect(page.getByRole("heading", { name: "Prepare Day 2" })).toBeVisible();

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("button", { name: /Side B/ })).toHaveClass(/is-selected/);
  await expect(page.getByRole("button", { name: /Side A/ })).toHaveClass(/is-excluded/);
  await page.getByRole("button", { name: /Side A/ }).click();
  await expect(page.getByRole("heading", { name: "Prepare Day 2" })).toBeVisible();
});

test("keyboard Coin commitment persists before reveal and refresh restores the fixed ticket", async ({ page }) => {
  const state = emptyState();
  state.wagers = [definition()];
  await seed(page, state);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  const coin = page.getByRole("slider", { name: /Flick to Flip Day 1/ });
  await coin.focus();
  await coin.press("End");
  await coin.press("Enter");
  await expect(page.getByRole("dialog", { name: "Flip Day 1" })).toBeVisible();

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("atdu3-state")));
  expect(persisted.pendingReveal).toEqual({ day: 1, closingDay: null });
  expect(persisted.day.day).toBe(1);

  await page.getByRole("button", { name: /Show ticket|Ticket/ }).click();
  await expect(page.getByRole("heading", { name: "Tomorrow bound" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tomorrow bound" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Today" }).click();
  await expect(page.getByRole("heading", { name: "Day 1" })).toBeVisible();
  const acknowledged = await page.evaluate(() => JSON.parse(localStorage.getItem("atdu3-state")));
  expect(acknowledged.pendingReveal).toBeNull();
});

test("pre-Coin Null bypasses the mechanism and remains a fixed Tomorrow entry", async ({ page }) => {
  const state = emptyState();
  state.wagers = [definition()];
  await seed(page, state);
  await page.goto("./");
  await page.getByRole("button", { name: "Null", exact: true }).click();
  const coin = page.getByRole("slider", { name: /Flick to Flip Day 1/ });
  await coin.focus();
  await coin.press("End");
  await coin.press("Enter");
  await page.getByRole("button", { name: /Show ticket|Ticket/ }).click();
  await expect(page.getByRole("dialog", { name: "Flip Day 1" })).toContainText("Null before Coin");
});

test("twenty maximum-length Wagers and every surface stay inside supported viewports", async ({ page }) => {
  const state = emptyState();
  state.wagers = Array.from({ length: 20 }, (_, index) => definition(
    index.toString(20).toUpperCase().padStart(2, "0"),
    `S${"COPE ".repeat(20)}`.slice(0, 72),
    `A${"UTHORED TERM ".repeat(12)}`.slice(0, 72),
  ));
  state.ledger = [1, 2, 3].map((day) => ({
    day,
    date: `2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    entries: Object.fromEntries(state.wagers.map((wager, index) => [wager.code, { mode: index % 2 ? "O" : "C", side: index % 3 ? "A" : "B" }])),
    definitions: Object.fromEntries(state.wagers.map((wager) => [wager.code, snapshot(wager)])),
  }));
  await seed(page, state);
  await page.goto("./");

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const destination of ["Wagers", "Today", "Coin", "Ledger"]) {
      await page.getByRole("button", { name: destination, exact: true }).click();
      await expectNoPageOverflow(page);
    }
    await page.getByRole("button", { name: "Rules", exact: true }).click();
    await expect(page.getByRole("heading", { name: "One mechanism" })).toBeVisible();
    await expectNoPageOverflow(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }

  await page.setViewportSize({ width: 768, height: 900 });
  await page.getByRole("button", { name: "Ledger", exact: true }).click();
  const dayCells = page.locator("tbody th");
  await expect(dayCells.first()).toHaveText("003");
  await expect(dayCells.last()).toHaveText("001");
});
