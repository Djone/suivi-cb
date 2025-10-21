// backend/tests/controllers/transaction.controller.test.js
const transactionController = require('../../controllers/transaction.controller');
const Transaction = require('../../models/transaction.model');

// Mock du modèle
jest.mock('../../models/transaction.model');

describe('Transaction Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllTransactions', () => {
    it('devrait retourner toutes les transactions avec code 200', async () => {
      const mockTransactions = [
        { id: 1, description: 'Test 1', amount: 100 },
        { id: 2, description: 'Test 2', amount: 200 }
      ];

      Transaction.getAll.mockResolvedValue(mockTransactions);

      await transactionController.getAllTransactions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockTransactions);
    });

    it('devrait filtrer par account_id et financial_flow_id', async () => {
      req.query = { account_id: '1', financial_flow_id: '2' };

      Transaction.getAll.mockResolvedValue([]);

      await transactionController.getAllTransactions(req, res);

      expect(Transaction.getAll).toHaveBeenCalledWith({
        account_id: '1',
        financial_flow_id: '2'
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('devrait retourner 500 en cas d\'erreur', async () => {
      Transaction.getAll.mockRejectedValue(new Error('Database error'));

      await transactionController.getAllTransactions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erreur interne du serveur' });
    });
  });

  describe('addTransaction', () => {
    it('devrait ajouter une transaction avec code 201', async () => {
      req.body = {
        date: '2024-01-01',
        amount: 100,
        description: 'Test transaction',
        sub_category_id: 1,
        account_id: 1,
        financial_flow_id: 1
      };

      Transaction.add.mockResolvedValue({ id: 5 });

      await transactionController.addTransaction(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Transaction ajoutée avec succès',
        id: 5
      });
    });

    it('devrait retourner 500 en cas d\'erreur', async () => {
      req.body = {
        date: '2024-01-01',
        amount: 100,
        description: 'Test transaction',
        sub_category_id: 1,
        account_id: 1,
        financial_flow_id: 1
      };

      Transaction.add.mockRejectedValue(new Error('Insert failed'));

      await transactionController.addTransaction(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Erreur interne du serveur lors de l\'ajout de la transaction'
      });
    });
  });

  describe('updateTransaction', () => {
    it('devrait mettre à jour une transaction avec code 200', async () => {
      req.params.id = '1';
      req.body = {
        description: 'Updated description',
        amount: 150
      };

      Transaction.update.mockResolvedValue({ id: 1, changes: 1 });

      await transactionController.updateTransaction(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Transaction mise à jour avec succès.',
        changes: 1
      });
    });

    it('devrait retourner 400 si l\'ID est manquant', async () => {
      req.params = {};
      req.body = { description: 'Test' };

      await transactionController.updateTransaction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ID de la transaction manquant.' });
    });

    it('devrait retourner 500 en cas d\'erreur', async () => {
      req.params.id = '1';
      req.body = { description: 'Test' };

      Transaction.update.mockRejectedValue(new Error('Update failed'));

      await transactionController.updateTransaction(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteTransactionById', () => {
    it('devrait supprimer une transaction avec code 200', async () => {
      req.params.id = '1';

      Transaction.deleteById.mockResolvedValue();

      await transactionController.deleteTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Transaction supprimée avec succès.' });
    });

    it('devrait retourner 400 si l\'ID est invalide', async () => {
      req.params.id = 'invalid';

      await transactionController.deleteTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'ID invalide pour la suppression.' });
    });

    it('devrait retourner 404 si la transaction n\'existe pas', async () => {
      req.params.id = '999';

      Transaction.deleteById.mockRejectedValue(new Error('Aucune transaction trouvée avec cet ID.'));

      await transactionController.deleteTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Aucune transaction trouvée avec cet ID.' });
    });
  });
});
