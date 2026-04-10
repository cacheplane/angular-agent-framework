// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, OnDestroy, viewChild, ElementRef, effect } from '@angular/core';
import {
  RenderSpecComponent,
  RenderElementComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@cacheplane/render';
import type { Spec } from '@json-render/core';
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { ExampleSplitLayoutComponent } from '@cacheplane/example-layouts';
import { REPEAT_LOOPS_SPECS } from './specs';

// --- Inline view components registered in the demo registry ---

@Component({
  selector: 'demo-text',
  standalone: true,
  template: `
    @if (displayContent()) {
      <p class="text-gray-100 text-sm">{{ displayContent() }}</p>
    } @else if (loading()) {
      <div class="space-y-1.5 py-1">
        <div class="h-3 w-full bg-gray-800 rounded skeleton-shimmer"></div>
        <div class="h-3 w-2/3 bg-gray-800 rounded skeleton-shimmer"></div>
      </div>
    }
  `,
})
class DemoTextComponent {
  readonly content = input<unknown>('');
  readonly displayContent = computed(() => {
    const c = this.content();
    return typeof c === 'string' ? c : '';
  });
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
    @if (displayContent()) {
      <h2 class="text-lg font-bold text-gray-100 mb-2">{{ displayContent() }}</h2>
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
  readonly content = input<unknown>('');
  readonly displayContent = computed(() => {
    const c = this.content();
    return typeof c === 'string' ? c : '';
  });
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
  selector: 'app-repeat-loops',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent, ExampleSplitLayoutComponent],
  template: `
    <example-split-layout>
      <!-- Spec picker -->
      <div header class="flex items-center gap-2 px-4 py-3">
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

      <!-- Left: Live Render Output -->
      <div primary>
        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Live Render Output</div>
        @if (simulator.spec(); as renderedSpec) {
          <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
        } @else {
          <div class="text-gray-600 text-sm italic">Press play to start streaming...</div>
        }
      </div>

      <!-- Right: JSON + Controls -->
      <div secondary class="flex flex-col h-full">
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
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">List Controls</div>
          <div class="space-y-3">
            <button
              class="w-full text-xs px-3 py-1.5 rounded-md bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors"
              (click)="addItem()">
              + Add Item
            </button>
            @if (getItems().length) {
              <div class="space-y-1">
                @for (item of getItems(); track $index) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-300 truncate">{{ item }}</span>
                    <button class="text-gray-500 hover:text-red-400 text-[10px] transition-colors"
                            (click)="removeItem($index)">x</button>
                  </div>
                }
              </div>
            }
            <p class="text-[10px] text-gray-600 leading-relaxed">
              Modify <code class="text-indigo-400/70 font-mono">/items</code> array in the store.
            </p>
          </div>
        </div>
      </div>

      <!-- Timeline bar -->
      <streaming-timeline footer [simulator]="simulator" class="border-t border-gray-800" />
    </example-split-layout>
  `,
})
export class RepeatLoopsComponent implements OnDestroy {
  protected readonly specs = REPEAT_LOOPS_SPECS;
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
    Card: DemoCardComponent,
  });

  protected readonly store = signalStateStore({ items: ['Alpha', 'Beta', 'Gamma'] });

  private counter = 0;

  protected getItems(): string[] {
    return (this.store.get('/items') as string[]) ?? [];
  }

  protected addItem(): void {
    this.counter++;
    const items = this.getItems();
    this.store.set('/items', [...items, `Item ${this.counter}`]);
  }

  protected removeItem(index: number): void {
    const items = this.getItems();
    this.store.set('/items', items.filter((_: string, i: number) => i !== index));
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
