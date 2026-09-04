import { TransactionListComponent } from './transaction-list.component';
import { RecurringTransaction } from '../../models/recurring-transaction.model';

describe('TransactionListComponent recurring expenses', () => {
  it('sums the exact remaining expense occurrences', () => {
    const component = new TransactionListComponent(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
    const now = new Date();
    const occurrenceDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const recurring = (
      id: number,
      amount: number,
      financialFlowId = 2,
    ): RecurringTransaction => ({
      id,
      label: `Recurring ${id}`,
      amount,
      dayOfMonth: 1,
      subCategoryId: 1,
      accountId: 1,
      financialFlowId,
      frequency: 'monthly',
      isActive: 1,
      debit503020: 1,
    });

    component.accountId = 1;
    component.recurringTransactions = [
      recurring(1, 100),
      recurring(2, 50),
      recurring(3, 30),
      recurring(4, 1000, 1),
    ];
    component.transactions = [
      {
        id: 1,
        description: 'Paid with a different amount',
        amount: 83,
        date: occurrenceDate,
        recurringOccurrenceDate: occurrenceDate,
        recurringTransactionId: 1,
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 2,
      },
    ];
    const dateKey = (component as any).toDateKey(occurrenceDate);
    component.occurrenceExceptions = new Map([
      [
        `2:${dateKey}`,
        { recurringId: 2, occurrenceDate: dateKey, amount: null, isSkipped: true },
      ],
      [
        `3:${dateKey}`,
        { recurringId: 3, occurrenceDate: dateKey, amount: 35, isSkipped: false },
      ],
    ]);

    (component as any).calculateRecurringBreakdown();

    expect(component.remainingExpensesThisMonth).toBe(35);
  });
});
