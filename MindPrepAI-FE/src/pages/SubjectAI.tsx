import { useState, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../config/config";
import toast from "react-hot-toast";

export function SubjectAI() {
  const location = useLocation();
  const state = location.state as { data?: any };

  const data = state?.data;
  const subject = data?.subject || "Unknown Subject";
  const questions: string[] = data?.questions || [];

  if (!data || !questions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-xl text-white mb-4">
          No questions found. Please go back and try again.
        </h2>
      </div>
    );
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  // @ts-ignore
  const [allTranscripts, setAllTranscripts] = useState<string[]>([]);
  // @ts-ignore
  const [score, setScore] = useState<number | null>(null);
  // @ts-ignore
  const [feedback, setFeedback] = useState<string | null>(null);
  const [allScores, setAllScores] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [allFeedback, setAllFeedback] = useState<string[]>([]);
  // @ts-ignore
  const [isLoading, setIsLoading] = useState(false);
  const [isAnsweringLoading, setIsAnsweringLoading] = useState(false);
  const [isFinishingLoading, setIsFinishingLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sessionId = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const handleNext = () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScore(null);
      setFeedback(null);
    }
  };

  // 🎙️ Start or Stop Recording
  const handleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      await sendToBackend(audioBlob);
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const sendToBackend = async (audioBlob: Blob) => {
    setIsAnsweringLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("question", questions[currentIndex]);
      formData.append("index", String(currentIndex));
      formData.append("subject", subject);
      formData.append("sessionId", sessionId);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first");
        return;
      }

      const response = await axios.post(
        `${BACKEND_URL}/v1/genai/subject/answer`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            token,
          },
        }
      );

      const { transcript, score: s, feedback: f } = response.data;
      setAllTranscripts(prev => {
        const copy = [...prev];
        copy[currentIndex] = transcript;
        return copy;
      });
      setScore(s);
      setFeedback(f);
      setAllScores(prev => {
        const copy = [...prev];
        copy[currentIndex] = s;
        return copy;
      });
      setAllFeedback(prev => {
        const copy = [...prev];
        copy[currentIndex] = f;
        return copy;
      });
    } catch (err) {
      console.error("Backend Evaluation Error:", err);
    } finally {
      setIsAnsweringLoading(false);
    }
  };

  const handleFinish = async () => {
    setIsFinishingLoading(true);
    try {
      if (allScores.length !== 3) return;
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first");
        return;
      }
      const res = await axios.post(
        `${BACKEND_URL}/v1/genai/subject/finish`,
        { subject, scores: allScores, sessionId },
        { headers: { token } }
      );
      // Optionally show a toast or summary; the server returns total
      const total = res.data?.total as number;
      // Keep UI minimal
      toast.success(`Interview complete. Final score: ${total}/50`, { duration: 8000 });
      setIsFinished(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFinishingLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <h1 className="text-2xl md:text-3xl text-white font-bold mb-6 text-center">
        {subject} Quiz
      </h1>

      <div className="bg-gray-900 text-white p-6 rounded-lg shadow-lg max-w-xl w-full mb-6 text-center">
        <p className="text-lg md:text-xl">{questions[currentIndex]}</p>
      </div>

      <button
        onClick={handleRecord}
        className={`px-4 py-2 rounded-lg font-bold mb-4 ${recording ? "bg-red-600" : "bg-green-500"
          }`}
        disabled={isAnsweringLoading}
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>

      {isAnsweringLoading && (
        <div className="text-white text-lg font-semibold mb-4">Evaluating...</div>
      )}

      {isFinishingLoading && (
        <div className="text-white text-lg font-semibold mb-4">Finishing Interview...</div>
      )}

      {isFinished && (
        <div className="bg-gray-700 text-white p-4 rounded-lg w-full max-w-xl text-center mt-4">
          <p className="font-semibold">All Scores: {allScores.join(", ")}</p>
          {allFeedback.map((f, index) => (
            <p key={index} className="text-sm opacity-80 mt-1">
              Feedback for question {index + 1}: {f}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-4 mt-4">
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className={`px-4 py-2 rounded-lg font-bold bg-white text-black hover:bg-gray-200`}
            disabled={isAnsweringLoading}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className={`px-4 py-2 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700`}
            disabled={isFinishingLoading}
          >
            Finish & Save
          </button>
        )}
      </div>

      <p className="text-white mt-4">
        Question {currentIndex + 1} of {questions.length}
      </p>
    </div>
  );
}
