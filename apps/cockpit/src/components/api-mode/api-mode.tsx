import React from 'react';
import type { DocSection } from '../../lib/extract-docs';

interface ApiModeProps {
  docSections: DocSection[];
  hasCodeFiles?: boolean;
}

function renderInlineCode(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'var(--ds-accent-surface)',
            color: 'var(--ds-accent)',
          }}
          className="px-1 py-0.5 rounded text-[0.85em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function DocArticle({ section }: { section: DocSection }) {
  return (
    <article
      className="mb-6 rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--ds-accent-border)',
        cursor: 'default',
      }}
    >
      <div
        className="px-4 py-3 border-b border-[var(--ds-accent-border)]"
        style={{
          background: 'var(--ds-accent-surface)',
        }}
      >
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold font-mono" style={{ color: 'var(--ds-text-primary)' }}>
            {section.title}
          </h4>
          <span className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
            {section.sourceFile}
          </span>
        </div>
        <pre className="mt-1.5 text-xs font-mono overflow-x-auto" style={{ color: 'var(--ds-accent)' }}>
          <code>{section.signature}</code>
        </pre>
      </div>

      <div className="px-4 py-3 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ds-text-secondary)' }}>
          {renderInlineCode(section.description)}
        </p>

        {section.params.length > 0 ? (
          <div>
            <h5 className="text-xs font-mono uppercase tracking-wide mb-1.5" style={{ color: 'var(--ds-text-muted)' }}>
              Parameters
            </h5>
            <table className="params w-full text-sm">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: 'var(--ds-text-muted)' }}>Parameter</th>
                  <th style={{ textAlign: 'left', color: 'var(--ds-text-muted)' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {section.params.map((param) => (
                  <tr key={param.name}>
                    <td style={{ verticalAlign: 'top', paddingRight: '1rem' }}>
                      <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--ds-accent-surface)', color: 'var(--ds-accent)' }}>
                        {param.name}
                      </code>
                    </td>
                    <td style={{ verticalAlign: 'top', color: 'var(--ds-text-muted)' }}>
                      {renderInlineCode(param.description)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {section.returns ? (
          <div>
            <h5
              className="text-xs font-mono uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--ds-text-muted)' }}
            >
              Returns
            </h5>
            <p className="text-sm" style={{ color: 'var(--ds-text-muted)' }}>
              {renderInlineCode(section.returns)}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ApiMode({ docSections, hasCodeFiles = false }: ApiModeProps) {
  if (docSections.length === 0) {
    return (
      <section aria-label="API mode" className="grid place-items-center h-full text-sm px-6 text-center">
        <p style={{ color: 'var(--ds-text-muted)' }}>
          {hasCodeFiles
            ? 'Add JSDoc comments to your TypeScript files or docstrings to your Python files to see API documentation here.'
            : 'No API documentation extracted yet — add JSDoc to TypeScript files or docstrings to Python files.'}
        </p>
      </section>
    );
  }

  const LANGUAGE_LABELS: Record<string, string> = {
    typescript: 'TypeScript',
    python: 'Python',
  };

  const tsSections = docSections.filter((s) => s.language === 'typescript');
  const pySections = docSections.filter((s) => s.language === 'python');

  return (
    <section aria-label="API mode" className="h-full overflow-auto py-4 px-4 md:px-8">
      <div className="cockpit-prose" style={{ maxWidth: '48rem' }}>
        {tsSections.length > 0 ? (
          <div>
            <h3
              className="text-xs font-mono uppercase tracking-wide mb-3"
              style={{ color: 'var(--ds-accent)' }}
            >
              {LANGUAGE_LABELS[tsSections[0]?.language] ?? 'TypeScript'}
            </h3>
            {tsSections.map((section) => (
              <DocArticle key={`${section.sourceFile}:${section.title}`} section={section} />
            ))}
          </div>
        ) : null}

        {pySections.length > 0 ? (
          <div>
            <h3
              className="text-xs font-mono uppercase tracking-wide mb-3"
              style={{ color: 'var(--ds-accent)' }}
            >
              {LANGUAGE_LABELS[pySections[0]?.language] ?? 'Python'}
            </h3>
            {pySections.map((section) => (
              <DocArticle key={`${section.sourceFile}:${section.title}`} section={section} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
