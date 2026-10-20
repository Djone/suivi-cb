// Exercise real routers, validation and SQLite without the production server or filesystem.
const express = require("express");
const db = require("../../config/db");
const initialize = require("../../migrations/initializeDatabase");
let server, origin, accountId, categoryId, subcategoryId;
const sql = (statement, params = []) =>
  new Promise((resolve, reject) =>
    db.run(statement, params, function (error) {
      error
        ? reject(error)
        : resolve({ id: this.lastID, changes: this.changes });
    }),
  );
async function api(route, method = "GET", body, expected = 200) {
  const response = await fetch(origin + "/api/" + route, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (response.status !== expected)
    throw Error(
      method +
        " " +
        route +
        ": expected " +
        expected +
        ", got " +
        response.status +
        " " +
        text,
    );
  return result;
}
async function outage(table, run) {
  if (!/^[a-z_]+$/.test(table)) throw Error("unsafe table");
  await sql("ALTER TABLE " + table + " RENAME TO offline_" + table);
  try {
    await run();
  } finally {
    await sql("ALTER TABLE offline_" + table + " RENAME TO " + table);
  }
}
beforeAll(async () => {
  expect(process.env.DB_PATH).toBe(":memory:");
  expect(db.filename).toBe(":memory:");
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  await initialize();
  const app = express();
  app.use(express.json());
  for (const [route, module] of [
    ["accounts", "account"],
    ["categories", "category"],
    ["sub-categories", "subcategory"],
    ["transactions", "transaction"],
    ["recurring-transactions", "recurring-transaction"],
    ["saving-accounts", "saving-account"],
    ["savings-wallets", "savings-wallet"],
    ["vehicles", "vehicle"],
    ["couple-split", "couple-split"],
  ])
    app.use("/api/" + route, require("../../routes/" + module + ".routes"));
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  origin = "http://127.0.0.1:" + server.address().port;
  accountId = (
    await api("accounts", "POST", { name: "Synthetic account" }, 201)
  ).id;
  categoryId = (
    await api(
      "categories",
      "POST",
      { label: "Synthetic category", financial_flow_id: 2 },
      201,
    )
  ).id;
  subcategoryId = (
    await api(
      "sub-categories",
      "POST",
      { label: "Synthetic subcategory", category_id: categoryId },
      201,
    )
  ).id;
}, 20000);
afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await new Promise((resolve) => db.close(resolve));
  jest.restoreAllMocks();
});
test("account lifecycle preserves identity and validates invalid input", async () => {
  expect((await api("accounts/" + accountId)).name).toBe("Synthetic account");
  await api("accounts/" + accountId, "PUT", {
    name: "Renamed synthetic account",
    color: "#123456",
  });
  expect((await api("accounts/" + accountId)).name).toBe(
    "Renamed synthetic account",
  );
  await api("accounts/" + accountId + "/deactivate", "PATCH");
  expect((await api("accounts")).some((a) => a.id === accountId)).toBe(false);
  expect((await api("accounts/all")).some((a) => a.id === accountId)).toBe(
    true,
  );
  await api("accounts/" + accountId + "/reactivate", "PATCH");
  expect((await api("accounts")).some((a) => a.id === accountId)).toBe(true);
  await api("accounts", "POST", { name: "x" }, 400);
  await api("accounts/" + accountId, "PUT", { name: "x" }, 400);
  await api("accounts/999999", "GET", undefined, 404);
  for (const [route, method, body] of [
    ["accounts/nope", "GET"],
    ["accounts/nope", "PUT", { name: "Valid name" }],
    ["accounts/nope/deactivate", "PATCH"],
    ["accounts/nope/reactivate", "PATCH"],
  ])
    await api(route, method, body, 400);
  await outage("accounts", async () => {
    await api("accounts", "GET", undefined, 500);
    await api("accounts/all", "GET", undefined, 500);
    await api("accounts", "POST", { name: "Unavailable account" }, 500);
    await api(
      "accounts/" + accountId,
      "PUT",
      { name: "Unavailable update" },
      500,
    );
    await api("accounts/" + accountId + "/deactivate", "PATCH", undefined, 500);
    await api("accounts/" + accountId + "/reactivate", "PATCH", undefined, 500);
  });
  expect((await api("accounts/" + accountId)).name).toBe(
    "Renamed synthetic account",
  );
});
test("categories and subcategories survive deactivate/reactivate and reject malformed input", async () => {
  await api("categories/" + categoryId, "PUT", { label: "Renamed category" });
  expect(
    (await api("categories/active")).some((c) => c.id === categoryId),
  ).toBe(true);
  await api("sub-categories/" + subcategoryId, "PUT", {
    label: "Renamed subcategory",
  });
  expect(
    (await api("sub-categories/2")).some((c) => c.id === subcategoryId),
  ).toBe(true);
  await api(
    "sub-categories",
    "POST",
    { label: "Bad foreign key", category_id: "invalid" },
    400,
  );
  await api("sub-categories/" + subcategoryId, "DELETE");
  expect(
    (await api("sub-categories")).some((c) => c.id === subcategoryId),
  ).toBe(false);
  subcategoryId = (
    await api(
      "sub-categories",
      "POST",
      { label: "Replacement subcategory", category_id: categoryId },
      201,
    )
  ).id;
  await api("categories/" + categoryId, "DELETE");
  expect(
    (await api("categories/active")).some((c) => c.id === categoryId),
  ).toBe(false);
  await api("categories/" + categoryId + "/reactivate", "PUT");
  for (const [route, method] of [
    ["categories/nope", "DELETE"],
    ["categories/nope/reactivate", "PUT"],
  ])
    await api(route, method, undefined, 400);
  for (const [route, method] of [
    ["categories/999999", "DELETE"],
    ["categories/999999/reactivate", "PUT"],
  ])
    await api(route, method, undefined, 404);
  await api(
    "categories",
    "POST",
    { label: "Bad reference", financial_flow_id: "invalid" },
    400,
  );
  await api("categories/" + categoryId, "PUT", {}, 400);
  await outage("categories", async () => {
    await api("categories", "GET", undefined, 500);
    await api("categories/active", "GET", undefined, 500);
    await api(
      "categories",
      "POST",
      { label: "Unavailable", financial_flow_id: 2 },
      500,
    );
    await api("categories/" + categoryId, "PUT", { label: "Unavailable" }, 500);
    await api("categories/" + categoryId, "DELETE", undefined, 500);
    await api(
      "categories/" + categoryId + "/reactivate",
      "PUT",
      undefined,
      500,
    );
  });
  await outage("subcategories", async () => {
    await api("sub-categories", "GET", undefined, 500);
    await api("sub-categories/2", "GET", undefined, 500);
    await api(
      "sub-categories",
      "POST",
      { label: "Unavailable", category_id: categoryId },
      500,
    );
    await api(
      "sub-categories/" + subcategoryId,
      "PUT",
      { label: "Unavailable" },
      500,
    );
    await api("sub-categories/" + subcategoryId, "DELETE", undefined, 500);
  });
});
const recurringPayload = () => ({
  label: "Synthetic recurrence",
  amount: 15,
  day_of_month: 12,
  account_id: accountId,
  sub_category_id: subcategoryId,
  financial_flow_id: 2,
  debit_503020: 1,
  frequency: "monthly",
});
test("recurrence changes, history and occurrence exceptions round-trip through SQLite", async () => {
  const id = (
    await api("recurring-transactions", "POST", recurringPayload(), 201)
  ).id;
  await api("recurring-transactions/" + id, "PUT", {
    ...recurringPayload(),
    amount: 20,
  });
  expect(
    (await api("recurring-transactions")).find((r) => r.id === id).amount,
  ).toBe(20);
  await api(
    "recurring-transactions/" + id + "/history",
    "POST",
    { amount: 21, effectiveFrom: "2026-10-01" },
    201,
  );
  expect(
    (await api("recurring-transactions/" + id + "/history")).some(
      (r) => r.amount === 21,
    ),
  ).toBe(true);
  await api(
    "recurring-transactions/" + id + "/history",
    "POST",
    { amount: 22, effective_from: "2026-11-01" },
    201,
  );
  await api("recurring-transactions/" + id + "/occurrence-exception", "PUT", {
    occurrenceDate: "2026-10-12",
    amount: 18,
  });
  await api("recurring-transactions/" + id + "/occurrence-exception", "PUT", {
    occurrenceDate: "2026-10-12",
    isSkipped: true,
  });
  expect(
    (
      await api(
        "recurring-transactions/occurrence-exceptions?accountId=" + accountId,
      )
    ).length,
  ).toBe(1);
  expect(
    (await api("recurring-transactions/occurrence-exceptions")).length,
  ).toBe(1);
  await api("recurring-transactions/" + id, "DELETE");
  await api("recurring-transactions/" + id + "/reactivate", "PATCH");
  for (const [route, method, body] of [
    ["recurring-transactions/nope", "DELETE"],
    ["recurring-transactions/nope/reactivate", "PATCH"],
    ["recurring-transactions/nope/history", "GET"],
    ["recurring-transactions/nope/history", "POST", { amount: 1 }],
    [
      "recurring-transactions/" + id + "/history",
      "POST",
      { amount: "invalid" },
    ],
    [
      "recurring-transactions/" + id + "/occurrence-exception",
      "PUT",
      { occurrenceDate: "invalid" },
    ],
    [
      "recurring-transactions/" + id + "/occurrence-exception",
      "PUT",
      { occurrenceDate: "2026-10-12", amount: -1 },
    ],
  ])
    await api(route, method, body, 400);
  await api("recurring-transactions/999999", "DELETE", undefined, 404);
  await api(
    "recurring-transactions/999999/reactivate",
    "PATCH",
    undefined,
    404,
  );
  await outage("recurring_transactions", async () => {
    await api("recurring-transactions", "GET", undefined, 500);
    await api("recurring-transactions", "POST", recurringPayload(), 500);
    await api("recurring-transactions/" + id, "PUT", recurringPayload(), 500);
    await api("recurring-transactions/" + id, "DELETE", undefined, 500);
    await api(
      "recurring-transactions/" + id + "/reactivate",
      "PATCH",
      undefined,
      500,
    );
  });
});
test("savings account settings and balances persist, protected accounts cannot be deleted", async () => {
  const body = {
    name: "Synthetic savings",
    bankName: "Fixture bank",
    role: "savings",
    liquidityLevel: "instant",
    currentBalance: 50,
    targetBalance: 100,
    minimumBalance: 0,
    includeInDailyBudget: true,
    includeInWealth: false,
  };
  const created = await api("saving-accounts", "POST", body, 201);
  const id = created.id;
  expect(created.currentBalance).toBe(50);
  await api("saving-accounts/" + id, "PATCH", {
    currentBalance: 60,
    targetBalance: null,
    minimumBalance: null,
    includeInDailyBudget: false,
    includeInWealth: true,
  });
  expect((await api("saving-accounts/" + id)).currentBalance).toBe(60);
  await api("saving-accounts/" + id, "PUT", {
    ...body,
    name: "Renamed savings",
  });
  expect(
    (await api("saving-accounts")).some(
      (a) => a.id === id && a.name === "Renamed savings",
    ),
  ).toBe(true);
  const protectedAccount = (await api("saving-accounts")).find(
    (a) => a.providerKey === "plum",
  );
  expect(protectedAccount).toBeDefined();
  await api("saving-accounts/" + protectedAccount.id, "DELETE", undefined, 400);
  for (const method of ["GET", "DELETE", "PUT", "PATCH"])
    await api(
      "saving-accounts/999999",
      method,
      method === "PUT"
        ? body
        : method === "PATCH"
          ? {
              currentBalance: 60,
              targetBalance: null,
              minimumBalance: null,
              includeInDailyBudget: false,
              includeInWealth: true,
            }
          : undefined,
      404,
    );
  await api("saving-accounts/" + id, "DELETE", undefined, 204);
  expect((await api("saving-accounts")).some((a) => a.id === id)).toBe(false);
  await outage("saving_accounts", async () => {
    await api("saving-accounts", "GET", undefined, 500);
    await api("saving-accounts/" + id, "GET", undefined, 500);
    await api("saving-accounts", "POST", body, 500);
    await api("saving-accounts/" + id, "PUT", body, 500);
    await api(
      "saving-accounts/" + id,
      "PATCH",
      {
        currentBalance: 60,
        targetBalance: null,
        minimumBalance: null,
        includeInDailyBudget: false,
        includeInWealth: true,
      },
      500,
    );
    await api("saving-accounts/" + id, "DELETE", undefined, 500);
  });
});
test("vehicles and expenses keep dates, joins and amounts across edits", async () => {
  const body = { name: "Synthetic vehicle", energy_type: "electric" };
  const id = (await api("vehicles", "POST", body, 201)).id;
  await api("vehicles/" + id, "PUT", {
    ...body,
    brand: "Fixture",
    model: "Test",
    registration: "SYNTHETIC",
    purchase_price: 10000,
    annual_distance: 1000,
    consumption_per_100: 12,
    energy_price: 0.25,
    is_active: true,
  });
  expect((await api("vehicles")).find((v) => v.id === id).energyPrice).toBe(
    0.25,
  );
  const op = (
    await api(
      "vehicles/operations",
      "POST",
      {
        date: "2026-10-01",
        label: "Synthetic charge",
        amount: 12,
        sub_category_id: subcategoryId,
        vehicle_id: id,
      },
      201,
    )
  ).id;
  const expense = (await api("vehicles/operations")).find((o) => o.id === op);
  expect(expense.amount).toBe(12);
  expect(expense.date).toBe("2026-10-01");
  await api("vehicles/operations/" + op, "DELETE", undefined, 204);
  expect((await api("vehicles/operations")).some((o) => o.id === op)).toBe(
    false,
  );
  await api("vehicles", "POST", { ...body, energy_type: "invalid" }, 400);
  await outage("vehicles", async () => {
    await api("vehicles", "GET", undefined, 500);
    await api("vehicles", "POST", body, 500);
    await api("vehicles/" + id, "PUT", body, 500);
  });
  await outage("vehicle_operations", async () => {
    await api("vehicles/operations", "GET", undefined, 500);
    await api(
      "vehicles/operations",
      "POST",
      {
        date: "2026-10-01",
        label: "Synthetic charge",
        amount: 12,
        sub_category_id: subcategoryId,
        vehicle_id: id,
      },
      500,
    );
    await api("vehicles/operations/" + op, "DELETE", undefined, 500);
  });
});
test("couple split handles all supported allocation modes and persists configuration", async () => {
  const members = [
    { id: "A", name: "Synthetic A", income: 2000 },
    { id: "B", name: "Synthetic B", income: 1000 },
  ];
  const body = {
    members,
    customProrataA: 60,
    lines: [
      { id: 1, label: "Equal", amount: 100, mode: "equal" },
      { id: 2, label: "Prorata", amount: 100, mode: "prorata" },
      { id: 3, label: "Fixed", amount: 100, mode: "fixed", fixedRatioA: 20 },
      { id: 4, label: "Single B", amount: 100, mode: "single", payer: "B" },
      { id: 5, label: "Single A", amount: 100, mode: "single", payer: "A" },
    ],
    ignoredRecurringIds: [],
  };
  const computed = await api("couple-split/compute", "POST", body);
  expect(computed.totals.totalA).toBe(230);
  expect(computed.totals.totalB).toBe(270);
  await api("couple-split/config", "PUT", body);
  const loaded = await api("couple-split/config");
  expect(loaded.totals).toEqual(computed.totals);
  expect(loaded.config.members[0].name).toBe("Synthetic A");
  expect(Array.isArray((await api("couple-split/recurring-lines")).lines)).toBe(
    true,
  );
  await api(
    "couple-split/compute",
    "POST",
    { ...body, customProrataA: 101 },
    400,
  );
  // A SQLite I/O failure must not masquerade as an empty or successful saved configuration.
  const read = jest
    .spyOn(db, "get")
    .mockImplementationOnce((_sql, _params, callback) =>
      callback(new Error("Synthetic database unavailable")),
    );
  await api("couple-split/config", "GET", undefined, 500);
  read.mockRestore();
  expect((await api("couple-split/config")).totals).toEqual(computed.totals);
});
test("wallet allocations are bounded, atomic on failure and retain closed snapshots", async () => {
  const first = (
    await api(
      "savings-wallets",
      "POST",
      { name: "Synthetic wallet A", target_amount: 80 },
      201,
    )
  ).id;
  const second = (
    await api(
      "savings-wallets",
      "POST",
      { name: "Synthetic wallet B", target_amount: 30 },
      201,
    )
  ).id;
  await api("savings-wallets/" + first, "PATCH", {
    name: "Synthetic renamed wallet",
    target_amount: 90,
    is_active: true,
  });
  const tx = {
    description: "Synthetic savings transfer",
    amount: 100,
    date: "2026-10-01",
    account_id: accountId,
    sub_category_id: subcategoryId,
    financial_flow_id: 2,
    is_internal_transfer: true,
  };
  const transactionId = (await api("transactions", "POST", tx, 201)).id;
  await api("savings-wallets/allocations", "POST", {
    transaction_id: transactionId,
    allocations: [
      { wallet_id: first, amount: 30 },
      { wallet_id: first, amount: 10 },
      { wallet_id: second, amount: 20 },
    ],
  });
  expect(
    (await api("savings-wallets/allocations/" + transactionId)).find(
      (a) => a.walletId === first,
    ).amount,
  ).toBe(40);
  const batch = await api("savings-wallets/allocations/batch", "POST", {
    transaction_ids: [transactionId, transactionId],
  });
  expect(batch.length).toBe(2);
  expect(
    await api("savings-wallets/allocations/batch", "POST", {
      transaction_ids: [],
    }),
  ).toEqual([]);
  await api(
    "savings-wallets/allocations",
    "POST",
    {
      transaction_id: transactionId,
      allocations: [{ wallet_id: first, amount: 101 }],
    },
    400,
  );
  // A failed FK insert must roll back the preceding DELETE and preserve the previous allocations.
  await api(
    "savings-wallets/allocations",
    "POST",
    {
      transaction_id: transactionId,
      allocations: [{ wallet_id: 999999, amount: 5 }],
    },
    400,
  );
  expect(
    (await api("savings-wallets/allocations/" + transactionId)).find(
      (a) => a.walletId === first,
    ).amount,
  ).toBe(40);
  await api(
    "savings-wallets/allocations",
    "POST",
    { transaction_id: 999999, allocations: [] },
    404,
  );
  const normal = (
    await api(
      "transactions",
      "POST",
      {
        ...tx,
        description: "Synthetic normal payment",
        is_internal_transfer: false,
      },
      201,
    )
  ).id;
  await api(
    "savings-wallets/allocations",
    "POST",
    { transaction_id: normal, allocations: [] },
    400,
  );
  await api("savings-wallets/allocations/global", "POST", {
    allocations: [
      { wallet_id: first, amount: 70 },
      { wallet_id: second, amount: 50 },
    ],
  });
  const global = await api("savings-wallets/allocations/global");
  expect(global.reduce((n, a) => n + a.amount, 0)).toBe(100);
  const summary = await api(
    "savings-wallets/summary?account_id=" +
      accountId +
      "&year=2026&month=9&flow=incoming",
  );
  expect(summary.find((w) => w.id === first).allocatedAmount).toBe(70);
  expect(
    (await api("savings-wallets/summary?flow=outgoing")).every(
      (w) => w.allocatedAmount === 0,
    ),
  ).toBe(true);
  await api(
    "savings-wallets/summary?flow=invalid&account_id=invalid&year=&month=",
  );
  await api("savings-wallets/" + first + "/close", "PATCH");
  expect((await api("savings-wallets")).some((w) => w.id === first)).toBe(
    false,
  );
  const closed = (
    await api("savings-wallets/summary?include_closed=true")
  ).find((w) => w.id === first);
  expect(closed.allocatedAmount).toBe(70);
  expect(closed.remainingAmount).toBe(20);
  expect(
    (await api("savings-wallets?include_closed=1")).some((w) => w.id === first),
  ).toBe(true);
  expect(
    (await api("savings-wallets/allocations/global?include_closed=true")).some(
      (w) => w.walletId === first,
    ),
  ).toBe(true);
  // Reducing the target clamps active allocations; closing another wallet does not erase its snapshot.
  await api("savings-wallets/" + second, "PATCH", { target_amount: 10 });
  expect(
    (await api("savings-wallets")).find((w) => w.id === second)
      .currentAllocatedAmount,
  ).toBe(10);
  await api("savings-wallets/allocations/global", "POST", { allocations: [] });
  await api("savings-wallets/" + second, "DELETE");
  await api("savings-wallets/" + second, "DELETE", undefined, 404);
  for (const [route, method, body] of [
    ["savings-wallets/nope", "PATCH", { name: "Valid" }],
    ["savings-wallets/nope", "DELETE"],
    ["savings-wallets/nope/close", "PATCH"],
    ["savings-wallets/allocations/nope", "GET"],
  ])
    await api(route, method, body, 400);
  for (const [route, method, body] of [
    ["savings-wallets/999999", "PATCH", { name: "Valid" }],
    ["savings-wallets/999999/close", "PATCH"],
  ])
    await api(route, method, body, 404);
  await outage("savings_wallets", async () => {
    await api("savings-wallets", "GET", undefined, 500);
    await api(
      "savings-wallets",
      "POST",
      { name: "Unavailable", target_amount: 10 },
      500,
    );
    await api(
      "savings-wallets/" + first,
      "PATCH",
      { name: "Unavailable" },
      500,
    );
    await api("savings-wallets/" + first, "DELETE", undefined, 500);
    await api("savings-wallets/" + first + "/close", "PATCH", undefined, 500);
    await api("savings-wallets/summary", "GET", undefined, 500);
    await api("savings-wallets/allocations/global", "GET", undefined, 500);
    await api(
      "savings-wallets/allocations/global",
      "POST",
      { allocations: [] },
      500,
    );
  });
  await outage("savings_wallet_allocations", async () => {
    await api(
      "savings-wallets/allocations/" + transactionId,
      "GET",
      undefined,
      500,
    );
    await api(
      "savings-wallets/allocations/batch",
      "POST",
      { transaction_ids: [transactionId] },
      500,
    );
    await api(
      "savings-wallets/allocations",
      "POST",
      { transaction_id: transactionId, allocations: [] },
      500,
    );
  });
  expect(
    (await api("savings-wallets/allocations/" + transactionId)).some(
      (a) => a.walletId === first && a.amount === 40,
    ),
  ).toBe(true);
});
test("advanced recurrence calendars accept valid schedules and reject malformed month lists", async () => {
  const {
    recurringTransactionSchema,
  } = require("../../schemas/recurring-transaction.schema");
  const base = recurringPayload();
  for (const extra of [
    { recurrence_kind: "seasonal", active_months: "[1,6,12]" },
    { frequency: "yearly", active_months: "12" },
    { frequency: "biannual", active_months: "[1,7]" },
    { frequency: "quarterly", active_months: "1,5,9" },
    { recurrence_kind: "installment", start_month: 1, occurrences: 3 },
  ])
    expect(
      recurringTransactionSchema.validate({ ...base, ...extra }).error,
    ).toBeUndefined();
  for (const months of [" ", "[", "[]", "[0,13]", '[1,"2"]', "1,invalid"])
    expect(
      recurringTransactionSchema.validate({
        ...base,
        recurrence_kind: "seasonal",
        active_months: months,
      }).error,
    ).toBeDefined();
  expect(
    recurringTransactionSchema.validate({
      ...base,
      frequency: "yearly",
      active_months: "1,2",
    }).error,
  ).toBeDefined();
  const id = (
    await api(
      "recurring-transactions",
      "POST",
      { ...base, recurrence_kind: "seasonal", active_months: "[1,6]" },
      201,
    )
  ).id;
  await api("recurring-transactions/" + id, "PUT", {
    ...base,
    frequency: "yearly",
    active_months: "[12]",
  });
  await outage("recurring_transaction_history", async () => {
    await api(
      "recurring-transactions/" + id + "/history",
      "GET",
      undefined,
      500,
    );
    await api(
      "recurring-transactions/" + id + "/history",
      "POST",
      { amount: 30 },
      500,
    );
  });
  await outage("recurring_occurrence_exceptions", async () => {
    await api(
      "recurring-transactions/occurrence-exceptions",
      "GET",
      undefined,
      500,
    );
    await api(
      "recurring-transactions/" + id + "/occurrence-exception",
      "PUT",
      { occurrenceDate: "2026-10-12" },
      500,
    );
  });
  const History = require("../../models/recurring-transaction-history.model");
  await expect(History.addEntry({ amount: 1 })).rejects.toThrow();
  await expect(
    History.addEntry({ recurringId: id, amount: "bad" }),
  ).rejects.toThrow();
  await expect(
    History.addEntry({ recurringId: id, amount: 1 }),
  ).resolves.toHaveProperty("id");
  await api("sub-categories/nope", "DELETE", undefined, 400);
  await api("sub-categories/999999", "DELETE", undefined, 404);
  await api("sub-categories/999999", "PUT", { label: "Missing" }, 500);
});
