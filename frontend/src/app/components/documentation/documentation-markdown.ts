import { Marked, Renderer } from 'marked';
import { DocumentationEntry } from './documentation.model';

export interface DocumentationHeading { id: string; title: string }

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function headingSlug(value: string): string {
  return value.toLowerCase().replace(/<[^>]*>/g, '').replace(/[*_`]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-') || 'section';
}

/** No trusted HTML bypass: Angular also sanitizes the resulting innerHTML. */
export function renderDocumentation(document: DocumentationEntry, documents: DocumentationEntry[]): {
  html: string; headings: DocumentationHeading[]; anchors: DocumentationHeading[];
} {
  const headings: DocumentationHeading[] = [];
  const anchors: DocumentationHeading[] = [];
  const seen = new Map<string, number>();
  const renderer = new Renderer();
  renderer.heading = function ({ tokens, depth, text }) {
    const base = headingSlug(text);
    const occurrence = seen.get(base) || 0;
    seen.set(base, occurrence + 1);
    const id = occurrence ? `${base}-${occurrence}` : base;
    anchors.push({ id, title: text.replace(/[*_`]/g, '') });
    if (depth === 2) headings.push({ id, title: text.replace(/[*_`]/g, '') });
    return `<h${depth} id="${escapeHtml(id)}" tabindex="-1">${this.parser.parseInline(tokens)}</h${depth}>\n`;
  };
  // Raw HTML in repository docs is shown as text, never executed.
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.checkbox = ({ checked }) => `<span role="img" aria-label="${checked ? 'Tâche terminée' : 'Tâche à faire'}">${checked ? '☑' : '☐'}</span> `;
  renderer.link = function ({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    if (href.startsWith('#')) return `<a href="${escapeHtml(href)}">${label}</a>`;
    if (/^(https?:|mailto:)/i.test(href)) {
      return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`;
    }
    // Reject unsupported schemes, network paths, and links outside docs.
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return label;
    try {
      const resolved = new URL(href, `https://documentation.invalid/docs/${document.sourcePath || 'note.md'}`);
      const sourcePath = decodeURIComponent(resolved.pathname).replace(/^\/docs\//, '');
      const target = documents.find((entry) => entry.sourcePath === sourcePath);
      if (target) return `<a href="/documentation?page=${encodeURIComponent(target.id)}${escapeHtml(resolved.hash)}">${label}</a>`;
    } catch { /* A malformed or unavailable repository link remains readable. */ }
    return `<span title="Lien vers un fichier du dépôt non exposé dans la documentation">${label}</span>`;
  };
  // The repository has no documentation image asset pipeline yet.
  renderer.image = ({ text }) => `<span>${escapeHtml(text)}</span>`;
  const marked = new Marked({ renderer, gfm: true, async: false });
  const html = marked.parse(document.body, { async: false });
  return { html, headings, anchors };
}
