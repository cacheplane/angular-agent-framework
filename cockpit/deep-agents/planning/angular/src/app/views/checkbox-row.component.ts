import { Component, input } from '@angular/core';

@Component({
  selector: 'checkbox-row',
  standalone: true,
  template: `
    <label class="flex items-center gap-2 py-1 cursor-pointer text-sm" style="color: var(--chat-text);">
      <input
        type="checkbox"
        [checked]="checked()"
        (change)="toggle()"
        class="w-4 h-4"
      />
      <span [class.line-through]="checked()" [style.opacity]="checked() ? '0.5' : '1'">
        {{ label() }}
      </span>
    </label>
  `,
})
export class CheckboxRowComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly emit = input<(event: string) => void>(() => {});

  toggle(): void {
    this.emit()('toggle');
  }
}
