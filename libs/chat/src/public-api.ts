// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Shared types
export type { ChatConfig, MessageTemplateType } from './lib/chat.types';

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
export { ChatGenerativeUiComponent } from './lib/primitives/chat-generative-ui/chat-generative-ui.component';

// Test utilities
export { createMockStreamResourceRef } from './lib/testing/mock-stream-resource-ref';
