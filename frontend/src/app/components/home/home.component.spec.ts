import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';

import { HomeComponent } from './home.component';
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { ViewportService } from '../../services/viewport.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  const accountServiceMock = {
    accounts$: of([]),
    getAccounts: () => of([]),
  };

  const transactionServiceMock = {
    transactions$: of([]),
    clearFiltersTransactions: () => undefined,
  };

  const recurringServiceMock = {
    recurringTransactions$: of([]),
    getRecurringTransactions: () => of([]),
  };

  const subCategoryServiceMock = {
    subCategories$: of([]),
    getSubCategories: () => of([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: AccountService, useValue: accountServiceMock },
        { provide: TransactionService, useValue: transactionServiceMock },
        { provide: RecurringTransactionService, useValue: recurringServiceMock },
        { provide: SubCategoryService, useValue: subCategoryServiceMock },
        { provide: ViewportService, useValue: { mobile$: of(false) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: DialogService, useValue: { open: jasmine.createSpy('open') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('totalise les occurrences hebdomadaires et agrege par sous-categorie', () => {
    const now = new Date();
    let mondays = 0;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      if (new Date(now.getFullYear(), now.getMonth(), day).getDay() === 1) {
        mondays += 1;
      }
    }

    component.subCategoryNames.set(10, 'Placements');
    component.subCategoryNames.set(20, 'Salaire');
    component.recurringTransactions = [
      {
        id: 1,
        label: 'Salaire',
        amount: 1000,
        dayOfMonth: 1,
        subCategoryId: 20,
        accountId: 1,
        financialFlowId: 1,
        frequency: 'monthly',
        isActive: 1,
        debit503020: null,
      },
      {
        id: 2,
        label: 'Plum',
        amount: 30,
        dayOfMonth: 1,
        subCategoryId: 10,
        accountId: 1,
        financialFlowId: 2,
        frequency: 'weekly',
        isActive: 1,
        debit503020: 3,
      },
      {
        id: 3,
        label: 'Placement mensuel',
        amount: 20,
        dayOfMonth: 5,
        subCategoryId: 10,
        accountId: 1,
        financialFlowId: 2,
        frequency: 'monthly',
        isActive: 1,
        debit503020: 3,
      },
    ];

    const breakdown = component.get503020Breakdown(1);
    const savings = breakdown.items.find((item) => item.id === 3)!;

    expect(breakdown.incomeDetails).toEqual([
      jasmine.objectContaining({
        label: 'Salaire',
        amount: 1000,
        occurrences: 1,
      }),
    ]);
    expect(savings.amount).toBe(30 * mondays + 20);
    expect(savings.details).toEqual([
      jasmine.objectContaining({
        label: 'Placements',
        amount: 30 * mondays + 20,
        occurrences: mondays + 1,
      }),
    ]);
    expect(savings.percent).toBe(
      Math.round(((30 * mondays + 20) / 1000) * 100),
    );
  });

  it('identifie les sous-categories en hausse et en baisse a meme date', () => {
    const now = new Date();
    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    component.subCategoryNames.set(1, 'Voiture');
    component.subCategoryNames.set(2, 'Alimentation');
    component.transactions = [
      {
        id: 1,
        description: 'Garage',
        amount: 300,
        date: toDateKey(now),
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 2,
      },
      {
        id: 2,
        description: 'Courses',
        amount: 100,
        date: toDateKey(now),
        subCategoryId: 2,
        accountId: 1,
        financialFlowId: 2,
      },
      {
        id: 3,
        description: 'Salaire',
        amount: 1000,
        date: toDateKey(now),
        subCategoryId: null,
        accountId: 1,
        financialFlowId: 1,
      },
      ...[1, 2, 3].flatMap((monthsAgo, index) => {
        const historicalDate = new Date(
          now.getFullYear(),
          now.getMonth() - monthsAgo,
          Math.min(now.getDate(), 28),
        );
        return [
          {
            id: 10 + index * 2,
            description: 'Garage historique',
            amount: 100,
            date: toDateKey(historicalDate),
            subCategoryId: 1,
            accountId: 1,
            financialFlowId: 2,
          },
          {
            id: 11 + index * 2,
            description: 'Courses historiques',
            amount: 200,
            date: toDateKey(historicalDate),
            subCategoryId: 2,
            accountId: 1,
            financialFlowId: 2,
          },
        ];
      }),
    ];

    const stats = (component as any).buildBudgetTrendStats(1);

    expect(stats[1].value).toBe('Voiture');
    expect(stats[1].tone).toBe('negative');
    expect(stats[2].value).toBe('Alimentation');
    expect(stats[2].tone).toBe('positive');
  });
});
