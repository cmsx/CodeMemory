import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class LockTimeoutError extends Error {
  constructor(lockPath: string, holderPid: number) {
    super(`lock ${lockPath} held by pid ${holderPid}, acquire timed out`);
    this.name = "LockTimeoutError";
  }
}

export interface LockOpts {
  timeoutMs?: number;
  pollMs?: number;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // ESRCH → no such process (dead); EPERM → process exists, no permission (alive)
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function acquire(lockPath: string, timeoutMs: number, pollMs: number): void {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let fd: number;
    try {
      fd = openSync(lockPath, "wx");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // Lock file exists — inspect holder
      let holderPid = NaN;
      try {
        holderPid = parseInt(readFileSync(lockPath, "utf8"), 10);
      } catch {
        // File vanished in a race — retry immediately
        continue;
      }
      const steal =
        !Number.isInteger(holderPid) ||
        holderPid === process.pid ||
        !isAlive(holderPid);
      if (steal) {
        try { unlinkSync(lockPath); } catch { /* already taken by someone else */ }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new LockTimeoutError(lockPath, holderPid);
      }
      sleepSync(pollMs);
      continue;
    }
    // Successfully created the lock file exclusively
    try {
      writeFileSync(fd, String(process.pid));
    } catch (e) {
      closeSync(fd);
      try { unlinkSync(lockPath); } catch { /* ignore */ }
      throw e;
    }
    closeSync(fd);
    return;
  }
}

export function withLock<T>(memoryDir: string, fn: () => T, opts: LockOpts = {}): T {
  mkdirSync(memoryDir, { recursive: true });
  const lockPath = join(memoryDir, "lock");
  acquire(lockPath, opts.timeoutMs ?? 5000, opts.pollMs ?? 50);
  try {
    return fn();
  } finally {
    try { unlinkSync(lockPath); } catch { /* already released or stolen */ }
  }
}
