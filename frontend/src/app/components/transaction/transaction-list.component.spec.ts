import { TransactionListComponent } from './transaction-list.component';
import { RecurringTransaction } from '../../models/recurring-transaction.model';

describe('TransactionListComponent recurring expenses', () => {
  const createComponent = () =>
    new TransactionListComponent(
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

  it('sums the exact remaining expense occurrences', () => {
    const component = createComponent();
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
        {
          recurringId: 2,
          occurrenceDate: dateKey,
          amount: null,
          isSkipped: true,
        },
      ],
      [
        `3:${dateKey}`,
        {
          recurringId: 3,
          occurrenceDate: dateKey,
          amount: 35,
          isSkipped: false,
        },
      ],
    ]);

    (component as any).calculateRecurringBreakdown();

    expect(component.remainingExpensesThisMonth).toBe(35);
  });

  it('reselects transactions when switching from current to joint account', () => {
    const component = createComponent();
    component.allTransactions = [
      {
        id: 1,
        description: 'Current account expense',
        amount: 2100.01,
        date: new Date(2026, 8, 4),
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 2,
      },
      {
        id: 2,
        description: 'Joint account net income',
        amount: 1550.32,
        date: new Date(2026, 8, 4),
        subCategoryId: 1,
        accountId: 2,
        financialFlowId: 1,
      },
    ];

    component.accountId = 1;
    component.account = {
      id: 1,
      name: 'Compte courant',
      initialBalance: 2903.4,
    };
    (component as any).selectTransactionsForActiveAccount();
    expect(component.currentBalance).toBeCloseTo(803.39, 2);

    component.accountId = 2;
    component.account = { id: 2, name: 'Compte joint', initialBalance: 355.08 };
    (component as any).selectTransactionsForActiveAccount();

    expect(component.transactions.map((transaction) => transaction.id)).toEqual(
      [2],
    );
    expect(component.currentBalance).toBeCloseTo(1905.4, 2);
  });

  it('groups monthly budget details by subcategory', () => {
    const component = createComponent();
    component.accountId = 1;
    component.recurringTransactions = [
      {
        id: 10,
        label: 'Salary',
        amount: 100,
        dayOfMonth: 1,
        subCategoryId: 7,
        accountId: 1,
        financialFlowId: 1,
        frequency: 'monthly',
        isActive: 1,
        debit503020: null,
      },
      {
        id: 11,
        label: 'Bonus',
        amount: 50,
        dayOfMonth: 15,
        subCategoryId: 7,
        accountId: 1,
        financialFlowId: 1,
        frequency: 'monthly',
        isActive: 1,
        debit503020: null,
      },
    ];
    (component as any).refreshSubCategoryIndex([
      { id: 7, label: 'Salaire', categoryId: 1, categoryLabel: 'Revenus' },
    ]);

    expect(component.getBudgetDetailItems('income')).toEqual([
      { label: 'Salaire', amount: 150, occurrences: 2 },
    ]);
  });

  it('orders budget rows as fixed costs, leisure, then savings', () => {
    const component = createComponent();

    expect(component.getBudgetRows().map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('keeps every budget section collapsed by default', () => {
    const component = createComponent();

    expect(component.isBudgetSectionExpanded('income')).toBeFalse();
    expect(component.isBudgetSectionExpanded('expense-1')).toBeFalse();
    expect(component.isBudgetSectionExpanded('expense-2')).toBeFalse();
  });

  it('opens account details in overview mode by default', () => {
    const component = createComponent();

    expect(component.accountViewMode).toBe('overview');
    component.accountViewMode = 'operations';
    expect(component.accountViewMode).toBe('operations');
  });

  it('computes the amount to transfer from current-account advances only', () => {
    const component = createComponent();
    component.accountId = 1;
    component.accounts = [
      { id: 1, name: 'Compte courant', initialBalance: 0 },
      { id: 2, name: 'Compte joint', initialBalance: 0 },
    ];
    component.allTransactions = [
      {
        id: 1,
        description: 'Advance one',
        amount: 120,
        date: new Date(),
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 2,
        advanceToJointAccount: true,
      },
      {
        id: 2,
        description: 'Advance two',
        amount: 30,
        date: new Date(),
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 2,
        advanceToJointAccount: true,
      },
      {
        id: 3,
        description: 'Joint account marker',
        amount: 500,
        date: new Date(),
        subCategoryId: 1,
        accountId: 2,
        financialFlowId: 2,
        advanceToJointAccount: true,
      },
    ];

    expect(component.pendingAdvanceJointTransactions.length).toBe(2);
    expect(component.pendingAdvanceJointTotal).toBe(150);
  });
});
