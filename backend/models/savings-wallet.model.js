const db = require('../config/db');

const dbAll = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const dbRun = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });

const buildFilters = (filters = {}) => {
  const conditions = [];
  const params = [];

  if (filters.accountId !== null && filters.accountId !== undefined) {
    conditions.push('t.account_id = ?');
    params.push(filters.accountId);
  }

  if (filters.year !== null && filters.year !== undefined) {
    conditions.push("strftime('%Y', t.date) = ?");
    params.push(String(filters.year));
  }

  if (filters.month !== null && filters.month !== undefined) {
    const monthPadded = String(Number(filters.month) + 1).padStart(2, '0');
    conditions.push("strftime('%m', t.date) = ?");
    params.push(monthPadded);
  }

  if (filters.flow === 'incoming' || filters.flow === 'outgoing') {
    const compare = filters.flow === 'incoming' ? '>' : '<';
    conditions.push(
      `(CASE WHEN t.financial_flow_id = 1 THEN -t.amount ELSE t.amount END) ${compare} 0`,
    );
  }

  return { conditions, params };
};

const SavingsWallet = {
  getAll: async (filters = {}) => {
    const includeClosed = filters.includeClosed === true;
    const whereClause = includeClosed ? '' : 'WHERE is_active = 1';
    const rows = await dbAll(
      `
      SELECT
        id,
        name,
        target_amount AS target_amount,
        is_active AS is_active,
        closed_target_amount AS closed_target_amount,
        closed_allocated_amount AS closed_allocated_amount,
        closed_remaining_amount AS closed_remaining_amount
      FROM savings_wallets
      ${whereClause}
      ORDER BY name ASC
      `,
    );
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      targetAmount: Number(row.target_amount),
      isActive: Number(row.is_active) === 1,
      closedTargetAmount:
        row.closed_target_amount === null ? null : Number(row.closed_target_amount),
      closedAllocatedAmount:
        row.closed_allocated_amount === null
          ? null
          : Number(row.closed_allocated_amount),
      closedRemainingAmount:
        row.closed_remaining_amount === null
          ? null
          : Number(row.closed_remaining_amount),
    }));
  },

  create: async ({ name, targetAmount }) => {
    const query =
      'INSERT INTO savings_wallets (name, target_amount) VALUES (?, ?)';
    const result = await dbRun(query, [name, targetAmount]);
    return { id: result.lastID };
  },

  update: async (id, { name, targetAmount, isActive }) => {
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (targetAmount !== undefined) {
      fields.push('target_amount = ?');
      params.push(targetAmount);
    }

    if (isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (!fields.length) {
      return false;
    }

    params.push(id);
    const result = await dbRun(
      `
      UPDATE savings_wallets
      SET ${fields.join(', ')}
      WHERE id = ?
      `,
      params,
    );
    return Number(result?.changes || 0) > 0;
  },

  getAllocationSummary: async (filters = {}) => {
    const { conditions, params } = buildFilters(filters);
    const includeClosed = filters.includeClosed === true;
    const walletCondition = includeClosed ? '' : 'WHERE w.is_active = 1';
    const query = `
      SELECT
        w.id,
        w.name,
        w.target_amount AS target_amount,
        w.is_active AS is_active,
        w.closed_target_amount AS closed_target_amount,
        w.closed_allocated_amount AS closed_allocated_amount,
        w.closed_remaining_amount AS closed_remaining_amount,
        COALESCE(
          SUM(
            CASE
              WHEN t.is_internal_transfer = 1
                AND ${conditions.length ? conditions.join(' AND ') : '1 = 1'}
              THEN swa.amount
              ELSE 0
            END
          ),
          0
        ) AS allocated_amount
      FROM savings_wallets w
      LEFT JOIN savings_wallet_allocations swa ON swa.wallet_id = w.id
      LEFT JOIN transactions t ON t.id = swa.transaction_id
      ${walletCondition}
      GROUP BY w.id, w.name, w.target_amount, w.is_active
      ORDER BY w.name ASC
    `;

    const summaryRows = await dbAll(query, params);
    return summaryRows.map((row) => {
      const isActive = Number(row.is_active) === 1;
      const targetAmount = Number(
        isActive ? row.target_amount ?? 0 : row.closed_target_amount ?? row.target_amount ?? 0,
      );
      const allocatedAmount = Number(
        isActive
          ? row.allocated_amount ?? 0
          : row.closed_allocated_amount ?? row.allocated_amount ?? 0,
      );
      const remainingAmount = Number(
        isActive
          ? targetAmount - allocatedAmount
          : row.closed_remaining_amount ?? targetAmount - allocatedAmount,
      );
      return {
        id: Number(row.id),
        name: row.name,
        targetAmount,
        allocatedAmount,
        remainingAmount,
        isActive,
        progressRate:
          targetAmount > 0
            ? Math.min((allocatedAmount / targetAmount) * 100, 100)
            : 0,
      };
    });
  },

  getAllocationsByTransaction: async (transactionId) => {
    const rows = await dbAll(
      `
      SELECT
        transaction_id AS transaction_id,
        wallet_id AS wallet_id,
        amount AS amount
      FROM savings_wallet_allocations
      WHERE transaction_id = ?
      ORDER BY wallet_id ASC
      `,
      [transactionId],
    );
    return rows.map((row) => ({
      transactionId: Number(row.transaction_id),
      walletId: Number(row.wallet_id),
      amount: Number(row.amount),
    }));
  },

  getAllocationsByTransactions: async (transactionIds = []) => {
    const ids = (transactionIds || []).filter((value) =>
      Number.isFinite(Number(value)),
    );
    if (!ids.length) {
      return [];
    }
    const uniqIds = [...new Set(ids.map((value) => Number(value)))];
    const placeholders = uniqIds.map(() => '?').join(',');
    const rows = await dbAll(
      `
      SELECT
        transaction_id AS transaction_id,
        wallet_id AS wallet_id,
        amount AS amount
      FROM savings_wallet_allocations
      WHERE transaction_id IN (${placeholders})
      ORDER BY transaction_id ASC, wallet_id ASC
      `,
      uniqIds,
    );
    return rows.map((row) => ({
      transactionId: Number(row.transaction_id),
      walletId: Number(row.wallet_id),
      amount: Number(row.amount),
    }));
  },

  setTransactionAllocations: async (transactionId, allocations = []) => {
    const normalized = allocations
      .map((allocation) => ({
        walletId: Number(allocation.walletId),
        amount: Number(allocation.amount),
      }))
      .filter(
        (allocation) =>
          Number.isFinite(allocation.walletId) &&
          Number.isFinite(allocation.amount) &&
          allocation.amount > 0,
      );

    const deduped = new Map();
    normalized.forEach((allocation) => {
      const current = deduped.get(allocation.walletId) || 0;
      deduped.set(allocation.walletId, current + allocation.amount);
    });

    const toInsert = Array.from(deduped.entries()).map(
      ([walletId, amount]) => ({ walletId, amount }),
    );

    await dbRun('BEGIN IMMEDIATE TRANSACTION');
    try {
      await dbRun('DELETE FROM savings_wallet_allocations WHERE transaction_id = ?', [
        transactionId,
      ]);
      for (const allocation of toInsert) {
        await dbRun(
          'INSERT INTO savings_wallet_allocations (transaction_id, wallet_id, amount) VALUES (?, ?, ?)',
          [transactionId, allocation.walletId, allocation.amount],
        );
      }
      await dbRun('COMMIT');
      return;
    } catch (err) {
      await dbRun('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  closeWallet: async (id) => {
    const query = `
      UPDATE savings_wallets
      SET
        is_active = 0,
        closed_target_amount = target_amount,
        closed_allocated_amount = COALESCE((
          SELECT SUM(swa.amount)
          FROM savings_wallet_allocations swa
          JOIN transactions t ON t.id = swa.transaction_id
          WHERE swa.wallet_id = savings_wallets.id
            AND t.is_internal_transfer = 1
        ), 0),
        closed_remaining_amount = target_amount - COALESCE((
          SELECT SUM(swa.amount)
          FROM savings_wallet_allocations swa
          JOIN transactions t ON t.id = swa.transaction_id
          WHERE swa.wallet_id = savings_wallets.id
            AND t.is_internal_transfer = 1
        ), 0)
      WHERE id = ?
    `;
    const result = await dbRun(query, [id]);
    return Number(result?.changes || 0) > 0;
  },

  delete: async (id) => {
    const result = await dbRun('DELETE FROM savings_wallets WHERE id = ?', [id]);
    return Number(result?.changes || 0) > 0;
  },
};

module.exports = SavingsWallet;
