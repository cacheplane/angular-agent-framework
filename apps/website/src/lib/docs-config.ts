export type LibraryId =
  | 'langgraph'
  | 'render'
  | 'chat'
  | 'ag-ui'
  | 'a2ui'
  | 'licensing'
  | 'telemetry';

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

export interface DocsLibrary {
  id: LibraryId;
  title: string;
  description: string;
  sections: DocsSection[];
}

export const docsConfig: DocsLibrary[] = [
  {
    id: 'langgraph',
    title: 'LangGraph',
    description: 'LangChain/LangGraph adapter for Angular UI',
    sections: [
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
          { title: 'Lifecycle Signals', slug: 'lifecycle', section: 'guides' },
        ],
      },
      {
        title: 'Concepts',
        id: 'concepts',
        color: 'red',
        pages: [
          { title: 'Agent Contract', slug: 'agent-contract', section: 'concepts' },
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
          { title: 'injectAgent()', slug: 'inject-agent', section: 'api' },
          { title: 'provideAgent()', slug: 'provide-agent', section: 'api' },
          { title: 'FetchStreamTransport', slug: 'fetch-stream-transport', section: 'api' },
          { title: 'MockAgentTransport', slug: 'mock-stream-transport', section: 'api' },
        ],
      },
    ],
  },
  {
    id: 'render',
    title: 'Render',
    description: 'Declarative UI rendering from JSON specifications',
    sections: [
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
          { title: 'Component Registry', slug: 'registry', section: 'guides' },
          { title: 'State Store', slug: 'state-store', section: 'guides' },
          { title: 'Specs & Elements', slug: 'specs', section: 'guides' },
          { title: 'Events & Handlers', slug: 'events', section: 'guides' },
          { title: 'Lifecycle Signals', slug: 'lifecycle', section: 'guides' },
        ],
      },
      {
        title: 'Concepts',
        id: 'concepts',
        color: 'red',
        pages: [
          { title: 'JSON Render vs A2UI', slug: 'json-render-vs-a2ui', section: 'concepts' },
        ],
      },
      {
        title: 'A2UI',
        id: 'a2ui',
        color: 'red',
        pages: [
          { title: 'Overview', slug: 'overview', section: 'a2ui' },
          { title: 'A2uiSurfaceComponent', slug: 'surface-component', section: 'a2ui' },
          { title: 'createA2uiSurfaceStore()', slug: 'surface-store', section: 'a2ui' },
          { title: 'Component Catalog', slug: 'catalog', section: 'a2ui' },
        ],
      },
      {
        title: 'API Reference',
        id: 'api',
        color: 'blue',
        pages: [
          { title: 'RenderSpecComponent', slug: 'render-spec-component', section: 'api' },
          { title: 'defineAngularRegistry()', slug: 'define-angular-registry', section: 'api' },
          { title: 'views()', slug: 'views', section: 'api' },
          { title: 'signalStateStore()', slug: 'signal-state-store', section: 'api' },
          { title: 'provideRender()', slug: 'provide-render', section: 'api' },
        ],
      },
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    description: 'Pre-built chat UI components for agent interfaces',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
          { title: 'Installation', slug: 'installation', section: 'getting-started' },
          { title: 'Changelog', slug: 'changelog', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Layout Modes', slug: 'layout-modes', section: 'guides' },
          { title: 'Theming', slug: 'theming', section: 'guides' },
          { title: 'Markdown Rendering', slug: 'markdown', section: 'guides' },
          { title: 'Generative UI', slug: 'generative-ui', section: 'guides' },
          { title: 'Custom A2UI Catalogs', slug: 'custom-catalogs', section: 'guides' },
          { title: 'Streaming', slug: 'streaming', section: 'guides' },
          { title: 'Configuration', slug: 'configuration', section: 'guides' },
          { title: 'Writing an Adapter', slug: 'writing-an-adapter', section: 'guides' },
          { title: 'Lifecycle Signals', slug: 'lifecycle', section: 'guides' },
        ],
      },
      {
        title: 'Concepts',
        id: 'concepts',
        color: 'red',
        pages: [
          { title: 'Primitives vs Compositions', slug: 'primitives-vs-compositions', section: 'concepts' },
          { title: 'Message Model', slug: 'message-model', section: 'concepts' },
        ],
      },
      {
        title: 'Components',
        id: 'components',
        color: 'red',
        pages: [
          { title: 'ChatComponent', slug: 'chat', section: 'components' },
          { title: 'ChatPopup', slug: 'chat-popup', section: 'components' },
          { title: 'ChatSidebar', slug: 'chat-sidebar', section: 'components' },
          { title: 'ChatMessageList', slug: 'chat-message-list', section: 'components' },
          { title: 'ChatTrace', slug: 'chat-trace', section: 'components' },
          { title: 'ChatInput', slug: 'chat-input', section: 'components' },
          { title: 'ChatReasoning', slug: 'chat-reasoning', section: 'components' },
          { title: 'ChatInterruptPanel', slug: 'chat-interrupt-panel', section: 'components' },
          { title: 'ChatToolCalls', slug: 'chat-tool-calls', section: 'components' },
          { title: 'chatToolCallTemplate', slug: 'chat-tool-call-template', section: 'components' },
          { title: 'ChatToolCallCard', slug: 'chat-tool-call-card', section: 'components' },
          { title: 'ChatSubagentCard', slug: 'chat-subagent-card', section: 'components' },
          { title: 'ChatDebug', slug: 'chat-debug', section: 'components' },
          { title: 'ChatSelect', slug: 'chat-select', section: 'components' },
        ],
      },
      {
        title: 'API Reference',
        id: 'api',
        color: 'blue',
        pages: [
          { title: 'provideChat()', slug: 'provide-chat', section: 'api' },
          { title: 'ChatConfig', slug: 'chat-config', section: 'api' },
          { title: 'mockAgent()', slug: 'mock-agent', section: 'api' },
          { title: 'createContentClassifier()', slug: 'content-classifier', section: 'api' },
          { title: 'createParseTreeStore()', slug: 'parse-tree-store', section: 'api' },
        ],
      },
    ],
  },
  {
    id: 'ag-ui',
    title: 'AG-UI',
    description: 'Adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    sections: [
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
        title: 'Concepts',
        id: 'concepts',
        color: 'red',
        pages: [
          { title: 'Architecture', slug: 'architecture', section: 'concepts' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Fake Agent', slug: 'fake-agent', section: 'guides' },
          { title: 'Citations', slug: 'citations', section: 'guides' },
          { title: 'Interrupts', slug: 'interrupts', section: 'guides' },
          { title: 'Testing', slug: 'testing', section: 'guides' },
          { title: 'Troubleshooting', slug: 'troubleshooting', section: 'guides' },
        ],
      },
      {
        title: 'Reference',
        id: 'reference',
        color: 'blue',
        pages: [
          { title: 'Event Mapping', slug: 'event-mapping', section: 'reference' },
        ],
      },
    ],
  },
  {
    id: 'a2ui',
    title: 'A2UI',
    description: 'Protocol types and helpers for agent-driven UI surfaces',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Message Protocol', slug: 'message-protocol', section: 'guides' },
          { title: 'Data Model', slug: 'data-model', section: 'guides' },
          { title: 'Validating & Adapting', slug: 'adapters-and-validation', section: 'guides' },
        ],
      },
      {
        title: 'Reference',
        id: 'reference',
        color: 'blue',
        pages: [
          { title: 'Schema', slug: 'schema', section: 'reference' },
          { title: 'Parser, Resolver, and Guards', slug: 'parser-resolver-guards', section: 'reference' },
        ],
      },
    ],
  },
  {
    id: 'licensing',
    title: 'Licensing',
    description: 'License token verification and package check behavior',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Setup', slug: 'setup', section: 'guides' },
          { title: 'CI and Offline', slug: 'ci-and-offline', section: 'guides' },
        ],
      },
      {
        title: 'Reference',
        id: 'reference',
        color: 'blue',
        pages: [
          { title: 'API', slug: 'api', section: 'reference' },
        ],
      },
    ],
  },
  {
    id: 'telemetry',
    title: 'Telemetry',
    description: 'Browser and Node telemetry setup, privacy controls, and events',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Browser', slug: 'browser', section: 'guides' },
          { title: 'Node', slug: 'node', section: 'guides' },
          { title: 'Privacy and Opt-Out', slug: 'privacy-and-opt-out', section: 'guides' },
        ],
      },
      {
        title: 'Reference',
        id: 'reference',
        color: 'blue',
        pages: [
          { title: 'Events', slug: 'events', section: 'reference' },
        ],
      },
    ],
  },
];

export function getLibraryConfig(libraryId: string): DocsLibrary | undefined {
  return docsConfig.find((l) => l.id === libraryId);
}

export function getLibraryPages(libraryId: string): DocsPage[] {
  const lib = getLibraryConfig(libraryId);
  if (!lib) return [];
  return lib.sections.flatMap((s) => s.pages);
}

export const allDocsPages: DocsPage[] = docsConfig.flatMap((l) =>
  l.sections.flatMap((s) => s.pages)
);

export function findDocsPage(library: string, section: string, slug: string): DocsPage | undefined {
  return getLibraryPages(library).find((p) => p.section === section && p.slug === slug);
}

export function getPrevNextPages(library: string, section: string, slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const pages = getLibraryPages(library);
  const idx = pages.findIndex((p) => p.section === section && p.slug === slug);
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx < pages.length - 1 ? pages[idx + 1] : null,
  };
}

export function getDocsSection(library: string, sectionId: string): DocsSection | undefined {
  const lib = getLibraryConfig(library);
  return lib?.sections.find((s) => s.id === sectionId);
}
