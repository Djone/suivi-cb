const db = require('../config/db');

const all = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const run = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

module.exports = {
  getAll: (accountId) =>
    all(
      `SELECT roe.* FROM recurring_occurrence_exceptions roe
       JOIN recurring_transactions rt ON rt.id = roe.recurring_id
       WHERE (? IS NULL OR rt.account_id = ?)
       ORDER BY roe.occurrence_date`,
      [accountId || null, accountId || null],
    ),
  upsert: ({ recurringId, occurrenceDate, amount, isSkipped }) =>
    run(
      `INSERT INTO recurring_occurrence_exceptions
         (recurring_id, occurrence_date, amount, is_skipped)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(recurring_id, occurrence_date) DO UPDATE SET
         amount = excluded.amount, is_skipped = excluded.is_skipped,
         updated_at = CURRENT_TIMESTAMP`,
      [recurringId, occurrenceDate, amount ?? null, isSkipped ? 1 : 0],
    ),
};
