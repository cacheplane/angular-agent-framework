export interface DocsPage {
  title: string;
  slug: string;
  section: string;
}

export interface DocsSection {
  title: string;
  id: string;
  color: 'blue' | 'red';
  pages: DocsPage[];
}

export const docsConfig: DocsSection[] = [
  {
    title: 'Getting Started',
    id: 'getting-started',
    color: 'blue',
    pages: [
      { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
      { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
      { title: 'Installation', slug: 'installation', section: 'getting-started' },
    ],
  },
  {
    title: 'Guides',
    id: 'guides',
    color: 'blue',
    pages: [
      { title: 'Streaming', slug: 'streaming', section: 'guides' },
      { title: 'Persistence', slug: 'persistence', section: 'guides' },
      { title: 'Interrupts', slug: 'interrupts', section: 'guides' },
      { title: 'Memory', slug: 'memory', section: 'guides' },
      { title: 'Time Travel', slug: 'time-travel', section: 'guides' },
      { title: 'Subgraphs', slug: 'subgraphs', section: 'guides' },
      { title: 'Testing', slug: 'testing', section: 'guides' },
      { title: 'Deployment', slug: 'deployment', section: 'guides' },
    ],
  },
  {
    title: 'Concepts',
    id: 'concepts',
    color: 'red',
    pages: [
      { title: 'Angular Signals', slug: 'angular-signals', section: 'concepts' },
      { title: 'LangGraph Basics', slug: 'langgraph-basics', section: 'concepts' },
      { title: 'Agent Architecture', slug: 'agent-architecture', section: 'concepts' },
      { title: 'State Management', slug: 'state-management', section: 'concepts' },
    ],
  },
  {
    title: 'API Reference',
    id: 'api',
    color: 'blue',
    pages: [
      { title: 'agent()', slug: 'angular', section: 'api' },
      { title: 'provideAgent()', slug: 'provide-angular', section: 'api' },
      { title: 'FetchStreamTransport', slug: 'fetch-stream-transport', section: 'api' },
      { title: 'MockAgentTransport', slug: 'mock-stream-transport', section: 'api' },
    ],
  },
];

export const allDocsPages: DocsPage[] = docsConfig.flatMap((s) => s.pages);

export function findDocsPage(section: string, slug: string): DocsPage | undefined {
  return allDocsPages.find((p) => p.section === section && p.slug === slug);
}

export function getPrevNextPages(section: string, slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const idx = allDocsPages.findIndex((p) => p.section === section && p.slug === slug);
  return {
    prev: idx > 0 ? allDocsPages[idx - 1] : null,
    next: idx < allDocsPages.length - 1 ? allDocsPages[idx + 1] : null,
  };
}

export function getDocsSection(sectionId: string): DocsSection | undefined {
  return docsConfig.find((s) => s.id === sectionId);
}
