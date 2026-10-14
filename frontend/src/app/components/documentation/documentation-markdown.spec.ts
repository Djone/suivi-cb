import { DocumentationEntry } from './documentation.model';
import { renderDocumentation } from './documentation-markdown';

const entry: DocumentationEntry = {
  id: 'docs/start.md', sourcePath: 'start.md', category: 'Modes opératoires', title: 'Guide',
  summary: '', owner: 'Équipe', updated: '', status: 'published', body: '', revision: 'a'.repeat(64),
};

describe('Documentation Markdown', () => {
  it('renders repository formats and ignores code headings in the contents', () => {
    const rendered = renderDocumentation({ ...entry, body: '## Contrôles\n\n## Contrôles\n\n- [x] Test passé\n- [ ] À faire\n\n> Information\n\n| Nom | Résultat |\n| --- | --- |\n| Test | OK |\n\n```sh\n## Ceci est du code\necho hello\n```' }, []);
    expect(rendered.headings).toEqual([{ id: 'contrôles', title: 'Contrôles' }, { id: 'contrôles-1', title: 'Contrôles' }]);
    expect(rendered.html).toContain('<table>');
    expect(rendered.html).toContain('<blockquote>');
    expect(rendered.html).toContain('<pre><code');
    expect(rendered.html).toContain('Tâche terminée');
    expect(rendered.html).toContain('Tâche à faire');
  });

  it('resolves relative links across nested documentation directories', () => {
    const target = { ...entry, id: 'docs/release.md', sourcePath: 'release.md' };
    const rendered = renderDocumentation({ ...entry, sourcePath: 'nas/start.md', body: '[Release](../release.md#contrôles)' }, [target]);
    expect(rendered.html).toContain('/documentation?page=docs%2Frelease.md#contr%C3%B4les');
  });

  it('escapes executable HTML and rejects unsafe schemes and outside repository paths', () => {
    const rendered = renderDocumentation({ ...entry, body: '<script>alert(1)</script>\n\n[Dangereux](javascript:alert)\n\n[Secret](../.env)\n\n[Web](https://example.org)' }, []);
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('href="javascript:');
    expect(rendered.html).not.toContain('href="../.env');
    expect(rendered.html).toContain('href="https://example.org"');
  });
});
