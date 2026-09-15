jest.mock(
  "../../config/db",
  () => new (require("sqlite3").verbose().Database)(":memory:"),
);
const db = require("../../config/db");
const Salary = require("../../models/salary.model");
const migrate = require("../../migrations/salary-tracker");
const schema = require("../../schemas/salary.schema");
const controller = require("../../controllers/salary.controller");
const sample = {
  month: "2026-01-01",
  ets: "CST",
  company: "Entreprise",
  gross: 4000.42,
  net: 3000.12,
  netTaxable: 3200.15,
  pas: 150.25,
  rounding: -0.12,
  bonus: 200,
  donations: 50,
  comment: "Prime d'hiver",
  tenureStart: "2019-01-20",
};
beforeAll(async () => {
  await migrate(db);
  await migrate(db);
});
afterAll(() => new Promise((resolve) => db.close(resolve)));
beforeEach(
  () =>
    new Promise((resolve, reject) =>
      db.run("DELETE FROM salary_entries", (e) => (e ? reject(e) : resolve())),
    ),
);

test("persists and reloads every payslip field, updates gross and deletes", async () => {
  const result = await Salary.save(null, sample);
  expect(await Salary.getAll()).toEqual([{ id: result.id, ...sample }]);
  await Salary.save(result.id, { ...sample, gross: 4500.25 });
  expect((await Salary.getAll())[0].gross).toBe(4500.25);
  expect((await Salary.delete(result.id)).changes).toBe(1);
  expect(await Salary.getAll()).toEqual([]);
});
test("sorts by month and supports multiple employers within a month", async () => {
  await Salary.save(null, sample);
  await Salary.save(null, { ...sample, month: "2025-01-01" });
  await Salary.save(null, { ...sample, company: "Autre employeur" });
  expect((await Salary.getAll()).map((e) => e.month)).toEqual([
    "2026-01-01",
    "2026-01-01",
    "2025-01-01",
  ]);
});
test.each([
  { gross: -1 },
  { gross: null },
  { gross: "4000" },
  { net: Infinity },
  { month: "2026-13-01" },
  { month: "2026-01-15" },
  { company: "x".repeat(201) },
  { ets: "INVALID" },
  { netTaxable: 123.456 },
])("rejects invalid input %j", (change) => {
  expect(schema.validate({ ...sample, ...change }).error).toBeDefined();
});
test("accepts gross, signed rounding and optional fields", () => {
  expect(schema.validate(sample).error).toBeUndefined();
});
test("saves a payslip with only the five required fields", async () => {
  const payload = {
    month: "2026-08-01",
    ets: "CST",
    gross: 4000,
    net: 3100,
    netTaxable: 2973.11,
  };
  const { value, error } = schema.validate(payload);
  expect(error).toBeUndefined();
  await Salary.save(null, value);
  expect((await Salary.getAll())[0]).toEqual(
    expect.objectContaining({
      ...payload,
      company: "",
      donations: 0,
      tenureStart: null,
    }),
  );
});
test.each(["month", "ets", "gross", "net", "netTaxable"])(
  "requires %s",
  (field) => {
    const payload = { ...sample };
    delete payload[field];
    expect(schema.validate(payload).error).toBeDefined();
  },
);
test("returns 404 for edits and deletion of missing records", async () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
  await controller.save({ params: { id: "999" }, body: sample }, res);
  expect(res.status).toHaveBeenCalledWith(404);
  res.status.mockClear();
  await controller.delete({ params: { id: "999" } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});
