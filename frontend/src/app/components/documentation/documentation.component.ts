import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subscription, take } from 'rxjs';
import { DocumentationService } from '../../services/documentation.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { DocumentationEntry } from './documentation.model';
import { DocumentationHeading, renderDocumentation } from './documentation-markdown';

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule],
  templateUrl: './documentation.component.html',
  styleUrls: ['./documentation.component.css'],
})
export class DocumentationComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly store = inject(DocumentationService);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private dialog?: DynamicDialogRef | null;
  @ViewChild('bodyEditor') bodyEditor?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('documentContent') documentContent?: ElementRef<HTMLElement>;
  selectedId = '';
  query = '';
  loading = true;
  saving = false;
  operationError = '';
  error = '';
  mode: 'read' | 'edit' = 'read';
  draftTitle = '';
  draftBody = '';
  draftSummary = '';
  draftCategory = 'Notes d’équipe';
  renderedBody = '';
  headings: DocumentationHeading[] = [];
  private headingAnchors: DocumentationHeading[] = [];
  private anchoredContent?: HTMLElement;
  private anchoredBody = '';
  notice = '';
  readonly tools = [
    { label: 'Titre', syntax: '## ' }, { label: 'Sous-titre', syntax: '### ' },
    { label: 'Liste', syntax: '- ' }, { label: 'Checklist', syntax: '- [ ] ' },
    { label: 'Encadré', syntax: '> ' }, { label: 'Étape', syntax: '1. ' },
  ];

  get selected(): DocumentationEntry | undefined {
    return this.store.documents().find((entry) => entry.id === this.selectedId);
  }

  get categories(): string[] {
    return [...new Set(['Modes opératoires', 'Référentiels', 'Notes d’équipe', ...this.store.documents().map((entry) => entry.category)])];
  }

  get groups(): { category: string; folders: { path: string; entries: DocumentationEntry[] }[] }[] {
    const normalize = (value: string) => value.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtered = this.store.documents().filter((entry) => normalize(entry.title).includes(normalize(this.query.trim())));
    return this.categories.map((category) => {
      const entries = filtered.filter((entry) => entry.category === category);
      const folders = new Map<string, DocumentationEntry[]>();
      for (const entry of entries) {
        const path = entry.sourcePath?.split('/').slice(0, -1).join('/') || '';
        folders.set(path, [...(folders.get(path) || []), entry]);
      }
      return { category, folders: [...folders].map(([path, entries]) => ({ path, entries })) };
    }).filter((group) => group.folders.length);
  }

  async ngOnInit(): Promise<void> {
    await this.load();
    this.subscriptions.add(this.route.queryParamMap.subscribe((params) => {
      const entry = this.store.documents().find((item) => item.id === params.get('page'));
      if (entry && entry.id !== this.selectedId) this.select(entry);
    }));
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      await this.store.load();
      this.operationError = '';
      this.notice = '';
      const entry = this.store.documents().find((item) => item.id === this.route.snapshot.queryParamMap.get('page')) || this.store.documents()[0];
      if (entry) {
        this.select(entry);
        const fragment = this.route.snapshot.fragment;
        if (fragment) setTimeout(() => this.goToHeading(fragment));
      }
    } catch { this.error = 'Impossible de charger la documentation. Réessayez avant de modifier des pages.'; }
    finally { this.loading = false; }
  }

  select(entry: DocumentationEntry): void {
    this.selectedId = entry.id;
    this.mode = 'read';
    this.resetDraft(entry);
    const rendered = renderDocumentation(entry, this.store.documents());
    this.renderedBody = rendered.html;
    this.headings = rendered.headings;
    this.headingAnchors = rendered.anchors;
  }

  requestSelection(entry: DocumentationEntry): void {
    if (this.saving || entry.id === this.selectedId) return;
    this.withDiscardConfirmation(() => {
      this.select(entry);
      void this.router.navigate([], { relativeTo: this.route, queryParams: { page: entry.id }, replaceUrl: true });
    });
  }

  edit(): void {
    if (!this.selected) return;
    this.resetDraft(this.selected);
    this.mode = 'edit';
  }

  cancel(): void {
    if (this.selected) this.select(this.selected);
  }

  async publish(): Promise<void> {
    if (!this.selected) return;
    await this.runOperation(async () => {
      await this.store.publish(this.selectedId, this.draftTitle, this.draftBody, this.draftSummary, this.draftCategory);
      this.select(this.selected!);
      this.notice = 'Page publiée : le fichier Markdown du dépôt a été enregistré.';
    });
  }

  create(): void {
    this.withDiscardConfirmation(() => this.runOperation(async () => {
      const entry = await this.store.create();
      this.query = '';
      this.select(entry);
      this.mode = 'edit';
      void this.router.navigate([], { relativeTo: this.route, queryParams: { page: entry.id }, replaceUrl: true });
      this.notice = 'Brouillon créé dans le dossier docs du dépôt.';
    }));
  }

  confirmDelete(): void {
    const entry = this.selected;
    if (!entry || this.store.documents().length <= 1) return;
    this.openConfirmation('Supprimer cette page ?',
      `La page « ${entry.title} » et son fichier « ${entry.sourcePath} » seront supprimés physiquement du dépôt. Cette action est irréversible.`,
      'Supprimer définitivement', () => this.runOperation(async () => {
        if (!await this.store.remove(entry.id)) return;
        const next = this.store.documents().find((item) => item.category === entry.category) || this.store.documents()[0];
        this.query = '';
        this.select(next);
        void this.router.navigate([], { relativeTo: this.route, queryParams: { page: next.id }, replaceUrl: true });
        this.notice = 'Page supprimée : le fichier Markdown a été supprimé du dépôt.';
      }));
  }

  insertSyntax(syntax: string): void {
    const editor = this.bodyEditor?.nativeElement;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const prefix = start > 0 && this.draftBody[start - 1] !== '\n' ? '\n' : '';
    this.draftBody = this.draftBody.slice(0, start) + prefix + syntax + this.draftBody.slice(start, end) + this.draftBody.slice(end);
    setTimeout(() => { editor.focus(); editor.setSelectionRange(start + prefix.length + syntax.length, end + prefix.length + syntax.length); });
  }

  followLink(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#')) {
      event.preventDefault();
      this.goToHeading(href.slice(1));
    } else if (href.startsWith('/documentation?')) {
      event.preventDefault();
      const url = new URL(href, 'https://documentation.invalid');
      const entry = this.store.documents().find((item) => item.id === url.searchParams.get('page'));
      if (entry) {
        this.requestSelection(entry);
        if (url.hash) setTimeout(() => this.goToHeading(url.hash.slice(1)));
      }
    }
  }

  ngAfterViewChecked(): void {
    const content = this.documentContent?.nativeElement;
    if (!content || (content === this.anchoredContent && this.renderedBody === this.anchoredBody)) return;
    // Angular strips id/tabindex from innerHTML. Restore only our generated
    // heading anchors on the sanitized DOM, without trusting raw Markdown HTML.
    content.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
      const anchor = this.headingAnchors[index];
      if (anchor) {
        heading.id = anchor.id;
        heading.tabIndex = -1;
      }
    });
    this.anchoredContent = content;
    this.anchoredBody = this.renderedBody;
  }

  goToHeading(id: string): void {
    let decoded = id;
    try { decoded = decodeURIComponent(id); } catch { return; }
    const elements = this.documentContent?.nativeElement.querySelectorAll<HTMLElement>('[id]');
    const target = Array.from(elements || []).find((element) => element.id === decoded);
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }

  formatUpdated(value: string): string {
    if (!value) return 'Non renseignée';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' });
  }

  private resetDraft(entry: DocumentationEntry): void {
    this.draftTitle = entry.title;
    this.draftBody = entry.body;
    this.draftSummary = entry.summary;
    this.draftCategory = entry.category;
  }

  reload(): void {
    this.withDiscardConfirmation(() => this.load());
  }

  private async runOperation(action: () => Promise<void>): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.operationError = '';
    this.notice = '';
    try { await action(); }
    catch (error) {
      this.operationError = error instanceof HttpErrorResponse
        ? (error.error?.error || 'Impossible de joindre le backend de développement. Aucun changement confirmé.')
        : 'Impossible de modifier le document. Aucun changement confirmé.';
    } finally { this.saving = false; }
  }

  private withDiscardConfirmation(action: () => void | Promise<void>): void {
    const entry = this.selected;
    const dirty = this.mode === 'edit' && entry && (this.draftTitle !== entry.title || this.draftBody !== entry.body || this.draftSummary !== entry.summary || this.draftCategory !== entry.category);
    if (dirty) this.openConfirmation('Abandonner les changements ?', 'Les changements non publiés seront perdus.', 'Abandonner', action);
    else void action();
  }

  private openConfirmation(title: string, message: string, confirmText: string, action: () => void | Promise<void>): void {
    this.dialog = this.dialogs.open(ConfirmDialogComponent, {
      header: title, modal: true, closable: true, closeOnEscape: true,
      width: 'min(32rem, calc(100vw - 2rem))',
      data: { title, message, confirmText, cancelText: 'Annuler' },
    });
    if (this.dialog) this.subscriptions.add(this.dialog.onClose.pipe(take(1)).subscribe((confirmed: boolean) => { if (confirmed === true) void action(); }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.dialog?.close();
  }
}
