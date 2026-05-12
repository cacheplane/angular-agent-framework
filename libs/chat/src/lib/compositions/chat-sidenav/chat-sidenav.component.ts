// libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SIDENAV_STYLES } from '../../styles/chat-sidenav.styles';
import { ChatThreadListComponent, type Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';

export type ChatSidenavMode = 'expanded' | 'collapsed' | 'drawer';

@Component({
  selector: 'chat-sidenav',
  standalone: true,
  imports: [ChatThreadListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-mode]': 'mode()',
    '[attr.data-open]': 'open() ? "true" : "false"',
  },
  styles: [CHAT_HOST_TOKENS, CHAT_SIDENAV_STYLES],
  template: `
    @if (mode() === 'drawer' && open()) {
      <button
        type="button"
        class="chat-sidenav__scrim"
        aria-label="Close conversations"
        (click)="openChange.emit(false)"
      ></button>
    }
    <nav
      class="chat-sidenav"
      aria-label="Sidebar navigation"
      tabindex="-1"
      (keydown.escape)="onEscape()"
    >
      <div class="chat-sidenav__header">
        <ng-content select="[sidenavHeader]" />
      </div>

      <div class="chat-sidenav__actions">
        <button
          type="button"
          class="chat-sidenav__action chat-sidenav__action--new"
          (click)="newChat.emit()"
          aria-label="New chat"
          title="New chat"
        >
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span class="chat-sidenav__action-label">New chat</span>
        </button>
        <button
          type="button"
          class="chat-sidenav__action chat-sidenav__action--search"
          (click)="searchOpened.emit()"
          aria-label="Search conversations"
          title="Search conversations (⌘K)"
        >
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="chat-sidenav__action-label">Search</span>
        </button>
      </div>

      <div class="chat-sidenav__primary">
        <ng-content select="[sidenavPrimary]" />
      </div>

      @if (threads() !== null) {
        <div class="chat-sidenav__threads">
          <div class="chat-sidenav__threads-heading">Recent</div>
          <chat-thread-list
            [threads]="threads()!"
            [activeThreadId]="activeThreadId() ?? ''"
            (threadSelected)="threadSelected.emit($event)"
          />
        </div>
      }

      <div class="chat-sidenav__sections">
        <ng-content select="[sidenavSections]" />
      </div>

      <div class="chat-sidenav__account">
        <ng-content select="[sidenavAccount]" />
      </div>
    </nav>
  `,
})
export class ChatSidenavComponent {
  readonly mode = input<ChatSidenavMode>('expanded');
  readonly open = input<boolean>(false);
  readonly threads = input<Thread[] | null>(null);
  readonly activeThreadId = input<string | null>(null);

  readonly newChat = output<void>();
  readonly threadSelected = output<string>();
  readonly searchOpened = output<void>();
  readonly openChange = output<boolean>();

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
        const t = e.target as HTMLElement | null;
        if (t) {
          const tag = t.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
        }
        e.preventDefault();
        this.searchOpened.emit();
      });
  }

  protected onEscape(): void {
    if (this.mode() === 'drawer' && this.open()) {
      this.openChange.emit(false);
    }
  }
}
