export const COCKPIT_UI_VARIANTS = ['neutral', 'accent', 'warning'] as const;

export type CockpitUiVariant = (typeof COCKPIT_UI_VARIANTS)[number];

export interface CockpitUiPrimitive {
  name: string;
  variant: CockpitUiVariant;
  description: string;
}

export interface CockpitUiPrimitiveSet {
  name: string;
  primitives: readonly CockpitUiPrimitive[];
}
