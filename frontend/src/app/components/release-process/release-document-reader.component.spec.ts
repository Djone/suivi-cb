import { TestBed } from '@angular/core/testing';
import { ReleaseDocumentReaderComponent } from './release-document-reader.component';
import { DocumentationEntry } from '../documentation/documentation.model';

describe('ReleaseDocumentReaderComponent', () => {
  const entry: DocumentationEntry = { id: 'docs/reader.md', category: 'Tests', title: 'Guide', summary: '', owner: 'Équipe', updated: '2026-10-09', status: 'published', revision: 'a'.repeat(64), body: '[Section](#section)\n\n## Section\n\n- [x] Vérifié\n\n> Attention\n\n```sh\necho test\n```\n\n| Colonne |\n| --- |\n| Valeur |\n\n[Autre](other.md)\n\n<script>alert(1)</script>' };

  it('renders Markdown safely and navigates headings after Angular sanitization', () => {
    const fixture = TestBed.createComponent(ReleaseDocumentReaderComponent);
    fixture.componentRef.setInput('document', entry);
    fixture.componentRef.setInput('documents', [entry]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const heading = element.querySelector('h2')!;
    expect(heading.id).toBe('release-document-section');
    const scroll = spyOn(heading, 'scrollIntoView');
    (element.querySelector('a') as HTMLAnchorElement).click();
    expect(scroll).toHaveBeenCalled(); expect(document.activeElement).toBe(heading);
    expect(element.querySelector('table')).not.toBeNull();
    expect(element.querySelector('pre code')?.textContent).toContain('echo test');
    expect(element.querySelector('blockquote')).not.toBeNull();
    expect(element.querySelector('script')).toBeNull();
    fixture.destroy();
  });

  it('opens linked project documents inside the reader', () => {
    const fixture = TestBed.createComponent(ReleaseDocumentReaderComponent);
    const other = { ...entry, id: 'docs/other.md', sourcePath: 'docs/other.md', title: 'Autre' };
    fixture.componentRef.setInput('document', { ...entry, sourcePath: 'docs/reader.md' });
    fixture.componentRef.setInput('documents', [entry, other]); fixture.detectChanges();
    const navigate = spyOn(fixture.componentInstance.navigateDocument, 'emit');
    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find((anchor) => anchor.textContent === 'Autre')!;
    link.click(); expect(navigate).toHaveBeenCalledWith(other); fixture.destroy();
  });
});
