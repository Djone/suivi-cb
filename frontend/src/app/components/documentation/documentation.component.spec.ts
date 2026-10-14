import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService } from 'primeng/dynamicdialog';
import { of, Subject } from 'rxjs';
import { DocumentationService } from '../../services/documentation.service';
import { DocumentationEntry } from './documentation.model';
import { DocumentationComponent } from './documentation.component';

describe('DocumentationComponent interactions', () => {
  let component: DocumentationComponent;
  let confirmations: Subject<boolean>;
  let entries: DocumentationEntry[];
  let store: { documents: ReturnType<typeof signal<DocumentationEntry[]>>; remove: jasmine.Spy; publish: jasmine.Spy; load: jasmine.Spy };

  beforeEach(() => {
    entries = ['one', 'two'].map((id) => ({ id, sourcePath: `${id}.md`, category: 'Modes opératoires', title: id, body: '## Source', summary: '', owner: 'Équipe', updated: '', status: 'published', revision: 'a'.repeat(64) }));
    confirmations = new Subject<boolean>();
    store = {
      documents: signal(entries),
      load: jasmine.createSpy('load').and.resolveTo(undefined),
      remove: jasmine.createSpy('remove').and.callFake(async (id: string) => { store.documents.update((current) => current.filter((entry) => entry.id !== id)); return true; }),
      publish: jasmine.createSpy('publish').and.resolveTo(undefined),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: DocumentationService, useValue: store },
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate').and.resolveTo(true) } },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(), snapshot: { queryParamMap: { get: () => null }, fragment: null } } },
      { provide: DialogService, useValue: { open: jasmine.createSpy('open').and.returnValue({ onClose: confirmations, close: () => undefined }) } },
    ] });
    component = TestBed.runInInjectionContext(() => new DocumentationComponent());
    component.select(entries[0]);
  });

  it('filters titles and changes the selected content', () => {
    component.query = 'two';
    expect(component.groups[0].folders[0].entries.map((entry) => entry.id)).toEqual(['two']);
    component.requestSelection(entries[1]);
    expect(component.selected?.id).toBe('two');
  });

  it('cancels unpublished edits and publishes through the persistence layer', async () => {
    component.edit();
    component.draftBody = '## Changements';
    component.cancel();
    expect(component.draftBody).toBe('## Source');
    expect(store.publish).not.toHaveBeenCalled();
    component.edit();
    component.draftBody = '## Changements';
    await component.publish();
    expect(store.publish).toHaveBeenCalledWith('one', 'one', '## Changements', '', 'Modes opératoires');
    expect(component.mode).toBe('read');
  });

  it('requires confirmation and selects the next page after deletion', async () => {
    component.confirmDelete();
    expect(store.remove).not.toHaveBeenCalled();
    confirmations.next(false);
    expect(store.remove).not.toHaveBeenCalled();
    component.confirmDelete();
    confirmations.next(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.selected?.id).toBe('two');
  });

  it('retains the edit buffer and shows an error if saving fails', async () => {
    store.publish.and.rejectWith(new Error('Write failed'));
    component.edit();
    component.draftBody = '## À conserver';
    await component.publish();
    expect(component.mode).toBe('edit');
    expect(component.draftBody).toBe('## À conserver');
    expect(component.operationError).toBeTruthy();
    expect(component.notice).toBe('');
  });

  it('navigates from the rendered contents to sanitized headings, including duplicate titles and a new selection', async () => {
    entries[0].body = '# Introduction\n\n## Repères\n\nPremier chapitre.\n\n### Détail\n\n## Repères\n\nDeuxième chapitre.';
    entries[1].body = '# Autre page\n\n## Chapitre suivant';
    const fixture = TestBed.createComponent(DocumentationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const chapters = root.querySelectorAll<HTMLElement>('.markdown-content h2');
    expect(chapters[0].id).toBe('repères');
    expect(chapters[1].id).toBe('repères-1');
    const scroll = spyOn(chapters[1], 'scrollIntoView');
    root.querySelectorAll<HTMLAnchorElement>('.table-of-contents a')[1].click();
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    expect(document.activeElement).toBe(chapters[1]);

    fixture.componentInstance.select(entries[1]);
    fixture.detectChanges();
    const next = root.querySelector<HTMLElement>('.markdown-content h2')!;
    expect(next.id).toBe('chapitre-suivant');
    const nextScroll = spyOn(next, 'scrollIntoView');
    root.querySelector<HTMLAnchorElement>('.table-of-contents a')!.click();
    expect(nextScroll).toHaveBeenCalled();
  });
});
