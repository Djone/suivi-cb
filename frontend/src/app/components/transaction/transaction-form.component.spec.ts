// frontend/src/app/components/transaction/transaction-form.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionFormComponent } from './transaction-form.component';
import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

describe('TransactionFormComponent', () => {
  let component: TransactionFormComponent;
  let fixture: ComponentFixture<TransactionFormComponent>;
  let transactionService: jasmine.SpyObj<TransactionService>;
  let subCategoryService: jasmine.SpyObj<SubCategoryService>;
  let categoryService: jasmine.SpyObj<CategoryService>;

  beforeEach(async () => {
    const transactionServiceSpy = jasmine.createSpyObj('TransactionService', ['addTransaction', 'loadTransactions']);
    const subCategoryServiceSpy = jasmine.createSpyObj('SubCategoryService', ['getAllSubCategoriesByFinancialFlowId', 'getSubCategories']);
    const categoryServiceSpy = jasmine.createSpyObj('CategoryService', ['getCategories']);

    await TestBed.configureTestingModule({
      imports: [
        TransactionFormComponent,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule
      ],
      providers: [
        { provide: TransactionService, useValue: transactionServiceSpy },
        { provide: SubCategoryService, useValue: subCategoryServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ accountId: '1', financialFlowId: '1' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionFormComponent);
    component = fixture.componentInstance;
    transactionService = TestBed.inject(TransactionService) as jasmine.SpyObj<TransactionService>;
    subCategoryService = TestBed.inject(SubCategoryService) as jasmine.SpyObj<SubCategoryService>;
    categoryService = TestBed.inject(CategoryService) as jasmine.SpyObj<CategoryService>;

    // Mock pour les services
    subCategoryService.getAllSubCategoriesByFinancialFlowId.and.returnValue(of([]));
    transactionService.addTransaction.and.returnValue(of(undefined));
    transactionService.loadTransactions.and.returnValue();
    subCategoryService.getSubCategories.and.returnValue(of([]));
  });

  it('devrait créer le composant', () => {
    expect(component).toBeTruthy();
  });

  describe('Formulaire', () => {
    it('devrait initialiser le formulaire avec les champs requis', () => {
      expect(component.transactionForm).toBeDefined();
      expect(component.transactionForm.get('date')).toBeTruthy();
      expect(component.transactionForm.get('amount')).toBeTruthy();
      expect(component.transactionForm.get('description')).toBeTruthy();
      expect(component.transactionForm.get('subCategoryId')).toBeTruthy();
      expect(component.transactionForm.get('accountId')).toBeTruthy();
      expect(component.transactionForm.get('financialFlowId')).toBeTruthy();
    });

    it('devrait être invalide si les champs requis sont vides', () => {
      expect(component.transactionForm.valid).toBeFalsy();
    });

    it('devrait être valide avec tous les champs remplis', () => {
      component.transactionForm.patchValue({
        date: new Date('2024-01-01'),
        amount: 100,
        description: 'Test',
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 1
      });

      expect(component.transactionForm.valid).toBeTruthy();
    });

    it('devrait valider que amount est supérieur à 0.01', () => {
      const amountControl = component.transactionForm.get('amount');
      amountControl?.setValue(0);

      expect(amountControl?.hasError('min')).toBeTruthy();

      amountControl?.setValue(0.01);
      expect(amountControl?.hasError('min')).toBeFalsy();
    });
  });

  describe('ngOnInit', () => {
    it('devrait récupérer les paramètres de la route', () => {
      fixture.detectChanges(); // Déclenche ngOnInit

      expect(component.accountId).toBe(1);
      expect(component.financialFlowId).toBe(1);
    });

    it('devrait mettre à jour le formulaire avec les paramètres', () => {
      fixture.detectChanges();

      expect(component.transactionForm.get('accountId')?.value).toBe(1);
      expect(component.transactionForm.get('financialFlowId')?.value).toBe(1);
    });

    it('devrait charger les sous-catégories filtrées par financialFlowId', () => {
      fixture.detectChanges();

      expect(subCategoryService.getAllSubCategoriesByFinancialFlowId).toHaveBeenCalledWith(1);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.transactionForm.patchValue({
        date: new Date('2024-01-01'),
        amount: 100,
        description: 'Test Transaction',
        subCategoryId: 1,
        accountId: 1,
        financialFlowId: 1
      });
    });

    it('devrait soumettre une transaction valide', () => {
      component.onSubmit();

      expect(transactionService.addTransaction).toHaveBeenCalled();
      const callArgs = transactionService.addTransaction.calls.first().args[0];
      expect(callArgs.description).toBe('Test Transaction');
      expect(callArgs.amount).toBe(100);
      expect(callArgs.date).toMatch(/2024-01-01/); // Format ISO
    });

    it('ne devrait pas soumettre si le formulaire est invalide', () => {
      component.transactionForm.patchValue({
        date: null,
        amount: null,
        description: '',
        subCategoryId: null
      });

      component.onSubmit();

      expect(transactionService.addTransaction).not.toHaveBeenCalled();
    });

    it('devrait réinitialiser le formulaire après soumission réussie', () => {
      spyOn(component, 'resetForm');

      component.onSubmit();

      expect(component.resetForm).toHaveBeenCalled();
    });

    it('devrait recharger les transactions après soumission', () => {
      component.onSubmit();

      expect(transactionService.loadTransactions).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs de soumission', () => {
      transactionService.addTransaction.and.returnValue(
        throwError(() => new Error('Erreur serveur'))
      );

      spyOn(console, 'error');

      component.onSubmit();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('resetForm', () => {
    it('devrait réinitialiser tous les champs sauf accountId et financialFlowId', () => {
      fixture.detectChanges();

      component.transactionForm.patchValue({
        date: new Date('2024-01-01'),
        amount: 100,
        description: 'Test',
        subCategoryId: 1
      });

      component.resetForm();

      expect(component.transactionForm.get('date')?.value).toBeNull();
      expect(component.transactionForm.get('amount')?.value).toBeNull();
      expect(component.transactionForm.get('subCategoryId')?.value).toBe('');
      expect(component.transactionForm.get('accountId')?.value).toBe(1);
      expect(component.transactionForm.get('financialFlowId')?.value).toBe(1);
    });

    it('devrait marquer le formulaire comme pristine et untouched', () => {
      fixture.detectChanges();

      component.transactionForm.markAsDirty();
      component.transactionForm.markAsTouched();

      component.resetForm();

      expect(component.transactionForm.pristine).toBeTruthy();
      expect(component.transactionForm.untouched).toBeTruthy();
    });
  });
});
