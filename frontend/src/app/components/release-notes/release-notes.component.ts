import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DEV_TODO_ITEMS } from '../dev-todo/dev-todo.data';
import { DevTodoItem } from '../dev-todo/dev-todo.model';
import {
  RELEASE_NOTES_HISTORY,
  ReleaseNotesSection,
} from './release-notes.data';

@Component({
  selector: 'app-release-notes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './release-notes.component.html',
  styleUrls: ['./release-notes.component.css'],
})
export class ReleaseNotesComponent {
  private readonly rawVersion = environment.version;
  public readonly releaseVersion = this.rawVersion.split('-')[0];
  private readonly expandedVersions = new Set<string>([this.releaseVersion]);

  public readonly releaseSections: ReleaseNotesSection[] = (() => {
    const currentItems = DEV_TODO_ITEMS.filter(
      (item) =>
        item.status === 'done' && item.targetVersion === this.releaseVersion,
    );
    const currentSection: ReleaseNotesSection = {
      version: this.releaseVersion,
      items: currentItems,
    };
    const historySections = RELEASE_NOTES_HISTORY.filter(
      (section) => section.version !== this.releaseVersion,
    );
    return [currentSection, ...historySections];
  })();

  isExpanded(version: string): boolean {
    return this.expandedVersions.has(version);
  }

  toggleSection(version: string): void {
    if (this.expandedVersions.has(version)) {
      this.expandedVersions.delete(version);
    } else {
      this.expandedVersions.add(version);
    }
  }

  getDescriptionList(item: DevTodoItem): string[] | null {
    if (!Array.isArray(item.description)) {
      return null;
    }
    const bullets = item.description
      .map((line) => line.trim())
      .filter(Boolean)
      // Ne garder que les sous-tâches cochées ([X]) ou sans case (texte libre)
      .filter((line) => {
        const m = line.match(/^\[(.)\]/);
        if (!m) return true;
        return m[1].toLowerCase() === 'x';
      })
      // Supprimer le préfixe [X] / [ ]
      .map((line) => line.replace(/^\s*\[[^\]]*\]\s*/, '').trim())
      .filter(Boolean);

    return bullets.length ? bullets : null;
  }

  getPlainDescription(item: DevTodoItem): string {
    return typeof item.description === 'string' ? item.description : '';
  }
}
