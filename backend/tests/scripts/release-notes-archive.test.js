const {
  archiveReleaseNotes,
  buildArchive,
  readExportedArray,
  replaceExportedArray,
} = require('../../../scripts/release-notes-archive');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Release notes archive', () => {
  const completedTicket = {
    title: '[Ticket 13] Bug fix : frontend',
    description: ['[X] Correction'],
    status: 'done',
    targetVersion: '1.6.0',
    priority: 'medium',
  };

  it('transfere les tickets termines et conserve les tickets actifs', () => {
    const pendingTicket = {
      title: '[Ticket 14] A faire',
      description: ['[ ] Travail restant'],
      status: 'todo',
      targetVersion: '1.7.0',
      priority: 'high',
    };

    const result = buildArchive(
      [completedTicket, pendingTicket],
      [],
      '1.6.0',
    );

    expect(result.releaseSections).toEqual([
      { version: '1.6.0', items: [completedTicket] },
    ]);
    expect(result.devItems).toEqual([pendingTicket]);
    expect(result).toMatchObject({ archived: 1, added: 1, updated: 0 });
  });

  it('remplace un ticket deja archive au lieu de le dupliquer', () => {
    const oldTicket = {
      ...completedTicket,
      description: ['[X] Ancienne description'],
    };

    const result = buildArchive(
      [completedTicket],
      [{ version: '1.6.0', items: [oldTicket, oldTicket] }],
      '1.6.0',
    );

    expect(result.releaseSections[0].items).toEqual([completedTicket]);
    expect(result.devItems).toEqual([]);
    expect(result).toMatchObject({
      archived: 1,
      added: 0,
      updated: 1,
      duplicatesRemoved: 1,
    });
  });

  it('reecrit un tableau TypeScript lisible et reutilisable', () => {
    const content =
      "import { DevTodoItem } from './dev-todo.model';\n\n" +
      'export const DEV_TODO_ITEMS: DevTodoItem[] = [];\n';
    const updated = replaceExportedArray(content, 'DEV_TODO_ITEMS', [completedTicket]);

    expect(readExportedArray(updated, 'DEV_TODO_ITEMS').value).toEqual([
      completedTicket,
    ]);
    expect(updated).toContain(
      'export const DEV_TODO_ITEMS: DevTodoItem[] = [',
    );
    expect(updated).toContain("title: '[Ticket 13] Bug fix : frontend'");
  });

  it('archive les donnees dans les deux fichiers de facon idempotente', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'));
    const devTodoFile = path.join(tempDirectory, 'dev-todo.data.ts');
    const releaseNotesFile = path.join(tempDirectory, 'release-notes.data.ts');
    fs.writeFileSync(
      devTodoFile,
      `export const DEV_TODO_ITEMS = ${JSON.stringify([completedTicket])};\n`,
    );
    fs.writeFileSync(releaseNotesFile, 'export const RELEASE_NOTES_HISTORY = [];\n');

    try {
      const firstRun = archiveReleaseNotes({
        devTodoFile,
        releaseNotesFile,
        stableVersion: '1.6.0',
      });
      const secondRun = archiveReleaseNotes({
        devTodoFile,
        releaseNotesFile,
        stableVersion: '1.6.0',
      });

      const archived = readExportedArray(
        fs.readFileSync(releaseNotesFile, 'utf8'),
        'RELEASE_NOTES_HISTORY',
      ).value;
      expect(firstRun.archived).toBe(1);
      expect(secondRun.archived).toBe(0);
      expect(archived).toEqual([{ version: '1.6.0', items: [completedTicket] }]);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
