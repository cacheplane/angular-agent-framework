// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [RouterOutlet, ControlPalette],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-shell.component.html',
  styleUrl: './demo-shell.component.css',
})
export class DemoShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(PalettePersistence);

  /** Read-side mode signal, derived from router URL. */
  protected readonly mode = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => modeFromUrl(e.urlAfterRedirects)),
      startWith(modeFromUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: modeFromUrl(this.router.url) },
  );

  protected readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');
  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected onModeChange(next: DemoMode): void {
    void this.router.navigate(['/' + next]);
  }

  protected onModelChange(next: string): void {
    this.model.set(next);
    this.persistence.write('model', next);
  }

  protected onDebugChange(next: boolean): void {
    this.debugOpen.set(next);
    this.persistence.write('debug', next);
  }

  protected onNewConversation(): void {
    // Wired in Phase 3 — this no-op placeholder exists so the palette
    // emits cleanly during the bones-only phase. Phase 3 replaces it
    // with threadId reset.
  }
}
