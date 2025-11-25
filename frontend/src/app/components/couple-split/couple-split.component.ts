import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { Subscription, combineLatest } from 'rxjs';
import {
  CoupleSplitService,
  SplitLine,
  SplitMember,
  SplitMode,
} from '../../services/couple-split.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { AccountService } from '../../services/account.service';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { Account } from '../../models/account.model';

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
    CheckboxModule,
    ButtonModule,
    TagModule,
    ChartModule,
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
    private recurringService: RecurringTransactionService,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    const combined$ = combineLatest([
      this.recurringService.recurringTransactions$,
      this.accountService.accounts$,
    ]);

    this.subscriptions.add(
      combined$.subscribe(([recurring, accounts]) => {
        this.syncWithRecurring(recurring, accounts);
      }),
    );

    this.recurringService.getRecurringTransactions().subscribe();
    this.accountService.getAccounts().subscribe();
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
      includeInSplit: true,
      source: 'manual',
    };
    this.lines.set([...current, next]);
  }

  removeLine(index: number): void {
    const copy = [...this.lines()];
    copy.splice(index, 1);
    this.lines.set(copy);
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
    this.lines.set([
      ...this.lines(),
      {
        ...base,
        includeInSplit: true,
        source: 'recurring',
      },
    ]);
    this.selectedRecurringId.set(null);
  }

  updateMemberName(id: 'A' | 'B', value: string): void {
    const updated = this.members().map((m) =>
      m.id === id ? { ...m, name: value } : m,
    );
    this.members.set(updated);
  }

  updateMemberIncome(id: 'A' | 'B', value: number | null): void {
    const income = value ?? 0;
    const updated = this.members().map((m) =>
      m.id === id ? { ...m, income } : m,
    );
    this.members.set(updated);
  }

  getParts(line: SplitLine): { partA: number; partB: number } {
    const [a, b] = this.members();
    return this.coupleSplit.computeParts(line, a.income, b.income);
  }

  totals() {
    const [a, b] = this.members();
    const totals = this.coupleSplit.computeTotals(
      this.lines(),
      a.income,
      b.income,
    );
    totals.delta = totals.totalA - totals.totalB;
    return totals;
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
        label: l.accountName ? `${l.label} • ${l.accountName}` : l.label,
        value: l.id as number,
      }));
  }

  private syncWithRecurring(
    recurring: RecurringTransaction[],
    accounts: Account[],
  ) {
    const current = this.lines();
    const byId = new Map<number, SplitLine>();
    current
      .filter((l) => typeof l.id === 'number')
      .forEach((l) => byId.set(l.id as number, l));

    const mapped = this.coupleSplit.mapRecurringToLines(recurring, accounts);
    this.recurringPool.set(mapped);

    const merged: SplitLine[] = mapped.map((line) => {
      if (line.id && byId.has(line.id)) {
        const existing = byId.get(line.id)!;
        return { ...line, ...existing, source: 'recurring' as const };
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
