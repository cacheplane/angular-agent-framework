// SPDX-License-Identifier: MIT
import type { ChannelAdapter, ChannelId } from './types';
import { XAdapter } from './x';

const KNOWN: ChannelId[] = ['x', 'linkedin', 'devto', 'reddit'];

const instances = new Map<ChannelId, ChannelAdapter>();

function buildAdapter(id: ChannelId): ChannelAdapter {
  switch (id) {
    case 'x':
      return new XAdapter();
    case 'linkedin':
    case 'devto':
    case 'reddit':
      throw new Error(
        `Channel "${id}" adapter is not yet implemented. Known channels with implementations: x.`,
      );
    default: {
      const _exhaustive: never = id;
      throw new Error(
        `Unknown channel "${String(_exhaustive)}". Known: ${KNOWN.join(', ')}.`,
      );
    }
  }
}

export function getAdapter(id: ChannelId): ChannelAdapter {
  if (!KNOWN.includes(id)) {
    throw new Error(`Unknown channel "${id}". Known: ${KNOWN.join(', ')}.`);
  }
  let inst = instances.get(id);
  if (!inst) {
    inst = buildAdapter(id);
    instances.set(id, inst);
  }
  return inst;
}
