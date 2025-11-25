import { Injectable } from '@angular/core';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import { Account } from '../models/account.model';

export type SplitMode = 'equal' | 'prorata' | 'fixed' | 'single';

export interface SplitMember {
  id: 'A' | 'B';
  name: string;
  color: string;
  income: number;
}

export interface SplitLine {
  id?: number;
  label: string;
  categoryLabel?: string;
  accountId?: number;
  accountName?: string;
  amount: number;
  mode: SplitMode;
  fixedRatioA?: number; // 0-100
  payer?: 'A' | 'B';
  includeInSplit: boolean;
  source?: 'recurring' | 'manual';
}

export interface SplitTotals {
  totalA: number;
  totalB: number;
  delta: number; // positif si A paye plus que B
}

@Injectable({
  providedIn: 'root',
})
export class CoupleSplitService {
  mapRecurringToLines(
    recurrences: RecurringTransaction[],
    accounts: Account[],
  ): SplitLine[] {
    const accountById = new Map<number, Account>(
      accounts.map((a) => [a.id!, a]),
    );

    return recurrences
      .filter((rt) => (rt.financialFlowId || 0) === 2)
      .map((rt) => {
        const account = rt.accountId ? accountById.get(rt.accountId) : null;
        const amount =
          typeof rt.amount === 'string'
            ? parseFloat(rt.amount)
            : rt.amount || 0;
        const categoryLabel =
          (rt as any)['subCategoryLabel'] ||
          (rt as any)['subcategoryLabel'] ||
          '';

        return {
          id: rt.id,
          label: rt.label,
          categoryLabel,
          accountId: rt.accountId,
          accountName: account?.name,
          amount: Math.abs(amount),
          mode: 'prorata',
          fixedRatioA: 50,
          payer: 'A',
          includeInSplit: false,
          source: 'recurring',
        } as SplitLine;
      });
  }

  computeParts(
    line: SplitLine,
    memberAIncome: number,
    memberBIncome: number,
  ): { partA: number; partB: number } {
    if (!line.includeInSplit) {
      return { partA: 0, partB: 0 };
    }

    const amount = Math.max(0, line.amount || 0);
    const totalIncome = memberAIncome + memberBIncome;
    const ratioA = totalIncome > 0 ? memberAIncome / totalIncome : 0.5;

    switch (line.mode) {
      case 'equal': {
        const half = amount / 2;
        return { partA: half, partB: half };
      }
      case 'prorata': {
        const partA = amount * ratioA;
        return { partA, partB: amount - partA };
      }
      case 'fixed': {
        const fixedA =
          typeof line.fixedRatioA === 'number' ? line.fixedRatioA : 50;
        const partA = (amount * fixedA) / 100;
        return { partA, partB: amount - partA };
      }
      case 'single': {
        if (line.payer === 'B') {
          return { partA: 0, partB: amount };
        }
        return { partA: amount, partB: 0 };
      }
      default:
        return { partA: 0, partB: 0 };
    }
  }

  computeTotals(
    lines: SplitLine[],
    memberAIncome: number,
    memberBIncome: number,
  ): SplitTotals {
    return lines.reduce(
      (acc, line) => {
        const { partA, partB } = this.computeParts(
          line,
          memberAIncome,
          memberBIncome,
        );
        acc.totalA += partA;
        acc.totalB += partB;
        return acc;
      },
      { totalA: 0, totalB: 0, delta: 0 } as SplitTotals,
    );
  }
}
