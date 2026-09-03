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

/** Preview deployments of the website: `https://<slug>.vercel.app`, one label deep. */
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

/** True for the website's own origins and for its Vercel preview deployments. */
export function isAllowedParentOrigin(origin: string): boolean {
  return HERO_PARENT_ORIGINS.includes(origin) || VERCEL_PREVIEW_ORIGIN.test(origin);
}

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
  const allowed = parentOrigin !== null && isAllowedParentOrigin(parentOrigin);
  if (!allowed && env.parent !== env.self) {
    console.warn('[hero] parent origin not allowlisted; frame state will not be posted', parentOrigin);
  }
  return {
    postState(state) {
      if (!allowed || env.parent === env.self) return;
      env.parent.postMessage({ type: HERO_MESSAGE_TYPE, state }, parentOrigin as string);
    },
    onVisibility(cb) {
      const handler = (e: MessageEvent) => {
        if (e.source !== env.parent) return;
        if (!isAllowedParentOrigin(e.origin)) return;
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
