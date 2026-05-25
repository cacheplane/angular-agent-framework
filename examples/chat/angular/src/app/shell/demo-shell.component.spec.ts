import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import { LangGraphThreadsAdapter } from '@ngaf/langgraph';
import { DemoShell } from './demo-shell.component';

function createThreadsAdapterMock() {
  const threads = signal([]);
  const archivedThreads = signal([]);
  return {
    threads: threads.asReadonly(),
    archivedThreads: archivedThreads.asReadonly(),
    refresh: async () => undefined,
    getThread: async () => null,
    create: async () => 'new-thread',
    delete: async () => undefined,
    rename: async () => undefined,
    archive: async () => undefined,
    unarchive: async () => undefined,
    pin: async () => undefined,
    unpin: async () => undefined,
    moveToProject: async () => undefined,
    reorderPinned: async () => undefined,
  };
}

const threadsAdapterProvider = {
  provide: LangGraphThreadsAdapter,
  useFactory: createThreadsAdapterMock,
};

describe('DemoShell — mode signal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'popup', component: DemoShell },
          { path: 'sidebar', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('defaults to "embed" when URL is /', async () => {
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('embed');
  });

  it('resolves "popup" when navigating to /popup', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/popup');
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('popup');
  });

  it('falls back to "embed" for unknown segments', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/bogus');
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('embed');
  });
});

describe('DemoShell — toolbar layout', () => {
  it('no longer renders the "New conversation" button (removed for tightness)', () => {
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.demo-shell__toolbar-action')).toBeNull();
  });

  it('renders fields without visible per-field labels (tighter toolbar)', () => {
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const fields = fx.nativeElement.querySelectorAll('.demo-shell__field');
    expect(fields.length).toBe(4);
    for (const field of Array.from(fields) as HTMLElement[]) {
      // No <span> sibling labels remain inside fields.
      expect(field.querySelector(':scope > span')).toBeNull();
    }
  });
});

describe('DemoShell — toolbar dropdowns use chat-select', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('renders the four toolbar fields with <chat-select>, not native <select>', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const fields = fx.nativeElement.querySelectorAll('.demo-shell__field');
    expect(fields.length).toBe(4);
    for (const field of Array.from(fields) as HTMLElement[]) {
      expect(field.querySelector('chat-select')).toBeTruthy();
      expect(field.querySelector('select')).toBeNull();
    }
  });
});

describe('DemoShell — URL thread sync', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: 'popup', component: DemoShell },
          { path: 'popup/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('does not clear an agent-created thread id while URL navigation is still pending', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { (): string | null; set(value: string | null): void };
    };

    expect(cmp.threadIdSignal()).toBeNull();
    cmp.threadIdSignal.set('thread-created-by-agent');
    fx.detectChanges();

    expect(cmp.threadIdSignal()).toBe('thread-created-by-agent');
  });

  it('does not write the active thread id to localStorage (URL is the source of truth)', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { set(value: string | null): void };
    };

    cmp.threadIdSignal.set('thread-created-by-agent');
    fx.detectChanges();

    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    const stored = raw ? JSON.parse(raw) : {};
    expect(stored.threadId).toBeUndefined();
  });

  it('ignores any legacy persisted threadId — bare mode URLs start fresh', async () => {
    localStorage.setItem(
      'ngaf-chat-demo:palette',
      JSON.stringify({ threadId: 'legacy-persisted-thread' }),
    );
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/popup');

    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { (): string | null };
    };
    expect(cmp.threadIdSignal()).toBeNull();
  });

  it('hydrates the active thread id from /<mode>/<threadId> URLs', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/url-thread');

    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { (): string | null };
    };
    expect(cmp.threadIdSignal()).toBe('url-thread');
  });

  it('does not re-navigate when hydrating from URL (no nav-loop)', async () => {
    // Regression guard for the URL↔signal sync invariant that every PR
    // in the routing chain (#500/#504/#514/#518/#527) was dancing
    // around: when the URL→signal effect hydrates `threadIdSignal`
    // from `/embed/<id>`, the subsequent signal→URL effect must see
    // signal === urlId and short-circuit (compare-and-set guard).
    // Without that guard we'd loop: URL → signal → router.navigate →
    // URL again, observable as extra NavigationEnd events.
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/no-loop-thread');

    // Subscribe BEFORE createComponent so we capture any NavigationEnd
    // events the component's effects might emit. The initial nav above
    // already fired before we subscribed, so it doesn't count.
    const navEnds: string[] = [];
    const sub = router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) navEnds.push(e.urlAfterRedirects);
    });

    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    sub.unsubscribe();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { (): string | null };
    };
    expect(cmp.threadIdSignal()).toBe('no-loop-thread');
    // Zero NavigationEnd events — the signal→URL effect short-circuited
    // because signal already matched urlState (compare-and-set guard).
    expect(navEnds).toEqual([]);
  });
});

describe('DemoShell — URL knob hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('hydrates knob signals from URL query params', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano&effort=high&theme=material-dark');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      model: () => string;
      effort: () => string;
      theme: () => string;
    };
    expect(cmp.model()).toBe('gpt-5-nano');
    expect(cmp.effort()).toBe('high');
    expect(cmp.theme()).toBe('material-dark');
  });

  it('does NOT write to localStorage when hydrating from URL (ephemeral semantics)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?theme=material-dark');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    const stored = raw ? JSON.parse(raw) : {};
    expect(stored.theme).toBeUndefined();
  });

  it('drops default knob values from URL on change-to-default', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModelChange(v: string): void;
    };
    cmp.onModelChange('gpt-5-mini'); // default
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).not.toContain('model=');
  });

  it('writes non-default knob values to URL on change', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModelChange(v: string): void;
    };
    cmp.onModelChange('gpt-5-nano');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('model=gpt-5-nano');
  });

  it('user knob action persists to localStorage (regression guard)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onThemeChange(v: string): void;
    };
    cmp.onThemeChange('material-dark');
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    const stored = raw ? JSON.parse(raw) : {};
    expect(stored.theme).toBe('material-dark');
  });

  it('preserves query params on mode change', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModeChange(next: string): void;
    };
    cmp.onModeChange('popup');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('model=gpt-5-nano');
  });

  it('preserves query params on thread switch (signal→URL effect)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { set(v: string | null): void };
    };
    cmp.threadIdSignal.set('xyz123');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('/embed/xyz123');
    expect(router.url).toContain('model=gpt-5-nano');
  });
});
