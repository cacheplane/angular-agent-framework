import type { ReactNode } from 'react';
import { DiagramSection } from './DiagramSection';
import { DiagramFrame } from '../docs/diagrams';
import {
  ARROWS,
  CARDS,
  CARD_PAD,
  CHIP_GAP,
  CHIP_H,
  GRID,
  LOGOS,
  MAJOR,
  TITLE_DY,
  VIEW,
  ZONES,
  chipWidth,
  type Card,
  type IconKey,
  type Row,
} from '../../lib/architecture-diagram';

export const ARCHITECTURE_EYEBROW = 'Architecture';
export const ARCHITECTURE_HEADLINE =
  'Where Threadplane fits in your agent platform.';
export const ARCHITECTURE_BODY =
  'One highlighted box inside your Angular application. Everything else is yours or your runtime’s, and the docs say what crosses each line.';
export const ARCHITECTURE_LABEL =
  'Where Threadplane fits in an enterprise agent architecture: your Angular application with Threadplane as its only vendor box, your platform edge with a same-origin proxy and identity, and the agent platform beneath with the runtime, models, tools, observability and durable state.';

const SLUG = 'enterprise-architecture';

/** Line icons (24-unit paths) for the roles that have no mark. */
const ICONS: Readonly<Record<IconKey, string>> = {
  key: 'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7.1 7.1 5 5 0 0 1 7.1-7.1zm0 0L19 3m-3 3l2 2',
  gateway: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
  trace: 'M3 12h4l3-8 4 16 3-8h4',
  plug: 'M9 2v6m6-6v6M5 8h14l-1 5a6 6 0 0 1-12 0zM12 19v3',
  db: 'M4 5a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  layers: 'M12 2l10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  cpu: 'M5 5h14v14H5zM9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3',
  chat: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1-5A8 8 0 1 1 21 12z',
  pause: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M10 9v6m4-6v6',
  branch:
    'M6 2a2 2 0 1 0 0 4a2 2 0 1 0 0-4M6 18a2 2 0 1 0 0 4a2 2 0 1 0 0-4M18 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4M6 6v12M18 11a6 6 0 0 1-6 6h-1',
  sparkles: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L13 18l-2 2-4-4 2-2 6.7-7.7zM3 21l4-4',
  sparkle:
    'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
};

function Icon({
  name,
  x,
  y,
  size = 32,
  bg,
  fg,
}: {
  name: IconKey;
  x: number;
  y: number;
  size?: number;
  bg: string;
  fg: string;
}) {
  const s = (size - 8) / 24;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={9} fill={bg} />
      <path
        d={ICONS[name]}
        transform={`translate(${x + 4} ${y + 4}) scale(${s})`}
        fill="none"
        stroke={fg}
        strokeWidth={1.9 / s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Mark({
  mark,
  x,
  y,
  size,
}: {
  mark: keyof typeof LOGOS;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <image
      href={LOGOS[mark]}
      x={x}
      y={y}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function ChipRow({
  card,
  row,
}: {
  card: Card;
  row: Extract<Row, { kind: 'chips' }>;
}) {
  let x = card.x + CARD_PAD;
  const out: ReactNode[] = [];
  for (const chip of row.chips) {
    const w = chipWidth(chip.label, !!chip.mark);
    out.push(
      <g
        key={chip.label}
        className="arch-chip"
        data-chip
        data-tone={row.tone ?? 'light'}
      >
        <rect x={x} y={row.y} width={w} height={CHIP_H} rx={CHIP_H / 2} />
        {chip.mark ? (
          <Mark mark={chip.mark} x={x + 9} y={row.y + 7} size={14} />
        ) : null}
        <text x={x + (chip.mark ? 30 : 12)} y={row.y + 18}>
          {chip.label}
        </text>
      </g>
    );
    x += w + CHIP_GAP;
  }
  if (row.trailing) {
    out.push(
      <text key="trailing" className="arch-body" x={x + 8} y={row.y + 18}>
        {row.trailing}
      </text>
    );
  }
  return <>{out}</>;
}

function CardRows({ card }: { card: Card }) {
  return (
    <>
      {card.rows.map((row, i) => {
        switch (row.kind) {
          case 'text':
            return (
              <text
                key={i}
                className="arch-body"
                x={card.x + CARD_PAD}
                y={row.y}
              >
                {row.text}
              </text>
            );
          case 'mono':
            return (
              <text
                key={i}
                className="arch-mono"
                x={card.x + CARD_PAD}
                y={row.y}
              >
                {row.text}
              </text>
            );
          case 'chips':
            return <ChipRow key={i} card={card} row={row} />;
          case 'marks':
            return (
              <g key={i}>
                {row.marks.map((m, j) => (
                  <g key={m} className="arch-badge">
                    <rect
                      x={row.x + j * 40}
                      y={row.y}
                      width={32}
                      height={32}
                      rx={9}
                    />
                    <Mark
                      mark={m}
                      x={row.x + j * 40 + 8}
                      y={row.y + 8}
                      size={16}
                    />
                  </g>
                ))}
              </g>
            );
          case 'caps': {
            let x = card.x + CARD_PAD;
            return (
              <g key={i}>
                {row.caps.map((cap) => {
                  const cx = x;
                  x += 42 + Math.round(cap.label.length * 7.2) + 28;
                  return (
                    <a key={cap.label} href={cap.href} className="arch-cap">
                      <Icon
                        name={cap.icon}
                        x={cx}
                        y={row.y}
                        bg="#e4ecfa"
                        fg="#2f5fa8"
                      />
                      <text x={cx + 42} y={row.y + 21}>
                        {cap.label}
                      </text>
                    </a>
                  );
                })}
              </g>
            );
          }
        }
      })}
    </>
  );
}

function CardView({ card }: { card: Card }) {
  const titleY = card.y + TITLE_DY;
  const hasInnerLinks = card.rows.some((r) => r.kind === 'caps');
  const body = (
    <g
      data-card-rect
      data-x={card.x}
      data-y={card.y}
      data-w={card.width}
      data-h={card.height}
    >
      <rect
        className={card.highlight ? 'arch-card arch-card--tp' : 'arch-card'}
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={16}
      />
      {card.icon ? (
        <Icon
          name={card.icon.name}
          x={card.x + CARD_PAD}
          y={titleY - 22}
          bg={card.icon.bg}
          fg={card.icon.fg}
        />
      ) : null}
      {hasInnerLinks ? (
        // A card whose rows carry their own links cannot itself be a link
        // (anchors do not nest), so its title is the link instead.
        <a href={card.href} className="arch-card-link arch-title-link">
          <text
            className="arch-title"
            x={card.x + CARD_PAD + (card.icon ? 46 : 0)}
            y={titleY}
          >
            {card.highlight ? '\u{1F6E9}\uFE0F  ' : ''}
            {card.title}
          </text>
        </a>
      ) : (
        <text
          className="arch-title"
          x={card.x + CARD_PAD + (card.icon ? 46 : 0)}
          y={titleY}
        >
          {card.highlight ? '\u{1F6E9}\uFE0F  ' : ''}
          {card.title}
        </text>
      )}
      {card.tag ? (
        <text
          className="arch-tag"
          x={card.x + card.width - CARD_PAD}
          y={titleY}
        >
          {card.tag}
        </text>
      ) : null}
      {card.docsLabel ? (
        <text
          className="arch-docs"
          x={card.x + card.width - CARD_PAD}
          y={card.y + 34}
        >
          docs ↗
        </text>
      ) : null}
      <CardRows card={card} />
    </g>
  );
  return hasInnerLinks ? (
    <g data-card={card.id}>{body}</g>
  ) : (
    <a href={card.href} className="arch-card-link" data-card={card.id}>
      {body}
    </a>
  );
}

function AlignmentGrid() {
  const lines: ReactNode[] = [];
  for (let x = 0; x <= VIEW.width; x += GRID) {
    lines.push(
      <line
        key={`x${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={VIEW.height}
        className={x % MAJOR === 0 ? 'arch-grid-major' : 'arch-grid-minor'}
      />
    );
  }
  for (let y = 0; y <= VIEW.height; y += GRID) {
    lines.push(
      <line
        key={`y${y}`}
        x1={0}
        y1={y}
        x2={VIEW.width}
        y2={y}
        className={y % MAJOR === 0 ? 'arch-grid-major' : 'arch-grid-minor'}
      />
    );
  }
  return (
    <g className="arch-grid" data-alignment-grid pointerEvents="none">
      {lines}
    </g>
  );
}

interface Props {
  /** Review aid: overlays the 8px / 40px alignment grid the geometry is authored on. */
  grid?: boolean;
}

/**
 * The homepage architecture section (spec 2026-09-07): three zones, one
 * highlighted box, every card a link to the docs page that backs its wording.
 * Geometry comes from `lib/architecture-diagram.ts`, which the unit spec and
 * the e2e read too.
 */
export function EnterpriseArchitecture({ grid = false }: Props) {
  return (
    <DiagramSection
      id="architecture"
      eyebrow={ARCHITECTURE_EYEBROW}
      headline={ARCHITECTURE_HEADLINE}
      body={ARCHITECTURE_BODY}
    >
      <div
        className="arch-figure"
        data-diagram={SLUG}
        data-grid={grid || undefined}
      >
        <DiagramFrame
          slug={SLUG}
          viewWidth={VIEW.width}
          viewHeight={VIEW.height}
          scale="marketing"
          label={ARCHITECTURE_LABEL}
        >
          <defs>
            <linearGradient id={`${SLUG}-card`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#f6f8fb" />
            </linearGradient>
            <linearGradient id={`${SLUG}-app`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#eaf1fd" />
              <stop offset="1" stopColor="#f3f0fb" />
            </linearGradient>
            <linearGradient id={`${SLUG}-edge`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f6f9" />
              <stop offset="1" stopColor="#eef1f5" />
            </linearGradient>
            <linearGradient id={`${SLUG}-plat`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#edf8f2" />
              <stop offset="1" stopColor="#f1f7fb" />
            </linearGradient>
            <linearGradient id={`${SLUG}-tp`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f8ff" />
              <stop offset="1" stopColor="#e9f0fc" />
            </linearGradient>
          </defs>
          {ZONES.map((z) => (
            <g key={z.id} className="arch-zone" data-zone={z.id}>
              <rect
                x={40}
                y={z.y}
                width={1200}
                height={z.height}
                rx={20}
                fill={`url(#${SLUG}-${z.fill})`}
                stroke={z.stroke}
              />
              {z.mark ? (
                <Mark mark={z.mark} x={72} y={z.y + 26} size={18} />
              ) : null}
              <text
                className="arch-zone-label"
                x={z.mark ? 98 : 72}
                y={z.y + 40}
              >
                {z.label}
              </text>
              <text className="arch-zone-owner" x={1208} y={z.y + 40}>
                {z.owner}
              </text>
            </g>
          ))}
          {CARDS.map((c) => (
            <CardView key={c.id} card={c} />
          ))}
          {ARROWS.map((a) => (
            <g key={a.y1} className="arch-arrow">
              <path
                d={`M${a.x},${a.y1} L${a.x},${a.y2}`}
                markerEnd={`url(#${SLUG}-arrow)`}
              />
              <text
                className="arch-caption"
                x={a.x + 18}
                y={(a.y1 + a.y2) / 2 + 6}
              >
                {a.caption}
              </text>
            </g>
          ))}
          {grid ? <AlignmentGrid /> : null}
        </DiagramFrame>
      </div>
    </DiagramSection>
  );
}
