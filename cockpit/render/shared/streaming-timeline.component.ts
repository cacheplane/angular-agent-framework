// SPDX-License-Identifier: MIT
import { Component, input, ElementRef, viewChild } from '@angular/core';
import { StreamingSimulator } from './streaming-simulator';

@Component({
  selector: 'streaming-timeline',
  standalone: true,
  styles: `
    :host {
      --tl-green: var(--ds-render-green, #1a7a40);
      --tl-green-bright: #35b06a;
      display: block;
    }
    .tl {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--ds-surface, #1c1c1c);
      border-top: 1px solid var(--ds-border, #2d2d2d);
    }
    .tl__play {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 0;
      flex-shrink: 0;
      color: #eafff2;
      background: var(--tl-green);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(26, 122, 64, 0.5);
      transition: transform 0.1s ease, box-shadow 0.15s ease;
    }
    .tl__play:hover { box-shadow: 0 3px 16px rgba(53, 176, 106, 0.6); }
    .tl__play:active { transform: scale(0.94); }
    .tl__track {
      flex: 1;
      position: relative;
      height: 6px;
      border-radius: 999px;
      background: var(--ds-surface-tinted, #2c2c2c);
      cursor: pointer;
    }
    .tl__fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--tl-green), var(--tl-green-bright));
    }
    .tl__handle {
      position: absolute;
      top: 50%;
      width: 15px;
      height: 15px;
      border-radius: 999px;
      background: #fff;
      border: 2px solid var(--tl-green-bright);
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      transition: left 0.075s linear;
    }
    .tl__count {
      flex-shrink: 0;
      min-width: 100px;
      text-align: right;
      font-family: var(--ds-font-mono, ui-monospace, monospace);
      font-size: 11px;
      color: var(--ds-text-muted, #a0a0a0);
      font-variant-numeric: tabular-nums;
    }
    .tl__count b { color: var(--ds-text-primary, #f5f5f5); font-weight: 600; }
    .tl__speeds { display: flex; gap: 4px; flex-shrink: 0; }
    .tl__speed {
      font-size: 10.5px;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid var(--ds-border, #2d2d2d);
      background: var(--ds-surface-dim, #0a0a0a);
      color: var(--ds-text-muted, #a0a0a0);
      cursor: pointer;
      transition: color 0.12s ease, background 0.12s ease, border-color 0.12s ease;
    }
    .tl__speed:hover { color: var(--ds-text-secondary, #c8c8c8); }
    .tl__speed--on {
      color: var(--tl-green-bright);
      border-color: rgba(53, 176, 106, 0.35);
      background: rgba(53, 176, 106, 0.12);
      font-weight: 600;
    }
  `,
  template: `
    <div class="tl">
      <button class="tl__play" type="button" aria-label="Play or pause" (click)="simulator().toggle()">
        @if (simulator().playing()) {
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="3" height="10" rx="1" />
            <rect x="8" y="2" width="3" height="10" rx="1" />
          </svg>
        } @else {
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <polygon points="4,2 12,7 4,12" />
          </svg>
        }
      </button>

      <div
        #track
        class="tl__track"
        (mousedown)="onTrackMouseDown($event)"
        (touchstart)="onTrackTouchStart($event)">
        <div class="tl__fill" [style.width.%]="simulator().progress() * 100"></div>
        <div class="tl__handle" [style.left.%]="simulator().progress() * 100"></div>
      </div>

      <div class="tl__count"><b>{{ simulator().position() }}</b> / {{ simulator().total() }} chars</div>

      <div class="tl__speeds">
        @for (s of speeds; track s) {
          <button
            type="button"
            class="tl__speed"
            [class.tl__speed--on]="simulator().speed() === s"
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
