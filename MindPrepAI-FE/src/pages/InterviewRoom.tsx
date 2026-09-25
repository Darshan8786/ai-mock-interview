import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWebcam } from "../hooks/useWebcam";
import { useMicrophone } from "../hooks/useMicrophone";
import { useInterview } from "../hooks/useInterview";
import { useProctoring } from "../hooks/useProctoring";
import { useTabSwitchMonitor, clearTabSwitchSession } from "../hooks/useTabSwitchMonitor";
import { WarningOverlay } from "../components/interview/WarningOverlay";
import { ProctoringPanel } from "../components/interview/ProctoringPanel";
import { QuestionPanel } from "../components/interview/QuestionPanel";
import { TabSwitchGuardModal } from "../components/common/TabSwitchGuardModal";
import { Timer, type TimerHandle } from "../components/mock-interview/Timer";
import { ProgressBar } from "../components/mock-interview/ProgressBar";
import { StatusIndicator } from "../components/mock-interview/StatusIndicator";
import { WebcamPreview as SetupWebcamPreview } from "../components/mock-interview/WebcamPreview";
import { AI_SERVICE_URL, AI_SERVICE_KEY } from "../config/config";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import {
  reportCheating as reportInterviewCheating,
  terminateInterview as terminateInterviewApi,
  getInterviewState,
} from "../services/mockInterviewApi";
import { useFullscreenMonitor } from "../hooks/useFullscreenMonitor";
import { FullscreenGuardModal } from "../components/common/FullscreenGuardModal";
import {
  interviewConfigKey,
  saveActiveInterview,
  readActiveInterview,
  clearActiveInterview,
} from "../hooks/useInterview";

/** What the server says about an interview that is still running (used to resume after a refresh). */
interface ResumeInfo {
  id: string;
  fullScreenExitCount: number;
  tabSwitchCount: number;
  startedAt?: string;
  timeLimitMinutes: number;
}

export function InterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state as any;

  const {
    videoRef,
    streamRef,
    status,
    phase: webcamPhase,
    error: webcamError,
    errorKind: webcamErrorKind,
    startWebcam,
    stopWebcam,
    retry: retryWebcam,
    captureFrame,
  } = useWebcam();

  const {
    isRecording,
    isTranscribing,
    transcript,
    recordingDuration,
    startRecording,
    stopRecording,
    getAudioBase64,
    getSpeechMetrics,
    resetRecording,
  } = useMicrophone();

  const {
    currentQuestion,
    questionsStatus,
    isComplete,
    loading,
    error: interviewError,
    errorKind: interviewErrorKind,
    startInterview,
    resumeInterview,
    retryStartInterview,
    submitAnswer,
    skipQuestion,
    terminateInterview,
    getReport,
    interviewId,
  } = useInterview();

  const {
    status: proctorStatus,
    stalled: proctorStalled,
    result: proctorResult,
    warnings: proctorWarnings,
    cheatingCount,
    terminated,
    startCapture,
    stopCapture: stopProctorCapture,
    dismissWarning,
  } = useProctoring(interviewId ?? undefined);

  const [answerMode, setAnswerMode] = useState<"voice" | "text">("text");
  const [textAnswer, setTextAnswer] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [genTakingLong, setGenTakingLong] = useState(false);
  const questionTimerRef = useRef<TimerHandle>(null);
  const overallTimerRef = useRef<TimerHandle>(null);

  // ── TAB-SWITCH / VISIBILITY MONITORING ──────────────────────────────────
  // Independent of question generation, AI evaluation, and the webcam-based
  // proctoring WebSocket above - driven purely by the browser's own
  // visibilitychange event. `activeTabWarning` controls the (dismissible)
  // 1st/2nd warning modal; `tabTerminated` is permanent once the 3rd switch
  // happens and gates further answering while the termination flow runs.
  const [activeTabWarning, setActiveTabWarning] = useState(0);
  const [tabTerminated, setTabTerminated] = useState(false);

  const handleTabSwitchWarning = useCallback(
    (count: number) => {
      setActiveTabWarning(count);
      if (interviewId) {
        reportInterviewCheating(
          interviewId,
          "tab_switch",
          "Browser tab switched during interview",
          { count, severity: "WARNING" }
        ).catch((err) => console.error("Failed to report tab-switch warning:", err));
      }
    },
    [interviewId]
  );

  const handleTabSwitchTerminate = useCallback(() => {
    setActiveTabWarning(0);
    setTabTerminated(true);
  }, []);

  const { tabSwitchCount } = useTabSwitchMonitor({
    sessionKey: interviewId,
    active: !showInstructions && !!interviewId && !isComplete && !tabTerminated,
    onWarning: handleTabSwitchWarning,
    onTerminate: handleTabSwitchTerminate,
  });

  // Runs once when the 3rd tab switch is detected: persists the violation +
  // termination reason via the existing cheating-report endpoint (which,
  // reused as-is, already flips the interview to "terminated" once its
  // cheatingCount reaches 3 - no new backend endpoint needed), tears down
  // proctoring/camera, then reuses the normal report flow to land on the
  // existing interview result page.
  useEffect(() => {
    if (!tabTerminated) return;
    let cancelled = false;
    (async () => {
      stopProctorCapture();
      if (interviewId) {
        try {
          await reportInterviewCheating(
            interviewId,
            "tab_switch",
            "Tab switch limit exceeded - interview terminated",
            { count: 3, severity: "TERMINATED" }
          );
        } catch (err) {
          console.error("Failed to report tab-switch termination:", err);
        }
      }
      stopWebcam();
      await fs.exit();
      const report = await getReport();
      if (cancelled) return;
      clearTabSwitchSession(interviewId);
      fs.clearSession(interviewId);
      clearActiveInterview();
      const reportId = report?.report?._id || interviewId;
      navigate(`/mock-interview/result/${reportId}`, { state: { report, config } });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabTerminated]);

  // ── FULL-SCREEN ENFORCEMENT ──────────────────────────────────────────────
  // Sibling of the tab-switch monitor above and just as independent of question
  // generation / AI evaluation / the proctoring WebSocket: it is keyed only on the
  // interview *session* id. Leaving fullscreen during a live interview is a strike:
  // 1st and 2nd show a blocking warning, the 3rd terminates the interview.
  // Entering fullscreen, and exits the app makes itself (finish / terminate /
  // navigate away), are never counted.
  const isCollege = config?.source === "COLLEGE";
  const configKey = interviewConfigKey(config || {});
  const [activeFsWarning, setActiveFsWarning] = useState(0);
  const [fsTerminated, setFsTerminated] = useState(false);
  const [fsBlocked, setFsBlocked] = useState(false); // the browser refused to enter fullscreen
  const [fsEnterFailed, setFsEnterFailed] = useState(false); // ...or to re-enter it after a warning
  const [ending, setEnding] = useState(false);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  // Start stays disabled until we know whether an unfinished interview should be resumed.
  const [resumeChecked, setResumeChecked] = useState(() => !readActiveInterview());
  const interviewLocked = tabTerminated || fsTerminated;

  const handleFsWarning = useCallback(
    (count: number) => {
      setActiveFsWarning(count);
      if (interviewId) {
        reportInterviewCheating(interviewId, "fullscreen_exit", "Left full-screen mode during interview", {
          count,
          severity: "WARNING",
        }).catch((err) => console.error("Failed to report full-screen exit:", err));
      }
    },
    [interviewId]
  );

  const handleFsTerminate = useCallback(() => {
    setActiveFsWarning(0);
    setFsTerminated(true);
  }, []);

  const fs = useFullscreenMonitor({
    sessionKey: interviewId,
    active: !showInstructions && !!interviewId && !isComplete && !terminated && !tabTerminated && !fsTerminated && !ending,
    onWarning: handleFsWarning,
    onTerminate: handleFsTerminate,
    serverCount: resume?.fullScreenExitCount ?? 0,
  });

  // Back in fullscreen → the warning is no longer needed.
  useEffect(() => {
    if (fs.isFullscreen) {
      setActiveFsWarning(0);
      setFsEnterFailed(false);
      setFsBlocked(false);
    }
  }, [fs.isFullscreen]);

  // Runs once on the 3rd exit. Freezes everything the candidate could still use,
  // persists the violation + reason through the existing cheating/terminate
  // endpoints (the server flips the interview to "terminated"), tears down
  // proctoring/camera, leaves fullscreen on purpose, then reuses the normal
  // report flow to land on the existing result page.
  useEffect(() => {
    if (!fsTerminated) return;
    let cancelled = false;
    (async () => {
      overallTimerRef.current?.stop();
      questionTimerRef.current?.stop();
      if (isRecording) stopRecording();
      stopProctorCapture();

      let serverTerminated = false;
      if (interviewId) {
        try {
          const res = await reportInterviewCheating(
            interviewId,
            "fullscreen_exit",
            "Full-screen exit limit exceeded - interview terminated",
            { count: 3, severity: "TERMINATED" }
          );
          serverTerminated = !!res?.data?.terminated;
        } catch (err) {
          console.error("Failed to report full-screen termination:", err);
        }
        if (!serverTerminated) {
          // The report call failed or lost a race: end the session explicitly so it can't continue.
          try {
            await terminateInterviewApi(interviewId, "FULLSCREEN_EXIT_LIMIT_EXCEEDED");
          } catch (err) {
            console.error("Failed to terminate interview after full-screen limit:", err);
          }
        }
      }
      stopWebcam();
      await fs.exit();
      const report = await getReport();
      if (cancelled) return;
      clearTabSwitchSession(interviewId);
      fs.clearSession(interviewId);
      clearActiveInterview();
      const reportId = report?.report?._id || interviewId;
      navigate(`/mock-interview/result/${reportId}`, { state: { report, config } });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsTerminated]);

  // Leaving the room for any reason (result page, dashboard, ...) leaves fullscreen too — silently.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // A page refresh used to abandon the interview and start a new one (resetting every
  // counter). If this tab has an unfinished interview for the same setup, offer to resume it.
  useEffect(() => {
    if (!config) return;
    const active = readActiveInterview();
    if (!active) return;
    if (active.configKey !== configKey) {
      clearActiveInterview();
      setResumeChecked(true);
      return;
    }
    let cancelled = false;
    getInterviewState(active.id)
      .then((res) => {
        if (cancelled) return;
        const st = res?.data;
        if (res?.success && st?.status === "in-progress") {
          setResume({
            id: active.id,
            fullScreenExitCount: st.fullScreenExitCount || 0,
            tabSwitchCount: st.tabSwitchCount || 0,
            startedAt: st.startedAt,
            timeLimitMinutes: st.timeLimitMinutes || 0,
          });
        } else {
          clearActiveInterview(); // finished or gone
        }
      })
      .catch((err) => console.error("Could not check for an interview to resume:", err))
      .finally(() => {
        if (!cancelled) setResumeChecked(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface a "taking longer than usual" hint + retry while the first question
  // is still being generated, so the user is never stuck on a bare spinner.
  useEffect(() => {
    if (questionsStatus === "generating" && !currentQuestion) {
      setGenTakingLong(false);
      const t = window.setTimeout(() => setGenTakingLong(true), 20000);
      return () => window.clearTimeout(t);
    }
    setGenTakingLong(false);
  }, [questionsStatus, currentQuestion]);

  useEffect(() => {
    if (!config) {
      navigate("/mock-interview/setup");
    } else {
      setTotalQuestions(config.totalQuestions || 5);
    }
  }, [config, navigate]);

  const handlePermission = async () => {
    await startWebcam();
  };

  // The interview only begins once fullscreen is active. Called from the click
  // handler so the browser's user-gesture requirement is met; if the browser still
  // refuses, the "Enter Full Screen" button + explanation stay on screen.
  const ensureFullscreen = async () => {
    if (fs.isFullscreen) return true;
    const ok = await fs.enter();
    setFsBlocked(!ok);
    return ok;
  };

  const handleStartInterview = async () => {
    if (!config) return;
    if (!(await ensureFullscreen())) return;
    setShowInstructions(false);

    if (resume) {
      // Continue the interview that is still running on the server; its question
      // comes back through the normal state poll (nothing is regenerated).
      resumeInterview(resume.id);
      return;
    }

    const id = await startInterview({
      source: config.source,
      collegeInterviewId: config.collegeInterviewId,
      jobRole: config.jobRole,
      experienceLevel: config.experienceLevel,
      interviewType: config.interviewType,
      difficulty: config.difficulty,
      totalQuestions: config.totalQuestions,
      resume: config.resume,
    });

    if (id) {
      saveActiveInterview({ id, configKey });
      overallTimerRef.current?.reset();
      // Take the server's persisted counters (a college interview can resume an existing session).
      getInterviewState(id)
        .then((r) => {
          if (r?.success) fs.syncCount(r.data.fullScreenExitCount || 0);
        })
        .catch((err) => console.error("Could not sync full-screen count:", err));
    }

    // startCapture is NOT called here — the effect below owns the proctoring
    // lifecycle, keyed on the interview session (not this request's outcome).
  };

  // PROCTORING LIFECYCLE — driven purely by (interview started) + (camera ready).
  //
  // Frame capture starts the moment the interview screen is shown and the
  // webcam stream is READY. It does NOT wait for question generation. The
  // proctoring WebSocket inside useProctoring opens under a client bridge id
  // immediately and adopts the real `interviewId` when it appears — so a slow
  // or failed AI question pipeline (Groq/AI API down, question never rendered,
  // question component crash) cannot stop or delay proctoring.
  //
  // Nothing about question state — currentQuestion, questionsStatus, loading,
  // errors — is referenced here. A question failure cannot reach this effect.
  //
  // `!showInstructions` also guarantees the interview <video> element is mounted
  // (the setup <video> has unmounted) so captureFrame reads the right element.
  const proctoringStartedRef = useRef(false);
  useEffect(() => {
    const cameraReady = webcamPhase === "ready" && status.camera;
    if (!showInstructions && cameraReady && !proctoringStartedRef.current) {
      proctoringStartedRef.current = true;
      startCapture(captureFrame, 2); // 2 FPS
    }
  }, [showInstructions, webcamPhase, status.camera, startCapture, captureFrame]);

  useEffect(() => {
    if (currentQuestion) {
      setQuestionIndex(currentQuestion.index);
      if (questionTimerRef.current) {
        questionTimerRef.current.reset();
      }
      setTextAnswer("");
      resetRecording();

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
  }, [currentQuestion, resetRecording]);

  useEffect(() => {
    if (answerMode === "voice" && transcript) {
      setTextAnswer(transcript);
    }
  }, [transcript, answerMode]);

  useEffect(() => {
    if (currentQuestion?.type === "MCQ" || currentQuestion?.type === "Coding") {
      if (isRecording) stopRecording();
      setAnswerMode("text");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  const speakQuestion = useCallback(async (text: string) => {
    try {
      const res = await fetchWithTimeout(
        `${AI_SERVICE_URL}/text-to-speech`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AI-Service-Key": AI_SERVICE_KEY,
          },
          body: JSON.stringify({ text }),
        },
        8000
      );
      const data = await res.json();
      if (data.audio) {
        const blob = base64ToBlob(data.audio);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const audio = new Audio(url);
        audio.play();
      }
    } catch {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
      }
    }
  }, []);

  function base64ToBlob(base64: string): Blob {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    return new Blob([byteArray], { type: "audio/wav" });
  }

  useEffect(() => {
    if (currentQuestion?.question) {
      speakQuestion(currentQuestion.question);
    }
  }, [currentQuestion, speakQuestion]);

  const handleSubmit = async () => {
    if (!currentQuestion || interviewLocked) return;

    let answer = textAnswer;
    let type: "voice" | "text" = answerMode;

    if (answerMode === "voice") {
      if (transcript) {
        answer = transcript;
      } else {
        const audioB64 = await getAudioBase64();
        if (audioB64) {
          try {
            const res = await fetchWithTimeout(
              `${AI_SERVICE_URL}/speech-to-text`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-AI-Service-Key": AI_SERVICE_KEY,
                },
                body: JSON.stringify({ audio: audioB64 }),
              },
              15000
            );
            const data = await res.json();
            if (data.text) answer = data.text;
          } catch {
            answer = textAnswer || "(voice recorded)";
          }
        }
      }
    }

    const timeTaken = questionTimerRef.current?.getElapsed() || 0;
    // Audio measurements for the report's communication analysis. An answer that was spoken and then
    // submitted unedited after stopping the recorder is still a voice answer.
    const speech = getSpeechMetrics();
    const squash = (t: string) => t.replace(/\s+/g, " ").trim();
    if (speech && transcript && squash(answer) === squash(transcript)) type = "voice";
    await submitAnswer(answer, type, timeTaken, type === "voice" ? speech : undefined);
    setTextAnswer("");
    resetRecording();
  };

  const handleSkip = async () => {
    if (interviewLocked) return;
    await skipQuestion();
    setTextAnswer("");
    resetRecording();
  };

  const handleTimeUp = () => {
    handleSubmit();
  };

  const handleVoiceToggle = async () => {
    if (answerMode === "text") {
      const ok = await startRecording();
      if (ok) {
        setAnswerMode("voice");
      }
    } else {
      stopRecording();
      setAnswerMode("text");
    }
  };

  useEffect(() => {
    if (terminated) {
      handleEndInterview("violation");
    }
  }, [terminated]);

  useEffect(() => {
    if (isComplete) {
      handleEndInterview("complete");
    }
  }, [isComplete]);

  const handleOverallTimeUp = () => {
    handleEndInterview("timeout");
  };

  const handleEndInterview = async (reason: "complete" | "manual" | "violation" | "timeout" = "manual") => {
    // Deliberate exits from fullscreen below must not count as violations.
    setEnding(true);
    fs.expectExit();
    overallTimerRef.current?.stop();
    questionTimerRef.current?.stop();
    if (isRecording) stopRecording();
    stopProctorCapture();
    if (reason !== "complete") {
      await terminateInterview(reason === "timeout" ? "TIME_LIMIT_REACHED" : undefined);
    }
    stopWebcam();
    await fs.exit();

    if (reason === "violation") {
      clearTabSwitchSession(interviewId);
      fs.clearSession(interviewId);
      clearActiveInterview();
      navigate("/", { state: { interviewTerminated: true } });
      return;
    }

    const report = await getReport();
    clearTabSwitchSession(interviewId);
    fs.clearSession(interviewId);
    clearActiveInterview();
    const reportId = report?.report?._id || interviewId;
    navigate(`/mock-interview/result/${reportId}`, {
      state: { report, config },
    });
  };

  if (!config) return null;

  const overallSeconds = (() => {
    if (!isCollege) return config.totalQuestions * 150;
    const total = (config.timeLimitMinutes || 30) * 60;
    if (resume?.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(resume.startedAt).getTime()) / 1000);
      return Math.max(30, total - elapsed);
    }
    return total;
  })();

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full"
        >
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-700">
            <h1 className="text-3xl font-bold text-white mb-6 text-center">
              {resume ? "Resume Interview" : isCollege ? config.name || "College Interview" : "Interview Setup"}
            </h1>

            {isCollege && (
              <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100 space-y-1">
                {config.collegeName && (
                  <p>
                    <span className="text-blue-300">College:</span> {config.collegeName}
                  </p>
                )}
                <p>
                  <span className="text-blue-300">Questions:</span> {config.totalQuestions}
                  {config.programmingLanguage && config.programmingLanguage !== "None" && (
                    <>
                      {" "}
                      · <span className="text-blue-300">Language:</span> {config.programmingLanguage}
                    </>
                  )}
                </p>
                {config.description && <p className="text-blue-200/80">{config.description}</p>}
              </div>
            )}

            {resume && (
              <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                Your interview is still in progress. Your violation counts were kept: full-screen exits{" "}
                <b>{resume.fullScreenExitCount}/3</b>. Return to full-screen to continue.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Role</h3>
                <p className="text-white font-semibold">{config.jobRole}</p>
              </div>
              {isCollege ? (
                <div className="bg-gray-700/30 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Time limit</h3>
                  <p className="text-white font-semibold">{config.timeLimitMinutes} minutes</p>
                </div>
              ) : (
                <div className="bg-gray-700/30 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Experience</h3>
                  <p className="text-white font-semibold capitalize">{config.experienceLevel}</p>
                </div>
              )}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Type</h3>
                <p className="text-white font-semibold">{config.interviewType}</p>
              </div>
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Difficulty</h3>
                <p className="text-white font-semibold">{config.difficulty}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Camera & Microphone</h3>
                {webcamPhase !== "ready" ? (
                  <button
                    onClick={handlePermission}
                    disabled={webcamPhase === "initializing"}
                    className="w-full px-4 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {webcamPhase === "initializing"
                      ? "Starting camera…"
                      : webcamPhase === "error"
                      ? "Try Again"
                      : "Grant Camera & Microphone Access"}
                  </button>
                ) : (
                  <StatusIndicator
                    items={[
                      { label: "Camera", active: status.camera },
                      { label: "Microphone", active: status.microphone },
                      { label: "Internet", active: status.internet },
                    ]}
                  />
                )}
              </div>

              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Full Screen</h3>
                {fs.isFullscreen ? (
                  <p className="text-emerald-400 text-sm font-medium">✓ Full-screen mode is active</p>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={async () => setFsBlocked(!(await fs.enter()))}
                      className="w-full px-4 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                      Enter Full Screen
                    </button>
                    <p className="text-xs text-gray-400">
                      The interview runs in full-screen mode and starts once it is active. Leaving full-screen 3 times
                      terminates the interview.
                    </p>
                    {fsBlocked && (
                      <p className="text-xs text-red-300">
                        Your browser blocked full-screen. Click "Enter Full Screen" again — it must come from a click —
                        or allow full-screen for this site.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(webcamPhase === "initializing" || webcamPhase === "ready") && (
                <div className="mb-4">
                  <SetupWebcamPreview
                    videoRef={videoRef}
                    streamRef={streamRef}
                    cameraOn={status.camera}
                    microphoneOn={status.microphone}
                    internetOn={status.internet}
                    cheatingCount={0}
                  />
                </div>
              )}

              {webcamError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm space-y-2">
                  <p className="font-semibold">
                    {webcamErrorKind === "permission-denied"
                      ? "Camera / microphone permission blocked"
                      : webcamErrorKind === "device-not-found"
                      ? "No camera found"
                      : webcamErrorKind === "device-busy"
                      ? "Camera is in use by another app"
                      : webcamErrorKind === "timeout"
                      ? "Camera timed out while starting"
                      : webcamErrorKind === "no-frames"
                      ? "Camera started but sent no video"
                      : webcamErrorKind === "overconstrained"
                      ? "Camera settings not supported"
                      : webcamErrorKind === "insecure-context"
                      ? "Insecure page — camera unavailable"
                      : "Camera could not start"}
                  </p>
                  <p className="text-red-300/90">{webcamError}</p>
                  <p className="text-red-300/60 text-xs">
                    Still stuck? Open{" "}
                    <a
                      href="/webcam-diagnostic.html"
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-red-200"
                    >
                      /webcam-diagnostic.html
                    </a>{" "}
                    for a step-by-step camera check.
                  </p>
                  {webcamErrorKind !== "insecure-context" && webcamErrorKind !== "unsupported" && (
                    <button
                      onClick={() => retryWebcam()}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-xs font-medium transition-colors"
                    >
                      Retry camera
                    </button>
                  )}
                </div>
              )}

              {webcamPhase === "ready" && status.camera && !status.microphone && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-300 text-sm">
                  Camera is working but no microphone was detected. You can still start —
                  answer questions using text mode.
                </div>
              )}

              {webcamPhase === "ready" && status.camera && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <h3 className="font-semibold text-emerald-400 mb-2">Interview Rules</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Stay visible in the camera frame</li>
                    <li>• Do not switch tabs or minimize window</li>
                    <li>• Stay in full-screen mode: leaving it 3 times terminates the interview</li>
                    <li>• Copy/Paste actions are prohibited</li>
                    <li>• Tab switching: 3 warnings → auto terminate</li>
                    <li>• Other violations: 3 max then terminate</li>
                    <li>• You can answer via voice or text</li>
                  </ul>
                </div>
              )}

              {webcamPhase === "ready" && status.camera && (
                <button
                  onClick={handleStartInterview}
                  disabled={loading || !resumeChecked}
                  className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {loading ? "Starting..." : resume ? "Resume Interview →" : "Start Interview →"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4">
      {/* Purely decorative ambient background - CSS only (no WebGL canvas
          here deliberately, given webcam capture + proctoring frame analysis
          already run on this page). pointer-events-none and z-0 so it can
          never intercept a click or sit above the webcam/warning UI. */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="glow-orb absolute -top-24 -left-16 w-72 h-72 bg-violet-600/10" />
        <div className="glow-orb absolute bottom-0 right-0 w-72 h-72 bg-cyan-500/10" />
      </div>
      <div className="relative z-10">
      <WarningOverlay
        warnings={proctorWarnings}
        cheatingCount={cheatingCount}
        maxViolations={3}
        onDismiss={dismissWarning}
      />

      <TabSwitchGuardModal
        warningCount={activeTabWarning}
        terminated={tabTerminated}
        onReturn={() => setActiveTabWarning(0)}
        onGoToResult={() => navigate("/mock-interview/dashboard")}
      />

      <FullscreenGuardModal
        warningCount={activeFsWarning}
        terminated={fsTerminated}
        enterFailed={fsEnterFailed}
        onReturn={async () => {
          const ok = await fs.enter();
          setFsEnterFailed(!ok);
          if (ok) setActiveFsWarning(0);
        }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── QUESTION SYSTEM ─ AI question generation, display, answering.
              Fails/loads entirely on its own; holds zero proctoring state. */}
          <QuestionPanel
            questionsStatus={questionsStatus}
            currentQuestion={currentQuestion}
            loading={loading}
            error={interviewError}
            errorKind={interviewErrorKind}
            genTakingLong={genTakingLong}
            questionIndex={questionIndex}
            totalQuestions={totalQuestions}
            onRetry={retryStartInterview}
            answerMode={answerMode}
            onSelectTextMode={() => {
              setAnswerMode("text");
              if (isRecording) stopRecording();
            }}
            onVoiceToggle={handleVoiceToggle}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            recordingDuration={recordingDuration}
            textAnswer={textAnswer}
            onTextAnswerChange={setTextAnswer}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            locked={interviewLocked || ending}
          />

          {/* ── PROCTORING SYSTEM ─ webcam + frame capture + WebSocket.
              Sibling of the question panel; never nested under it. */}
          <div className="space-y-3">
            <ProctoringPanel
              videoRef={videoRef}
              streamRef={streamRef}
              cameraOn={status.camera}
              microphoneOn={status.microphone}
              internetOn={status.internet}
              proctorStatus={proctorStatus}
              proctorStalled={proctorStalled}
              proctorResult={proctorResult}
              cheatingCount={cheatingCount}
            />

            <div className="grid grid-cols-2 gap-3">
              <Timer
                ref={overallTimerRef}
                totalSeconds={overallSeconds}
                onTimeUp={isCollege ? handleOverallTimeUp : undefined}
                label="Overall Timer"
              />
              <Timer
                ref={questionTimerRef}
                totalSeconds={120}
                onTimeUp={handleTimeUp}
                label="Question Timer"
              />
            </div>

            <ProgressBar
              current={questionIndex}
              total={totalQuestions}
              label="Progress"
            />

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Interview Status
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Questions</span>
                  <span className="text-white">{questionIndex}/{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mode</span>
                  <span className="text-white capitalize">{answerMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tab Switches</span>
                  <span className={tabSwitchCount > 0 ? "text-red-400 font-semibold" : "text-white"}>
                    {tabSwitchCount}/3
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Full-screen exits</span>
                  <span className={fs.exitCount > 0 ? "text-red-400 font-semibold" : "text-white"}>
                    {fs.exitCount}/3
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleEndInterview("manual")}
              className="w-full px-4 py-3 bg-red-500/10 text-red-400 rounded-xl font-medium border border-red-500/20 hover:bg-red-500/20 transition-all text-sm"
            >
              End Interview Early
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
