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
  HERO_PRIMARY_LABEL,
  HERO_SECONDARY_HREF,
  HERO_SECONDARY_LABEL,
  HERO_SUBHEAD,
  HERO_SUBHEAD_SEGMENTS,
  HERO_TRUST_LINE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INSTALL_OPTIONS,
  PARITY_SNIPPETS,
  PINNED_COMPONENT_SNIPPET,
} from './positioning';
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
    expect(HERO_EYEBROW).toBe('Open-source · Angular · LangGraph & AG-UI');
    expect(HERO_H1).toBe('The AI agent UI framework for Angular.');
    expect(HERO_SUBHEAD).toBe('Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.');
    expect(HOME_TITLE).toBe('Threadplane — Angular AI Agent UI Framework');
    expect(HOME_DESCRIPTION).toBe(
      'Open-source Angular AI agent UI framework for LangGraph and AG-UI: chat, durable threads, human approvals, and generative UI with Signals and DI.',
    );
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
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
    expect(parses(PINNED_COMPONENT_SNIPPET)).toBe(true);
    for (const opt of INSTALL_OPTIONS) expect(parses(opt.providerSnippet), opt.key).toBe(true);
    for (const s of Object.values(PARITY_SNIPPETS)) expect(parses(s)).toBe(true);
  });

  it('the pinned runtime-parity pane is adapter-neutral', () => {
    expect(PINNED_COMPONENT_SNIPPET).not.toContain('@threadplane/langgraph');
    expect(PINNED_COMPONENT_SNIPPET).not.toContain('@threadplane/ag-ui');
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
  it('pins the final-mile eyebrow, heading and aside', async () => {
    const { FINAL_MILE_EYEBROW, FINAL_MILE_HEADING, FINAL_MILE_ASIDE } = await import('./positioning');
    expect(FINAL_MILE_EYEBROW).toBe('Where Threadplane fits');
    expect(FINAL_MILE_HEADING).toBe('Angular teams are building agents. The last mile is still messy.');
    expect(FINAL_MILE_ASIDE).toBe('What you start with, and what Threadplane adds.');
  });

  it('carries three reliability receipts, each linking a human-readable page', async () => {
    const { RELIABILITY_RECEIPTS } = await import('./positioning');
    expect(RELIABILITY_RECEIPTS.map((r) => r.claim)).toEqual([
      'Signed provenance on every release',
      'Three runtimes exercised end to end',
      'No content telemetry, no cloud',
    ]);
    for (const r of RELIABILITY_RECEIPTS) {
      expect(r.sourceLabel.length).toBeGreaterThan(0);
      const { hostname, pathname } = new URL(r.sourceHref, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), r.sourceHref).toBe(false);
      expect(pathname.startsWith('/api/'), r.sourceHref).toBe(false);

      if (r.sourceHref.startsWith('/docs/')) {
        const slug = r.sourceHref.replace(/^\/docs\//, '');
        const candidates = [
          path.join(resolveWebsiteDir(), 'content', 'docs', `${slug}.mdx`),
          path.join(resolveWebsiteDir(), 'content', 'docs', slug, 'index.mdx'),
        ];
        expect(candidates.some((p) => fs.existsSync(p)), r.sourceHref).toBe(true);
      } else if (r.sourceHref.startsWith('/')) {
        expect(
          fs.existsSync(path.join(resolveWebsiteDir(), 'src', 'app', r.sourceHref.slice(1), 'page.tsx')),
          r.sourceHref,
        ).toBe(true);
      }
    }
  });

  it('carries the three prove-it rows the final CTA absorbs from the Test section', async () => {
    const { PROVE_IT_ROWS } = await import('./positioning');
    expect(PROVE_IT_ROWS).toEqual([
      { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
      { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
      { claim: 'Same UI code in test and production', api: 'Agent' },
    ]);
  });
});
