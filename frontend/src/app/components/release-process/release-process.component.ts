import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

interface ReleaseStep {
  id: string;
  title: string;
  description: string;
  helper: string;
}

@Component({
  selector: 'app-release-process',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './release-process.component.html',
  styleUrls: ['./release-process.component.css'],
})
export class ReleaseProcessComponent {
  public readonly currentDevVersion = environment.version;
  public readonly stableCandidate = this.currentDevVersion.split('-')[0];

  public nextDevVersion = '';
  public readonly steps: ReleaseStep[] = [
    {
      id: 'stabilize',
      title: 'Stabilisation de la version',
      description: 'Passer de la version de développement à la version stable.',
      helper: [
        `${this.currentDevVersion} → ${this.stableCandidate}`,
        "Modification de l'environment.ts",
      ].join('\r'),
    },
    {
      id: 'build-check',
      title: 'Validation de la compilation locale',
      description:
        'Confirme que le build se passe correctement avant de figer les notes.',
      helper:
        'Lance `scripts/build-production.bat` et valide le résultat avant de continuer.',
    },
    {
      id: 'production-ready',
      title: 'Préparation pour la production',
      description:
        'Met à jour les fichiers requis (package.json, environment, changelog, etc.).',
      helper: [
        '1) package.json + environment.prod.ts : version, URL, drapeaux prod.',
        '2) Changelog + release notes : date, fonctionnalités, impacts.',
        '3) Avant merge : rebase/merge master, vérifier que git diff est propre. (Lancer check-master-status.ps1)',
      ].join('\n'),
    },
    {
      id: 'next-dev',
      title: 'Planification de la prochaine version',
      description:
        'Saisis le numéro de la prochaine version de développement pour repartir sur un nouveau cycle.',
      helper:
        'Respecte le SemVer : MAJEUR.MINOR.PATCH-dev (ex: 1.2.0-dev, 1.1.1-dev).',
    },
  ];

  public readonly statuses: StepStatus[] = this.steps.map((_, index) =>
    index === 0 ? 'active' : 'pending',
  );

  public currentStepIndex = 0;
  public finished = false;

  completeCurrentStep(): void {
    if (this.isNextDevStep() && !this.nextDevVersion.trim()) {
      alert(
        'Renseigne la prochaine version de développement avant de valider.',
      );
      return;
    }

    this.statuses[this.currentStepIndex] = 'completed';
    this.advanceToNextStep();
  }

  skipCurrentStep(): void {
    this.statuses[this.currentStepIndex] = 'skipped';
    this.advanceToNextStep();
  }

  goBack(): void {
    if (this.currentStepIndex === 0) {
      return;
    }
    if (this.finished) {
      this.finished = false;
    }
    const currentStatus = this.statuses[this.currentStepIndex];
    if (currentStatus === 'completed' || currentStatus === 'skipped') {
      this.statuses[this.currentStepIndex] = 'pending';
    }
    this.currentStepIndex -= 1;
    this.statuses[this.currentStepIndex] = 'active';
  }

  resetProcess(): void {
    this.statuses.forEach((_, index) => {
      this.statuses[index] = index === 0 ? 'active' : 'pending';
    });
    this.currentStepIndex = 0;
    this.finished = false;
    this.nextDevVersion = '';
  }

  private advanceToNextStep(): void {
    if (this.currentStepIndex === this.steps.length - 1) {
      this.finished = true;
      return;
    }
    this.currentStepIndex += 1;
    this.statuses[this.currentStepIndex] = 'active';
  }

  isCurrentStatus(status: StepStatus): boolean {
    return this.statuses[this.currentStepIndex] === status;
  }

  isFinished(): boolean {
    return this.finished;
  }

  isNextDevStep(): boolean {
    return this.steps[this.currentStepIndex]?.id === 'next-dev';
  }
}
