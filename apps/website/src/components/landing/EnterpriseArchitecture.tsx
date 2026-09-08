import type { ReactNode } from 'react';
import { DiagramSection } from './DiagramSection';
import { DiagramFrame } from '../docs/diagrams';
import {
  ARROWS,
  CARDS,
  CARD_PAD,
  COLUMNS,
  COLUMN_LABEL_Y,
  CONTRACT_CAPTION,
  GRID,
  LOGOS,
  MAJOR,
  MODEL_STRIP,
  STRIP_CHIP_H,
  STRIP_GAP,
  TITLE_DY,
  VIEW,
  stripChipWidth,
  type Card,
  type IconKey,
  type LogoKey,
} from '../../lib/architecture-diagram';

export const ARCHITECTURE_EYEBROW = 'Architecture';
export const ARCHITECTURE_HEADLINE =
  'The UI layer between your users and your agents.';
export const ARCHITECTURE_BODY =
  'Threadplane lives inside your Angular application and talks to your agents through the LangGraph SDK or AG-UI. Everything on the right is yours.';
export const ARCHITECTURE_LABEL =
  'Threadplane is the UI layer between your users and your agents: it lives inside your Angular application, reaches LangGraph agents first-class through the LangGraph SDK and any AG-UI server through the AG-UI protocol, and leaves the model choice to your runtime.';

const SLUG = 'enterprise-architecture';

/** Line icons (24-unit paths) for the roles that have no mark. */
const ICONS: Readonly<Record<IconKey, string>> = {
  users:
    'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  chat: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1-5A8 8 0 1 1 21 12z',
  pause: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M10 9v6m4-6v6',
  branch:
    'M6 2a2 2 0 1 0 0 4a2 2 0 1 0 0-4M6 18a2 2 0 1 0 0 4a2 2 0 1 0 0-4M18 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4M6 6v12M18 11a6 6 0 0 1-6 6h-1',
  sparkles: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L13 18l-2 2-4-4 2-2 6.7-7.7zM3 21l4-4',
};

function Icon({
  name,
  x,
  y,
  size,
  bg,
  fg,
}: {
  name: IconKey;
  x: number;
  y: number;
  size: number;
  bg: string;
  fg: string;
}) {
  const s = (size - 8) / 24;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={Math.round(size * 0.28)}
        fill={bg}
      />
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
  mark: LogoKey;
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

/** A white rounded tile holding a mark. */
function MarkBadge({
  mark,
  x,
  y,
  size,
}: {
  mark: LogoKey;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <g className="arch-badge">
      <rect x={x} y={y} width={size} height={size} rx={10} />
      <Mark mark={mark} x={x + 8} y={y + 8} size={size - 16} />
    </g>
  );
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
          case 'badge':
            return (
              <g key={i}>
                <MarkBadge mark={row.mark} x={row.x} y={row.y} size={36} />
                <text className="arch-body" x={row.x + 44} y={row.y + 23}>
                  {row.label}
                </text>
              </g>
            );
          case 'items':
            return (
              <g
                key={i}
                className="arch-items"
                data-tone={card.highlight ? 'tp' : 'plain'}
              >
                {row.items.map((item, j) => {
                  const y = row.y + j * row.step;
                  return (
                    <g key={item}>
                      <rect
                        className="arch-item-band"
                        x={card.x + 12}
                        y={y - 18}
                        width={card.width - 24}
                        height={26}
                        rx={8}
                      />
                      <rect
                        className="arch-item-bar"
                        x={card.x + 12}
                        y={y - 14}
                        width={3}
                        height={18}
                        rx={1.5}
                      />
                      <text className="arch-body" x={card.x + CARD_PAD} y={y}>
                        {item}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          case 'marks':
            return (
              <g key={i}>
                {row.marks.map((m, j) => (
                  <MarkBadge
                    key={m}
                    mark={m}
                    x={card.x + CARD_PAD + j * row.step}
                    y={row.y}
                    size={row.size}
                  />
                ))}
              </g>
            );
          case 'caps':
            return (
              <g key={i}>
                {row.caps.map((cap, j) => {
                  const y = row.y + j * 40;
                  return (
                    <a key={cap.label} href={cap.href} className="arch-cap">
                      <Icon
                        name={cap.icon}
                        x={card.x + CARD_PAD}
                        y={y}
                        size={36}
                        bg="#e4ecfa"
                        fg="#2f5fa8"
                      />
                      <text x={card.x + CARD_PAD + 48} y={y + 23}>
                        {cap.label}
                      </text>
                    </a>
                  );
                })}
              </g>
            );
        }
      })}
    </>
  );
}

function CardView({ card }: { card: Card }) {
  const hasInnerLinks = card.rows.some((r) => r.kind === 'caps');
  const titleX = card.x + CARD_PAD + (card.mark ? 52 : 0);
  const titleY = card.y + TITLE_DY;
  const title = (
    <text className="arch-title" x={titleX} y={titleY}>
      {card.highlight && !card.mark ? '\u{1F6E9}️  ' : ''}
      {card.title}
    </text>
  );
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
      {card.id === 'threadplane' ? (
        <>
          <Mark
            mark="angular"
            x={card.x + CARD_PAD}
            y={card.y + 24}
            size={22}
          />
          <text
            className="arch-zone-label arch-zone-label--app"
            x={card.x + CARD_PAD + 32}
            y={card.y + 41}
          >
            YOUR ANGULAR APP
          </text>
        </>
      ) : null}
      {card.icon ? (
        <Icon
          name={card.icon.name}
          x={card.x + CARD_PAD}
          y={card.y + 32}
          size={44}
          bg={card.icon.bg}
          fg={card.icon.fg}
        />
      ) : null}
      {card.mark ? (
        <MarkBadge
          mark={card.mark}
          x={card.x + CARD_PAD}
          y={card.y + 24}
          size={40}
        />
      ) : null}
      {hasInnerLinks ? (
        // A card whose rows carry their own links cannot itself be a link
        // (anchors do not nest), so its title is the link instead.
        <a href={card.href} className="arch-card-link arch-title-link">
          <text
            className="arch-title arch-title--lg"
            x={card.x + CARD_PAD}
            y={card.y + 92}
          >
            {'\u{1F6E9}️  '}
            {card.title}
          </text>
        </a>
      ) : card.icon ? (
        <text className="arch-title" x={card.x + CARD_PAD} y={card.y + 116}>
          {card.title}
        </text>
      ) : (
        title
      )}
      {card.title2 ? (
        <text className="arch-title" x={titleX} y={titleY + 18}>
          {card.title2}
        </text>
      ) : null}
      {card.tag ? (
        <text
          className="arch-tag"
          x={card.x + card.width - CARD_PAD}
          y={card.id === 'threadplane' ? card.y + 92 : card.y + 24}
        >
          {card.tag}
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

function ModelStrip() {
  let x: number = MODEL_STRIP.x;
  const chips: ReactNode[] = [];
  for (const chip of MODEL_STRIP.chips) {
    const w = stripChipWidth(chip.label);
    chips.push(
      <g key={chip.label} className="arch-chip" data-chip>
        <rect
          x={x}
          y={MODEL_STRIP.chipY}
          width={w}
          height={STRIP_CHIP_H}
          rx={STRIP_CHIP_H / 2}
        />
        <Mark
          mark={chip.mark}
          x={x + 12}
          y={MODEL_STRIP.chipY + 10}
          size={16}
        />
        <text x={x + 36} y={MODEL_STRIP.chipY + 23}>
          {chip.label}
        </text>
      </g>
    );
    x += w + STRIP_GAP;
  }
  return (
    <g data-model-strip>
      <text
        className="arch-zone-label"
        x={MODEL_STRIP.x}
        y={MODEL_STRIP.labelY}
      >
        {MODEL_STRIP.label}
      </text>
      {chips}
      <text className="arch-caption" x={x + 8} y={MODEL_STRIP.chipY + 23}>
        {MODEL_STRIP.caption}
      </text>
    </g>
  );
}

const STACK_ORDER = [
  'users',
  'threadplane',
  'langgraph-sdk',
  'ag-ui',
  'langsmith',
  'ag-ui-servers',
] as const;

/**
 * The phone form of the diagram: the same cards, in reading order, as an
 * HTML stack. Shown under 768px by CSS; the SVG is hidden there.
 */
function ArchitectureStack() {
  const byId = new Map(CARDS.map((c) => [c.id, c]));
  return (
    <div className="arch-stack" data-arch-stack>
      {STACK_ORDER.map((id, i) => {
        const c = byId.get(id)!;
        const col = COLUMNS.find((col) => col.x === c.x);
        const caps = c.rows.find((r) => r.kind === 'caps');
        const marks = c.rows.find((r) => r.kind === 'marks');
        const texts = c.rows.filter((r) => r.kind === 'text');
        const items = c.rows.find((r) => r.kind === 'items');
        const mono = c.rows.find((r) => r.kind === 'mono');
        const badges = c.rows.filter((r) => r.kind === 'badge');
        return (
          <div key={id}>
            {col && (i === 0 || byId.get(STACK_ORDER[i - 1])!.x !== c.x) ? (
              <p className="arch-stack-label">{col.label}</p>
            ) : null}
            <a
              className="arch-stack-card"
              href={c.href}
              data-highlight={c.highlight || undefined}
            >
              <div className="arch-stack-head">
                {c.mark ? <img src={LOGOS[c.mark]} alt="" /> : null}
                {c.id === 'threadplane' ? (
                  <img src={LOGOS.angular} alt="" />
                ) : null}
                <p className="arch-stack-title">
                  {c.title}
                  {c.title2 ? ` ${c.title2}` : ''}
                </p>
                {c.tag ? <span className="arch-stack-tag">{c.tag}</span> : null}
              </div>
              {texts.length ? (
                <ul className="arch-stack-rows">
                  {texts.map((r) =>
                    r.kind === 'text' ? <li key={r.text}>{r.text}</li> : null
                  )}
                </ul>
              ) : null}
              {items && items.kind === 'items' ? (
                <ul className="arch-stack-items">
                  {items.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {caps && caps.kind === 'caps' ? (
                <ul className="arch-stack-caps">
                  {caps.caps.map((cap) => (
                    <li key={cap.label}>{cap.label}</li>
                  ))}
                  {badges.map((b) =>
                    b.kind === 'badge' ? <li key={b.label}>{b.label}</li> : null
                  )}
                </ul>
              ) : null}
              {marks && marks.kind === 'marks' ? (
                <div className="arch-stack-marks">
                  {marks.marks.map((m) => (
                    <img key={m} src={LOGOS[m]} alt="" />
                  ))}
                </div>
              ) : null}
              {mono && mono.kind === 'mono' ? (
                <p className="arch-stack-mono">{mono.text}</p>
              ) : null}
            </a>
          </div>
        );
      })}
      <p className="arch-stack-label">{MODEL_STRIP.label}</p>
      <div className="arch-stack-card">
        <div className="arch-stack-marks">
          {MODEL_STRIP.chips.map((chip) => (
            <img key={chip.label} src={LOGOS[chip.mark]} alt={chip.label} />
          ))}
        </div>
        <ul className="arch-stack-rows">
          <li>{MODEL_STRIP.chips.map((c) => c.label).join(' · ')}</li>
          <li>{MODEL_STRIP.caption}</li>
        </ul>
      </div>
    </div>
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
 * The homepage architecture section (spec 2026-09-07): your users, your
 * Angular application with Threadplane as its UI layer, the two adapters,
 * your agents, and the model strip. Geometry comes from
 * `lib/architecture-diagram.ts`, which the unit spec and the e2e read too.
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
              <stop offset="1" stopColor="#fafbfc" />
            </linearGradient>
            <radialGradient id={`${SLUG}-ground`} cx="18%" cy="20%" r="90%">
              <stop offset="0" stopColor="#eef3fb" />
              <stop offset="0.55" stopColor="#f8f9fb" />
              <stop offset="1" stopColor="#f4f6f9" />
            </radialGradient>
            <linearGradient id={`${SLUG}-tp`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f7faff" />
              <stop offset="1" stopColor="#eff4fc" />
            </linearGradient>
          </defs>
          <rect
            className="arch-ground"
            x={0}
            y={0}
            width={VIEW.width}
            height={VIEW.height}
            rx={10}
            fill={`url(#${SLUG}-ground)`}
          />
          <rect
            x={0}
            y={0}
            width={VIEW.width}
            height={VIEW.height}
            rx={10}
            fill={`url(#${SLUG}-dots)`}
          />
          {COLUMNS.map((c) => (
            <text
              key={c.label}
              className="arch-zone-label"
              x={c.x}
              y={COLUMN_LABEL_Y}
              data-column
            >
              {c.label}
            </text>
          ))}
          {CARDS.map((c) => (
            <CardView key={c.id} card={c} />
          ))}
          {ARROWS.map((a) => (
            <path
              key={`${a.x1}-${a.y}`}
              className="arch-arrow"
              d={`M${a.x1},${a.y} L${a.x2},${a.y}`}
              markerEnd={`url(#${SLUG}-arrow)`}
            />
          ))}
          <text
            className="arch-caption arch-caption--mid"
            x={CONTRACT_CAPTION.x}
            y={CONTRACT_CAPTION.y}
          >
            {CONTRACT_CAPTION.lines[0]}
          </text>
          <text
            className="arch-caption arch-caption--mid"
            x={CONTRACT_CAPTION.x}
            y={CONTRACT_CAPTION.y + 16}
          >
            {CONTRACT_CAPTION.lines[1]}
          </text>
          <ModelStrip />
          {grid ? <AlignmentGrid /> : null}
        </DiagramFrame>
        <ArchitectureStack />
      </div>
    </DiagramSection>
  );
}
