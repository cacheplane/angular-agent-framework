// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  effect,
} from '@angular/core';
import { PalettePersistence } from './palette-persistence.service';
import type { DemoMode } from './demo-shell.component';

@Component({
  selector: 'app-control-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-palette.component.html',
  styleUrl: './control-palette.component.css',
})
export class ControlPalette {
  private readonly persistence = inject(PalettePersistence);

  readonly mode = input.required<DemoMode>();
  readonly model = input.required<string>();
  readonly modelOptions = input.required<readonly { value: string; label: string }[]>();
  readonly effort = input.required<string>();
  readonly effortOptions = input.required<readonly { value: string; label: string }[]>();
  readonly genUiMode = input.required<string>();
  readonly genUiOptions = input.required<readonly { value: string; label: string }[]>();
  readonly theme = input.required<string>();
  readonly themeOptions = input.required<readonly { value: string; label: string }[]>();
  readonly debugOpen = input.required<boolean>();

  readonly modeChange = output<DemoMode>();
  readonly modelChange = output<string>();
  readonly effortChange = output<string>();
  readonly genUiModeChange = output<string>();
  readonly themeChange = output<string>();
  readonly debugOpenChange = output<boolean>();
  readonly newConversation = output<void>();

  protected readonly collapsed = signal<boolean>(this.persistence.read('collapsed') ?? false);

  constructor() {
    effect(() => {
      this.persistence.write('collapsed', this.collapsed());
    });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
  }

  protected pickMode(next: DemoMode): void {
    this.modeChange.emit(next);
  }

  protected pickModel(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.modelChange.emit(value);
  }

  protected pickEffort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.effortChange.emit(value);
  }

  protected pickGenUiMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.genUiModeChange.emit(value);
  }

  protected pickTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.themeChange.emit(value);
  }

  protected toggleDebug(): void {
    this.debugOpenChange.emit(!this.debugOpen());
  }

  protected emitNewConversation(): void {
    this.newConversation.emit();
  }
}
