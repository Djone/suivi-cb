// frontend/src/app/services/transaction.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { FilterManagerService } from './filter-manager.service';
import { Transaction } from '../models/transaction.model';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;
  let filterManager: FilterManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TransactionService, FilterManagerService]
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
    filterManager = TestBed.inject(FilterManagerService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTransactions', () => {
    it('devrait récupérer les transactions et les convertir en camelCase', (done) => {
      const mockTransactions = [
        {
          id: 1,
          description: 'Test 1',
          amount: 100,
          date: '2024-01-01',
          account_id: 1,
          financial_flow_id: 1,
          sub_category_id: 1
        }
      ];

      service.getTransactions().subscribe((transactions) => {
        expect(transactions).toBeDefined();
        expect(transactions.length).toBe(1);
        expect(transactions[0].accountId).toBe(1); // Vérifie la conversion en camelCase
        expect(transactions[0].financialFlowId).toBe(1);
        expect(transactions[0].subCategoryId).toBe(1);
        done();
      });

      const req = httpMock.expectOne('http://localhost:3000/api/transactions');
      expect(req.request.method).toBe('GET');
      req.flush(mockTransactions);
    });

    it('devrait appliquer les filtres depuis FilterManager', (done) => {
      filterManager.setFilters({ accountId: 1, financialFlowId: 2 });

      service.getTransactions().subscribe();

      const req = httpMock.expectOne((request) => {
        return request.url === 'http://localhost:3000/api/transactions' &&
               request.params.get('account_id') === '1' &&
               request.params.get('financial_flow_id') === '2';
      });
      expect(req.request.method).toBe('GET');
      req.flush([]);
      done();
    });

    it('devrait gérer les erreurs HTTP', (done) => {
      service.getTransactions().subscribe({
        next: () => fail('devrait échouer'),
        error: (error) => {
          expect(error).toBeDefined();
          done();
        }
      });

      const req = httpMock.expectOne('http://localhost:3000/api/transactions');
      req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    });
  });

  describe('addTransaction', () => {
    it('devrait ajouter une transaction et convertir en snake_case', (done) => {
      const newTransaction: Transaction = {
        description: 'New Transaction',
        amount: 150,
        date: new Date('2024-01-01'),
        accountId: 1,
        financialFlowId: 1,
        subCategoryId: 1,
        id: null
      };

      service.addTransaction(newTransaction).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('http://localhost:3000/api/transactions');
      expect(req.request.method).toBe('POST');

      // Vérifie que les données envoyées sont en snake_case
      expect(req.request.body.account_id).toBe(1);
      expect(req.request.body.financial_flow_id).toBe(1);
      expect(req.request.body.sub_category_id).toBe(1);

      req.flush({ id: 5 });
    });
  });

  describe('updateTransaction', () => {
    it('devrait mettre à jour une transaction', (done) => {
      const id = 1;
      const updates: Partial<Transaction> = {
        description: 'Updated',
        amount: 200
      };

      service.updateTransaction(id, updates).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('http://localhost:3000/api/transactions/1');
      expect(req.request.method).toBe('PUT');
      req.flush({ message: 'success' });
    });
  });

  describe('deleteTransaction', () => {
    it('devrait supprimer une transaction', (done) => {
      service.deleteTransaction(1).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne('http://localhost:3000/api/transactions/1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'deleted' });
    });
  });

  describe('loadTransactions', () => {
    it('devrait déclencher le chargement des transactions', () => {
      spyOn(service, 'getTransactions').and.returnValue(service.transactions$);

      service.loadTransactions();

      expect(service.getTransactions).toHaveBeenCalled();
    });
  });
});
