// SPDX-License-Identifier: MIT
import { CardShell } from './card-shell';
import type { CardInput } from '../types';

export function XCard(input: CardInput, assets: { planeDataUri: string }) {
  return (
    <CardShell
      input={input}
      planeDataUri={assets.planeDataUri}
      headlineSize={76}
      padding="76px 84px"
    />
  );
}
