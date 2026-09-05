import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWebcam } from "../hooks/useWebcam";
import { useMicrophone } from "../hooks/useMicrophone";
import { useInterview } from "../hooks/useInterview";
import { useProctoring } from "../hooks/useProctoring";
import { WarningOverlay } from "../components/interview/WarningOverlay";
import { ProctoringPanel } from "../components/interview/ProctoringPanel";
import { QuestionPanel } from "../components/interview/QuestionPanel";
import { Timer, type TimerHandle } from "../components/mock-interview/Timer";
import { ProgressBar } from "../components/mock-interview/ProgressBar";
import { StatusIndicator } from "../components/mock-interview/StatusIndicator";
import { WebcamPreview as SetupWebcamPreview } from "../components/mock-interview/WebcamPreview";
import { AI_SERVICE_URL, AI_SERVICE_KEY } from "../config/config";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

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

  const handleStartInterview = async () => {
    if (!config) return;
    setShowInstructions(false);

    const id = await startInterview({
      jobRole: config.jobRole,
      experienceLevel: config.experienceLevel,
      interviewType: config.interviewType,
      difficulty: config.difficulty,
      totalQuestions: config.totalQuestions,
    });

    if (id && overallTimerRef.current) {
      overallTimerRef.current.reset();
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
    if (!currentQuestion) return;

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
    await submitAnswer(answer, type, timeTaken);
    setTextAnswer("");
    resetRecording();
  };

  const handleSkip = async () => {
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

  const handleEndInterview = async (reason: "complete" | "manual" | "violation" = "manual") => {
    stopProctorCapture();
    if (reason !== "complete") {
      await terminateInterview();
    }
    stopWebcam();

    if (reason === "violation") {
      navigate("/", { state: { interviewTerminated: true } });
      return;
    }

    const report = await getReport();
    const reportId = report?.report?._id || interviewId;
    navigate(`/mock-interview/result/${reportId}`, {
      state: { report, config },
    });
  };

  if (!config) return null;

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
              Interview Setup
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Role</h3>
                <p className="text-white font-semibold">{config.jobRole}</p>
              </div>
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Experience</h3>
                <p className="text-white font-semibold capitalize">{config.experienceLevel}</p>
              </div>
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
                    <li>• Stay in fullscreen mode</li>
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
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {loading ? "Starting..." : "Start Interview →"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4">
      <WarningOverlay
        warnings={proctorWarnings}
        cheatingCount={cheatingCount}
        maxViolations={3}
        onDismiss={dismissWarning}
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
                totalSeconds={config.totalQuestions * 150}
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
  );
}
