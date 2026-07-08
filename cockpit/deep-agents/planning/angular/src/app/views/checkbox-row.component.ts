import { Component, input } from '@angular/core';

@Component({
  selector: 'checkbox-row',
  standalone: true,
  template: `
    <label class="check-row">
      <input
        type="checkbox"
        [checked]="checked()"
        (change)="toggle()"
        class="check-row__box"
      />
      <span class="check-row__label" [class.check-row__label--checked]="checked()">
        {{ label() }}
      </span>
    </label>
  `,
  styles: [`
    .check-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0;
      color: var(--tplane-chat-text);
      cursor: pointer;
      font-size: var(--tplane-chat-font-size-sm);
    }

    .check-row__box {
      width: 1rem;
      height: 1rem;
      accent-color: var(--tplane-chat-primary);
    }

    .check-row__label--checked {
      opacity: 0.5;
      text-decoration: line-through;
    }
  `],
})
export class CheckboxRowComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly emit = input<(event: string) => void>(() => {});

  toggle(): void {
    this.emit()('toggle');
  }
}
