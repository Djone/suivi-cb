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
});

