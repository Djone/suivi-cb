export interface DocumentationEntry {
  id: string;
  category: string;
  title: string;
  summary: string;
  owner: string;
  updated: string;
  body: string;
  status: 'draft' | 'published';
  sourcePath?: string;
  revision: string;
}
