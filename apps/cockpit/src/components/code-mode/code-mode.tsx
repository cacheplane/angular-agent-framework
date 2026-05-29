'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { track } from '../../lib/analytics/client';

interface CodeModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  backendAssetPaths: readonly string[];
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
  capability?: string;
}

const getTabLabel = (path: string): string => path.split('/').pop() ?? path;

function CodeFileContent({
  path,
  content,
  capability,
}: {
  path: string;
  content: string | undefined;
  capability?: string;
}) {
  if (!content) {
    return <p className="text-sm text-[var(--ds-text-muted)]">No source available for {getTabLabel(path)}</p>;
  }

  const label = getTabLabel(path);
  const dotIdx = label.lastIndexOf('.');
  const ext = dotIdx > 0 ? label.slice(dotIdx + 1).toUpperCase() : '';

  return (
    <div className="doc-codeblock">
      <div className="doc-codeblock__header">
        <span className="doc-codeblock__file">{label}</span>
        {ext ? <span className="doc-codeblock__lang">{ext}</span> : null}
        <button
          className="doc-codeblock__copy"
          aria-label={`Copy ${label}`}
          onClick={() => {
            track('cockpit:code_copied', { capability, surface: 'code_mode', file_path: path });
            const el = document.querySelector(`[data-code-path="${CSS.escape(path)}"] pre code`);
            if (el) navigator.clipboard.writeText(el.textContent ?? '');
          }}
        >Copy</button>
      </div>
      <div data-code-path={path} dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

export function CodeMode({ entryTitle, codeAssetPaths, backendAssetPaths, codeFiles, promptFiles, capability }: CodeModeProps) {
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
          <TabsContent key={path} value={path} className="flex-1 overflow-auto">
            <CodeFileContent path={path} content={codeFiles[path]} capability={capability} />
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
