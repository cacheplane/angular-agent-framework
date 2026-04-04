import { ApiRefTable, type ApiEntry } from '../../components/docs/ApiRefTable';

// Placeholder entries — replaced by generated api-docs.json in Task W9
const ENTRIES: ApiEntry[] = [
  {
    name: 'streamResource()',
    type: 'function',
    description: 'Creates a streaming resource connected to a LangGraph agent. Must be called within an Angular injection context.',
    params: [
      { name: 'assistantId', type: 'string', desc: 'Agent or graph identifier.' },
      { name: 'apiUrl', type: 'string', desc: 'LangGraph Platform base URL.' },
      { name: 'threadId', type: 'Signal<string | null> | string | null', desc: 'Thread to connect to. Pass a signal for reactive updates.' },
      { name: 'onThreadId', type: '(id: string) => void', desc: 'Called when a new thread is auto-created.' },
    ],
  },
  {
    name: 'provideStreamResource()',
    type: 'function',
    description: 'Angular provider factory. Registers global defaults for apiUrl and transport.',
    params: [
      { name: 'config', type: 'StreamResourceConfig', desc: 'Global config merged with per-call options.' },
    ],
  },
];

export default function ApiReferencePage() {
  return (
    <div className="pt-24 px-8 py-16 max-w-4xl mx-auto" style={{ background: 'var(--gradient-bg-flow)', minHeight: '100vh' }}>
      <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--color-accent)' }}>API Reference</p>
      <h1
        style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 800,
          fontSize: 'clamp(32px, 4vw, 56px)',
          color: 'var(--color-text-primary)',
          marginBottom: 48,
        }}>
        API Reference
      </h1>
      <ApiRefTable entries={ENTRIES} />
    </div>
  );
}
