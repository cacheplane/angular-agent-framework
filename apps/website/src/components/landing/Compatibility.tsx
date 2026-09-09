import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { AdapterGuideLink } from './AdapterGuideLink';
import {
  CHART_ID,
  CONCOURSES,
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
  VIEW,
  type Gate,
  type Row,
  type Runway as RunwayGeometry,
} from '../../lib/airport-diagram';

const R = STAND / 2;

function Runway({ y, h, left, right }: RunwayGeometry) {
  return (
    <g data-runway={left}>
      <rect className="ap-pavement" x={FIELD.x0} y={y} width={FIELD.x1 - FIELD.x0} height={h} />
      <text className="ap-rwy-id" x={FIELD.x0 + 18} y={y + h - 2.5}>
        {left}
      </text>
      <text className="ap-rwy-id" x={FIELD.x1 - 18} y={y + h - 2.5} textAnchor="end">
        {right}
      </text>
    </g>
  );
}

/** A stand: the stub off the concourse, the white box, the mark, the callsign. */
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
        <rect
          className="ap-gate-tab"
          x={gate.x - R - 1}
          y={cy - R - 8}
          width={19}
          height={11}
          rx={2}
        />
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
  for (let x = NEAT.x + TICK_X; x < NEAT.x + NEAT.width; x += TICK_X) {
    ticks.push(
      `M${x} ${NEAT.y} V${NEAT.y + 7}`,
      `M${x} ${NEAT.y + NEAT.height} V${NEAT.y + NEAT.height - 7}`,
    );
  }
  for (let y = NEAT.y + TICK_Y; y < NEAT.y + NEAT.height; y += TICK_Y) {
    ticks.push(
      `M${NEAT.x} ${y} H${NEAT.x + 7}`,
      `M${NEAT.x + NEAT.width} ${y} H${NEAT.x + NEAT.width - 7}`,
    );
  }
  const mx = (MAIN.x0 + MAIN.x1) / 2;
  const my = (MAIN.y0 + MAIN.y1) / 2;
  const glyph = 27;

  return (
    <svg
      className="ap-svg"
      data-diagram="airport"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      // The whole plate leaves the accessibility tree, not just its root:
      // role="presentation" is not inherited, so every <text> on it ("09L",
      // "2000 FT") would otherwise read out as unnamed chart noise. The
      // .airport-stack list below is the band's accessible content.
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id="ap-hatch"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
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
          <text className="ap-main-title" x={mx} y={my + 6} textAnchor="middle">
            &lt;chat&gt;
          </text>
          <text className="ap-main-sub" x={mx} y={my + 24} textAnchor="middle">
            MAIN TERMINAL
          </text>
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
            <text className="ap-conc-label" x={c.box.x0 + 15} y={c.box.y0 + 16.5}>
              {c.label}
            </text>
            <text className="ap-conc-pkg" x={c.box.x0 + 15} y={c.box.y0 + 29}>
              {c.pkg}
            </text>
          </g>
        ))}

        {CONCOURSES.flatMap((c) =>
          c.gates.map((g) => <Stand key={g.gate} gate={g} row={c.row} above={c.gatesAbove} />),
        )}
      </g>

      {/* Below the neat line is outside the airport. */}
      <text className="ap-off" x={NEAT.x} y={PROVIDER_ROW.labelY}>
        {OFF_AIRPORT_LABEL}
      </text>
      {PROVIDERS.map((p, i) => {
        // Which marks are wordmarks is the table's fact to state, never the
        // component's to re-derive from a filename.
        const w = p.w ?? PROVIDER_ROW.size;
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
        <text x={SCALE_BAR.x0} y={SCALE_BAR.y - 9}>
          0
        </text>
        <text x={SCALE_BAR.x1} y={SCALE_BAR.y - 9} textAnchor="end">
          2000 FT
        </text>
        <path
          className="ap-north"
          d={`M${NORTH.x} ${NORTH.y} L${NORTH.x + 7} ${NORTH.y + 20} L${NORTH.x} ${NORTH.y + 15} L${NORTH.x - 7} ${NORTH.y + 20} Z`}
        />
        <text x={NORTH.x} y={NORTH.y + 32} textAnchor="middle">
          N
        </text>
      </g>
    </svg>
  );
}

/**
 * The band is a chart, so the accessible content is a plain list beside it —
 * the same data, never a second source of truth. The plate is aria-hidden and
 * the list is the only carrier, which is why the desktop CSS hides the list
 * visually (clip-path, like .stage-skip) instead of with `display: none`:
 * take it out of the tree and the section is empty to a screen reader.
 */
export function Compatibility() {
  return (
    <Section surface="signal" id="compatibility" ariaLabelledBy="compatibility-heading">
      <Container>
        <header className="airport-head">
          <div>
            <p className="airport-eyebrow">{EYEBROW}</p>
            <h2 id="compatibility-heading" className="airport-heading">
              {HEADLINE}
            </h2>
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
              <ul
                className="airport-stack-gates"
                role="list"
                aria-labelledby={`airport-conc-${c.id}`}
              >
                {c.gates.map((g) => (
                  <li key={g.gate}>
                    <span className="airport-stack-gate">{g.gate}</span>
                    <img
                      className="airport-mark"
                      src={g.src}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                    {/* The plate draws `name` because a 38px stand has room for
                        nothing longer. This list has room, and it is what a
                        screen reader hears, so it spells the name out. */}
                    <span>{g.long ?? g.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="airport-stack-label">{OFF_AIRPORT_LABEL}</p>
          <ul className="airport-stack-providers" role="list">
            {PROVIDERS.map((p) => (
              <li key={p.name}>
                <img
                  className="airport-mark"
                  src={p.src}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="airport-footer">
          <AdapterGuideLink className="compatibility-link" />
        </div>
      </Container>
    </Section>
  );
}
