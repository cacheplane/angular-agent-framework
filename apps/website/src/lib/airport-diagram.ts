/**
 * Geometry and content for the homepage compatibility band, drawn as an
 * FAA-style airport diagram
 * (spec: docs/superpowers/specs/2026-09-08-compatibility-airport-diagram-design.md).
 *
 * One table, three readers: Compatibility.tsx draws it, airport-diagram.spec.ts
 * checks the geometry closes, and e2e/home-airport.spec.ts measures the
 * rendered type against these same boxes. Coordinates are viewBox units.
 *
 * The chart vocabulary carries the argument, which is why the section has no
 * group labels and no explanatory paragraph: the main terminal is <chat>,
 * concourse A is @threadplane/langgraph, concourse B is @threadplane/ag-ui,
 * and each supported runtime is a mark parked at a numbered gate.
 *
 * Two values carry the meaning and nothing labels it: partner stands are
 * WHITE, the one structure that is Threadplane is solid INK.
 */

export const VIEW = { width: 1000, height: 536 } as const;

/** The chart frame. It does NOT rotate — only the airfield inside it does. */
export const NEAT = { x: 8, y: 8, width: 984, height: 444 } as const;
export const TICK_X = 88;
export const TICK_Y = 84;

/**
 * Airfield heading. Nothing on a real plate is axis-aligned, and this is the
 * cheapest single signal that this is a chart and not a flowchart. Marks and
 * their labels counter-rotate by -ROT so they stay upright.
 */
export const ROT = -3.5;
export const PIVOT = { x: 500, y: 230 } as const;

export const rotate = (x: number, y: number): { x: number; y: number } => {
  const a = (ROT * Math.PI) / 180;
  const dx = x - PIVOT.x;
  const dy = y - PIVOT.y;
  return {
    x: PIVOT.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: PIVOT.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
};

/** Outer extent of everything that rotates. Held so no corner leaves NEAT. */
export const FIELD = { x0: 56, x1: 944, y0: 58, y1: 419 } as const;

/** A runway strip: its top edge, its width, and the callsign at each threshold. */
export interface Runway {
  readonly y: number;
  readonly h: number;
  readonly left: string;
  readonly right: string;
}

export const RWY_N = { y: 58, h: 11, left: '09L', right: '27R' } as const;
export const RWY_S = { y: 408, h: 11, left: '09R', right: '27L' } as const;
export const TWY_N = 100;
export const TWY_S = 386;
export const TWY_E = 930;

export const MAIN = { x0: 56, x1: 188, y0: 190, y1: 288 } as const;
export const CONC_A = { x0: 204, x1: 432, y0: 190, y1: 224 } as const;
export const CONC_B = { x0: 204, x1: 900, y0: 254, y1: 288 } as const;
/**
 * Connector centre lines, terminal wall to concourse wall. CONCOURSES pairs
 * each with its concourse as `link`; the names exist so each value can be
 * written beside the two boxes its line runs between.
 */
export const LINK_A_Y = 206;
export const LINK_B_Y = 270;

export const APRON_A = { x0: 232, x1: 440, y0: 112, y1: 186 } as const;
export const APRON_B = { x0: 232, x1: 910, y0: 292, y1: 372 } as const;

/**
 * Stand box side, and the two gate rows that hang off the concourses.
 *
 * `standCy` is the stand square's centre y, `labelY` the callsign's baseline —
 * both in field coordinates, before the counter-rotation each stand applies
 * about its own centre. The stub is the leader line back to the concourse.
 */
export const STAND = 38;

export interface Row {
  readonly standCy: number;
  readonly labelY: number;
  readonly stubTop: number;
  readonly stubBot: number;
}

export const ROW1 = { standCy: 140, labelY: 172, stubTop: 178, stubBot: 190 } as const;
export const ROW2 = { standCy: 332, labelY: 364, stubTop: 288, stubBot: 306 } as const;

/**
 * A mark that is not square is sized by width at this ratio; the AWS wordmark
 * is the only one so far, and it appears twice — at gate B6 and again in the
 * margin provider row. Both entries carry their own literal `w`, and the spec
 * checks each against this ratio, so the two cannot drift apart.
 *
 * The number is not a taste call: it is the aspect of the artwork itself
 * (public/logos/providers/bedrock.svg, viewBox 0 0 256 153), and the spec reads
 * that file off disk to hold it there. Change it and the wordmark stretches.
 */
export const WIDE_RATIO = 1.67;

export interface Gate {
  readonly gate: string;
  readonly src: string;
  readonly name: string;
  /**
   * The unabbreviated name, when the 38px stand forced a short one. The plate
   * always draws `name`; the HTML stack — the band's only accessible content,
   * and its whole phone form — draws `long ?? name`, so a screen reader is
   * never handed an abbreviation that exists purely for the drawing.
   */
  readonly long?: string;
  /** Optical height. Deliberately per-mark; see the spec test. */
  readonly s: number;
  /** Optical width, for a wordmark that is not square: always `s * WIDE_RATIO`. */
  readonly w?: number;
  readonly x: number;
}

export const GATES_A: readonly Gate[] = [
  { gate: 'A1', src: '/logos/langgraph.svg', name: 'LANGGRAPH', s: 21, x: 318 },
];

export const GATES_B: readonly Gate[] = [
  { gate: 'B1', src: '/logos/ag-ui.svg', name: 'AG-UI', s: 19, x: 268 },
  { gate: 'B2', src: '/logos/runtimes/crewai.svg', name: 'CREWAI', s: 22, x: 380 },
  { gate: 'B3', src: '/logos/runtimes/mastra.svg', name: 'MASTRA', s: 16, x: 492 },
  { gate: 'B4', src: '/logos/runtimes/pydantic.svg', name: 'PYDANTIC AI', s: 21, x: 604 },
  {
    gate: 'B5',
    src: '/logos/runtimes/microsoft.svg',
    name: 'MS AGENT FWK',
    long: 'MICROSOFT AGENT FRAMEWORK',
    s: 19,
    x: 716,
  },
  // The AWS wordmark is not square, so it is the one mark sized by width. Both
  // numbers are written literally like every other value in this table; the
  // spec checks the pair against WIDE_RATIO, and WIDE_RATIO against the file.
  // Using it for Strands is honest — Strands is an AWS project. The rejected
  // alternative was the word "AWS" in Archivo Black, which out-weighed every
  // real logo on the plate.
  { gate: 'B6', src: '/logos/providers/bedrock.svg', name: 'AWS STRANDS', s: 12, w: 20, x: 828 },
];

/**
 * The whole pairing, stated once: each concourse owns a gate row, an apron, a
 * connector back to the main terminal and a side. `gatesAbove` is which side of
 * the concourse its gates hang on — row 1 sits above concourse A, row 2 below
 * concourse B — which the component needs to aim the stub tick and which the
 * spec needs to read the row's ordering. Anything that re-derives "A is the up
 * row", or re-pairs a concourse with its apron or its link, from the constant
 * names is a second copy of this table.
 */
export const CONCOURSES = [
  {
    id: 'A',
    label: 'CONCOURSE A',
    pkg: '@threadplane/langgraph',
    box: CONC_A,
    gates: GATES_A,
    row: ROW1,
    apron: APRON_A,
    link: LINK_A_Y,
    gatesAbove: true,
  },
  {
    id: 'B',
    label: 'CONCOURSE B',
    pkg: '@threadplane/ag-ui',
    box: CONC_B,
    gates: GATES_B,
    row: ROW2,
    apron: APRON_B,
    link: LINK_B_Y,
    gatesAbove: false,
  },
] as const;

export interface Provider {
  readonly src: string;
  readonly name: string;
  /**
   * Optical width, for a wordmark that is not square: always
   * `PROVIDER_ROW.size * WIDE_RATIO`. Same escape hatch as `Gate.w`, so the
   * component never has to ask which file a mark points at to know its shape.
   */
  readonly w?: number;
}

/**
 * Outside the neat line is outside the airport. The claim is rendered as
 * geometry rather than asserted in prose.
 *
 * "never talks to them", NOT "never sees it": never-sees is a data claim the
 * docs do not support. The adapters call your LangGraph or AG-UI endpoint,
 * never a model API — that is structural and true.
 *
 * These five marks knowingly repeat MODEL_STRIP in architecture-diagram.ts one
 * screen below. Accepted trade. Do not "fix" it there.
 */
export const OFF_AIRPORT_LABEL =
  'OFF AIRPORT — BEHIND YOUR BACKEND. THREADPLANE NEVER TALKS TO THEM.';
export const PROVIDERS: readonly Provider[] = [
  { src: '/logos/providers/openai.svg', name: 'OpenAI' },
  { src: '/logos/providers/anthropic.svg', name: 'Anthropic' },
  { src: '/logos/providers/google.svg', name: 'Google' },
  { src: '/logos/providers/azure.svg', name: 'Azure OpenAI' },
  { src: '/logos/providers/bedrock.svg', name: 'Amazon Bedrock', w: 33 },
];
/** `y` is the marks' centre line; each is `size` tall and `w` wide if it is a wordmark. */
export const PROVIDER_ROW = { y: 518, size: 20, x0: 30, step: 76, labelY: 492 } as const;

/** Chart furniture lives in the margin, never on the field. */
export const SCALE_BAR = { x0: 742, x1: 842, y: 512 } as const;
export const NORTH = { x: 960, y: 498 } as const;

/** The Threadplane glyph, identical to the path in ui/PlaneMark.tsx (64x64). */
export const PLANE_PATH = 'M4 34.5 58 6 40 58l-11.5-16.5L36 22 20 37.5z';

export const EYEBROW = 'AIRPORT DIAGRAM';
export const HEADLINE = 'Every stack has a gate.';
export const CHART_ID = ['THREADPLANE INTL (TPL)', 'ANGULAR · LANGGRAPH & AG-UI'] as const;
export const DISCLAIMER =
  'Compatibility, not endorsement — no company here is claimed as a customer.';
