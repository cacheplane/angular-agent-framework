import { Component, input } from '@angular/core';

interface PipelineStep {
  label: string;
  status: 'pending' | 'active' | 'complete';
}

@Component({
  selector: 'step-pipeline',
  standalone: true,
  template: `
    <div class="border rounded-xl p-4 my-2 overflow-x-auto" style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <div class="flex items-center gap-0 min-w-max">
        @for (step of steps(); track step.label; let i = $index; let last = $last) {
          <!-- Step node -->
          <div class="flex flex-col items-center gap-1.5">
            <!-- Status circle -->
            @switch (step.status) {
              @case ('complete') {
                <div class="w-8 h-8 rounded-full flex items-center justify-center"
                     style="background: var(--chat-success, #16a34a);">
                  <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              }
              @case ('active') {
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center animate-spin"
                     style="border-color: var(--chat-warning-text, #f59e0b); animation-duration: 1.2s;">
                  <div class="w-2 h-2 rounded-full" style="background: var(--chat-warning-text, #f59e0b);"></div>
                </div>
              }
              @default {
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                     style="border-color: var(--chat-text-muted, #555);">
                  <div class="w-2 h-2 rounded-full" style="background: var(--chat-text-muted, #555);"></div>
                </div>
              }
            }
            <!-- Label -->
            <span class="text-xs whitespace-nowrap"
                  [style.color]="step.status === 'active'
                    ? 'var(--chat-warning-text, #f59e0b)'
                    : step.status === 'complete'
                      ? 'var(--chat-success, #16a34a)'
                      : 'var(--chat-text-muted, #777)'"
                  [class.font-semibold]="step.status === 'active'">
              {{ step.label }}
            </span>
          </div>

          <!-- Connecting line -->
          @if (!last) {
            <div class="w-10 h-0.5 -mt-5 mx-1"
                 [style.background]="step.status === 'complete'
                   ? 'var(--chat-success, #16a34a)'
                   : 'var(--chat-text-muted, #555)'">
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class StepPipelineComponent {
  readonly steps = input<PipelineStep[]>([]);
}
