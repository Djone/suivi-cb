import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SalaryService, SalaryEntry } from './salary.service';
import { environment } from '../../environments/environment';

describe('SalaryService', () => {
  let service: SalaryService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/salaries`;
  const entry: SalaryEntry = {
    month: new Date(2026, 2, 1),
    company: 'Entreprise',
    ets: 'CST',
    gross: 4200.25,
    net: 3000,
    netTaxable: 3200,
    pas: 150,
    rounding: -0.12,
    bonus: 200,
    donations: 0,
    comment: '',
    tenureStart: '2019-01-20',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalaryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('preserves the local payslip month and gross in the API payload', () => {
    service.save(entry).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ...entry, month: '2026-03-01' });
    request.flush({ id: 1 });
  });
  it('reloads persisted dates without moving the month', () => {
    service.load().subscribe((rows) => {
      expect(rows[0].month.getFullYear()).toBe(2026);
      expect(rows[0].month.getMonth()).toBe(2);
      expect(rows[0].gross).toBe(4200.25);
    });
    http.expectOne(url).flush([{ ...entry, id: 1, month: '2026-03-01' }]);
  });
  it('updates by server id and excludes the id from the payload', () => {
    service.save({ ...entry, id: 42 }).subscribe();
    const request = http.expectOne(`${url}/42`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.id).toBeUndefined();
    request.flush({ id: 42 });
  });
});
