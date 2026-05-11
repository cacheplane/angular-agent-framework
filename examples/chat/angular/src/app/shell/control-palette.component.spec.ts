// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';

@Component({
  standalone: true,
  imports: [ControlPalette],
  template: `<app-control-palette
    [mode]="'embed'"
    [model]="'gpt-5-mini'"
    [modelOptions]="[{ value: 'gpt-5-mini', label: 'gpt-5-mini' }]"
    [effort]="'minimal'"
    [effortOptions]="[{ value: 'minimal', label: 'minimal' }]"
    [genUiMode]="'a2ui'"
    [genUiOptions]="[{ value: 'a2ui', label: 'A2UI v1' }]"
    [theme]="'default-dark'"
    [themeOptions]="[{ value: 'default-dark', label: 'Default dark' }]"
    [debugOpen]="debug()"
    [streaming]="streaming()"
    (debugOpenChange)="debug.set($event)"
  />`,
})
class HostComponent {
  debug = signal(false);
  streaming = signal(false);
}

class StubPersistence {
  private store: Record<string, unknown> = {};
  read<T>(key: string): T | undefined { return this.store[key] as T | undefined; }
  write<T>(key: string, value: T): void { this.store[key] = value; }
}

describe('ControlPalette — pill / panel toggle', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: PalettePersistence, useClass: StubPersistence }],
    });
  });

  it('starts in the pill state (collapsed) on first run', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.palette-panel')).toBeNull();
  });

  it('clicking the pill opens the panel', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-panel')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeNull();
  });

  it('clicking the close button collapses the panel back to a pill', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-panel__close') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('Escape keydown closes the panel', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('document click outside the palette closes it', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();

    const outsideTarget = document.createElement('div');
    document.body.appendChild(outsideTarget);
    outsideTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fx.detectChanges();
    document.body.removeChild(outsideTarget);

    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('document click INSIDE the panel does not close it', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();

    const title = fx.nativeElement.querySelector('.palette-panel__title') as HTMLElement;
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fx.detectChanges();

    expect(fx.nativeElement.querySelector('.palette-panel')).toBeTruthy();
  });

  it('streaming=true adds the streaming class on the dot when pill is visible', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.streaming.set(true);
    fx.detectChanges();
    expect(
      fx.nativeElement.querySelector('.palette-pill__dot--streaming'),
    ).toBeTruthy();
  });

  it('debug switch toggles aria-checked via output', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    const sw = fx.nativeElement.querySelector('.palette-switch') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.click();
    fx.detectChanges();
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});
