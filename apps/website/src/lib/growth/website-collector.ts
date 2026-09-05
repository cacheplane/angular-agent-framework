// Type-only use of the internal contract does not bundle server code.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { CollectionEventV1 } from '@threadplane-internal/growth';
import { getAcquisitionSession } from './acquisition-session';
import {
  acquisitionProperties,
  contentForPath,
  installedPackages,
  type WebsiteCatalog,
} from './website-metadata';

type Delivery = { status: number; retryAfterMs?: number };
interface Dependencies {
  enabled: boolean;
  catalog: WebsiteCatalog;
  session(): { id: string; scope: 'session' | 'memory' };
  now(): Date;
  uuid(): string;
  context(): { search: string; referrer: string };
  send(events: CollectionEventV1[]): Promise<Delivery>;
  schedule(callback: () => void, delay: number): void;
}
export function createWebsiteCollector(deps: Dependencies) {
  const queue: CollectionEventV1[] = [];
  let pending: { events: CollectionEventV1[]; attempts: number } | undefined;
  let sessionId = '',
    count = 0,
    busy = false,
    scheduled = false;
  let retryNotBefore = 0;
  const seen = new Set<string>();
  function schedule(delay = 0) {
    if (scheduled) return;
    scheduled = true;
    deps.schedule(() => {
      scheduled = false;
      void flush();
    }, delay);
  }
  function add(
    kind: string,
    properties: Record<string, string>,
    session: ReturnType<Dependencies['session']>
  ) {
    if (count >= 40 || queue.length + (pending?.events.length ?? 0) >= 40)
      return;
    queue.push({
      eventId: deps.uuid(),
      kind,
      occurredAt: deps.now().toISOString(),
      collectorVersion: 'website-v1',
      subject: {
        id: session.id,
        namespace: 'website_session',
        scope: session.scope,
      },
      properties,
    });
    count++;
    schedule();
  }
  function record(
    kind: string,
    properties: Record<string, string>,
    key: string
  ) {
    if (!deps.enabled) return;
    try {
      const session = deps.session();
      if (sessionId !== session.id) {
        sessionId = session.id;
        count = 0;
        seen.clear();
        const context = deps.context();
        add(
          'website.session_started',
          acquisitionProperties(context.search, context.referrer),
          session
        );
      }
      if (seen.has(key)) return;
      seen.add(key);
      add(kind, properties, session);
    } catch {
      /* Analytics must not interrupt the page or form. */
    }
  }
  async function flush() {
    if (!deps.enabled || busy) return;
    const remaining = retryNotBefore - deps.now().getTime();
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
    if (!pending && queue.length)
      pending = { events: queue.splice(0, 20), attempts: 0 };
    if (!pending) return;
    busy = true;
    const delivery = pending;
    delivery.attempts++;
    let result: Delivery;
    try {
      result = await deps.send(delivery.events);
    } catch {
      result = { status: 503 };
    }
    busy = false;
    const retryable = result.status === 429 || result.status >= 500;
    if (retryable && delivery.attempts < 3) {
      const delay = Math.max(
        1000,
        Math.min(60000, result.retryAfterMs ?? 1000 * delivery.attempts)
      );
      retryNotBefore = deps.now().getTime() + delay;
      schedule(delay);
    } else {
      retryNotBefore = 0;
      pending = undefined;
      if (queue.length) schedule();
    }
  }
  return {
    view(pathname: string) {
      const content = contentForPath(pathname, deps.catalog);
      if (content)
        record(
          'website.content_viewed',
          { ...content },
          `content:${content.contentId}`
        );
    },
    copied(command: string) {
      for (const packageName of installedPackages(command))
        record(
          'website.install_command_copied',
          { packageName },
          `copy:${packageName}`
        );
    },
    flush,
  };
}

export async function sendWebsiteBatch(
  events: CollectionEventV1[],
  fetcher: typeof fetch = fetch
): Promise<Delivery> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetcher('/api/growth/collect/v1/website', {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, events }),
      signal: controller.signal,
    });
    if (response.status === 200) {
      const ack = await response.json();
      if (
        ack?.schemaVersion !== 1 ||
        !Array.isArray(ack.events) ||
        ack.events.length !== events.length ||
        ack.events.some(
          (
            receipt: { eventId?: string; disposition?: string },
            index: number
          ) =>
            receipt?.eventId !== events[index].eventId ||
            !['accepted', 'duplicate', 'redacted'].includes(
              receipt?.disposition ?? ''
            )
        )
      )
        return { status: 503 };
    }
    const retry = Number(response.headers.get('retry-after'));
    return {
      status: response.status,
      ...(Number.isFinite(retry) && retry > 0
        ? { retryAfterMs: retry * 1000 }
        : {}),
    };
  } catch {
    return { status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

const browserCatalog: Record<string, WebsiteCatalog[string]> = {};
let browserCollector: ReturnType<typeof createWebsiteCollector> | undefined;
function collector() {
  return (browserCollector ??= createWebsiteCollector({
    enabled:
      process.env.NEXT_PUBLIC_GROWTH_WEBSITE_COLLECTION_ENABLED === 'true',
    catalog: browserCatalog,
    session: getAcquisitionSession,
    now: () => new Date(),
    uuid: () => crypto.randomUUID(),
    context: () => ({
      search: window.location.search,
      referrer: document.referrer,
    }),
    send: sendWebsiteBatch,
    schedule: (callback, delay) => {
      setTimeout(callback, delay);
    },
  }));
}
export function observeWebsitePath(pathname: string, catalog: WebsiteCatalog) {
  if (typeof window === 'undefined') return;
  Object.assign(browserCatalog, catalog);
  collector().view(pathname);
}
export function observeInstallCopy(command: string) {
  if (typeof window !== 'undefined') collector().copied(command);
}
