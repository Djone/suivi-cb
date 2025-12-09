import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

interface IncomePerson {
  name: string;
  netImposable: number;
  other?: number;
}

interface IncomeSummary {
  label: string;
  current: number;
  previous?: number;
  tone?: 'positive' | 'negative';
}

interface IncomeBracket {
  code: string;
  min: number;
  max: number | null;
  rate: number;
  gap: number;
  mmi: number | null;
}

interface PropertyTaxRow {
  year: number;
  address: string;
  amount: number;
  evolTf?: number | null;
  evolAvg?: number | null;
}

@Component({
  selector: 'app-impots',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabViewModule,
    CardModule,
    InputNumberModule,
    DropdownModule,
    TableModule,
    TagModule,
    ButtonModule,
  ],
  templateUrl: './impots.component.html',
  styleUrls: ['./impots.component.css']
})
export class ImpotsComponent {
  household: IncomePerson[] = [
    { name: 'Jo', netImposable: 36550, other: 2141 },
    { name: 'Lu', netImposable: 13918, other: 0 }
  ];
  adults = 2;
  children = 1;
  pasRate = 0.28;

  incomeYearOptions = [
    { label: '2023', value: 2023 },
    { label: '2022', value: 2022 }
  ];
  selectedIncomeYear = 2023;

  incomeSummaries: Record<number, IncomeSummary[]> = {
    2023: [
      { label: 'RNI', current: 21044, previous: 29294 },
      { label: '10%', current: 18939, previous: 10546 },
      { label: '6RS', current: 0, previous: 2380 },
      { label: '6NS', current: 3300, previous: 0 },
      { label: '7GA', current: 1589, previous: 0 },
      { label: '7UD', current: 430, previous: 460 },
      { label: '7UF', current: 600, previous: 525 },
      { label: 'Imposable', current: 14050, previous: 8166 },
      { label: 'PAS', current: 1628, previous: 1838 },
      { label: 'Total après réduction', current: 39, previous: -985 },
      { label: 'Reste à payer', current: -1588, previous: 2823, tone: 'positive' }
    ],
    2022: [
      { label: 'RNI', current: 29294 },
      { label: '10%', current: 10546 },
      { label: '6RS', current: 2380 },
      { label: '7UD', current: 460 },
      { label: '7UF', current: 525 },
      { label: 'Imposable', current: 8166 },
      { label: 'PAS', current: 1838 },
      { label: 'Total après réduction', current: -985, tone: 'positive' },
      { label: 'Reste à payer', current: 2823, tone: 'negative' }
    ]
  };

  incomeBrackets: Record<number, IncomeBracket[]> = {
    2023: [
      { code: '20241', min: 0, max: 11294, rate: 0, gap: 0, mmi: null },
      { code: '20242', min: 11295, max: 28797, rate: 11, gap: 17502, mmi: 1925 },
      { code: '20243', min: 28798, max: 82341, rate: 30, gap: 53543, mmi: 16063 },
      { code: '20244', min: 82342, max: 177106, rate: 41, gap: 94764, mmi: 38853 },
      { code: '20245', min: 177107, max: null, rate: 45, gap: 79698, mmi: null }
    ],
    2022: [
      { code: '20231', min: 0, max: 10777, rate: 0, gap: 0, mmi: null },
      { code: '20232', min: 10778, max: 27478, rate: 11, gap: 16700, mmi: 1837 },
      { code: '20233', min: 27479, max: 78570, rate: 30, gap: 51091, mmi: 15327 },
      { code: '20234', min: 78571, max: 168994, rate: 41, gap: 90423, mmi: 37032 },
      { code: '20235', min: 168995, max: null, rate: 45, gap: 76048, mmi: null }
    ]
  };

  taxRows: PropertyTaxRow[] = [
    { year: 2025, address: "116 IMP DE L'AUGERIE, 44330 MOUZILLON", amount: 583, evolTf: 3.55, evolAvg: 24.31 },
    { year: 2025, address: "116 IMP DE L'AUGERIE, 44330 MOUZILLON", amount: 563, evolTf: 9.53, evolAvg: 24.31 },
    { year: 2024, address: "116 IMP DE L'AUGERIE, 44330 MOUZILLON", amount: 514, evolTf: 9.59, evolAvg: 24.31 },
    { year: 2023, address: '6 L AUGERIE 44330 MOUZILLON', amount: 469, evolTf: 0, evolAvg: 12.48 },
    { year: 2022, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 649, evolTf: 2.2, evolAvg: 12.48 },
    { year: 2021, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 635, evolTf: 1.28, evolAvg: 12.48 },
    { year: 2020, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 627, evolTf: 0.32, evolAvg: null },
    { year: 2019, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 625, evolTf: 5.22, evolAvg: null },
    { year: 2018, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 594, evolTf: 0.68, evolAvg: null },
    { year: 2017, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 590, evolTf: 0.85, evolAvg: null },
    { year: 2016, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 585, evolTf: 1.39, evolAvg: null },
    { year: 2015, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 577, evolTf: 0, evolAvg: null },
    { year: 2014, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 0, evolTf: 0, evolAvg: null },
    { year: 2013, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 0, evolTf: 0, evolAvg: null },
    { year: 2012, address: '27 RUE EUGENE TESSIER 44000 NANTES', amount: 0, evolTf: 0, evolAvg: null }
  ];

  taxProjectionRate = 5;

  // Paramétrage (mock)
  barParams = [
    { year: 2025, tranche: 1, min: 0, max: 11294, rate: 0 },
    { year: 2025, tranche: 2, min: 11295, max: 28797, rate: 11 },
    { year: 2025, tranche: 3, min: 28798, max: 82341, rate: 30 },
    { year: 2025, tranche: 4, min: 82342, max: 177106, rate: 41 },
    { year: 2025, tranche: 5, min: 177107, max: null, rate: 45 },
    { year: 2024, tranche: 1, min: 0, max: 10777, rate: 0 },
    { year: 2024, tranche: 2, min: 10778, max: 27478, rate: 11 },
    { year: 2024, tranche: 3, min: 27479, max: 78570, rate: 30 },
    { year: 2024, tranche: 4, min: 78571, max: 168994, rate: 41 },
    { year: 2024, tranche: 5, min: 168995, max: null, rate: 45 }
  ];

  reductionMode: 'manuel' | 'auto' = 'manuel';
  creditMode: 'manuel' | 'auto' = 'manuel';

  reductions = [
    { year: 2024, org: 'Restos du cœur', amount: 120, caseCode: '7UD', percent: 75, source: 'manuel' },
    { year: 2024, org: 'MSF', amount: 200, caseCode: '7UF', percent: 66, source: 'manuel' },
    { year: 2023, org: 'Sea Shepherd', amount: 120, caseCode: '7UD', percent: 75, source: 'auto' }
  ];

  credits = [
    { year: 2024, org: 'PERP', amount: 1818, caseCode: '6NS', percent: 0, source: 'manuel' },
    { year: 2023, org: 'MAM', amount: 4749.89, caseCode: '7GA', percent: 0, source: 'manuel' },
    { year: 2023, org: 'PER', amount: 3300, caseCode: '6NS', percent: 0, source: 'auto' }
  ];

  caseRates = [
    { caseCode: '6RS', rate: 0, updated: '2024-01-01', source: 'fixe' },
    { caseCode: '7UD', rate: 75, updated: '2024-01-01', source: 'manuel' },
    { caseCode: '7UF', rate: 66, updated: '2024-01-01', source: 'manuel' },
    { caseCode: '7GA', rate: 0, updated: '2024-01-01', source: 'fixe' },
    { caseCode: '6NS', rate: 0, updated: '2024-01-01', source: 'fixe' }
  ];

  addresses = [
    { year: 2025, address: "116 IMP DE L'AUGERIE, 44330 MOUZILLON", main: true },
    { year: 2022, address: '27 RUE EUGENE TESSIER 44000 NANTES', main: false },
    { year: 2019, address: '6 L AUGERIE 44330 MOUZILLON', main: false }
  ];

  get totalHouseholdIncome(): number {
    return this.household.reduce((sum, p) => sum + p.netImposable + (p.other || 0), 0);
  }

  get parts(): number {
    const childParts =
      this.children <= 2 ? this.children * 0.5 : (this.children - 2) * 1 + 1;
    return this.adults + childParts;
  }

  get currentYearSummaries(): IncomeSummary[] {
    return this.incomeSummaries[this.selectedIncomeYear] || [];
  }

  get currentBrackets(): IncomeBracket[] {
    return this.incomeBrackets[this.selectedIncomeYear] || [];
  }

  hasPrevious(): boolean {
    return this.currentYearSummaries.some((item) => item.previous !== undefined);
  }

  get totalPropertyTax(): number {
    return this.taxRows.reduce((sum, row) => sum + row.amount, 0);
  }

  get avgEvolution(): number | null {
    const values = this.taxRows
      .map((row) => row.evolTf)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  get projectedTaxAmount(): number {
    const latest = this.taxRows.find((row) => row.amount > 0);
    if (!latest) return 0;
    const factor = 1 + this.taxProjectionRate / 100;
    return Number((latest.amount * factor).toFixed(2));
  }

  get barYears(): number[] {
    const set = new Set(this.barParams.map((b) => b.year));
    return Array.from(set).sort((a, b) => b - a);
  }

  get reductionsTotal(): number {
    return this.reductions.reduce((sum, r) => sum + r.amount, 0);
  }

  get creditsTotal(): number {
    return this.credits.reduce((sum, r) => sum + r.amount, 0);
  }

  getProjectionReference(): string {
    const latest = this.taxRows.find((row) => row.amount > 0);
    return latest ? `${latest.year}` : 'dernière valeur';
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  }

  getToneTag(tone?: 'positive' | 'negative') {
    if (tone === 'positive') return 'success';
    if (tone === 'negative') return 'danger';
    return 'info';
  }

  getEvolutionClass(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'evol-neutral';
    if (value >= 8) return 'evol-hot';
    if (value >= 3) return 'evol-warm';
    if (value <= -2) return 'evol-cool';
    return 'evol-neutral';
  }

  filterBarByYear(year: number) {
    return this.barParams.filter((b) => b.year === year);
  }

  formatSource(source: string): string {
    if (source === 'auto') return 'Auto (tags)';
    if (source === 'manuel') return 'Manuel';
    return source;
  }
}
