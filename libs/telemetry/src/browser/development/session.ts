import {
  MAX_AGE,
  MILESTONES,
  SESSION_IDLE,
  UUID,
  type DevelopmentRuntimeOptions,
  type RuntimeEvent,
} from './types';

const IDENTITY_KEY = 'threadplane.growth.browser.v1';
const SESSION_KEY = 'threadplane.growth.session.v1';
interface Start {
  installationToken?: string;
  eventId: string;
  occurredAt: string;
  packageVersion: string;
}
interface Session {
  id: string;
  subjectId: string;
  lastActive: number;
  seen: string[];
  starts: Record<string, Start>;
}
const validKeys = new Set(
  ['langgraph', 'ag-ui', 'render'].flatMap((integration) =>
    ['runtime.session_started', ...MILESTONES].map(
      (kind) => `${integration}:${kind}`
    )
  )
);

/** Browser storage is best-effort; no collector state represents a person or repository. */
export class DevelopmentSession {
  private subject?: RuntimeEvent['subject'];
  private session?: Session;
  private memoryOnly = false;

  private read(key: string): string | null {
    if (this.memoryOnly) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      this.memoryOnly = true;
      return null;
    }
  }
  private write(key: string, value: string): boolean {
    if (this.memoryOnly) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      this.memoryOnly = true;
      return false;
    }
  }
  touch(now: number): { subject: RuntimeEvent['subject']; sessionId: string } {
    if (!this.subject) {
      const saved = this.read(IDENTITY_KEY);
      const id = saved && UUID.test(saved) ? saved : window.crypto.randomUUID();
      const persistent = saved === id || this.write(IDENTITY_KEY, id);
      this.subject = {
        id,
        namespace: 'development_browser',
        scope: persistent ? 'persistent' : 'memory',
      };
    }
    const raw = this.read(SESSION_KEY);
    if (raw && raw.length <= 4096) {
      try {
        const candidate = JSON.parse(raw) as Session;
        if (
          UUID.test(candidate.id) &&
          candidate.subjectId === this.subject.id &&
          Number.isFinite(candidate.lastActive) &&
          candidate.lastActive <= now &&
          now - candidate.lastActive < SESSION_IDLE &&
          Array.isArray(candidate.seen) &&
          candidate.seen.length <= validKeys.size &&
          candidate.seen.every((key) => validKeys.has(key))
        ) {
          const starts: Record<string, Start> = {};
          for (const integration of ['langgraph', 'ag-ui', 'render']) {
            const start = candidate.starts?.[integration];
            if (
              start &&
              UUID.test(start.eventId) &&
              typeof start.occurredAt === 'string' &&
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
                start.occurredAt
              ) &&
              Date.parse(start.occurredAt) <= now &&
              now - Date.parse(start.occurredAt) < MAX_AGE &&
              typeof start.packageVersion === 'string' &&
              start.packageVersion.length <= 64 &&
              /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(
                start.packageVersion
              ) &&
              (start.installationToken === undefined ||
                (typeof start.installationToken === 'string' &&
                  UUID.test(start.installationToken)))
            )
              starts[integration] = {
                eventId: start.eventId,
                occurredAt: start.occurredAt,
                packageVersion: start.packageVersion,
                ...(start.installationToken
                  ? { installationToken: start.installationToken }
                  : {}),
              };
          }
          this.session = {
            id: candidate.id,
            subjectId: candidate.subjectId,
            lastActive: candidate.lastActive,
            seen: [...new Set(candidate.seen)],
            starts,
          };
        }
      } catch {
        /* Invalid local state starts a fresh session if necessary. */
      }
    }
    if (
      !this.session ||
      now - this.session.lastActive >= SESSION_IDLE ||
      now < this.session.lastActive
    ) {
      this.session = {
        id: window.crypto.randomUUID(),
        subjectId: this.subject.id,
        lastActive: now,
        seen: [],
        starts: {},
      };
    }
    this.session.lastActive = now;
    this.write(SESSION_KEY, JSON.stringify(this.session));
    return { subject: { ...this.subject }, sessionId: this.session.id };
  }
  initialization(
    options: DevelopmentRuntimeOptions,
    identity: { subject: RuntimeEvent['subject']; sessionId: string },
    now: number
  ): RuntimeEvent {
    const session = this.session;
    if (!session) throw new Error('uninitialized_session');
    let start = session.starts[options.integration];
    if (
      !start ||
      start.packageVersion !== options.packageVersion ||
      start.installationToken !== options.installationToken ||
      now - Date.parse(start.occurredAt) >= MAX_AGE
    ) {
      start = {
        eventId: window.crypto.randomUUID(),
        occurredAt: new Date(now).toISOString(),
        packageVersion: options.packageVersion,
        ...(options.installationToken
          ? { installationToken: options.installationToken }
          : {}),
      };
      session.starts[options.integration] = start;
      this.write(SESSION_KEY, JSON.stringify(session));
    }
    return {
      eventId: start.eventId,
      occurredAt: start.occurredAt,
      kind: 'runtime.session_started',
      collectorVersion: '1',
      ...(start.installationToken
        ? { installationToken: start.installationToken }
        : {}),
      ...identity,
      properties: {
        integration: options.integration,
        packageName: options.packageName,
        packageVersion: start.packageVersion,
      },
    };
  }
  claim(key: string): boolean {
    if (!this.session || this.session.seen.includes(key) || !validKeys.has(key))
      return false;
    this.session.seen.push(key);
    this.write(SESSION_KEY, JSON.stringify(this.session));
    return true;
  }
}
