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
