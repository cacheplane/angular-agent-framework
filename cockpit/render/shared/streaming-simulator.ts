// SPDX-License-Identifier: MIT
import { signal, computed } from '@angular/core';
import { createPartialJsonParser, materialize } from '@ngaf/partial-json';
import type { PartialJsonParser, ParseEvent } from '@ngaf/partial-json';
import type { Spec } from '@json-render/core';

export class StreamingSimulator {
  private source: string;
  private parser: PartialJsonParser;
  private animFrameId: number | null = null;

  readonly position = signal(0);
  readonly total = signal(0);
  readonly playing = signal(false);
  readonly speed = signal(1);
  readonly spec = signal<Spec | null>(null);
  readonly rawJson = signal('');
  readonly events = signal<ParseEvent[]>([]);

  readonly progress = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : this.position() / t;
  });

  constructor(source: string) {
    this.source = source;
    this.parser = createPartialJsonParser();
    this.total.set(source.length);
  }

  play(): void {
    if (this.playing()) return;
    this.playing.set(true);
    this.tick();
  }

  pause(): void {
    this.playing.set(false);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  toggle(): void {
    if (this.playing()) {
      this.pause();
    } else {
      if (this.position() >= this.total()) {
        this.seek(0);
      }
      this.play();
    }
  }

  seek(pos: number): void {
    const clamped = Math.max(0, Math.min(pos, this.source.length));
    this.parser = createPartialJsonParser();
    const chunk = this.source.slice(0, clamped);
    const allEvents = chunk.length > 0 ? this.parser.push(chunk) : [];
    this.position.set(clamped);
    this.rawJson.set(chunk);
    this.events.set(allEvents);
    this.spec.set(
      this.parser.root ? (materialize(this.parser.root) as Spec | null) : null
    );
  }

  setSpeed(multiplier: number): void {
    this.speed.set(Math.max(1, Math.round(multiplier)));
  }

  setSource(json: string): void {
    this.pause();
    this.source = json;
    this.parser = createPartialJsonParser();
    this.total.set(json.length);
    this.position.set(0);
    this.rawJson.set('');
    this.spec.set(null);
    this.events.set([]);
  }

  destroy(): void {
    this.pause();
  }

  private tick(): void {
    if (!this.playing()) return;
    const currentPos = this.position();
    const spd = this.speed();
    const nextPos = Math.min(currentPos + spd, this.source.length);

    if (nextPos > currentPos) {
      const chunk = this.source.slice(currentPos, nextPos);
      const newEvents = this.parser.push(chunk);
      this.position.set(nextPos);
      this.rawJson.set(this.source.slice(0, nextPos));
      this.events.set([...this.events(), ...newEvents]);
      this.spec.set(
        this.parser.root ? (materialize(this.parser.root) as Spec | null) : null
      );
    }

    if (nextPos >= this.source.length) {
      this.pause();
      return;
    }

    this.animFrameId = requestAnimationFrame(() => this.tick());
  }
}
