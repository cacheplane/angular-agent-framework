import { Component, input } from '@angular/core';

@Component({
  selector: 'approval-card',
  standalone: true,
  template: `
    <div class="border rounded-xl my-2 overflow-hidden" style="border-color: var(--ngaf-chat-separator); background: var(--ngaf-chat-surface-alt);">
      <!-- Warning header -->
      <div class="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
           style="background: var(--ngaf-chat-warning-bg); color: var(--ngaf-chat-warning-text);">
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        Requires Approval
      </div>

      <!-- Body -->
      <div class="px-4 py-3">
        <p class="text-sm mb-4" style="color: var(--ngaf-chat-text);">{{ description() }}</p>

        <div class="flex items-center gap-2">
          <button
            (click)="emit()('approve')"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            style="background: var(--ngaf-chat-success); color: #fff;"
            onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
            Approve
          </button>
          <button
            (click)="emit()('edit')"
            class="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
            style="border-color: var(--ngaf-chat-separator); color: var(--ngaf-chat-text); background: transparent;"
            onmouseover="this.style.background='var(--ngaf-chat-surface-alt)'" onmouseout="this.style.background='transparent'">
            Edit
          </button>
          <button
            (click)="emit()('cancel')"
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            style="color: var(--ngaf-chat-text-muted); background: transparent;"
            onmouseover="this.style.background='var(--ngaf-chat-surface-alt)'" onmouseout="this.style.background='transparent'">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ApprovalCardComponent {
  readonly description = input<string>('');
  readonly emit = input<(event: string) => void>(() => {});
}
