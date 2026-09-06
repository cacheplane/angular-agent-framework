/** The globals `scrollcraft.js` installs. Only what the homepage uses. */
export interface ScrollCraftAct {
  el: HTMLElement;
  device: 'scrub' | 'pin' | 'pan' | 'flow';
  p: number;
}
export interface ScrollCraftInstance {
  layout(): void;
  acts: ScrollCraftAct[];
  lerp: number;
}
export interface ScrollCraftGlobal {
  mount(
    root?: Element | Document | string,
    opts?: { lerp?: number }
  ): ScrollCraftInstance;
  reduce: boolean;
  instances: ScrollCraftInstance[];
}
declare global {
  interface Window {
    ScrollCraft?: ScrollCraftGlobal;
  }
}
