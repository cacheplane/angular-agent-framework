// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import type { ChildProcess } from 'node:child_process';

/**
 * Best-effort: kill whatever process is bound to `port`.
 *
 * `nx serve` and `langgraph dev` spawn *child* processes that hold the actual
 * sockets, so SIGTERM-ing the parent (or a run dying mid-flight before
 * teardown) routinely leaves an orphan listening on the port. The next run's
 * `waitForPort` then binds to the **stale** server and silently tests the old
 * bundle. Freeing the port in global-setup makes each run self-healing.
 *
 * Uses `lsof` (present on macOS and the Linux CI runners). No-ops if `lsof`
 * is unavailable or the port is already free.
 */
export function freePort(port: number): void {
  let pids: string[] = [];
  try {
    pids = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return; // lsof missing, or nothing listening — nothing to free
  }
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

/**
 * Kill a spawned server and its descendants.
 *
 * Children are reaped only when the process was spawned `detached: true` (so it
 * leads its own group) — then a negative-PID signal hits the whole group.
 * Falls back to signalling the parent alone. SIGTERM first for a clean stop,
 * SIGKILL shortly after as a backstop.
 */
export async function killTree(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.pid === undefined || child.exitCode !== null) return;
  const pid = child.pid;
  signalGroupOrSelf(pid, 'SIGTERM');
  await delay(1500);
  signalGroupOrSelf(pid, 'SIGKILL');
}

function signalGroupOrSelf(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal); // negative pid → process group (detached spawns)
  } catch {
    try {
      process.kill(pid, signal); // not a group leader — signal the parent alone
    } catch {
      // already gone
    }
  }
}
