# Compatibility Airport Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage compatibility band's three hairline-separated logo groups with a full-bleed aviation-yellow FAA-style airport diagram, where the two adapters are concourses and the seven runtimes are marks parked at numbered gates.

**Architecture:** All geometry and content live in one new module, `apps/website/src/lib/airport-diagram.ts`, read by three consumers: the server component that draws the SVG, a unit spec that proves the geometry closes, and a Playwright spec that measures the rendered result. This is exactly the shape `src/lib/architecture-diagram.ts` already uses for the diagram in the next section — follow it rather than inventing a second pattern.

**Tech Stack:** Next.js App Router (React server components), inline SVG, vanilla CSS in `src/styles/landing.css`, Vitest + Testing Library for units, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-09-08-compatibility-airport-diagram-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/website/src/lib/airport-diagram.ts` (create) | Every coordinate, the rotation, the gate table with per-mark sizes, the provider list. No JSX. |
| `apps/website/src/lib/airport-diagram.spec.ts` (create) | Proves the geometry closes: rotated field inside the neat line, stands inside aprons, stubs meeting concourses, mark files present on disk. |
| `apps/website/src/components/landing/Compatibility.tsx` (rewrite) | Server component. Draws the plate and the phone stack from the module. |
| `apps/website/src/components/landing/Compatibility.spec.tsx` (rewrite) | The band's public contract: ids, decorative marks, adapter link, disclaimer, no-customer-claim scan. |
| `apps/website/src/styles/landing.css` (modify, ~2007–2075) | Replace the `.compatibility-*` block. |
| `apps/website/e2e/home-airport.spec.ts` (create) | Measures every rendered `<text>` and `<image>` against the structure that owns it. |

Nothing else on the homepage changes. In particular **do not touch `src/lib/architecture-diagram.ts`** — its `MODEL_STRIP` deliberately shows the same five provider marks, and its geometry is measured by `e2e/home-architecture.spec.ts`.

---

### Task 1: Geometry module

**Files:**
- Create: `apps/website/src/lib/airport-diagram.ts`
- Test: `apps/website/src/lib/airport-diagram.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/airport-diagram.spec.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APRON_A,
  APRON_B,
  CONC_A,
  CONC_B,
  FIELD,
  GATES_A,
  GATES_B,
  MAIN,
  NEAT,
  PROVIDERS,
  ROW1,
  ROW2,
  STAND,
  rotate,
} from './airport-diagram';

const WEBSITE = resolve(__dirname, '../..');

describe('airport diagram geometry', () => {
  it('keeps all four rotated field corners inside the neat line', () => {
    const corners = [
      [FIELD.x0, FIELD.y0],
      [FIELD.x1, FIELD.y0],
      [FIELD.x0, FIELD.y1],
      [FIELD.x1, FIELD.y1],
    ] as const;
    for (const [x, y] of corners) {
      const p = rotate(x, y);
      expect(p.x, `corner ${x},${y} left`).toBeGreaterThan(NEAT.x);
      expect(p.x, `corner ${x},${y} right`).toBeLessThan(NEAT.x + NEAT.width);
      expect(p.y, `corner ${x},${y} top`).toBeGreaterThan(NEAT.y);
      expect(p.y, `corner ${x},${y} bottom`).toBeLessThan(NEAT.y + NEAT.height);
    }
  });

  it('parks every stand inside its apron', () => {
    const r = STAND / 2;
    const rows = [
      { xs: GATES_A.map((g) => g.x), cy: ROW1.box, apron: APRON_A },
      { xs: GATES_B.map((g) => g.x), cy: ROW2.box, apron: APRON_B },
    ];
    for (const { xs, cy, apron } of rows) {
      for (const x of xs) {
        expect(x - r, `stand at ${x} left`).toBeGreaterThanOrEqual(apron.x0);
        expect(x + r, `stand at ${x} right`).toBeLessThanOrEqual(apron.x1);
        expect(cy - r, `stand at ${x} top`).toBeGreaterThanOrEqual(apron.y0);
        expect(cy + r, `stand at ${x} bottom`).toBeLessThanOrEqual(apron.y1);
      }
    }
  });

  it('lands every gate stub on the concourse it belongs to', () => {
    // Row 1 hangs above concourse A, row 2 below concourse B. If either stub
    // stops short the gates float, which reads as a drawing error.
    expect(ROW1.stubBot).toBe(CONC_A.y0);
    expect(ROW2.stubTop).toBe(CONC_B.y1);
    expect(ROW1.stubTop).toBeLessThan(ROW1.stubBot);
    expect(ROW2.stubTop).toBeLessThan(ROW2.stubBot);
  });

  it('keeps every gate within the span of its concourse', () => {
    for (const g of GATES_A) {
      expect(g.x, `${g.gate} x`).toBeGreaterThan(CONC_A.x0);
      expect(g.x, `${g.gate} x`).toBeLessThan(CONC_A.x1);
    }
    for (const g of GATES_B) {
      expect(g.x, `${g.gate} x`).toBeGreaterThan(CONC_B.x0);
      expect(g.x, `${g.gate} x`).toBeLessThan(CONC_B.x1);
    }
  });

  it('gives both concourses gates, so neither adapter can silently empty out', () => {
    // The two-adapter story IS the diagram. A concourse with no gates would
    // still render as a building and the section would quietly stop arguing.
    expect(GATES_A.length).toBeGreaterThan(0);
    expect(GATES_B.length).toBeGreaterThan(0);
  });

  it('sizes each mark individually, and only the AWS wordmark by width', () => {
    // One shared height reads wrong: Mastra is wide and heavy, Anthropic is a
    // narrow wedge. `w` is the escape hatch for the one 1.67:1 wordmark.
    const all = [...GATES_A, ...GATES_B];
    for (const g of all) expect(g.s, `${g.gate} size`).toBeGreaterThan(0);
    expect(all.filter((g) => g.w !== undefined).map((g) => g.gate)).toEqual(['B6']);
  });

  it('points every mark at a file that exists', () => {
    for (const src of [...GATES_A, ...GATES_B].map((g) => g.src).concat(PROVIDERS.map((p) => p.src))) {
      expect(existsSync(resolve(WEBSITE, 'public', src.slice(1))), src).toBe(true);
    }
  });

  it('places the main terminal west of both concourses', () => {
    expect(MAIN.x1).toBeLessThanOrEqual(CONC_A.x0);
    expect(MAIN.x1).toBeLessThanOrEqual(CONC_B.x0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test website -- airport-diagram`
Expected: FAIL — `Failed to resolve import "./airport-diagram"`.

- [ ] **Step 3: Write the module**

Create `apps/website/src/lib/airport-diagram.ts`:

```ts
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

export const RWY_N = { y: 58, h: 11, left: '09L', right: '27R' } as const;
export const RWY_S = { y: 408, h: 11, left: '09R', right: '27L' } as const;
export const TWY_N = 100;
export const TWY_S = 386;
export const TWY_E = 930;

export const MAIN = { x0: 56, x1: 188, y0: 190, y1: 288 } as const;
export const CONC_A = { x0: 204, x1: 432, y0: 190, y1: 224 } as const;
export const CONC_B = { x0: 204, x1: 900, y0: 254, y1: 288 } as const;
export const LINK_A_Y = 206;
export const LINK_B_Y = 270;

export const APRON_A = { x0: 232, x1: 440, y0: 112, y1: 186 } as const;
export const APRON_B = { x0: 232, x1: 910, y0: 292, y1: 372 } as const;

/** Stand box side, and the two gate rows that hang off the concourses. */
export const STAND = 38;
export const ROW1 = { box: 140, name: 172, stubTop: 178, stubBot: 190 } as const;
export const ROW2 = { box: 332, name: 364, stubTop: 288, stubBot: 306 } as const;

export interface Gate {
  readonly gate: string;
  readonly src: string;
  readonly name: string;
  /** Optical height. Deliberately per-mark; see the spec test. */
  readonly s: number;
  /** Optical width, for wordmarks that are not square. B6 only. */
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
  { gate: 'B5', src: '/logos/runtimes/microsoft.svg', name: 'MS AGENT FWK', s: 19, x: 716 },
  // The AWS wordmark is 1.67:1, so it is the one mark sized by width. Using it
  // for Strands is honest — Strands is an AWS project. The rejected
  // alternative was the word "AWS" in Archivo Black, which out-weighed every
  // real logo on the plate.
  { gate: 'B6', src: '/logos/providers/bedrock.svg', name: 'AWS STRANDS', s: 12, w: 30, x: 828 },
];

export const CONCOURSES = [
  { id: 'A', label: 'CONCOURSE A', pkg: '@threadplane/langgraph', box: CONC_A, gates: GATES_A },
  { id: 'B', label: 'CONCOURSE B', pkg: '@threadplane/ag-ui', box: CONC_B, gates: GATES_B },
] as const;

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
export const PROVIDERS = [
  { src: '/logos/providers/openai.svg', name: 'OpenAI' },
  { src: '/logos/providers/anthropic.svg', name: 'Anthropic' },
  { src: '/logos/providers/google.svg', name: 'Google' },
  { src: '/logos/providers/azure.svg', name: 'Azure OpenAI' },
  { src: '/logos/providers/bedrock.svg', name: 'Amazon Bedrock' },
] as const;
export const PROVIDER_ROW = { y: 518, size: 20, x0: 30, step: 76, labelY: 492 } as const;
/** The AWS mark again, in the margin. Same 1.67:1 ratio. */
export const WIDE_RATIO = 1.67;

/** Chart furniture lives in the margin, never on the field. */
export const SCALE_BAR = { x0: 742, x1: 842, y: 512 } as const;
export const NORTH = { x: 960, y: 498 } as const;

/** The Threadplane glyph, identical to the path in ui/PlaneMark.tsx (64x64). */
export const PLANE_PATH = 'M4 34.5 58 6 40 58l-11.5-16.5L36 22 20 37.5z';

export const EYEBROW = 'AIRPORT DIAGRAM';
export const HEADLINE = 'Every stack has a gate.';
export const CHART_ID = ['THREADPLANE INTL  (TPL)', 'ANGULAR · LANGGRAPH & AG-UI'] as const;
export const DISCLAIMER =
  'Compatibility, not endorsement — no company here is claimed as a customer.';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test website -- airport-diagram`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/airport-diagram.ts apps/website/src/lib/airport-diagram.spec.ts
git commit -m "feat(website): geometry module for the compatibility airport diagram"
```

---

### Task 2: The plate

**Files:**
- Modify: `apps/website/src/components/landing/Compatibility.tsx` (full rewrite)
- Test: `apps/website/src/components/landing/Compatibility.spec.tsx` (full rewrite)

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `apps/website/src/components/landing/Compatibility.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Compatibility } from './Compatibility';
import { GATES_A, GATES_B, PROVIDERS } from '../../lib/airport-diagram';

describe('Compatibility', () => {
  it('renders the signal surface with the ids the homepage spine depends on', () => {
    // e2e/website.spec.ts asserts homepage order by heading id. Renaming
    // either of these turns that spec red for a reason nobody will guess.
    const { container } = render(<Compatibility />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('signal');
    expect(section?.getAttribute('id')).toBe('compatibility');
    expect(section?.getAttribute('aria-labelledby')).toBe('compatibility-heading');
    expect(container.querySelector('#compatibility-heading')?.textContent).toBe(
      'Every stack has a gate.',
    );
  });

  it('names every gate and every provider in text, not only as a picture', () => {
    // The marks are decorative, so the accessible content is these names. If
    // the SVG were the only carrier the section would be empty to a reader.
    render(<Compatibility />);
    for (const g of [...GATES_A, ...GATES_B]) {
      expect(screen.getAllByText(g.name).length).toBeGreaterThan(0);
    }
    for (const p of PROVIDERS) {
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0);
    }
  });

  it('shows both adapters as the two concourses', () => {
    render(<Compatibility />);
    expect(screen.getAllByText('@threadplane/langgraph').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@threadplane/ag-ui').length).toBeGreaterThan(0);
  });

  it('marks every logo decorative, since the visible name carries the meaning', () => {
    const { container } = render(<Compatibility />);
    const marks = container.querySelectorAll('image, img.airport-mark');
    expect(marks.length).toBeGreaterThan(0);
    for (const m of Array.from(marks)) {
      expect(m.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('states compatibility in words and never implies a customer', () => {
    const { container } = render(<Compatibility />);
    expect(screen.getByText(/Compatibility, not endorsement/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('says Threadplane never talks to model providers, not that it never sees them', () => {
    // never-SEES is a data claim the docs do not support; never-TALKS-TO is
    // structural. This is the same failure mode #1067 had to correct.
    const { container } = render(<Compatibility />);
    expect(container.textContent).toMatch(/never talks to them/i);
    expect(container.textContent).not.toMatch(/never sees/i);
  });

  it('links to the adapter guide', () => {
    render(<Compatibility />);
    expect(
      screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href'),
    ).toBe('/docs/choosing-an-adapter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test website -- Compatibility`
Expected: FAIL — `data-surface` is `"tinted"`, and the heading is `"Your backend, your models, your runtime."`.

- [ ] **Step 3: Write the component**

Replace the entire contents of `apps/website/src/components/landing/Compatibility.tsx`:

```tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { AdapterGuideLink } from './AdapterGuideLink';
import {
  CHART_ID,
  CONCOURSES,
  DISCLAIMER,
  EYEBROW,
  FIELD,
  HEADLINE,
  MAIN,
  NEAT,
  NORTH,
  OFF_AIRPORT_LABEL,
  PIVOT,
  PLANE_PATH,
  PROVIDERS,
  PROVIDER_ROW,
  ROT,
  RWY_N,
  RWY_S,
  SCALE_BAR,
  STAND,
  TICK_X,
  TICK_Y,
  TWY_E,
  TWY_N,
  TWY_S,
  VIEW,
  WIDE_RATIO,
  type Gate,
} from '../../lib/airport-diagram';

const R = STAND / 2;

function Runway({ y, h, left, right }: typeof RWY_N | typeof RWY_S) {
  return (
    <g data-runway={left}>
      <rect className="ap-pavement" x={FIELD.x0} y={y} width={FIELD.x1 - FIELD.x0} height={h} />
      <text className="ap-rwy-id" x={FIELD.x0 + 18} y={y + h - 2.5}>{left}</text>
      <text className="ap-rwy-id" x={FIELD.x1 - 18} y={y + h - 2.5} textAnchor="end">{right}</text>
    </g>
  );
}

function TaxiwayLetter({ x, y, ch }: { x: number; y: number; ch: string }) {
  return (
    <g>
      <circle className="ap-twy-disc" cx={x} cy={y} r={7.5} />
      <text className="ap-twy-letter" x={x} y={y + 3.4} textAnchor="middle">{ch}</text>
    </g>
  );
}

/** A stand: the stub off the concourse, the white box, the mark, the callsign. */
type Row = (typeof CONCOURSES)[number]['row'];

function Stand({ gate, row, above }: { gate: Gate; row: Row; above: boolean }) {
  const cy = row.standCy;
  const tick = above ? row.stubTop : row.stubBot;
  const iw = gate.w ?? gate.s;
  return (
    <g data-stand={gate.gate}>
      <path className="ap-stub" d={`M${gate.x} ${row.stubTop} V${row.stubBot}`} />
      <path className="ap-stub" d={`M${gate.x - 9} ${tick} H${gate.x + 9}`} />
      {/* Counter-rotated so the mark and its callsign stay upright while the
          airfield sits at its heading. */}
      <g transform={`rotate(${-ROT} ${gate.x} ${cy})`}>
        <rect
          className="ap-stand-box"
          data-stand-box={gate.gate}
          x={gate.x - R}
          y={cy - R}
          width={STAND}
          height={STAND}
          rx={3}
        />
        <image
          href={gate.src}
          aria-hidden="true"
          x={gate.x - iw / 2}
          y={cy - gate.s / 2}
          width={iw}
          height={gate.s}
          preserveAspectRatio="xMidYMid meet"
        />
        <rect className="ap-gate-tab" x={gate.x - R - 1} y={cy - R - 8} width={19} height={11} rx={2} />
        <text className="ap-gate-id" x={gate.x - R + 8.5} y={cy - R - 0.5} textAnchor="middle">
          {gate.gate}
        </text>
        <text className="ap-callsign" x={gate.x} y={row.labelY} textAnchor="middle">
          {gate.name}
        </text>
      </g>
    </g>
  );
}

function Plate() {
  const ticks: string[] = [];
  for (let x = TICK_X; x < VIEW.width; x += TICK_X) {
    ticks.push(`M${x} ${NEAT.y} V${NEAT.y + 7}`, `M${x} ${NEAT.y + NEAT.height} V${NEAT.y + NEAT.height - 7}`);
  }
  for (let y = TICK_Y; y < NEAT.y + NEAT.height; y += TICK_Y) {
    ticks.push(`M${NEAT.x} ${y} H${NEAT.x + 7}`, `M${NEAT.x + NEAT.width} ${y} H${NEAT.x + NEAT.width - 7}`);
  }
  const mx = (MAIN.x0 + MAIN.x1) / 2;
  const my = (MAIN.y0 + MAIN.y1) / 2;
  const glyph = 27;

  return (
    <svg
      className="ap-svg"
      data-diagram="airport"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="presentation"
      focusable="false"
    >
      <defs>
        <pattern id="ap-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line className="ap-hatch-line" x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>

      <rect className="ap-neat" x={NEAT.x} y={NEAT.y} width={NEAT.width} height={NEAT.height} />
      <path className="ap-tick" d={ticks.join(' ')} />

      <g transform={`rotate(${ROT} ${PIVOT.x} ${PIVOT.y})`}>
        {CONCOURSES.map(({ id, apron }) => (
          <rect
            key={id}
            className="ap-apron"
            x={apron.x0}
            y={apron.y0}
            width={apron.x1 - apron.x0}
            height={apron.y1 - apron.y0}
          />
        ))}

        <Runway {...RWY_N} />
        <Runway {...RWY_S} />

        <path className="ap-taxiway" d={`M${FIELD.x0} ${TWY_N} H${FIELD.x1}`} />
        <path className="ap-taxiway" d={`M${FIELD.x0} ${TWY_S} H${FIELD.x1}`} />
        <path className="ap-taxiway" d={`M${TWY_E} ${TWY_N} V${TWY_S}`} />
        <TaxiwayLetter x={500} y={TWY_N} ch="N" />
        <TaxiwayLetter x={500} y={TWY_S} ch="S" />
        <TaxiwayLetter x={TWY_E} y={PIVOT.y} ch="E" />

        {/* The one structure that IS Threadplane: solid ink. Partner stands are
            white, so the two values carry the meaning with no legend. */}
        <rect
          className="ap-main"
          data-main-terminal
          x={MAIN.x0}
          y={MAIN.y0}
          width={MAIN.x1 - MAIN.x0}
          height={MAIN.y1 - MAIN.y0}
          rx={3}
        />
        <g transform={`rotate(${-ROT} ${mx} ${my})`}>
          <g transform={`translate(${mx - glyph / 2} ${my - 26 - glyph / 2}) scale(${glyph / 64})`}>
            <path className="ap-plane" d={PLANE_PATH} />
          </g>
          <text className="ap-main-title" x={mx} y={my + 6} textAnchor="middle">&lt;chat&gt;</text>
          <text className="ap-main-sub" x={mx} y={my + 24} textAnchor="middle">MAIN TERMINAL</text>
        </g>

        {CONCOURSES.map((c) => (
          <path key={c.id} className="ap-link" d={`M${MAIN.x1} ${c.link} H${c.box.x0}`} />
        ))}

        {CONCOURSES.map((c) => (
          <g key={c.id} data-concourse={c.id}>
            <rect
              className="ap-conc"
              data-conc-box={c.id}
              x={c.box.x0}
              y={c.box.y0}
              width={c.box.x1 - c.box.x0}
              height={c.box.y1 - c.box.y0}
            />
            <rect
              className="ap-conc-plate"
              x={c.box.x0 + 9}
              y={c.box.y0 + 6}
              width={6.6 * c.label.length + 13}
              height={14}
            />
            <text className="ap-conc-label" x={c.box.x0 + 15} y={c.box.y0 + 16.5}>{c.label}</text>
            <text className="ap-conc-pkg" x={c.box.x0 + 15} y={c.box.y0 + 29}>{c.pkg}</text>
          </g>
        ))}

        {CONCOURSES.flatMap((c) =>
          c.gates.map((g) => (
            <Stand key={g.gate} gate={g} row={c.row} above={c.gatesAbove} />
          )),
        )}
      </g>

      {/* Below the neat line is outside the airport. */}
      <text className="ap-off" x={NEAT.x} y={PROVIDER_ROW.labelY}>{OFF_AIRPORT_LABEL}</text>
      {PROVIDERS.map((p, i) => {
        const wide = p.src.endsWith('bedrock.svg');
        const w = wide ? PROVIDER_ROW.size * WIDE_RATIO : PROVIDER_ROW.size;
        const x = PROVIDER_ROW.x0 + i * PROVIDER_ROW.step;
        return (
          <image
            key={p.name}
            href={p.src}
            aria-hidden="true"
            x={x - w / 2}
            y={PROVIDER_ROW.y - PROVIDER_ROW.size / 2}
            width={w}
            height={PROVIDER_ROW.size}
            preserveAspectRatio="xMidYMid meet"
          />
        );
      })}

      <g className="ap-furniture">
        <path d={`M${SCALE_BAR.x0} ${SCALE_BAR.y} H${SCALE_BAR.x1}`} />
        <path
          d={`M${SCALE_BAR.x0} ${SCALE_BAR.y - 4} V${SCALE_BAR.y + 4} M${(SCALE_BAR.x0 + SCALE_BAR.x1) / 2} ${SCALE_BAR.y - 4} V${SCALE_BAR.y + 4} M${SCALE_BAR.x1} ${SCALE_BAR.y - 4} V${SCALE_BAR.y + 4}`}
        />
        <text x={SCALE_BAR.x0} y={SCALE_BAR.y - 9}>0</text>
        <text x={SCALE_BAR.x1} y={SCALE_BAR.y - 9} textAnchor="end">2000 FT</text>
        <path
          className="ap-north"
          d={`M${NORTH.x} ${NORTH.y} L${NORTH.x + 7} ${NORTH.y + 20} L${NORTH.x} ${NORTH.y + 15} L${NORTH.x - 7} ${NORTH.y + 20} Z`}
        />
        <text x={NORTH.x} y={NORTH.y + 32} textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

/**
 * The band is a chart, so the accessible content is a plain list beside it —
 * the same data, never a second source of truth.
 */
export function Compatibility() {
  return (
    <Section surface="signal" id="compatibility" ariaLabelledBy="compatibility-heading">
      <Container>
        <header className="airport-head">
          <div>
            <p className="airport-eyebrow">{EYEBROW}</p>
            <h2 id="compatibility-heading" className="airport-heading">{HEADLINE}</h2>
          </div>
          <p className="airport-chart-id">
            {CHART_ID[0]}
            <br />
            {CHART_ID[1]}
          </p>
        </header>

        <figure className="airport-figure">
          <Plate />
        </figure>

        <div className="airport-stack">
          {CONCOURSES.map((c) => (
            <div className="airport-stack-group" key={c.id}>
              <p className="airport-stack-label" id={`airport-conc-${c.id}`}>
                {c.label} — {c.pkg}
              </p>
              <ul className="airport-stack-gates" role="list" aria-labelledby={`airport-conc-${c.id}`}>
                {c.gates.map((g) => (
                  <li key={g.gate}>
                    <span className="airport-stack-gate">{g.gate}</span>
                    <img className="airport-mark" src={g.src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    <span>{g.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="airport-stack-label">{OFF_AIRPORT_LABEL}</p>
          <ul className="airport-stack-providers" role="list">
            {PROVIDERS.map((p) => (
              <li key={p.name}>
                <img className="airport-mark" src={p.src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="airport-footer">
          <AdapterGuideLink className="compatibility-link" />
          <p className="compatibility-disclaimer">{DISCLAIMER}</p>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test website -- Compatibility`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/Compatibility.tsx apps/website/src/components/landing/Compatibility.spec.tsx
git commit -m "feat(website): draw the compatibility band as an airport diagram"
```

---

### Task 3: Styles

**Files:**
- Modify: `apps/website/src/styles/landing.css` (replace the `.compatibility-*` block, currently ~2007–2075)

- [ ] **Step 1: Delete the old block**

Delete every rule from `.compatibility-groups` through `.compatibility-disclaimer` inclusive, along with the `/* Compatibility — light ground on purpose... */` comment above it. That comment is now wrong: the ground is deliberately aviation yellow, which is what makes the marks legible bare.

Keep `.compatibility-link` and `.compatibility-disclaimer` as class *names* — `AdapterGuideLink` replaces its `className` rather than appending, so without a rule the anchor renders as plain body text.

- [ ] **Step 2: Add the new block**

Insert in the same position:

```css
/* Compatibility — an FAA-style airport diagram on the signal surface
 * (spec: docs/superpowers/specs/2026-09-08-compatibility-airport-diagram-design.md).
 *
 * The yellow ground is load-bearing, not decoration: every mark here is a dark
 * logo drawn for a light ground (Anthropic #181818, CrewAI and Pydantic
 * #111827, LangGraph #1C3C3C), so they render bare with no chip. That is why
 * these marks were invisible on the dark band before #1067 split them out.
 *
 * Two values carry the meaning with no legend: partner stands are white,
 * the main terminal — Threadplane — is ink. */
.airport-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 18px;
  margin-bottom: 40px;
  border-bottom: 1.5px solid var(--color-border-strong);
}
.airport-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.17em;
  color: var(--color-text-muted);
  margin: 0 0 13px;
}
.airport-heading {
  font-family: var(--font-display);
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.02;
  letter-spacing: -0.018em;
  margin: 0;
  max-width: 12ch;
}
.airport-chart-id {
  text-align: right;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.13em;
  line-height: 2;
  white-space: nowrap;
  color: var(--color-text-muted);
  margin: 0;
}
.airport-figure {
  margin: 0;
}
.ap-svg {
  display: block;
  width: 100%;
  height: auto;
}

/* Airfield */
.ap-neat {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.4;
}
.ap-tick {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1;
  opacity: 0.6;
}
.ap-pavement {
  fill: var(--color-ink);
}
.ap-rwy-id {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  fill: var(--color-signal);
}
.ap-taxiway,
.ap-stub,
.ap-link {
  fill: none;
  stroke: var(--color-ink);
}
.ap-taxiway {
  stroke-width: 1.6;
}
.ap-stub {
  stroke-width: 1.4;
}
.ap-link {
  stroke-width: 3.5;
}
.ap-twy-disc {
  fill: var(--color-signal);
  stroke: var(--color-ink);
  stroke-width: 1.2;
}
.ap-twy-letter {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  fill: var(--color-ink);
}
.ap-apron {
  fill: none;
  stroke: rgba(10, 10, 10, 0.3);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}
.ap-hatch-line {
  stroke: var(--color-ink);
  stroke-width: 0.9;
  opacity: 0.7;
}

/* Buildings */
.ap-main {
  fill: var(--color-ink);
}
.ap-plane {
  fill: var(--color-signal);
}
.ap-main-title {
  font-family: var(--font-display);
  font-size: 20px;
  fill: var(--color-signal);
}
.ap-main-sub {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  fill: rgba(255, 175, 0, 0.66);
}
.ap-conc {
  fill: url(#ap-hatch);
  stroke: var(--color-ink);
  stroke-width: 1.4;
}
.ap-conc-plate {
  fill: var(--color-signal);
}
.ap-conc-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  fill: var(--color-ink);
}
.ap-conc-pkg {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  fill: rgba(10, 10, 10, 0.78);
}

/* Stands */
.ap-stand-box {
  fill: #ffffff;
  stroke: var(--color-ink);
  stroke-width: 1.5;
}
.ap-gate-tab {
  fill: var(--color-ink);
}
.ap-gate-id {
  font-family: var(--font-mono);
  font-size: 7.5px;
  font-weight: 700;
  fill: var(--color-signal);
}
.ap-callsign {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 1px;
  fill: rgba(10, 10, 10, 0.74);
}

/* Margin */
.ap-off {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.11em;
  fill: var(--color-text-muted);
}
.ap-furniture {
  opacity: 0.7;
}
.ap-furniture path {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.2;
}
.ap-furniture .ap-north {
  fill: var(--color-ink);
  stroke: none;
}
.ap-furniture text {
  font-family: var(--font-mono);
  font-size: 7.5px;
  font-weight: 700;
  fill: var(--color-ink);
}

/* Footer */
.airport-footer {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  border-top: 1.5px solid var(--color-border-strong);
  margin-top: 26px;
  padding-top: 18px;
}
/* AdapterGuideLink REPLACES its className rather than appending, so without a
 * rule here the anchor renders as plain body text. On the signal surface
 * --color-accent resolves to ink, which is 10.73:1 on the yellow ground. */
.compatibility-link {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-accent);
}
.compatibility-link:hover,
.compatibility-link:focus-visible {
  color: var(--color-accent-hover);
}
.compatibility-disclaimer {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
}
```

- [ ] **Step 3: Verify the styles compile and the suite still passes**

Run: `npx nx test website -- Compatibility`
Expected: PASS, 7 tests. (CSS is not under test here; this confirms nothing regressed.)

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/landing.css
git commit -m "style(website): airport-diagram styles for the compatibility band"
```

---

### Task 4: Phone form

**Files:**
- Modify: `apps/website/src/styles/landing.css` (append to the block from Task 3)
- Test: `apps/website/src/components/landing/Compatibility.spec.tsx` (add one test)

The markup already exists from Task 2 (`.airport-stack`). This task makes the swap real and guards it.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('Compatibility', ...)` in `apps/website/src/components/landing/Compatibility.spec.tsx`:

```tsx
  it('ships a phone form driven by the same gate table as the plate', () => {
    // A seven-stand rotated airfield has no 390px form. The precedent is
    // .arch-stack: hide the figure under 768px and show an HTML list built
    // from the same data, never a sideways scroll.
    const { container } = render(<Compatibility />);
    expect(container.querySelector('.airport-figure')).toBeTruthy();
    const stack = container.querySelector('.airport-stack');
    expect(stack).toBeTruthy();
    const items = stack!.querySelectorAll('.airport-stack-gates li');
    expect(items).toHaveLength(GATES_A.length + GATES_B.length);
    expect(screen.getByRole('list', { name: /CONCOURSE A/ })).toBeTruthy();
    expect(screen.getByRole('list', { name: /CONCOURSE B/ })).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npx nx test website -- Compatibility`
Expected: PASS — the markup landed in Task 2. If it FAILS, the Task 2 markup was altered; restore `.airport-stack` before continuing.

- [ ] **Step 3: Add the breakpoint**

Append to the block added in Task 3 in `apps/website/src/styles/landing.css`:

```css
/* Phone form: the same gates as an HTML list, driven by the same data.
 * The plate is hidden here instead of scrolled sideways — the .arch-stack
 * precedent from the architecture diagram.
 *
 * VISUALLY hidden on desktop, never `display: none`. The plate is
 * aria-hidden, and the five provider names exist ONLY in this list, so
 * display:none would leave the whole band with no accessible content on
 * desktop. Same idiom as .stage-skip above. */
.airport-stack {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 767px) {
  .airport-figure {
    display: none;
  }
  .airport-stack {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
    clip-path: none;
    white-space: normal;
    margin-top: 8px;
  }
  .airport-head {
    display: block;
  }
  .airport-chart-id {
    text-align: left;
    margin-top: 16px;
  }
}
.airport-stack-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--color-text-secondary);
  margin: 22px 0 10px;
}
.airport-stack-gates,
.airport-stack-providers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.airport-stack-providers {
  grid-template-columns: repeat(2, 1fr);
}
.airport-stack-gates li,
.airport-stack-providers li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.airport-stack-gate {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: var(--color-ink);
  color: var(--color-signal);
  border-radius: 2px;
  padding: 3px 5px;
}
.airport-mark {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
```

- [ ] **Step 4: Run the whole website unit suite**

Run: `npx nx test website`
Expected: PASS. No other spec references `COMPATIBILITY_GROUPS` — if one does, it is a stale import and should be removed, not re-exported.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/styles/landing.css apps/website/src/components/landing/Compatibility.spec.tsx
git commit -m "feat(website): phone form for the compatibility airport diagram"
```

---

### Task 5: Overflow e2e

**Files:**
- Create: `apps/website/e2e/home-airport.spec.ts`

This session found four separate collisions by eye — gate numbers over package labels, a taxiway drawn through the main terminal, sub-labels rendering outside a 26px concourse, the scale bar on top of runway 09R. Eyes do not scale.

- [ ] **Step 1: Write the failing test**

Create `apps/website/e2e/home-airport.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { CONC_A, CONC_B } from '../src/lib/airport-diagram';

const PLATE = '[data-diagram="airport"]';
const concAJson = { x0: CONC_A.x0, x1: CONC_A.x1, y0: CONC_A.y0, y1: CONC_A.y1 };
const concBJson = { x0: CONC_B.x0, x1: CONC_B.x1, y0: CONC_B.y0, y1: CONC_B.y1 };

/**
 * getBBox reports SVG user space, so these numbers compare directly with
 * lib/airport-diagram.ts. The unit spec proves the boxes close; this proves
 * the type set inside and beside them does not collide or escape the frame.
 */
async function report(page: Page) {
  return page.evaluate(
    ({ sel, concA, concB }) => {
      const issues: string[] = [];
      const box = (el: SVGGraphicsElement) => el.getBBox();

      // Concourse labels must stay inside the building they label. The first
      // draft put an 8.5px sub-label 33px down a 26px-tall concourse, so it
      // rendered below the building entirely.
      for (const [id, b] of [
        ['A', concA],
        ['B', concB],
      ] as const) {
        const g = document.querySelector<SVGGElement>(`${sel} [data-concourse="${id}"]`);
        if (!g) {
          issues.push(`concourse ${id} missing`);
          continue;
        }
        for (const t of g.querySelectorAll<SVGTextElement>('text')) {
          const r = box(t);
          if (r.y < b.y0 || r.y + r.height > b.y1 || r.x < b.x0 || r.x + r.width > b.x1) {
            issues.push(`concourse ${id} label "${t.textContent}" escapes ${b.x0},${b.y0}-${b.x1},${b.y1}`);
          }
        }
      }

      // Every mark must sit inside its own stand box.
      for (const s of document.querySelectorAll<SVGGElement>(`${sel} [data-stand]`)) {
        const rect = s.querySelector<SVGRectElement>('[data-stand-box]');
        const img = s.querySelector<SVGImageElement>('image');
        if (!rect || !img) {
          issues.push(`${s.dataset['stand']}: missing box or mark`);
          continue;
        }
        const b = box(rect);
        const m = box(img);
        if (m.x < b.x || m.y < b.y || m.x + m.width > b.x + b.width || m.y + m.height > b.y + b.height) {
          issues.push(`${s.dataset['stand']}: mark escapes its stand`);
        }
      }

      // No two callsigns may overlap horizontally.
      const calls = Array.from(document.querySelectorAll<SVGTextElement>(`${sel} .ap-callsign`))
        .map((t) => ({ t: t.textContent ?? '', r: box(t) }))
        .sort((a, b2) => a.r.x - b2.r.x);
      for (let i = 1; i < calls.length; i += 1) {
        const prev = calls[i - 1];
        const cur = calls[i];
        if (prev.r.x + prev.r.width > cur.r.x) {
          issues.push(`callsigns overlap: "${prev.t}" / "${cur.t}"`);
        }
      }
      return issues;
    },
    { sel: PLATE, concA: concAJson, concB: concBJson },
  );
}

test('airport plate renders every label inside the structure that owns it', async ({ page }) => {
  await page.goto('/');
  await page.locator(PLATE).scrollIntoViewIfNeeded();
  await expect(page.locator(PLATE)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await report(page)).toEqual([]);
});

test('airport plate keeps the whole drawing inside its viewBox', async ({ page }) => {
  await page.goto('/');
  await page.locator(PLATE).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const b = await page.evaluate((sel) => {
    const r = document.querySelector<SVGSVGElement>(sel)!.getBBox();
    return { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height };
  }, PLATE);
  expect(b.left).toBeGreaterThanOrEqual(0);
  expect(b.top).toBeGreaterThanOrEqual(0);
  expect(b.right).toBeLessThanOrEqual(1000);
  expect(b.bottom).toBeLessThanOrEqual(536);
});

test('the compatibility band does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const section = page.locator('#compatibility');
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator('.airport-stack')).toBeVisible();
  await expect(page.locator('.airport-figure')).toBeHidden();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
```

- [ ] **Step 2: Run the e2e to verify it passes**

Run: `npx playwright test --config=apps/website/playwright.config.ts e2e/home-airport.spec.ts`

(Do NOT use `npx nx e2e website -- <spec>` — this Nx version mangles the `--` passthrough into `unknown option '--_=<spec>'`. Also free ports 4308/4399/4506 first; a failing run leaves orphaned servers and the next run dies on `already used`.)
Expected: PASS, 3 tests.

If the first test reports issues, **fix the geometry in `airport-diagram.ts`, not the assertion.** The whole point of this spec is that it is the arbiter.

- [ ] **Step 3: Run the homepage spine e2e, which must be untouched**

Run: `npx playwright test --config=apps/website/playwright.config.ts e2e/website.spec.ts`
Expected: PASS. `compatibility-heading` must still appear between `proof-heading` and `architecture-heading`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/e2e/home-airport.spec.ts
git commit -m "test(website): measure the airport plate's geometry in the browser"
```

---

### Task 6: Verify in the browser

**Files:** none — this is a verification gate.

- [ ] **Step 1: Start the dev server and open the band**

Use the Browser pane's `preview_start` with the website's `.claude/launch.json` entry. Never run the dev server through Bash.

- [ ] **Step 2: Check the console and network are clean**

Read console messages and network requests. Every mark in the gate table and the provider row must return 200 — a 404 renders as nothing at all inside an otherwise correct-looking stand, which is invisible in a screenshot.

- [ ] **Step 3: Check both forms**

Screenshot at desktop width, then `resize_window` to the mobile preset and reload. The plate must be hidden and the gate list visible, with no horizontal scroll.

- [ ] **Step 4: Run lint and the full website suite**

```bash
npx nx lint website
npx nx test website
```

Expected: both PASS. Strip ANSI before grepping lint output, and note that lint **warnings** are not failures — only errors are.

- [ ] **Step 5: Commit any fixes and open the PR**

```bash
git add -A
git commit -m "fix(website): airport diagram review fixes"
```

Open the PR against `main`. Auto-merge should only be armed after the branch is rebased on current `origin/main` — an all-green PR that is BEHIND sits open indefinitely.

---

## Notes for the implementer

- **Do not reintroduce `COMPATIBILITY_GROUPS`.** The old export is deleted; the gate table replaces it.
- **Do not edit `src/lib/architecture-diagram.ts`.** Its `MODEL_STRIP` shows the same five provider marks one screen below, and that duplication is a recorded decision, not a bug. Its geometry is measured by `e2e/home-architecture.spec.ts`.
- **Per-mark sizes are data, not styling.** They live in `airport-diagram.ts` and are guarded. Do not collapse them into one CSS `height`.
- **`--font-display` is Archivo Black: single weight, no italic.** Never emit `font-weight` or `font-style: italic` on it.
- **`font-vars.spec.ts` fails if a stylesheet references a `--font-*` var `layout.tsx` does not supply.** The new CSS uses only `--font-mono`, `--font-display` and `--font-sans`, all of which are supplied.
