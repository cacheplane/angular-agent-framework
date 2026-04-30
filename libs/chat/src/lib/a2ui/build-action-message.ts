// SPDX-License-Identifier: MIT
import type { A2uiSurface, A2uiActionMessage } from '@cacheplane/a2ui';

/** Builds a v0.9 A2uiActionMessage from handler params and the current surface. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const message: A2uiActionMessage = {
    version: 'v0.9',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId: params['sourceComponentId'] as string,
      timestamp: new Date().toISOString(),
      context: (params['context'] as Record<string, unknown>) ?? {},
    },
  };
  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v0.9',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}
