// SPDX-License-Identifier: MIT
//
// @threadplane/marketing-assets — Brand asset rendering for the marketing pipeline.
// Skeleton only. Implementation lands in the brand-assets sub-spec.

export interface CardInput {
  template: string;
  title: string;
  subtitle?: string;
  tag?: string;
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}

export function renderCard(_input: CardInput): Promise<RenderedCard> {
  throw new Error(
    '@threadplane/marketing-assets: renderCard() not yet implemented. See brand-assets sub-spec.',
  );
}
