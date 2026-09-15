import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type SalaryEts = 'CST' | 'CAP' | 'SDG' | 'ATS' | 'OTHER';
export interface SalaryEntry {
  id?: number;
  month: Date;
  ets: SalaryEts;
  company?: string;
  gross: number;
  net: number;
  netTaxable: number;
  pas: number;
  rounding: number;
  bonus: number;
  donations?: number;
  comment: string;
  tenureStart?: string | null;
}
type ApiEntry = Omit<SalaryEntry, 'month'> & { month: string };
export interface SalaryFiscalYear {
  year: number;
  rfr: number | null;
  ir: number | null;
}
@Injectable({ providedIn: 'root' })
export class SalaryService {
  private readonly url = `${environment.apiUrl}/api/salaries`;
  constructor(private readonly http: HttpClient) {}
  loadAnnual() {
    return this.http.get<SalaryFiscalYear[]>(`${this.url}/annual`);
  }
  saveAnnual(row: SalaryFiscalYear) {
    return this.http.put<SalaryFiscalYear>(`${this.url}/annual/${row.year}`, {
      rfr: row.rfr,
      ir: row.ir,
    });
  }
  load() {
    return this.http.get<ApiEntry[]>(this.url).pipe(
      map((rows) =>
        rows.map((row) => ({
          ...row,
          month: new Date(
            Number(row.month.slice(0, 4)),
            Number(row.month.slice(5, 7)) - 1,
            1,
          ),
        })),
      ),
    );
  }
  save(entry: SalaryEntry) {
    const { id, ...data } = entry;
    const payload = {
      ...data,
      month: `${data.month.getFullYear()}-${String(data.month.getMonth() + 1).padStart(2, '0')}-01`,
    };
    return id
      ? this.http.put<{ id: number }>(`${this.url}/${id}`, payload)
      : this.http.post<{ id: number }>(this.url, payload);
  }
  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
