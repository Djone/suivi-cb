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

  public createReleaseBranch = false;
  public createNextBranch = true;
  public releaseBranch = '';
  public branchPrefix = 'release/';
  public commit = true;
  public rollbackOnFailure = true;
  public preproductionApproved = false;
  public candidateVersion = `${this.stableCandidate}-rc.1`;
  public candidatePlatform = 'linux/amd64';

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
      id: 'development',
      title: 'Développement validé',
      description:
        'Terminer les changements, vérifier les fonctionnalités concernées et pousser la branche de développement.',
      helper: 'Validation fonctionnelle locale + branche synchronisée',
    },
    {
      id: 'dev-tests',
      title: 'Tests de développement',
      description:
        'Lancer dry-run et vérifier que les contrôles Git et les tests automatisés réussissent.',
      helper: 'Action automatisée : dry-run',
    },
    {
      id: 'candidate',
      title: 'Candidate préparée',
      description:
        'Lancer prepare, vérifier le commit candidat, puis le pousser avant de construire les images.',
      helper: 'Action automatisée : prepare ; push du candidat à effectuer',
    },
    {
      id: 'preproduction',
      title: 'Préproduction validée',
      description:
        'Installer la candidate sur le NAS, tester et consigner les IDs exacts des images backend et frontend.',
      helper: 'Action NAS manuelle ; ne pas reconstruire après validation',
    },
    {
      id: 'git-publication',
      title: 'Publication Git',
      description:
        'Après le feu vert préproduction, lancer deploy pour fusionner dans master et publier le tag stable.',
      helper: 'Action automatisée : deploy ; Git uniquement',
    },
    {
      id: 'production',
      title: 'Mise en production',
      description:
        'Promouvoir les mêmes images validées avec les variables et données de production.',
      helper: 'Action NAS manuelle ; aucune reconstruction ni update.sh',
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
    const rollbackCmd = this.rollbackOnFailure ? ' --rollback-on-failure' : '';

    return `npm run release:prepare -- --stable=${this.stableVersion.trim()} --next=${next} --branch=${this.branch}${branchCmd}${releaseBranch}${commitCmd}${rollbackCmd}`;
  }

  get deployCommand(): string {
    return `npm run release:deploy -- --branch=${this.branch} --execute`;
  }

  get candidateCommand(): string {
    if (!/^\d+\.\d+\.\d+-rc\.[1-9]\d*$/.test(this.candidateVersion) ||
        !['linux/amd64', 'linux/arm64'].includes(this.candidatePlatform)) {
      return '';
    }
    return `npm.cmd run release:candidate -- --candidate=${this.candidateVersion} --platform=${this.candidatePlatform}`;
  }

  runDryRun(): void {
    this.runCommand('dry-run');
  }

  runPrepare(): void {
    if (!this.validatePrepareInputs()) {
      return;
    }
    this.preproductionApproved = false;
    this.runCommand('prepare');
  }

  runDeploy(): void {
    if (!this.preproductionApproved) {
      this.errorMessage =
        'Confirmez la validation de la candidate en préproduction avant de publier dans Git.';
      return;
    }
    this.runCommand('deploy');
  }

  runRollback(): void {
    if (
      !confirm('Confirmer le rollback vers le dernier backup de versions ?')
    ) {
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

    this.createReleaseBranch = false;
    this.createNextBranch = true;
    this.releaseBranch = '';
    this.branchPrefix = 'release/';
    this.commit = true;
    this.rollbackOnFailure = true;
    this.preproductionApproved = false;
    this.candidateVersion = `${this.stableCandidate}-rc.1`;
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

  private runCommand(command: ReleaseCommand): void {
    if (this.isRunning) {
      return;
    }

    this.errorMessage = '';
    this.backendMessage = '';

    const execute = command === 'deploy';
    const stable =
      command === 'deploy' ? undefined : this.stableVersion.trim() || undefined;
    const payload: ReleaseRunRequest = {
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

    const confirmationMessage = execute
      ? 'Confirmez-vous que la candidate a été testée et approuvée en préproduction, et que les IDs exacts des images backend/frontend ont été consignés ? Cette action publie master et le tag Git, mais ne déploie pas sur le NAS.'
      : 'Confirmer l’exécution réelle (pas en simulation) ?';
    if (execute && !confirm(confirmationMessage)) {
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
          error?.error?.message ??
          'Erreur lors du lancement de la commande release.';
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
