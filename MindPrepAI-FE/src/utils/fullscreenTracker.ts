/**
 * Framework-free fullscreen-violation state machine used by useFullscreenMonitor.
 *
 * Kept separate from React so its rules can be tested exactly:
 *  - only a fullscreen -> windowed transition can be a violation (never entering);
 *  - it counts only while `active` (a live interview) and before termination;
 *  - deliberate exits by the app (interview finished / terminated / navigating away)
 *    are announced with `expectExit()` and are never counted;
 *  - the running count survives a refresh (sessionStorage, plus the server's count
 *    passed to `syncCount`) so reloading the page cannot reset it;
 *  - `onTerminate` fires exactly once, on the `maxExits`-th exit.
 *
 * All the fast-changing inputs are read through fields, never captured in
 * closures, so React re-renders cannot produce stale counts.
 */

export interface TrackerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FullscreenTrackerOptions {
  /** Is the document in fullscreen right now? (document.fullscreenElement) */
  isFullscreen: () => boolean;
  /** Subscribe to fullscreen changes; returns an unsubscribe function. */
  subscribe: (handler: () => void) => () => void;
  maxExits?: number;
  storage?: TrackerStorage | null;
  onWarning: (count: number) => void;
  onTerminate: (count: number) => void;
  /** Called on every transition with the new state (used to drive UI). */
  onChange?: (isFullscreen: boolean) => void;
  now?: () => number;
}

const STORAGE_PREFIX = "mindprep:fullscreenExitCount:";
/** Window after expectExit() in which an exit is treated as deliberate. */
const EXPECTED_EXIT_WINDOW_MS = 2000;

export class FullscreenTracker {
  private count = 0;
  private active = false;
  private terminated = false;
  private wasFullscreen: boolean;
  private expectedExitUntil = 0;
  private sessionKey: string | null = null;
  private readonly max: number;
  private readonly now: () => number;
  private readonly unsubscribe: () => void;
  private readonly opts: FullscreenTrackerOptions;

  constructor(opts: FullscreenTrackerOptions) {
    this.opts = opts;
    this.max = opts.maxExits ?? 3;
    this.now = opts.now ?? Date.now;
    this.wasFullscreen = opts.isFullscreen();
    this.unsubscribe = opts.subscribe(this.handleChange);
  }

  get exitCount() {
    return this.count;
  }
  get isTerminated() {
    return this.terminated;
  }

  /**
   * Binds the tracker to one interview session. Restores a persisted count, so a
   * refresh resumes at the same strike count; a new session id starts from zero.
   * `serverCount` (from the interview state endpoint) can only raise the count.
   */
  setSession(key: string | null, serverCount = 0) {
    this.sessionKey = key;
    this.terminated = false;
    let stored = 0;
    if (key && this.opts.storage) {
      try {
        stored = Number(this.opts.storage.getItem(STORAGE_PREFIX + key) || 0) || 0;
      } catch {
        stored = 0;
      }
    }
    this.count = key ? Math.max(stored, serverCount) : 0;
    if (key) this.persist();
    if (this.count >= this.max) this.terminated = true;
  }

  /** Raises the count to a value the server already holds (never lowers it). */
  syncCount(serverCount: number) {
    if (serverCount > this.count) {
      this.count = serverCount;
      this.persist();
      if (this.count >= this.max) this.terminated = true;
    }
  }

  /** True while an interview is live and violations should be counted. */
  setActive(active: boolean) {
    this.active = active;
  }

  /** Call right before the app itself leaves fullscreen (finish / terminate / navigate). */
  expectExit() {
    this.expectedExitUntil = this.now() + EXPECTED_EXIT_WINDOW_MS;
  }

  /** Forget the persisted count once a session has genuinely ended. */
  clearSession(key: string | null = this.sessionKey) {
    if (!key || !this.opts.storage) return;
    try {
      this.opts.storage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* storage unavailable */
    }
  }

  dispose() {
    this.unsubscribe();
  }

  private persist() {
    if (!this.sessionKey || !this.opts.storage) return;
    try {
      this.opts.storage.setItem(STORAGE_PREFIX + this.sessionKey, String(this.count));
    } catch {
      /* storage unavailable — the in-memory count still works for this page load */
    }
  }

  private handleChange = () => {
    const isFs = this.opts.isFullscreen();
    const was = this.wasFullscreen;
    this.wasFullscreen = isFs;
    this.opts.onChange?.(isFs);

    // Only leaving fullscreen can be a violation. Entering (initial entry, or
    // re-entering after a warning) is never counted.
    if (!(was && !isFs)) return;
    if (this.now() < this.expectedExitUntil) return; // the app exited on purpose
    if (!this.active || this.terminated) return;

    this.count += 1;
    this.persist();
    if (this.count >= this.max) {
      this.terminated = true;
      this.opts.onTerminate(this.count);
    } else {
      this.opts.onWarning(this.count);
    }
  };
}
