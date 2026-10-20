import { ReleaseJourneyComponent } from './release-journey.component';
import { ReleaseEvidenceComponent } from './release-evidence.component';
import { EvidenceManifest, EvidenceReport } from '../../services/release-evidence.service';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DocumentationService } from '../../services/documentation.service';
import { DocumentationEntry } from '../documentation/documentation.model';
import { ReleaseDocumentReaderComponent } from './release-document-reader.component';
import { RELEASE_PHASES, ReleasePhase, ReleaseTask } from './release-timeline';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ReleaseCommand,
  ReleaseProcessService,
  ReleaseRun,
  ReleaseRunRequest,
  ReleaseStatusResponse,
} from '../../services/release-process.service';

interface ReleaseReport {
  error?: string;
  steps?: Array<{
    status?: string;
    error?: string;
  }>;
}

@Component({
  selector: 'app-release-process',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ReleaseDocumentReaderComponent, ReleaseEvidenceComponent, ReleaseJourneyComponent],
  templateUrl: './release-process.component.html',
  styleUrls: ['./release-process.component.css'],
})
export class ReleaseProcessComponent implements OnInit, OnDestroy {
  public evidenceReport: EvidenceReport | null = null;
  public readonly currentDevVersion = environment.version;
  public readonly stableCandidate = this.currentDevVersion.split('-')[0];
  public readonly reportPath = 'data/release/last-report.json';

  public stableVersion = this.stableCandidate;
  public nextDevVersion = '';
  public branch = 'master';

  public allowDirty = false;
  public skipMasterCheck = false;
  public skipTests = false;

  public createReleaseBranch = false;
  public createNextBranch = true;
  public releaseBranch = '';
  public branchPrefix = 'release/';
  public commit = true;
  public rollbackOnFailure = true;
  public candidateVersion = '';
  public candidateMessage = '';
  public candidateLoading = false;
  private candidateRequest = 0;
  public candidatePlatform = 'linux/amd64';

  public isRunning = false;
  public backendMessage = '';
  public errorMessage = '';
  public copyErrorFeedback = '';

  public activeRun: ReleaseRun | null = null;
  public lastRun: ReleaseRun | null = null;
  public lastReport: unknown = null;

  private pollingSub: Subscription | null = null;

  readonly phases = RELEASE_PHASES;
  completedTasks = new Set<string>();
  closedAt: Date | null = null;
  pickerPhase: string | null = null;
  documentQuery = '';
  openDocument: DocumentationEntry | null = null;
  documentationError = '';
  linkedDocuments: Record<string, string> = {
    development: 'docs/TESTING.md', controls: 'docs/RELEASE_AUTOMATION.md',
    candidate: 'docs/AUTOMATISATION_CANDIDATE.md', preproduction: 'docs/CHECKLIST_RC2_PREPRODUCTION.md',
    'git-publication': 'docs/RELEASE_AUTOMATION.md', production: 'docs/PROMOTION_PREPROD_PRODUCTION.md',
  };
  private pendingRunKey: string | null = null;
  private startingRequest = false;
  private statusRequest = 0;
  private latestAppliedStatus = 0;
  private readonly hiddenRuns = new Set<string>();

  constructor(private readonly releaseService: ReleaseProcessService, readonly documentation: DocumentationService) { }

  get firstIncompleteIndex(): number { return this.phases.findIndex((phase) => phase.tasks.some((task) => !this.completedTasks.has(task.id))); }
  get allComplete(): boolean { return this.firstIncompleteIndex === -1; }
  get activePhase(): ReleasePhase | null { return this.phases[this.firstIncompleteIndex] ?? null; }
  get totalCount(): number { return this.phases.reduce((count, phase) => count + phase.tasks.length, 0); }
  get completedCount(): number { return this.phases.reduce((count, phase, index) => count + (this.isUnlocked(index) ? phase.tasks.filter((task) => this.completedTasks.has(task.id)).length : 0), 0); }
  get progress(): number { return Math.round(100 * this.completedCount / this.totalCount); }
  get preproductionApproved(): boolean { return this.isUnlocked(3) && this.completedTasks.has('preprod-deploy') && this.completedTasks.has('preprod-approval'); }
  get displayedRun(): ReleaseRun | null { return this.activeRun ?? this.lastRun; }
  get filteredDocuments(): DocumentationEntry[] { return this.documentation.documents().filter((entry) => entry.title.toLocaleLowerCase('fr').includes(this.documentQuery.toLocaleLowerCase('fr'))); }
  isUnlocked(index: number): boolean { return this.phases.slice(0, index).every((phase) => phase.tasks.every((task) => this.completedTasks.has(task.id))); }
  phaseStatus(index: number): string {
    if (!this.isUnlocked(index)) return 'Verrouillée';
    const tasks = this.phases[index].tasks;
    return tasks.every((task) => this.completedTasks.has(task.id)) ? 'Validée' : tasks.some((task) => this.completedTasks.has(task.id)) ? 'En cours' : 'À démarrer';
  }
  taskDisabled(task: ReleaseTask, index: number): boolean { return this.isRunning || !this.isUnlocked(index) || (!!task.command && !this.completedTasks.has(task.id)); }
  toggleTask(task: ReleaseTask, index: number): void {
    if (this.taskDisabled(task, index)) return;
    const wasChecked = this.completedTasks.has(task.id);
    if (wasChecked) this.completedTasks.delete(task.id); else this.completedTasks.add(task.id);
    this.closedAt = null;
    if (wasChecked) this.clearExecution();
  }
  resetPhase(index: number): void {
    if (this.isRunning || !this.isUnlocked(index)) return;
    this.phases[index].tasks.forEach((task) => this.completedTasks.delete(task.id));
    this.closedAt = null; this.clearExecution();
  }
  resetChecklist(): void {
    if (this.isRunning) return;
    this.completedTasks.clear(); this.closedAt = null; this.clearExecution();
  }
  parametersChanged(): void { this.invalidateFrom(1); }
  private invalidateFrom(index: number): void {
    this.phases.slice(index).forEach((phase) => phase.tasks.forEach((task) => this.completedTasks.delete(task.id)));
    this.closedAt = null; this.clearExecution();
  }
  private runKey(run: ReleaseRun): string { return run.id + ':' + run.startedAt; }
  private clearExecution(): void {
    if (this.displayedRun) this.hiddenRuns.add(this.runKey(this.displayedRun));
    this.lastRun = null; this.lastReport = null; this.backendMessage = ''; this.errorMessage = ''; this.copyErrorFeedback = '';
  }
  regenerateCandidate(): void {
    if (this.isRunning || this.candidateLoading) return;
    const match = this.candidateVersion.match(/^(.*-rc\.)(\d+)$/);
    this.candidateVersion = match ? match[1] + (Number(match[2]) + 1) : this.stableVersion + '-rc.1';
    this.invalidateFrom(2);
    this.candidateMessage = 'Numéro incrémenté localement ; reconstruire au terminal et refaire toutes les validations aval. Ce numéro ne réserve pas un candidat sur le NAS.';
    document.getElementById('phase-candidate')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  closeRelease(): void { this.errorMessage = 'La cl\u00f4ture exige le dossier de preuves persistant.'; }
  linkedDocument(phase: ReleasePhase): DocumentationEntry | undefined { return this.documentation.documents().find((entry) => entry.id === this.linkedDocuments[phase.id]); }
  pickDocument(phase: ReleasePhase): void { this.pickerPhase = this.pickerPhase === phase.id ? null : phase.id; this.documentQuery = ''; }
  linkDocument(phase: ReleasePhase, entry: DocumentationEntry): void { this.linkedDocuments[phase.id] = entry.id; this.pickerPhase = null; }
  unlinkDocument(phase: ReleasePhase): void { delete this.linkedDocuments[phase.id]; this.pickerPhase = null; }
  async loadDocuments(): Promise<void> {
    if (environment.production) { this.documentationError = 'Documentation disponible uniquement en développement.'; return; }
    try { await this.documentation.load(); this.documentationError = ''; }
    catch { this.documentationError = 'Documentation indisponible. Vérifiez le backend de développement.'; }
  }
  commandLabel(command: ReleaseCommand): string { return ({ 'dry-run': 'Dry-run', prepare: 'Prepare', deploy: 'Publication Git', rollback: 'Rollback', full: 'Release complète' })[command]; }
  commandFor(command: ReleaseCommand): string { return this.formatCommand(command, this.requestFor(command) as unknown as Record<string, unknown>); }
  get executedCommand(): string { const run = this.displayedRun; return run ? this.formatCommand(run.command, run.options) : ''; }
  private formatCommand(command: ReleaseCommand, options: Record<string, unknown>): string {
    const args: string[] = [];
    for (const [key, flag] of [['stable', 'stable'], ['next', 'next'], ['branch', 'branch'], ['report', 'report'], ['backupFile', 'backup-file'], ['releaseBranch', 'release-branch'], ['branchPrefix', 'branch-prefix']]) {
      if (typeof options[key] === 'string' && (options[key] as string).trim()) args.push('--' + flag + '=' + (options[key] as string).trim());
    }
    for (const [key, flag] of [['allowDirty', 'allow-dirty'], ['skipMasterCheck', 'skip-master-check'], ['skipTests', 'skip-tests'], ['skipBuild', 'skip-build'], ['execute', 'execute'], ['withNasDeploy', 'with-nas-deploy'], ['createReleaseBranch', 'create-release-branch'], ['createNextBranch', 'create-next-branch'], ['commit', 'commit'], ['tag', 'tag'], ['rollbackOnFailure', 'rollback-on-failure']]) {
      if (options[key] === true) args.push('--' + flag);
    }
    return 'npm run release:' + command + ' -- ' + args.join(' ');
  }

  ngOnInit(): void {
    void this.loadDocuments();
    this.refreshCandidate();
    this.refreshStatus();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  get dryRunCommand(): string { return this.commandFor('dry-run'); }
  get prepareCommand(): string { return this.commandFor('prepare'); }
  get deployCommand(): string { return this.commandFor('deploy'); }

  get candidateCommand(): string {
    if (!/^\d+\.\d+\.\d+-rc\.[1-9]\d*$/.test(this.candidateVersion) ||
      !['linux/amd64', 'linux/arm64'].includes(this.candidatePlatform)) {
      return '';
    }
    return `npm.cmd run release:candidate -- --candidate=${this.candidateVersion} --platform=${this.candidatePlatform}`;
  }

  refreshCandidate(): void {
    if (this.isRunning || this.candidateLoading) return;
    const request = ++this.candidateRequest;
    const stable = this.stableVersion.trim();
    if (!/^\d+\.\d+\.\d+$/.test(stable)) {
      this.candidateLoading = false;
      this.candidateMessage = 'Renseigner une version stable valide pour calculer la candidate.';
      return;
    }
    this.candidateLoading = true;
    this.candidateMessage = 'Recherche des candidates existantes…';
    this.releaseService.getNextCandidate(stable).subscribe({
      next: (suggestion) => {
        if (request !== this.candidateRequest) return;
        this.candidateLoading = false;
        const currentNumber = Number(this.candidateVersion.split('-rc.')[1]) || 0;
        const proposedNumber = Number(suggestion.next.split('-rc.')[1]) || 0;
        if (!this.candidateVersion || proposedNumber > currentNumber) {
          this.candidateVersion = suggestion.next; this.invalidateFrom(2);
        }
        this.candidateMessage = suggestion.dockerAvailable
          ? suggestion.scope
          : `Docker indisponible : calcul depuis les fichiers locaux uniquement. ${suggestion.scope}`;
      },
      error: () => {
        if (request !== this.candidateRequest) return;
        this.candidateLoading = false;
        this.candidateMessage = 'Calcul indisponible. Vérifier le backend puis actualiser.';
      },
    });
  }

  runDryRun(): void {
    if (this.isUnlocked(1) && !this.completedTasks.has('controls-dry-run')) this.runCommand('dry-run');
  }

  runPrepare(): void {
    if (!this.isUnlocked(1) || this.completedTasks.has('controls-prepare') || !this.completedTasks.has('controls-dry-run') || !this.validatePrepareInputs()) {
      return;
    }
    this.runCommand('prepare');
  }

  selectEvidenceCandidate(m: EvidenceManifest): void {
    ++this.candidateRequest; this.candidateLoading = false;
    if (this.candidateVersion !== m.candidate) this.invalidateFrom(2);
    this.candidateVersion = m.candidate; this.stableVersion = m.candidate.split('-rc.')[0];
  }

  runDeploy(): void { this.errorMessage = 'PUBLICATION_LOCKED'; }

  runRollback(): void { this.errorMessage = 'PUBLICATION_LOCKED'; }

  resetProcess(): void {
    if (this.isRunning) return;
    this.resetChecklist();
    this.stableVersion = this.stableCandidate;
    this.nextDevVersion = '';
    this.branch = 'master';

    this.allowDirty = false;
    this.skipMasterCheck = false;
    this.skipTests = false;

    this.createReleaseBranch = false;
    this.createNextBranch = true;
    this.releaseBranch = '';
    this.branchPrefix = 'release/';
    this.commit = true;
    this.rollbackOnFailure = true;
    this.refreshCandidate();
    this.candidatePlatform = 'linux/amd64';

    this.errorMessage = '';
    this.backendMessage = '';
  }

  getLogLines(): string[] {
    const run = this.activeRun ?? this.lastRun;
    if (!run) {
      return [];
    }
    return run.logs.map((log) => `[${log.source}] ${log.line}`);
  }

  getReportPreview(): string {
    if (!this.lastReport) {
      return 'Aucun rapport disponible.';
    }
    try {
      return JSON.stringify(this.lastReport, null, 2);
    } catch {
      return 'Rapport non lisible.';
    }
  }

  getLastStatusLabel(): string {
    if (!this.lastRun) {
      return 'Aucune exécution encore lancée.';
    }

    if (this.lastRun.status === 'passed') {
      return `Dernière exécution réussie (code ${this.lastRun.exitCode}).`;
    }

    if (this.lastRun.status === 'failed') {
      return `Dernière exécution en échec (code ${this.lastRun.exitCode}).`;
    }

    return 'Exécution en cours.';
  }

  getLastStatusClass(): 'ok' | 'warning' | 'error' {
    if (!this.lastRun) {
      return 'warning';
    }

    if (this.lastRun.status === 'passed') {
      return 'ok';
    }

    if (this.lastRun.status === 'failed') {
      return 'error';
    }

    return 'warning';
  }

  getReportError(): string | null {
    if (!this.lastReport || typeof this.lastReport !== 'object') {
      return null;
    }

    const report = this.lastReport as ReleaseReport;

    if (typeof report.error === 'string' && report.error.trim()) {
      return report.error.replace(/\u001b\[[0-9;]*m/g, '').trim();
    }

    if (Array.isArray(report.steps)) {
      const failedStep = report.steps.find(
        (step) =>
          step?.status === 'failed' &&
          typeof step.error === 'string' &&
          step.error.trim(),
      );
      if (failedStep?.error) {
        return failedStep.error.replace(/\u001b\[[0-9;]*m/g, '').trim();
      }
    }
    return null;
  }

  getVisibleReportError(): string | null {
    if (this.isRunning) {
      return null;
    }

    if (!this.lastRun || this.lastRun.status !== 'failed') {
      return null;
    }

    return this.getReportError();
  }

  copyReportError(): void {
    const reportError = this.getReportError();
    if (!reportError) {
      this.setCopyFeedback('Aucune erreur a copier.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(reportError)
        .then(() =>
          this.setCopyFeedback('Erreur copiee dans le presse-papiers.'),
        )
        .catch(() => this.copyWithFallback(reportError));
      return;
    }

    this.copyWithFallback(reportError);
  }

  private copyWithFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const success = document.execCommand('copy');
      this.setCopyFeedback(
        success ? 'Erreur copiee dans le presse-papiers.' : 'Copie impossible.',
      );
    } catch {
      this.setCopyFeedback('Copie impossible.');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  private setCopyFeedback(message: string): void {
    this.copyErrorFeedback = message;
    window.setTimeout(() => {
      if (this.copyErrorFeedback === message) {
        this.copyErrorFeedback = '';
      }
    }, 2500);
  }

  private requestFor(command: ReleaseCommand): ReleaseRunRequest {
    const execute = command === 'deploy';
    const stable =
      command === 'deploy' ? undefined : this.stableVersion.trim() || undefined;
    return {
      command,
      // During deploy, the orchestrator derives the stable version from the
      // source branch. After prepare, the local UI already displays the next
      // development version and must not be used to name the release tag.
      stable,
      next: this.nextDevVersion.trim() || undefined,
      branch: this.branch.trim() || 'master',
      allowDirty: this.allowDirty,
      skipMasterCheck: this.skipMasterCheck,
      skipTests: this.skipTests,
      skipBuild: false,
      execute,
      createReleaseBranch: this.createReleaseBranch,
      createNextBranch: this.createNextBranch,
      releaseBranch: this.releaseBranch.trim() || undefined,
      branchPrefix: this.branchPrefix.trim() || 'release/',
      commit: this.commit,
      tag: false,
      rollbackOnFailure: this.rollbackOnFailure,
    };

  }

  private runCommand(command: ReleaseCommand): void {
    if (this.isRunning) {
      return;
    }

    this.errorMessage = '';
    this.backendMessage = '';

    const execute = command === 'deploy';
    const payload = this.requestFor(command);

    const confirmationMessage = execute
      ? 'Confirmez-vous que la candidate a été testée et approuvée en préproduction, et que les IDs exacts des images backend/frontend ont été consignés ? Cette action publie master et le tag Git, mais ne déploie pas sur le NAS.'
      : 'Confirmer l’exécution réelle (pas en simulation) ?';
    if (execute && !confirm(confirmationMessage)) {
      return;
    }

    this.isRunning = true;
    this.startingRequest = true;
    // Ignore status requests sent before this new execution started.
    this.latestAppliedStatus = ++this.statusRequest;
    this.releaseService.run(payload).subscribe({
      next: (response) => {
        this.startingRequest = false;
        this.backendMessage = response.message;
        this.pendingRunKey = this.runKey(response.run);
        this.activeRun = response.run;
        this.isRunning = true;
        this.refreshStatus();
      },
      error: (error) => {
        this.startingRequest = false;
        this.isRunning = false;
        this.errorMessage =
          error?.error?.message ??
          'Erreur lors du lancement de la commande release.';
      },
    });
  }

  private refreshStatus(): void {
    const request = ++this.statusRequest;
    this.releaseService.getStatus().subscribe({
      next: (status) => {
        if (request < this.latestAppliedStatus) return;
        this.latestAppliedStatus = request;
        this.applyStatus(status);
      },
      error: () => {
        if (request < this.latestAppliedStatus) return;
        this.errorMessage =
          'Impossible de récupérer le statut release. Vérifie que le backend est démarré.';
      },
    });
  }

  private applyStatus(status: ReleaseStatusResponse): void {
    if (this.startingRequest) return;
    this.isRunning = status.running;
    this.activeRun = status.activeRun;
    const latest = status.lastRun;
    this.lastRun = latest && !this.hiddenRuns.has(this.runKey(latest)) ? latest : null;
    this.lastReport = this.lastRun ? status.lastReport : null;
    if (latest && this.pendingRunKey === this.runKey(latest) && latest.status !== 'running') {
      this.pendingRunKey = null;
      if (latest.status === 'passed' && latest.exitCode === 0) {
        const task = this.phases.flatMap((phase) => phase.tasks).find((task) => task.command === latest.command);
        if (task) this.completedTasks.add(task.id);
        if (latest.command === 'rollback') {
          this.completedTasks.clear();
          this.closedAt = null;
        }
      }
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingSub = interval(2000).subscribe(() => {
      this.refreshStatus();
    });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  private validatePrepareInputs(): boolean {
    if (!this.stableVersion.trim()) {
      this.errorMessage = 'Version stable obligatoire (ex: 1.3.0).';
      return false;
    }
    if (!this.nextDevVersion.trim()) {
      this.errorMessage = 'Prochaine version dev obligatoire (ex: 1.4.0-dev).';
      return false;
    }
    return true;
  }
}
