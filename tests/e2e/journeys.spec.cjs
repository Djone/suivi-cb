const { test, expect } = require("@playwright/test");
const { loopbackOrigin } = require("./safety.cjs");
const web = loopbackOrigin(process.env.E2E_WEB),
  kc = loopbackOrigin(process.env.E2E_KC);
const oidc = kc + "/realms/e2e/protocol/openid-connect";
const password = process.env.E2E_PASSWORD;
async function token(request, user = "allowed") {
  const r = await request.post(oidc + "/token", {
    form: {
      grant_type: "password",
      client_id: "suivi-cb-web",
      username: user,
      password,
    },
  });
  expect(r.status()).toBe(200);
  return r.json();
}
async function api(request, path, method = "GET", data, access) {
  const r = await request.fetch(web + "/api/" + path, {
    method,
    data,
    headers: access ? { Authorization: "Bearer " + access } : {},
  });
  return r;
}
async function login(page, user = "allowed") {
  await page.goto("/login");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/code_challenge_method=S256/);
  await page.locator("#username").fill(user);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
  await expect(page).toHaveURL(/\/(home|access-denied)/);
}
async function admin(request, path, method = "GET", data) {
  const r = await request.post(
    kc + "/realms/master/protocol/openid-connect/token",
    {
      form: {
        grant_type: "password",
        client_id: "admin-cli",
        username: "fixture-admin",
        password: process.env.E2E_ADMIN_PASSWORD,
      },
    },
  );
  expect(r.status()).toBe(200);
  const t = await r.json();
  return request.fetch(kc + "/admin/realms/e2e/" + path, {
    method,
    data,
    headers: { Authorization: "Bearer " + t.access_token },
  });
}
test("API: anonymous, invalid and roleless tokens expose no banking data", async ({
  request,
}) => {
  for (const access of [undefined, "invalid-token"])
    expect(
      (await api(request, "accounts", "GET", undefined, access)).status(),
    ).toBe(401);
  const t = await token(request, "denied");
  const r = await api(request, "accounts", "GET", undefined, t.access_token);
  expect(r.status()).toBe(403);
  expect(await r.text()).not.toContain("E2E_ACCOUNT");
});
test("API: create, update, transfer, recurring occurrence, delete and restart persistence", async ({
  request,
}) => {
  let t = await token(request);
  const access = t.access_token;
  const call = async (p, m = "GET", d, status = 200) => {
    const r = await api(request, p, m, d, access);
    expect(r.status()).toBe(status);
    return r.json();
  };
  const accounts = await call("accounts");
  expect(accounts.length).toBeGreaterThanOrEqual(2);
  const sub = await call("sub-categories");
  const category = sub.find((s) => s.financialFlowId === 2) || sub[0];
  expect(category).toBeTruthy();
  const date = new Date().toISOString().slice(0, 10);
  const base = {
    description: "E2E_EXPENSE",
    amount: 12.34,
    date,
    account_id: accounts[0].id,
    sub_category_id: category.id,
    financial_flow_id: 2,
  };
  const created = await call("transactions", "POST", base, 201);
  await call("transactions/" + created.id, "PUT", {
    ...base,
    description: "E2E_UPDATED",
    amount: 15.67,
  });
  let rows = await call("transactions");
  expect(rows.find((r) => r.id === created.id).amount).toBe(15.67);
  const debit = await call(
    "transactions",
    "POST",
    { ...base, description: "E2E_TRANSFER_OUT", amount: 10 },
    201,
  );
  const credit = await call(
    "transactions",
    "POST",
    {
      ...base,
      description: "E2E_TRANSFER_IN",
      amount: 10,
      account_id: accounts[1].id,
      financial_flow_id: 1,
    },
    201,
  );
  rows = await call("transactions");
  const pair = rows.filter((r) => [debit.id, credit.id].includes(r.id));
  expect(
    pair.reduce(
      (n, r) => n + (r.financialFlowId === 1 ? r.amount : -r.amount),
      0,
    ),
  ).toBe(0);
  const recurring = await call(
    "recurring-transactions",
    "POST",
    {
      label: "E2E_MONTHLY",
      amount: 7,
      day_of_month: 15,
      account_id: accounts[0].id,
      sub_category_id: category.id,
      financial_flow_id: 2,
      debit_503020: 1,
      frequency: "monthly",
    },
    201,
  );
  await call(
    "recurring-transactions/" + recurring.id + "/occurrence-exception",
    "PUT",
    { occurrenceDate: date, amount: 9, isSkipped: false },
  );
  expect(
    (await call("recurring-transactions/occurrence-exceptions")).length,
  ).toBeGreaterThan(0);
  const posted = await call(
    "transactions",
    "POST",
    {
      ...base,
      description: "E2E_POSTED_OCCURRENCE",
      amount: 9,
      recurring_transaction_id: recurring.id,
      recurring_occurrence_date: date,
    },
    201,
  );
  expect(
    (await call("transactions")).find((r) => r.id === posted.id)
      .recurringTransactionId,
  ).toBe(recurring.id);
  await call("transactions/" + created.id, "DELETE");
  expect((await call("transactions")).some((r) => r.id === created.id)).toBe(
    false,
  );
  // Restart is performed by the orchestrator between the browser suite and a separate persistence probe.
  const marker = await call(
    "transactions",
    "POST",
    { ...base, description: "E2E_PERSISTENCE", amount: 25 },
    201,
  );
  expect(marker.id).toBeGreaterThan(0);
  expect(
    (
      await api(
        request,
        "transactions",
        "POST",
        { ...base, amount: -1 },
        access,
      )
    ).status(),
  ).toBe(400);
  const original = {
    label: "E2E_MONTHLY",
    amount: 8,
    day_of_month: 15,
    account_id: accounts[0].id,
    sub_category_id: category.id,
    financial_flow_id: 2,
    debit_503020: 1,
    frequency: "monthly",
  };
  await call("recurring-transactions/" + recurring.id, "PUT", original);
  expect(
    (await call("recurring-transactions")).find((r) => r.id === recurring.id)
      .amount,
  ).toBe(8);
  await call("recurring-transactions/" + recurring.id, "DELETE");
  expect(
    (await call("recurring-transactions")).find((r) => r.id === recurring.id)
      .is_active,
  ).toBe(0);
  await call("recurring-transactions/" + recurring.id + "/reactivate", "PATCH");
  expect(
    (await call("recurring-transactions")).find((r) => r.id === recurring.id)
      .is_active,
  ).toBe(1);
});
test("browser: login, navigation, transaction form and logout", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByText("E2E_ACCOUNT_A", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".dashboard-account-card")
      .filter({ hasText: "E2E_ACCOUNT_A" })
      .locator(".account-card-metrics strong")
      .first(),
  ).toContainText("-44,00");
  await expect(
    page
      .locator(".dashboard-account-card")
      .filter({ hasText: "E2E_ACCOUNT_B" })
      .locator(".account-card-metrics strong")
      .first(),
  ).toContainText("10,00");
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Nouvelle transaction" }).click();
  await expect(page.locator("#description input")).toBeVisible();
  await page.locator("#description input").fill("E2E_BROWSER_FORM");
  await page.locator("#amount input").fill("18,25");
  await page.locator("#subcategory").click();
  await page
    .getByRole("option")
    .filter({ hasText: "Transfert interne" })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Cr\u00e9er$/ })).toBeEnabled();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/transactions") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Cr\u00e9er$/ }).click();
  expect((await created).status()).toBe(201);
  let row = page
    .locator(".transaction-item")
    .filter({ hasText: "E2E_BROWSER_FORM" });
  await expect(row).toBeVisible();
  await row
    .locator("p-button")
    .filter({ has: page.locator(".pi-pencil") })
    .getByRole("button")
    .click();
  await page.locator("#description input").fill("E2E_BROWSER_EDITED");
  const edited = page.waitForResponse(
    (r) =>
      r.url().includes("/api/transactions/") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Enregistrer" }).click();
  expect((await edited).status()).toBe(200);
  await page.reload();
  row = page
    .locator(".transaction-item")
    .filter({ hasText: "E2E_BROWSER_EDITED" });
  await expect(row).toBeVisible();
  await row
    .locator("p-button")
    .filter({ has: page.locator(".pi-trash") })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(row).toHaveCount(0);
  await page.getByText("Se d\u00e9connecter", { exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
test("browser: missing role blocks business requests and logout remains available", async ({
  page,
}) => {
  const business = [];
  page.on("request", (r) => {
    if (
      /\/api\/(accounts|transactions|recurring-transactions|sub-categories)/.test(
        r.url(),
      )
    )
      business.push(r.url());
  });
  await login(page, "denied");
  await expect(
    page.getByRole("heading", { name: "Acc\u00e8s non autoris\u00e9" }),
  ).toBeVisible();
  expect(business).toEqual([]);
  await page.getByRole("button", { name: "Se d\u00e9connecter" }).click();
  await expect(page).toHaveURL(/\/login/);
});
test("browser: API 403 after rights removal blocks data and later requests", async ({
  page,
  request,
}) => {
  await login(page, "revoked");
  const users = await (
    await admin(request, "users?username=revoked&exact=true")
  ).json();
  const role = await (await admin(request, "roles/app-user")).json();
  expect(
    (
      await admin(
        request,
        "users/" + users[0].id + "/role-mappings/realm",
        "DELETE",
        [role],
      )
    ).status(),
  ).toBe(204);
  // Renewed tokens lose the role. Existing signed tokens retain it until expiry by design.
  const renewed = await token(request, "revoked");
  expect(
    (
      await api(request, "accounts", "GET", undefined, renewed.access_token)
    ).status(),
  ).toBe(403);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Acc\u00e8s non autoris\u00e9" }),
  ).toBeVisible();
});
test("browser: refresh succeeds and revoked session returns to login", async ({
  page,
  request,
}) => {
  let refresh = 0;
  page.on("response", (r) => {
    if (
      r.url() === oidc + "/token" &&
      r.request().postData()?.includes("grant_type=refresh_token") &&
      r.status() === 200
    )
      refresh++;
  });
  await login(page, "session");
  await expect.poll(() => refresh, { timeout: 45000 }).toBeGreaterThan(0);
  const users = await (
    await admin(request, "users?username=session&exact=true")
  ).json();
  expect(
    (await admin(request, "users/" + users[0].id + "/logout", "POST")).status(),
  ).toBe(204);
  await expect(page).toHaveURL(/\/login/, { timeout: 45000 });
});
test("API: expired token rejected, refresh obtains a usable token", async ({
  request,
}) => {
  const t = await token(request);
  await new Promise((r) => setTimeout(r, 17000));
  expect(
    (await api(request, "accounts", "GET", undefined, t.access_token)).status(),
  ).toBe(401);
  const r = await request.post(oidc + "/token", {
    form: {
      grant_type: "refresh_token",
      client_id: "suivi-cb-web",
      refresh_token: t.refresh_token,
    },
  });
  expect(r.status()).toBe(200);
  expect(
    (
      await api(
        request,
        "accounts",
        "GET",
        undefined,
        (await r.json()).access_token,
      )
    ).status(),
  ).toBe(200);
});

test("browser: a banking API 403 redirects and suppresses subsequent banking loads", async ({
  page,
}) => {
  await login(page);
  let injected = 0;
  await page.route("**/api/accounts", async (route) => {
    injected++;
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "FORBIDDEN" }),
    });
  });
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Acc\u00e8s non autoris\u00e9" }),
  ).toBeVisible();
  expect(injected).toBeGreaterThan(0);
  await expect(page.locator(".transaction-item")).toHaveCount(0);
  const late = [];
  page.on("request", (r) => {
    if (/\/api\/(accounts|transactions)/.test(r.url())) late.push(r.url());
  });
  await page.waitForTimeout(1500);
  expect(late).toEqual([]);
});
