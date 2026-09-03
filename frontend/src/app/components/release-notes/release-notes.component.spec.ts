import { DevTodoItem } from '../dev-todo/dev-todo.model';
import { ReleaseNotesSection } from './release-notes.data';
import { buildReleaseSections } from './release-notes.component';

describe('buildReleaseSections', () => {
  const archivedItem: DevTodoItem = {
    title: 'Fonctionnalité publiée',
    description: 'Description',
    status: 'done',
    targetVersion: '1.6.0',
    priority: 'medium',
  };

  it('utilise les notes archivées pour la version actuellement en production', () => {
    const history: ReleaseNotesSection[] = [
      { version: '1.6.0', items: [archivedItem] },
      { version: '1.5.0', items: [] },
    ];

    const sections = buildReleaseSections('1.6.0', [], history);

    expect(sections[0]).toEqual(history[0]);
    expect(
      sections.filter((section) => section.version === '1.6.0'),
    ).toHaveSize(1);
  });

  it('utilise les tickets terminés lorsque la version est encore en développement', () => {
    const developmentItem: DevTodoItem = {
      ...archivedItem,
      title: 'Fonctionnalité en préparation',
      targetVersion: '1.7.0',
    };

    const sections = buildReleaseSections('1.7.0', [developmentItem], []);

    expect(sections[0].items).toEqual([developmentItem]);
  });
});
