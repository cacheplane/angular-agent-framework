'use client';
import { useState, useEffect } from 'react';
import { tokens } from '../../../lib/design-tokens';

// Animation phases for a full AI turn
type Phase = 'idle' | 'submit' | 'processing' | 'streaming' | 'rendered' | 'complete';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Waiting for user input...',
  submit: 'User sends message',
  processing: 'Agent processing...',
  streaming: 'Tokens streaming back',
  rendered: 'UI updated',
  complete: 'Turn complete',
};

const PHASE_DURATION: Record<Phase, number> = {
  idle: 1200,
  submit: 1000,
  processing: 1500,
  streaming: 2000,
  rendered: 1200,
  complete: 800,
};

export function ArchFlowDiagram() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [tokenCount, setTokenCount] = useState(0);
  const [streamedText, setStreamedText] = useState('');

  const fullResponse = 'Hello! I can help you with that.';

  useEffect(() => {
    const phases: Phase[] = ['idle', 'submit', 'processing', 'streaming', 'rendered', 'complete'];
    let phaseIdx = 0;
    let tokenInterval: ReturnType<typeof setInterval>;

    const advancePhase = () => {
      const currentPhase = phases[phaseIdx];
      setPhase(currentPhase);

      if (currentPhase === 'streaming') {
        let t = 0;
        setStreamedText('');
        setTokenCount(0);
        tokenInterval = setInterval(() => {
          t++;
          setTokenCount(t);
          setStreamedText(fullResponse.slice(0, t * 2));
          if (t * 2 >= fullResponse.length) {
            clearInterval(tokenInterval);
          }
        }, 100);
      }

      if (currentPhase === 'idle') {
        setStreamedText('');
        setTokenCount(0);
      }

      phaseIdx = (phaseIdx + 1) % phases.length;
      setTimeout(advancePhase, PHASE_DURATION[currentPhase]);
    };

    advancePhase();
    return () => { clearInterval(tokenInterval); };
  }, []);

  const isActive = (node: string) => {
    if (node === 'angular' && (phase === 'idle' || phase === 'submit' || phase === 'rendered')) return true;
    if (node === 'bridge' && (phase === 'submit' || phase === 'streaming' || phase === 'rendered')) return true;
    if (node === 'transport' && (phase === 'submit' || phase === 'streaming')) return true;
    if (node === 'langgraph' && (phase === 'processing' || phase === 'streaming')) return true;
    return false;
  };

  const showDownFlow = phase === 'submit';
  const showUpFlow = phase === 'streaming' || phase === 'rendered';
  const showProcessing = phase === 'processing';

  return (
    <div style={{
      width: '100%',
      maxWidth: 520,
      margin: '32px auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
      {/* Phase indicator */}
      <div style={{
        textAlign: 'center',
        marginBottom: 24,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: tokens.colors.textMuted,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          background: 'rgba(255,255,255,0.6)',
          border: `1px solid ${tokens.glass.border}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: phase === 'idle' ? '#aeaeb2' : phase === 'complete' ? '#34c759' : tokens.colors.accent,
            boxShadow: phase !== 'idle' ? `0 0 6px ${phase === 'complete' ? 'rgba(52,199,89,0.4)' : 'rgba(0,64,144,0.3)'}` : 'none',
            animation: phase !== 'idle' && phase !== 'complete' ? 'pulse 1s ease-in-out infinite' : 'none',
          }} />
          {PHASE_LABELS[phase]}
        </span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes flowDown { 0% { top:-8px; opacity:0; } 15% { opacity:1; } 85% { opacity:1; } 100% { top:100%; opacity:0; } }
        @keyframes flowUp { 0% { bottom:-8px; opacity:0; } 15% { opacity:1; } 85% { opacity:1; } 100% { bottom:100%; opacity:0; } }
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
      `}</style>

      {/* Node: Angular */}
      <div style={{
        padding: '20px 24px', borderRadius: 14,
        background: isActive('angular') ? 'rgba(255,240,243,0.7)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${isActive('angular') ? 'rgba(221,0,49,0.15)' : 'rgba(0,0,0,0.04)'}`,
        boxShadow: isActive('angular') ? '0 2px 20px rgba(221,0,49,0.06)' : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        transition: 'all 0.4s ease',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(221,0,49,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🅰️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 3 }}>Your Angular App</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, lineHeight: 1.4, marginBottom: 6 }}>
            {phase === 'rendered' || phase === 'complete'
              ? <span style={{ color: tokens.colors.textSecondary }}>Rendering: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(221,0,49,0.06)', padding: '1px 4px', borderRadius: 3, color: '#b71c1c' }}>chat.messages()</code></span>
              : 'Components call submit() and bind Signals in templates'}
          </div>
          {/* Live message preview */}
          {(phase === 'streaming' || phase === 'rendered' || phase === 'complete') && (
            <div style={{
              padding: '6px 10px', borderRadius: 6,
              background: '#1a1b26', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: '#a9b1d6', minHeight: 20,
            }}>
              {streamedText}<span style={{ opacity: phase === 'streaming' ? 1 : 0, animation: 'pulse 0.5s infinite' }}>▊</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {['OnPush', 'computed()', 'signal()'].map(c => (
              <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(221,0,49,0.05)', color: '#b71c1c' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Connector 1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '2px 0' }}>
        <div style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: showDownFlow ? tokens.colors.textSecondary : tokens.colors.textMuted }}>submit(input)</div>
        <div style={{ width: 1.5, height: 40, position: 'relative', overflow: 'visible', background: 'linear-gradient(to bottom, rgba(221,0,49,0.1), rgba(100,80,200,0.1))' }}>
          {showDownFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DD0031', boxShadow: '0 0 8px rgba(221,0,49,0.5)', position: 'absolute', left: -2.25, animation: 'flowDown 1s ease-in-out infinite' }} />}
        </div>
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, color: tokens.colors.textMuted }}>↓ message</div>
      </div>

      {/* Node: streamResource */}
      <div style={{
        padding: '20px 24px', borderRadius: 14,
        background: isActive('bridge') ? 'rgba(245,240,255,0.7)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${isActive('bridge') ? 'rgba(100,80,200,0.15)' : 'rgba(0,0,0,0.04)'}`,
        boxShadow: isActive('bridge') ? '0 2px 20px rgba(100,80,200,0.06)' : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        transition: 'all 0.4s ease',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(100,80,200,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 3 }}>streamResource()</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, lineHeight: 1.4, marginBottom: 6 }}>
            {showUpFlow
              ? <span style={{ color: tokens.colors.textSecondary }}>Converting SSE events → Angular Signals</span>
              : 'Reactive bridge — BehaviorSubject → toSignal()'}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['toSignal()', 'throttle()', 'DestroyRef'].map(c => (
              <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(100,80,200,0.05)', color: '#5e35b1' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Connector 2 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '2px 0' }}>
        <div style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: showDownFlow ? tokens.colors.textSecondary : tokens.colors.textMuted }}>HTTP POST</div>
        <div style={{ width: 1.5, height: 40, position: 'relative', overflow: 'visible', background: 'linear-gradient(to bottom, rgba(100,80,200,0.1), rgba(0,64,144,0.1))' }}>
          {showDownFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C5FCF', boxShadow: '0 0 8px rgba(100,80,200,0.5)', position: 'absolute', left: -2.25, animation: 'flowDown 1s ease-in-out infinite', animationDelay: '0.2s' }} />}
          {showUpFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64C3FD', boxShadow: '0 0 8px rgba(100,195,253,0.5)', position: 'absolute', left: -2.25, animation: 'flowUp 0.8s ease-in-out infinite' }} />}
          {showUpFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64C3FD', boxShadow: '0 0 8px rgba(100,195,253,0.5)', position: 'absolute', left: -2.25, animation: 'flowUp 0.8s ease-in-out infinite', animationDelay: '0.3s' }} />}
        </div>
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, color: showUpFlow ? tokens.colors.accent : tokens.colors.textMuted }}>SSE ↑</div>
      </div>

      {/* Node: Transport */}
      <div style={{
        padding: '20px 24px', borderRadius: 14,
        background: isActive('transport') ? 'rgba(234,243,255,0.6)' : 'rgba(255,255,255,0.5)',
        border: `1px solid ${isActive('transport') ? 'rgba(0,64,144,0.1)' : 'rgba(0,0,0,0.04)'}`,
        boxShadow: isActive('transport') ? '0 2px 20px rgba(0,64,144,0.04)' : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        transition: 'all 0.4s ease',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(0,64,144,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 3 }}>FetchStreamTransport</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, lineHeight: 1.4, marginBottom: 6 }}>SSE connection, thread management, event parsing</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['langgraph-sdk', 'AsyncIterable', 'AbortSignal'].map(c => (
              <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,64,144,0.04)', color: '#004090' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Connector 3 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '2px 0' }}>
        <div style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: tokens.colors.textMuted }}>threads</div>
        <div style={{ width: 1.5, height: 48, position: 'relative', overflow: 'visible', background: 'linear-gradient(to bottom, rgba(0,64,144,0.06), rgba(0,64,144,0.14))' }}>
          {showDownFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#004090', boxShadow: '0 0 8px rgba(0,64,144,0.5)', position: 'absolute', left: -2.25, animation: 'flowDown 1s ease-in-out infinite', animationDelay: '0.4s' }} />}
          {showUpFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64C3FD', boxShadow: '0 0 10px rgba(100,195,253,0.6)', position: 'absolute', left: -2.25, animation: 'flowUp 0.6s ease-in-out infinite' }} />}
          {showUpFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64C3FD', boxShadow: '0 0 10px rgba(100,195,253,0.6)', position: 'absolute', left: -2.25, animation: 'flowUp 0.6s ease-in-out infinite', animationDelay: '0.2s' }} />}
          {showUpFlow && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64C3FD', boxShadow: '0 0 10px rgba(100,195,253,0.6)', position: 'absolute', left: -2.25, animation: 'flowUp 0.6s ease-in-out infinite', animationDelay: '0.4s' }} />}
        </div>
        <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, color: showUpFlow ? tokens.colors.accent : tokens.colors.textMuted }}>
          {showUpFlow ? `${tokenCount} tokens` : 'token stream'}
        </div>
      </div>

      {/* Node: LangGraph */}
      <div style={{
        padding: '20px 24px', borderRadius: 14,
        background: isActive('langgraph') ? 'rgba(234,243,255,0.7)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${isActive('langgraph') ? 'rgba(0,64,144,0.15)' : 'rgba(0,0,0,0.04)'}`,
        boxShadow: isActive('langgraph') ? '0 2px 20px rgba(0,64,144,0.06)' : 'none',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        transition: 'all 0.4s ease',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(0,64,144,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {showProcessing ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span> : '🧠'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 3 }}>LangGraph Platform</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, lineHeight: 1.4, marginBottom: 6 }}>
            {showProcessing
              ? <span style={{ color: tokens.colors.textSecondary }}>Running call_model node...</span>
              : 'Agent graph, state management, checkpoints, tool execution'}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['StateGraph', 'MessagesState', 'Checkpoints', 'Tools'].map(c => (
              <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,64,144,0.04)', color: '#004090' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
