// backend/tests/models/transaction.model.test.js
const Transaction = require('../../models/transaction.model');
const db = require('../../config/db');

// Mock de la base de données
jest.mock('../../config/db');

describe('Transaction Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('devrait récupérer toutes les transactions sans filtre', async () => {
      const mockTransactions = [
        { id: 1, description: 'Test 1', amount: 100, date: '2024-01-01', account_id: 1, financial_flow_id: 1, sub_category_id: 1 },
        { id: 2, description: 'Test 2', amount: 200, date: '2024-01-02', account_id: 1, financial_flow_id: 1, sub_category_id: 1 }
      ];

      db.all.mockImplementation((query, params, callback) => {
        callback(null, mockTransactions);
      });

      const result = await Transaction.getAll({});

      expect(result).toEqual(mockTransactions);
      expect(db.all).toHaveBeenCalledTimes(1);
    });

    it('devrait filtrer par account_id', async () => {
      const mockTransactions = [
        { id: 1, description: 'Test 1', amount: 100, date: '2024-01-01', account_id: 1, financial_flow_id: 1, sub_category_id: 1 }
      ];

      db.all.mockImplementation((query, params, callback) => {
        expect(params).toContain(1);
        callback(null, mockTransactions);
      });

      const result = await Transaction.getAll({ account_id: 1 });

      expect(result).toEqual(mockTransactions);
    });

    it('devrait filtrer par financial_flow_id', async () => {
      const mockTransactions = [
        { id: 1, description: 'Test 1', amount: 100, date: '2024-01-01', account_id: 1, financial_flow_id: 2, sub_category_id: 1 }
      ];

      db.all.mockImplementation((query, params, callback) => {
        expect(params).toContain(2);
        callback(null, mockTransactions);
      });

      const result = await Transaction.getAll({ financial_flow_id: 2 });

      expect(result).toEqual(mockTransactions);
    });

    it('devrait ignorer les colonnes non autorisées (protection SQL injection)', async () => {
      db.all.mockImplementation((query, params, callback) => {
        // Vérifier que la requête ne contient pas de colonnes malveillantes
        expect(query).not.toContain('malicious_column');
        expect(params).toHaveLength(0); // Aucun paramètre ne devrait être ajouté
        callback(null, []);
      });

      await Transaction.getAll({ malicious_column: 'DROP TABLE' });

      expect(db.all).toHaveBeenCalledTimes(1);
    });

    it('devrait gérer les erreurs de base de données', async () => {
      const mockError = new Error('Database error');

      db.all.mockImplementation((query, params, callback) => {
        callback(mockError, null);
      });

      await expect(Transaction.getAll({})).rejects.toThrow('Database error');
    });
  });

  describe('add', () => {
    it('devrait ajouter une nouvelle transaction', async () => {
      const newTransaction = {
        date: '2024-01-01',
        amount: 100,
        description: 'Test transaction',
        sub_category_id: 1,
        account_id: 1,
        financial_flow_id: 1
      };

      db.run.mockImplementation(function(query, values, callback) {
        this.lastID = 5;
        callback.call(this, null);
      });

      const result = await Transaction.add(newTransaction);

      expect(result).toEqual({ id: 5 });
      expect(db.run).toHaveBeenCalledTimes(1);
    });

    it('devrait gérer les erreurs lors de l\'ajout', async () => {
      const newTransaction = {
        date: '2024-01-01',
        amount: 100,
        description: 'Test transaction',
        sub_category_id: 1,
        account_id: 1,
        financial_flow_id: 1
      };

      const mockError = new Error('Insert failed');
      db.run.mockImplementation((query, values, callback) => {
        callback(mockError);
      });

      await expect(Transaction.add(newTransaction)).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('devrait mettre à jour une transaction existante', async () => {
      const updatedTransaction = {
        id: 1,
        description: 'Updated description',
        amount: 150
      };

      db.run.mockImplementation(function(query, values, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      const result = await Transaction.update(updatedTransaction);

      expect(result).toEqual({ id: 1, changes: 1 });
      expect(db.run).toHaveBeenCalledTimes(1);
    });

    it('devrait rejeter si aucun champ à mettre à jour', async () => {
      await expect(Transaction.update({ id: 1 })).rejects.toThrow('Aucun champ à mettre à jour.');
    });

    it('devrait rejeter si la transaction n\'existe pas', async () => {
      db.run.mockImplementation(function(query, values, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      await expect(Transaction.update({ id: 999, description: 'Test' })).rejects.toThrow('Aucune transaction trouvée avec cet ID.');
    });
  });

  describe('deleteById', () => {
    it('devrait supprimer une transaction par ID', async () => {
      db.run.mockImplementation(function(query, values, callback) {
        this.changes = 1;
        callback.call(this, null);
      });

      await expect(Transaction.deleteById(1)).resolves.toBeUndefined();
      expect(db.run).toHaveBeenCalledTimes(1);
    });

    it('devrait rejeter si l\'ID est manquant', async () => {
      await expect(Transaction.deleteById(null)).rejects.toThrow('ID manquant pour la suppression de la transaction.');
    });

    it('devrait rejeter si la transaction n\'existe pas', async () => {
      db.run.mockImplementation(function(query, values, callback) {
        this.changes = 0;
        callback.call(this, null);
      });

      await expect(Transaction.deleteById(999)).rejects.toThrow('Aucune transaction trouvée avec cet ID.');
    });
  });
});
