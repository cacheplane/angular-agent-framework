import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BackupTableComponent, type BackupRow } from './backup-table.component';

const ROWS: BackupRow[] = [
  { id: 'bk-2026-05-28-prod', location: 's3://acme-db-backups/prod/2026-05-28.dump.gz', created_at: '2026-05-28', size_gb: 37.8 },
  { id: 'bk-2026-03-15-prod', location: 's3://acme-db-backups/prod/2026-03-15.dump.gz', created_at: '2026-03-15', size_gb: 35, retain: true },
];

function mount(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(BackupTableComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BackupTableComponent', () => {
  it('shows a pending state while the tool runs and no table', () => {
    const el = mount({ older_than_days: 90, status: 'running' });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('pending');
    expect(el.textContent).toMatch(/Listing backups older than 90 days/);
    expect(el.querySelector('table')).toBeNull();
  });

  it('renders the rows on completion and flags the retained one', () => {
    const el = mount({ older_than_days: 90, status: 'complete', backups: ROWS, total: 8 });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('rows');
    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('bk-2026-05-28-prod');
    expect(rows[0].textContent).toContain('37.8 GB');
    expect(rows[1].querySelector('.bt__retain')?.textContent).toMatch(/retain/i);
    expect(rows[0].querySelector('.bt__retain')).toBeNull();
    expect(el.textContent).toMatch(/2 of 8 backups are older than 90 days/);
  });

  it('says so when nothing matches', () => {
    const el = mount({ older_than_days: 400, status: 'complete', backups: [], total: 8 });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('empty');
    expect(el.textContent).toMatch(/No backups are older than 400 days/);
    expect(el.querySelector('table')).toBeNull();
  });
});
