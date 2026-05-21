import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
          { path: 'popup', component: DemoShell },
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

  it('persists an agent-created thread id for bare mode route fallback', () => {
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { set(value: string | null): void };
    };

    cmp.threadIdSignal.set('thread-created-by-agent');
    fx.detectChanges();

    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    expect(raw ? JSON.parse(raw).threadId : null).toBe('thread-created-by-agent');
  });

  it('falls back to the persisted active thread on bare mode routes', async () => {
    localStorage.setItem(
      'ngaf-chat-demo:palette',
      JSON.stringify({ threadId: 'persisted-thread' }),
    );
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/popup');

    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { (): string | null };
    };
    expect(cmp.threadIdSignal()).toBe('persisted-thread');
  });
});
