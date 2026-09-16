import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ChartModule } from 'primeng/chart';
import { annualSalaries, monthlyNet } from './salary-calculations';
import { SalaryFiscalYear } from '../../services/salary.service';
import {
  SalaryEntry,
  SalaryEts,
  SalaryService,
} from '../../services/salary.service';
import { TagModule } from 'primeng/tag';

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
    MultiSelectModule,
    ChartModule,
    TagModule,
  ],
  templateUrl: './salary-tracker.component.html',
  styleUrls: ['./salary-tracker.component.css'],
})
export class SalaryTrackerComponent implements OnInit {
  entries: SalaryEntry[] = [];
  selectedYears: number[] = [];
  loading = false;
  saving = false;
  errorMessage = '';
  formError = '';
  detailYear: number | null = null;
  fiscalYears: SalaryFiscalYear[] = [];
  fiscalForm: SalaryFiscalYear = {
    year: new Date().getFullYear(),
    rfr: null,
    ir: null,
  };
  fiscalVisible = false;
  fiscalSaving = false;
  fiscalError = '';
  annualSearch = '';
  annualSortKey: 'year' | 'evolution' | 'rna' | 'mrnm' | 'rnia' | 'gross' | 'rfr' | 'ir' | 'irEvolution' = 'year';
  annualSortDesc = true;
  annualPage = 0;
  readonly annualPageSize = 10;
  chartData: { labels: string[]; datasets: object[] } = {
    labels: [],
    datasets: [],
  };
  recentChartData: { labels: string[]; datasets: object[] } = {
    labels: [],
    datasets: [],
  };
  latestMonthlyNet: number | null = null;
  recentChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { maxTicksLimit: 12, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Revenu net mensuel (€)' },
      },
    },
  };

  get establishmentRows() {
    return this.entries.filter(
      (e) =>
        this.historyFilterValue === 'ALL' || e.ets === this.historyFilterValue,
    );
  }
  get annualRows() {
    return annualSalaries(this.entries)
      .map((row) => {
        const fiscal = this.fiscalYears.find((f) => f.year === row.year);
        const previous = this.fiscalYears.find((f) => f.year === row.year - 1);
        const ir = fiscal?.ir ?? null;
        return {
          ...row,
          rfr: fiscal?.rfr ?? null,
          ir,
          irEvolution:
            ir !== null && previous?.ir != null && previous.ir !== 0
              ? ((ir - previous.ir) / Math.abs(previous.ir)) * 100
              : null,
        };
      });
  }
  get annualFilteredRows() {
    const query = this.annualSearch.trim().toLowerCase();
    const rows = this.annualRows.filter(row => !query || Object.values(row).some(value => value != null && String(value).toLowerCase().includes(query)));
    return [...rows].sort((a, b) => {
      const av = a[this.annualSortKey] ?? -Infinity;
      const bv = b[this.annualSortKey] ?? -Infinity;
      return (av < bv ? -1 : av > bv ? 1 : 0) * (this.annualSortDesc ? -1 : 1);
    });
  }
  get annualPageCount() { return Math.max(1, Math.ceil(this.annualFilteredRows.length / this.annualPageSize)); }
  get annualPageRows() { const start = this.annualPage * this.annualPageSize; return this.annualFilteredRows.slice(start, start + this.annualPageSize); }
  setAnnualSort(key: string) {
    if (!['year', 'evolution', 'rna', 'mrnm', 'rnia', 'gross', 'rfr', 'ir', 'irEvolution'].includes(key)) return;
    const sortKey = key as typeof this.annualSortKey;
    this.annualSortDesc = this.annualSortKey === sortKey ? !this.annualSortDesc : sortKey === 'year';
    this.annualSortKey = sortKey;
    this.annualPage = 0;
  }
  onAnnualSearch(value: string) { this.annualSearch = value; this.annualPage = 0; }
  changeAnnualPage(delta: number) { this.annualPage = Math.min(Math.max(0, this.annualPage + delta), this.annualPageCount - 1); }
  get detailYears() {
    return [
      ...new Set(this.entries.map((e) => e.month.getFullYear())),
    ].sort((a, b) => b - a);
  }
  get detailRows() {
    return this.entries.filter(
      (e) => e.month.getFullYear() === this.detailYear,
    ).sort((a, b) => b.month.getTime() - a.month.getTime() || (b.id || 0) - (a.id || 0));
  }
  changeYear(direction: number) {
    const index = this.detailYears.indexOf(this.detailYear!);
    this.detailYear = this.detailYears[index + direction] ?? this.detailYear;
  }
  get seniority() {
    if (!this.entries.length) return '—';
    const first = Math.min(
      ...this.entries.map(
        (e) => e.month.getFullYear() * 12 + e.month.getMonth(),
      ),
    );
    const now = new Date();
    const elapsed = Math.max(
      0,
      now.getFullYear() * 12 + now.getMonth() - first,
    );
    return `${Math.floor(elapsed / 12)} ans ${elapsed % 12} mois`;
  }
  get firstPayslip() {
    return this.entries.length
      ? new Date(Math.min(...this.entries.map((e) => e.month.getTime())))
      : null;
  }
  editFiscal(year: number) {
    this.fiscalForm = {
      ...(this.fiscalYears.find((f) => f.year === year) || {
        year,
        rfr: null,
        ir: null,
      }),
    };
    this.fiscalError = '';
    this.fiscalVisible = true;
  }
  saveFiscal() {
    if (this.fiscalSaving) return;
    this.fiscalSaving = true;
    this.salaryService.saveAnnual(this.fiscalForm).subscribe({
      next: (row) => {
        this.fiscalYears = [
          ...this.fiscalYears.filter((f) => f.year !== row.year),
          row,
        ];
        this.fiscalVisible = false;
        this.fiscalSaving = false;
      },
      error: () => {
        this.fiscalError = 'Enregistrement des données annuelles impossible.';
        this.fiscalSaving = false;
      },
    });
  }

  constructor(private readonly salaryService: SalaryService) {}

  get yearOptions() {
    return [...new Set(this.entries.map((e) => e.month.getFullYear()))]
      .sort((a, b) => b - a)
      .map((year) => ({ label: String(year), value: year }));
  }

  // Locale français pour PrimeNG p-calendar
  frLocale = {
    firstDayOfWeek: 1,
    dayNames: [
      'dimanche',
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
    ],
    dayNamesShort: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    dayNamesMin: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
    monthNames: [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ],
    monthNamesShort: [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ],
    today: "Aujourd'hui",
    clear: 'Effacer',
  };

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

  get cards() {
    const rows = this.filteredRows;
    const count = rows.length;
    const monthly = new Map<number, number>();
    rows.forEach((row) => {
      const month = row.month.getFullYear() * 12 + row.month.getMonth();
      monthly.set(month, (monthly.get(month) || 0) + row.net);
    });
    const months = [...monthly.keys()].sort((a, b) => a - b);
    const last = monthly.get(months.at(-1)!);
    const previous = monthly.get(months[0]);
    const evolution =
      last !== undefined && previous !== undefined && previous > 0
        ? ((last - previous) / previous) * 100
        : null;
    return [
      {
        label: 'Net imposable moyen',
        value: count
          ? rows.reduce((sum, e) => sum + e.netTaxable, 0) / count
          : null,
        suffix: '€',
      },
      {
        label: 'Net moyen',
        value: count ? rows.reduce((sum, e) => sum + e.net, 0) / count : null,
        suffix: '€',
      },
      {
        label: 'Brut moyen',
        value: count ? rows.reduce((sum, e) => sum + e.gross, 0) / count : null,
        suffix: '€',
      },
      { label: 'Évolution du net', value: evolution, suffix: '%' },
    ];
  }

  get socialPosition(): string {
    const values = this.filteredRows.map((row) => row.net).filter(Number.isFinite);
    if (!values.length) return 'Non classé';
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    // Repères indicatifs pour une personne seule : ils comparent un salaire net
    // au niveau de vie INSEE et ne constituent pas une catégorie officielle.
    if (average < 1337) return 'Sous le seuil de pauvreté';
    if (average < 1782) return 'Classe populaire';
    if (average < 2674) return 'Classe moyenne';
    if (average < 4010) return 'Barre haute de la classe moyenne';
    return 'Catégorie aisée';
  }

  get socialPositionPercent(): number {
    const average = this.cards[1].value;
    if (typeof average !== 'number') return 0;
    return Math.max(0, Math.min(100, ((average - 1300) / (4500 - 1300)) * 100));
  }

  ngOnInit(): void {
    this.loadEntries();
    this.salaryService.loadAnnual().subscribe({
      next: (rows) => (this.fiscalYears = rows),
      error: () =>
        (this.fiscalError =
          'Impossible de charger les valeurs RFR et IR. Réessayez en rechargeant la page.'),
    });
  }

  loadEntries(): void {
    this.loading = true;
    this.errorMessage = '';
    this.salaryService.load().subscribe({
      next: (rows) => {
        this.entries = rows;
        this.refreshView();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les salaires. Réessayez.';
        this.loading = false;
      },
    });
  }

  openModal(entry?: SalaryEntry): void {
    this.formError = '';
    this.editingId = entry?.id ?? null;
    this.formModel = entry
      ? { ...entry, month: new Date(entry.month) }
      : {
          month: new Date(),
          ets: 'CST',
          gross: undefined,
          net: undefined,
          netTaxable: undefined,
          pas: 0,
          rounding: 0,
          bonus: 0,
          comment: '',
        };
    this.visibleModal = true;
  }

  saveEntry(): void {
    if (this.saving) return;
    const form = this.formModel;
    if (!form.month || !Number.isFinite(form.month.getTime()) || !form.ets) {
      this.formError = 'Renseignez le mois et l’établissement.';
      return;
    }
    const moneyFields = ['gross', 'net', 'netTaxable', 'pas', 'bonus'] as const;
    form.pas ??= 0;
    form.bonus ??= 0;
    form.rounding ??= 0;
    if (
      moneyFields.some(
        (field) =>
          typeof form[field] !== 'number' ||
          !Number.isFinite(form[field]) ||
          form[field]! < 0,
      ) ||
      typeof form.rounding !== 'number' ||
      !Number.isFinite(form.rounding)
    ) {
      this.formError =
        'Renseignez des montants valides et positifs (sauf l’arrondi).';
      return;
    }
    const payload: SalaryEntry = {
      ...(form as SalaryEntry),
      id: this.editingId ?? undefined,
    };
    this.saving = true;
    this.formError = '';
    this.salaryService.save(payload).subscribe({
      next: (result) => {
        const saved = { ...payload, id: result.id };
        this.entries = this.editingId
          ? this.entries.map((e) => (e.id === this.editingId ? saved : e))
          : [...this.entries, saved];
        this.refreshView();
        this.saving = false;
        this.visibleModal = false;
      },
      error: (error) => {
        this.saving = false;
        this.formError =
          error?.error?.error ||
          error?.error?.errors?.join(' ') ||
          'Enregistrement impossible. Vos saisies sont conservées.';
      },
    });
  }

  deleteEntry(entry: SalaryEntry): void {
    if (
      this.saving ||
      !entry.id ||
      !confirm('Supprimer cette feuille de paie ?')
    )
      return;
    this.saving = true;
    this.errorMessage = '';
    this.salaryService.delete(entry.id).subscribe({
      next: () => {
        this.entries = this.entries.filter((e) => e.id !== entry.id);
        this.refreshView();
        this.saving = false;
      },
      error: () => {
        this.errorMessage = 'Suppression impossible. Réessayez.';
        this.saving = false;
      },
    });
  }

  onFilterChange(): void {
    this.refreshView();
  }

  private refreshView(): void {
    const years = this.selectedYears ?? [];
    this.selectedYears = years;
    this.filteredRows = this.entries
      .filter(
        (e) =>
          (this.historyFilterValue === 'ALL' ||
            e.ets === this.historyFilterValue) &&
          (!years.length || years.includes(e.month.getFullYear())),
      )
      .sort(
        (a, b) =>
          b.month.getTime() - a.month.getTime() || (b.id || 0) - (a.id || 0),
      );
    if (!this.detailYears.includes(this.detailYear!))
      this.detailYear = this.detailYears[0] ?? null;
    this.annualPage = Math.min(this.annualPage, this.annualPageCount - 1);
    const series = monthlyNet(this.establishmentRows);
    this.chartData = {
      labels: series.map((p) =>
        p.date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      ),
      datasets: [
        {
          label: 'Revenu net mensuel (€)',
          data: series.map((p) => p.net),
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          pointHoverRadius: 4,
          tension: 0,
          spanGaps: false,
        },
      ],
    };
    const recent = series.slice(-12);
    this.latestMonthlyNet = recent.at(-1)?.net ?? null;
    this.recentChartData = {
      labels: recent.map((p) =>
        p.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      ),
      datasets: [
        {
          data: recent.map((p) => p.net),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, .12)',
          borderWidth: 2,
          pointRadius: 0,
          tension: .25,
          fill: true,
        },
      ],
    };
  }
}
