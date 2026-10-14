import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DocumentationEntry } from '../components/documentation/documentation.model';

@Injectable({ providedIn: 'root' })
export class DocumentationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/documentation`;
  readonly documents = signal<DocumentationEntry[]>([]);

  async load(): Promise<void> {
    if (environment.production) throw new Error('Documentation réservée au développement.');
    this.documents.set(await firstValueFrom(this.http.get<DocumentationEntry[]>(this.url)));
  }

  async create(): Promise<DocumentationEntry> {
    const entry = await firstValueFrom(this.http.post<DocumentationEntry>(this.url, {}));
    this.documents.update((current) => [entry, ...current]);
    return entry;
  }

  async publish(id: string, title: string, body: string, summary: string, category: string): Promise<void> {
    const entry = this.documents().find((item) => item.id === id);
    if (!entry) throw new Error('Document introuvable.');
    const updated = await firstValueFrom(this.http.put<DocumentationEntry>(this.url, {
      id, revision: entry.revision, title, body, summary, category,
    }));
    this.documents.update((current) => current.map((item) => item.id === id ? updated : item));
  }

  async remove(id: string): Promise<boolean> {
    const entry = this.documents().find((item) => item.id === id);
    if (!entry || this.documents().length <= 1) return false;
    await firstValueFrom(this.http.delete<void>(this.url, { body: { id, revision: entry.revision } }));
    this.documents.update((current) => current.filter((item) => item.id !== id));
    return true;
  }
}
