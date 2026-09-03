// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HeroCursorComponent } from './hero-cursor.component';

describe('HeroCursorComponent', () => {
  it('is hidden until shown, then positions itself', () => {
    TestBed.configureTestingModule({ imports: [HeroCursorComponent] });
    const fx = TestBed.createComponent(HeroCursorComponent);
    fx.componentRef.setInput('x', 0);
    fx.componentRef.setInput('y', 0);
    fx.componentRef.setInput('visible', false);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.dataset['visible']).toBe('false');
    fx.componentRef.setInput('visible', true);
    fx.componentRef.setInput('x', 120);
    fx.componentRef.setInput('y', 48);
    fx.detectChanges();
    expect(el.dataset['visible']).toBe('true');
    expect(el.style.transform).toBe('translate(120px, 48px)');
  });
});
