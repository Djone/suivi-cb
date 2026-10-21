import { releaseVersions } from './release-version';
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
  source = 'github';
  runId = '';
  summary = '';
  releaseNotes = '';
  frozen = false;
  nextDevVersion = '';
  get nextVersionExample() {
    return releaseVersions(this.report?.dossier?.manifest.candidate)
      .nextExample;
  }
  get validNextVersion(): boolean {
    return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-dev$/.test(
      this.nextDevVersion,
    );
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
  private request(operation: Observable<EvidenceReport>, message = '') {
    if (this.busy) return;
    this.busy = true;
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
          e?.error?.message ||
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
      'Validation enregistrée dans le dossier.',
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
