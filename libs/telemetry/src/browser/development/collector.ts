import { DevelopmentSession } from './session';
import { DevelopmentAnnouncements } from './announcements';
import {
  MAX_AGE,
  type DevelopmentMilestone,
  type RuntimeEvent,
  type RuntimeOwner,
} from './types';

const ENDPOINT = 'https://threadplane.ai/api/growth/collect/v1/runtime';
const MIN_INTERVAL = 10000;
const ACTIVE_INTERVAL = 300000;
interface Pending {
  event: RuntimeEvent;
  owner: RuntimeOwner;
  attempts: number;
  nextAt: number;
  acknowledged?: boolean;
}

/** Owns only bounded page-local work. Public wrappers perform framework/browser gating. */
export class DevelopmentCollector {
  private readonly session = new DevelopmentSession();
  private readonly announcements = new DevelopmentAnnouncements();
  private pending: Pending[] = [];
  private readonly latest = new Map<string, RuntimeEvent>();
  private readonly initialized = new Map<string, Pending>();
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight?: { controller: AbortController; batch: Pending[] };
  private lastRequest = -Infinity;
  private nextAllowed = 0;
  private generation = 0;
  private readonly counts = { discarded: 0, failures: 0, acknowledged: 0 };

  diagnostics() {
    return { ...this.counts, pending: this.pending.length };
  }
  clear(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.inFlight?.controller.abort();
    this.inFlight = undefined;
    this.pending = [];
    this.latest.clear();
    this.initialized.clear();
  }
  prune(): void {
    this.pending = this.pending.filter((p) => {
      if (!p.owner.allowed()) return false;
      if (
        Date.now() - Date.parse(p.event.occurredAt) >= MAX_AGE ||
        (p.attempts >= 3 && !this.inFlight?.batch.includes(p))
      ) {
        this.counts.discarded++;
        return false;
      }
      return true;
    });
    for (const [key, event] of this.latest)
      if (Date.now() - Date.parse(event.occurredAt) >= MAX_AGE)
        this.latest.delete(key);
    if (this.inFlight?.batch.every((p) => !p.owner.allowed()))
      this.inFlight.controller.abort();
  }
  touch(
    owner: RuntimeOwner,
    kind?: DevelopmentMilestone,
    durationMs?: number
  ): void {
    if (!owner.allowed()) {
      this.prune();
      return;
    }
    const now = Date.now();
    const identity = this.session.touch(now);
    const initialization = this.session.initialization(
      owner.options,
      identity,
      now
    );
    const enqueue = (eventKind: RuntimeEvent['kind']) => {
      if (!this.session.claim(`${owner.options.integration}:${eventKind}`))
        return;
      const properties: Record<string, string> = {
        integration: owner.options.integration,
        packageName: owner.options.packageName,
        packageVersion: owner.options.packageVersion,
      };
      if (
        eventKind === 'runtime.first_stream_completed' &&
        durationMs !== undefined &&
        Number.isFinite(durationMs) &&
        durationMs >= 0
      ) {
        properties['durationBucket'] =
          durationMs < 1000
            ? 'lt_1s'
            : durationMs < 5000
            ? '1s_to_5s'
            : durationMs < 30000
            ? '5s_to_30s'
            : '30s_plus';
      }
      this.pending.push({
        owner,
        attempts: 0,
        nextAt: now,
        event: {
          eventId: window.crypto.randomUUID(),
          kind: eventKind,
          occurredAt: new Date(now).toISOString(),
          collectorVersion: '1',
          ...(owner.options.installationToken
            ? { installationToken: owner.options.installationToken }
            : {}),
          ...identity,
          properties,
        },
      });
    };
    this.prune();
    let initial = this.initialized.get(owner.options.integration);
    if (!initial || initial.event.eventId !== initialization.eventId) {
      initial = { event: initialization, owner, attempts: 0, nextAt: now };
      this.initialized.set(owner.options.integration, initial);
    }
    initial.owner = owner;
    if (
      !initial.acknowledged &&
      initial.attempts < 3 &&
      !this.pending.includes(initial)
    )
      this.pending.push(initial);
    if (kind) enqueue(kind);
    const latest = this.latest.get(owner.options.integration);
    if (
      !this.pending.length &&
      latest &&
      latest.sessionId === identity.sessionId &&
      latest.properties['packageVersion'] === owner.options.packageVersion &&
      latest.installationToken === owner.options.installationToken &&
      now - this.lastRequest >= ACTIVE_INTERVAL
    ) {
      // Replay a committed event solely as the nonempty exchange envelope. No new activity is invented.
      this.pending.push({ event: latest, owner, attempts: 0, nextAt: now });
    }
    if (this.pending.length > 50) {
      this.counts.discarded += this.pending.length - 50;
      this.pending.splice(0, this.pending.length - 50);
    }
    this.schedule();
  }
  private schedule(): void {
    if (this.timer !== undefined || this.inFlight || !this.pending.length)
      return;
    const at = Math.max(
      this.lastRequest + MIN_INTERVAL,
      this.nextAllowed,
      Math.min(...this.pending.map((p) => p.nextAt))
    );
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.send();
    }, Math.min(2147483647, Math.max(0, at - Date.now())));
  }
  private async send(): Promise<void> {
    this.prune();
    const batch = this.pending
      .filter((p) => p.nextAt <= Date.now())
      .slice(0, 20);
    if (!batch.length) {
      this.schedule();
      return;
    }
    const generation = this.generation;
    const controller = new AbortController();
    this.inFlight = { controller, batch };
    this.lastRequest = Date.now();
    for (const pending of batch) pending.attempts++;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.exchange(batch, controller),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('timeout'));
          }, 3000);
        }),
      ]);
      if (generation !== this.generation || controller.signal.aborted) return;
      const allowed = batch.filter((p) => p.owner.allowed());
      const ids = new Set(allowed.map((p) => p.event.eventId));
      if (
        !result ||
        result.schemaVersion !== 1 ||
        !Array.isArray(result.events) ||
        result.events.length > batch.length
      )
        throw new Error('invalid_ack');
      const acknowledged = new Set<string>();
      for (const ack of result.events) {
        if (
          !ack ||
          typeof ack.eventId !== 'string' ||
          !batch.some((p) => p.event.eventId === ack.eventId) ||
          acknowledged.has(ack.eventId) ||
          !['accepted', 'duplicate', 'redacted'].includes(ack.disposition)
        )
          throw new Error('invalid_ack');
        acknowledged.add(ack.eventId);
      }
      for (const pending of allowed) {
        if (!acknowledged.has(pending.event.eventId)) continue;
        pending.acknowledged = true;
        this.counts.acknowledged++;
        if (
          result.events.find((a) => a.eventId === pending.event.eventId)
            ?.disposition !== 'redacted'
        )
          this.latest.set(
            pending.event.properties['integration'],
            pending.event
          );
      }
      this.pending = this.pending.filter(
        (p) => !(ids.has(p.event.eventId) && acknowledged.has(p.event.eventId))
      );
      // Display is deliberately independent of durable acknowledgment processing.
      if (allowed.length)
        this.announcements.display(
          result.announcements,
          allowed.map((p) => p.event)
        );
    } catch {
      if (generation === this.generation) this.counts.failures++;
    } finally {
      clearTimeout(timeout);
      controller.abort();
      if (generation === this.generation) {
        for (const pending of batch)
          pending.nextAt = Math.max(
            this.nextAllowed,
            this.lastRequest + MIN_INTERVAL * 2 ** (pending.attempts - 1)
          );
        this.inFlight = undefined;
        this.prune();
        this.schedule();
      }
    }
  }
  private async exchange(
    batch: Pending[],
    controller: AbortController
  ): Promise<{
    schemaVersion?: unknown;
    events?: { eventId: string; disposition: string }[];
    announcements?: unknown;
  }> {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        events: batch.map((p) => p.event),
      }),
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error('cancelled');
    }
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        const raw = response.headers.get('Retry-After');
        const until =
          raw && /^\d+$/u.test(raw)
            ? Date.now() + Number(raw) * 1000
            : Date.parse(raw ?? '');
        if (Number.isFinite(until))
          this.nextAllowed = Math.max(this.nextAllowed, until);
      } else {
        for (const pending of batch) pending.attempts = 3;
      }
      void response.body?.cancel().catch(() => undefined);
      throw new Error('response');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('empty_response');
    const abort = () => {
      void reader.cancel().catch(() => undefined);
    };
    controller.signal.addEventListener('abort', abort, { once: true });
    try {
      let bytes = 0;
      let content = '';
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 32768) throw new Error('response_limit');
        content += decoder.decode(part.value, { stream: true });
      }
      return JSON.parse(content + decoder.decode());
    } finally {
      controller.signal.removeEventListener('abort', abort);
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
