'use client';
import { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

// ── Types ──────────────────────────────────────────────────────────────────
type Callout = { tag: string; body: string; color: string; rgb: string };
type FeatKey = 'stream' | 'genui' | 'tools' | 'interrupt';

interface FeatDef {
  label: string;
  color: string;
  rgb: string;
  badgeText: string;
  left: Callout[];
  right: Callout[];
  question: string;
  run: (ctx: ScenarioCtx) => Promise<void>;
}

interface ScenarioCtx {
  addUser: (text: string) => void;
  addTyping: () => () => void;
  makeAIBubble: () => { bbl: HTMLElement; out: HTMLElement; cur: HTMLElement };
  typeText: (out: HTMLElement, cur: HTMLElement, text: string, ms?: number) => Promise<void>;
  appendToMsgs: (el: HTMLElement) => void;
  scroll: () => void;
  litLeft: (idx: number) => void;
  litRight: (idx: number) => void;
  wait: (ms: number) => Promise<void>;
  token: number;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Scenarios ──────────────────────────────────────────────────────────────
async function runStream(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, litLeft, litRight, wait: w, token } = ctx;
  await w(300);
  addUser('Walk me through LangGraph state.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  litLeft(0);
  await w(1100);
  removeTyping();
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  litRight(0);
  await typeText(out, cur,
    'LangGraph structures your agent as a graph of nodes and edges. Each node returns a partial state update. Angular Agent Framework connects to that stream and exposes each update as Angular signals — so your template reacts as tokens arrive.',
    30
  );
  if (ctx.token !== token) return;
  cur.style.display = 'none';
}

async function runGenUI(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Show Q4 revenue by region.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  await w(900);
  removeTyping();
  if (ctx.token !== token) return;
  const { bbl, out, cur } = makeAIBubble();
  await typeText(out, cur, "Here's the live Q4 breakdown —", 36);
  if (ctx.token !== token) return;
  cur.style.display = 'none';
  litRight(0);
  // Gen UI block
  const gui = document.createElement('div');
  gui.style.cssText = 'margin-top:8px;background:rgba(255,255,255,.04);border:1px solid rgba(26,122,64,.25);border-radius:9px;overflow:hidden;animation:sr-fade .28s ease-out';
  gui.innerHTML = `
    <div style="background:rgba(26,122,64,.09);border-bottom:1px solid rgba(26,122,64,.18);padding:4px 9px;display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:.57rem;color:#4caf50;font-weight:700;text-transform:uppercase;letter-spacing:.06em">
      <span style="width:4px;height:4px;border-radius:50%;background:#4caf50;display:inline-block;animation:sr-pulse .9s infinite"></span>
      @cacheplane/render · DataTable
    </div>
    <div id="_gui-body" style="padding:7px 9px"></div>`;
  bbl.appendChild(gui);
  scroll();
  await w(250);
  const body = document.getElementById('_gui-body');
  if (!body) return;
  const rows: [string, string, string][] = [
    ['North America', '$4.2M', 'color:#4caf50'],
    ['Europe', '$3.1M', 'color:#4caf50'],
    ['APAC', '$1.8M', 'color:#ef5350'],
    ['Total', '$9.1M', ''],
  ];
  for (const [l, v, style] of rows) {
    if (ctx.token !== token) return;
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.71rem;animation:sr-fade .28s ease-out';
    r.innerHTML = `<span style="color:rgba(255,255,255,.36)">${l}</span><span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;font-weight:600;color:#c8ccee;${style}">${v}</span>`;
    body.appendChild(r);
    scroll();
    await w(200);
  }
}

async function runTools(ctx: ScenarioCtx) {
  const { addUser, appendToMsgs, makeAIBubble, typeText, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Find the latest pricing docs.');
  litLeft(0);
  await w(600);
  // Tool card fires BEFORE any AI text — correct LangGraph execution order
  const card = document.createElement('div');
  card.style.cssText = 'margin-left:31px;background:rgba(255,255,255,.025);border:1px solid rgba(0,64,144,.22);border-radius:9px;padding:9px 12px;animation:sr-fade .28s ease-out';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <div style="width:16px;height:16px;border-radius:4px;background:rgba(0,64,144,.15);display:flex;align-items:center;justify-content:center;font-size:.6rem">🔍</div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:#6C8EFF;font-weight:700">search_docs</span>
      <span id="_tool-st" style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:#FFA726">● running</span>
    </div>
    <div id="_ts1" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#777;padding:2px 0 2px 7px;border-left:2px solid rgba(0,64,144,.12);line-height:1.4">▸ query: "pricing documentation"</div>
    <div id="_ts2" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#777;padding:2px 0 2px 7px;border-left:2px solid rgba(0,64,144,.12);line-height:1.4">▸ index: docs · limit: 8</div>
    <div id="_ts3" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#4caf50;padding:2px 0 2px 7px;border-left:2px solid rgba(76,175,80,.22);line-height:1.4">✓ 3 documents found</div>`;
  appendToMsgs(card);
  litRight(0);
  scroll();
  await w(350);
  for (const id of ['_ts1', '_ts2']) {
    if (ctx.token !== token) return;
    const el = document.getElementById(id); if (el) el.style.display = '';
    await w(400); scroll();
  }
  await w(500);
  if (ctx.token !== token) return;
  const ts3 = document.getElementById('_ts3'); if (ts3) ts3.style.display = '';
  const tst = document.getElementById('_tool-st');
  if (tst) { tst.textContent = '✓ done'; tst.style.color = '#4caf50'; }
  scroll();
  await w(700);
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  await typeText(out, cur,
    'Found 3 pricing docs. The most recent is the Enterprise Tier sheet from last quarter — updated volume discount tiers included.',
    33
  );
  if (ctx.token !== token) return;
  cur.style.display = 'none';
}

async function runInterrupt(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, appendToMsgs, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Deploy the service to production.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  await w(900);
  removeTyping();
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  await typeText(out, cur, 'Preparing the deployment — ', 38);
  if (ctx.token !== token) return;
  cur.style.display = 'none';
  await w(300);
  litRight(0);
  const panel = document.createElement('div');
  panel.style.cssText = 'margin:0 0 0 31px;background:rgba(255,160,50,.05);border:1px solid rgba(255,160,50,.2);border-radius:11px;padding:12px 14px;animation:sr-fade .28s ease-out';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:5px;font-size:.76rem;font-weight:600;color:#FFA726;margin-bottom:5px">⚠ Approval required</div>
    <p style="font-size:.72rem;color:rgba(255,255,255,.42);line-height:1.5;margin-bottom:10px">
      Deploy <strong style="color:#FFA726">api-service v2.1.0</strong> to production? This will affect live traffic across all regions.
    </p>
    <div style="display:flex;gap:6px">
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:#6C8EFF;color:#fff;border:none;cursor:pointer">Approve</button>
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);cursor:pointer">Review first</button>
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:rgba(239,83,80,.1);border:1px solid rgba(239,83,80,.24);color:#ef5350;cursor:pointer">Cancel</button>
    </div>`;
  appendToMsgs(panel);
  scroll();
}

// ── Feature definitions ────────────────────────────────────────────────────
const FEATURES: Record<FeatKey, FeatDef> = {
  stream: {
    label: 'Streaming', color: '#6C8EFF', rgb: '108,142,255', badgeText: 'chat-messages',
    left:  [{ tag: '<chat-messages>', body: 'Token-by-token rendering with live cursor. Signals-native, fully OnPush.', color: '#6C8EFF', rgb: '108,142,255' }],
    right: [{ tag: 'isStreaming()', body: 'Reactive signal — true while tokens arrive. Drive spinners and disable inputs without polling.', color: '#6C8EFF', rgb: '108,142,255' }],
    question: 'Walk me through LangGraph state.', run: runStream,
  },
  genui: {
    label: 'Generative UI', color: '#1a7a40', rgb: '26,122,64', badgeText: 'streaming auto-detect',
    left:  [{ tag: 'ContentClassifier', body: 'Auto-detects JSON specs in AI messages. Streams partial JSON character-by-character with structural sharing.', color: '#1a7a40', rgb: '26,122,64' }],
    right: [{ tag: '<render-spec>', body: 'Resolves your Angular component by name, passes props as signals, renders incrementally as tokens arrive.', color: '#1a7a40', rgb: '26,122,64' }],
    question: 'Show Q4 revenue by region.', run: runGenUI,
  },
  tools: {
    label: 'Tool Calls', color: tokens.colors.accent, rgb: '0,64,144', badgeText: 'chat-tool-call-card',
    left:  [{ tag: '<chat-tool-calls>', body: 'Headless wrapper exposing tool execution state as signals. Compose your own tool UI.', color: tokens.colors.accent, rgb: '0,64,144' }],
    right: [{ tag: '<chat-tool-call-card>', body: 'Prebuilt card with expandable steps, live progress rows, and collapsible result state.', color: tokens.colors.accent, rgb: '0,64,144' }],
    question: 'Find the latest pricing docs.', run: runTools,
  },
  interrupt: {
    label: 'Interrupt', color: '#FFA726', rgb: '255,167,38', badgeText: 'chat-interrupt-panel',
    left:  [{ tag: '<chat-interrupt>', body: 'Headless interrupt state. Exposes interrupt() signal — bring your own approval UI.', color: '#FFA726', rgb: '255,167,38' }],
    right: [{ tag: '<chat-interrupt-panel>', body: 'Prebuilt approval card. Wired to LangGraph interrupt resume — approve, edit, or cancel.', color: '#FFA726', rgb: '255,167,38' }],
    question: 'Deploy the service to production.', run: runInterrupt,
  },
};

// ── Component ──────────────────────────────────────────────────────────────
export function ChatFeaturesSection() {
  const [activeFeat, setActiveFeat] = useState<FeatKey>('stream');
  const tokenRef = useRef(0);
  const msgsRef = useRef<HTMLDivElement>(null);

  const buildCtx = useCallback((token: number): ScenarioCtx => {
    const msgs = msgsRef.current!;
    const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };

    const addUser = (text: string) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;align-items:flex-start;flex-direction:row-reverse;animation:sr-fade .28s ease-out';
      row.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.07);color:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px">U</div>
        <div style="padding:8px 12px;font-size:.78rem;line-height:1.55;max-width:270px;background:rgba(108,142,255,.14);border:1px solid rgba(108,142,255,.18);color:#dde0ff;border-radius:13px 4px 13px 13px">${text}</div>`;
      msgs.appendChild(row); scroll();
    };

    const addTyping = () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:7px;animation:sr-fade .28s ease-out';
      row.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(108,142,255,.18);color:#6C8EFF;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px">AI</div>
        <div style="display:flex;gap:4px;padding:7px 11px;background:rgba(108,142,255,.07);border-radius:12px">
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out infinite"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out .2s infinite"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out .4s infinite"></span>
        </div>`;
      msgs.appendChild(row); scroll();
      return () => row.remove();
    };

    const makeAIBubble = () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;align-items:flex-start;animation:sr-fade .28s ease-out';
      const av = document.createElement('div');
      av.style.cssText = 'width:24px;height:24px;border-radius:50%;background:rgba(108,142,255,.18);color:#6C8EFF;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px';
      av.textContent = 'AI';
      const bbl = document.createElement('div');
      bbl.style.cssText = 'padding:8px 12px;font-size:.78rem;line-height:1.55;max-width:270px;background:rgba(108,142,255,.1);border:1px solid rgba(108,142,255,.13);color:#c8ccee;border-radius:4px 13px 13px 13px';
      const out = document.createElement('span');
      const cur = document.createElement('span');
      cur.style.cssText = 'display:inline-block;width:2px;height:.8em;background:#6C8EFF;vertical-align:text-bottom;margin-left:1px;border-radius:1px;animation:sr-blink .85s step-end infinite';
      bbl.appendChild(out); bbl.appendChild(cur);
      row.appendChild(av); row.appendChild(bbl);
      msgs.appendChild(row); scroll();
      return { bbl, out, cur } as unknown as { bbl: HTMLElement; out: HTMLElement; cur: HTMLElement };
    };

    const typeText = async (out: HTMLElement, cur: HTMLElement, text: string, ms = 34) => {
      for (const ch of text) {
        if (tokenRef.current !== token) return;
        const s = document.createElement('span'); s.textContent = ch;
        out.parentNode!.insertBefore(s, cur);
        scroll();
        await wait(ms);
      }
    };

    const appendToMsgs = (el: HTMLElement) => { msgs.appendChild(el); scroll(); };

    const litLeft = (idx: number) => {
      const items = document.querySelectorAll('#feat-left .feat-co');
      if (items[idx]) items[idx].classList.add('feat-co-lit');
    };
    const litRight = (idx: number) => {
      const items = document.querySelectorAll('#feat-right .feat-co');
      if (items[idx]) items[idx].classList.add('feat-co-lit');
    };

    return { addUser, addTyping, makeAIBubble, typeText, appendToMsgs, scroll, litLeft, litRight, wait, token };
  }, []);

  const switchFeat = useCallback((key: FeatKey) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setActiveFeat(key);
    const msgs = msgsRef.current;
    if (msgs) msgs.innerHTML = '';
    // Clear lit callouts
    document.querySelectorAll('.feat-co-lit').forEach(el => el.classList.remove('feat-co-lit'));
    setTimeout(() => {
      const ctx = buildCtx(token);
      FEATURES[key].run(ctx);
    }, 350);
  }, [buildCtx]);

  // Auto-start streaming scenario on mount
  const startedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use intersection observer to start first scenario when visible
  const handleStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setTimeout(() => {
      tokenRef.current += 1;
      const token = tokenRef.current;
      const ctx = buildCtx(token);
      FEATURES['stream'].run(ctx);
    }, 500);
  }, [buildCtx]);

  const feat = FEATURES[activeFeat];

  return (
    <motion.section
      ref={containerRef}
      style={{ padding: '80px 32px' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      onAnimationComplete={handleStart}
    >
      {/* Eyebrow + headline */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, color: '#5a00c8', marginBottom: 14 }}>
          @cacheplane/chat
        </p>
        <h2 style={{ fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)', fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1, color: tokens.colors.textPrimary, marginBottom: 10 }}>
          Every agent UI primitive,<br />
          <span style={{ color: '#5a00c8' }}>ready to compose.</span>
        </h2>
        <p style={{ fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)', fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto', marginBottom: 28 }}>
          Click a feature to see the component in action.
        </p>
        {/* Feature tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {(Object.keys(FEATURES) as FeatKey[]).map(key => {
            const f = FEATURES[key];
            const isActive = activeFeat === key;
            return (
              <button
                key={key}
                onClick={() => switchFeat(key)}
                style={{
                  padding: '8px 20px', borderRadius: 24,
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                  cursor: 'pointer',
                  border: `1.5px solid rgba(${f.rgb},.3)`,
                  background: isActive ? f.color : 'transparent',
                  color: isActive ? '#fff' : f.color,
                  boxShadow: isActive ? `0 4px 14px rgba(${f.rgb},.28)` : 'none',
                  transition: 'background .2s, color .2s, box-shadow .2s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-col layout */}
      <div className="chat-features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 440px 1fr', gap: '0 20px', maxWidth: 960, margin: '0 auto', alignItems: 'start' }}>

        {/* Left callouts */}
        <div id="feat-left" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feat.left.map((co, i) => (
            <div key={i} className="feat-co" style={{ '--co-color': co.color, '--co-rgb': co.rgb } as React.CSSProperties}>
              <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: co.color, marginBottom: 4 }}>
                {co.tag}
              </p>
              <p style={{ fontSize: '0.76rem', color: tokens.colors.textSecondary, lineHeight: 1.45 }}>{co.body}</p>
            </div>
          ))}
        </div>

        {/* Chat window */}
        <div style={{ background: '#12131f', borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 50px rgba(0,64,144,.1), 0 20px 40px rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', height: 460 }}>
          {/* Title bar */}
          <div style={{ background: 'rgba(255,255,255,.025)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.67rem', color: 'rgba(255,255,255,.22)' }}>
              angular agent
            </div>
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: `rgba(${feat.rgb},.12)`, color: feat.color, border: `1px solid rgba(${feat.rgb},.22)`,
            }}>
              {feat.badgeText}
            </div>
          </div>
          {/* Messages */}
          <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 9, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.06) transparent' }} />
          {/* Input bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '9px 11px', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
            <input
              style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', color: 'rgba(255,255,255,.45)', fontFamily: 'Inter,sans-serif', outline: 'none' }}
              placeholder={feat.question}
              readOnly
            />
            <button style={{ width: 30, height: 30, borderRadius: 8, background: '#6C8EFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </button>
          </div>
        </div>

        {/* Right callouts */}
        <div id="feat-right" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feat.right.map((co, i) => (
            <div key={i} className="feat-co" style={{ '--co-color': co.color, '--co-rgb': co.rgb } as React.CSSProperties}>
              <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: co.color, marginBottom: 4 }}>
                {co.tag}
              </p>
              <p style={{ fontSize: '0.76rem', color: tokens.colors.textSecondary, lineHeight: 1.45 }}>{co.body}</p>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        .feat-co {
          padding: 12px 15px;
          border-radius: 12px;
          background: rgba(255,255,255,.55);
          border: 1px solid rgba(255,255,255,.7);
          backdrop-filter: blur(8px);
          transition: border-color .3s, box-shadow .3s, background .3s;
        }
        .feat-co-lit {
          background: rgba(255,255,255,.88) !important;
          border-color: var(--co-color) !important;
          box-shadow: 0 0 14px rgba(var(--co-rgb), .12) !important;
        }
        @keyframes sr-fade { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
        @keyframes sr-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes sr-bounce { 0%,80%,100%{transform:scale(.65);opacity:.5} 40%{transform:scale(1);opacity:1} }
        @media (max-width: 767px) {
          .chat-features-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
            padding: 0 !important;
          }
          #feat-left, #feat-right {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          #feat-left > div, #feat-right > div {
            flex: 1 1 calc(50% - 4px);
            min-width: 140px;
          }
        }
      `}</style>
    </motion.section>
  );
}
