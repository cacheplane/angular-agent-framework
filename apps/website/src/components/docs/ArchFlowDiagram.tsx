'use client';
import { useState, useEffect, useRef } from 'react';
import { tokens } from '../../../lib/design-tokens';

interface LogEntry {
  time: string;
  source: 'angular' | 'transport' | 'langgraph' | 'signal';
  message: string;
}

const SCENARIO: { delay: number; chatBubble?: { role: 'user' | 'assistant'; text: string; streaming?: boolean }; log: LogEntry }[] = [
  { delay: 0, chatBubble: { role: 'user', text: 'How do Angular Signals work with streaming?' }, log: { time: '0.00s', source: 'angular', message: 'chat.submit({ message: userText })' } },
  { delay: 800, log: { time: '0.02s', source: 'transport', message: 'POST /threads/t_8f3a/runs/stream → 200' } },
  { delay: 1200, log: { time: '0.04s', source: 'langgraph', message: 'Executing node: call_model (gpt-5-mini)' } },
  { delay: 2200, log: { time: '0.82s', source: 'langgraph', message: 'SSE event: { type: "values", messages: [...] }' } },
  { delay: 2600, log: { time: '0.84s', source: 'transport', message: 'Received chunk → messages$.next([...])' } },
  { delay: 2800, log: { time: '0.85s', source: 'signal', message: 'messages() updated → 2 messages' } },
  { delay: 3000, chatBubble: { role: 'assistant', text: 'Angular Signals', streaming: true }, log: { time: '0.86s', source: 'signal', message: 'status() → "loading"' } },
  { delay: 3400, chatBubble: { role: 'assistant', text: 'Angular Signals provide a synchronous', streaming: true }, log: { time: '1.12s', source: 'transport', message: 'Received chunk → values event' } },
  { delay: 3900, chatBubble: { role: 'assistant', text: 'Angular Signals provide a synchronous, reactive way to', streaming: true }, log: { time: '1.45s', source: 'signal', message: 'messages() updated → streaming token' } },
  { delay: 4500, chatBubble: { role: 'assistant', text: 'Angular Signals provide a synchronous, reactive way to track streaming state.', streaming: true }, log: { time: '1.82s', source: 'langgraph', message: 'SSE event: { type: "values", status: "done" }' } },
  { delay: 5200, chatBubble: { role: 'assistant', text: 'Angular Signals provide a synchronous, reactive way to track streaming state. Each token updates the Signal, and OnPush change detection re-renders automatically.' }, log: { time: '2.10s', source: 'signal', message: 'status() → "resolved" ✓' } },
  { delay: 6000, log: { time: '2.12s', source: 'angular', message: 'Template re-rendered (OnPush) — 1 component' } },
];

const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  angular: { bg: 'rgba(221,0,49,0.08)', text: '#c62828', label: 'ANGULAR' },
  transport: { bg: 'rgba(100,80,200,0.08)', text: '#5e35b1', label: 'TRANSPORT' },
  langgraph: { bg: 'rgba(0,64,144,0.08)', text: '#004090', label: 'LANGGRAPH' },
  signal: { bg: 'rgba(16,185,129,0.08)', text: '#059669', label: 'SIGNAL' },
};

export function ArchFlowDiagram() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bubbles, setBubbles] = useState<{ role: 'user' | 'assistant'; text: string; streaming?: boolean }[]>([]);
  const [cycle, setCycle] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const runScenario = () => {
      setLogs([]);
      setBubbles([]);

      SCENARIO.forEach((step) => {
        timeouts.push(setTimeout(() => {
          setLogs(prev => [...prev, step.log]);
          if (step.chatBubble) {
            const bubble = step.chatBubble;
            setBubbles(prev => {
              const existing = prev.findIndex(b => b.role === bubble.role && b.role === 'assistant');
              if (existing >= 0 && bubble.role === 'assistant') {
                const updated = [...prev];
                updated[existing] = bubble;
                return updated;
              }
              return [...prev, bubble];
            });
          }
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        }, step.delay));
      });

      // Restart after completion
      timeouts.push(setTimeout(() => {
        setCycle(c => c + 1);
      }, 8000));
    };

    runScenario();
    return () => timeouts.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div style={{
      width: '100%',
      margin: '28px 0 36px',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${tokens.glass.border}`,
      boxShadow: tokens.glass.shadow,
      background: 'rgba(255,255,255,0.5)',
      backdropFilter: `blur(${tokens.glass.blur})`,
      WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${tokens.glass.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textMuted }}>agent() — live architecture flow</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tokens.colors.textMuted, background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 4 }}>localhost:4200</span>
      </div>

      <div style={{ display: 'flex', minHeight: 320 }}>
        {/* Left: Chat simulation */}
        <div style={{ flex: 1, padding: 16, borderRight: `1px solid ${tokens.glass.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>Chat Interface</div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
            {bubbles.map((b, i) => (
              <div key={`${b.role}-${i}`} style={{
                display: 'flex',
                justifyContent: b.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start', gap: 6,
              }}>
                {b.role === 'assistant' && (
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'rgba(0,64,144,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 8, color: tokens.colors.accent, fontWeight: 700,
                  }}>AI</div>
                )}
                <div style={{
                  padding: '8px 12px', borderRadius: 10, maxWidth: '85%',
                  fontSize: 12, lineHeight: 1.5, color: b.role === 'user' ? '#fff' : tokens.colors.textPrimary,
                  background: b.role === 'user' ? tokens.colors.accent : 'rgba(0,0,0,0.04)',
                }}>
                  {b.text}
                  {b.streaming && <span style={{ opacity: 0.5, animation: 'blink 0.6s infinite' }}>▊</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Console log */}
        <div ref={logRef} style={{ flex: 1, padding: 12, background: '#1a1b26', overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          <div style={{ fontSize: 9, color: '#4A527A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>Developer Console</div>

          {logs.map((log, i) => {
            const sc = SOURCE_COLORS[log.source];
            return (
              <div key={i} style={{
                display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start',
                animation: 'fadeIn 0.2s ease-out',
              }}>
                <span style={{ color: '#4A527A', flexShrink: 0, width: 36, textAlign: 'right' }}>{log.time}</span>
                <span style={{
                  padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                  background: sc.bg, color: sc.text, fontSize: 8, fontWeight: 600,
                  minWidth: 62, textAlign: 'center',
                }}>{sc.label}</span>
                <span style={{ color: '#a9b1d6', wordBreak: 'break-all' }}>{log.message}</span>
              </div>
            );
          })}

          {logs.length === 0 && (
            <div style={{ color: '#4A527A', fontStyle: 'italic' }}>Waiting for interaction...</div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100% { opacity:0.5; } 50% { opacity:0; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
