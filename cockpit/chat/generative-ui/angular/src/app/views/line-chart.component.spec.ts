import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineChartComponent } from './line-chart.component';

describe('LineChartComponent', () => {
  let fixture: ComponentFixture<LineChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LineChartComponent);
  });

  it('renders skeleton when data is null', () => {
    fixture.componentRef.setInput('title', 'MRR Trend');
    fixture.componentRef.setInput('data', null);
    fixture.componentRef.setInput('xKey', 'month');
    fixture.componentRef.setInput('yKey', 'mrr');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skeleton-chart')).toBeTruthy();
    expect(el.querySelector('svg')).toBeFalsy();
  });

  it('renders SVG with correct number of data points', () => {
    const data = [
      { month: '2026-01', mrr: 37000 },
      { month: '2026-02', mrr: 38500 },
      { month: '2026-03', mrr: 40200 },
    ];
    fixture.componentRef.setInput('title', 'MRR Trend');
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('xKey', 'month');
    fixture.componentRef.setInput('yKey', 'mrr');
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).toBeTruthy();
    const circles = svg.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('renders title', () => {
    fixture.componentRef.setInput('title', 'MRR Trend');
    fixture.componentRef.setInput('data', [{ month: '2026-01', mrr: 37000 }]);
    fixture.componentRef.setInput('xKey', 'month');
    fixture.componentRef.setInput('yKey', 'mrr');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MRR Trend');
  });
});
