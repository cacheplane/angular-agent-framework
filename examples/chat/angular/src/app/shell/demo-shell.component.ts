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
import { agent } from '@ngaf/langgraph';
import { ChatDebugComponent } from '@ngaf/chat';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';
import { DEMO_AGENT, DEMO_MODEL } from './shell-tokens';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-shell.component.html',
  styleUrl: './demo-shell.component.css',
  providers: [
    { provide: DEMO_AGENT, useFactory: () => inject(DemoShell).agent },
    { provide: DEMO_MODEL, useFactory: () => inject(DemoShell).model },
  ],
})
export class DemoShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(PalettePersistence);

  protected readonly mode = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => modeFromUrl(e.urlAfterRedirects)),
      startWith(modeFromUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: modeFromUrl(this.router.url) },
  );

  /** Source of truth for the model picker. Mode components read it via DEMO_MODEL. */
  readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');

  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);

  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  /** Persisted thread id (null on first run). Reactive so reload reconnects to the same thread. */
  private readonly threadIdSignal = signal<string | null>(this.persistence.read('threadId') ?? null);

  /**
   * Shared agent instance. Patched submit injects state.model on every
   * submission so the graph picks up the latest model selection without
   * a reconnect.
   */
  readonly agent = (() => {
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
    });
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) =>
      orig(
        { ...(input ?? {}), state: { ...((input as { state?: Record<string, unknown> })?.state ?? {}), model: this.model() } },
        opts,
      )) as typeof a.submit;
    return a;
  })();

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

  /**
   * Clear persisted thread id and drop the signal. The next submit
   * causes the SDK to create a fresh thread server-side; onThreadId
   * fires and re-persists it.
   */
  protected onNewConversation(): void {
    this.persistence.write('threadId', null);
    this.threadIdSignal.set(null);
  }
}
