import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReleaseJourneyComponent } from './release-journey.component';
import {
  CandidateFlowStatus,
  EvidenceReport,
  ReleaseEvidenceService,
} from '../../services/release-evidence.service';
describe('Guided release journey', () => {
  let service: jasmine.SpyObj<ReleaseEvidenceService>;
  const status = (): CandidateFlowStatus => ({
    branch: '2.2.0-dev',
    commit: 'a'.repeat(40),
    clean: true,
    pushed: true,
    protected: true,
    ready: true,
    run: {
      id: '501',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/Djone/suivi-cb/actions/runs/501',
    },
    blockers: [],
    task: null,
  });
  beforeEach(() => {
    service = jasmine.createSpyObj('ReleaseEvidenceService', [
      'candidateStatus',
      'prepareCandidate',
      'publishCandidate',
      'candidateArchive',
      'nasKit',
      'createSshKey',
      'probeSsh',
      'sshInstaller',
      'dsmKit',
      'dsmStatus',
      'dsmQueue',
      'dsmReceipt',
    ]);
    service.candidateStatus.and.returnValue(of(status()));
    service.prepareCandidate.and.returnValue(
      of({
        ...status(),
        task: {
          id: 'job',
          status: 'downloading',
          candidate: null,
          runId: '501',
          error: null,
        },
      }),
    );
    TestBed.configureTestingModule({
      imports: [ReleaseJourneyComponent],
      providers: [{ provide: ReleaseEvidenceService, useValue: service }],
    });
  });
  it('builds a production draft only from complete candidate image identities', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    const c = f.componentInstance;
    expect(c.productionCompose).toBe('');
    c.report = {
      dossier: {
        manifest: {
          images: {
            backend: { configDigest: 'sha256:' + 'a'.repeat(64) },
            frontend: { configDigest: 'sha256:' + 'b'.repeat(64) },
          },
        },
      },
    } as unknown as EvidenceReport;
    const draft = c.productionCompose;
    expect(draft).toContain('image: sha256:' + 'a'.repeat(64));
    expect(draft).toContain('image: sha256:' + 'b'.repeat(64));
    expect(draft).toContain('127.0.0.1:4200:8080');
    expect(draft).toContain('external: true');
    expect(draft).toContain('/volume1/docker/suivi-cb/data:/app/data');
    expect(draft).not.toContain('suivi-cb-preprod');
    expect(draft).not.toContain('build:');
    expect(draft).not.toContain('$' + '{PROD_');
    f.destroy();
  });
  it('requests the publication cycle only after explicit confirmation and prevents duplicate requests', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    const prompt = spyOn(window, 'confirm').and.returnValue(false);
    f.componentInstance.publishRegistry();
    expect(service.publishCandidate).not.toHaveBeenCalled();
    prompt.and.returnValue(true);
    service.publishCandidate.and.returnValue(
      of({
        candidate: '2.2.0-rc.999',
        status: 'REQUESTED',
        url: 'https://github.com/Djone/suivi-cb/actions/workflows/ci.yml',
      }),
    );
    f.componentInstance.publishRegistry();
    expect(service.publishCandidate).toHaveBeenCalledOnceWith('a'.repeat(40));
    f.componentInstance.publishRegistry();
    expect(service.publishCandidate).toHaveBeenCalledTimes(1);
    f.destroy();
  });
  it('renders the selected release branch in both instructions and Git commands', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    const selected = '3.4.0-rc.8';
    f.componentInstance.report = {
      dossier: { manifest: { candidate: selected } },
    } as EvidenceReport;
    f.detectChanges();
    expect(f.componentInstance.versions.developmentBranch).toBe('3.4.0-dev');
    expect(f.nativeElement.textContent).toContain('git switch 3.4.0-dev');
    expect(f.nativeElement.textContent).not.toContain('git switch 2.2.0-dev');
    f.destroy();
  });
  it('retains an imported candidate but blocks continuation when the working tree is dirty', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.state = {
      ...status(),
      task: {
        id: 'saved',
        status: 'ready',
        candidate: '2.2.0-rc.501',
        runId: '501',
        error: null,
      },
    };
    c.report = {
      readyForPreproduction: true,
      repository: { clean: true, commit: 'a'.repeat(40) },
      blockers: [],
      dossier: {
        manifest: { candidate: '2.2.0-rc.501', commit: 'a'.repeat(40) },
      },
    } as unknown as EvidenceReport;
    expect(c.canUseCandidate).toBeTrue();
    c.state = {
      ...c.state,
      ready: false,
      clean: false,
      blockers: ['WORKTREE_DIRTY'],
    };
    c.active = 1;
    f.detectChanges();
    expect(c.canUseCandidate).toBeFalse();
    expect(c.state.task?.status).toBe('ready');
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(
      buttons.find((b) =>
        b.textContent?.includes('Continuer en préproduction via TAR'),
      )?.disabled,
    ).toBeTrue();
    expect(f.nativeElement.textContent).toContain(
      'Cela ne vaut pas autorisation de livraison',
    );
    f.destroy();
  });
  it('shows the Git prerequisite and disables creation when it is not validated', () => {
    service.candidateStatus.and.returnValue(
      of({ ...status(), ready: false, blockers: ['MERGE_PR_FIRST'] }),
    );
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('fusionner la Pull Request');
    f.componentInstance.active = 1;
    f.detectChanges();
    const buttons = Array.from(
      f.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(
      buttons.find((b) =>
        b.textContent?.includes('Importer la candidate CI sans GHCR'),
      )?.disabled,
    ).toBeTrue();
    f.componentInstance.prepare();
    expect(service.prepareCandidate).not.toHaveBeenCalled();
    f.destroy();
  });
  it('prepares only the exact Git commit displayed by the verified server status', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    f.componentInstance.prepare();
    expect(service.prepareCandidate).toHaveBeenCalledWith('a'.repeat(40));
    expect(f.componentInstance.state?.task?.status).toBe('downloading');
    f.destroy();
  });
  it('refreshes evidence once when download and verification complete', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    const emitted = spyOn(f.componentInstance.candidatePrepared, 'emit');
    service.candidateStatus.and.returnValue(
      of({
        ...status(),
        task: {
          id: 'job',
          status: 'ready',
          candidate: '2.2.0-rc.501',
          runId: '501',
          error: null,
        },
      }),
    );
    f.detectChanges();
    f.componentInstance.refresh();
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.active).toBe(0);
    f.destroy();
  });
  it('keeps the selected step when a ready candidate is refreshed or completes in the background', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    f.componentInstance.active = 5;
    service.candidateStatus.and.returnValue(
      of({
        ...status(),
        task: {
          id: 'background-job',
          status: 'ready',
          candidate: '2.2.0-rc.501',
          runId: '501',
          error: null,
        },
      }),
    );
    f.componentInstance.refresh();
    expect(f.componentInstance.active).toBe(5);
    f.componentInstance.active = 0;
    f.componentInstance.refresh();
    expect(f.componentInstance.active).toBe(0);
    f.destroy();
  });
  it('does not navigate on a delayed candidate import response', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    f.componentInstance.active = 1;
    f.componentInstance.prepare();
    f.componentInstance.active = 0;
    service.candidateStatus.and.returnValue(
      of({
        ...status(),
        task: {
          id: 'job',
          status: 'ready',
          candidate: '2.2.0-rc.501',
          runId: '501',
          error: null,
        },
      }),
    );
    f.componentInstance.refresh();
    expect(f.componentInstance.active).toBe(0);
    f.destroy();
  });
  it('explains the NAS locations, expected responses and browser console separately', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    f.componentInstance.active = 3;
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('4205');
    expect(text).toContain('401');
    expect(text).toContain('403');
    expect(text).toContain('jamais dans PowerShell ou SSH');
    expect(text).toContain('NAS_ROLLBACK_OK');
    f.destroy();
  });
  it('keeps production explicitly locked with a data-preserving rollback procedure', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    f.componentInstance.active = 5;
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('verrouillées');
    expect(text).toContain('Aucune restauration automatique de base');
    expect(text).toContain('sans rebuild');
    expect(service.nasKit).not.toHaveBeenCalled();
    f.destroy();
  });
  it('cannot produce an approved NAS kit without the persisted prerequisites', () => {
    const c = TestBed.createComponent(
      ReleaseJourneyComponent,
    ).componentInstance;
    c.kit();
    expect(service.nasKit).not.toHaveBeenCalled();
  });

  it('requires confirmation before creating a local SSH key and probes only on request', () => {
    service.createSshKey.and.returnValue(
      of({ configured: true, publicKey: 'ssh-ed25519 public-test' }),
    );
    service.probeSsh.and.returnValue(of({ connected: true }));
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    expect(service.probeSsh).not.toHaveBeenCalled();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    f.componentInstance.createSshKey();
    expect(service.createSshKey).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    f.componentInstance.createSshKey();
    expect(f.componentInstance.sshPublicKey).toBe('ssh-ed25519 public-test');
    f.componentInstance.probeSsh();
    expect(service.probeSsh).toHaveBeenCalledTimes(1);
    f.destroy();
  });

  it('requires installed DSM, current dossier and explicit confirmation before applying', () => {
    const f = TestBed.createComponent(ReleaseJourneyComponent);
    f.detectChanges();
    const c = f.componentInstance;
    const r: EvidenceReport = {
      dossier: {
        identity: 'id',
        revision: 7,
        manifest: {
          candidate: '2.2.0-rc.501',
          commit: 'a'.repeat(40),
          archiveSha256: 'b'.repeat(64),
          exceptionReviewBy: '2099-01-01',
          images: {},
        },
        scope: { frozen: true, summary: 'Scope', releaseNotes: 'Notes' },
        origin: {
          kind: 'github',
          githubUrl: null,
          authenticatedGithubProvenance: true,
        },
        validations: {},
        importedAt: '2026-10-20',
      },
      checks: [],
      blockers: [],
      repository: { commit: 'a'.repeat(40), clean: true },
      readyForPreproduction: true,
      readyForProduction: false,
      canClose: false,
      publicationEnabled: false,
    };
    c.report = r;
    c.queueDsm('plan');
    expect(service.dsmQueue).not.toHaveBeenCalled();
    c.dsmInstalled = true;
    service.dsmQueue.and.returnValue(
      of({
        request: {
          nonce: 'nonce',
          action: 'plan',
          candidate: '2.2.0-rc.501',
          identity: 'id',
        },
        status: 'QUEUED',
      }),
    );
    c.queueDsm('plan');
    expect(service.dsmQueue).toHaveBeenCalledWith('id', 7, 'plan', false);
    service.dsmQueue.calls.reset();
    c.queueDsm('apply-preproduction');
    expect(service.dsmQueue).not.toHaveBeenCalled();
    service.dsmReceipt.and.returnValue(
      of({
        request: {
          nonce: 'nonce',
          action: 'plan',
          candidate: '2.2.0-rc.501',
          identity: 'id',
        },
        status: 'PLAN_PASS',
        receipt: { nonce: 'nonce', status: 'PLAN_PASS' },
      }),
    );
    const refreshed = spyOn(c.candidatePrepared, 'emit');
    c.pollDsm();
    expect(refreshed).toHaveBeenCalled();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    c.queueDsm('apply-preproduction');
    expect(service.dsmQueue).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    c.queueDsm('apply-preproduction');
    expect(service.dsmQueue).toHaveBeenCalledWith(
      'id',
      7,
      'apply-preproduction',
      true,
    );
    f.destroy();
  });
});
