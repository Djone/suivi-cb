const db = require('../config/db');
const humps = require('humps');

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows))),
  );
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (error) {
      error ? reject(error) : resolve({ id: this.lastID, changes: this.changes });
    }),
  );

const Vehicle = {
  async getAll() {
    const rows = await all('SELECT * FROM vehicles ORDER BY is_active DESC, name ASC');
    return rows.map((row) => humps.camelizeKeys(row));
  },

  async add(vehicle) {
    return run(
      `INSERT INTO vehicles
       (name, brand, model, energy_type, registration, acquisition_date,
        purchase_price, annual_distance, consumption_per_100, energy_price, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        vehicle.name,
        vehicle.brand || null,
        vehicle.model || null,
        vehicle.energy_type,
        vehicle.registration || null,
        vehicle.acquisition_date || null,
        vehicle.purchase_price ?? null,
        vehicle.annual_distance ?? null,
        vehicle.consumption_per_100 ?? null,
        vehicle.energy_price ?? null,
      ],
    );
  },

  async update(id, vehicle) {
    const allowed = [
      'name', 'brand', 'model', 'energy_type', 'registration',
      'acquisition_date', 'purchase_price', 'annual_distance',
      'consumption_per_100', 'energy_price', 'is_active',
    ];
    const fields = [];
    const params = [];
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(vehicle, field)) {
        fields.push(`${field} = ?`);
        params.push(vehicle[field]);
      }
    });
    if (!fields.length) throw new Error('Aucun champ a modifier.');
    params.push(id);
    return run(`UPDATE vehicles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  },

  async getOperations() {
    const rows = await all(`
      SELECT vo.*, sc.label AS sub_category_label, c.label AS category_label
      FROM vehicle_operations vo
      LEFT JOIN subcategories sc ON sc.id = vo.sub_category_id
      LEFT JOIN categories c ON c.id = sc.category_id
      ORDER BY vo.date DESC, vo.id DESC
    `);
    return rows.map((row) => humps.camelizeKeys(row));
  },

  addOperation(operation) {
    return run(
      `INSERT INTO vehicle_operations (date, label, amount, sub_category_id, vehicle_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        operation.date,
        operation.label,
        operation.amount,
        operation.sub_category_id,
        operation.vehicle_id,
      ],
    );
  },

  deleteOperation(id) {
    return run('DELETE FROM vehicle_operations WHERE id = ?', [id]);
  },
};

module.exports = Vehicle;
