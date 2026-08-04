import { useState, useRef, useCallback, useEffect } from "react";
import type { ProctorFrameResult, ProctorStatus, ProctorEvent } from "../types/proctor";

const AI_SERVICE_URL = "http://localhost:8000";
const AI_SERVICE_KEY = "mindprep-ai-key-2026";
const FRAME_INTERVAL = 100;
const MAX_WARNINGS_BEFORE_TERMINATE = 3;

export function useProctoring(interviewId?: string) {
  const [result, setResult] = useState<ProctorFrameResult | null>(null);
  const [status, setStatus] = useState<ProctorStatus>({
    face: "ok",
    headPose: "ok",
    eyeGaze: "ok",
    phone: "ok",
    identity: "pending",
    camera: "ok",
    microphone: "ok",
    internet: "ok",
  });
  const [events, setEvents] = useState<ProctorEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cheatingCount, setCheatingCount] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [loading, setLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const lastEventTime = useRef<Record<string, number>>({});
  const lookAwayStart = useRef<number | null>(null);
  const eyesClosedStart = useRef<number | null>(null);

  const addEvent = useCallback((type: string, description: string, severity: ProctorEvent["severity"]) => {
    const now = Date.now();
    if (now - (lastEventTime.current[type] || 0) < 2000) return;
    lastEventTime.current[type] = now;
    setEvents((prev) => [...prev.slice(-50), { type, timestamp: now, description, severity }]);
  }, []);

  const checkTabSwitch = useCallback(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        setCheatingCount((c) => c + 1);
        addEvent("tab_switch", "Tab switching detected", "violation");
        setWarnings((w) => [...w, "Tab switching detected"]);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [addEvent]);

  const checkWindowFocus = useCallback(() => {
    const blurHandler = () => {
      setCheatingCount((c) => c + 1);
      addEvent("window_blur", "Interview window lost focus", "warning");
      setWarnings((w) => [...w, "Interview window lost focus"]);
    };
    window.addEventListener("blur", blurHandler);
    return () => window.removeEventListener("blur", blurHandler);
  }, [addEvent]);

  const checkInternet = useCallback(() => {
    const onlineHandler = () => {
      setStatus((s) => ({ ...s, internet: "ok" }));
      addEvent("internet_restored", "Internet connection restored", "info");
    };
    const offlineHandler = () => {
      setStatus((s) => ({ ...s, internet: "violation" }));
      addEvent("internet_lost", "Internet connection lost", "violation");
      setWarnings((w) => [...w, "Internet connection lost"]);
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [addEvent]);

  const processFrame = useCallback(async (base64Frame: string) => {
    if (!base64Frame) return;
    try {
      const res = await fetch(`${AI_SERVICE_URL}/proctor/detect-face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Service-Key": AI_SERVICE_KEY,
        },
        body: JSON.stringify({ image: base64Frame }),
      });
      if (!res.ok) {
        console.warn(`[Proctor] detect-face returned ${res.status}`);
        return;
      }
      const data: ProctorFrameResult = await res.json();
      console.debug("[Proctor] frame result:", data);
      setResult(data);

      const newWarnings: string[] = [];
      let newCheatingCount = 0;

      if (!data.faceDetected) {
        newWarnings.push("No face visible");
        newCheatingCount++;
      }
      if (data.multipleFaces || data.multiplePersons) {
        newWarnings.push("Multiple people detected");
        newCheatingCount++;
      }
      if (data.phoneDetected) {
        newWarnings.push("Mobile phone detected");
        newCheatingCount++;
      }
      if (data.faceTooFar) newWarnings.push("Face too far");
      if (data.faceTooClose) newWarnings.push("Face too close");
      if (data.facePartial) newWarnings.push("Face partially outside camera");

      if (data.headDirection !== "Center") {
        if (!lookAwayStart.current) lookAwayStart.current = Date.now();
        const elapsed = (Date.now() - lookAwayStart.current) / 1000;
        if (elapsed > 3) {
          newWarnings.push("Please look at the screen");
          newCheatingCount++;
        }
      } else {
        lookAwayStart.current = null;
      }

      if (data.eyesClosed) {
        if (!eyesClosedStart.current) eyesClosedStart.current = Date.now();
        const elapsed = (Date.now() - eyesClosedStart.current) / 1000;
        if (elapsed > 2) {
          newWarnings.push("Please stay attentive");
          newCheatingCount++;
        }
      } else {
        eyesClosedStart.current = null;
      }

      if (data.warnings) {
        for (const w of data.warnings) {
          if (!newWarnings.includes(w)) newWarnings.push(w);
        }
      }

      setStatus((s) => ({
        ...s,
        face: !data.faceDetected ? "violation" : data.multipleFaces ? "warning" : "ok",
        headPose: data.lookingAway ? "violation" : data.headDirection !== "Center" ? "warning" : "ok",
        eyeGaze: data.eyesClosed ? "violation" : "ok",
        phone: data.phoneDetected ? "violation" : "ok",
      }));

      if (newWarnings.length > 0) {
        setWarnings(newWarnings);
        for (const w of newWarnings) {
          const type = w.toLowerCase().replace(/\s+/g, "_");
          addEvent(type, w, newCheatingCount > 0 ? "violation" : "warning");
        }
      } else {
        setWarnings([]);
      }

      setCheatingCount((c) => Math.max(c, newCheatingCount));
      if (newCheatingCount >= MAX_WARNINGS_BEFORE_TERMINATE) {
        setTerminated(true);
      }
    } catch (err) {
      console.warn("[Proctor] detect-face error:", err);
    }
  }, [addEvent]);

  const startCapture = useCallback((captureFn: () => string | null) => {
    captureRef.current = captureFn;
    setLoading(true);
    intervalRef.current = window.setInterval(async () => {
      const frame = captureRef.current?.();
      if (frame) await processFrame(frame);
    }, FRAME_INTERVAL);
    setLoading(false);
  }, [processFrame]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    cleanups.push(checkTabSwitch());
    cleanups.push(checkWindowFocus());
    cleanups.push(checkInternet());
    return () => {
      cleanups.forEach((fn) => fn());
      stopCapture();
    };
  }, [checkTabSwitch, checkWindowFocus, checkInternet, stopCapture]);

  const reportToBackend = useCallback(async (eventType: string, description: string) => {
    if (!interviewId) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `http://localhost:3000/api/v1/mock-interview/${interviewId}/cheating`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: eventType, description }),
        }
      );
    } catch {
      // silently ignore
    }
  }, [interviewId]);

  const dismissWarning = useCallback((warning: string) => {
    setWarnings((w) => w.filter((x) => x !== warning));
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setStatus({
      face: "ok",
      headPose: "ok",
      eyeGaze: "ok",
      phone: "ok",
      identity: "pending",
      camera: "ok",
      microphone: "ok",
      internet: "ok",
    });
    setEvents([]);
    setWarnings([]);
    setCheatingCount(0);
    setTerminated(false);
  }, []);

  return {
    result,
    status,
    events,
    warnings,
    cheatingCount,
    terminated,
    loading,
    startCapture,
    stopCapture,
    reportToBackend,
    dismissWarning,
    reset,
    addEvent,
  };
}
