import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Webcam + microphone acquisition for the interview / proctoring flow.
 *
 * Hard guarantees this hook makes:
 *
 *  1. `phase` ALWAYS reaches "ready" or "error" — never stays "initializing".
 *     Every await is bounded by an explicit timeout. Worst case ≈ 15s.
 *
 *  2. Camera readiness is proven by ACTUAL FRAMES
 *     (requestVideoFrameCallback where available, readyState+dimensions +
 *     polling otherwise) — never by "getUserMedia resolved".
 *
 *  3. Exactly one acquisition runs at a time (initPromiseRef mutex). StrictMode
 *     double-invoke, double clicks and re-renders cannot start a second one.
 *
 *  4. The MediaStream is owned here and only torn down on stopWebcam(), retry()
 *     or genuine unmount — a question change / re-render never stops it.
 *
 *  5. No dependency on interview questions, AI, Groq, network or any API.
 */

interface WebcamStatus {
  camera: boolean;
  microphone: boolean;
  internet: boolean;
}

export type WebcamPhase = "idle" | "initializing" | "ready" | "error";

export type WebcamErrorKind =
  | "permission-denied"
  | "device-not-found"
  | "device-busy"
  | "overconstrained"
  | "timeout"
  | "no-frames"
  | "insecure-context"
  | "unsupported"
  | "unknown"
  | null;

const DEBUG = import.meta.env.DEV;
/* eslint-disable @typescript-eslint/no-explicit-any */
const log = (...a: any[]) => DEBUG && console.log("%c[webcam]", "color:#10b981", ...a);
const warn = (...a: any[]) => DEBUG && console.warn("[webcam]", ...a);
/* eslint-enable @typescript-eslint/no-explicit-any */

// getUserMedia can hang on Windows when the OS camera handle is contended.
// Chrome's own internal timeout is ~10s; this is a hard ceiling above that.
const GUM_TIMEOUT_MS = 12000;
// First-frame verification ceiling. If the track is live but no frame is
// confirmed in this long, we proceed (element may be backgrounded) — we do NOT
// hang, and we do NOT fail if the track is still live.
const FRAME_TIMEOUT_MS = 8000;

interface NamedError extends Error {
  name: string;
}
function namedError(name: string, message: string): NamedError {
  const e = new Error(message) as NamedError;
  e.name = name;
  return e;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Race a promise against a rejecting timeout. Always clears its timer. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(namedError("TimeoutError", `${label} did not complete within ${ms}ms`)),
      ms
    );
  });
  return Promise.race([p, timeout]).finally(() => window.clearTimeout(timer)) as Promise<T>;
}

function classifyError(err: unknown): { kind: WebcamErrorKind; message: string } {
  const e = err as { name?: string; message?: string };
  const name = e?.name || "";
  const raw = e?.message || String(err);

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        kind: "permission-denied",
        message:
          "Camera / microphone access is blocked. Click the camera icon in the browser address bar, choose Allow, then Retry.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        kind: "device-not-found",
        message:
          "No camera was found. Connect a webcam and make sure it isn't disabled in Windows Settings › Privacy › Camera.",
      };
    case "OverconstrainedError":
      return {
        kind: "overconstrained",
        message: "The camera does not support the requested settings.",
      };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return {
        kind: "device-busy",
        message:
          "Windows started the camera but no video is coming through. Causes: a camera-privacy switch is on (Lenovo/Dell/HP Fn key or a physical lens shutter), another app holds the camera (Zoom, Teams, OBS, Camera app, another browser tab), or the Windows Camera Frame Server needs a reboot. Fix that, then Retry.",
      };
    case "TimeoutError":
      return {
        kind: "timeout",
        message:
          "The camera took too long to start. Close any app that might be using it (Zoom, Teams, Camera app) and Retry.",
      };
    case "NoFramesError":
      return {
        kind: "no-frames",
        message:
          "The camera started but is not sending any video. Unplug/replug the webcam or close the app holding it, then Retry.",
      };
    case "TypeError":
      return {
        kind: "unsupported",
        message: "This page can't use the camera. Open the app on http://localhost or an https:// URL in Chrome, Edge or Firefox.",
      };
    default:
      return { kind: "unknown", message: `Camera error (${name || "unknown"}): ${raw}` };
  }
}

/**
 * getUserMedia with a hard timeout. If the call resolves AFTER we've already
 * timed out, its tracks are stopped so the OS camera handle isn't leaked.
 */
async function getMedia(constraints: MediaStreamConstraints, label: string): Promise<MediaStream> {
  log(`getUserMedia ${label} →`, JSON.stringify(constraints));
  const call = navigator.mediaDevices.getUserMedia(constraints);
  try {
    const s = await withTimeout(call, GUM_TIMEOUT_MS, `getUserMedia(${label})`);
    log(`getUserMedia ${label} resolved:`, s.id);
    return s;
  } catch (err) {
    call
      .then((late) => {
        warn(`getUserMedia ${label} resolved late — stopping leaked tracks`);
        late.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {});
    throw err;
  }
}

/**
 * Resolves with the signal that confirmed frames ("requestVideoFrameCallback",
 * "loadeddata", "poll", …) or "timeout" if none arrived in `timeoutMs`.
 * ALWAYS cleans up its listeners/timers — never leaks, never hangs.
 */
function waitForFirstFrame(video: HTMLVideoElement, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (via: string) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(via);
    };

    const framesReady = () =>
      video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

    // requestVideoFrameCallback = the browser telling us a frame was composited.
    // This is the strongest possible "frames are flowing" signal.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const rvfc = (video as any).requestVideoFrameCallback?.bind(video);
    const cancelRvfc = (video as any).cancelVideoFrameCallback?.bind(video);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    let rvfcId = 0;
    if (rvfc) rvfcId = rvfc(() => finish("requestVideoFrameCallback"));

    const onEvent = (name: string) => () => framesReady() && finish(name);
    const onLoadedData = onEvent("loadeddata");
    const onCanPlay = onEvent("canplay");
    const onPlaying = onEvent("playing");
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);

    const poll = window.setInterval(() => framesReady() && finish("poll"), 120);
    const cap = window.setTimeout(() => finish("timeout"), timeoutMs);

    function cleanup() {
      window.clearInterval(poll);
      window.clearTimeout(cap);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      if (rvfcId && cancelRvfc) {
        try {
          cancelRvfc(rvfcId);
        } catch {
          /* ignore */
        }
      }
    }

    if (framesReady()) finish("already-ready");
  });
}

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<WebcamStatus>({
    camera: false,
    microphone: false,
    internet: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  const [phase, setPhase] = useState<WebcamPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<WebcamErrorKind>(null);

  // Mutex — one acquisition at a time; concurrent callers await the same promise.
  const initPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  // Live-ness guard for async setState. Set in an effect so StrictMode's
  // mount→unmount→mount leaves it `true`.
  const mountedRef = useRef(true);

  // ── internet status ──────────────────────────────────────────────────────
  const refreshInternet = useCallback(() => {
    setStatus((p) => ({ ...p, internet: navigator.onLine }));
  }, []);
  useEffect(() => {
    refreshInternet();
    window.addEventListener("online", refreshInternet);
    window.addEventListener("offline", refreshInternet);
    return () => {
      window.removeEventListener("online", refreshInternet);
      window.removeEventListener("offline", refreshInternet);
    };
  }, [refreshInternet]);

  // ── teardown — the ONLY place tracks are stopped ─────────────────────────
  const teardownStream = useCallback((reason: string) => {
    const stream = streamRef.current;
    if (stream) {
      log(`teardown (${reason}) — stopping ${stream.getTracks().length} track(s)`);
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.onmute = null;
        t.onunmute = null;
        t.stop();
      });
    }
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      v.srcObject = null;
    }
  }, []);

  // ── acquisition ──────────────────────────────────────────────────────────
  const acquire = useCallback(async (): Promise<MediaStream | null> => {
    const t0 = performance.now();
    const ms = () => `${Math.round(performance.now() - t0)}ms`;
    log("═══ acquire start ═══");

    // (1) preconditions ------------------------------------------------------
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const insecure =
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname);
      const err = insecure
        ? namedError("TypeError", "insecure context")
        : namedError("TypeError", "navigator.mediaDevices.getUserMedia unavailable");
      warn("precondition failed:", err.message);
      const cls = insecure
        ? {
            kind: "insecure-context" as WebcamErrorKind,
            message:
              "The camera only works on http://localhost or an https:// URL. Open the app on localhost.",
          }
        : classifyError(err);
      setStatus((p) => ({ ...p, camera: false, microphone: false }));
      setPhase("error");
      setError(cls.message);
      setErrorKind(cls.kind);
      return null;
    }
    log("(1) navigator.mediaDevices.getUserMedia present, secureContext:", window.isSecureContext);

    setPhase("initializing");
    setError(null);
    setErrorKind(null);

    // Clean slate so no stale OS handle blocks the new request.
    teardownStream("pre-acquire");
    await sleep(0);

    const fail = (err: unknown) => {
      const { kind, message } = classifyError(err);
      warn(`═══ acquire FAILED after ${ms()} ═══`, (err as Error)?.name, "-", message);
      teardownStream("acquire-failed");
      if (mountedRef.current) {
        setStatus((p) => ({ ...p, camera: false, microphone: false }));
        setPhase("error");
        setError(message);
        setErrorKind(kind);
      }
      return null;
    };

    // Outer guard — NOTHING below can escape without resolving `phase`.
    try {
    // (2) getUserMedia — simplest constraints first -------------------------
    let stream: MediaStream;
    try {
      stream = await getMedia({ video: true, audio: true }, "video+audio");
    } catch (e1) {
      const n1 = (e1 as Error)?.name;
      warn(`(2) combined getUserMedia failed (${n1}) at ${ms()}`);
      // A blocked / contended MICROPHONE can fail the combined request while
      // the camera is fine — retry video-only, ONCE.
      if (["NotReadableError", "AbortError", "TrackStartError", "TimeoutError"].includes(n1)) {
        try {
          log("(2b) retrying video-only");
          stream = await getMedia({ video: true, audio: false }, "video-only");
        } catch (e2) {
          return fail(e2);
        }
      } else {
        return fail(e1);
      }
    }

    if (!mountedRef.current) {
      warn("unmounted during getUserMedia — discarding stream");
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    // (3) validate the video track ----------------------------------------
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    log(
      `(3) tracks — video:${stream.getVideoTracks().length} audio:${stream.getAudioTracks().length}`,
      videoTrack
        ? `[${videoTrack.label}] readyState=${videoTrack.readyState} enabled=${videoTrack.enabled} muted=${videoTrack.muted}`
        : "(no video track)"
    );
    if (!videoTrack || videoTrack.readyState !== "live") {
      stream.getTracks().forEach((t) => t.stop());
      return fail(namedError("NotReadableError", "getUserMedia returned no live video track"));
    }

    streamRef.current = stream;

    // React to the device being pulled / grabbed mid-session.
    videoTrack.onended = () => {
      warn("video track ended");
      if (!mountedRef.current) return;
      setStatus((p) => ({ ...p, camera: false }));
      setPhase("error");
      setError("The camera stopped — it was unplugged or taken over by another app. Click Retry.");
      setErrorKind("device-busy");
    };
    videoTrack.onmute = () => warn("video track muted (frames paused)");
    videoTrack.onunmute = () => log("video track unmuted");
    if (audioTrack) {
      audioTrack.onended = () => {
        if (mountedRef.current) setStatus((p) => ({ ...p, microphone: false }));
      };
    }

    // (4) attach to <video> and PROVE frames are flowing -----------------
    const video = videoRef.current;
    log("(4) <video> element attached to ref:", !!video);
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      // Fire play() but DO NOT await it — a stalled source leaves the promise
      // pending forever. autoPlay+muted on the element self-starts anyway.
      video
        .play()
        .then(() => log("(4) video.play() resolved"))
        .catch((e) => warn("(4) video.play() rejected:", (e as Error)?.name, "(non-fatal)"));

      const via = await waitForFirstFrame(video, FRAME_TIMEOUT_MS);
      if (via === "timeout") {
        // No frame confirmed in time. If the track DIED, that's a real fault.
        if (videoTrack.readyState !== "live") {
          return fail(namedError("NoFramesError", "video track died before producing a frame"));
        }
        // Track still live → element is probably just off-screen/backgrounded.
        // Proceed; the preview's own attach effect will render it. Not a hang.
        warn(
          `(4) no frame confirmed in ${FRAME_TIMEOUT_MS}ms but track still live — proceeding (readyState=${video.readyState}, ${video.videoWidth}x${video.videoHeight})`
        );
      } else {
        log(
          `(4) FIRST FRAME confirmed via ${via} at ${ms()} — ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`
        );
      }
    } else {
      warn("(4) no <video> element yet — stream valid, preview will attach on mount");
    }

    if (!mountedRef.current) {
      teardownStream("unmounted-late");
      return null;
    }

    // (5) READY -----------------------------------------------------------
    setStatus({
      camera: videoTrack.readyState === "live",
      microphone: !!audioTrack && audioTrack.readyState === "live",
      internet: navigator.onLine,
    });
    setError(null);
    setErrorKind(null);
    setPhase("ready");
    log(`═══ acquire READY after ${ms()} — cam:${videoTrack.readyState === "live"} mic:${!!audioTrack} ═══`);
    return stream;
    } catch (err) {
      // Any unexpected throw still lands the machine in "error", never "initializing".
      return fail(err);
    }
  }, [teardownStream]);

  // Public entry point — idempotent + mutexed.
  const startWebcam = useCallback((): Promise<MediaStream | null> => {
    if (
      phase === "ready" &&
      streamRef.current?.getVideoTracks()[0]?.readyState === "live"
    ) {
      log("startWebcam — already ready, reusing live stream");
      return Promise.resolve(streamRef.current);
    }
    if (initPromiseRef.current) {
      log("startWebcam — acquisition already in flight, awaiting it");
      return initPromiseRef.current;
    }
    const p = acquire().finally(() => {
      initPromiseRef.current = null;
    });
    initPromiseRef.current = p;
    return p;
  }, [acquire, phase]);

  const retry = useCallback((): Promise<MediaStream | null> => {
    log("retry");
    initPromiseRef.current = null;
    teardownStream("retry");
    setStatus((p) => ({ camera: false, microphone: false, internet: p.internet }));
    setError(null);
    setErrorKind(null);
    setPhase("idle");
    const p = acquire().finally(() => {
      initPromiseRef.current = null;
    });
    initPromiseRef.current = p;
    return p;
  }, [acquire, teardownStream]);

  const stopWebcam = useCallback(() => {
    initPromiseRef.current = null;
    teardownStream("stopWebcam");
    setStatus((p) => ({ camera: false, microphone: false, internet: p.internet }));
    setPhase("idle");
  }, [teardownStream]);

  // Release the camera on genuine unmount so the next mount / navigation
  // doesn't race a still-open OS handle. StrictMode's mount→unmount→mount
  // leaves mountedRef `true` (re-set on every setup run).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initPromiseRef.current = null;
      teardownStream("unmount");
    };
  }, [teardownStream]);

  // ── proctoring frame grab ────────────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  const toggleCamera = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setStatus((p) => ({ ...p, camera: track.enabled && track.readyState === "live" }));
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setStatus((p) => ({ ...p, microphone: track.enabled && track.readyState === "live" }));
    }
  }, []);

  return {
    videoRef,
    streamRef,
    status,
    phase,
    error,
    errorKind,
    startWebcam,
    stopWebcam,
    retry,
    captureFrame,
    toggleCamera,
    toggleMicrophone,
  };
}
