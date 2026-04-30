// SPDX-License-Identifier: MIT
import { Component, input, ElementRef, viewChild } from '@angular/core';
import { StreamingSimulator } from './streaming-simulator';

@Component({
  selector: 'streaming-timeline',
  standalone: true,
  template: `
    <div class="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-3">
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-indigo-500 hover:bg-indigo-400 transition-colors"
        (click)="simulator().toggle()">
        @if (simulator().playing()) {
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="3" y="2" width="3" height="10" rx="1"/>
            <rect x="8" y="2" width="3" height="10" rx="1"/>
          </svg>
        } @else {
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <polygon points="4,2 12,7 4,12"/>
          </svg>
        }
      </button>

      <div
        #track
        class="flex-1 relative h-1.5 bg-gray-800 rounded-full cursor-pointer"
        (mousedown)="onTrackMouseDown($event)"
        (touchstart)="onTrackTouchStart($event)">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
          [style.width.%]="simulator().progress() * 100">
        </div>
        <div
          class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-indigo-500 shadow-lg shadow-indigo-500/30 -translate-x-1/2 transition-[left] duration-75"
          [style.left.%]="simulator().progress() * 100">
        </div>
      </div>

      <div class="text-xs text-gray-400 tabular-nums shrink-0 min-w-[100px] text-right">
        <span class="text-gray-200 font-semibold">{{ simulator().position() }}</span>
        / {{ simulator().total() }} chars
      </div>

      <div class="flex gap-1 shrink-0">
        @for (s of speeds; track s) {
          <button
            class="text-[10px] px-2.5 py-1 rounded transition-colors"
            [class]="simulator().speed() === s ? 'text-indigo-400 bg-indigo-950 font-semibold' : 'text-gray-400 bg-gray-800 hover:text-gray-300'"
            (click)="simulator().setSpeed(s)">
            {{ s }}x
          </button>
        }
      </div>
    </div>
  `,
})
export class StreamingTimelineComponent {
  readonly simulator = input.required<StreamingSimulator>();
  readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected readonly speeds = [1, 2, 4];

  protected onTrackMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.seekFromEvent(event);

    const onMove = (e: MouseEvent) => this.seekFromEvent(e);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  protected onTrackTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.seekFromTouch(event);

    const onMove = (e: TouchEvent) => this.seekFromTouch(e);
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  private seekFromEvent(event: MouseEvent): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.simulator().seek(Math.round(fraction * this.simulator().total()));
  }

  private seekFromTouch(event: TouchEvent): void {
    const el = this.track()?.nativeElement;
    if (!el || !event.touches[0]) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.touches[0].clientX - rect.left) / rect.width));
    this.simulator().seek(Math.round(fraction * this.simulator().total()));
  }
}
