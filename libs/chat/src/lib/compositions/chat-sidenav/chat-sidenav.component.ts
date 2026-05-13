// libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SIDENAV_STYLES } from '../../styles/chat-sidenav.styles';
import {
  ChatThreadListComponent,
  type Thread,
  type ThreadActionAdapter,
} from '../../primitives/chat-thread-list/chat-thread-list.component';
import {
  ChatProjectListComponent,
  type Project,
  type ProjectActionAdapter,
} from '../../primitives/chat-project-list/chat-project-list.component';

export type ChatSidenavMode = 'expanded' | 'collapsed' | 'drawer';

@Component({
  selector: 'chat-sidenav',
  standalone: true,
  imports: [ChatThreadListComponent, ChatProjectListComponent],
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

      <div class="chat-sidenav__topbar">
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
        @if (mode() !== 'drawer') {
          <button
            type="button"
            class="chat-sidenav__action chat-sidenav__action--collapse"
            (click)="onCollapseToggle()"
            [attr.aria-label]="mode() === 'collapsed' ? 'Expand sidenav' : 'Collapse sidenav'"
            [attr.title]="(mode() === 'collapsed' ? 'Expand sidenav' : 'Collapse sidenav') + ' (⌘B)'"
          >
            @if (mode() === 'collapsed') {
              <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18"/>
              </svg>
            } @else {
              <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="15 6 9 12 15 18"/>
              </svg>
            }
            <span class="chat-sidenav__action-label">{{ mode() === 'collapsed' ? 'Expand' : 'Collapse' }}</span>
          </button>
        }
        @if (mode() === 'drawer') {
          <button
            type="button"
            class="chat-sidenav__action chat-sidenav__action--close"
            (click)="openChange.emit(false)"
            aria-label="Close conversations"
            title="Close conversations"
          >
            <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span class="chat-sidenav__action-label">Close</span>
          </button>
        }
      </div>

      <div class="chat-sidenav__actions">
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

      @if (projects() !== null) {
        <div class="chat-sidenav__projects">
          <div class="chat-sidenav__threads-heading">Projects</div>
          <chat-project-list
            [projects]="projects()!"
            [activeProjectId]="selectedProjectId()"
            [showNewProjectButton]="!!projectActions()?.create"
            [actions]="projectActions()"
            (projectSelected)="projectSelected.emit($event)"
            (newProjectRequested)="newProjectRequested.emit()"
          />
        </div>
      }

      @if (threads() !== null) {
        <div class="chat-sidenav__threads">
          <div class="chat-sidenav__threads-heading">Recent</div>
          <chat-thread-list
            [threads]="threads()!"
            [activeThreadId]="activeThreadId() ?? ''"
            [actions]="actions()"
            [projects]="projects()"
            (threadSelected)="threadSelected.emit($event)"
          />
        </div>
      }

      @if (archivedThreads() !== null) {
        <div
          class="chat-sidenav__archived"
          [attr.data-open]="archivedOpen() ? 'true' : 'false'"
        >
          <button
            type="button"
            class="chat-sidenav__archived-heading"
            [attr.aria-expanded]="archivedOpen() ? 'true' : 'false'"
            aria-controls="chat-sidenav__archived-list"
            (click)="archivedOpen.set(!archivedOpen())"
          >
            <svg class="chat-sidenav__archived-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
            <span>Archived</span>
          </button>
          @if (archivedOpen()) {
            <div id="chat-sidenav__archived-list">
              @if (archivedThreads()!.length === 0) {
                <div class="chat-sidenav__archived-empty">No archived conversations.</div>
              } @else {
                <chat-thread-list
                  mode="archived"
                  [threads]="archivedThreads()!"
                  [activeThreadId]="activeThreadId() ?? ''"
                  [actions]="actions()"
                  [projects]="projects()"
                  (threadSelected)="threadSelected.emit($event)"
                />
              }
            </div>
          }
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
  readonly actions = input<ThreadActionAdapter | null>(null);
  readonly archivedThreads = input<Thread[] | null>(null);
  readonly projects = input<Project[] | null>(null);
  readonly selectedProjectId = input<string | null>(null);
  readonly projectActions = input<ProjectActionAdapter | null>(null);

  readonly newChat = output<void>();
  readonly threadSelected = output<string>();
  readonly searchOpened = output<void>();
  readonly openChange = output<boolean>();
  readonly modeChange = output<ChatSidenavMode>();
  readonly projectSelected = output<string>();
  readonly newProjectRequested = output<void>();

  protected readonly archivedOpen = signal<boolean>(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        const key = e.key.toLowerCase();
        if (key !== 'k' && key !== 'b') return;
        const t = e.target as HTMLElement | null;
        if (t) {
          const tag = t.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
        }
        if (key === 'k') {
          e.preventDefault();
          this.searchOpened.emit();
          return;
        }
        // Cmd/Ctrl+B: toggle expanded ↔ collapsed (no-op in drawer mode).
        if (this.mode() === 'drawer') return;
        e.preventDefault();
        this.modeChange.emit(this.mode() === 'collapsed' ? 'expanded' : 'collapsed');
      });
  }

  protected onEscape(): void {
    if (this.mode() === 'drawer' && this.open()) {
      this.openChange.emit(false);
    }
  }

  protected onCollapseToggle(): void {
    const m = this.mode();
    if (m === 'drawer') return;
    this.modeChange.emit(m === 'collapsed' ? 'expanded' : 'collapsed');
  }
}
