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

describe('DemoShell — toolbar layout', () => {
  it('no longer renders the "New conversation" button (removed for tightness)', () => {
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
    expect(fx.nativeElement.querySelector('.demo-shell__toolbar-action')).toBeNull();
  });

  it('renders fields without visible per-field labels (tighter toolbar)', () => {
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
