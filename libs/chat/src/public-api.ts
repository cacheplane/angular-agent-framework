// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Shared types
export type { ChatConfig } from './lib/provide-chat';
export type { MessageTemplateType } from './lib/chat.types';

// Primitives
export { ChatMessagesComponent } from './lib/primitives/chat-messages/chat-messages.component';
export { MessageTemplateDirective } from './lib/primitives/chat-messages/message-template.directive';
export { getMessageType } from './lib/primitives/chat-messages/chat-messages.component';
export { ChatInputComponent, submitMessage } from './lib/primitives/chat-input/chat-input.component';
export { ChatTypingIndicatorComponent, isTyping } from './lib/primitives/chat-typing-indicator/chat-typing-indicator.component';
export { ChatErrorComponent, extractErrorMessage } from './lib/primitives/chat-error/chat-error.component';
export { ChatInterruptComponent, getInterrupt } from './lib/primitives/chat-interrupt/chat-interrupt.component';
export { ChatToolCallsComponent } from './lib/primitives/chat-tool-calls/chat-tool-calls.component';
export { ChatSubagentsComponent } from './lib/primitives/chat-subagents/chat-subagents.component';
export { ChatThreadListComponent } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export type { Thread } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';

// DI provider
export { provideChat, CHAT_CONFIG } from './lib/provide-chat';

// Compositions
export { ChatComponent } from './lib/compositions/chat/chat.component';
export { ChatInterruptPanelComponent } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export type { InterruptAction } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export { ChatToolCallCardComponent } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export type { ToolCallInfo } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export { ChatSubagentCardComponent } from './lib/compositions/chat-subagent-card/chat-subagent-card.component';
export { ChatTimelineSliderComponent } from './lib/compositions/chat-timeline-slider/chat-timeline-slider.component';
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export { toDebugCheckpoint, extractStateValues } from './lib/compositions/chat-debug/debug-utils';
export { DebugCheckpointCardComponent } from './lib/compositions/chat-debug/debug-checkpoint-card.component';
export type { DebugCheckpoint } from './lib/compositions/chat-debug/debug-checkpoint-card.component';
export { DebugStateInspectorComponent } from './lib/compositions/chat-debug/debug-state-inspector.component';
export { DebugStateDiffComponent } from './lib/compositions/chat-debug/debug-state-diff.component';
export { DebugTimelineComponent } from './lib/compositions/chat-debug/debug-timeline.component';
export { DebugDetailComponent } from './lib/compositions/chat-debug/debug-detail.component';
export { DebugControlsComponent } from './lib/compositions/chat-debug/debug-controls.component';
export { DebugSummaryComponent } from './lib/compositions/chat-debug/debug-summary.component';
export { computeStateDiff } from './lib/compositions/chat-debug/state-diff';
export type { DiffEntry } from './lib/compositions/chat-debug/state-diff';

// Shared styles & utilities
export { CHAT_THEME_STYLES } from './lib/styles/chat-theme';
export { CHAT_MARKDOWN_STYLES, renderMarkdown } from './lib/styles/chat-markdown';
export {
  ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_TOOL,
  ICON_WARNING, ICON_AGENT, ICON_CHECK, ICON_SEND,
} from './lib/styles/chat-icons';

// Views (re-exported from @cacheplane/render for convenience)
export { views, withViews, withoutViews, toRenderRegistry } from '@cacheplane/render';
export type { ViewRegistry } from '@cacheplane/render';
export { provideViews, VIEW_REGISTRY } from '@cacheplane/render';

// Streaming / Generative UI
export { createContentClassifier } from './lib/streaming/content-classifier';
export type { ContentClassifier, ContentType } from './lib/streaming/content-classifier';
export { createParseTreeStore } from './lib/streaming/parse-tree-store';
export type { ParseTreeStore, ElementAccumulationState } from './lib/streaming/parse-tree-store';

// A2UI
export { createA2uiSurfaceStore } from './lib/a2ui/surface-store';
export type { A2uiSurfaceStore } from './lib/a2ui/surface-store';
export { A2uiSurfaceComponent } from './lib/a2ui/surface.component';
export { a2uiBasicCatalog } from './lib/a2ui/catalog/index';

// Test utilities
export { createMockAgentRef } from './lib/testing/mock-agent-ref';
