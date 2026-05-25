// SPDX-License-Identifier: MIT
import { Component, computed, input, OnDestroy, viewChild, ElementRef, effect } from '@angular/core';
import {
  RenderSpecComponent,
  RenderElementComponent,
  defineAngularRegistry,
  signalStateStore,
} from '@threadplane/render';
import type { Spec } from '@json-render/core';
import { StreamingSimulator } from '../../../../shared/streaming-simulator';
import { StreamingTimelineComponent } from '../../../../shared/streaming-timeline.component';
import { ExampleSplitLayoutComponent } from '@threadplane/example-layouts';
import { REGISTRY_SPECS } from './specs';

// --- Inline view components registered in the demo registry ---

@Component({
  selector: 'demo-text',
  standalone: true,
  template: `
    @if (displayContent()) {
      <p class="text-[var(--ngaf-chat-text)] text-sm">{{ displayContent() }}</p>
    } @else if (loading()) {
      <div class="space-y-1.5 py-1">
        <div class="h-3 w-full bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
        <div class="h-3 w-2/3 bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
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
      <h2 class="text-lg font-bold text-[var(--ngaf-chat-text)] mb-2">{{ displayContent() }}</h2>
    } @else if (loading()) {
      <div class="h-5 w-48 bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer mb-2"></div>
    }
    @for (key of childKeys(); track key) {
      <render-element [elementKey]="key" [spec]="spec()!" />
    }
    @if (!childKeys().length && loading()) {
      <div class="space-y-2 mt-2">
        <div class="h-3 w-full bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
        <div class="h-3 w-5/6 bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
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
  selector: 'demo-badge',
  standalone: true,
  template: `
    @if (label()) {
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--ngaf-chat-primary)] text-[var(--ngaf-chat-on-primary)]">{{ label() }}</span>
    } @else if (loading()) {
      <div class="inline-block h-5 w-16 bg-[var(--ngaf-chat-surface-alt)] rounded-full skeleton-shimmer"></div>
    }
  `,
})
class DemoBadgeComponent {
  readonly label = input('');
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
    <div class="rounded-lg border border-[var(--ngaf-chat-separator)] bg-[var(--ngaf-chat-surface)] p-4 mb-3 transition-opacity"
         [class.animate-pulse]="loading() && !childKeys().length">
      @if (title()) {
        <h3 class="text-sm font-semibold text-[var(--ngaf-chat-text)] mb-2">{{ title() }}</h3>
      } @else if (loading()) {
        <div class="h-4 w-32 bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer mb-2"></div>
      }
      @if (childKeys().length) {
        @for (key of childKeys(); track key) {
          <render-element [elementKey]="key" [spec]="spec()!" />
        }
      } @else if (loading()) {
        <div class="space-y-2">
          <div class="h-3 w-full bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
          <div class="h-3 w-3/4 bg-[var(--ngaf-chat-surface-alt)] rounded skeleton-shimmer"></div>
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
  selector: 'app-registry',
  standalone: true,
  imports: [RenderSpecComponent, StreamingTimelineComponent, ExampleSplitLayoutComponent],
  template: `
    <example-split-layout>
      <!-- Spec picker -->
      <div header class="flex items-center gap-2 px-4 py-3">
        <span class="text-xs text-[var(--ngaf-chat-text-muted)] uppercase tracking-wide font-semibold mr-2">Spec:</span>
        @for (spec of specs; track spec.label; let i = $index) {
          <button
            class="text-xs px-3 py-1.5 rounded-md transition-colors"
            [class]="i === activeIndex ? 'bg-[var(--ngaf-chat-primary)] text-[var(--ngaf-chat-on-primary)] font-semibold' : 'bg-[var(--ngaf-chat-surface-alt)] text-[var(--ngaf-chat-text-muted)] hover:text-[var(--ngaf-chat-text)]'"
            (click)="selectSpec(i)">
            {{ spec.label }}
          </button>
        }
      </div>

      <!-- Left: Live Render Output -->
      <div primary>
        <div class="text-[10px] text-[var(--ngaf-chat-text-muted)] uppercase tracking-widest font-semibold mb-4">Live Render Output</div>
        @if (simulator.spec(); as renderedSpec) {
          <render-spec [spec]="renderedSpec" [registry]="registry" [store]="store" [loading]="simulator.playing()" />
        } @else {
          <div class="text-[var(--ngaf-chat-text-muted)] text-sm italic">Press play to start streaming...</div>
        }
      </div>

      <!-- Right: JSON + Controls -->
      <div secondary class="flex flex-col h-full">
        <!-- Streaming JSON (scrollable) -->
        <div class="flex-1 overflow-y-auto p-4" #jsonPane>
          <div class="text-[10px] text-[var(--ngaf-chat-text-muted)] uppercase tracking-widest font-semibold mb-4">Streaming JSON</div>
          <pre class="text-[11px] font-mono text-[var(--ngaf-chat-text-muted)] leading-relaxed whitespace-pre-wrap break-all">{{ simulator.rawJson() }}<span class="text-[var(--ngaf-chat-primary)] animate-pulse">|</span></pre>
          <div class="mt-3 flex justify-between text-[10px]">
            <span class="text-[var(--ngaf-chat-primary)]">{{ simulator.playing() ? 'Streaming...' : simulator.position() >= simulator.total() ? 'Complete' : 'Paused' }}</span>
            <span class="text-[var(--ngaf-chat-text-muted)]">{{ percent() }}%</span>
          </div>
        </div>
      </div>

      <!-- Timeline bar -->
      <streaming-timeline footer [simulator]="simulator" class="border-t border-[var(--ngaf-chat-separator)]" />
    </example-split-layout>
  `,
})
export class RegistryComponent implements OnDestroy {
  protected readonly specs = REGISTRY_SPECS;
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
