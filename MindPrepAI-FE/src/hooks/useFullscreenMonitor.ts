import { useCallback, useEffect, useRef, useState } from "react";
import { FullscreenTracker } from "../utils/fullscreenTracker";

/**
 * Fullscreen enforcement for a proctored interview — the sibling of
 * useTabSwitchMonitor, wired into the interview room the same way.
 *
 * - `enter()` requests fullscreen (needs a user gesture) and reports whether it worked;
 *   when the browser blocks it the UI shows an explicit "Enter Full Screen" button.
 * - While `active` (the interview is live), each fullscreen -> windowed transition is
 *   a violation: the first `maxExits - 1` call `onWarning(count)`, the last calls
 *   `onTerminate(count)` once.
 * - Independent of question generation: it is keyed only on the interview *session*
 *   id, so a slow or failed question pipeline can't affect it.
 * - `expectExit()` must be called before the app deliberately leaves fullscreen
 *   (finish / terminate / navigate away) so that exit is not counted.
 * - The count persists in sessionStorage and can be raised from the server's count
 *   (`syncCount`), so a page refresh cannot reset it.
 */

export interface UseFullscreenMonitorOptions {
  /** Interview session id. Counting (and persistence) is scoped to it; null = before the session exists. */
  sessionKey: string | null | undefined;
  /** True while the interview is in progress and violations should count. */
  active: boolean;
  maxExits?: number;
  onWarning: (count: number) => void;
  onTerminate: (count: number) => void;
  /** Exit count the server already holds for this session (e.g. when resuming after a refresh). */
  serverCount?: number;
}

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const isFullscreenNow = () => {
  const d = document as FsDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
};

export const fullscreenSupported = () =>
  typeof document !== "undefined" &&
  !!(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);

export function useFullscreenMonitor({
  sessionKey,
  active,
  maxExits = 3,
  onWarning,
  onTerminate,
  serverCount = 0,
}: UseFullscreenMonitorOptions) {
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenNow());
  const [exitCount, setExitCount] = useState(0);

  const trackerRef = useRef<FullscreenTracker | null>(null);
  const onWarningRef = useRef(onWarning);
  const onTerminateRef = useRef(onTerminate);
  onWarningRef.current = onWarning;
  onTerminateRef.current = onTerminate;
  const serverCountRef = useRef(serverCount);
  serverCountRef.current = serverCount;

  // One tracker for the lifetime of the hook; it reads everything through fields/refs.
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    const tracker = new FullscreenTracker({
      isFullscreen: isFullscreenNow,
      subscribe: (handler) => {
        document.addEventListener("fullscreenchange", handler);
        document.addEventListener("webkitfullscreenchange", handler);
        return () => {
          document.removeEventListener("fullscreenchange", handler);
          document.removeEventListener("webkitfullscreenchange", handler);
        };
      },
      maxExits,
      storage,
      onChange: setIsFullscreen,
      onWarning: (count) => {
        setExitCount(count);
        onWarningRef.current(count);
      },
      onTerminate: (count) => {
        setExitCount(count);
        onTerminateRef.current(count);
      },
    });
    trackerRef.current = tracker;
    return () => {
      tracker.dispose();
      trackerRef.current = null;
    };
    // maxExits is a constant for the feature; intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind to the current interview session (restores a persisted count after a refresh).
  useEffect(() => {
    const t = trackerRef.current;
    if (!t) return;
    t.setSession(sessionKey ?? null, serverCountRef.current);
    setExitCount(t.exitCount);
  }, [sessionKey]);

  useEffect(() => {
    trackerRef.current?.setActive(active);
  }, [active]);

  const enter = useCallback(async (): Promise<boolean> => {
    if (isFullscreenNow()) return true;
    const el = document.documentElement as FsElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else return false;
    } catch {
      return false; // blocked (no user gesture, iframe policy, unsupported)
    }
    return isFullscreenNow();
  }, []);

  /** Leaves fullscreen on purpose; never counted as a violation. */
  const exit = useCallback(async () => {
    trackerRef.current?.expectExit();
    if (!isFullscreenNow()) return;
    const d = document as FsDocument;
    try {
      if (d.exitFullscreen) await d.exitFullscreen();
      else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
    } catch {
      /* already left */
    }
  }, []);

  const expectExit = useCallback(() => trackerRef.current?.expectExit(), []);

  const syncCount = useCallback((serverCount: number) => {
    const t = trackerRef.current;
    if (!t) return;
    t.syncCount(serverCount);
    setExitCount(t.exitCount);
  }, []);

  const clearSession = useCallback((key?: string | null) => trackerRef.current?.clearSession(key ?? undefined), []);

  return { isFullscreen, exitCount, maxExits, enter, exit, expectExit, syncCount, clearSession };
}
