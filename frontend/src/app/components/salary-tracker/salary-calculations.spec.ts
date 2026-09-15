import { annualSalaries, monthlyNet } from './salary-calculations';
import { SalaryEntry } from '../../services/salary.service';
const entry = (year: number, month: number, net: number): SalaryEntry => ({
  month: new Date(year, month - 1, 1),
  ets: 'CST',
  gross: 0,
  net,
  netTaxable: net + 100,
  pas: 0,
  rounding: 0,
  bonus: 0,
  comment: '',
});
describe('Salary annual calculations', () => {
  it('counts distinct months, sums all payslips and compares complete years', () => {
    const rows = [2024, 2025].flatMap((y) =>
      Array.from({ length: 12 }, (_, m) =>
        entry(y, m + 1, y === 2024 ? 1000 : 1100),
      ),
    );
    const annual = annualSalaries(rows);
    expect(annual[0].rna).toBe(13200);
    expect(annual[0].rnia).toBe(14400);
    expect(annual[0].mrnm).toBe(1100);
    expect(annual[0].evolution).toBeCloseTo(10);
    rows.push(entry(2025, 1, 120));
    expect(annualSalaries(rows)[0].months).toBe(12);
    expect(annualSalaries(rows)[0].mrnm).toBe(1110);
  });
  it('marks partial years and leaves their evolution unavailable', () => {
    const rows = annualSalaries([entry(2025, 1, 1000), entry(2026, 1, 1100)]);
    expect(rows[0].partial).toBeTrue();
    expect(rows[0].evolution).toBeNull();
  });
  it('sorts chart months and represents missing months by gaps rather than zero', () => {
    const rows = monthlyNet([
      entry(2026, 3, 1100),
      entry(2026, 1, 1000),
      entry(2026, 1, 200),
    ]);
    expect(rows.map((r) => r.net)).toEqual([1200, null, 1100]);
    expect(monthlyNet([])).toEqual([]);
  });
});
