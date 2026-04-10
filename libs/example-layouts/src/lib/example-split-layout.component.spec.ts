import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExampleSplitLayoutComponent } from './example-split-layout.component';

@Component({
  standalone: true,
  imports: [ExampleSplitLayoutComponent],
  template: `
    <example-split-layout>
      <div header data-testid="header">Header</div>
      <div primary data-testid="primary">Primary</div>
      <div secondary data-testid="secondary">Secondary</div>
      <div footer data-testid="footer">Footer</div>
    </example-split-layout>
  `,
})
class TestHostComponent {}

describe('ExampleSplitLayoutComponent', () => {
  it('should render all four content slots', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="header"]')?.textContent).toBe('Header');
    expect(el.querySelector('[data-testid="primary"]')?.textContent).toBe('Primary');
    expect(el.querySelector('[data-testid="secondary"]')?.textContent).toBe('Secondary');
    expect(el.querySelector('[data-testid="footer"]')?.textContent).toBe('Footer');
  });

  it('should use responsive flex-col md:flex-row for split panes', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const splitContainer = el.querySelector('.flex.flex-col.md\\:flex-row.flex-1.min-h-0');
    expect(splitContainer).toBeTruthy();
  });

  it('should have header with bottom border', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const headerContainer = el.querySelector('.shrink-0.border-b.border-gray-800');
    expect(headerContainer).toBeTruthy();
    expect(headerContainer?.querySelector('[data-testid="header"]')).toBeTruthy();
  });

  it('should have secondary pane with correct responsive classes', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const secondary = el.querySelector('.w-full.md\\:w-80');
    expect(secondary).toBeTruthy();
    expect(secondary?.classList.contains('shrink-0')).toBe(true);
  });
});
