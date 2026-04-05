// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { StreamResourceRef } from '@cacheplane/stream-resource';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { DebugTimelineComponent } from './debug-timeline.component';
import { DebugDetailComponent } from './debug-detail.component';
import { DebugControlsComponent } from './debug-controls.component';
import { DebugSummaryComponent } from './debug-summary.component';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';
import { messageContent } from '../shared/message-utils';

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    DebugTimelineComponent,
    DebugDetailComponent,
    DebugControlsComponent,
    DebugSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full">
      <!-- Chat area -->
      <div class="flex-1 flex flex-col min-w-0">
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <chat-messages [ref]="ref()">
            <ng-template chatMessageTemplate="human" let-message>
              <div class="flex justify-end">
                <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-blue-600 text-white">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="ai" let-message>
              <div class="flex justify-start">
                <div class="max-w-[75%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-900">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="tool" let-message>
              <div class="flex justify-start">
                <div class="max-w-[75%] rounded-lg px-3 py-2 bg-gray-50 text-gray-600 text-sm font-mono border border-gray-200">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>

            <ng-template chatMessageTemplate="system" let-message>
              <div class="flex justify-center">
                <div class="text-xs text-gray-400 italic">
                  {{ messageContent(message) }}
                </div>
              </div>
            </ng-template>
          </chat-messages>

          <chat-typing-indicator [ref]="ref()" />
        </div>

        <chat-error [ref]="ref()" />

        <div class="border-t border-gray-200 p-4">
          <chat-input
            [ref]="ref()"
            [submitOnEnter]="true"
            placeholder="Type a message..."
          />
        </div>
      </div>

      <!-- Debug panel toggle (when closed) -->
      @if (!debugOpen()) {
        <button
          class="w-8 flex items-center justify-center border-l border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500"
          title="Open debug panel"
          (click)="debugOpen.set(true)"
        >
          &laquo;
        </button>
      }

      <!-- Debug panel -->
      @if (debugOpen()) {
        <div class="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
          <!-- Header -->
          <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Debug</h3>
            <button
              class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              (click)="debugOpen.set(false)"
            >&raquo; Close</button>
          </div>

          <!-- Summary -->
          <div class="px-3 py-2 border-b border-gray-100">
            <chat-debug-summary [ref]="ref()" [checkpoints]="checkpoints()" />
          </div>

          <!-- Controls -->
          <div class="px-3 py-2 border-b border-gray-100">
            <chat-debug-controls
              [ref]="ref()"
              [checkpointCount]="checkpoints().length"
              [selectedIndex]="selectedCheckpointIndex()"
              (stepForward)="stepForward()"
              (stepBack)="stepBack()"
              (jumpToStart)="jumpToStart()"
              (jumpToEnd)="jumpToEnd()"
            />
          </div>

          <!-- Timeline -->
          <div class="flex-1 overflow-y-auto px-3 py-2">
            <chat-debug-timeline
              [checkpoints]="checkpoints()"
              [selectedIndex]="selectedCheckpointIndex()"
              (checkpointSelected)="selectedCheckpointIndex.set($event)"
            />
          </div>

          <!-- Detail -->
          @if (selectedCheckpointIndex() >= 0) {
            <div class="border-t border-gray-200 px-3 py-2 max-h-64 overflow-y-auto">
              <chat-debug-detail
                [currentState]="selectedState()"
                [previousState]="previousState()"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatDebugComponent {
  readonly ref = input.required<StreamResourceRef<any, any>>();

  readonly debugOpen = signal<boolean>(true);
  readonly selectedCheckpointIndex = signal<number>(-1);

  readonly checkpoints = computed((): DebugCheckpoint[] =>
    this.ref().history().map((state, i) => toDebugCheckpoint(state, i)),
  );

  readonly selectedState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.ref().history();
    return extractStateValues(history[idx]);
  });

  readonly previousState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.ref().history();
    if (idx <= 0) return {};
    return extractStateValues(history[idx - 1]);
  });

  // Message templates are intentionally co-located (shadcn copy-paste model)
  readonly messageContent = messageContent;

  stepForward(): void {
    const idx = this.selectedCheckpointIndex();
    if (idx < this.checkpoints().length - 1) {
      this.selectedCheckpointIndex.set(idx + 1);
    }
  }

  stepBack(): void {
    const idx = this.selectedCheckpointIndex();
    if (idx > 0) {
      this.selectedCheckpointIndex.set(idx - 1);
    }
  }

  jumpToStart(): void {
    this.selectedCheckpointIndex.set(0);
  }

  jumpToEnd(): void {
    this.selectedCheckpointIndex.set(this.checkpoints().length - 1);
  }
}
