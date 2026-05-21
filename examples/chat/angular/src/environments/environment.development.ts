// SPDX-License-Identifier: MIT
/**
 * Development environment configuration for the canonical demo.
 *
 * Points to a local LangGraph server started with:
 *   cd examples/chat/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:2024',
  assistantId: 'chat',
  telemetry: {
    enabled: false,
    sampleRate: 1,
  },
  license: undefined as string | undefined,
};
