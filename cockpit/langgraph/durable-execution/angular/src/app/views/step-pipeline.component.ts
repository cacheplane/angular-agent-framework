import { Component, input } from '@angular/core';

interface PipelineStep {
  label: string;
  status: 'pending' | 'active' | 'complete';
}

@Component({
  selector: 'step-pipeline',
  standalone: true,
  styles: `
    :host {
      --st-done: #2ea567;
      --st-active: #e0a850;
      --st-error: #e0645a;
    }
    .pipeline {
      border: 1px solid var(--ds-border, #2d2d2d);
      border-radius: var(--ds-radius-xl, 18px);
      padding: 1rem;
      margin: 0.5rem 0;
      background: var(--ds-surface, #1c1c1c);
      overflow-x: auto;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0;
      min-width: max-content;
    }
    .node {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .circle {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .circle--complete {
      background: var(--st-done);
    }
    .circle--complete svg {
      width: 16px;
      height: 16px;
      color: #fff;
    }
    .circle--active {
      border: 2px solid var(--st-active);
      animation: sp-spin 1.2s linear infinite;
    }
    .circle--pending {
      border: 2px solid var(--ds-border, #2d2d2d);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
    }
    .dot--active {
      background: var(--st-active);
    }
    .dot--pending {
      background: var(--ds-text-muted, #a0a0a0);
    }
    @keyframes sp-spin {
      to {
        transform: rotate(360deg);
      }
    }
    .label {
      font-size: 12px;
      white-space: nowrap;
    }
    .label--active {
      font-weight: 600;
      color: var(--st-active);
    }
    .label--complete {
      color: var(--st-done);
    }
    .label--pending {
      color: var(--ds-text-muted, #a0a0a0);
    }
    .line {
      width: 2.5rem;
      height: 2px;
      margin: 0 4px;
      margin-top: -20px;
    }
    .line--done {
      background: var(--st-done);
    }
    .line--pending {
      background: var(--ds-border, #2d2d2d);
    }
  `,
  template: `
    <div class="pipeline">
      <div class="row">
        @for (step of steps(); track step.label; let i = $index; let last = $last) {
          <!-- Step node -->
          <div class="node">
            <!-- Status circle -->
            @switch (step.status) {
              @case ('complete') {
                <div class="circle circle--complete">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              }
              @case ('active') {
                <div class="circle circle--active">
                  <div class="dot dot--active"></div>
                </div>
              }
              @default {
                <div class="circle circle--pending">
                  <div class="dot dot--pending"></div>
                </div>
              }
            }
            <!-- Label -->
            <span
              class="label"
              [class.label--active]="step.status === 'active'"
              [class.label--complete]="step.status === 'complete'"
              [class.label--pending]="step.status === 'pending'"
            >
              {{ step.label }}
            </span>
          </div>

          <!-- Connecting line -->
          @if (!last) {
            <div class="line" [class.line--done]="step.status === 'complete'" [class.line--pending]="step.status !== 'complete'"></div>
          }
        }
      </div>
    </div>
  `,
})
export class StepPipelineComponent {
  readonly steps = input<PipelineStep[]>([]);
}
