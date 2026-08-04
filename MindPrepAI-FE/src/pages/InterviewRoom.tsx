import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWebcam } from "../hooks/useWebcam";
import { useMicrophone } from "../hooks/useMicrophone";
import { useProctoring } from "../hooks/useProctoring";
import { useInterview } from "../hooks/useInterview";
import { WebcamPreview } from "../components/interview/WebcamPreview";
import { WarningOverlay } from "../components/interview/WarningOverlay";
import { CheatingCounter } from "../components/interview/CheatingCounter";
import { InterviewMonitor } from "../components/interview/InterviewMonitor";
import { Timer, type TimerHandle } from "../components/mock-interview/Timer";
import { QuestionCard } from "../components/mock-interview/QuestionCard";
import { ProgressBar } from "../components/mock-interview/ProgressBar";
import { StatusIndicator } from "../components/mock-interview/StatusIndicator";
import { WebcamPreview as SetupWebcamPreview } from "../components/mock-interview/WebcamPreview";

export function InterviewRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state as any;

  const {
    videoRef,
    streamRef,
    status,
    error: webcamError,
    startWebcam,
    stopWebcam,
    captureFrame,
  } = useWebcam();

  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    getAudioBase64,
    resetRecording,
  } = useMicrophone();

  const {
    currentQuestion,
    isComplete,
    loading,
    error: interviewError,
    lastEvaluation,
    startInterview,
    submitAnswer,
    skipQuestion,
    terminateInterview,
    getReport,
    clearLastEvaluation,
    interviewId,
  } = useInterview();

  const {
    status: proctorStatus,
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
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const questionTimerRef = useRef<TimerHandle>(null);
  const overallTimerRef = useRef<TimerHandle>(null);

  const [showEvaluation, setShowEvaluation] = useState(false);

  useEffect(() => {
    if (!config) {
      navigate("/mock-interview/setup");
    } else {
      setTotalQuestions(config.totalQuestions || 5);
    }
  }, [config, navigate]);

  const handlePermission = async () => {
    const stream = await startWebcam();
    if (stream) {
      setPermissionGranted(true);
    }
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

    startCapture(captureFrame);
  };

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

  const speakQuestion = useCallback(async (text: string) => {
    try {
      const res = await fetch("http://localhost:5001/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Service-Key": "mindprep-ai-key-2026",
        },
        body: JSON.stringify({ text }),
      });
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
      const audioB64 = await getAudioBase64();
      if (audioB64) {
        try {
          const res = await fetch("http://localhost:5001/speech-to-text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AI-Service-Key": "mindprep-ai-key-2026",
            },
            body: JSON.stringify({ audio: audioB64 }),
          });
          const data = await res.json();
          if (data.text) answer = data.text;
        } catch {
          answer = textAnswer || "(voice recorded)";
        }
      }
    }

    const timeTaken = questionTimerRef.current?.getElapsed() || 0;
    await submitAnswer(answer, type, timeTaken);
    setTextAnswer("");
    resetRecording();
    setShowEvaluation(true);
  };

  const handleNextQuestion = () => {
    setShowEvaluation(false);
    clearLastEvaluation();
  };

  const handleSkip = async () => {
    await skipQuestion();
    setTextAnswer("");
    resetRecording();
    setShowEvaluation(false);
    clearLastEvaluation();
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
      handleEndInterview();
    }
  }, [terminated]);

  useEffect(() => {
    if (isComplete) {
      handleEndInterview();
    }
  }, [isComplete]);

  const handleEndInterview = async () => {
    stopProctorCapture();
    await terminateInterview();
    stopWebcam();

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
                {!permissionGranted ? (
                  <button
                    onClick={handlePermission}
                    className="w-full px-4 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    Grant Camera & Microphone Access
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

              <div className={`mb-4 ${permissionGranted ? "" : "hidden"}`}>
                <SetupWebcamPreview
                  videoRef={videoRef}
                  streamRef={streamRef}
                  cameraOn={status.camera}
                  microphoneOn={status.microphone}
                  internetOn={status.internet}
                  cheatingCount={0}
                />
              </div>

              {webcamError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                  {webcamError}
                </div>
              )}

              {permissionGranted && status.camera && status.microphone && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <h3 className="font-semibold text-emerald-400 mb-2">Interview Rules</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Stay visible in the camera frame</li>
                    <li>• Do not switch tabs or minimize window</li>
                    <li>• Stay in fullscreen mode</li>
                    <li>• Copy/Paste actions are prohibited</li>
                    <li>• Tab switching: 2 warnings → auto terminate</li>
                    <li>• Other violations: 3 max then terminate</li>
                    <li>• You can answer via voice or text</li>
                  </ul>
                </div>
              )}

              {permissionGranted && status.camera && status.microphone && (
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
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {currentQuestion && (
                <QuestionCard
                  key={questionIndex}
                  question={currentQuestion.question}
                  questionNumber={questionIndex + 1}
                  totalQuestions={totalQuestions}
                />
              )}
            </AnimatePresence>

            {interviewError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {interviewError}
              </div>
            )}

            {currentQuestion && !showEvaluation && (
              <motion.div
                key={`answer-${questionIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
              >
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleVoiceToggle}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isRecording
                        ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
                        : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {isRecording ? "🔴 Recording..." : "🎤 Voice"}
                  </button>
                  <button
                    onClick={() => {
                      setAnswerMode("text");
                      if (isRecording) stopRecording();
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      answerMode === "text" && !isRecording
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                        : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    ⌨️ Text
                  </button>
                </div>

                {answerMode === "text" && (
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full h-32 bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                )}

                {isRecording && (
                  <div className="flex items-center gap-3 bg-gray-700/30 rounded-xl px-4 py-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-gray-300 text-sm">
                      Recording... {recordingDuration}s
                    </span>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || (!textAnswer && !isRecording && answerMode === "text")}
                    className="flex-1 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                  >
                    {loading ? "Submitting..." : "Submit Answer"}
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-medium border border-gray-600 hover:border-gray-500 transition-all"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {showEvaluation && lastEvaluation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-gray-800 to-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
              >
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 mb-2"
                  >
                    <span className="text-2xl font-bold text-white">
                      {Math.round(
                        (lastEvaluation.technicalScore +
                          lastEvaluation.communicationScore +
                          lastEvaluation.confidenceScore +
                          lastEvaluation.grammarScore +
                          lastEvaluation.fluencyScore) /
                          5
                      )}
                    </span>
                  </motion.div>
                  <h3 className="text-lg font-semibold text-white">Question {questionIndex} Score</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <ScoreBadge label="Technical" score={lastEvaluation.technicalScore} />
                  <ScoreBadge label="Communication" score={lastEvaluation.communicationScore} />
                  <ScoreBadge label="Confidence" score={lastEvaluation.confidenceScore} />
                  <ScoreBadge label="Grammar" score={lastEvaluation.grammarScore} />
                  <ScoreBadge label="Fluency" score={lastEvaluation.fluencyScore} />
                  <ScoreBadge label="Relevance" score={lastEvaluation.relevanceScore} />
                </div>

                {lastEvaluation.feedback && (
                  <div className="bg-gray-700/30 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-300 italic">"{lastEvaluation.feedback}"</p>
                  </div>
                )}

                <button
                  onClick={handleNextQuestion}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  {currentQuestion ? "Next Question →" : "View Results"}
                </button>
              </motion.div>
            )}
          </div>

          <div className="space-y-3">
            <WebcamPreview
              videoRef={videoRef}
              streamRef={streamRef}
              status={proctorStatus}
              cameraOn={status.camera}
              microphoneOn={status.microphone}
              internetOn={status.internet}
              cheatingCount={cheatingCount}
              warnings={proctorWarnings}
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

            <InterviewMonitor status={proctorStatus} result={proctorResult} />
            <CheatingCounter count={cheatingCount} maxCount={3} />

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
              onClick={handleEndInterview}
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

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    score >= 60 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-3 text-center border ${color}`}
    >
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold">{score}</p>
    </motion.div>
  );
}
