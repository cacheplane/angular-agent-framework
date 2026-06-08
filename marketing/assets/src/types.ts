// SPDX-License-Identifier: MIT
export type TemplateId = 'x-card' | 'og-card';

export interface CardInput {
  template: TemplateId;
  /** Headline. Required. Garamond serif, large. */
  title: string;
  /** Supporting line under the headline. Optional. */
  subtitle?: string;
  /** Kicker above the headline. Optional. Defaults to brand.defaultEyebrow. */
  eyebrow?: string;
  /** Bottom-left attribution. When present, replaces the trust pills. */
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}
