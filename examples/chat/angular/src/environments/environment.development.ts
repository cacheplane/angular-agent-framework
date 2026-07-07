// SPDX-License-Identifier: MIT
/**
 * Development environment configuration for the canonical demo.
 *
 * Points to a local LangGraph server started with:
 *   cd examples/chat/python && langgraph dev
 */
import { GENERATED_KEYS } from './generated-keys';

export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:2024',
  assistantId: 'chat',
  telemetry: {
    enabled: false,
    sampleRate: 1,
  },
  license: undefined as string | undefined,
  googleMapsApiKey: GENERATED_KEYS.googleMaps,
  googleMapsMapId: GENERATED_KEYS.googleMapsMapId,
};
