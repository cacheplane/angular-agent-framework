// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  CODING_AGENT_PROMPT,
  COMPONENT_SNIPPET,
  RENDER_SNIPPET,
  formatAngularRange,
  HERO_EYEBROW,
  HERO_H1,
  HERO_H1_LINES,
  HERO_PRIMARY_LABEL,
  HERO_SECONDARY_HREF,
  HERO_SECONDARY_LABEL,
  HERO_SUBHEAD,
  HERO_SUBHEAD_SEGMENTS,
  HERO_TRUST_LINE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INSTALL_OPTIONS,
  STAGE_CLOSE,
  STAGE_HOLD_LINE,
  STAGE_RAIL,
} from './positioning';
import { STAGE_BEATS } from './stage-beats';
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../components/pricing/angular-support.mjs';
import { resolveWebsiteDir } from './website-dir';

const repoRoot = path.resolve(resolveWebsiteDir(), '..', '..');
const libsDir = path.join(repoRoot, 'libs');

function readPkg(dir: string): { name: string; license?: string; peerDependencies?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

const workspacePkgs = fs
  .readdirSync(libsDir)
  .filter((d) => fs.existsSync(path.join(libsDir, d, 'package.json')))
  .map((d) => readPkg(path.join(libsDir, d)));

function parses(code: string): boolean {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  return (sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length === 0;
}

describe('positioning: hero copy', () => {
  it('names the exact category in eyebrow, H1, title and description', () => {
    expect(HERO_EYEBROW).toBe('Angular · LangGraph & AG-UI');
    expect(HERO_H1).toBe('The open-source thread-plane for agents.');
    expect(HERO_SUBHEAD).toBe(
      'Chat, durable threads, persistence, human approvals, and generative UI for Angular, on LangGraph and AG-UI. Your backend stays where it is.',
    );
    expect(HOME_TITLE).toBe('Threadplane — The open-source thread-plane for agents');
    expect(HOME_DESCRIPTION).toBe(
      'The open-source thread-plane for agents: chat, durable threads, persistence, human approvals, and generative UI for Angular, on LangGraph and AG-UI.',
    );
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it('H1 lines join back to HERO_H1 on three lines', () => {
    expect(HERO_H1_LINES).toHaveLength(3);
    expect(HERO_H1_LINES.join(' ')).toBe(HERO_H1);
  });

  it('subhead segments join back to HERO_SUBHEAD, with exactly one highlight', () => {
    // The segments exist only so Hero.tsx can marker-highlight one phrase.
    // If they ever stop reassembling the source-of-truth string, the rendered
    // subhead silently diverges from the copy every other surface quotes.
    expect(HERO_SUBHEAD_SEGMENTS.map((s) => s.text).join('')).toBe(HERO_SUBHEAD);
    expect(HERO_SUBHEAD_SEGMENTS.filter((s) => s.highlight)).toHaveLength(1);
    expect(HERO_SUBHEAD_SEGMENTS.find((s) => s.highlight)?.text).toBe(
      'Your backend stays where it is.',
    );
  });

  it('pins the hero action labels and the secondary destination', () => {
    expect(HERO_PRIMARY_LABEL).toBe('Install Threadplane');
    expect(HERO_SECONDARY_LABEL).toBe('See it running in the docs →');
    expect(HERO_SECONDARY_HREF).toBe('/docs/chat/guides/generative-ui?mode=run');
  });

  it('trust line license word matches the chat package manifest', () => {
    const chat = workspacePkgs.find((p) => p.name === '@threadplane/chat');
    expect(chat?.license).toBe('MIT');
    expect(HERO_TRUST_LINE).toContain(chat!.license!);
    expect(HERO_TRUST_LINE).toBe('MIT · Angular 20–22 · no account, no cloud');
  });
});

describe('positioning: install options', () => {
  it('has fake, langgraph and ag_ui variants in that order', () => {
    expect(INSTALL_OPTIONS.map((o) => o.key)).toEqual(['fake', 'langgraph', 'ag_ui']);
  });

  it('every @threadplane package in every command exists in libs/*', () => {
    const names = new Set(workspacePkgs.map((p) => p.name));
    for (const opt of INSTALL_OPTIONS) {
      const pkgs = opt.command.replace(/^npm install\s+/, '').split(/\s+/);
      for (const pkg of pkgs.filter((p) => p.startsWith('@threadplane/'))) {
        expect(names.has(pkg), `${opt.key}: ${pkg}`).toBe(true);
      }
    }
  });

  it('every peersNote starts with the same Angular range as the hero trust line', () => {
    const angularRange = formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS);
    expect(HERO_TRUST_LINE.startsWith(`MIT · ${angularRange}`)).toBe(true);
    for (const opt of INSTALL_OPTIONS) {
      expect(opt.peersNote.startsWith(angularRange), opt.key).toBe(true);
    }
  });

  it('every non-Threadplane package in a command is a declared peer of a Threadplane package in it', () => {
    for (const opt of INSTALL_OPTIONS) {
      const pkgs = opt.command.replace(/^npm install\s+/, '').split(/\s+/);
      const ours = pkgs.filter((p) => p.startsWith('@threadplane/'));
      const peers = new Set(
        ours.flatMap((n) => Object.keys(workspacePkgs.find((p) => p.name === n)?.peerDependencies ?? {})),
      );
      for (const pkg of pkgs.filter((p) => !p.startsWith('@threadplane/'))) {
        expect(peers.has(pkg), `${opt.key}: ${pkg} is not a peer of ${ours.join(', ')}`).toBe(true);
      }
    }
  });

  it('snippets parse as TypeScript', () => {
    expect(parses(COMPONENT_SNIPPET)).toBe(true);
    expect(parses(RENDER_SNIPPET)).toBe(true);
    for (const opt of INSTALL_OPTIONS) expect(parses(opt.providerSnippet), opt.key).toBe(true);
  });

  it('pins the fake-agent quickstart href the homepage CTAs link to', () => {
    expect(INSTALL_OPTIONS[0].quickstartHref).toBe('/docs/chat/getting-started/try-without-a-backend');
  });

  it('quickstart hrefs point at docs routes', () => {
    for (const opt of INSTALL_OPTIONS) expect(opt.quickstartHref).toMatch(/^\/docs\//);
  });

  it('the try-without-a-backend page uses the fake install command verbatim', () => {
    const mdx = fs.readFileSync(
      path.join(resolveWebsiteDir(), 'content/docs/chat/getting-started/try-without-a-backend.mdx'),
      'utf8',
    );
    expect(mdx).toContain(INSTALL_OPTIONS[0].command);
  });
});

describe('positioning: coding-agent prompt', () => {
  it('references the public agent context and the fake-agent path', () => {
    expect(CODING_AGENT_PROMPT).toContain('https://threadplane.ai/AGENTS.md');
    expect(CODING_AGENT_PROMPT).toContain('provideFakeAgent()');
    expect(CODING_AGENT_PROMPT).not.toMatch(/api[_ -]?key/i);
  });
});

describe('homepage restructure copy (live-stage spec §3)', () => {
  it('closes on the open-source offer: an aviation eyebrow, two words, the licence and the CTA', async () => {
    const { OPEN_SOURCE_STRIP } = await import('./positioning');
    expect(OPEN_SOURCE_STRIP.eyebrow).toBe('Squawk 1200');
    expect(OPEN_SOURCE_STRIP.headline).toBe('Fork us.');
    // The headline is set at up to 116px. More than two short words wraps,
    // and a wrapped headline stops reading as a full stop.
    expect(OPEN_SOURCE_STRIP.headline.length).toBeLessThanOrEqual(12);
    // The eyebrow sits on one line at 0.18em tracking beside nothing else.
    expect(OPEN_SOURCE_STRIP.eyebrow.length).toBeLessThanOrEqual(14);
    expect(OPEN_SOURCE_STRIP.licence).toBe('MIT');
    expect(OPEN_SOURCE_STRIP.cta).toBe('Fork on GitHub');
  });
});

describe('STAGE_RAIL', () => {
  it('has one entry per beat in the beat map order, each a short claim with one docs link', () => {
    expect(STAGE_RAIL.map((b) => b.beat)).toEqual([...STAGE_BEATS]);
    for (const b of STAGE_RAIL) {
      expect(b.label.length).toBeLessThanOrEqual(8);
      expect(b.claim.length).toBeLessThanOrEqual(40);
      expect(b.claim.endsWith('.')).toBe(true);
      expect(b.docs.label).not.toBe('');
      expect(b.docs.href).toMatch(/^\//);
      expect(b.stillAlt.length).toBeGreaterThan(40);
    }
    expect(STAGE_RAIL.map((b) => b.label)).toEqual(['Tools', 'Persist', 'Approve', 'Render']);
  });
  it('carries one hold line and the closing ledger copy', () => {
    expect(STAGE_HOLD_LINE).toBe('Keep scrolling to approve.');
    expect(STAGE_CLOSE.claim).toBe('Feature complete for the final mile.');
    // The fake-agent install command is a single line, so the ending shows it whole (derived, never retyped).
    expect(INSTALL_OPTIONS[0].command).not.toContain('\n');
    expect(STAGE_CLOSE.install).toBe(INSTALL_OPTIONS[0].command);
    expect(STAGE_CLOSE.cta.href).toBe(INSTALL_OPTIONS[0].quickstartHref);
  });
  it('keeps the rail under the word budget: four beats plus the ending', () => {
    const words = (s: string) => s.trim().split(/\s+/).length;
    const total =
      STAGE_RAIL.reduce((n, b) => n + words(b.claim) + words(b.docs.label), 0) +
      words(STAGE_HOLD_LINE) +
      words(STAGE_CLOSE.claim) +
      words(STAGE_CLOSE.cta.label);
    expect(total).toBeLessThan(90);
  });
});
