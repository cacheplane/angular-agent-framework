// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  effect,
  ElementRef,
  HostListener,
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
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

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
  /** True while the agent is streaming. Drives the status-dot pulse. */
  readonly streaming = input<boolean>(false);

  readonly modeChange = output<DemoMode>();
  readonly modelChange = output<string>();
  readonly effortChange = output<string>();
  readonly genUiModeChange = output<string>();
  readonly themeChange = output<string>();
  readonly debugOpenChange = output<boolean>();
  readonly newConversation = output<void>();

  /**
   * Whether the palette is collapsed to its status-pill state. Defaults
   * to true (pill = resting state, matching Next.js dev tools). Persisted
   * across reloads via PalettePersistence.
   */
  protected readonly collapsed = signal<boolean>(this.persistence.read('collapsed') ?? true);

  constructor() {
    effect(() => {
      this.persistence.write('collapsed', this.collapsed());
    });
  }

  protected expand(): void {
    this.collapsed.set(false);
  }

  protected close(): void {
    this.collapsed.set(true);
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

  /**
   * Close the panel on document-level clicks outside the palette.
   * No-ops when already collapsed; checks event.target containment so
   * inside-panel clicks don't close.
   */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.collapsed()) return;
    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) return;
    this.close();
  }

  /** Close on Escape anywhere in the document while the panel is open. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.collapsed()) this.close();
  }

  /**
   * Selected-option label for a value across an options list. Used by the
   * styled select trigger to show the human-friendly label rather than
   * the raw value.
   */
  protected labelFor(
    value: string,
    options: readonly { value: string; label: string }[],
  ): string {
    const match = options.find(o => o.value === value);
    return match?.label ?? value;
  }
}
