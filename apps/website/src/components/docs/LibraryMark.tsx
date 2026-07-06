import { tokens } from '@threadplane/design-tokens';
import type { LibraryId } from '../../lib/docs-config';

type GlyphKey = 'chat' | 'key' | 'middleware' | 'pulse';

type MarkEntry =
  | { kind: 'logo'; src: string }
  | { kind: 'glyph'; glyph: GlyphKey };

const MARKS: Record<LibraryId, MarkEntry> = {
  langgraph: { kind: 'logo', src: '/logos/langgraph.svg' },
  'ag-ui': { kind: 'logo', src: '/logos/runtimes/copilotkit.svg' },
  a2ui: { kind: 'logo', src: '/logos/providers/google.svg' },
  render: { kind: 'logo', src: '/logos/surface/vercel.svg' },
  chat: { kind: 'glyph', glyph: 'chat' },
  middleware: { kind: 'glyph', glyph: 'middleware' },
  licensing: { kind: 'glyph', glyph: 'key' },
  telemetry: { kind: 'glyph', glyph: 'pulse' },
};

function ChatGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

function KeyGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="12" r="3" />
      <path d="M11 12h9M17 12v4" />
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

const GLYPHS: Record<GlyphKey, (props: { s: number }) => React.JSX.Element> = {
  chat: ChatGlyph,
  key: KeyGlyph,
  middleware: MiddlewareGlyph,
  pulse: PulseGlyph,
};

interface Props {
  library: LibraryId;
  /** Outer chip size in px. Default 24. */
  size?: number;
}

export function LibraryMark({ library, size = 24 }: Props) {
  const mark = MARKS[library];
  const base = {
    width: size,
    height: size,
    borderRadius: tokens.radius.md,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  } as const;

  if (mark.kind === 'logo') {
    const inner = Math.round(size * 0.6);
    return (
      <span
        style={{
          ...base,
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
        }}
      >
        <img
          src={mark.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ width: inner, height: inner, objectFit: 'contain' }}
        />
      </span>
    );
  }

  const Glyph = GLYPHS[mark.glyph];
  return (
    <span
      style={{
        ...base,
        background: tokens.colors.accentSurface,
        border: `1px solid ${tokens.colors.accentBorder}`,
        color: tokens.colors.accent,
      }}
    >
      <Glyph s={Math.round(size * 0.55)} />
    </span>
  );
}
