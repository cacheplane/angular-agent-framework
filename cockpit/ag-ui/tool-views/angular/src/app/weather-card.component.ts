// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A frontend-owned view rendered for the `weather_card` tool call. Receives
 * the tool call's arguments while it streams (`location`), the merged result
 * on completion (`temperatureF`, `conditions`, `humidity`, `windMph`), and a
 * `status` of 'running' | 'complete'. Renders a loading affordance until the
 * result arrives.
 */
@Component({
  selector: 'app-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wc">
      <div class="wc__head">
        <span class="wc__loc">{{ location() ?? 'Weather' }}</span>
        @if (pending()) { <span class="wc__badge">Loading…</span> }
      </div>
      @if (!pending()) {
        <div class="wc__temp">{{ temperatureF() }}°F</div>
        <div class="wc__cond">{{ conditions() }}</div>
        <dl class="wc__meta">
          <div><dt>Humidity</dt><dd>{{ humidity() }}%</dd></div>
          <div><dt>Wind</dt><dd>{{ windMph() }} mph</dd></div>
        </dl>
      }
    </div>
  `,
  styles: [`
    .wc { border: 1px solid var(--tplane-chat-separator, #e5e7eb); border-radius: 12px; padding: 16px; max-width: 320px; }
    .wc__head { display: flex; align-items: center; justify-content: space-between; }
    .wc__loc { font-weight: 600; }
    .wc__badge { font-size: 12px; opacity: 0.7; }
    .wc__temp { font-size: 32px; font-weight: 700; margin-top: 8px; }
    .wc__cond { opacity: 0.8; }
    .wc__meta { display: flex; gap: 24px; margin: 12px 0 0; }
    .wc__meta dt { font-size: 11px; text-transform: uppercase; opacity: 0.6; }
    .wc__meta dd { margin: 0; font-weight: 600; }
  `],
})
export class WeatherCardComponent {
  readonly location = input<string>();
  readonly temperatureF = input<number>();
  readonly conditions = input<string>();
  readonly humidity = input<number>();
  readonly windMph = input<number>();
  readonly status = input<'running' | 'complete'>();

  readonly pending = computed(() => this.status() !== 'complete' || this.temperatureF() === undefined);
}
