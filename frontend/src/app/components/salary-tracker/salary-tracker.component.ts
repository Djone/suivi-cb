import { CommonModule } from '@angular/common';
import { Component, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';

type SalaryEts = 'CST' | 'CAP' | 'SDG' | 'ATS' | 'OTHER';

interface SalaryEntry {
  id: number;
  month: Date;
  ets: SalaryEts;
  company: string;
  net: number;
  netTaxable: number;
  pas: number;
  rounding?: number;
  gross?: number;
  bonus?: number;
  donations?: number;
  comment?: string;
}

interface HistoryOption {
  label: string;
  value: SalaryEts | 'ALL';
}

@Component({
  selector: 'app-salary-tracker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    CalendarModule,
    DropdownModule,
    ButtonModule,
    ChartModule,
    TagModule,
  ],
  templateUrl: './salary-tracker.component.html',
  styleUrls: ['./salary-tracker.component.css'],
})
export class SalaryTrackerComponent implements AfterViewInit {
  entries: SalaryEntry[] = [
    {
      id: 1,
      month: new Date('2025-01-01'),
      ets: 'CST',
      company: 'Consorteo',
      net: 3213,
      netTaxable: 3000,
      pas: 50,
      rounding: 0,
      bonus: 0,
      comment: 'CST 2025',
    },
    {
      id: 2,
      month: new Date('2024-01-01'),
      ets: 'CST',
      company: 'Consorteo',
      net: 3144,
      netTaxable: 2900,
      pas: 48,
      rounding: 0,
      bonus: 0,
      comment: 'CST 2024',
    },
    {
      id: 3,
      month: new Date('2023-01-01'),
      ets: 'CST',
      company: 'Consorteo',
      net: 3090,
      netTaxable: 2850,
      pas: 45,
      rounding: 0,
      bonus: 1000,
      comment: 'Prime fin année',
    },
    {
      id: 4,
      month: new Date('2022-01-01'),
      ets: 'CST',
      company: 'Consorteo',
      net: 2950,
      netTaxable: 2720,
      pas: 44,
      rounding: 0,
      bonus: 0,
      comment: 'CST 2022',
    },
    {
      id: 5,
      month: new Date('2021-01-01'),
      ets: 'CST',
      company: 'Consorteo',
      net: 2820,
      netTaxable: 2600,
      pas: 42,
      rounding: 0,
      bonus: 0,
      comment: 'CST 2021',
    },
  ];

  tenureStart = new Date('2019-01-20');
  tenureEnd: Date | null = null;

  visibleModal = false;
  formModel: Partial<SalaryEntry> = {};
  editingId: number | null = null;
  historyFilterValue: HistoryOption['value'] = 'ALL';
  historyFilterOptions: HistoryOption[] = [
    { label: 'Tous Ets', value: 'ALL' },
    { label: 'CST', value: 'CST' },
    { label: 'CAP', value: 'CAP' },
    { label: 'SDG', value: 'SDG' },
    { label: 'ATS', value: 'ATS' },
    { label: 'Autre', value: 'OTHER' },
  ];
  etsOptions: HistoryOption[] = this.historyFilterOptions.filter(
    (opt) => opt.value !== 'ALL',
  );
  filteredRows: SalaryEntry[] = [];
  chartData: any = null;

  get cards() {
    const count = this.entries.length || 1;
    const netAvg = this.entries.reduce((sum, e) => sum + e.net, 0) / count;
    const netTaxableAvg =
      this.entries.reduce((sum, e) => sum + e.netTaxable, 0) / count;
    const last = this.entries.at(0);
    const prev = this.entries.at(1);
    const evol =
      last && prev && prev.net > 0 ? ((last.net - prev.net) / prev.net) * 100 : 0;

    return [
      {
        label: 'Net moyen',
        value: netAvg,
        suffix: '€',
      },
      {
        label: 'Net imposable moyen',
        value: netTaxableAvg,
        suffix: '€',
      },
      {
        label: 'Évolution récente',
        value: evol,
        suffix: '%',
      },
      {
        label: 'Ancienneté',
        value: this.tenureLabel(),
        suffix: '',
      },
    ];
  }

  chartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) =>
            `${Number(value).toLocaleString('fr-FR')} €`,
        },
      },
    },
  };

  ngOnInit(): void {
    this.refreshView();
  }

  ngAfterViewInit(): void {
    this.refreshView();
  }

  openModal(entry?: SalaryEntry) {
    if (entry) {
      this.editingId = entry.id;
      this.formModel = { ...entry };
    } else {
      this.editingId = null;
      this.formModel = {
        month: new Date(),
        ets: 'CST',
        company: '',
        gross: 0,
        net: 0,
        bonus: 0,
        netTaxable: 0,
        pas: 0,
        rounding: 0,
        donations: 0,
        comment: '',
      };
    }
    this.visibleModal = true;
  }

  saveEntry() {
    if (
      !this.formModel.month ||
      !this.formModel.ets ||
      !this.formModel.company
    ) {
      return;
    }
    const payload: SalaryEntry = {
      id: this.editingId || Date.now(),
      month: new Date(this.formModel.month),
      ets: this.formModel.ets as SalaryEts,
      company: this.formModel.company,
      netTaxable: this.formModel.netTaxable || 0,
      net: this.formModel.net || 0,
      pas: this.formModel.pas || 0,
      rounding: this.formModel.rounding || 0,
      bonus: this.formModel.bonus || 0,
      donations: this.formModel.donations || 0,
      comment: this.formModel.comment || '',
    };
    if (this.editingId) {
      this.entries = this.entries.map((e) =>
        e.id === this.editingId ? payload : e,
      );
    } else {
      this.entries = [payload, ...this.entries];
    }
    this.refreshView();
    this.visibleModal = false;
  }

  deleteEntry(entry: SalaryEntry) {
    this.entries = this.entries.filter((e) => e.id !== entry.id);
    this.refreshView();
  }

  onFilterChange() {
    this.refreshView();
  }

  tenureLabel(): string {
    const start = this.tenureStart;
    const end = this.tenureEnd || new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return `${years} ans ${months} mois`;
  }

  private updateChartData(): void {
    this.chartData = this.buildChartData(this.filteredRows);
  }

  private refreshView(): void {
    const source =
      this.historyFilterValue === 'ALL'
        ? this.entries
        : this.entries.filter((e) => e.ets === this.historyFilterValue);
    this.filteredRows = [...source].sort(
      (a, b) => b.month.getTime() - a.month.getTime(),
    );
    this.updateChartData();
  }

  private buildChartData(filtered: SalaryEntry[]) {
    const yearly = filtered.reduce(
      (acc, e) => {
        const year = e.month.getFullYear();
        acc[year] = (acc[year] || 0) + e.netTaxable + (e.bonus || 0);
        return acc;
      },
      {} as Record<number, number>,
    );

    const years = Object.keys(yearly)
      .map((y) => Number(y))
      .sort((a, b) => a - b);

    return {
      labels: years.map((y) => y.toString()),
      datasets: [
        {
          type: 'bar',
          label: 'Brut annuel',
          data: years.map((y) => yearly[y]),
          backgroundColor: '#3B82F6',
        },
        {
          type: 'line',
          label: 'Tendance',
          data: years.map((y) => yearly[y]),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.25,
        },
      ],
    };
  }
}



