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
        if (query.includes('FROM transactions t')) {
          callback(null, [{ net_amount: 160 }]);
          return;
        }

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

    it("ecrete les allocations actives quand le total alloue depasse l'epargne disponible", async () => {
      db.all.mockImplementation((query, params, callback) => {
        if (query.includes('FROM transactions t')) {
          callback(null, [{ net_amount: 258.39 }]);
          return;
        }

        callback(null, [
          {
            id: 1,
            name: 'Coussin',
            target_amount: 200,
            is_active: 1,
            closed_target_amount: null,
            closed_allocated_amount: null,
            closed_remaining_amount: null,
            allocated_amount: 200,
          },
          {
            id: 2,
            name: 'Vacances',
            target_amount: 200,
            is_active: 1,
            closed_target_amount: null,
            closed_allocated_amount: null,
            closed_remaining_amount: null,
            allocated_amount: 150,
          },
        ]);
      });

      const summary = await SavingsWallet.getAllocationSummary({ includeClosed: true });

      expect(summary).toEqual([
        {
          id: 1,
          name: 'Coussin',
          targetAmount: 200,
          allocatedAmount: 200,
          remainingAmount: 0,
          isActive: true,
          progressRate: 100,
        },
        {
          id: 2,
          name: 'Vacances',
          targetAmount: 200,
          allocatedAmount: 58.39,
          remainingAmount: 141.61,
          isActive: true,
          progressRate: 29.195,
        },
      ]);
    });
  });
});
