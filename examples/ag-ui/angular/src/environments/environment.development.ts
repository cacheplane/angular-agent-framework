// SPDX-License-Identifier: MIT
import { GENERATED_KEYS } from './generated-keys';

export const environment = {
  production: false,
  agentUrl: '/agent',
  telemetry: { enabled: false, sampleRate: 1 },
  license: undefined as string | undefined,
  googleMapsApiKey: GENERATED_KEYS.googleMaps,
};
