// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  template: `
    <div class="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-white">{{ city() }}</h3>
        <span class="text-2xl">{{ weatherEmoji() }}</span>
      </div>
      <div class="text-4xl font-bold text-white mb-1">{{ temperature() }}°F</div>
      <div class="text-sm text-white/60">{{ condition() }}</div>
    </div>
  `,
})
export class WeatherCardComponent {
  readonly city = input<string>('');
  readonly temperature = input<number>(0);
  readonly condition = input<string>('');

  weatherEmoji(): string {
    const c = this.condition().toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return '☀️';
    if (c.includes('cloud') || c.includes('overcast')) return '☁️';
    if (c.includes('rain')) return '🌧️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('storm') || c.includes('thunder')) return '⛈️';
    return '🌤️';
  }
}
