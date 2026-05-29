// SPDX-License-Identifier: MIT
import { CardShell } from './card-shell';
import type { CardInput } from '../types';

export function OgCard(input: CardInput, assets: { planeDataUri: string }) {
  return (
    <CardShell
      input={input}
      planeDataUri={assets.planeDataUri}
      headlineSize={72}
      padding="72px 80px"
    />
  );
}
