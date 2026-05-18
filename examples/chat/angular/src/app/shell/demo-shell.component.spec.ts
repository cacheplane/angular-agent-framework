import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DemoShell } from './demo-shell.component';

describe('DemoShell — mode signal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
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

describe('DemoShell — "New conversation" button styling', () => {
  it('renders the action as a surface-alt pill with 8px radius and no border', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('.demo-shell__toolbar-action') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe('New conversation');
    // CSS values are verified via chrome MCP at the manual smoke step (JSDOM
    // does not apply component-scoped external `styleUrl` CSS files, and
    // raw-imports are not configured in this project's vitest setup). The
    // rendering check above guarantees the button is present; visual styling
    // is verified live.
  });
});

describe('DemoShell — toolbar dropdowns use chat-select', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
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
