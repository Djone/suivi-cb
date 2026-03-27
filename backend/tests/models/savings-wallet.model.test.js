const SavingsWallet = require('../../models/savings-wallet.model');
const db = require('../../config/db');

jest.mock('../../config/db');

describe('SavingsWallet Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it("ecrete l'allocation courante quand l'objectif baisse", async () => {
      db.run.mockImplementation(function (query, params, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      const updated = await SavingsWallet.update(4, { targetAmount: 125 });

      expect(updated).toBe(true);
      expect(db.run).toHaveBeenCalledTimes(1);
      expect(db.run.mock.calls[0][0]).toContain(
        'current_allocated_amount = MIN(MAX(COALESCE(current_allocated_amount, 0), 0), ?)',
      );
      expect(db.run.mock.calls[0][1]).toEqual([125, 125, 4]);
    });
  });

  describe('getAllocationSummary', () => {
    it("borne l'allocation active entre 0 et l'objectif et remet l'excedent dans le reste a repartir", async () => {
      db.all.mockImplementation((query, params, callback) => {
        callback(null, [
          {
            id: 7,
            name: 'Vacances',
            target_amount: 100,
            is_active: 1,
            closed_target_amount: null,
            closed_allocated_amount: null,
            closed_remaining_amount: null,
            allocated_amount: 160,
          },
        ]);
      });

      const summary = await SavingsWallet.getAllocationSummary({ includeClosed: true });

      expect(summary).toEqual([
        {
          id: 7,
          name: 'Vacances',
          targetAmount: 100,
          allocatedAmount: 100,
          remainingAmount: 0,
          isActive: true,
          progressRate: 100,
        },
      ]);
    });
  });
});
