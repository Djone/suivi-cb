const db = require('../config/db');
const logger = require('../utils/logger');

const DEFAULT_CONFIG = {
  members: [
    { id: 'A', name: 'A', color: '#6366F1', income: 0 },
    { id: 'B', name: 'B', color: '#10B981', income: 0 },
  ],
  lines: [],
  customProrataA: 50,
  ignoredRecurringIds: [],
};

const runQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

async function ensureTable() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS couple_split_configs (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      members_json TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      custom_prorata_a REAL NOT NULL DEFAULT 50,
      ignored_recurring_ids TEXT NOT NULL DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await runQuery(
    `ALTER TABLE couple_split_configs ADD COLUMN ignored_recurring_ids TEXT NOT NULL DEFAULT '[]';`,
  ).catch(() => {});
}

async function ensureSeed() {
  await ensureTable();
  const row = await getQuery('SELECT COUNT(*) as count FROM couple_split_configs');
  if (!row || row.count === 0) {
    await runQuery(
      `INSERT INTO couple_split_configs (id, members_json, lines_json, custom_prorata_a)
       VALUES (1, ?, ?, 50)`,
      [JSON.stringify(DEFAULT_CONFIG.members), JSON.stringify(DEFAULT_CONFIG.lines)],
    );
    logger.info('Seeded default couple_split_configs row.');
  }
}

function serializeConfig(config) {
  return {
    members_json: JSON.stringify(config.members ?? DEFAULT_CONFIG.members),
    lines_json: JSON.stringify(config.lines ?? DEFAULT_CONFIG.lines),
    custom_prorata_a:
      typeof config.customProrataA === 'number' ? config.customProrataA : DEFAULT_CONFIG.customProrataA,
    ignored_recurring_ids: JSON.stringify(config.ignoredRecurringIds ?? DEFAULT_CONFIG.ignoredRecurringIds),
  };
}

function mapRowToConfig(row) {
  if (!row) {
    return { ...DEFAULT_CONFIG };
  }
  let members = DEFAULT_CONFIG.members;
  let lines = DEFAULT_CONFIG.lines;
  try {
    members = JSON.parse(row.members_json || '[]');
  } catch {
    members = DEFAULT_CONFIG.members;
  }
  try {
    lines = JSON.parse(row.lines_json || '[]');
  } catch {
    lines = DEFAULT_CONFIG.lines;
  }
  let ignoredRecurringIds = DEFAULT_CONFIG.ignoredRecurringIds;
  try {
    ignoredRecurringIds = JSON.parse(row.ignored_recurring_ids || '[]');
  } catch {
    ignoredRecurringIds = DEFAULT_CONFIG.ignoredRecurringIds;
  }

  return {
    members,
    lines,
    customProrataA:
      typeof row.custom_prorata_a === 'number' ? row.custom_prorata_a : DEFAULT_CONFIG.customProrataA,
    ignoredRecurringIds,
  };
}

async function getConfig() {
  await ensureSeed();
  const row = await getQuery(
    'SELECT members_json, lines_json, custom_prorata_a, ignored_recurring_ids FROM couple_split_configs WHERE id = 1',
  );
  return mapRowToConfig(row);
}

async function saveConfig(config) {
  await ensureSeed();
  const serialized = serializeConfig(config);
  const updateResult = await runQuery(
    `UPDATE couple_split_configs
     SET members_json = ?, lines_json = ?, custom_prorata_a = ?, ignored_recurring_ids = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      serialized.members_json,
      serialized.lines_json,
      serialized.custom_prorata_a,
      serialized.ignored_recurring_ids,
    ],
  );
  if (updateResult.changes === 0) {
    await runQuery(
      `INSERT INTO couple_split_configs (id, members_json, lines_json, custom_prorata_a, ignored_recurring_ids)
       VALUES (1, ?, ?, ?, ?)`,
      [
        serialized.members_json,
        serialized.lines_json,
        serialized.custom_prorata_a,
        serialized.ignored_recurring_ids,
      ],
    );
  }
  return getConfig();
}

async function getRecurringLines() {
  await ensureSeed();
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        rt.id,
        rt.label,
        rt.amount,
        rt.account_id,
        a.name AS account_name,
        sc.label AS subcategory_label,
        c.label AS category_label
      FROM recurring_transactions rt
      LEFT JOIN accounts a ON a.id = rt.account_id
      LEFT JOIN subcategories sc ON sc.id = rt.sub_category_id
      LEFT JOIN categories c ON c.id = sc.category_id
      WHERE rt.financial_flow_id = 2 AND rt.is_active = 1
      ORDER BY rt.day_of_month ASC;
    `;
    db.all(query, [], (err, rows) => {
      if (err) {
        return reject(err);
      }
      const lines = (rows || []).map((row) => ({
        id: row.id,
        label: row.label,
        categoryLabel: row.subcategory_label || row.category_label || '',
        accountId: row.account_id,
        accountName: row.account_name || null,
        amount: Math.abs(row.amount || 0),
        mode: 'prorata',
        fixedRatioA: 50,
        payer: 'A',
        source: 'recurring',
      }));
      resolve(lines);
    });
  });
}

module.exports = {
  getConfig,
  saveConfig,
  getRecurringLines,
  DEFAULT_CONFIG,
};
