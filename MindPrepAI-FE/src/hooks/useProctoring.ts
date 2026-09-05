import { useState, useEffect, useRef, useCallback } from "react";
import { PROCTOR_WS_URL } from "../config/config";

interface ProctoringViolation {
  type: string;
  message: string;
  severity: "high" | "medium" | "low";
  timestamp: number;
}

export interface ProctoringResult {
  faceCount: number;
  faceStatus: "normal" | "none" | "multiple";
  lookingAway: boolean;
  lookingDirection: "forward" | "left" | "right" | "up" | "down";
  mobilePhone: boolean;
  headset: boolean;
  cameraObstructed: boolean;
  analysisDegraded?: boolean;
  violations: ProctoringViolation[];
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 8000;

// Last-resort safety net: a WebSocket can sit in CONNECTING indefinitely with
// no onopen/onerror/onclose ever firing (backend TCP-accepts but never
// completes the upgrade, process hung, proxy holding the socket half-open). If
// the handshake has not reached "open" within this window, abandon the socket
// and run the normal reconnect/backoff path instead of pinning the UI on
// "Connecting to proctoring…" until the browser's own multi-minute TCP timeout.
const CONNECT_TIMEOUT_MS = 10000;

// Watchdog: frames are being sent but the backend has not returned an analysis
// result in this long -> surface "reconnecting" in the UI instead of a silent
// stall. After the hard limit, force a socket reconnect.
const STALL_SOFT_MS = 8000;
const STALL_HARD_MS = 20000;
// Before the very first analysis result arrives the backend may still be doing
// a one-time model warm-up on a slow machine, so give the first frame a longer
// grace period before forcing a reconnect.
const FIRST_RESULT_HARD_MS = 45000;
const WATCHDOG_INTERVAL_MS = 2000;

// After this many consecutive connection attempts that never reached "open",
// stop showing the neutral "connecting" spinner and surface an error so the
// user knows the proctoring service is unreachable (not just slow).
const CONNECT_FAIL_ERROR_THRESHOLD = 3;

export function useProctoring(interviewId?: string) {
  const [status, setStatus] = useState<"idle" | "connecting" | "active" | "error" | "terminated">("idle");
  const [result, setResult] = useState<ProctoringResult | null>(null);
  const [warnings, setWarnings] = useState<ProctoringViolation[]>([]);
  const [cheatingCount, setCheatingCount] = useState(0);
  const [terminated, setTerminated] = useState(false);
  // True when the socket is up and frames are flowing but the backend analysis
  // has gone quiet — distinct from a dropped connection ("connecting").
  const [stalled, setStalled] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const captureInterval = useRef<number | null>(null);
  const watchdogInterval = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const firstFrameWarnedRef = useRef(false);
  // Flips true once the backend has returned at least one analysis result on
  // the current capture session — gates the cold-start watchdog grace period.
  const firstResultRef = useRef(false);
  // True while the live socket has successfully reached "open" at least once,
  // so onclose can tell "server unreachable" from "server dropped us".
  const everOpenedRef = useRef(false);

  // The id the *live* socket is currently using.
  const sessionIdRef = useRef<string>("");
  // Kept in sync with the interviewId prop so callbacks never read a stale one.
  const interviewIdRef = useRef<string | undefined>(interviewId);
  // Client-generated bridge id, created once, used ONLY until the real
  // interviewId is available. Proctoring must never wait on — or fail because
  // of — interview creation / AI question generation, so if the real id is not
  // ready (or interview creation itself failed) we still open the socket under
  // this id and adopt the real one the moment it appears.
  const bridgeIdRef = useRef<string>("");
  // True while a deliberate reconnect to swap bridge id -> real interviewId is
  // in flight, so onclose reconnects immediately instead of with backoff.
  const adoptingRef = useRef(false);

  // True whenever capture is meant to be running - lets onclose tell an
  // intentional stopCapture() from an unexpected drop (network blip, backend
  // restart) that should be retried automatically instead of going dark.
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  // Tracks the in-flight handshake watchdog for the socket currently connecting.
  const connectTimerRef = useRef<number | null>(null);

  const computeSessionId = useCallback(() => {
    if (interviewIdRef.current) return interviewIdRef.current;
    if (!bridgeIdRef.current) {
      const rand =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      bridgeIdRef.current = `pending-${rand}`;
    }
    return bridgeIdRef.current;
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearConnectTimer = useCallback(() => {
    if (connectTimerRef.current !== null) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Always resolves to *something* — the real interview id if we have it,
    // otherwise the client bridge id. The socket is never blocked.
    const sid = computeSessionId();
    sessionIdRef.current = sid;

    setStatus("connecting");

    const wsUrl = `${PROCTOR_WS_URL}/proctor/ws/${sid}`;

    const ws = new WebSocket(wsUrl);

    // Guards this specific attempt: once the handshake watchdog has torn the
    // socket down, its later (possibly never-arriving) onclose must not also
    // schedule a reconnect.
    let handshakeAbandoned = false;

    const scheduleBackoffReconnect = () => {
      clearReconnectTimer();
      reconnectAttemptRef.current += 1;

      // If we have never once reached "open", the service is unreachable
      // (down, wrong URL, blocked) rather than merely slow — after a few
      // tries say so instead of leaving the neutral "Connecting…" spinner up
      // forever. Retries continue in the background regardless.
      const unreachable =
        !everOpenedRef.current &&
        reconnectAttemptRef.current >= CONNECT_FAIL_ERROR_THRESHOLD;
      setStatus(unreachable ? "error" : "connecting");

      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * 2 ** (reconnectAttemptRef.current - 1),
        RECONNECT_MAX_DELAY_MS
      );
      reconnectTimerRef.current = window.setTimeout(() => {
        if (shouldReconnectRef.current) connectWebSocket();
      }, delay);
    };

    clearConnectTimer();
    connectTimerRef.current = window.setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) return;
      handshakeAbandoned = true;
      console.warn("[Proctoring] handshake did not complete in time — retrying");
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      if (wsRef.current === ws) wsRef.current = null;
      adoptingRef.current = false;
      if (shouldReconnectRef.current) scheduleBackoffReconnect();
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearConnectTimer();
      adoptingRef.current = false;
      reconnectAttemptRef.current = 0;
      everOpenedRef.current = true;
      lastResultAtRef.current = Date.now();
      setStalled(false);
      setStatus("active");
    };

    ws.onmessage = (event) => {
      try {
        const data: ProctoringResult = JSON.parse(event.data);
        lastResultAtRef.current = Date.now();
        firstResultRef.current = true;
        setStalled(false);
        setResult(data);

        if (data.violations && data.violations.length > 0) {
          setWarnings((prev) => [...prev, ...data.violations]);
          setCheatingCount((prev) => {
            const newCount = prev + data.violations.length;
            if (newCount >= 3) {
              setTerminated(true);
            }
            return newCount;
          });
        }
      } catch (e) {
        console.error("Failed to parse proctoring result:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("Proctoring WebSocket error:", error);
    };

    ws.onclose = () => {
      if (handshakeAbandoned) return; // watchdog already handled this attempt
      clearConnectTimer();
      wsRef.current = null;
      if (!shouldReconnectRef.current) {
        setStatus("idle");
        return;
      }
      clearReconnectTimer();

      // Deliberate swap from the bridge id to the real interviewId — reconnect
      // immediately, this is not a failure.
      if (adoptingRef.current) {
        adoptingRef.current = false;
        reconnectAttemptRef.current = 0;
        setStatus("connecting");
        reconnectTimerRef.current = window.setTimeout(() => {
          if (shouldReconnectRef.current) connectWebSocket();
        }, 50);
        return;
      }

      // Unexpected drop mid-interview (server restart, network blip) -
      // retry with capped exponential backoff instead of silently going
      // idle and never resuming for the rest of the session.
      scheduleBackoffReconnect();
    };

    wsRef.current = ws;
  }, [computeSessionId, clearReconnectTimer, clearConnectTimer]);

  // Adopt the real interview id the moment it exists. Until then proctoring is
  // already running under the bridge id — this only upgrades the session id, it
  // never gates the socket coming up. This is proctoring's ONLY link to the
  // rest of the app: the interview session id (not questions, not AI, not any
  // question-UI state).
  useEffect(() => {
    interviewIdRef.current = interviewId;
    if (!interviewId || sessionIdRef.current === interviewId) return;
    if (!shouldReconnectRef.current) return; // capture not running yet

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      // Live under the bridge id — close so it reconnects under the real id.
      adoptingRef.current = true;
      wsRef.current.close();
    } else {
      connectWebSocket();
    }
  }, [interviewId, connectWebSocket]);

  const startCapture = useCallback((getFrameDataUrl: () => string | null, fps: number = 2) => {
    shouldReconnectRef.current = true;
    reconnectAttemptRef.current = 0;
    firstFrameWarnedRef.current = false;
    firstResultRef.current = false;
    everOpenedRef.current = false;
    lastResultAtRef.current = Date.now();
    clearReconnectTimer();
    clearConnectTimer();
    // Opens the socket immediately — under the real interviewId if we already
    // have it, otherwise under the client bridge id (adopted to the real id
    // later). Never waits on interview creation or question generation.
    setStatus("connecting");
    connectWebSocket();

    const intervalMs = 1000 / fps;
    const startedAt = Date.now();
    let nullFrameSince = 0;

    captureInterval.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const frameData = getFrameDataUrl();
        if (frameData) {
          nullFrameSince = 0;
          wsRef.current.send(frameData);
        } else {
          // Video element not ready yet — log once so a black feed is diagnosable.
          if (!nullFrameSince) nullFrameSince = Date.now();
          if (
            !firstFrameWarnedRef.current &&
            Date.now() - nullFrameSince > 3000 &&
            Date.now() - startedAt > 3000
          ) {
            firstFrameWarnedRef.current = true;
            console.warn("[Proctoring] no webcam frame available 3s after capture start");
          }
        }
      }
    }, intervalMs);

    // Watchdog — detect a live socket that has stopped returning analysis.
    watchdogInterval.current = window.setInterval(() => {
      if (!shouldReconnectRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const quietFor = Date.now() - lastResultAtRef.current;
      const hardLimit = firstResultRef.current
        ? STALL_HARD_MS
        : FIRST_RESULT_HARD_MS;
      if (quietFor > hardLimit) {
        // Force the existing auto-reconnect path.
        lastResultAtRef.current = Date.now();
        setStalled(true);
        wsRef.current.close();
      } else if (quietFor > STALL_SOFT_MS) {
        setStalled(true);
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [connectWebSocket, clearReconnectTimer, clearConnectTimer]);

  const stopCapture = useCallback(() => {
    shouldReconnectRef.current = false;
    adoptingRef.current = false;
    clearReconnectTimer();
    clearConnectTimer();
    if (captureInterval.current !== null) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }
    if (watchdogInterval.current !== null) {
      clearInterval(watchdogInterval.current);
      watchdogInterval.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStalled(false);
    setStatus("idle");
  }, [clearReconnectTimer, clearConnectTimer]);

  const dismissWarning = useCallback(() => {
    setWarnings([]);
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    status,
    stalled,
    result,
    warnings,
    cheatingCount,
    terminated,
    startCapture,
    stopCapture,
    dismissWarning
  };
}
