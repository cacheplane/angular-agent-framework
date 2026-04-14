import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent } from './bar-chart.component';

describe('BarChartComponent', () => {
  let fixture: ComponentFixture<BarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BarChartComponent);
  });

  it('renders skeleton when data is null', () => {
    fixture.componentRef.setInput('title', 'Plans');
    fixture.componentRef.setInput('data', null);
    fixture.componentRef.setInput('labelKey', 'plan');
    fixture.componentRef.setInput('valueKey', 'count');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skeleton-chart')).toBeTruthy();
    expect(el.querySelector('svg')).toBeFalsy();
  });

  it('renders correct number of bars', () => {
    const data = [
      { plan: 'free', count: 1200 },
      { plan: 'starter', count: 850 },
      { plan: 'pro', count: 420 },
      { plan: 'enterprise', count: 95 },
    ];
    fixture.componentRef.setInput('title', 'Plans');
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('labelKey', 'plan');
    fixture.componentRef.setInput('valueKey', 'count');
    fixture.detectChanges();
    const rects = fixture.nativeElement.querySelectorAll('rect.bar');
    expect(rects.length).toBe(4);
  });

  it('renders title', () => {
    fixture.componentRef.setInput('title', 'Subscribers by Plan');
    fixture.componentRef.setInput('data', [{ plan: 'free', count: 100 }]);
    fixture.componentRef.setInput('labelKey', 'plan');
    fixture.componentRef.setInput('valueKey', 'count');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Subscribers by Plan');
  });
});
