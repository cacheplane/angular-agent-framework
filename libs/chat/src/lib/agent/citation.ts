// SPDX-License-Identifier: MIT

/**
 * Provider-agnostic citation entry. Populated by adapters from message
 * metadata (LangGraph additional_kwargs.citations, ag-ui STATE_DELTA at
 * /citations/{messageId}). Pandoc-formatted [^id]: ... defs in message
 * content remain in the markdown AST sidecar and are merged via
 * CitationsResolverService at render time.
 */
export interface Citation {
  /** Stable id used to match `[^id]` markers in Pandoc-formatted content. */
  id: string;
  /** 1-based display order. Stable per-message. */
  index: number;
  title?: string;
  url?: string;
  snippet?: string;
  /** Provider-specific extras (retrieval score, source type, etc.). */
  extra?: Record<string, unknown>;
}
