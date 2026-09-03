import { createAgentRef } from '@threadplane/chat';

/** Replay agent: HeroReplayTransport, no backend. */
export const HERO_REPLAY_REF = createAgentRef<Record<string, unknown>>('hero-replay');
/** Live agent: the canonical demo's LangGraph backend, fresh thread. */
export const HERO_LIVE_REF = createAgentRef<Record<string, unknown>>('hero-live');
