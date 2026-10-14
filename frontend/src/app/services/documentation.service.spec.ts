import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DocumentationEntry } from '../components/documentation/documentation.model';
import { DocumentationService } from './documentation.service';
import { environment } from '../../environments/environment';

const url = `${environment.apiUrl}/api/documentation`;
const source: DocumentationEntry[] = ['one', 'two'].map((id) => ({
  id: `docs/${id}.md`, sourcePath: `${id}.md`, title: id, category: 'Modes opératoires',
  body: '## Source', summary: '', owner: 'Équipe', updated: '', status: 'published', revision: 'a'.repeat(64),
}));

describe('DocumentationService repository API', () => {
  let service: DocumentationService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocumentationService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function load(): Promise<void> {
    const loading = service.load();
    http.expectOne(url).flush(source);
    await loading;
  }

  it('loads live repository data and creates only after the backend confirms', async () => {
    await load();
    const creating = service.create();
    expect(service.documents().length).toBe(2);
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    const created: DocumentationEntry = { ...source[0], id: 'docs/new.md', sourcePath: 'new.md', status: 'draft' };
    request.flush(created);
    expect((await creating).id).toBe(created.id);
    expect(service.documents()[0].status).toBe('draft');
  });

  it('sends the repository version and uses the returned publication metadata', async () => {
    await load();
    const publishing = service.publish(source[0].id, 'Updated', '## Changed', '', 'Référentiels');
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.revision).toBe(source[0].revision);
    expect(service.documents()[0].body).toBe('## Source');
    request.flush({ ...source[0], title: 'Updated', body: '## Changed', revision: 'b'.repeat(64) });
    await publishing;
    expect(service.documents()[0].body).toBe('## Changed');
    expect(service.documents()[0].revision).toBe('b'.repeat(64));
  });

  it('preserves current state on a conflict and never reports a successful deletion early', async () => {
    await load();
    const deleting = service.remove(source[0].id);
    const rejected = expectAsync(deleting).toBeRejected();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ id: source[0].id, revision: source[0].revision });
    expect(service.documents().length).toBe(2);
    request.flush({ error: 'Version changed' }, { status: 409, statusText: 'Conflict' });
    await rejected;
    expect(service.documents().length).toBe(2);
    const success = service.remove(source[0].id);
    http.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
    expect(await success).toBeTrue();
    expect(await service.remove(source[1].id)).toBeFalse();
    http.expectNone(url);
  });
});
