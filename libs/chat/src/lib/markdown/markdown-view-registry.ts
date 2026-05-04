// libs/chat/src/lib/markdown/markdown-view-registry.ts
// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { ViewRegistry } from '@ngaf/render';

/**
 * DI token for the markdown view registry consumed by <chat-streaming-md>
 * and <md-children>. Maps MarkdownNode.type strings (e.g. "paragraph",
 * "heading") to Angular components that render that node type.
 *
 * `<chat-streaming-md>` provides the runtime registry on its component-level
 * injector — either the consumer-supplied [viewRegistry] input, or
 * `cacheplaneMarkdownViews` (the default) — so descendant <md-children>
 * components resolve the right components for each node.
 */
export const MARKDOWN_VIEW_REGISTRY = new InjectionToken<ViewRegistry>(
  'MARKDOWN_VIEW_REGISTRY',
);
