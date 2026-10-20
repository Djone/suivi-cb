import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReleaseJourneyComponent } from './release-journey.component';
import {
  CandidateFlowStatus,
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
      'candidateArchive',
      'nasKit',
      'createSshKey',
      'probeSsh',
      'sshInstaller',
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
      buttons.find((b) => b.textContent?.includes('Créer la candidate'))
        ?.disabled,
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
    expect(f.componentInstance.active).toBe(2);
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
});
