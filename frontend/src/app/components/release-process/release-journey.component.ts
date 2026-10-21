import { releaseVersions } from './release-version';
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
  DsmRequestState,
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
  dsmInstalled = false;
  dsmRequest: DsmRequestState | null = null;
  sshBusy = false;
  downloadDsmKit() {
    if (this.sshBusy) return;
    this.sshBusy = true;
    this.service.dsmKit().subscribe({
      next: (blob) => {
        this.sshBusy = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dsm-executor.tar.gz';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.sshBusy = false;
        this.error = 'Kit DSM indisponible : redémarrer le backend local.';
      },
    });
  }
  queueDsm(action: 'plan' | 'apply-preproduction') {
    const d = this.report?.dossier;
    if (
      this.sshBusy ||
      !this.dsmInstalled ||
      !d ||
      !this.report?.readyForPreproduction
    )
      return;
    if (
      action === 'apply-preproduction' &&
      (this.dsmRequest?.status !== 'PLAN_PASS' ||
        this.dsmRequest.request.identity !== d.identity)
    )
      return;
    if (
      action === 'apply-preproduction' &&
      !confirm(
        'Déployer uniquement en préproduction la candidate ' +
          d.manifest.candidate +
          ' ? Une activation locale NAS reste nécessaire.',
      )
    )
      return;
    this.sshBusy = true;
    this.error = '';
    this.service
      .dsmQueue(
        d.identity,
        d.revision,
        action,
        action === 'apply-preproduction',
      )
      .subscribe({
        next: (r) => {
          this.sshBusy = false;
          this.dsmRequest = r;
          this.feedback =
            'Demande transmise. Attendre le reçu DSM ; ne pas renvoyer la demande.';
        },
        error: () => {
          this.sshBusy = false;
          this.error =
            'Envoi non confirmé. Actualiser le suivi DSM avant toute nouvelle tentative.';
        },
      });
  }
  refreshDsm() {
    if (this.sshBusy) return;
    this.sshBusy = true;
    this.service.dsmStatus().subscribe({
      next: (r) => {
        this.sshBusy = false;
        this.dsmRequest = r.lastRequest;
        if (this.dsmRequest) this.pollDsm();
      },
      error: () => {
        this.sshBusy = false;
        this.error = 'Suivi DSM indisponible.';
      },
    });
  }
  pollDsm() {
    if (this.sshBusy || !this.dsmRequest) return;
    this.sshBusy = true;
    this.service.dsmReceipt(this.dsmRequest.request.nonce).subscribe({
      next: (r) => {
        this.sshBusy = false;
        this.dsmRequest = r;
        if (r.receipt) {
          this.candidatePrepared.emit();
          this.feedback =
            'Reçu NAS archivé : ' +
            r.status +
            '. La recette humaine reste distincte.';
        }
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Reçu DSM indisponible ou différent du dossier. Ne pas relancer automatiquement une application.';
      },
    });
  }

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
      next: (r) => {
        this.sshBusy = false;
        this.dsmInstalled = r.dsmInstalled === true;
        this.feedback = this.dsmInstalled
          ? 'SSH par clé vérifié : file DSM disponible. Un reçu de plan reste nécessaire pour confirmer le fonctionnement de la tâche.'
          : 'SSH par clé vérifié : diagnostic uniquement. Installer le kit DSM pour transmettre des demandes.';
      },
      error: () => {
        this.sshBusy = false;
        this.error =
          'Connexion impossible : installer la clé publique et vérifier la clé d’hôte NAS dans le terminal du PC. Ne pas désactiver la vérification SSH.';
      },
    });
  }

  get versions() {
    return releaseVersions(this.report?.dossier?.manifest.candidate);
  }
  active = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private completedTask = '';
  get labels(): Record<string, string> {
    return {
      WORKTREE_DIRTY: 'Enregistrez et commitez vos modifications.',
      MERGE_PR_FIRST:
        'Faites relire et fusionner la Pull Request, puis placez le PC sur la branche ' +
        this.versions.developmentBranch +
        '.',
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
      GIT_CHANGED_REFRESH:
        'Le commit a changé. Actualisez avant de recommencer.',
      PREPRODUCTION_KIT_BLOCKED:
        'Figez le périmètre, relisez les notes et validez la revue des sources dans le dossier de preuves.',
      ARTIFACT_DIGEST_MISMATCH:
        'L’empreinte de l’artefact ne correspond pas à GitHub. Le package est refusé.',
      STAGED_ARTIFACT_CONFLICT:
        'Un ancien staging de cette exécution contient des fichiers différents. Ne les utilisez pas.',
    };
  }
  constructor(private readonly service: ReleaseEvidenceService) {}
  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => {
      if (
        this.dsmRequest &&
        ['QUEUED', 'DELIVERY_UNKNOWN'].includes(this.dsmRequest.status)
      )
        this.pollDsm();
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
    }
    if (s.task?.status === 'failed')
      this.error = this.explain(s.task.error || 'DOWNLOAD_FAILED');
    if (s.task?.status === 'interrupted')
      this.error =
        'Le téléchargement a été interrompu. Relancez la préparation.';
  }
  get canUseCandidate(): boolean {
    const report = this.report;
    return !!(
      this.knownCandidate &&
      this.state?.ready &&
      report?.readyForPreproduction &&
      report.repository.clean &&
      report.repository.commit === report.dossier?.manifest.commit
    );
  }
  get publishedCandidateImported(): boolean {
    return (
      this.canUseCandidate &&
      this.state?.published === true &&
      this.report?.dossier?.manifest.status === 'PUBLISHED' &&
      this.candidate === this.state.expectedCandidate
    );
  }
  publishRegistry() {
    if (
      this.loading ||
      !this.state?.ready ||
      !this.state.commit ||
      this.state.publication
    )
      return;
    if (
      !confirm(
        'Lancer une NOUVELLE candidate avec tests et publication GHCR ? Elle remplacera les images de la candidate actuelle et devra être revalidée sur NAS. Une approbation GitHub sera demandée avant publication.',
      )
    )
      return;
    this.loading = true;
    this.error = '';
    this.service.publishCandidate(this.state.commit).subscribe({
      next: (p) => {
        if (this.state) this.state.publication = p;
        this.loading = false;
        this.feedback =
          'Cycle demandé pour ' +
          p.candidate +
          '. Suivre les tests et approuver candidate-registry dans GitHub, puis actualiser et importer les preuves publiées.';
      },
      error: (e) => {
        this.loading = false;
        this.error = this.explain(
          e?.error?.message || 'PUBLICATION_REQUEST_UNCONFIRMED',
        );
      },
    });
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
    "sudo docker inspect --format 'Name={{.Name}} Image={{.Image}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}}' suivi-cb-backend suivi-cb-frontend\ncurl -s -o /dev/null -w 'API sans jeton HTTP=%{http_code}\\n' http://127.0.0.1:4200/api/accounts/active";
  readonly backup =
    'sudo /volume1/suivi-cb-backups/backup-daily.sh\nsudo /volume1/suivi-cb-backups/publish-backups.sh';
  readonly productionInventory =
    "sudo docker inspect --format 'Name={{.Name}} Mounts={{json .Mounts}} Networks={{json .NetworkSettings.Networks}}' suivi-cb-backend suivi-cb-frontend";
  get productionCompose(): string {
    const images = this.report?.dossier?.manifest.images;
    const backend = images?.['backend']?.configDigest;
    const frontend = images?.['frontend']?.configDigest;
    if (
      !backend ||
      !frontend ||
      !/^sha256:[a-f0-9]{64}$/.test(backend) ||
      !/^sha256:[a-f0-9]{64}$/.test(frontend)
    )
      return '';
    const values: Record<string, string> = {
      PROD_BACKEND_IMAGE: backend,
      PROD_FRONTEND_IMAGE: frontend,
      PROD_DATA_DIR: '/volume1/docker/suivi-cb/data',
      PROD_LOG_DIR: '/volume1/docker/suivi-cb/logs/backend',
      PROD_NETWORK: 'suivi-cb_suivi-cb-network',
    };
    const template =
      '# Promote the exact validated preproduction image IDs. No build.\nname: suivi-cb\nservices:\n  backend:\n    image: ${PROD_BACKEND_IMAGE:?Set validated backend image ID}\n    pull_policy: never\n    container_name: suivi-cb-backend\n    restart: unless-stopped\n    env_file:\n      - .env.production\n    environment:\n      NODE_ENV: production\n      PORT_BACK: "3001"\n      DB_PATH: /app/data/database.db\n      KEYCLOAK_URL: https://auth.jolurie.com\n      KEYCLOAK_REALM: suivi-cb\n      KEYCLOAK_CLIENT_ID: suivi-cb-web\n      KEYCLOAK_AUDIENCE: suivi-cb-api\n    expose:\n      - "3001"\n    volumes:\n      - ${PROD_DATA_DIR:?Set existing production data directory}:/app/data\n      - ${PROD_LOG_DIR:?Set production log directory}:/app/logs\n    networks: [app]\n    healthcheck:\n      test: ["CMD", "node", "-e", "fetch(\'http://127.0.0.1:3001/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n      start_period: 60s\n  frontend:\n    image: ${PROD_FRONTEND_IMAGE:?Set validated frontend image ID}\n    pull_policy: never\n    container_name: suivi-cb-frontend\n    restart: unless-stopped\n    ports:\n      - "127.0.0.1:4200:8080"\n    depends_on:\n      backend:\n        condition: service_healthy\n    networks: [app]\n    healthcheck:\n      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:8080"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n      start_period: 30s\nnetworks:\n  app:\n    external: true\n    name: ${PROD_NETWORK:?Set existing production network}\n';
    return template.replace(
      /\$\{(PROD_\w+):\?[^}]+\}/g,
      (_, key: string) => values[key],
    );
  }
  downloadProductionCompose() {
    const draft = this.productionCompose;
    if (!draft) return;
    this.save(
      new Blob([draft], { type: 'text/yaml;charset=utf-8' }),
      'docker-compose.production.yml',
    );
  }
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
  get kitBlockers() {
    return this.report?.blockers.filter((b) => b.stage === 'development') || [];
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
