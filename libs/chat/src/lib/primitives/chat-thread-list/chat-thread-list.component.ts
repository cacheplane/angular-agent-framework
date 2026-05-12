// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  contentChild,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_THREAD_LIST_STYLES } from '../../styles/chat-thread-list.styles';
import {
  ChatOverflowMenuComponent,
  type OverflowMenuItem,
} from '../chat-overflow-menu/chat-overflow-menu.component';
import { ChatConfirmDialogComponent } from '../chat-confirm-dialog/chat-confirm-dialog.component';

export type Thread = {
  id: string;
  /** Optional human-friendly label. Falls back to a slice of the id. */
  title?: string;
  /** Optional epoch-ms timestamp used by the default item template to
   *  render a relative-time line ("just now" / "5 min ago"). When absent
   *  the default template omits the second line. */
  updatedAt?: number;
  [key: string]: unknown;
};

/**
 * Per-thread row-action adapter. Consumer-provided. The framework calls
 * these methods after user confirmation (delete) or commit (rename) and
 * manages optimistic UI + rollback on rejection.
 *
 * Consumers MUST refresh their `threads` signal on success — the framework
 * clears optimistic overrides in a `finally` block, so a successful adapter
 * call that leaves the input list unchanged would re-render the row.
 */
export interface ThreadActionAdapter {
  delete?(threadId: string): Promise<void>;
  rename?(threadId: string, newTitle: string): Promise<void>;
}

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet, ChatOverflowMenuComponent, ChatConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_THREAD_LIST_STYLES],
  template: `
    @if (showNewThreadButton()) {
      <button type="button" class="chat-thread-list__new" (click)="newThreadRequested.emit()">+ New thread</button>
    }
    <ul class="chat-thread-list">
      @for (thread of visibleThreads(); track thread.id) {
        <li class="chat-thread-list__item-wrap">
          @if (templateRef()) {
            <ng-container
              [ngTemplateOutlet]="templateRef()!"
              [ngTemplateOutletContext]="{ $implicit: thread, isActive: thread.id === activeThreadId() }"
            />
          } @else if (editingThreadId() === thread.id) {
            <input
              #editInput
              class="chat-thread-list__edit"
              type="text"
              [value]="editingValue()"
              (input)="onEditInput($event)"
              (keydown.enter)="commitRename(thread.id)"
              (keydown.escape)="cancelRename()"
              (blur)="cancelRename()"
              aria-label="Rename conversation"
            />
          } @else {
            <button
              type="button"
              class="chat-thread-list__item"
              [attr.data-active]="thread.id === activeThreadId() ? 'true' : null"
              [attr.aria-current]="thread.id === activeThreadId() ? 'true' : null"
              (click)="selectThread(thread.id)"
            >
              <span class="chat-thread-list__item-title">{{ threadLabel(thread) }}</span>
              @if (thread.updatedAt !== undefined) {
                <span class="chat-thread-list__item-time">{{ relativeTime(thread.updatedAt) }}</span>
              }
            </button>

            @if (showKebab()) {
              <button
                #kebab
                type="button"
                class="chat-thread-list__kebab"
                aria-label="More actions"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuOpenForId() === thread.id ? 'true' : 'false'"
                (click)="openMenu(thread.id, kebab)"
              >⋯</button>
            }
          }
        </li>
      }
    </ul>

    <chat-overflow-menu
      [open]="menuOpenForId() !== null"
      [items]="currentMenuItems()"
      [anchor]="menuAnchor()"
      (itemSelected)="onMenuAction($event)"
      (closed)="menuOpenForId.set(null)"
    />

    <chat-confirm-dialog
      [open]="confirmDeleteId() !== null"
      title="Delete conversation?"
      body="This conversation will be permanently deleted."
      confirmLabel="Delete"
      tone="destructive"
      (confirmed)="performDelete()"
      (cancelled)="confirmDeleteId.set(null)"
    />
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Thread[]>();
  readonly activeThreadId = input<string>('');
  readonly showNewThreadButton = input<boolean>(false);
  readonly actions = input<ThreadActionAdapter | null>(null);

  readonly threadSelected = output<string>();
  readonly newThreadRequested = output<void>();

  readonly templateRef = contentChild(TemplateRef);

  protected readonly editingThreadId = signal<string | null>(null);
  protected readonly editingValue = signal<string>('');
  protected readonly menuOpenForId = signal<string | null>(null);
  protected readonly menuAnchor = signal<HTMLElement | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);

  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private readonly pendingRenames = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly visibleThreads = computed<Thread[]>(() => {
    const hidden = this.pendingDeletes();
    const renames = this.pendingRenames();
    return this.threads()
      .filter((t) => !hidden.has(t.id))
      .map((t) => (renames.has(t.id) ? ({ ...t, title: renames.get(t.id) }) : t));
  });

  protected readonly currentMenuItems = computed<OverflowMenuItem[]>(() => {
    const id = this.menuOpenForId();
    if (!id) return [];
    const a = this.actions();
    if (!a) return [];
    const items: OverflowMenuItem[] = [];
    if (a.rename) items.push({ id: 'rename', label: 'Rename' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
    return items;
  });

  private readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  selectThread(threadId: string): void {
    this.threadSelected.emit(threadId);
  }

  protected threadLabel(thread: Thread): string {
    const title = thread['title'];
    if (typeof title === 'string' && title.length > 0) return title;
    return thread.id;
  }

  protected relativeTime(epochMs: number): string {
    const delta = Date.now() - epochMs;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} hr ago`;
    return `${Math.floor(delta / 86_400_000)} day ago`;
  }

  protected showKebab(): boolean {
    const a = this.actions();
    if (!a) return false;
    return Boolean(a.rename || a.delete);
  }

  protected openMenu(threadId: string, anchor: HTMLElement): void {
    this.menuAnchor.set(anchor);
    this.menuOpenForId.set(threadId);
  }

  protected onMenuAction(id: string): void {
    const threadId = this.menuOpenForId();
    this.menuOpenForId.set(null);
    if (!threadId) return;

    if (id === 'rename') {
      const t = this.threads().find((x) => x.id === threadId);
      this.editingValue.set(typeof t?.title === 'string' ? t.title : '');
      this.editingThreadId.set(threadId);
      queueMicrotask(() => this.editInput()?.nativeElement.focus());
    } else if (id === 'delete') {
      this.confirmDeleteId.set(threadId);
    }
  }

  protected onEditInput(e: Event): void {
    this.editingValue.set((e.target as HTMLInputElement).value);
  }

  protected cancelRename(): void {
    this.editingThreadId.set(null);
  }

  protected async commitRename(threadId: string): Promise<void> {
    const newTitle = this.editingValue().trim();
    this.editingThreadId.set(null);
    if (!newTitle) return;
    const a = this.actions();
    if (!a?.rename) return;

    this.pendingRenames.update((m) => {
      const n = new Map(m);
      n.set(threadId, newTitle);
      return n;
    });
    try {
      await a.rename(threadId, newTitle);
    } catch {
      // Rollback happens via the finally clear below.
    } finally {
      this.pendingRenames.update((m) => {
        const n = new Map(m);
        n.delete(threadId);
        return n;
      });
    }
  }

  protected async performDelete(): Promise<void> {
    const threadId = this.confirmDeleteId();
    this.confirmDeleteId.set(null);
    if (!threadId) return;
    const a = this.actions();
    if (!a?.delete) return;

    this.pendingDeletes.update((s) => new Set([...s, threadId]));
    try {
      await a.delete(threadId);
    } catch {
      // Rollback: clear override below so the row reappears.
    } finally {
      this.pendingDeletes.update((s) => {
        const n = new Set(s);
        n.delete(threadId);
        return n;
      });
    }
  }
}
