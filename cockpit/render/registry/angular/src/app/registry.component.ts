// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, OnDestroy } from '@angular/core';
import {
  RenderSpecComponent,
  RenderElementComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@cacheplane/render';
import type { Spec } from '@json-render/core';
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { REGISTRY_SPECS } from './specs';

// --- Inline view components registered in the demo registry ---

@Component({
  selector: 'demo-text',
  standalone: true,
  template: `<p class="text-gray-100 text-sm">{{ content() }}</p>`,
})
class DemoTextComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-heading',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <h2 class="text-lg font-bold text-gray-100">{{ content() }}</h2>
    @for (key of childKeys(); track key) {
      <render-element [elementKey]="key" [spec]="spec()!" />
    }
  `,
})
class DemoHeadingComponent {
  readonly content = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-badge',
  standalone: true,
  template: `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">{{ label() }}</span>`,
})
class DemoBadgeComponent {
  readonly label = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'demo-card',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="rounded-lg border border-gray-800 bg-gray-900 p-4 mb-3">
      <h3 class="text-sm font-semibold text-gray-200 mb-2">{{ title() }}</h3>
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()!" />
      }
    </div>
  `,
})
class DemoCardComponent {
  readonly title = input('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

@Component({
  selector: 'app-registry',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent],
  template: `
    <div class="flex flex-col h-screen bg-gray-950 text-gray-100">
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
        <div class="flex-1 overflow-y-auto p-6 border-r border-gray-800">
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Live Render Output</div>
          @if (simulator.spec(); as renderedSpec) {
            <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
          } @else {
            <div class="text-gray-600 text-sm italic">Press play to start streaming...</div>
          }
        </div>

        <!-- Right: Streaming JSON -->
        <div class="w-80 shrink-0 overflow-y-auto p-4 bg-gray-900/50">
          <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Streaming JSON</div>
          <pre class="text-[11px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all">{{ simulator.rawJson() }}<span class="text-indigo-400 animate-pulse">|</span></pre>
          <div class="mt-3 flex justify-between text-[10px]">
            <span class="text-indigo-400">{{ simulator.playing() ? 'Streaming...' : simulator.position() >= simulator.total() ? 'Complete' : 'Paused' }}</span>
            <span class="text-gray-500">{{ percent() }}%</span>
          </div>
        </div>
      </div>

      <!-- Timeline bar -->
      <streaming-timeline [simulator]="simulator" class="border-t border-gray-800" />
    </div>
  `,
})
export class RegistryComponent implements OnDestroy {
  protected readonly specs = REGISTRY_SPECS;
  protected activeIndex = 0;

  protected readonly simulator = new StreamingSimulator(this.specs[0].json);

  protected readonly registry = defineAngularRegistry({
    Text: DemoTextComponent,
    Heading: DemoHeadingComponent,
    Badge: DemoBadgeComponent,
    Card: DemoCardComponent,
  });

  protected readonly store = signalStateStore({});

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
