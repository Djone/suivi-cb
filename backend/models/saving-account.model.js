const humps = require('humps');
const db = require('../config/db');

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const dbGet = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const dbRun = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function (err) {
    if (err) return reject(err);
    resolve({ changes: this.changes });
  });
});

const selectQuery = `
  SELECT
    sa.id,
    sa.name,
    sa.bank_name,
    sa.provider_key,
    sa.role,
    sa.liquidity_level,
    sa.current_balance AS base_balance,
    sa.target_balance,
    sa.minimum_balance,
    sa.include_in_daily_budget,
    sa.include_in_wealth,
    sa.is_active,
    sa.created_at,
    sa.updated_at,
    CASE WHEN sa.provider_key = 'plum' THEN COALESCE((
      SELECT SUM(current_allocated_amount) FROM savings_wallets WHERE is_active = 1
    ), 0) ELSE sa.current_balance + COALESCE((
      SELECT SUM(
        CASE
          WHEN t.financial_flow_id = 2 THEN t.amount
          WHEN t.financial_flow_id = 1 THEN -t.amount
          ELSE 0
        END
      )
      FROM transactions t
      WHERE t.saving_account_id = sa.id
        AND t.is_internal_transfer = 1
    ), 0) END AS current_balance
  FROM saving_accounts sa
`;

const SavingAccount = {
  getAll: async () => {
    const rows = await dbAll(`${selectQuery} WHERE sa.is_active = 1 ORDER BY sa.id ASC`);
    return rows.map((row) => humps.camelizeKeys(row));
  },
  getById: async (id) => {
    const row = await dbGet(`${selectQuery} WHERE sa.id = ?`, [id]);
    return row ? humps.camelizeKeys(row) : null;
  },
  update: async (id, account) => {
    const result = await dbRun(
      `UPDATE saving_accounts SET current_balance = ?, target_balance = ?, minimum_balance = ?,
       include_in_daily_budget = ?, include_in_wealth = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [account.currentBalance, account.targetBalance, account.minimumBalance,
        account.includeInDailyBudget ? 1 : 0, account.includeInWealth ? 1 : 0, id],
    );
    return result.changes > 0;
  },
};

module.exports = SavingAccount;
