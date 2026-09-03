const SavingAccount = require('../../models/saving-account.model');
const db = require('../../config/db');

jest.mock('../../config/db');

describe('SavingAccount Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('calcule le solde Plum depuis les mouvements disponibles et non les objectifs', async () => {
      db.all.mockImplementation((query, params, callback) => {
        expect(query).not.toContain('SUM(current_allocated_amount)');
        expect(query).toContain("sa.provider_key = 'plum' AND t.saving_account_id IS NULL");
        expect(query).toContain('t.saving_account_id = sa.id');
        callback(null, [
          {
            id: 1,
            name: 'PLUM',
            provider_key: 'plum',
            base_balance: 0,
            current_balance: 258.39,
          },
        ]);
      });

      const accounts = await SavingAccount.getAll();

      expect(accounts[0]).toMatchObject({
        providerKey: 'plum',
        baseBalance: 0,
        currentBalance: 258.39,
      });
    });
  });
});
