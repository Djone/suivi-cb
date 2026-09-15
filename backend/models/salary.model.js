const db = require("../config/db");
const humps = require("humps");
const fields = [
  "month",
  "ets",
  "company",
  "gross",
  "net",
  "net_taxable",
  "pas",
  "rounding",
  "bonus",
  "donations",
  "comment",
  "tenure_start",
];
const run = (sql, params) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      error
        ? reject(error)
        : resolve({ id: this.lastID, changes: this.changes });
    });
  });
module.exports = {
  getAll() {
    return new Promise((resolve, reject) =>
      db.all(
        "SELECT * FROM salary_entries ORDER BY month DESC, id DESC",
        [],
        (error, rows) =>
          error ? reject(error) : resolve(humps.camelizeKeys(rows)),
      ),
    );
  },
  save(id, entry) {
    const data = humps.decamelizeKeys(entry);
    const values = fields.map((field) => data[field] ?? null);
    return id
      ? run(
          "UPDATE salary_entries SET " +
            fields.map((f) => f + " = ?").join(", ") +
            " WHERE id = ?",
          [...values, id],
        )
      : run(
          "INSERT INTO salary_entries (" +
            fields.join(", ") +
            ") VALUES (" +
            fields.map(() => "?").join(", ") +
            ")",
          values,
        );
  },
  delete(id) {
    return run("DELETE FROM salary_entries WHERE id = ?", [id]);
  },
};
