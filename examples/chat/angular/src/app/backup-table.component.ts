import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One row of the demo graph's backup inventory (examples/chat/python/src/backups.py). */
export interface BackupRow {
  id: string;
  location: string;
  created_at: string;
  size_gb: number;
  retain?: boolean;
}

type ViewState = 'pending' | 'rows' | 'empty';

/**
 * Tool view for the graph's `list_backups` call, registered through
 * `demoViews()`. The chat composition feeds it the call's streaming args
 * (`older_than_days`), the parsed result (`backups`, `total`) and the call
 * `status`, so the SAME component shows "listing…" while the tool runs and
 * the table once it returns — the tool-progress beat needs no extra wiring.
 *
 * Input names mirror the tool's JSON keys on purpose (`older_than_days`):
 * `chat-tool-views` matches props to inputs by their public template name.
 */
@Component({
  selector: 'app-backup-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bt" [attr.data-state]="state()">
      <div class="bt__head">
        @switch (state()) {
          @case ('pending') {
            <span class="bt__title">Listing backups older than {{ olderThanDays() ?? '…' }} days</span>
            <span class="bt__badge">Running…</span>
          }
          @case ('empty') {
            <span class="bt__title">No backups are older than {{ olderThanDays() }} days.</span>
          }
          @default {
            <span class="bt__title">
              {{ backups().length }} of {{ total() ?? backups().length }} backups are older than {{ olderThanDays() }} days
            </span>
          }
        }
      </div>
      @if (state() === 'rows') {
        <table class="bt__table">
          <thead>
            <tr><th>Backup</th><th>Location</th><th>Created</th><th class="bt__num">Size</th></tr>
          </thead>
          <tbody>
            @for (b of backups(); track b.id) {
              <tr [class.bt__row--retain]="b.retain === true">
                <td>
                  <code class="bt__id">{{ b.id }}</code>
                  @if (b.retain) { <span class="bt__retain">retain</span> }
                </td>
                <td class="bt__loc">{{ b.location }}</td>
                <td>{{ b.created_at }}</td>
                <td class="bt__num">{{ b.size_gb }} GB</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .bt { margin: 4px 0 8px; padding: 12px 14px; border: 1px solid var(--tplane-chat-separator); border-radius: var(--tplane-chat-radius-card); background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text); font-size: var(--tplane-chat-font-size-sm); }
    .bt__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bt__title { font-weight: 600; }
    .bt__badge { flex: none; padding: 2px 8px; border: 1px solid var(--tplane-chat-separator); border-radius: var(--tplane-chat-radius-button); background: color-mix(in srgb, var(--tplane-chat-primary) 12%, var(--tplane-chat-surface-alt)); color: var(--tplane-chat-primary); font-size: var(--tplane-chat-font-size-xs); }
    .bt__table { width: 100%; margin-top: 10px; border-collapse: collapse; }
    .bt__table th { text-align: left; padding: 4px 8px 6px 0; color: var(--tplane-chat-text-muted); font-size: var(--tplane-chat-font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .bt__table td { padding: 5px 8px 5px 0; border-top: 1px solid var(--tplane-chat-separator); vertical-align: top; }
    .bt__num { text-align: right; white-space: nowrap; }
    .bt__id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tplane-chat-font-size-xs); }
    .bt__loc { color: var(--tplane-chat-text-muted); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tplane-chat-font-size-xs); word-break: break-all; }
    .bt__retain { margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--tplane-chat-warning-text) 14%, var(--tplane-chat-surface-alt)); color: var(--tplane-chat-warning-text); font-size: var(--tplane-chat-font-size-xs); font-weight: 600; }
    .bt__row--retain td { color: var(--tplane-chat-text-muted); }
  `],
})
export class BackupTableComponent {
  readonly olderThanDays = input<number | undefined>(undefined, { alias: 'older_than_days' });
  readonly backups = input<BackupRow[]>([]);
  readonly total = input<number | undefined>(undefined);
  readonly status = input<'pending' | 'running' | 'complete' | 'error' | undefined>(undefined);

  readonly state = computed<ViewState>(() => {
    const s = this.status();
    if (s !== 'complete' && s !== 'error') return 'pending';
    return this.backups().length === 0 ? 'empty' : 'rows';
  });
}
