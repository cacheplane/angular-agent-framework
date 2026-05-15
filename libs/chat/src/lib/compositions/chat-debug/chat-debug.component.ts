// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  contentChild,
  contentChildren,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentWithHistory } from '../../agent';
import { CHAT_DEBUG_TOKENS } from './chat-debug-tokens';
import { ChatDebugControlsDirective } from './chat-debug-controls.directive';
import { ChatDebugInspectorDirective } from './chat-debug-inspector.directive';
import { TimelineInspectorComponent } from './inspectors/timeline-inspector.component';
import { StateInspectorComponent } from './inspectors/state-inspector.component';
import { createPersistence } from './persistence';

export type DockPosition = 'right' | 'bottom' | 'left';

interface TabEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: 'builtin-timeline' | 'builtin-state' | 'host';
  readonly hostIndex?: number;
}

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TimelineInspectorComponent,
    StateInspectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: contents; }

    /* ── Status pill launcher ─────────────────────────────────────── */
    .launcher {
      position: fixed;
      top: 20px;
      right: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--ngaf-chat-debug-radius-pill);
      background: var(--ngaf-chat-debug-bg);
      border: 1px solid var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
      cursor: pointer;
      z-index: 990;
      box-shadow: var(--ngaf-chat-debug-shadow-pill);
      transition: background 120ms ease, border-color 120ms ease;
      padding: 0;
    }
    .launcher:hover {
      background: var(--ngaf-chat-debug-surface);
      border-color: var(--ngaf-chat-debug-border-strong);
    }
    .launcher__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ngaf-chat-debug-success);
      box-shadow: 0 0 8px color-mix(in srgb, var(--ngaf-chat-debug-success) 60%, transparent);
    }
    .launcher__dot--streaming {
      background: var(--ngaf-chat-debug-accent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--ngaf-chat-debug-accent) 70%, transparent);
      animation: chat-debug-pill-pulse 1.2s ease-in-out infinite;
    }
    @keyframes chat-debug-pill-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.6; transform: scale(0.85); }
    }

    /* ── Docked panel ─────────────────────────────────────────────── */
    .panel {
      position: fixed;
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
      border: 1px solid var(--ngaf-chat-debug-border);
      z-index: 991;
      display: flex;
      flex-direction: column;
      box-shadow: var(--ngaf-chat-debug-shadow-panel);
      animation: chat-debug-panel-enter 120ms ease;
    }
    .panel--right {
      top: 0; right: 0; bottom: 0;
      width: var(--panel-size, 420px);
      border-right: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-bottom-left-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
    }
    .panel--left {
      top: 0; left: 0; bottom: 0;
      width: var(--panel-size, 420px);
      border-left: 0;
      border-top-right-radius: var(--ngaf-chat-debug-radius-panel);
      border-bottom-right-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom left;
    }
    .panel--bottom {
      left: 0; right: 0; bottom: 0;
      height: var(--panel-size, 40vh);
      border-bottom: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-top-right-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
    }
    @keyframes chat-debug-panel-enter {
      from { opacity: 0; transform: scale(0.96); }
      to   { opacity: 1; transform: scale(1); }
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      min-height: 44px;
      box-sizing: border-box;
    }
    .panel__title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--ngaf-chat-debug-text);
    }
    .panel__actions { display: flex; align-items: center; gap: 4px; }

    .panel__dock-group {
      display: inline-flex;
      gap: 0;
      padding: 2px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
    }
    .panel__dock-btn {
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 4px;
      width: 24px;
      height: 22px;
      padding: 0;
      color: var(--ngaf-chat-debug-text-subtle);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .panel__dock-btn:hover { color: var(--ngaf-chat-debug-text); }
    .panel__dock-btn.is-active {
      background: var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
    }
    .panel__dock-btn svg { display: block; }

    .panel__close {
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 6px;
      width: 26px;
      height: 26px;
      margin-left: 4px;
      color: var(--ngaf-chat-debug-text-subtle);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .panel__close:hover {
      background: var(--ngaf-chat-debug-surface);
      color: var(--ngaf-chat-debug-text);
    }

    .panel__controls {
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      overflow-y: auto;
      max-height: 50%;
      background: var(--ngaf-chat-debug-bg);
    }
    .panel__controls:empty { display: none; }

    .panel__tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      padding: 0 12px;
      background: var(--ngaf-chat-debug-bg);
    }
    .panel__tab {
      appearance: none;
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: 10px 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      color: var(--ngaf-chat-debug-text-muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
      margin-bottom: -1px;
    }
    .panel__tab:hover { color: var(--ngaf-chat-debug-text); }
    .panel__tab.is-active {
      color: var(--ngaf-chat-debug-text);
      border-bottom-color: var(--ngaf-chat-debug-accent);
    }

    .panel__body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--ngaf-chat-debug-bg); }
    `,
  ],
  template: `
    @if (!open()) {
      <button
        type="button"
        class="launcher"
        title="Open chat debug"
        aria-label="Open chat debug"
        [attr.aria-pressed]="false"
        (click)="setOpen(true)"
      >
        <span
          class="launcher__dot"
          [class.launcher__dot--streaming]="isStreaming()"
          aria-hidden="true"
        ></span>
      </button>
    } @else {
      <div
        class="panel"
        [class.panel--right]="dockState() === 'right'"
        [class.panel--bottom]="dockState() === 'bottom'"
        [class.panel--left]="dockState() === 'left'"
        role="region"
        aria-label="Chat debug"
      >
        <div class="panel__header">
          <h3 class="panel__title">Chat Debug</h3>
          <div class="panel__actions">
            <div class="panel__dock-group" role="group" aria-label="Dock position">
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'left'"
                (click)="setDock('left')"
                aria-label="Dock left">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="5.5" y1="2.5" x2="5.5" y2="11.5"/></svg>
              </button>
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'bottom'"
                (click)="setDock('bottom')"
                aria-label="Dock bottom">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="1.5" y1="8.5" x2="12.5" y2="8.5"/></svg>
              </button>
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'right'"
                (click)="setDock('right')"
                aria-label="Dock right">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="8.5" y1="2.5" x2="8.5" y2="11.5"/></svg>
              </button>
            </div>
            <button type="button" class="panel__close" (click)="setOpen(false)" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
            </button>
          </div>
        </div>

        @if (controls()) {
          <div class="panel__controls">
            <ng-container [ngTemplateOutlet]="controls()!.templateRef" />
          </div>
        }

        @if (tabs().length > 1) {
          <div class="panel__tabs" role="tablist">
            @for (tab of tabs(); track tab.id) {
              <button
                type="button"
                role="tab"
                class="panel__tab"
                [class.is-active]="tab.id === activeTabId()"
                [attr.aria-selected]="tab.id === activeTabId()"
                (click)="setActiveTab(tab.id)"
              >{{ tab.label }}</button>
            }
          </div>
        }

        <div class="panel__body">
          @switch (activeTab()?.kind) {
            @case ('builtin-timeline') {
              <chat-debug-timeline-inspector
                [agent]="agent()"
                (replayRequested)="replayRequested.emit($event)"
                (forkRequested)="forkRequested.emit($event)"
              />
            }
            @case ('builtin-state') {
              <chat-debug-state-tab [agent]="agent()" />
            }
            @case ('host') {
              @if (activeHostInspector(); as host) {
                <ng-container [ngTemplateOutlet]="host.templateRef" />
              }
            }
          }
        </div>
      </div>
    }
  `,
})
export class ChatDebugComponent {
  readonly agent = input.required<AgentWithHistory>();
  readonly dock = input<DockPosition>('right');
  readonly defaultOpen = input<boolean>(false);
  readonly storageKey = input<string>('chat-debug');

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();
  readonly openChange = output<boolean>();
  readonly dockChange = output<DockPosition>();

  protected readonly controls = contentChild(ChatDebugControlsDirective);
  protected readonly hostInspectors = contentChildren(ChatDebugInspectorDirective);

  protected readonly open = signal<boolean>(false);
  protected readonly dockState = signal<DockPosition>('right');
  protected readonly activeTabId = signal<string>('timeline');

  /** Reads `agent.status()` reactively for the launcher dot. */
  protected readonly isStreaming = computed(() => {
    const status = this.agent().status?.();
    return status === 'running';
  });

  protected readonly tabs = computed((): TabEntry[] => {
    const host = this.hostInspectors().map((d, i): TabEntry => ({
      id: `host-${i}`,
      label: d.label(),
      kind: 'host',
      hostIndex: i,
    }));
    return [
      { id: 'timeline', label: 'Timeline', kind: 'builtin-timeline' },
      { id: 'state', label: 'State', kind: 'builtin-state' },
      ...host,
    ];
  });

  protected readonly activeTab = computed(() =>
    this.tabs().find((t) => t.id === this.activeTabId()),
  );

  protected readonly activeHostInspector = computed(() => {
    const t = this.activeTab();
    if (!t || t.kind !== 'host' || t.hostIndex === undefined) return undefined;
    return this.hostInspectors()[t.hostIndex];
  });

  private readonly hostEl: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    // Restore once from storage on construction; inputs seed the fallback.
    // `storageKey` is read-once: rebinding it at runtime is not supported.
    const restore = createPersistence(this.storageKey());
    const persistedOpen = restore.read<boolean>('open');
    this.open.set(persistedOpen ?? this.defaultOpen());
    const persistedDock = restore.read<DockPosition>('dock');
    this.dockState.set(persistedDock ?? this.dock());
    const persistedTab = restore.read<string>('tab');
    if (persistedTab) this.activeTabId.set(persistedTab);

    // Write-through effect — reads each writable signal so subsequent
    // changes trigger a fresh run that writes them all to storage.
    effect(() => {
      const p = createPersistence(this.storageKey());
      p.write('open', this.open());
      p.write('dock', this.dockState());
      p.write('tab', this.activeTabId());
    });
  }

  setOpen(value: boolean): void {
    this.open.set(value);
    this.openChange.emit(value);
  }

  setDock(next: DockPosition): void {
    this.dockState.set(next);
    this.dockChange.emit(next);
  }

  setActiveTab(id: string): void {
    this.activeTabId.set(id);
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.setOpen(false);
  }

  /**
   * Click-outside dismiss. When the panel is open, any click whose
   * composed path doesn't include our host element closes the panel.
   */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const path = event.composedPath();
    if (path.includes(this.hostEl.nativeElement)) return;
    this.setOpen(false);
  }
}
