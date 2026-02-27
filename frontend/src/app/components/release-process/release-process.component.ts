import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ReleaseCommand,
  ReleaseProcessService,
  ReleaseRun,
  ReleaseRunRequest,
  ReleaseStatusResponse,
} from '../../services/release-process.service';

interface ReleaseStep {
  id: string;
  title: string;
  description: string;
  helper: string;
}

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
  imports: [CommonModule, FormsModule],
  templateUrl: './release-process.component.html',
  styleUrls: ['./release-process.component.css'],
})
export class ReleaseProcessComponent implements OnInit, OnDestroy {
  public readonly currentDevVersion = environment.version;
  public readonly stableCandidate = this.currentDevVersion.split('-')[0];
  public readonly reportPath = 'data/release/last-report.json';

  public stableVersion = this.stableCandidate;
  public nextDevVersion = '';
  public branch = 'master';

  public allowDirty = false;
  public skipMasterCheck = false;
  public skipTests = false;
  public skipBuild = false;
  public execute = false;
  public withNasDeploy = false;

  public createReleaseBranch = false;
  public releaseBranch = '';
  public branchPrefix = 'release/';
  public commit = false;
  public tag = false;
  public rollbackOnFailure = true;

  public isRunning = false;
  public backendMessage = '';
  public errorMessage = '';
  public copyErrorFeedback = '';

  public activeRun: ReleaseRun | null = null;
  public lastRun: ReleaseRun | null = null;
  public lastReport: unknown = null;

  private pollingSub: Subscription | null = null;

  public readonly steps: ReleaseStep[] = [
    {
      id: 'stabilize',
      title: 'Stabilisation de la version',
      description:
        'Définir la version stable à livrer, puis la prochaine version de développement.',
      helper: `${this.currentDevVersion} -> ${this.stableCandidate}`,
    },
    {
      id: 'validate',
      title: 'Validation avant production',
      description:
        'Vérifier la qualité sans modifier l’état courant du projet.',
      helper: 'Commande recommandée: dry-run',
    },
    {
      id: 'prepare',
      title: 'Préparation de release',
      description:
        'Mettre à jour les versions (package + environnements) et options Git si nécessaire.',
      helper: 'Commande recommandée: prepare',
    },
    {
      id: 'deploy',
      title: 'Déploiement',
      description:
        'Déployer en réel uniquement avec execute coché (sinon simulation).',
      helper: 'Commande recommandée: deploy',
    },
  ];

  constructor(private readonly releaseService: ReleaseProcessService) {}

  ngOnInit(): void {
    this.refreshStatus();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  get dryRunCommand(): string {
    return `npm run release:dry-run -- --branch=${this.branch}`;
  }

  get prepareCommand(): string {
    const next = this.nextDevVersion.trim() || '<next-dev-version>';
    const branchCmd = this.createReleaseBranch
      ? ` --create-release-branch --branch-prefix=${this.branchPrefix}`
      : '';
    const releaseBranch = this.releaseBranch.trim()
      ? ` --release-branch=${this.releaseBranch.trim()}`
      : '';
    const commitCmd = this.commit ? ' --commit' : '';
    const tagCmd = this.tag ? ' --tag' : '';
    const rollbackCmd = this.rollbackOnFailure ? ' --rollback-on-failure' : '';

    return `npm run release:prepare -- --stable=${this.stableVersion.trim()} --next=${next} --branch=${this.branch}${branchCmd}${releaseBranch}${commitCmd}${tagCmd}${rollbackCmd}`;
  }

  get deployCommand(): string {
    const executeFlag = this.execute ? ' --execute' : '';
    const withNas = this.withNasDeploy ? ' --with-nas-deploy' : '';
    const skipBuild = this.skipBuild ? ' --skip-build' : '';
    return `npm run release:deploy -- --branch=${this.branch}${executeFlag}${withNas}${skipBuild}`;
  }

  get fullCommand(): string {
    const next = this.nextDevVersion.trim() || '<next-dev-version>';
    const executeFlag = this.execute ? ' --execute' : '';
    const withNas = this.withNasDeploy ? ' --with-nas-deploy' : '';
    const branchCmd = this.createReleaseBranch
      ? ` --create-release-branch --branch-prefix=${this.branchPrefix}`
      : '';
    const releaseBranch = this.releaseBranch.trim()
      ? ` --release-branch=${this.releaseBranch.trim()}`
      : '';
    const commitCmd = this.commit ? ' --commit' : '';
    const tagCmd = this.tag ? ' --tag' : '';
    const rollbackCmd = this.rollbackOnFailure ? ' --rollback-on-failure' : '';

    return `npm run release:full -- --stable=${this.stableVersion.trim()} --next=${next} --branch=${this.branch}${executeFlag}${withNas}${branchCmd}${releaseBranch}${commitCmd}${tagCmd}${rollbackCmd}`;
  }

  runDryRun(): void {
    this.runCommand('dry-run');
  }

  runPrepare(): void {
    if (!this.validatePrepareInputs()) {
      return;
    }
    this.runCommand('prepare');
  }

  runDeploy(): void {
    this.runCommand('deploy');
  }

  runFull(): void {
    if (!this.validatePrepareInputs()) {
      return;
    }
    this.runCommand('full');
  }

  runRollback(): void {
    if (!confirm('Confirmer le rollback vers le dernier backup de versions ?')) {
      return;
    }
    this.runCommand('rollback');
  }

  resetProcess(): void {
    this.stableVersion = this.stableCandidate;
    this.nextDevVersion = '';
    this.branch = 'master';

    this.allowDirty = false;
    this.skipMasterCheck = false;
    this.skipTests = false;
    this.skipBuild = false;
    this.execute = false;
    this.withNasDeploy = false;

    this.createReleaseBranch = false;
    this.releaseBranch = '';
    this.branchPrefix = 'release/';
    this.commit = false;
    this.tag = false;
    this.rollbackOnFailure = true;

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
        (step) => step?.status === 'failed' && typeof step.error === 'string' && step.error.trim(),
      );
      if (failedStep?.error) {
        return failedStep.error.replace(/\u001b\[[0-9;]*m/g, '').trim();
      }
    }
    return null;
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
        .then(() => this.setCopyFeedback('Erreur copiee dans le presse-papiers.'))
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

  private runCommand(command: ReleaseCommand): void {
    if (this.isRunning) {
      return;
    }

    this.errorMessage = '';
    this.backendMessage = '';

    const payload: ReleaseRunRequest = {
      command,
      stable: this.stableVersion.trim() || undefined,
      next: this.nextDevVersion.trim() || undefined,
      branch: this.branch.trim() || 'master',
      allowDirty: this.allowDirty,
      skipMasterCheck: this.skipMasterCheck,
      skipTests: this.skipTests,
      skipBuild: this.skipBuild,
      execute: this.execute,
      withNasDeploy: this.withNasDeploy,
      createReleaseBranch: this.createReleaseBranch,
      releaseBranch: this.releaseBranch.trim() || undefined,
      branchPrefix: this.branchPrefix.trim() || 'release/',
      commit: this.commit,
      tag: this.tag,
      rollbackOnFailure: this.rollbackOnFailure,
    };

    if (this.execute && !confirm('Confirmer l’exécution réelle (pas en simulation) ?')) {
      return;
    }

    this.releaseService.run(payload).subscribe({
      next: (response) => {
        this.backendMessage = response.message;
        this.activeRun = response.run;
        this.isRunning = true;
        this.refreshStatus();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message ?? 'Erreur lors du lancement de la commande release.';
      },
    });
  }

  private refreshStatus(): void {
    this.releaseService.getStatus().subscribe({
      next: (status) => this.applyStatus(status),
      error: () => {
        this.errorMessage =
          'Impossible de récupérer le statut release. Vérifie que le backend est démarré.';
      },
    });
  }

  private applyStatus(status: ReleaseStatusResponse): void {
    this.isRunning = status.running;
    this.activeRun = status.activeRun;
    this.lastRun = status.lastRun;
    this.lastReport = status.lastReport;
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
