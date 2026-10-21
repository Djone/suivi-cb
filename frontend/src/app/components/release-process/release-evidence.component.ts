import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  EvidenceManifest,
  EvidenceReport,
  ReleaseEvidenceService,
} from '../../services/release-evidence.service';
@Component({
  selector: 'app-release-evidence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './release-evidence.component.html',
  styleUrls: ['./release-evidence.component.css'],
})
export class ReleaseEvidenceComponent implements OnInit {
  @Output() candidateSelected = new EventEmitter<EvidenceManifest>(true);
  @Output() reportChanged = new EventEmitter<EvidenceReport>(true);
  report: EvidenceReport | null = null;
  busy = false;
  error = '';
  message = '';
  feedbackTarget: 'general' | 'validation' = 'general';
  source = 'github';
  runId = '';
  summary = '';
  releaseNotes = '';
  frozen = false;
  nextDevVersion = '';
  get validNextVersion(): boolean {
    return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-dev$/.test(
      this.nextDevVersion,
    );
  }
  get orderedChecks() {
    const productionOrder = [
      'registry',
      'release-plan',
      'publication-lock',
      'production-approval',
      'production-deployment',
      'production-smoke',
      'git-publication',
    ];
    const rank = (c: { stage: string; id: string }) =>
      c.stage === 'production'
        ? 100 +
          (productionOrder.indexOf(c.id) < 0
            ? productionOrder.length
            : productionOrder.indexOf(c.id))
        : 0;
    return [...(this.report?.checks || [])].sort((a, b) => rank(a) - rank(b));
  }
  get checkGroups() {
    const preparation = [
      'release-plan',
      'publication-lock',
      'production-approval',
    ];
    const delivery = [
      'production-deployment',
      'production-smoke',
      'git-publication',
    ];
    const checks = this.orderedChecks;
    return [
      {
        title: '1. Qualification des images candidates',
        description:
          'Tests, provenance, recette NAS et preuves liées aux images exactes. Ces prérequis doivent être satisfaits avant leur promotion.',
        checks: checks.filter(
          (c) => !preparation.includes(c.id) && !delivery.includes(c.id),
        ),
      },
      {
        title: '2. Préparation et autorisation de livraison',
        description:
          'Configuration du parcours, cycle suivant prévu et approbation humaine. Ces points bloquent la livraison, mais ne sont pas des tests des images.',
        checks: checks.filter((c) => preparation.includes(c.id)),
      },
      {
        title: '3. Exécution et contrôles après livraison',
        description:
          'À renseigner pendant ou après la MEP, selon le déroulé ci-dessus. Leur absence avant la MEP est normale ; ils restent obligatoires pour clôturer la release.',
        checks: checks.filter((c) => delivery.includes(c.id)),
      },
    ];
  }
  get productionPrerequisites() {
    return (
      this.report?.blockers.filter(
        (b) =>
          b.stage !== 'production' ||
          ['registry', 'publication-lock', 'release-plan'].includes(b.id),
      ) || []
    );
  }
  get productionValidationSelected() {
    return [
      'production-approval',
      'production-deployment',
      'production-smoke',
      'git-publication',
    ].includes(this.check);
  }
  check = 'source-review';
  reference = '';
  readonly manualIds = [
    'source-review',
    'nas-identity',
    'nas-auth',
    'nas-business',
    'nas-recovery',
    'operations-rights',
    'preproduction-approval',
    'production-approval',
    'production-deployment',
    'production-smoke',
    'git-publication',
  ];
  constructor(private readonly service: ReleaseEvidenceService) {}
  ngOnInit() {
    this.refresh();
  }
  get manualChecks() {
    return (
      this.report?.checks.filter((c) => this.manualIds.includes(c.id)) || []
    );
  }
  private validationError(code: string): string {
    const messages: Record<string, string> = {
      PRODUCTION_BLOCKED:
        'Validation non enregistrée : les prérequis de production ne sont pas satisfaits. Corrigez les points indiqués ci-dessous, puis confirmez à nouveau.',
      DEVELOPMENT_BLOCKED:
        'Validation non enregistrée : la qualification de la candidate est incomplète. Vérifiez les tests, le dépôt propre, le périmètre et la revue des sources.',
      PREPRODUCTION_BLOCKED:
        'Approbation non enregistrée : tous les contrôles NAS de préproduction doivent être validés avant son approbation.',
      STALE_DOSSIER:
        'Validation non enregistrée : le dossier a changé depuis son affichage. Cliquez sur Actualiser, vérifiez la candidate et recommencez.',
      REFERENCE_REQUIRED:
        'Validation non enregistrée : renseignez une référence de compte rendu de 500 caractères maximum, sans secret ni jeton.',
      INVALID_VALIDATION:
        'Validation non enregistrée : choisissez un contrôle proposé dans la liste, puis recommencez.',
      EVIDENCE_BUSY:
        'Validation non enregistrée : une autre opération est en cours. Attendez sa fin, actualisez le dossier puis recommencez.',
    };
    return (
      messages[code] ||
      'Enregistrement non confirmé : impossible de joindre le dossier ou de traiter la demande. Vérifiez le backend local puis actualisez pour savoir si la validation a été conservée avant de réessayer.'
    );
  }
  private request(
    operation: Observable<EvidenceReport>,
    message = '',
    target: 'general' | 'validation' = 'general',
  ) {
    if (this.busy) return;
    this.busy = true;
    this.feedbackTarget = target;
    this.error = '';
    this.message = '';
    operation.subscribe({
      next: (r) => {
        this.report = r;
        this.reportChanged.emit(r);
        this.busy = false;
        this.message = message;
        if (r.dossier) {
          this.summary = r.dossier.scope.summary;
          this.releaseNotes = r.dossier.scope.releaseNotes;
          this.frozen = r.dossier.scope.frozen;
          this.nextDevVersion = r.dossier.releasePlan?.nextDevVersion || '';
          this.candidateSelected.emit(r.dossier.manifest);
        }
      },
      error: (e) => {
        this.busy = false;
        this.error =
          target === 'validation'
            ? this.validationError(e?.error?.message || '')
            : e?.error?.message ||
              'Dossier indisponible. Vérifiez le backend local.';
      },
    });
  }
  selectValidation(id: string) {
    if (!this.manualIds.includes(id)) return;
    this.check = id;
    document
      .getElementById(
        id === 'source-review' ? 'release-scope' : 'release-human-validation',
      )
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  refresh() {
    this.request(this.service.read());
  }
  importBundle() {
    if (!this.busy)
      this.request(
        this.service.importBundle(this.source, this.runId),
        'Preuves importées ; les blocages sont recalculés.',
      );
  }
  saveReleasePlan() {
    const d = this.report?.dossier;
    if (!d || !this.validNextVersion) return;
    this.request(
      this.service.update({
        action: 'release-plan',
        identity: d.identity,
        revision: d.revision,
        nextDevVersion: this.nextDevVersion,
      }),
      'Cycle suivant enregistré ; approbations production à refaire si la version a changé. Aucun fichier de version modifié.',
    );
  }
  saveScope() {
    const d = this.report?.dossier;
    if (d)
      this.request(
        this.service.update({
          action: 'scope',
          identity: d.identity,
          revision: d.revision,
          scope: {
            summary: this.summary,
            releaseNotes: this.releaseNotes,
            frozen: this.frozen,
          },
        }),
        'Périmètre enregistré ; validations humaines invalidées.',
      );
  }
  validate(approved: boolean) {
    const d = this.report?.dossier;
    if (!d || !this.reference.trim()) return;
    if (
      approved &&
      !confirm('Confirmer cette validation humaine pour les images affichées ?')
    )
      return;
    this.request(
      this.service.update({
        action: 'validate',
        identity: d.identity,
        revision: d.revision,
        check: this.check,
        approved,
        reference: this.reference,
      }),
      approved
        ? 'Validation enregistrée pour cette candidate.'
        : 'Validation retirée pour cette candidate ; les approbations qui en dépendent sont à refaire.',
      'validation',
    );
  }
  close() {
    const d = this.report?.dossier;
    if (
      d &&
      this.report?.canClose &&
      confirm('Clôturer le dossier de cette candidate ?')
    )
      this.request(
        this.service.update({
          action: 'close',
          identity: d.identity,
          revision: d.revision,
        }),
      );
  }
  download() {
    if (this.busy) return;
    this.busy = true;
    this.service.report().subscribe({
      next: (r) => {
        this.busy = false;
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download =
          (r.dossier?.manifest.candidate || 'release') + '-readiness.json';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.busy = false;
        this.error = 'Export indisponible.';
      },
    });
  }
}
