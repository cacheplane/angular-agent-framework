// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  contentChild,
  contentChildren,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentWithHistory } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
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
    CHAT_HOST_TOKENS,
    `
    :host { display: contents; }

    /* Floating launcher */
    .launcher {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: var(--ngaf-chat-radius-launcher);
      background: var(--ngaf-chat-primary);
      color: var(--ngaf-chat-on-primary);
      border: 0;
      cursor: pointer;
      z-index: 990;
      box-shadow: var(--ngaf-chat-shadow-md);
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Docked panel */
    .panel {
      position: fixed;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      z-index: 991;
      display: flex;
      flex-direction: column;
      box-shadow: var(--ngaf-chat-shadow-lg);
    }
    .panel--right  { top: 0; right: 0; bottom: 0; width: var(--panel-size, 420px); border-right: 0; }
    .panel--left   { top: 0; left: 0;  bottom: 0; width: var(--panel-size, 420px); border-left: 0; }
    .panel--bottom { left: 0; right: 0; bottom: 0; height: var(--panel-size, 40vh); border-bottom: 0; }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .panel__title {
      margin: 0;
      font-size: var(--ngaf-chat-font-size-sm);
      font-weight: 600;
    }
    .panel__actions { display: flex; align-items: center; gap: var(--ngaf-chat-space-1); }
    .panel__actions button {
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--ngaf-chat-radius-button);
      padding: 2px 6px;
      color: var(--ngaf-chat-text-muted);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      cursor: pointer;
    }
    .panel__actions button:hover { color: var(--ngaf-chat-text); border-color: var(--ngaf-chat-separator); }
    .panel__actions button.is-active { color: var(--ngaf-chat-text); }

    .panel__controls {
      border-bottom: 1px solid var(--ngaf-chat-separator);
      overflow-y: auto;
      max-height: 40%;
    }
    .panel__controls:empty { display: none; }

    .panel__tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--ngaf-chat-separator);
      padding: 0 var(--ngaf-chat-space-2);
    }
    .panel__tab {
      appearance: none;
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-3);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
    }
    .panel__tab.is-active {
      color: var(--ngaf-chat-text);
      border-bottom-color: var(--ngaf-chat-primary);
    }

    .panel__body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    `,
  ],
  template: `
    @if (!open()) {
      <button
        type="button"
        class="launcher"
        title="Open chat debug"
        aria-label="Open chat debug"
        (click)="setOpen(true)"
      >⚙</button>
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
            <button type="button" [class.is-active]="dockState() === 'left'"   (click)="setDock('left')"   aria-label="Dock left">◧</button>
            <button type="button" [class.is-active]="dockState() === 'bottom'" (click)="setDock('bottom')" aria-label="Dock bottom">▭</button>
            <button type="button" [class.is-active]="dockState() === 'right'"  (click)="setDock('right')"  aria-label="Dock right">◨</button>
            <button type="button" (click)="setOpen(false)" aria-label="Close">×</button>
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

  @HostListener('document:keydown.escape', ['$event'])
  protected onEsc(_ev: Event): void {
    if (this.open()) {
      this.setOpen(false);
    }
  }
}
