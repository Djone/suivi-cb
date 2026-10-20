import { ReleaseEvidenceService } from '../../services/release-evidence.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { DocumentationService } from '../../services/documentation.service';
import { ReleaseProcessService, ReleaseRun, ReleaseStatusResponse } from '../../services/release-process.service';
import { ReleaseProcessComponent } from './release-process.component';
import { DocumentationEntry } from '../documentation/documentation.model';

describe('Release timeline', () => {
  let component: ReleaseProcessComponent;
  let statuses: Subject<ReleaseStatusResponse>;
  let service: jasmine.SpyObj<ReleaseProcessService>;
  const entry: DocumentationEntry = { id: 'docs/test.md', category: 'Tests', title: 'Procédure', summary: 'Résumé', owner: 'Équipe', updated: '2026-10-09', body: '## Chapitre\n- [ ] Test', status: 'published', revision: 'a'.repeat(64) };
  const run = (status: ReleaseRun['status'] = 'running', command: ReleaseRun['command'] = 'dry-run'): ReleaseRun => ({ id: 'release-1', command, startedAt: '2026-10-09T08:00:00Z', endedAt: status === 'running' ? null : '2026-10-09T08:01:00Z', status, exitCode: status === 'passed' ? 0 : status === 'failed' ? 1 : null, options: { branch: 'master', next: '1.4.0-dev' }, logs: [] });
  const completeThrough = (index: number) => component.phases.slice(0, index + 1).forEach((phase) => phase.tasks.forEach((task) => component.completedTasks.add(task.id)));

  beforeEach(() => {
    statuses = new Subject();
    service = jasmine.createSpyObj('ReleaseProcessService', ['run', 'getStatus', 'getNextCandidate']);
    service.getStatus.and.returnValue(statuses);
    service.run.and.returnValue(of({ message: 'Started', run: run() }));
    service.getNextCandidate.and.returnValue(of({ stable: '2.3.0', latestNumber: 1, next: '2.3.0-rc.2', dockerAvailable: true, scope: 'local' }));
    TestBed.configureTestingModule({
      imports: [ReleaseProcessComponent], providers: [provideNoopAnimations(),
      { provide: ReleaseEvidenceService, useValue: { read: () => of({dossier:null,checks:[],blockers:[],repository:{commit:null,clean:false},readyForPreproduction:false,readyForProduction:false,canClose:false,publicationEnabled:false}) } },
      { provide: ReleaseProcessService, useValue: service },
      { provide: DocumentationService, useValue: { documents: signal([entry]), load: jasmine.createSpy('load').and.resolveTo(undefined) } },
      ]
    });
    component = TestBed.createComponent(ReleaseProcessComponent).componentInstance;
    component.stableVersion = '2.3.0';
    component.nextDevVersion = '1.4.0-dev';
  });

  it('locks future steps and never checks an automatic task directly', () => {
    expect(component.phaseStatus(0)).toBe('À démarrer');
    expect(component.phaseStatus(1)).toBe('Verrouillée');
    component.runDryRun(); expect(service.run).not.toHaveBeenCalled();
    completeThrough(0);
    const task = component.phases[1].tasks[0];
    component.toggleTask(task, 1);
    expect(component.completedTasks.has(task.id)).toBeFalse();
  });

  it('unchecking a validated step locks downstream while retaining its evidence', () => {
    completeThrough(5); expect(component.progress).toBe(100);
    component.toggleTask(component.phases[1].tasks[0], 1);
    expect(component.phaseStatus(1)).toBe('En cours');
    expect(component.phaseStatus(2)).toBe('Verrouillée');
    expect(component.completedTasks.has('candidate-package')).toBeTrue();
    expect(component.taskDisabled(component.phases[2].tasks[1], 2)).toBeTrue();
    expect(component.completedCount).toBe(3);
    expect(component.allComplete).toBeFalse();
  });

  it('resets only the selected phase and requires rerunning automatic actions', () => {
    completeThrough(5); component.resetPhase(1);
    expect(component.phaseStatus(1)).toBe('À démarrer');
    expect(component.completedTasks.has('dev-tests')).toBeTrue();
    expect(component.completedTasks.has('production-smoke')).toBeTrue();
    expect(component.taskDisabled(component.phases[1].tasks[0], 1)).toBeTrue();
  });

  it('increments RC and invalidates all downstream validations without a command call', () => {
    completeThrough(5); component.candidateVersion = '2.3.0-rc.2'; component.lastRun = run('passed');
    component.regenerateCandidate();
    expect(component.candidateVersion).toBe('2.3.0-rc.3');
    expect(component.firstIncompleteIndex).toBe(2);
    expect(component.completedTasks.has('controls-prepare')).toBeTrue();
    expect(component.completedTasks.has('production-smoke')).toBeFalse();
    expect(component.lastRun).toBeNull(); expect(service.run).not.toHaveBeenCalled();
    component.refreshCandidate(); expect(component.candidateVersion).toBe('2.3.0-rc.3');
  });

  it('waits for the actual successful result and does not reuse a historical result', () => {
    component.ngOnInit(); completeThrough(0);
    statuses.next({ running: false, activeRun: null, lastRun: run('passed'), lastReport: null });
    expect(component.completedTasks.has('controls-dry-run')).toBeFalse();
    component.runDryRun(); expect(component.isRunning).toBeTrue();
    expect(component.completedTasks.has('controls-dry-run')).toBeFalse();
    statuses.next({ running: false, activeRun: null, lastRun: run('passed'), lastReport: null });
    expect(component.completedTasks.has('controls-dry-run')).toBeTrue();
    component.resetPhase(1);
    statuses.next({ running: false, activeRun: null, lastRun: run('passed'), lastReport: null });
    expect(component.lastRun).toBeNull(); expect(component.completedTasks.has('controls-dry-run')).toBeFalse();
    component.ngOnDestroy();
  });

  it('keeps dry-run and prepare separate, transmits options and does not validate failures', () => {
    completeThrough(0); component.completedTasks.add('controls-dry-run');
    service.run.and.returnValue(of({ message: 'Started', run: run('running', 'prepare') }));
    component.allowDirty = true; component.runPrepare();
    expect(service.run.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ command: 'prepare', next: '1.4.0-dev', allowDirty: true, rollbackOnFailure: true, commit: true }));
    statuses.next({ running: false, activeRun: null, lastRun: run('failed', 'prepare'), lastReport: { error: 'failure' } });
    expect(component.completedTasks.has('controls-prepare')).toBeFalse();
    expect(component.getVisibleReportError()).toBe('failure');
    expect(component.prepareCommand).toContain('--next=1.4.0-dev');
    expect(component.executedCommand).toContain('--next=1.4.0-dev');
  });

  it('releases the busy state when launching fails', () => {
    completeThrough(0); service.run.and.returnValue(throwError(() => ({ error: { message: 'Unavailable' } })));
    component.runDryRun(); expect(component.isRunning).toBeFalse(); expect(component.errorMessage).toBe('Unavailable');
  });

  it('ignores a stale polling response received after a new command starts', () => {
    const previousStatus = new Subject<ReleaseStatusResponse>();
    const currentStatus = new Subject<ReleaseStatusResponse>();
    service.getStatus.and.returnValues(previousStatus, currentStatus);
    component.ngOnInit(); completeThrough(0); component.runDryRun();
    previousStatus.next({ running: false, activeRun: null, lastRun: null, lastReport: null });
    expect(component.isRunning).toBeTrue();
    currentStatus.next({ running: false, activeRun: null, lastRun: run('passed'), lastReport: null });
    expect(component.completedTasks.has('controls-dry-run')).toBeTrue(); component.ngOnDestroy();
  });

  it('keeps publication and rollback blocked even when the session checklist is complete', () => {
    completeThrough(5); component.runDeploy(); component.runRollback();
    expect(service.run).not.toHaveBeenCalled(); expect(component.errorMessage).toBe('PUBLICATION_LOCKED');
  });

  it('associates, replaces, removes and reads documents without changing checklist state', () => {
    completeThrough(0); const phase = component.phases[0]; component.linkDocument(phase, entry);
    expect(component.linkedDocument(phase)).toBe(entry);
    component.openDocument = entry; component.openDocument = null;
    expect(component.completedTasks.has('dev-tests')).toBeTrue();
    component.unlinkDocument(phase); expect(component.linkedDocument(phase)).toBeUndefined();
    component.closeRelease(); expect(component.closedAt).toBeNull();
    completeThrough(5); component.closeRelease(); expect(component.closedAt).toBeNull();
  });

  it('renders six phases, readonly parameters and distinct controls', () => {
    const fixture = TestBed.createComponent(ReleaseProcessComponent); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.timeline-row').length).toBe(6);
    expect(element.querySelectorAll('.parameters input').length).toBe(1);
    expect(element.textContent).toContain('Lancer le dry-run'); expect(element.textContent).toContain('Lancer le prepare');
    expect(element.textContent).toContain('Dernière exécution'); fixture.destroy();
  });
});
