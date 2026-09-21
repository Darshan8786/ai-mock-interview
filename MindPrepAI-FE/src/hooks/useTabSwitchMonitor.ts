import { useEffect, useRef, useState } from "react";

/**
 * Shared tab-switch / visibility monitor for any timed, proctored session
 * (mock interview, aptitude test/attempt). Counts a violation exactly once
 * per visible -> hidden transition of `document.visibilityState`, independent
 * of React re-renders, component remounts, or in-app modal/state changes -
 * it only ever reacts to the browser's own `visibilitychange` event.
 *
 * The `visibilitychange` listener is registered ONCE per session (keyed by
 * `sessionKey`) and reads all fast-changing values (whether monitoring is
 * currently active, the callbacks) through refs, so it never sees stale
 * closures and is never re-registered on every render.
 */

export interface UseTabSwitchMonitorOptions {
  /**
   * Unique id for the current session (interview id / aptitude attempt id).
   * Monitoring is fully disabled while this is null/undefined - e.g. before
   * an interview has been created, or on the setup screen. Persistence and
   * the running count are also scoped to this key, so switching to a new
   * session (a different id) starts a fresh count and a stale count from a
   * previous, already-finished session can never leak in.
   */
  sessionKey: string | null | undefined;
  /** True while the test/interview is actually in progress and answerable. */
  active: boolean;
  /** Number of violations allowed before termination (default 3). */
  maxWarnings?: number;
  /** Called with the new count for every violation BEFORE the final one. */
  onWarning: (count: number) => void;
  /** Called exactly once, with the final count, when the limit is reached. */
  onTerminate: (count: number) => void;
}

const STORAGE_PREFIX = "mindprep:tabSwitchCount:";

/**
 * Clears the persisted count for a session key once that session has
 * genuinely ended (submitted/completed). Needed for session keys that are
 * NOT guaranteed unique per attempt - e.g. a configured test's shared
 * `testId`, reused across every attempt of that same test - so a finished
 * attempt's violation count can never leak into a later, unrelated attempt
 * in the same browser tab. Session keys that are already unique per attempt
 * (a freshly created interview/attempt id) don't need this, but calling it
 * for them is harmless.
 */
export function clearTabSwitchSession(sessionKey: string | null | undefined) {
  if (!sessionKey) return;
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${sessionKey}`);
  } catch {
    /* storage unavailable - nothing to clear */
  }
}

export function useTabSwitchMonitor({
  sessionKey,
  active,
  maxWarnings = 3,
  onWarning,
  onTerminate,
}: UseTabSwitchMonitorOptions) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const countRef = useRef(0);
  const activeRef = useRef(active);
  const terminatedRef = useRef(false);
  // Tracks the last visibility state this hook actually processed, so two
  // "hidden" events fired back-to-back for the same transition (a known
  // quirk in some browsers/embedded contexts) are never double-counted.
  const wasHiddenRef = useRef(false);
  const onWarningRef = useRef(onWarning);
  const onTerminateRef = useRef(onTerminate);
  const maxWarningsRef = useRef(maxWarnings);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);
  useEffect(() => {
    onTerminateRef.current = onTerminate;
  }, [onTerminate]);
  useEffect(() => {
    maxWarningsRef.current = maxWarnings;
  }, [maxWarnings]);

  const storageKey = sessionKey ? `${STORAGE_PREFIX}${sessionKey}` : null;

  // (Re)initialize state for this session. sessionStorage (not localStorage)
  // is used deliberately: it survives a same-tab refresh/navigation - so a
  // refresh cannot be used to reset the violation count mid-session - but is
  // scoped to this browser tab and naturally cleared once the tab closes,
  // matching the tab-switch semantics this feature is about.
  useEffect(() => {
    terminatedRef.current = false;
    wasHiddenRef.current = document.visibilityState === "hidden";

    if (!storageKey) {
      countRef.current = 0;
      setTabSwitchCount(0);
      return;
    }

    let restored = 0;
    try {
      restored = Number(sessionStorage.getItem(storageKey) || 0) || 0;
    } catch {
      restored = 0;
    }
    countRef.current = restored;
    setTabSwitchCount(restored);
    if (restored >= maxWarningsRef.current) {
      terminatedRef.current = true;
    }
  }, [storageKey]);

  // Registered once per session (storageKey changes only when sessionKey
  // does) - never re-subscribed on unrelated re-renders.
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === "hidden";
      if (isHidden === wasHiddenRef.current) return; // not a real transition
      wasHiddenRef.current = isHidden;

      if (!isHidden) return; // only visible -> hidden counts
      if (!activeRef.current || terminatedRef.current) return;

      const next = countRef.current + 1;
      countRef.current = next;
      setTabSwitchCount(next);
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, String(next));
        } catch {
          /* storage unavailable - the in-memory count still works for this tab session */
        }
      }

      if (next >= maxWarningsRef.current) {
        terminatedRef.current = true;
        onTerminateRef.current(next);
      } else {
        onWarningRef.current(next);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [storageKey]);

  return { tabSwitchCount, maxWarnings };
}
