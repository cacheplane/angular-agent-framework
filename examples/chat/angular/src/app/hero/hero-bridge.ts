// SPDX-License-Identifier: MIT

export type HeroFrameState = 'ready' | 'scripted' | 'paused' | 'live' | 'replay';
export const HERO_MESSAGE_TYPE = 'tplane-hero';
/** Only these embedders receive frame state or can pause the script. */
export const HERO_PARENT_ORIGINS: readonly string[] = [
  'https://threadplane.ai',
  'https://www.threadplane.ai',
  'http://localhost:3000',
  'http://127.0.0.1:4308',
];

export interface HeroBridge {
  postState(state: HeroFrameState): void;
  onVisibility(cb: (visible: boolean) => void): () => void;
}

interface BridgeEnv {
  referrer: string;
  parent: Window;
  self: Window;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createHeroBridge(env: BridgeEnv): HeroBridge {
  const parentOrigin = originOf(env.referrer);
  const allowed = parentOrigin !== null && HERO_PARENT_ORIGINS.includes(parentOrigin);
  return {
    postState(state) {
      if (!allowed || env.parent === env.self) return;
      env.parent.postMessage({ type: HERO_MESSAGE_TYPE, state }, parentOrigin as string);
    },
    onVisibility(cb) {
      const handler = (e: MessageEvent) => {
        if (!HERO_PARENT_ORIGINS.includes(e.origin)) return;
        const d = e.data as { type?: string; visible?: unknown } | null;
        if (!d || d.type !== HERO_MESSAGE_TYPE || typeof d.visible !== 'boolean') return;
        cb(d.visible);
      };
      env.self.addEventListener('message', handler);
      return () => env.self.removeEventListener('message', handler);
    },
  };
}

export function browserHeroBridge(): HeroBridge {
  return createHeroBridge({ referrer: document.referrer, parent: window.parent, self: window });
}
