import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DEV_TODO_ITEMS } from '../dev-todo/dev-todo.data';
import { DevTodoItem } from '../dev-todo/dev-todo.model';

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

  public readonly releaseItems: DevTodoItem[] = DEV_TODO_ITEMS.filter(
    (item) => item.status === 'done' && item.targetVersion === this.releaseVersion
  );

  getDescriptionList(item: DevTodoItem): string[] | null {
    return Array.isArray(item.description) ? item.description : null;
  }

  getPlainDescription(item: DevTodoItem): string {
    return typeof item.description === 'string' ? item.description : '';
  }
}
