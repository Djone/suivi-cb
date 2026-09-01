import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { VehiclesComponent } from './vehicles.component';
import { VehicleService } from '../../services/vehicle.service';
import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';

describe('VehiclesComponent', () => {
  let component: VehiclesComponent;
  let fixture: ComponentFixture<VehiclesComponent>;
  const currentYear = new Date().getFullYear();
  const elapsedMonths = new Date().getMonth() + 1;

  beforeAll(() => registerLocaleData(localeFr));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehiclesComponent],
      providers: [
        {
          provide: VehicleService,
          useValue: {
            loadVehicles: () => of([{ id: 1, name: 'Polo', energyType: 'gasoline', purchasePrice: 8000, isActive: 1 }]),
            loadOperations: () => of([]),
            addOperation: () => of({ id: 1 }),
            deleteOperation: () => of(undefined),
            save: () => of({ id: 1 }),
            archive: () => of({ id: 1 }),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactionsUnfiltered: () => of([]),
          },
        },
        {
          provide: SubCategoryService,
          useValue: {
            getAllSubCategoriesByFinancialFlowId: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VehiclesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('compare le cout mensuel aux deux annees precedentes', () => {
    component.transactions = [
      {
        id: 1, description: 'Entretien', amount: 200 * elapsedMonths,
        date: `${currentYear}-01-15`, subCategoryId: 1, accountId: 1,
        financialFlowId: 2, vehicleId: 1, subCategoryLabel: 'Entretien',
      },
      ...[currentYear - 1, currentYear - 2].map((year, index) => ({
        id: index + 2, description: 'Historique', amount: 1200,
        date: `${year}-06-15`, subCategoryId: 1, accountId: 1,
        financialFlowId: 2, vehicleId: 1, subCategoryLabel: 'Entretien',
      })),
    ];

    expect(component.insights[0]).toContain('Polo coûte environ 200');
    expect(component.insights[0]).toContain('de plus');
  });

  it('additionne le prix d acquisition et toutes les depenses du vehicule', () => {
    component.transactions = [{
      id: 10, description: 'Carburant', amount: -250,
      date: `${currentYear}-02-10`, subCategoryId: 1, accountId: 1,
      financialFlowId: 2, vehicleId: 1, subCategoryLabel: 'Carburant',
    }];
    component.manualOperations = [{
      id: 11, date: '2020-03-12', label: 'Entretien ancien', amount: 500,
      subCategoryId: 2, subCategoryLabel: 'Entretien', vehicleId: 1,
    }];

    expect(component.vehicleCostSummary(component.vehicles[0])).toEqual({
      acquisition: 8000,
      externalExpenses: 750,
      total: 8750,
    });
  });

  it('separe les memes sous categories pour chaque vehicule', () => {
    component.vehicles = [
      ...component.vehicles,
      { id: 2, name: 'Peugeot', energyType: 'diesel', isActive: 1 },
    ];
    component.transactions = [
      {
        id: 20, description: 'Plein Polo', amount: -100,
        date: `${currentYear}-01-10`, subCategoryId: 1, accountId: 1,
        financialFlowId: 2, vehicleId: 1, subCategoryLabel: 'Carburant',
      },
      {
        id: 21, description: 'Plein Peugeot', amount: -150,
        date: `${currentYear}-01-11`, subCategoryId: 1, accountId: 1,
        financialFlowId: 2, vehicleId: 2, subCategoryLabel: 'Carburant',
      },
    ];
    component.selectedYear = currentYear;

    expect(component.subCategoryYearRows).toEqual([
      jasmine.objectContaining({ vehicleName: 'Peugeot', label: 'Carburant', total: 150 }),
      jasmine.objectContaining({ vehicleName: 'Polo', label: 'Carburant', total: 100 }),
    ]);
  });
});
