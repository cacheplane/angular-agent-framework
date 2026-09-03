import type { LibraryId } from '../../lib/docs-config';

type GlyphKey = 'chat' | 'middleware' | 'pulse' | 'layers' | 'branch';

type MarkEntry =
  | { kind: 'logo'; src: string }
  | { kind: 'glyph'; glyph: GlyphKey };

const MARKS: Record<LibraryId, MarkEntry> = {
  langgraph: { kind: 'logo', src: '/logos/langgraph.svg' },
  'ag-ui': { kind: 'logo', src: '/logos/ag-ui.svg' },
  a2ui: { kind: 'logo', src: '/logos/providers/google.svg' },
  render: { kind: 'logo', src: '/logos/surface/vercel.svg' },
  chat: { kind: 'glyph', glyph: 'chat' },
  middleware: { kind: 'glyph', glyph: 'middleware' },
  runtimes: { kind: 'glyph', glyph: 'layers' },
  'deep-agents': { kind: 'glyph', glyph: 'branch' },
};

function ChatGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

function MiddlewareGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M4 17h16" />
      <path d="M7 4v6M17 14v6" />
    </svg>
  );
}

function PulseGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

function LayersGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 16 9 5 9-5" />
      <path d="m3 12 9 5 9-5" />
    </svg>
  );
}

function BranchGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M5 17v-2a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2" />
    </svg>
  );
}

const GLYPHS: Record<GlyphKey, (props: { s: number }) => React.JSX.Element> = {
  chat: ChatGlyph,
  middleware: MiddlewareGlyph,
  pulse: PulseGlyph,
  layers: LayersGlyph,
  branch: BranchGlyph,
};

interface Props {
  library: LibraryId;
  /** Outer chip size in px. Default 24. */
  size?: number;
}

export function LibraryMark({ library, size = 24 }: Props) {
  const mark = MARKS[library];
  const sizeVar = { '--size': `${size}px` } as React.CSSProperties;

  if (mark.kind === 'logo') {
    const inner = Math.round(size * 0.6);
    return (
      <span className="docs-library-mark" data-kind="logo" style={sizeVar}>
        <img
          src={mark.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="docs-library-mark-img"
          style={{ '--inner-size': `${inner}px` } as React.CSSProperties}
        />
      </span>
    );
  }

  const Glyph = GLYPHS[mark.glyph];
  return (
    <span className="docs-library-mark" data-kind="glyph" style={sizeVar}>
      <Glyph s={Math.round(size * 0.55)} />
    </span>
  );
}
