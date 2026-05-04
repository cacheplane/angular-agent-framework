// SPDX-License-Identifier: MIT

// Shared types
export type { ChatConfig } from './lib/provide-chat';
export type { MessageTemplateType } from './lib/chat.types';

// Agent contract (runtime-neutral)
export type {
  Agent,
  AgentWithHistory,
  Citation,
  Message,
  Role,
  ContentBlock,
  ToolCall,
  ToolCallStatus,
  AgentStatus,
  AgentInterrupt,
  Subagent,
  SubagentStatus,
  AgentSubmitInput,
  AgentSubmitOptions,
  AgentEvent,
  AgentStateUpdateEvent,
  AgentCustomEvent,
  AgentCheckpoint,
} from './lib/agent';
export {
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isSystemMessage,
} from './lib/agent';

// Primitives
export { ChatMessageListComponent, getMessageType } from './lib/primitives/chat-message-list/chat-message-list.component';
export { MessageTemplateDirective } from './lib/primitives/chat-message-list/message-template.directive';
export { ChatMessageComponent } from './lib/primitives/chat-message/chat-message.component';
export type { ChatMessageRole } from './lib/primitives/chat-message/chat-message.component';
export { ChatMessageActionsComponent } from './lib/primitives/chat-message-actions/chat-message-actions.component';
export { ChatWindowComponent } from './lib/primitives/chat-window/chat-window.component';
export { ChatTraceComponent } from './lib/primitives/chat-trace/chat-trace.component';
export type { TraceState } from './lib/primitives/chat-trace/chat-trace.component';
export { ChatReasoningComponent } from './lib/primitives/chat-reasoning/chat-reasoning.component';
export { ChatLauncherButtonComponent } from './lib/primitives/chat-launcher-button/chat-launcher-button.component';
export { ChatSuggestionsComponent } from './lib/primitives/chat-suggestions/chat-suggestions.component';
export { ChatInputComponent, submitMessage } from './lib/primitives/chat-input/chat-input.component';
export { ChatTypingIndicatorComponent, isTyping } from './lib/primitives/chat-typing-indicator/chat-typing-indicator.component';
export { ChatErrorComponent, extractErrorMessage } from './lib/primitives/chat-error/chat-error.component';
export { ChatInterruptComponent, getInterrupt } from './lib/primitives/chat-interrupt/chat-interrupt.component';
export { ChatToolCallsComponent } from './lib/primitives/chat-tool-calls/chat-tool-calls.component';
export { ChatToolCallTemplateDirective } from './lib/primitives/chat-tool-calls/chat-tool-call-template.directive';
export type { ChatToolCallTemplateContext } from './lib/primitives/chat-tool-calls/chat-tool-call-template.directive';
export { ChatSubagentsComponent } from './lib/primitives/chat-subagents/chat-subagents.component';
export { ChatThreadListComponent } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export type { Thread } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';
export { ChatGenerativeUiComponent } from './lib/primitives/chat-generative-ui/chat-generative-ui.component';
export { ChatWelcomeComponent } from './lib/primitives/chat-welcome/chat-welcome.component';
export { ChatWelcomeSuggestionComponent } from './lib/primitives/chat-welcome/chat-welcome-suggestion.component';
export { ChatSelectComponent } from './lib/primitives/chat-select/chat-select.component';
export type { ChatSelectOption } from './lib/primitives/chat-select/chat-select.component';
export { ChatCitationsComponent, ChatCitationCardTemplateDirective } from './lib/primitives/chat-citations/chat-citations.component';
export { ChatCitationsCardComponent } from './lib/primitives/chat-citations/chat-citations-card.component';

// DI provider
export { provideChat, CHAT_CONFIG } from './lib/provide-chat';

// Compositions
export { ChatComponent } from './lib/compositions/chat/chat.component';
export type { ChatRenderEvent } from './lib/compositions/chat/chat-render-event';
export { ChatPopupComponent } from './lib/compositions/chat-popup/chat-popup.component';
export { ChatSidebarComponent } from './lib/compositions/chat-sidebar/chat-sidebar.component';
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export { ChatTimelineSliderComponent } from './lib/compositions/chat-timeline-slider/chat-timeline-slider.component';
export { ChatInterruptPanelComponent } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export type { InterruptAction } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export { ChatToolCallCardComponent } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export type { ToolCallInfo } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export { ChatSubagentCardComponent, statusColor } from './lib/compositions/chat-subagent-card/chat-subagent-card.component';

// Citations resolver
export { CitationsResolverService } from './lib/markdown/citations-resolver.service';
export type { ResolvedCitation } from './lib/markdown/citations-resolver.service';

// Streaming
export { ChatStreamingMdComponent } from './lib/streaming/streaming-markdown.component';

// Markdown rendering primitives + registry
export { MARKDOWN_VIEW_REGISTRY } from './lib/markdown/markdown-view-registry';
export { MarkdownChildrenComponent } from './lib/markdown/markdown-children.component';
export { cacheplaneMarkdownViews } from './lib/markdown/cacheplane-markdown-views';

// Per-node-type markdown view components (consumers use these to override
// individual nodes via withViews(cacheplaneMarkdownViews, { … })).
export { MarkdownDocumentComponent }       from './lib/markdown/views/markdown-document.component';
export { MarkdownParagraphComponent }      from './lib/markdown/views/markdown-paragraph.component';
export { MarkdownHeadingComponent }        from './lib/markdown/views/markdown-heading.component';
export { MarkdownBlockquoteComponent }     from './lib/markdown/views/markdown-blockquote.component';
export { MarkdownListComponent }           from './lib/markdown/views/markdown-list.component';
export { MarkdownListItemComponent }       from './lib/markdown/views/markdown-list-item.component';
export { MarkdownCodeBlockComponent }      from './lib/markdown/views/markdown-code-block.component';
export { MarkdownThematicBreakComponent }  from './lib/markdown/views/markdown-thematic-break.component';
export { MarkdownTextComponent }           from './lib/markdown/views/markdown-text.component';
export { MarkdownEmphasisComponent }       from './lib/markdown/views/markdown-emphasis.component';
export { MarkdownStrongComponent }         from './lib/markdown/views/markdown-strong.component';
export { MarkdownStrikethroughComponent }  from './lib/markdown/views/markdown-strikethrough.component';
export { MarkdownInlineCodeComponent }     from './lib/markdown/views/markdown-inline-code.component';
export { MarkdownLinkComponent }           from './lib/markdown/views/markdown-link.component';
export { MarkdownAutolinkComponent }       from './lib/markdown/views/markdown-autolink.component';
export { MarkdownImageComponent }          from './lib/markdown/views/markdown-image.component';
export { MarkdownSoftBreakComponent }      from './lib/markdown/views/markdown-soft-break.component';
export { MarkdownHardBreakComponent }      from './lib/markdown/views/markdown-hard-break.component';
export { MarkdownCitationReferenceComponent } from './lib/markdown/views/markdown-citation-reference.component';

// Shared styles & utilities
export { CHAT_MARKDOWN_STYLES } from './lib/styles/chat-markdown.styles';
export { renderMarkdown } from './lib/streaming/markdown-render';
export { messageContent } from './lib/compositions/shared/message-utils';
export { formatDuration } from './lib/utils/format-duration';
export {
  ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_TOOL,
  ICON_WARNING, ICON_AGENT, ICON_CHECK, ICON_SEND,
} from './lib/styles/chat-icons';

// Views (re-exported from @ngaf/render for convenience)
export { views, withViews, withoutViews, toRenderRegistry } from '@ngaf/render';
export type { ViewRegistry } from '@ngaf/render';
export { provideViews, VIEW_REGISTRY } from '@ngaf/render';

// Streaming / Generative UI
export { createContentClassifier } from './lib/streaming/content-classifier';
export type { ContentClassifier, ContentType } from './lib/streaming/content-classifier';
export { createParseTreeStore } from './lib/streaming/parse-tree-store';
export type { ParseTreeStore, ElementAccumulationState } from './lib/streaming/parse-tree-store';

// A2UI
export { createA2uiSurfaceStore } from './lib/a2ui/surface-store';
export type { A2uiSurfaceStore } from './lib/a2ui/surface-store';
export { A2uiSurfaceComponent } from './lib/a2ui/surface.component';
export { surfaceToSpec } from './lib/a2ui/surface-to-spec';
export { buildA2uiActionMessage } from './lib/a2ui/build-action-message';
export { a2uiBasicCatalog } from './lib/a2ui/catalog/index';
export { A2uiValidationErrorsComponent } from './lib/a2ui/catalog/validation-errors.component';
export { emitBinding } from './lib/a2ui/catalog/emit-binding';

// A2UI catalog components (for custom catalog composition via withViews)
export { A2uiTextFieldComponent } from './lib/a2ui/catalog/text-field.component';
export { A2uiCheckBoxComponent } from './lib/a2ui/catalog/check-box.component';
export { A2uiButtonComponent } from './lib/a2ui/catalog/button.component';
export { A2uiChoicePickerComponent } from './lib/a2ui/catalog/choice-picker.component';
export { A2uiSliderComponent } from './lib/a2ui/catalog/slider.component';
export { A2uiDateTimeInputComponent } from './lib/a2ui/catalog/date-time-input.component';
export { A2uiTextComponent } from './lib/a2ui/catalog/text.component';
export { A2uiIconComponent } from './lib/a2ui/catalog/icon.component';
export { A2uiImageComponent } from './lib/a2ui/catalog/image.component';
export { A2uiColumnComponent } from './lib/a2ui/catalog/column.component';
export { A2uiRowComponent } from './lib/a2ui/catalog/row.component';
export { A2uiCardComponent } from './lib/a2ui/catalog/card.component';
export { A2uiDividerComponent } from './lib/a2ui/catalog/divider.component';
export { A2uiListComponent } from './lib/a2ui/catalog/list.component';
export { A2uiModalComponent } from './lib/a2ui/catalog/modal.component';
export { A2uiTabsComponent } from './lib/a2ui/catalog/tabs.component';
export { A2uiAudioPlayerComponent } from './lib/a2ui/catalog/audio-player.component';
export { A2uiVideoComponent } from './lib/a2ui/catalog/video.component';

// A2UI types (re-exported from @ngaf/a2ui for convenience)
export type {
  A2uiActionMessage, A2uiClientDataModel,
  A2uiSurface, A2uiComponent, A2uiTheme,
  DynamicValue, DynamicString, DynamicNumber, DynamicBoolean,
  A2uiPathRef, A2uiFunctionCall,
  A2uiCheckRule, A2uiValidationResult,
} from '@ngaf/a2ui';
export { isPathRef, isFunctionCall } from '@ngaf/a2ui';

// Test utilities (no vitest dep — safe to ship in the main runtime bundle)
export { mockAgent } from './lib/testing/mock-agent';
export type { MockAgent, MockAgentOptions } from './lib/testing/mock-agent';

// Conformance helpers ship from the secondary entry point @ngaf/chat/testing
// (they import vitest at module level; keeping them out of the main bundle).
