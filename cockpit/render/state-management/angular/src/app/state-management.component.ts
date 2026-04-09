// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, OnDestroy, viewChild, ElementRef, effect } from '@angular/core';
import {
  RenderSpecComponent,
  RenderElementComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@cacheplane/render';
import type { Spec } from '@json-render/core';
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { STATE_MANAGEMENT_SPECS } from './specs';

// --- Inline view components ---

@Component({
  selector: 'demo-text',
  standalone: true,
  template: `
    @if (content()) {
      <p class="text-gray-100 text-sm">{{ content() }}</p>
    } @else if (loading()) {
      <div class="space-y-1.5 py-1">
        <div class="h-3 w-full bg-gray-800 rounded skeleton-shimmer"></div>
        <div class="h-3 w-2/3 bg-gray-800 rounded skeleton-shimmer"></div>
      </div>
    }
  `,
})
class DemoTextComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-heading',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    @if (content()) {
      <h2 class="text-lg font-bold text-gray-100 mb-2">{{ content() }}</h2>
    } @else if (loading()) {
      <div class="h-5 w-48 bg-gray-700 rounded skeleton-shimmer mb-2"></div>
    }
    @for (key of childKeys(); track key) {
      <render-element [elementKey]="key" [spec]="spec()!" />
    }
    @if (!childKeys().length && loading()) {
      <div class="space-y-2 mt-2">
        <div class="h-3 w-full bg-gray-800 rounded skeleton-shimmer"></div>
        <div class="h-3 w-5/6 bg-gray-800 rounded skeleton-shimmer"></div>
      </div>
    }
  `,
})
class DemoHeadingComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-label',
  standalone: true,
  template: `
    @if (label() || value()) {
      <div class="flex items-center gap-2">
        <span class="text-gray-500 text-xs uppercase font-semibold">{{ label() }}:</span>
        <span class="text-gray-100 text-sm font-mono">{{ value() }}</span>
      </div>
    } @else if (loading()) {
      <div class="space-y-1.5 py-1">
        <div class="h-3 w-full bg-gray-800 rounded skeleton-shimmer"></div>
        <div class="h-3 w-2/3 bg-gray-800 rounded skeleton-shimmer"></div>
      </div>
    }
  `,
})
class DemoLabelComponent {
  readonly label = input('');
  readonly value = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'demo-card',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="rounded-lg border border-gray-800 bg-gray-900 p-4 mb-3 transition-opacity"
         [class.animate-pulse]="loading() && !childKeys().length">
      @if (title()) {
        <h3 class="text-sm font-semibold text-gray-200 mb-2">{{ title() }}</h3>
      } @else if (loading()) {
        <div class="h-4 w-32 bg-gray-700 rounded skeleton-shimmer mb-2"></div>
      }
      @if (childKeys().length) {
        @for (key of childKeys(); track key) {
          <render-element [elementKey]="key" [spec]="spec()!" />
        }
      } @else if (loading()) {
        <div class="space-y-2">
          <div class="h-3 w-full bg-gray-800 rounded skeleton-shimmer"></div>
          <div class="h-3 w-3/4 bg-gray-800 rounded skeleton-shimmer"></div>
        </div>
      }
    </div>
  `,
})
class DemoCardComponent {
  readonly title = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => {});
  readonly loading = input(false);
}

@Component({
  selector: 'app-state-management',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent],
  template: `
    <div class="flex flex-col h-full bg-gray-950 text-gray-100">
      <!-- Spec picker -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <span class="text-xs text-gray-500 uppercase tracking-wide font-semibold mr-2">Spec:</span>
        @for (spec of specs; track spec.label; let i = $index) {
          <button
            class="text-xs px-3 py-1.5 rounded-md transition-colors"
            [class]="i === activeIndex ? 'bg-indigo-500 text-white font-semibold' : 'bg-gray-800 text-gray-400 hover:text-gray-200'"
            (click)="selectSpec(i)">
            {{ spec.label }}
          </button>
        }
      </div>

      <!-- Split panes -->
      <div class="flex flex-1 min-h-0">
        <!-- Left: Live Render Output -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Live Render Output</div>
          @if (simulator.spec(); as renderedSpec) {
            <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
          } @else {
            <div class="text-gray-600 text-sm italic">Press play to start streaming...</div>
          }
        </div>

        <!-- Right: JSON + Controls -->
        <div class="w-80 shrink-0 flex flex-col border-l border-gray-800 bg-gray-900/50">
          <!-- Streaming JSON (scrollable) -->
          <div class="flex-1 overflow-y-auto p-4" #jsonPane>
            <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Streaming JSON</div>
            <pre class="text-[11px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all">{{ simulator.rawJson() }}<span class="text-indigo-400 animate-pulse">|</span></pre>
            <div class="mt-3 flex justify-between text-[10px]">
              <span class="text-indigo-400">{{ simulator.playing() ? 'Streaming...' : simulator.position() >= simulator.total() ? 'Complete' : 'Paused' }}</span>
              <span class="text-gray-500">{{ percent() }}%</span>
            </div>
          </div>

          <!-- Controls (pinned at bottom) -->
          <div class="shrink-0 border-t border-gray-800 p-4">
            <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">State Controls</div>
            <div class="space-y-3">
              <div>
                <label class="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Name</label>
                <input type="text"
                       class="w-full px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:border-indigo-500 focus:outline-none"
                       [value]="getState('/user/name')"
                       (input)="store.set('/user/name', $any($event.target).value)" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Age</label>
                <input type="number"
                       class="w-full px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:border-indigo-500 focus:outline-none"
                       [value]="getState('/user/age')"
                       (input)="store.set('/user/age', +$any($event.target).value)" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Theme</label>
                <select class="w-full px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:border-indigo-500 focus:outline-none"
                        [value]="getState('/settings/theme')"
                        (change)="store.set('/settings/theme', $any($event.target).value)">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <p class="text-[10px] text-gray-600 leading-relaxed">
                Edit values to update the state store. Rendered elements with <code class="text-indigo-400/70 font-mono">$state</code> bindings react.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline bar -->
      <streaming-timeline [simulator]="simulator" class="border-t border-gray-800" />
    </div>
  `,
})
export class StateManagementComponent implements OnDestroy {
  protected readonly specs = STATE_MANAGEMENT_SPECS;
  protected activeIndex = 0;

  protected readonly simulator = new StreamingSimulator(this.specs[0].json);

  private readonly jsonPane = viewChild<ElementRef<HTMLElement>>('jsonPane');

  constructor() {
    effect(() => {
      this.simulator.rawJson();
      const el = this.jsonPane()?.nativeElement;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    });
  }

  protected readonly registry = defineAngularRegistry({
    Text: DemoTextComponent,
    Heading: DemoHeadingComponent,
    Label: DemoLabelComponent,
    Card: DemoCardComponent,
  });

  protected readonly store = signalStateStore({ user: { name: 'Alice', age: 30 }, settings: { theme: 'dark' } });

  protected getState(path: string): unknown {
    return this.store.get(path);
  }

  protected percent(): number {
    return Math.round(this.simulator.progress() * 100);
  }

  protected selectSpec(index: number): void {
    this.activeIndex = index;
    this.simulator.setSource(this.specs[index].json);
    this.simulator.play();
  }

  ngOnDestroy(): void {
    this.simulator.destroy();
  }
}
