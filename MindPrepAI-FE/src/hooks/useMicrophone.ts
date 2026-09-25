import { useState, useRef, useCallback } from "react";
import type { SpeechMetrics } from "../types/mockFeedback";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// ── Audio measurements (pauses, recording length) ───────────────────────────
// A simple energy-based silence detector on the same microphone stream. It measures the REAL audio:
// a silence longer than PAUSE_MIN_SECONDS that happens after the candidate started speaking is a
// pause (leading and trailing silence are ignored). It is approximate - a noisy room raises the
// noise floor and quiet speech can read as silence - and if the browser cannot run it, `pauseDetection`
// stays false so the report shows "Not available" instead of a guess.
const METER_INTERVAL_MS = 100;
const PAUSE_MIN_SECONDS = 1.0; // recorded from 1s; the backend applies its own "long pause" threshold
const MAX_PAUSES = 50;

interface MeterState {
  ctx: AudioContext;
  timer: number;
  startedAt: number;
  endedAt: number | null;
  floor: number;
  hasSpoken: boolean;
  silenceStart: number | null;
  lastTick: number;
  speechMs: number;
  pauses: Array<{ startSeconds: number; durationSeconds: number }>;
}

export function useMicrophone() {
  const meterRef = useRef<MeterState | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isRecordingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationIntervalRef = useRef<number | null>(null);

  // Stops sampling and releases the AudioContext but KEEPS the collected numbers (read by getSpeechMetrics).
  const freezeMeter = useCallback(() => {
    const m = meterRef.current;
    if (!m || m.endedAt !== null) return;
    window.clearInterval(m.timer);
    m.endedAt = performance.now();
    m.ctx.close().catch(() => {});
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      const ctx: AudioContext = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const now = performance.now();
      const m: MeterState = {
        ctx, timer: 0, startedAt: now, endedAt: null, floor: 0.05, hasSpoken: false,
        silenceStart: null, lastTick: now, speechMs: 0, pauses: [],
      };
      m.timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const t = performance.now();
        // Noise floor: jumps down to any quieter reading, drifts up slowly.
        m.floor = Math.min(rms, m.floor * 1.002 + 1e-5);
        const speaking = rms > Math.max(0.012, m.floor * 3);
        if (speaking) {
          if (m.hasSpoken && m.silenceStart !== null) {
            const dur = (t - m.silenceStart) / 1000;
            if (dur >= PAUSE_MIN_SECONDS && m.pauses.length < MAX_PAUSES) {
              m.pauses.push({
                startSeconds: Math.round(((m.silenceStart - m.startedAt) / 1000) * 10) / 10,
                durationSeconds: Math.round(dur * 10) / 10,
              });
            }
          }
          m.hasSpoken = true;
          m.silenceStart = null;
          m.speechMs += t - m.lastTick;
        } else if (m.hasSpoken && m.silenceStart === null) {
          m.silenceStart = t;
        }
        m.lastTick = t;
      }, METER_INTERVAL_MS);
      meterRef.current = m;
    } catch (err) {
      // Measurement is optional: recording and transcription must never depend on it.
      console.warn("Pause detection unavailable:", err);
      meterRef.current = null;
    }
  }, []);

  /** Audio measurements for the answer being recorded (or just recorded). Undefined if nothing was recorded. */
  const getSpeechMetrics = useCallback((): SpeechMetrics | undefined => {
    const m = meterRef.current;
    if (!m) return undefined;
    const end = m.endedAt ?? performance.now();
    const recordingSeconds = Math.round(((end - m.startedAt) / 1000) * 10) / 10;
    if (recordingSeconds < 0.5) return undefined;
    return {
      recordingSeconds,
      speechSeconds: Math.round(m.speechMs / 100) / 10,
      pauseDetection: true,
      pauses: m.pauses.map((p) => ({ ...p })),
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Fresh measurement for this recording (discard any earlier meter).
      if (meterRef.current) {
        freezeMeter();
        meterRef.current = null;
      }
      startMeter(stream);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);

      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const recognition = getSpeechRecognition();
      if (recognition) {
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event: any) => {
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) final += res[0].transcript;
          }
          if (final) {
            setTranscript((prev) => (prev ? `${prev} ${final}` : final).trim());
          }
        };
        recognition.onerror = () => {
          setIsTranscribing(false);
        };
        recognition.onend = () => {
          setIsTranscribing(false);
          if (isRecordingRef.current) {
            try {
              recognition.start();
              setIsTranscribing(true);
            } catch {
              /* ignore */
            }
          }
        };
        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsTranscribing(true);
        } catch {
          /* ignore */
        }
      }

      return true;
    } catch (err) {
      console.error("Microphone error:", err);
      return false;
    }
  }, [freezeMeter, startMeter]);

  const stopRecording = useCallback((): Blob | null => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      freezeMeter();
      setIsRecording(false);
      isRecordingRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
      setIsTranscribing(false);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      return audioBlob;
    }
    return null;
  }, [isRecording, audioBlob, freezeMeter]);

  const getAudioBase64 = useCallback(async (): Promise<string | null> => {
    if (!audioBlob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(",")[1]);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(audioBlob);
    });
  }, [audioBlob]);

  const resetRecording = useCallback(() => {
    freezeMeter();
    meterRef.current = null;
    isRecordingRef.current = false;
    audioChunksRef.current = [];
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setTranscript("");
    setIsTranscribing(false);
    setAudioBlob(null);
    setRecordingDuration(0);
  }, [freezeMeter]);

  return {
    isRecording,
    isTranscribing,
    transcript,
    audioBlob,
    recordingDuration,
    startRecording,
    stopRecording,
    getAudioBase64,
    getSpeechMetrics,
    resetRecording,
  };
}
