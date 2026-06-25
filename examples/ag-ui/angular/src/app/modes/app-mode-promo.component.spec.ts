// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppModePromoComponent } from './app-mode-promo.component';

function setup(hasMapsKey: boolean) {
  TestBed.configureTestingModule({ imports: [AppModePromoComponent] });
  const fixture = TestBed.createComponent(AppModePromoComponent);
  fixture.componentRef.setInput('hasMapsKey', hasMapsKey);
  fixture.detectChanges();
  return fixture;
}

describe('AppModePromoComponent', () => {
  it('renders the headline, four capability pills, and the CTA', () => {
    const el: HTMLElement = setup(true).nativeElement;
    expect(el.textContent).toContain('See your trip come alive on a live map');
    expect(el.querySelectorAll('.promo__pill').length).toBe(4);
    const cta = el.querySelector<HTMLButtonElement>('.promo__cta');
    expect(cta).toBeTruthy();
    expect(cta!.disabled).toBe(false);
  });

  it('emits enable when the CTA is clicked', () => {
    const fixture = setup(true);
    let emitted = 0;
    fixture.componentInstance.enable.subscribe(() => (emitted += 1));
    fixture.nativeElement.querySelector<HTMLButtonElement>('.promo__cta')!.click();
    expect(emitted).toBe(1);
  });

  it('disables the CTA and shows the key note when hasMapsKey is false', () => {
    const el: HTMLElement = setup(false).nativeElement;
    const cta = el.querySelector<HTMLButtonElement>('.promo__cta');
    expect(cta!.disabled).toBe(true);
    expect(el.textContent).toContain('GOOGLE_MAPS_API_KEY');
    expect(cta!.title).toBe('Set GOOGLE_MAPS_API_KEY to enable');
  });
});
