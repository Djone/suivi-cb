import { of, throwError } from 'rxjs';
import { SalaryTrackerComponent } from './salary-tracker.component';
import { SalaryEntry, SalaryService } from '../../services/salary.service';

describe('SalaryTrackerComponent', () => {
  let service: jasmine.SpyObj<SalaryService>;
  let component: SalaryTrackerComponent;
  const entry = (
    id: number,
    year: number,
    month: number,
    net: number,
    ets: SalaryEntry['ets'] = 'CST',
  ): SalaryEntry => ({
    id,
    month: new Date(year, month - 1, 1),
    ets,
    company: 'Entreprise',
    gross: 9000,
    net,
    netTaxable: net + 100,
    pas: 0,
    rounding: 0,
    bonus: 999,
    donations: 0,
    comment: '',
    tenureStart: null,
  });
  beforeEach(() => {
    service = jasmine.createSpyObj('SalaryService', [
      'load',
      'save',
      'delete',
      'loadAnnual',
      'saveAnnual',
    ]);
    service.loadAnnual.and.returnValue(of([]));
    component = new SalaryTrackerComponent(service);
    service.load.and.returnValue(
      of([
        entry(1, 2025, 12, 1000),
        entry(2, 2026, 2, 1200),
        entry(3, 2026, 1, 1000),
        entry(4, 2026, 2, 300, 'CAP'),
      ]),
    );
    component.ngOnInit();
  });
  it('filters years and establishment and recalculates both averages', () => {
    component.selectedYears = [2026];
    component.historyFilterValue = 'CST';
    component.onFilterChange();
    expect(component.filteredRows.length).toBe(2);
    expect(component.cards[0].value).toBe(1100);
    expect(component.cards[1].value).toBe(1200);
    expect(component.cards[3].value).toBe(20);
    component.selectedYears = [2025, 2026];
    component.onFilterChange();
    expect(component.filteredRows.length).toBe(3);
  });
  it('compares monthly net totals independently of gross, taxable income and bonus', () => {
    expect(component.cards[3].value).toBe(50);
  });
  it('paginates by year without limiting the full-history chart', () => {
    expect(component.detailYear).toBe(2026);
    expect(component.detailRows.length).toBe(3);
    component.changeYear(1);
    expect(component.detailYear).toBe(2025);
    expect(component.detailRows.length).toBe(1);
    component.selectedYears = [2026];
    component.onFilterChange();
    expect(component.detailYear).toBe(2026);
    expect(component.chartData.labels.length).toBe(3);
  });
  it('keeps seniority based on all history regardless of filters', () => {
    const first = component.firstPayslip;
    component.historyFilterValue = 'CAP';
    component.selectedYears = [2026];
    component.onFilterChange();
    expect(component.firstPayslip).toEqual(first);
    expect(component.firstPayslip?.getFullYear()).toBe(2025);
  });
  it('does not invent an evolution when there is no comparison or zero previous net', () => {
    component.entries = [entry(1, 2026, 1, 0), entry(2, 2026, 2, 1000)];
    component.onFilterChange();
    expect(component.cards[3].value).toBeNull();
    component.selectedYears = [2024];
    component.onFilterChange();
    expect(component.cards[0].value).toBeNull();
    expect(component.cards[2].value).toBeNull();
  });
  it('sends gross and keeps entered values visible when saving fails', () => {
    component.openModal();
    component.formModel = entry(10, 2026, 3, 1000);
    service.save.and.returnValue(throwError(() => new Error('offline')));
    component.saveEntry();
    expect(service.save.calls.mostRecent().args[0].gross).toBe(9000);
    expect(component.visibleModal).toBeTrue();
    expect(component.formError).toBeTruthy();
    expect(component.entries.length).toBe(4);
  });
  it('uses the server id after creating a payslip', () => {
    component.openModal();
    component.formModel = entry(10, 2026, 3, 1000);
    service.save.and.returnValue(of({ id: 42 }));
    component.saveEntry();
    expect(component.entries.some((e) => e.id === 42)).toBeTrue();
    expect(component.visibleModal).toBeFalse();
  });
  it('accepts only the five required fields and defaults optional amounts', () => {
    component.openModal();
    component.formModel = {
      month: new Date(2026, 7, 1),
      ets: 'CST',
      gross: 4000,
      net: 3100,
      netTaxable: 2973.11,
    };
    service.save.and.returnValue(of({ id: 42 }));
    component.saveEntry();
    expect(service.save).toHaveBeenCalled();
    expect(service.save.calls.mostRecent().args[0].pas).toBe(0);
    expect(component.visibleModal).toBeFalse();
  });
  it('requires an explicit value for each mandatory amount', () => {
    for (const field of ['gross', 'net', 'netTaxable'] as const) {
      component.openModal();
      component.formModel = entry(10, 2026, 3, 1000);
      delete component.formModel[field];
      component.saveEntry();
      expect(service.save).not.toHaveBeenCalled();
      expect(component.formError).toBeTruthy();
    }
  });
});
