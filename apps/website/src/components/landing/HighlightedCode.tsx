import { codeToHtml } from 'shiki';

interface HighlightedCodeProps {
  code: string;
  lang?: string;
}

export async function HighlightedCode({ code, lang = 'typescript' }: HighlightedCodeProps) {
  const html = await codeToHtml(code.trim(), {
    lang,
    theme: 'tokyo-night',
  });

  return (
    <div
      className="shiki"
      style={{ margin: 0, borderRadius: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
