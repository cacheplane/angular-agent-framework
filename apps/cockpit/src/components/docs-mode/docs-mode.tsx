import React from 'react';

interface DocsModeSection {
  title: string;
  body: string;
  code?: string;
}

interface DocsModeProps {
  entryTitle: string;
  docsPath: string;
  summary: string;
  sections: DocsModeSection[];
  promptCopy: string;
}

function toSectionId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function DocsMode({
  entryTitle,
  docsPath,
  summary,
  sections,
  promptCopy,
}: DocsModeProps) {
  return (
    <article aria-label="Docs mode">
      <header>
        <p>Docs</p>
        <h1>{entryTitle}</h1>
        <p>{summary}</p>
        <p>{docsPath}</p>
        <p>
          Use <code>Run</code> for the live surface, then switch to <code>Code</code> when
          you need implementation detail.
        </p>
      </header>

      <div>
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={toSectionId(section.title)}>
            <h2 id={toSectionId(section.title)}>{section.title}</h2>
            <p>{section.body}</p>
            {section.code ? (
              <pre>
                <code>{section.code}</code>
              </pre>
            ) : null}
          </section>
        ))}
      </div>

      <section aria-label="Prompt copy">
        <h2>Prompt assets</h2>
        <p>Keep the prompt close while you read the implementation guide.</p>
        <button type="button">{promptCopy}</button>
      </section>
    </article>
  );
}
