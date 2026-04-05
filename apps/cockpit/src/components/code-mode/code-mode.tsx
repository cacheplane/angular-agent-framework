'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CodeModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  backendAssetPaths: readonly string[];
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
}

const getTabLabel = (path: string): string => path.split('/').pop() ?? path;

function CodeFileContent({ path, content }: { path: string; content: string | undefined }) {
  if (!content) {
    return <p className="text-sm text-[var(--ds-text-muted)]">No source available for {getTabLabel(path)}</p>;
  }

  return (
    <div className="code-mode-block" style={{
      borderRadius: 8,
      border: '1px solid var(--ds-glass-border)',
      boxShadow: 'var(--ds-glass-shadow)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        background: 'rgba(26, 27, 38, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '0.7rem', color: '#a9b1d6' }}>{path}</span>
        <button
          aria-label={`Copy ${getTabLabel(path)}`}
          onClick={() => {
            const el = document.querySelector(`[data-code-path="${CSS.escape(path)}"] pre code`);
            if (el) navigator.clipboard.writeText(el.textContent ?? '');
          }}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: '#4A527A',
            fontSize: '0.65rem',
            cursor: 'pointer',
          }}
        >Copy</button>
      </div>
      <div data-code-path={path} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

export function CodeMode({ entryTitle, codeAssetPaths, backendAssetPaths, codeFiles, promptFiles }: CodeModeProps) {
  const promptPaths = Object.keys(promptFiles);
  const allPaths = [...codeAssetPaths, ...backendAssetPaths, ...promptPaths];

  if (allPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No files available for {entryTitle}.</p>
      </section>
    );
  }

  const defaultPath = codeAssetPaths[0] ?? backendAssetPaths[0] ?? promptPaths[0];

  return (
    <section aria-label="Code mode" className="h-full flex flex-col">
      <Tabs defaultValue={defaultPath} className="flex flex-col h-full">
        <TabsList className="shrink-0">
          {codeAssetPaths.map((path) => (
            <TabsTrigger key={path} value={path}>
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
          {backendAssetPaths.map((path) => (
            <TabsTrigger key={path} value={path}>
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
          {promptPaths.map((path) => (
            <TabsTrigger key={path} value={path} className="text-[var(--ds-accent)]/70 data-[state=active]:text-[var(--ds-accent)]">
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
        </TabsList>

        {[...codeAssetPaths, ...backendAssetPaths].map((path) => (
          <TabsContent key={path} value={path} className="flex-1 overflow-auto mt-4">
            <CodeFileContent path={path} content={codeFiles[path]} />
          </TabsContent>
        ))}

        {promptPaths.map((path) => {
          const content = promptFiles[path];
          return (
            <TabsContent key={path} value={path} className="flex-1 overflow-auto mt-4">
              {content ? (
                <pre className="font-mono text-sm whitespace-pre-wrap">{content}</pre>
              ) : (
                <p className="text-sm text-[var(--ds-text-muted)]">No content for {getTabLabel(path)}</p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
