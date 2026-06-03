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
  const promptPaths = React.useMemo(() => Object.keys(promptFiles), [promptFiles]);
  const allPaths = React.useMemo(
    () => [...codeAssetPaths, ...backendAssetPaths, ...promptPaths],
    [codeAssetPaths, backendAssetPaths, promptPaths],
  );

  const [openPaths, setOpenPaths] = React.useState<readonly string[]>(allPaths);
  const [activePath, setActivePath] = React.useState<string | null>(allPaths[0] ?? null);

  // If the capability changes (allPaths changes identity), reset open + active.
  React.useEffect(() => {
    setOpenPaths(allPaths);
    setActivePath(allPaths[0] ?? null);
  }, [allPaths]);

  if (allPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No files available for {entryTitle}.</p>
      </section>
    );
  }

  const isPromptPath = (path: string) => promptPaths.includes(path);

  return (
    <section aria-label="Code mode" className="h-full flex flex-col">
      <Tabs
        value={activePath ?? undefined}
        onValueChange={(v) => setActivePath(v)}
        className="flex flex-col h-full"
      >
        <TabsList className="shrink-0">
          {openPaths.map((path) => (
            <TabsTrigger
              key={path}
              value={path}
              className={
                isPromptPath(path)
                  ? 'text-[var(--ds-accent)]/70 data-[state=active]:text-[var(--ds-accent)]'
                  : undefined
              }
            >
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
        </TabsList>

        {openPaths.filter((p) => !isPromptPath(p)).map((path) => (
          <TabsContent key={path} value={path} className="flex-1 overflow-auto py-6 px-4 md:px-8">
            <div className="cockpit-prose cockpit-prose--code">
              <CodeFileContent path={path} content={codeFiles[path]} capability={capability} />
            </div>
          </TabsContent>
        ))}

        {openPaths.filter(isPromptPath).map((path) => {
          const content = promptFiles[path];
          return (
            <TabsContent key={path} value={path} className="flex-1 overflow-auto py-6 px-4 md:px-8">
              <div className="cockpit-prose cockpit-prose--code">
                {content ? (
                  <pre className="font-mono text-sm whitespace-pre-wrap">{content}</pre>
                ) : (
                  <p className="text-sm text-[var(--ds-text-muted)]">No content for {getTabLabel(path)}</p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
