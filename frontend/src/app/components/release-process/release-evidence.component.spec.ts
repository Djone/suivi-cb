import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ReleaseEvidenceComponent } from './release-evidence.component';
import {
  EvidenceReport,
  ReleaseEvidenceService,
} from '../../services/release-evidence.service';
describe('Persistent release evidence', () => {
  let service: jasmine.SpyObj<ReleaseEvidenceService>;
  const report = (): EvidenceReport => ({
    dossier: {
      identity: 'identity',
      revision: 7,
      manifest: {
        candidate: '2.2.0-rc.99',
        commit: 'a'.repeat(40),
        archiveSha256: 'b'.repeat(64),
        exceptionReviewBy: '2026-10-22',
        images: {
          backend: { configDigest: 'sha256:' + 'c'.repeat(64) },
          frontend: { configDigest: 'sha256:' + 'd'.repeat(64) },
        },
      },
      scope: { frozen: true, summary: 'Scope', releaseNotes: 'Notes' },
      origin: {
        kind: 'local-checksummed-import',
        githubUrl: null,
        authenticatedGithubProvenance: false,
      },
      validations: {},
      importedAt: '2026-10-20T00:00:00Z',
    },
    checks: [
      {
        id: 'source-review',
        label: 'Source review',
        status: 'MISSING_OR_FAILED',
        stage: 'development',
      },
    ],
    blockers: [
      { id: 'archive', label: 'Archive missing', stage: 'development' },
    ],
    repository: { commit: 'a'.repeat(40), clean: true },
    readyForPreproduction: false,
    readyForProduction: false,
    canClose: false,
    publicationEnabled: false,
  });
  beforeEach(() => {
    service = jasmine.createSpyObj('ReleaseEvidenceService', [
      'read',
      'update',
      'importBundle',
      'report',
    ]);
    for (const key of ['read', 'update', 'importBundle', 'report'] as const)
      service[key].and.returnValue(of(report()));
    TestBed.configureTestingModule({
      imports: [ReleaseEvidenceComponent],
      providers: [{ provide: ReleaseEvidenceService, useValue: service }],
    });
  });
  it('renders persistent identity and blockers without declaring production ready', () => {
    const f = TestBed.createComponent(ReleaseEvidenceComponent);
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('2.2.0-rc.99');
    expect(text).toContain('Production : bloquée');
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(
      buttons.find((b) => b.textContent?.includes('Clôturer'))?.disabled,
    ).toBeTrue();
    expect(service.update).not.toHaveBeenCalled();
    f.destroy();
  });
  it('binds updates to the server identity and revision, not session checkboxes', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    c.ngOnInit();
    c.summary = 'Changed';
    c.saveScope();
    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        action: 'scope',
        identity: 'identity',
        revision: 7,
        scope: { summary: 'Changed', releaseNotes: 'Notes', frozen: true },
      }),
    );
  });
  it('requires explicit confirmation and evidence reference for human attestations', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    c.ngOnInit();
    c.validate(true);
    expect(service.update).not.toHaveBeenCalled();
    c.reference = 'NAS report';
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    c.validate(true);
    expect(service.update).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    c.validate(true);
    expect(service.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        identity: 'identity',
        check: 'source-review',
        reference: 'NAS report',
        approved: true,
      }),
    );
  });
  it('does not call close on a blocked report, even directly', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    c.ngOnInit();
    c.close();
    expect(service.update).not.toHaveBeenCalled();
  });
  it('imports only a source selector and run ID, never a filesystem path or command', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    c.runId = '123';
    c.importBundle();
    expect(service.importBundle).toHaveBeenCalledWith('github', '123');
  });
  it('reports stale updates and recovers its busy state', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    c.ngOnInit();
    service.update.and.returnValue(
      throwError(() => ({ error: { message: 'STALE_DOSSIER' } })),
    );
    c.saveScope();
    expect(c.busy).toBeFalse();
    expect(c.error).toBe('STALE_DOSSIER');
  });
  it('emits the imported candidate so the parent version follows the evidence', () => {
    const c = TestBed.createComponent(
      ReleaseEvidenceComponent,
    ).componentInstance;
    const emitted = spyOn(c.candidateSelected, 'emit');
    c.ngOnInit();
    expect(emitted).toHaveBeenCalledWith(
      jasmine.objectContaining({ candidate: '2.2.0-rc.99' }),
    );
  });
});
