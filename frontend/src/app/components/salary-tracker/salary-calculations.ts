import { SalaryEntry } from '../../services/salary.service';

export interface SalaryYear {
  year: number;
  months: number;
  rna: number;
  mrnm: number;
  rnia: number;
  gross: number;
  evolution: number | null;
  partial: boolean;
}

export function annualSalaries(entries: SalaryEntry[]): SalaryYear[] {
  const years = [...new Set(entries.map((e) => e.month.getFullYear()))].sort(
    (a, b) => a - b,
  );
  const rows = years.map((year) => {
    const entriesInYear = entries.filter((e) => e.month.getFullYear() === year);
    const months = new Set(entriesInYear.map((e) => e.month.getMonth())).size;
    const rna =
      entriesInYear.reduce((sum, e) => sum + Math.round(e.net * 100), 0) / 100;
    return {
      year,
      months,
      rna,
      mrnm: rna / months,
      gross:
        entriesInYear.reduce((sum, e) => sum + Math.round(e.gross * 100), 0) / 100,
      rnia:
        entriesInYear.reduce(
          (sum, e) => sum + Math.round(e.netTaxable * 100),
          0,
        ) / 100,
      evolution: null as number | null,
      partial: months < 12,
    };
  });
  rows.forEach((row) => {
    const previous = rows.find((r) => r.year === row.year - 1);
    if (!row.partial && previous && !previous.partial && previous.mrnm > 0) {
      row.evolution = (row.mrnm / previous.mrnm - 1) * 100;
    }
  });
  return rows.reverse();
}

export function monthlyNet(entries: SalaryEntry[]) {
  const totals = new Map<number, number>();
  entries.forEach((e) => {
    const key = e.month.getFullYear() * 12 + e.month.getMonth();
    totals.set(key, (totals.get(key) || 0) + Math.round(e.net * 100));
  });
  const keys = [...totals.keys()].sort((a, b) => a - b);
  if (!keys.length) return [];
  return Array.from({ length: keys.at(-1)! - keys[0] + 1 }, (_, index) => {
    const key = keys[0] + index;
    return {
      date: new Date(Math.floor(key / 12), key % 12, 1),
      net: totals.has(key) ? totals.get(key)! / 100 : null,
    };
  });
}
