import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Transaction } from '../../models/transaction.model';
import {
  Vehicle,
  VehicleEnergyType,
  VehicleOperation,
} from '../../models/vehicle.model';
import { SubCategory } from '../../models/sub-category.model';
import { TransactionService } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SubCategoryService } from '../../services/sub-category.service';

interface VehicleYearRow {
  vehicle: Vehicle;
  months: number[];
  total: number;
  monthlyAverage: number;
}

interface VehicleExpenseEntry {
  id: number;
  date: string | Date;
  amount: number;
  vehicleId: number;
  subCategoryLabel: string;
}

interface SubCategoryYearRow {
  vehicleId: number;
  vehicleName: string;
  label: string;
  months: number[];
  total: number;
}

interface VehicleCostSummary {
  acquisition: number;
  externalExpenses: number;
  total: number;
}

interface VehicleCategorySummary {
  label: string;
  total: number;
  percent: number;
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicles.component.html',
  styleUrls: [
    './vehicles.component.css',
    './vehicles-operation.component.css',
  ],
})
export class VehiclesComponent implements OnInit {
  vehicles: Vehicle[] = [];
  transactions: Transaction[] = [];
  manualOperations: VehicleOperation[] = [];
  expenseSubCategories: SubCategory[] = [];
  selectedYear = new Date().getFullYear();
  selectedVehicleId: number | null = null;
  isFormOpen = false;
  isSaving = false;
  formError = '';
  isOperationFormOpen = false;
  isOperationSaving = false;
  operationError = '';
  operationForm = this.emptyOperation();
  form: Vehicle = this.emptyVehicle();
  readonly months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  readonly energyTypes: { value: VehicleEnergyType; label: string }[] = [
    { value: 'gasoline', label: 'Essence' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'hybrid', label: 'Hybride' },
    { value: 'electric', label: 'Électrique' },
    { value: 'other', label: 'Autre' },
  ];

  constructor(
    private readonly vehicleService: VehicleService,
    private readonly transactionService: TransactionService,
    private readonly subCategoryService: SubCategoryService,
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({
      vehicles: this.vehicleService.loadVehicles(),
      transactions: this.transactionService.getTransactionsUnfiltered(),
      operations: this.vehicleService.loadOperations(),
      subCategories:
        this.subCategoryService.getAllSubCategoriesByFinancialFlowId(2),
    }).subscribe(({ vehicles, transactions, operations, subCategories }) => {
      this.vehicles = vehicles;
      this.manualOperations = operations;
      this.expenseSubCategories = subCategories;
      this.transactions = transactions.filter(
        (transaction) => Number(transaction.financialFlowId) === 2,
      );
      if (!this.selectedVehicleId) {
        this.selectedVehicleId = this.activeVehicles[0]?.id || null;
      }
    });
  }

  get activeVehicles(): Vehicle[] {
    return this.vehicles.filter((vehicle) => Number(vehicle.isActive) !== 0);
  }

  get years(): number[] {
    const currentYear = new Date().getFullYear();
    return [
      ...new Set([
        currentYear,
        currentYear - 1,
        currentYear - 2,
        ...this.expenseEntries
          .map((entry) => this.asDate(entry.date)?.getFullYear())
          .filter((year): year is number => typeof year === 'number'),
      ]),
    ].sort((a, b) => b - a);
  }

  get yearRows(): VehicleYearRow[] {
    const elapsedMonths =
      this.selectedYear === new Date().getFullYear()
        ? new Date().getMonth() + 1
        : 12;
    return this.activeVehicles.map((vehicle) => {
      const months = Array.from({ length: 12 }, (_, month) =>
        this.vehicleTransactions(vehicle.id).reduce((sum, transaction) => {
          const date = this.asDate(transaction.date);
          return date && date.getFullYear() === this.selectedYear && date.getMonth() === month
            ? sum + this.amount(transaction)
            : sum;
        }, 0),
      );
      const total = months.reduce((sum, amount) => sum + amount, 0);
      return { vehicle, months, total, monthlyAverage: total / elapsedMonths };
    });
  }

  get currentYearTotal(): number {
    return this.yearRows.reduce((sum, row) => sum + row.total, 0);
  }

  get currentMonthlyAverage(): number {
    return this.yearRows.reduce((sum, row) => sum + row.monthlyAverage, 0);
  }

  get insights(): string[] {
    const insights: string[] = [];
    const currentYear = new Date().getFullYear();
    const elapsedMonths = new Date().getMonth() + 1;
    this.activeVehicles.forEach((vehicle) => {
      const current = this.totalForVehicleYear(vehicle.id, currentYear) / elapsedMonths;
      const previous = [currentYear - 1, currentYear - 2]
        .map((year) => this.totalForVehicleYear(vehicle.id, year) / 12)
        .filter((value) => value > 0);
      const reference = previous.length
        ? previous.reduce((sum, value) => sum + value, 0) / previous.length
        : 0;
      if (reference > 0 && Math.abs(current - reference) / reference >= 0.15) {
        const delta = Math.round(((current - reference) / reference) * 100);
        insights.push(
          `${vehicle.name} coûte environ ${this.euro(current)} par mois cette année, soit ${Math.abs(delta)} % ${delta > 0 ? 'de plus' : 'de moins'} que sur les deux années précédentes.`,
        );
      } else if (current > 0) {
        insights.push(`${vehicle.name} coûte environ ${this.euro(current)} par mois cette année.`);
      }
    });

    const categoryTotals = new Map<string, number>();
    this.expenseEntries.forEach((entry) => {
      const date = this.asDate(entry.date);
      if (!date || date.getFullYear() !== currentYear) return;
      const label = entry.subCategoryLabel || 'Autres frais';
      categoryTotals.set(label, (categoryTotals.get(label) || 0) + entry.amount);
    });
    const biggest = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (biggest) {
      insights.push(`Le premier poste automobile cette année est « ${biggest[0]} » avec ${this.euro(biggest[1])}, soit ${this.euro(biggest[1] / elapsedMonths)} par mois.`);
    }
    return insights;
  }

  get selectedVehicle(): Vehicle | undefined {
    return this.activeVehicles.find((vehicle) => vehicle.id === this.selectedVehicleId);
  }

  get subCategoryYearRows(): SubCategoryYearRow[] {
    const entries = this.expenseEntries.filter(
      (entry) => this.asDate(entry.date)?.getFullYear() === this.selectedYear,
    );
    const groups = [
      ...new Map(
        entries.map((entry) => {
          const vehicle = this.vehicles.find(
            (item) => item.id === entry.vehicleId,
          );
          return [
            `${entry.vehicleId}:${entry.subCategoryLabel}`,
            {
              vehicleId: entry.vehicleId,
              vehicleName: vehicle?.name || 'Véhicule inconnu',
              label: entry.subCategoryLabel,
            },
          ];
        }),
      ).values(),
    ];
    return groups
      .map((group) => {
        const months = Array.from({ length: 12 }, (_, month) =>
          entries.reduce((sum, entry) => {
            const date = this.asDate(entry.date);
            return entry.vehicleId === group.vehicleId &&
              entry.subCategoryLabel === group.label &&
              date?.getMonth() === month
              ? sum + entry.amount
              : sum;
          }, 0),
        );
        return {
          ...group,
          months,
          total: months.reduce((sum, amount) => sum + amount, 0),
        };
      })
      .sort(
        (a, b) =>
          a.vehicleName.localeCompare(b.vehicleName, 'fr') || b.total - a.total,
      );
  }

  vehicleCostSummary(vehicle: Vehicle): VehicleCostSummary {
    const acquisition = Math.max(0, Number(vehicle.purchasePrice) || 0);
    const externalExpenses = this.vehicleTransactions(vehicle.id).reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );
    return {
      acquisition,
      externalExpenses,
      total: acquisition + externalExpenses,
    };
  }

  vehicleYearRow(vehicle: Vehicle): VehicleYearRow | undefined {
    return this.yearRows.find((row) => row.vehicle.id === vehicle.id);
  }

  vehicleCategorySummary(vehicle: Vehicle): VehicleCategorySummary[] {
    const rows = this.subCategoryYearRows.filter(
      (row) => row.vehicleId === vehicle.id && row.total > 0,
    );
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return rows.slice(0, 5).map((row) => ({
      label: row.label,
      total: row.total,
      percent: total > 0 ? (row.total / total) * 100 : 0,
    }));
  }

  get manualOperationsForYear(): VehicleOperation[] {
    return this.manualOperations.filter(
      (operation) =>
        this.asDate(operation.date)?.getFullYear() === this.selectedYear,
    );
  }

  vehicleName(vehicleId: number | null): string {
    return (
      this.vehicles.find((vehicle) => vehicle.id === Number(vehicleId))?.name ||
      'Véhicule inconnu'
    );
  }

  openOperationForm(): void {
    this.operationForm = this.emptyOperation();
    this.operationForm.vehicleId = this.selectedVehicleId;
    this.operationError = '';
    this.isOperationFormOpen = true;
  }

  saveOperation(): void {
    if (
      !this.operationForm.date ||
      !this.operationForm.label.trim() ||
      !this.operationForm.subCategoryId ||
      !this.operationForm.vehicleId ||
      Number(this.operationForm.amount) <= 0
    ) {
      this.operationError = 'Tous les champs sont obligatoires.';
      return;
    }
    this.isOperationSaving = true;
    this.operationError = '';
    this.vehicleService.addOperation(this.operationForm).subscribe({
      next: () => {
        this.isOperationSaving = false;
        this.isOperationFormOpen = false;
        this.reload();
      },
      error: (error) => {
        this.isOperationSaving = false;
        this.operationError =
          error?.error?.errors?.join(' · ') ||
          error?.error?.error ||
          "Impossible d'ajouter l'opération.";
      },
    });
  }

  deleteOperation(operation: VehicleOperation): void {
    if (!operation.id) return;
    this.vehicleService.deleteOperation(operation.id).subscribe(() => this.reload());
  }

  get trendPolyline(): string {
    const values = this.trendValues;
    const max = Math.max(...values, 1);
    return values
      .map((value, index) => `${(index / 35) * 600},${150 - (value / max) * 135}`)
      .join(' ');
  }

  get trendValues(): number[] {
    const vehicleId = this.selectedVehicleId;
    if (!vehicleId) return Array(36).fill(0);
    const now = new Date();
    return Array.from({ length: 36 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 35 + index, 1);
      return this.vehicleTransactions(vehicleId).reduce((sum, transaction) => {
        const transactionDate = this.asDate(transaction.date);
        return transactionDate && transactionDate.getFullYear() === date.getFullYear() && transactionDate.getMonth() === date.getMonth()
          ? sum + this.amount(transaction)
          : sum;
      }, 0);
    });
  }

  electricEstimate(vehicle: Vehicle): string {
    if (vehicle.energyType === 'electric') return 'Ce véhicule est déjà électrique.';
    const distance = Number(vehicle.annualDistance || 0);
    const consumption = Number(vehicle.consumptionPer100 || 0);
    const price = Number(vehicle.energyPrice || 0);
    if (!distance || !consumption || !price) {
      return 'Renseignez distance annuelle, consommation et prix du carburant pour estimer le passage à l’électrique.';
    }
    const currentEnergy = (distance / 100) * consumption * price;
    const electricEnergy = (distance / 100) * 17 * 0.25;
    const saving = currentEnergy - electricEnergy;
    return saving > 0
      ? `À kilométrage identique, l’énergie électrique coûterait environ ${this.euro(electricEnergy)}/an, soit ${this.euro(saving)} d’économie potentielle sur l’énergie.`
      : `Avec ces hypothèses, le passage à l’électrique ne génère pas d’économie énergétique immédiate.`;
  }

  openCreate(): void {
    this.form = this.emptyVehicle();
    this.formError = '';
    this.isFormOpen = true;
  }

  edit(vehicle: Vehicle): void {
    this.form = { ...vehicle };
    this.formError = '';
    this.isFormOpen = true;
  }

  save(): void {
    if (!this.form.name.trim()) return;
    this.formError = '';
    this.isSaving = true;
    this.vehicleService.save(this.form).subscribe({
      next: () => {
        this.isSaving = false;
        this.isFormOpen = false;
        this.reload();
      },
      error: (error) => {
        this.isSaving = false;
        const validationErrors = error?.error?.errors;
        this.formError = Array.isArray(validationErrors)
          ? validationErrors.join(' · ')
          : error?.error?.error || "Impossible d'enregistrer le véhicule.";
      },
    });
  }

  archive(vehicle: Vehicle): void {
    this.vehicleService.archive(vehicle).subscribe(() => this.reload());
  }

  private get expenseEntries(): VehicleExpenseEntry[] {
    const bankEntries = this.transactions
      .filter((transaction) => Number(transaction.vehicleId) > 0)
      .map((transaction) => ({
        id: Number(transaction.id),
        date: transaction.date!,
        amount: this.amount(transaction),
        vehicleId: Number(transaction.vehicleId),
        subCategoryLabel:
          String(transaction['subCategoryLabel'] || 'Autres frais'),
      }));
    const manualEntries = this.manualOperations.map((operation) => ({
      id: Number(operation.id),
      date: operation.date,
      amount: Math.abs(Number(operation.amount) || 0),
      vehicleId: Number(operation.vehicleId),
      subCategoryLabel: operation.subCategoryLabel || 'Autres frais',
    }));
    return [...bankEntries, ...manualEntries];
  }

  private vehicleTransactions(vehicleId?: number): VehicleExpenseEntry[] {
    return this.expenseEntries.filter((entry) => entry.vehicleId === vehicleId);
  }

  private totalForVehicleYear(vehicleId: number | undefined, year: number): number {
    return this.vehicleTransactions(vehicleId).reduce((sum, transaction) => {
      const date = this.asDate(transaction.date);
      return date?.getFullYear() === year ? sum + this.amount(transaction) : sum;
    }, 0);
  }

  private amount(transaction: Pick<Transaction, 'amount'>): number {
    return Math.abs(Number(transaction.amount) || 0);
  }

  private asDate(value: Transaction['date']): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private euro(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  }

  private emptyVehicle(): Vehicle {
    return { name: '', brand: '', model: '', energyType: 'gasoline', purchasePrice: null, annualDistance: null, consumptionPer100: null, energyPrice: null };
  }

  private emptyOperation(): VehicleOperation {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      date,
      label: '',
      amount: 0,
      subCategoryId: null,
      vehicleId: null,
    };
  }
}
