module.exports = async function migrateSalaryTracker(db) {
  await new Promise((resolve, reject) =>
    db.run(
      "CREATE TABLE IF NOT EXISTS salary_annual (year INTEGER PRIMARY KEY, rfr REAL, ir REAL)",
      (error) => (error ? reject(error) : resolve()),
    ),
  );
  await new Promise((resolve, reject) =>
    db.run(
      `
    CREATE TABLE IF NOT EXISTS salary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      ets TEXT NOT NULL,
      company TEXT NOT NULL,
      gross REAL NOT NULL,
      net REAL NOT NULL,
      net_taxable REAL NOT NULL,
      pas REAL NOT NULL DEFAULT 0,
      rounding REAL NOT NULL DEFAULT 0,
      bonus REAL NOT NULL DEFAULT 0,
      donations REAL NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      tenure_start TEXT
    )
  `,
      (error) => (error ? reject(error) : resolve()),
    ),
  );
};
