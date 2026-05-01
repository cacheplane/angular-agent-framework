import Link from 'next/link';
import { docsConfig } from '../../lib/docs-config';
import { tokens } from '@ngaf/design-tokens';

export default function DocsLandingPage() {
  return (
    <div className="min-h-screen pt-24 px-6 md:px-12" style={{ background: 'var(--gradient-bg-flow)' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="font-garamond text-4xl md:text-5xl font-bold mb-4" style={{ color: tokens.colors.textPrimary }}>
          Documentation
        </h1>
        <p className="text-lg mb-12" style={{ color: tokens.colors.textSecondary }}>
          Angular Agent Framework is a suite of libraries for building AI agent interfaces.
          Choose a library to get started.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {docsConfig.map((lib) => (
            <Link
              key={lib.id}
              href={`/docs/${lib.id}/getting-started/introduction`}
              className="block p-6 rounded-xl transition-all"
              style={{
                background: tokens.glass.bg,
                backdropFilter: `blur(${tokens.glass.blur})`,
                WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                border: `1px solid ${tokens.glass.border}`,
              }}
            >
              <h2 className="font-mono text-lg font-semibold mb-2" style={{ color: tokens.colors.accent }}>
                {lib.title}
              </h2>
              <p className="text-sm" style={{ color: tokens.colors.textSecondary }}>
                {lib.description}
              </p>
              <div className="mt-4 text-sm font-mono" style={{ color: tokens.colors.accent }}>
                Get started &rarr;
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
