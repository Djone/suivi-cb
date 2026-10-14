import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { DocumentationEntry } from '../documentation/documentation.model';
import { DocumentationHeading, renderDocumentation } from '../documentation/documentation-markdown';
@Component({
  selector: 'app-release-document-reader', standalone: true,
  template: '<article #content class="reader-article" [innerHTML]="html" (click)="followLink($event)"></article>',
  styles: `
    :host { display: block; min-width: 0; }
    :host ::ng-deep .reader-article { color: #334155; line-height: 1.85; overflow-wrap: anywhere; max-width: 76ch; }
    :host ::ng-deep .reader-article h1, :host ::ng-deep .reader-article h2, :host ::ng-deep .reader-article h3 { line-height: 1.4; color: #172033; scroll-margin-top: 1rem; }
    :host ::ng-deep .reader-article h2 { font-size: 20px; border-bottom: 1px solid var(--surface-200); padding-bottom: .6rem; margin-top: 1.8rem; }
    :host ::ng-deep .reader-article h3 { font-size: 16px; }
    :host ::ng-deep .reader-article a { color: #1d4ed8; text-underline-offset: 3px; }
    :host ::ng-deep .reader-article a:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
    :host ::ng-deep .reader-article blockquote { margin: 1rem 0; padding: .5rem 1rem; border-left: 3px solid #2563eb; background: #eff6ff; }
    :host ::ng-deep .reader-article pre { overflow: auto; padding: 1rem; border-radius: 8px; border: 1px solid var(--surface-200); background: #f8fafc; white-space: pre; font-size: 12px; }
    :host ::ng-deep .reader-article code { font-family: var(--font-data); background: #f1f5f9; }
    :host ::ng-deep .reader-article table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 12px; }
    :host ::ng-deep .reader-article th, :host ::ng-deep .reader-article td { padding: .7rem; border: 1px solid var(--surface-200); text-align: left; }
    :host ::ng-deep .reader-article th { background: var(--surface-100); }
  `,
})
export class ReleaseDocumentReaderComponent implements OnChanges, AfterViewChecked {
  @Input({ required: true }) document!: DocumentationEntry;
  @Input() documents: DocumentationEntry[] = [];
  @Output() navigateDocument = new EventEmitter<DocumentationEntry>();
  @ViewChild('content') content?: ElementRef<HTMLElement>;
  html = '';
  private anchors: DocumentationHeading[] = [];
  private lastHtml?: string;
  private pendingAnchor: string | null = null;
  ngOnChanges(): void {
    const rendered = renderDocumentation(this.document, this.documents);
    this.html = rendered.html;
    this.anchors = rendered.anchors;
  }
  ngAfterViewChecked(): void {
    if (!this.content) return;
    if (this.lastHtml !== this.html) {
      this.content.nativeElement.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6').forEach((heading, index) => {
        if (this.anchors[index]) { heading.id = `release-document-${this.anchors[index].id}`; heading.tabIndex = -1; }
      });
      this.lastHtml = this.html;
    }
    if (this.pendingAnchor !== null) {
      this.scrollToAnchor(this.pendingAnchor);
      this.pendingAnchor = null;
    }
  }
  private scrollToAnchor(fragment: string): void {
    let id: string;
    try { id = `release-document-${decodeURIComponent(fragment)}`; } catch { return; }
    const target = Array.from(this.content?.nativeElement.querySelectorAll<HTMLElement>('[id]') || []).find((heading) => heading.id === id);
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }
  followLink(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href') || '';
    if (href.startsWith('#')) {
      event.preventDefault();
      this.scrollToAnchor(href.slice(1));
    } else if (href.startsWith('/documentation?')) {
      event.preventDefault();
      const url = new URL(href, 'https://documentation.invalid');
      const entry = this.documents.find((document) => document.id === url.searchParams.get('page'));
      if (entry) {
        this.pendingAnchor = url.hash.slice(1);
        this.navigateDocument.emit(entry);
      }
    }
  }
}
