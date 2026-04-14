import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatCardComponent);
  });

  it('renders skeleton when value is null', () => {
    fixture.componentRef.setInput('label', 'MRR');
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skeleton')).toBeTruthy();
    expect(el.textContent).toContain('MRR');
  });

  it('renders value and delta when provided', () => {
    fixture.componentRef.setInput('label', 'MRR');
    fixture.componentRef.setInput('value', 42000);
    fixture.componentRef.setInput('delta', '+8.2%');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.skeleton')).toBeFalsy();
    expect(el.textContent).toContain('42,000');
    expect(el.textContent).toContain('+8.2%');
  });

  it('applies positive color to positive delta', () => {
    fixture.componentRef.setInput('label', 'MRR');
    fixture.componentRef.setInput('value', 42000);
    fixture.componentRef.setInput('delta', '+8.2%');
    fixture.detectChanges();
    const deltaEl = fixture.nativeElement.querySelector('[data-testid="delta"]');
    expect(deltaEl?.classList.contains('text-emerald-400')).toBe(true);
  });

  it('applies negative color to negative delta', () => {
    fixture.componentRef.setInput('label', 'Churn');
    fixture.componentRef.setInput('value', '3.2%');
    fixture.componentRef.setInput('delta', '-0.4%');
    fixture.detectChanges();
    const deltaEl = fixture.nativeElement.querySelector('[data-testid="delta"]');
    expect(deltaEl?.classList.contains('text-red-400')).toBe(true);
  });
});
