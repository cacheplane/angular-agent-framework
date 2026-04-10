import { Component, computed, Input, signal } from '@angular/core';

/**
 * Responsive chat-style layout with a main content area and optional sidebar.
 *
 * Content projection slots:
 * - `[main]` — primary content area (required)
 * - `[sidebar]` — optional sidebar that stacks below on mobile, beside on desktop
 *
 * When no `[sidebar]` content is projected, the `<aside>` collapses via `:empty` CSS.
 */
@Component({
  selector: 'example-chat-layout',
  standalone: true,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
    }
    aside:empty {
      display: none;
    }
  `,
  template: `
    <div [class]="containerClasses()">
      <div class="flex-1 min-w-0 min-h-0 flex flex-col">
        <ng-content select="[main]" />
      </div>
      <aside [class]="sidebarClasses()">
        <ng-content select="[sidebar]" />
      </aside>
    </div>
  `,
})
export class ExampleChatLayoutComponent {
  private readonly _sidebarPosition = signal<'left' | 'right'>('right');
  private readonly _sidebarWidth = signal('w-72');

  @Input()
  set sidebarPosition(value: 'left' | 'right') {
    this._sidebarPosition.set(value);
  }

  @Input()
  set sidebarWidth(value: string) {
    this._sidebarWidth.set(value);
  }

  protected readonly containerClasses = computed(() => {
    const base = 'flex flex-col md:flex-row flex-1 min-h-0';
    return this._sidebarPosition() === 'left'
      ? `${base} md:flex-row-reverse`
      : base;
  });

  protected readonly sidebarClasses = computed(() => {
    const width = this._sidebarWidth();
    const position = this._sidebarPosition();
    const borderClass = position === 'left' ? 'md:border-r' : 'md:border-l';
    return `w-full md:${width} shrink-0 border-t md:border-t-0 ${borderClass} border-gray-800 overflow-y-auto`;
  });
}
