import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import {
  CandidateFlowStatus,
  EvidenceReport,
  ReleaseEvidenceService,
} from '../../services/release-evidence.service';
@Component({
  selector: 'app-release-journey',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './release-journey.component.html',
  styleUrls: ['./release-journey.component.css'],
})
export class ReleaseJourneyComponent implements OnInit, OnDestroy {
  @Input() report: EvidenceReport | null = null;
  @Output() candidatePrepared = new EventEmitter<void>(true);
  @Output() validationRequested = new EventEmitter<string>();
  state: CandidateFlowStatus | null = null;
  loading = false;
  downloading = false;
  error = '';
  feedback = '';
  sshBusy = false;
  sshPublicKey = '';
  createSshKey() {
    if (
      this.sshBusy ||
      !confirm(
        'Créer ou réutiliser une clé SSH locale dédiée ? Sa clé privée restera sur ce PC.',
      )
    )
      return;
    this.sshBusy = true;
    this.service.createSshKey().subscribe({
      next: (r) => {
        this.sshPublicKey = r.publicKey;
        this.sshBusy = false;
        this.feedback =
          'Clé locale prête. Installer uniquement sa partie publique sur le NAS.';
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Création impossible : vérifier OpenSSH et les permissions du backend local.';
      },
    });
  }
  downloadSshInstaller() {
    if (this.sshBusy) return;
    this.sshBusy = true;
    this.service.sshInstaller().subscribe({
      next: (blob) => {
        this.sshBusy = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'install-release-ssh.sh';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Créer la clé locale avant de télécharger son installateur.';
      },
    });
  }
  checkSshPlan() {
    const d = this.report?.dossier;
    if (this.sshBusy || !d || !this.report?.readyForPreproduction) return;
    this.sshBusy = true;
    this.service.sshPlan(d.identity, d.revision).subscribe({
      next: (r) => {
        this.sshBusy = false;
        this.feedback =
          'Plan NAS vérifié pour ' + r.candidate + ' : aucun service modifié.';
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Plan refusé : vérifier l’installation SSH et préparer sur NAS exactement la candidate de ce dossier.';
      },
    });
  }
  probeSsh() {
    if (this.sshBusy) return;
    this.sshBusy = true;
    this.service.probeSsh().subscribe({
      next: () => {
        this.sshBusy = false;
        this.feedback =
          'SSH par clé vérifié : aucun mot de passe demandé. Les droits restent limités au diagnostic et au plan.';
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Connexion impossible : installer la clé publique et vérifier la clé d’hôte NAS dans le terminal du PC. Ne pas désactiver la vérification SSH.';
      },
    });
  }

  active = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private completedTask = '';
  readonly labels: Record<string, string> = {
    WORKTREE_DIRTY: 'Enregistrez et commitez vos modifications.',
    MERGE_PR_FIRST:
      'Faites relire et fusionner la Pull Request, puis placez le PC sur la branche 2.2.0-dev.',
    PUSH_OR_PULL_REQUIRED:
      'Le PC et GitHub ne sont pas sur le même commit. Synchronisez la branche.',
    BRANCH_NOT_PROTECTED: 'La branche cible doit être protégée.',
    CI_NOT_FOUND: 'GitHub doit exécuter la CI après le push.',
    CI_RUNNING:
      'Les tests GitHub sont en cours. Cette page suivra leur progression.',
    CI_FAILED:
      'La CI a échoué. Ouvrez son rapport, corrigez puis poussez un nouveau commit.',
    CI_CHECKS_MISSING:
      'Les contrôles obligatoires GitHub ne sont pas tous validés.',
    ARTIFACT_MISSING:
      'Le package qualifié est absent ou expiré. Il faut une nouvelle exécution CI.',
    GITHUB_LOGIN_REQUIRED:
      'Reconnectez votre compte GitHub dans Git / VS Code sur ce PC, puis réessayez.',
    GITHUB_UNAVAILABLE:
      'GitHub est indisponible ou les droits de lecture des Actions manquent.',
    WRONG_REPOSITORY: 'Ouvrez le dépôt Djone/suivi-cb sur le PC.',
    GIT_UNAVAILABLE: 'Git doit être installé et accessible au backend local.',
    CANDIDATE_PREREQUISITES_MISSING:
      'Terminez les contrôles Git et CI indiqués avant de créer le dossier.',
    GIT_CHANGED_REFRESH: 'Le commit a changé. Actualisez avant de recommencer.',
    PREPRODUCTION_KIT_BLOCKED:
      'Figez le périmètre, relisez les notes et validez la revue des sources dans le dossier de preuves.',
    ARTIFACT_DIGEST_MISMATCH:
      'L’empreinte de l’artefact ne correspond pas à GitHub. Le package est refusé.',
    STAGED_ARTIFACT_CONFLICT:
      'Un ancien staging de cette exécution contient des fichiers différents. Ne les utilisez pas.',
  };
  constructor(private readonly service: ReleaseEvidenceService) {}
  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => {
      if (
        this.state?.task?.status === 'downloading' ||
        this.state?.run?.status === 'in_progress' ||
        this.state?.run?.status === 'queued'
      )
        this.refresh();
    }, 10000);
  }
  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  explain(code: string) {
    return this.labels[code] || 'Opération interrompue : ' + code;
  }
  refresh() {
    if (this.loading) return;
    this.loading = true;
    this.service.candidateStatus().subscribe({
      next: (s) => {
        this.state = s;
        this.loading = false;
        this.applyTask(s);
      },
      error: () => {
        this.loading = false;
        this.error = 'Vérifiez que le backend local a été redémarré.';
      },
    });
  }
  private applyTask(s: CandidateFlowStatus) {
    if (s.task?.status === 'ready' && s.task.id !== this.completedTask) {
      this.completedTask = s.task.id;
      this.candidatePrepared.emit();
      this.active = 2;
    }
    if (s.task?.status === 'failed')
      this.error = this.explain(s.task.error || 'DOWNLOAD_FAILED');
    if (s.task?.status === 'interrupted')
      this.error =
        'Le téléchargement a été interrompu. Relancez la préparation.';
  }
  prepare() {
    if (
      !this.state?.ready ||
      !this.state.commit ||
      this.loading ||
      this.state.task?.status === 'downloading'
    )
      return;
    this.loading = true;
    this.error = '';
    this.service.prepareCandidate(this.state.commit).subscribe({
      next: (s) => {
        this.state = s;
        this.loading = false;
        this.active = 1;
        this.applyTask(s);
      },
      error: (e) => {
        this.loading = false;
        this.error = this.explain(e?.error?.message || 'PREPARATION_FAILED');
      },
    });
  }
  get candidate() {
    return this.report?.dossier?.manifest.candidate || '';
  }
  get runId() {
    return this.state?.task?.runId || '';
  }
  get remote() {
    return '/volume1/docker/suivi-cb-preprod/releases/' + this.candidate;
  }
  get knownCandidate() {
    return (
      /^2\.2\.0-rc\.[1-9][0-9]*$/.test(this.candidate) &&
      /^[1-9][0-9]*$/.test(this.runId)
    );
  }
  get nasPreparation() {
    return 'sudo sh ' + this.remote + '/nas-kit/prepare-preproduction.sh';
  }
  get nasApply() {
    return 'sudo sh ' + this.remote + '/nas-kit/apply-preproduction.sh';
  }
  get nasBackupCheck() {
    return 'sudo sh ' + this.remote + '/nas-kit/check-backup.sh';
  }
  get nasRollback() {
    return 'sudo sh ' + this.remote + '/nas-kit/test-rollback.sh';
  }
  get createNasDirectory() {
    return (
      'sudo mkdir -p ' +
      this.remote +
      '\nsudo chown 1028:100 ' +
      this.remote +
      '\nsudo chmod 700 ' +
      this.remote
    );
  }
  readonly inspectNas =
    "free -m\nsudo docker ps --format 'Name={{.Names}} Image={{.Image}} Status={{.Status}}'";
  readonly inspectPreprod =
    "sudo docker inspect --format 'Name={{.Name}} Image={{.Image}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}} OOMKilled={{.State.OOMKilled}}' suivi-cb-ci-preprod-backend suivi-cb-ci-preprod-frontend\ncurl -s -o /dev/null -w 'Frontend HTTP=%{http_code}\\n' http://127.0.0.1:4205/\ncurl -s -o /dev/null -w 'API sans jeton HTTP=%{http_code}\\n' http://127.0.0.1:4205/api/accounts/active";
  readonly tokenSummary =
    "(() => { const token = prompt('Jeton access_token : décodage local uniquement'); if (!token) return; try { const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0)); const p = JSON.parse(new TextDecoder().decode(bytes)); console.table({issuer:p.iss,audience:JSON.stringify(p.aud),client:p.azp,emission:new Date(p.iat*1000).toISOString(),expiration:new Date(p.exp*1000).toISOString()}); } catch { console.warn('Jeton invalide : utiliser la valeur access_token, sans le préfixe Bearer.'); } })();";
  readonly deniedTest =
    "(async () => { const token = prompt('Jeton du compte sans rôle, traitement local uniquement'); if (!token) return; const response = await fetch('/api/accounts/active', { headers: { Authorization: 'Bearer ' + token } }); console.log('Statut API :', response.status); })();";
  readonly inspectProduction =
    "sudo docker inspect --format 'Name={{.Name}} Image={{.Image}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}}' suivi-cb-backend suivi-cb-frontend\ncurl -fsS http://127.0.0.1:4200/api/auth/config\ncurl -s -o /dev/null -w 'API sans jeton HTTP=%{http_code}\\n' http://127.0.0.1:4200/api/accounts/active";
  readonly backup =
    'sudo /volume1/suivi-cb-backups/backup-daily.sh\nsudo /volume1/suivi-cb-backups/publish-backups.sh';
  readonly productionPlanCheck =
    'sudo docker compose -p suivi-cb --env-file /volume1/docker/suivi-cb/.env.production -f /volume1/docker/suivi-cb/docker-compose.production.yml config --quiet';
  private save(blob: Blob, name: string) {
    const u = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  package() {
    if (this.downloading) return;
    this.downloading = true;
    this.service.candidateArchive().subscribe({
      next: (b) => {
        this.downloading = false;
        this.save(b, 'candidate-' + this.runId + '.zip');
      },
      error: () => {
        this.downloading = false;
        this.error =
          'Package indisponible. Préparez d’abord la candidate depuis Git.';
      },
    });
  }
  kit() {
    const d = this.report?.dossier;
    if (!d || !this.report?.readyForPreproduction || this.downloading) return;
    if (
      !confirm(
        'Préparer le kit de déploiement PRÉPRODUCTION pour ' +
          this.candidate +
          ' ? Aucun déploiement n’est lancé depuis le PC.',
      )
    )
      return;
    this.downloading = true;
    this.service.nasKit(d.identity, d.revision).subscribe({
      next: (b) => {
        this.downloading = false;
        this.save(b, 'nas-kit-' + this.candidate + '.tar.gz');
      },
      error: () => {
        this.downloading = false;
        this.error = this.explain('PREPRODUCTION_KIT_BLOCKED');
      },
    });
  }
  validate(id: string) {
    this.validationRequested.emit(id);
  }
  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.feedback = 'Commande copiée.';
    } catch {
      this.feedback = 'Sélectionnez et copiez le texte manuellement.';
    }
  }
}
