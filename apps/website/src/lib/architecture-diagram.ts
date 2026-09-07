/**
 * Geometry and copy for the homepage enterprise architecture diagram
 * (spec: docs/superpowers/specs/2026-09-07-enterprise-architecture-diagram-design.md).
 *
 * One table, three readers: the component draws it, the unit spec checks that
 * every rectangle lands on the 8px grid inside its zone, and the e2e measures
 * the rendered text against these same boxes. Coordinates are viewBox units;
 * the SVG scales with its container.
 *
 * Every card links to the docs page that backs its wording. Third-party
 * products are examples of the role a card describes, not integrations the
 * library claims; the spec §3 lists the source page for each line.
 */

export const VIEW = { width: 1280, height: 1088 } as const;
export const GRID = 8;
export const MAJOR = 40;
/** Distance from a zone's edge to its cards' outer edges (left/right/bottom). */
export const ZONE_INSET = 32;
/** Vertical room a zone keeps above its first row of cards for its label. */
export const ZONE_HEAD = 72;
export const CARD_GAP = 40;

export type ZoneId = 'app' | 'edge' | 'platform';

export interface Zone {
  readonly id: ZoneId;
  readonly label: string;
  readonly owner: string;
  readonly y: number;
  readonly height: number;
  /** Gradient id in the component's defs. */
  readonly fill: 'app' | 'edge' | 'plat';
  readonly stroke: string;
  /** A logo file under /logos to show beside the label. */
  readonly mark?: LogoKey;
}

export type LogoKey =
  | 'angular'
  | 'vercel'
  | 'google'
  | 'langgraph'
  | 'agui'
  | 'bedrock'
  | 'azure'
  | 'microsoft'
  | 'mastra'
  | 'openai'
  | 'anthropic';

/** Public paths of the marks the diagram is allowed to use (README under /logos). */
export const LOGOS: Readonly<Record<LogoKey, string>> = {
  angular: '/logos/surface/angular.svg',
  vercel: '/logos/surface/vercel.svg',
  google: '/logos/providers/google.svg',
  langgraph: '/logos/langgraph.svg',
  agui: '/logos/ag-ui.svg',
  bedrock: '/logos/providers/bedrock.svg',
  azure: '/logos/providers/azure.svg',
  microsoft: '/logos/runtimes/microsoft.svg',
  mastra: '/logos/runtimes/mastra.svg',
  openai: '/logos/providers/openai.svg',
  anthropic: '/logos/providers/anthropic.svg',
};

export type IconKey =
  | 'key'
  | 'gateway'
  | 'trace'
  | 'plug'
  | 'db'
  | 'layers'
  | 'cpu'
  | 'chat'
  | 'pause'
  | 'branch'
  | 'sparkles'
  | 'wrench'
  | 'sparkle';

export interface Chip {
  readonly mark?: LogoKey;
  readonly label: string;
}

export interface Capability {
  readonly icon: IconKey;
  readonly label: string;
  readonly href: string;
}

export type Row =
  /** A row of pill chips, each with an optional mark. `trailing` is a sentence set after the last chip. */
  | {
      readonly kind: 'chips';
      readonly y: number;
      readonly chips: readonly Chip[];
      readonly trailing?: string;
      readonly tone?: 'light' | 'tp';
    }
  /** A row of square mark badges, no label. */
  | {
      readonly kind: 'marks';
      readonly y: number;
      readonly x: number;
      readonly marks: readonly LogoKey[];
    }
  | { readonly kind: 'text'; readonly y: number; readonly text: string }
  | { readonly kind: 'mono'; readonly y: number; readonly text: string }
  /** The Threadplane card's capability badges, each its own link. */
  | {
      readonly kind: 'caps';
      readonly y: number;
      readonly caps: readonly Capability[];
    };

export interface Card {
  readonly id: string;
  readonly zone: ZoneId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly href: string;
  /** Icon badge beside the title; absent on the Threadplane card, which carries the brand mark. */
  readonly icon?: {
    readonly name: IconKey;
    readonly bg: string;
    readonly fg: string;
  };
  /** Right-aligned tag on the title line (only the Threadplane card). */
  readonly tag?: string;
  /** Whether to render the "docs ↗" affordance at the top-right. */
  readonly docsLabel: boolean;
  readonly highlight?: boolean;
  readonly rows: readonly Row[];
}

export interface Arrow {
  readonly x: number;
  readonly y1: number;
  readonly y2: number;
  readonly caption: string;
}

export const ZONES: readonly Zone[] = [
  {
    id: 'app',
    label: 'YOUR ANGULAR APPLICATION',
    owner: 'you own this zone',
    y: 40,
    height: 280,
    fill: 'app',
    stroke: '#d6deee',
    mark: 'angular',
  },
  {
    id: 'edge',
    label: 'YOUR PLATFORM EDGE',
    owner: 'you own this zone',
    y: 360,
    height: 224,
    fill: 'edge',
    stroke: '#d9dee6',
  },
  {
    id: 'platform',
    label: 'AGENT PLATFORM',
    owner: 'your runtime owns this zone',
    y: 624,
    height: 424,
    fill: 'plat',
    stroke: '#d3e3d9',
  },
];

export const CARDS: readonly Card[] = [
  {
    id: 'threadplane',
    zone: 'app',
    x: 72,
    y: 112,
    width: 744,
    height: 176,
    title: 'Threadplane',
    href: '/docs/chat/getting-started/introduction',
    tag: 'THE FINAL MILE',
    docsLabel: false,
    highlight: true,
    rows: [
      {
        kind: 'caps',
        y: 168,
        caps: [
          { icon: 'chat', label: 'Chat', href: '/docs/chat/components/chat' },
          {
            icon: 'pause',
            label: 'Interrupts',
            href: '/docs/langgraph/guides/interrupts',
          },
          {
            icon: 'branch',
            label: 'Threads',
            href: '/docs/langgraph/guides/persistence',
          },
          {
            icon: 'sparkles',
            label: 'Generative UI',
            href: '/docs/chat/guides/generative-ui',
          },
          {
            icon: 'wrench',
            label: 'Client tools',
            href: '/docs/chat/guides/client-tools',
          },
        ],
      },
      {
        kind: 'mono',
        y: 228,
        text: '@threadplane/chat · render · langgraph · ag-ui · middleware',
      },
      {
        kind: 'chips',
        y: 244,
        tone: 'tp',
        chips: [
          { mark: 'google', label: 'A2UI v0.9' },
          { mark: 'vercel', label: 'json-render' },
        ],
        trailing:
          'generative UI on two open standards · one Agent contract for every adapter',
      },
    ],
  },
  {
    id: 'components',
    zone: 'app',
    x: 856,
    y: 112,
    width: 352,
    height: 176,
    title: 'Your components',
    href: '/docs/chat/guides/client-tools',
    icon: { name: 'layers', bg: '#ecfdf5', fg: '#047857' },
    docsLabel: true,
    rows: [
      {
        kind: 'text',
        y: 192,
        text: 'design system · tool views · client-tool handlers',
      },
      {
        kind: 'text',
        y: 218,
        text: 'pages · routing · state · APM on status() and error()',
      },
      { kind: 'text', y: 244, text: 'unchanged by Threadplane' },
    ],
  },
  {
    id: 'gateway',
    zone: 'edge',
    x: 72,
    y: 432,
    width: 744,
    height: 128,
    title: 'Same-origin proxy or API gateway',
    href: '/docs/langgraph/guides/deployment',
    icon: { name: 'gateway', bg: '#eef2f7', fg: '#4a5568' },
    docsLabel: true,
    rows: [
      {
        kind: 'chips',
        y: 494,
        chips: [
          { mark: 'azure', label: 'Azure API Management' },
          { mark: 'bedrock', label: 'Amazon API Gateway' },
          { mark: 'google', label: 'Apigee' },
        ],
      },
      {
        kind: 'text',
        y: 544,
        text: 'adds the deployment credentials · forwards user identity · keys never reach the browser',
      },
    ],
  },
  {
    id: 'identity',
    zone: 'edge',
    x: 856,
    y: 432,
    width: 352,
    height: 128,
    title: 'Identity & session',
    href: '/docs/langgraph/guides/deployment',
    icon: { name: 'key', bg: '#fff3e0', fg: '#c2410c' },
    docsLabel: true,
    rows: [
      {
        kind: 'chips',
        y: 494,
        chips: [{ mark: 'microsoft', label: 'Microsoft Entra ID' }],
      },
      { kind: 'text', y: 544, text: 'or Okta · session as HTTP-only cookies' },
    ],
  },
  {
    id: 'runtime',
    zone: 'platform',
    x: 72,
    y: 696,
    width: 408,
    height: 152,
    title: 'Agent runtime',
    href: '/docs/langgraph/getting-started/introduction',
    icon: { name: 'cpu', bg: '#e0f2fe', fg: '#0369a1' },
    docsLabel: true,
    rows: [
      {
        kind: 'chips',
        y: 762,
        chips: [
          { mark: 'langgraph', label: 'LangGraph Platform' },
          { mark: 'agui', label: 'AG-UI' },
        ],
      },
      {
        kind: 'chips',
        y: 798,
        chips: [
          { mark: 'bedrock', label: 'Strands' },
          { mark: 'microsoft', label: 'Agent Framework' },
          { mark: 'mastra', label: 'Mastra' },
        ],
      },
    ],
  },
  {
    id: 'models',
    zone: 'platform',
    x: 520,
    y: 696,
    width: 336,
    height: 152,
    title: 'Models',
    href: '/docs/runtimes/getting-started/introduction',
    icon: { name: 'sparkle', bg: '#f5f3ff', fg: '#6d28d9' },
    docsLabel: true,
    rows: [
      {
        kind: 'chips',
        y: 762,
        chips: [
          { mark: 'azure', label: 'Azure OpenAI' },
          { mark: 'bedrock', label: 'Amazon Bedrock' },
        ],
      },
      {
        kind: 'chips',
        y: 798,
        chips: [{ mark: 'google', label: 'Vertex AI' }],
      },
      { kind: 'marks', y: 796, x: 664, marks: ['openai', 'anthropic'] },
    ],
  },
  {
    id: 'tools',
    zone: 'platform',
    x: 896,
    y: 696,
    width: 312,
    height: 152,
    title: 'Tools · MCP · data',
    href: '/docs/middleware/getting-started/introduction',
    icon: { name: 'plug', bg: '#fff7ed', fg: '#c2410c' },
    docsLabel: true,
    rows: [
      { kind: 'text', y: 780, text: 'server tools run here, on your systems' },
      { kind: 'text', y: 808, text: 'client tools round-trip to the browser' },
    ],
  },
  {
    id: 'observability',
    zone: 'platform',
    x: 72,
    y: 888,
    width: 352,
    height: 128,
    title: 'Observability',
    href: '/docs/langgraph/guides/deployment',
    icon: { name: 'trace', bg: '#fdf2f8', fg: '#be185d' },
    docsLabel: true,
    rows: [
      {
        kind: 'chips',
        y: 952,
        chips: [{ label: 'LangSmith' }],
        trailing: 'traces every run · evals · token cost',
      },
    ],
  },
  {
    id: 'state',
    zone: 'platform',
    x: 464,
    y: 888,
    width: 744,
    height: 128,
    title: 'Durable state',
    href: '/docs/langgraph/guides/persistence',
    icon: { name: 'db', bg: '#f1f5f9', fg: '#334155' },
    docsLabel: true,
    rows: [
      {
        kind: 'text',
        y: 968,
        text: 'checkpoints at every super-step, keyed by thread · platform-managed, or Postgres / SQLite when you embed the graph',
      },
      { kind: 'text', y: 994, text: 'exposed by Threadplane, never faked' },
    ],
  },
];

export const ARROWS: readonly Arrow[] = [
  {
    x: 440,
    y1: 288,
    y2: 360,
    caption: 'relative apiUrl · POST + SSE via the LangGraph SDK',
  },
  {
    x: 440,
    y1: 560,
    y2: 624,
    caption: 'credentials added server-side · CORS on the runtime',
  },
];

/** Every docs href the diagram links to, deduplicated, for the link-resolution spec. */
export function diagramHrefs(): readonly string[] {
  const out = new Set<string>();
  for (const c of CARDS) {
    out.add(c.href);
    for (const r of c.rows)
      if (r.kind === 'caps') for (const cap of r.caps) out.add(cap.href);
  }
  return [...out];
}

/** Baseline of a card's title row: 38 below the card's top. */
export const TITLE_DY = 38;
/** Left inset of card content. */
export const CARD_PAD = 24;
/** Chip geometry: height and the width formula the component and the e2e share. */
export const CHIP_H = 28;
export const chipWidth = (label: string, withMark: boolean): number =>
  Math.round(label.length * 7.2) + (withMark ? 44 : 24);
export const CHIP_GAP = 12;
