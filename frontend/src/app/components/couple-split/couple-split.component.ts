import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { SliderModule } from 'primeng/slider';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { Subscription, Subject, forkJoin, of } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import {
  CoupleSplitService,
  SplitLine,
  SplitMember,
  SplitMode,
  CoupleSplitConfig,
} from '../../services/couple-split.service';

interface DropdownOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-couple-split',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    SliderModule,
    ButtonModule,
    ChartModule,
    HttpClientModule,
  ],
  templateUrl: './couple-split.component.html',
  styleUrls: ['./couple-split.component.css'],
})
export class CoupleSplitComponent implements OnInit, OnDestroy {
  members = signal<SplitMember[]>([
    { id: 'A', name: 'Jo', color: '#6366F1', income: 0 },
    { id: 'B', name: 'Lu', color: '#10B981', income: 0 },
  ]);

  lines = signal<SplitLine[]>([]);
  recurringPool = signal<SplitLine[]>([]);
  selectedRecurringId = signal<number | null>(null);
  selectedMonth = this.buildMonthString(new Date());
  customProrataA = signal<number>(50);
  ignoredRecurringIds = signal<number[]>([]);
  private saveQueue$ = new Subject<void>();
  private readyToPersist = false;
  private subscriptions = new Subscription();

  modeOptions: DropdownOption<SplitMode>[] = [
    { label: '50 / 50', value: 'equal' },
    { label: 'Prorata revenus', value: 'prorata' },
    { label: 'Fixe (custom)', value: 'fixed' },
    { label: 'Un seul payeur', value: 'single' },
  ];

  payerOptions: DropdownOption<'A' | 'B'>[] = [
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
  ];

  chartData = computed(() => {
    const totals = this.totals();
    const [memberA, memberB] = this.members();
    return {
      labels: [memberA.name, memberB.name],
      datasets: [
        {
          data: [totals.totalA, totals.totalB],
          backgroundColor: [memberA.color, memberB.color],
        },
      ],
    };
  });

  chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
        },
      },
    },
  };

  constructor(
    private coupleSplit: CoupleSplitService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.saveQueue$
        .pipe(debounceTime(500), switchMap(() => this.persistConfig()))
        .subscribe(),
    );

    const config$ = this.coupleSplit.getConfig().pipe(
      tap((config) => {
        this.members.set(config.members);
        this.lines.set(config.lines);
        this.customProrataA.set(config.customProrataA ?? 50);
        this.ignoredRecurringIds.set(config.ignoredRecurringIds ?? []);
      }),
    );

    const recurring$ = this.coupleSplit.getRecurringLines().pipe(tap((lines) => this.recurringPool.set(lines)));

    this.subscriptions.add(
      forkJoin([config$, recurring$]).subscribe(() => {
        this.syncWithRecurring(this.recurringPool());
        this.readyToPersist = true;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  addManualLine(): void {
    const current = this.lines();
    const next: SplitLine = {
      label: 'Nouvelle charge',
      amount: 0,
      mode: 'prorata',
      fixedRatioA: 50,
      payer: 'A',
      source: 'manual',
    };
    this.lines.set([...current, next]);
    this.scheduleSave();
  }

  removeLine(index: number): void {
    const copy = [...this.lines()];
    const [removed] = copy.splice(index, 1);
    if (removed?.id && removed.source === 'recurring') {
      const ids = new Set(this.ignoredRecurringIds());
      ids.add(removed.id);
      this.ignoredRecurringIds.set([...ids]);
    }
    this.lines.set(copy);
    this.scheduleSave();
  }

  addRecurringLine(): void {
    const selectedId = this.selectedRecurringId();
    if (selectedId === null) {
      return;
    }
    const already = this.lines().some((l) => l.id === selectedId);
    if (already) {
      return;
    }
    const base = this.recurringPool().find((l) => l.id === selectedId);
    if (!base) {
      return;
    }
    this.ignoredRecurringIds.set(
      this.ignoredRecurringIds().filter((id) => id !== selectedId),
    );
    this.lines.set([
      ...this.lines(),
      {
        ...base,
        source: 'recurring',
      },
    ]);
    this.selectedRecurringId.set(null);
    this.scheduleSave();
  }

  updateMemberName(id: 'A' | 'B', value: string): void {
    const updated = this.members().map((m) =>
      m.id === id ? { ...m, name: value } : m,
    );
    this.members.set(updated);
    this.scheduleSave();
  }

  updateMemberIncome(id: 'A' | 'B', value: number | null): void {
    const income = value ?? 0;
    const updated = this.members().map((m) =>
      m.id === id ? { ...m, income } : m,
    );
    this.members.set(updated);
    this.scheduleSave();
  }

  getParts(line: SplitLine): { partA: number; partB: number } {
    const [a, b] = this.members();
    return this.coupleSplit.computeParts(
      line,
      a.income,
      b.income,
      this.prorataRatioA(),
    );
  }

  totals() {
    const [a, b] = this.members();
    const totals = this.coupleSplit.computeTotals(
      this.lines(),
      a.income,
      b.income,
      this.prorataRatioA(),
    );
    totals.delta = totals.totalA - totals.totalB;
    return totals;
  }

  totalCharges(): number {
    const t = this.totals();
    return t.totalA + t.totalB;
  }

  get payerOptionsDynamic(): DropdownOption<'A' | 'B'>[] {
    const [a, b] = this.members();
    return [
      { label: a.name || 'A', value: 'A' },
      { label: b.name || 'B', value: 'B' },
    ];
  }

  get availableRecurringOptions(): DropdownOption<number>[] {
    const usedIds = new Set(this.lines().map((l) => l.id).filter(Boolean) as number[]);
    return this.recurringPool()
      .filter((l) => typeof l.id === 'number' && !usedIds.has(l.id))
      .map((l) => ({
        label: l.accountName ? `${l.label} - ${l.accountName}` : l.label,
        value: l.id as number,
      }));
  }

  prorataRatioA(): number {
    return (this.customProrataA() ?? 50) / 100;
  }

  percent(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }
    return (value / total) * 100;
  }

  setCustomProrata(part: 'A' | 'B', value: number | null): void {
    const clamped = Math.min(100, Math.max(0, value ?? 0));
    if (part === 'A') {
      this.customProrataA.set(clamped);
    } else {
      this.customProrataA.set(100 - clamped);
    }
    this.scheduleSave();
  }

  onLineChange(): void {
    this.scheduleSave();
  }

  private buildConfig(): CoupleSplitConfig {
    return {
      members: this.members(),
      lines: this.lines(),
      customProrataA: this.customProrataA(),
      ignoredRecurringIds: this.ignoredRecurringIds(),
    };
  }

  private persistConfig() {
    if (!this.readyToPersist) {
      return of(null);
    }
    return this.coupleSplit.saveConfig(this.buildConfig());
  }

  private scheduleSave(): void {
    if (!this.readyToPersist) {
      return;
    }
    this.saveQueue$.next();
  }

  private syncWithRecurring(recurringLines: SplitLine[]) {
    const current = this.lines();
    const byId = new Map<number, SplitLine>();
    current
      .filter((l) => typeof l.id === 'number')
      .forEach((l) => byId.set(l.id as number, l));

    this.recurringPool.set(recurringLines);

    const ignoredIds = new Set(this.ignoredRecurringIds());
    const merged: SplitLine[] = recurringLines
      .filter((l) => !(l.id && ignoredIds.has(l.id)))
      .map((line) => {
        if (line.id && byId.has(line.id)) {
          const existing = byId.get(line.id)!;
          // Pour les lignes récurrentes, on garde les choix de répartition,
          // mais on laisse le libellé/montant issus de la source.
          return {
            ...line,
            mode: existing.mode,
            fixedRatioA: existing.fixedRatioA,
            payer: existing.payer,
            source: 'recurring' as const,
          };
        }
        return line;
      });

    const manual: SplitLine[] = current
      .filter((l) => l.source === 'manual')
      .map((l) => ({ ...l, source: 'manual' as const }));
    this.lines.set([...merged, ...manual]);
  }

  private buildMonthString(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }
}



