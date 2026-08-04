import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL } from "../config/config";

interface Question {
  _id: string;
  question: string;
  options: string[];
  // difficulty: string;
  // topic: string;
}

interface QuizState {
  currentIndex: number;
  answers: Record<string, string>;
  correctness: Record<string, boolean>;
  correctAnswers: Record<string, string>;
  showResults: boolean;
  score: number;
}

export function QuizPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { questions, subjectPath } = location.state as { questions: Question[]
  subjectPath: string;
   };

  const [quizState, setQuizState] = useState<QuizState>({
    currentIndex: 0,
    answers: {},
    correctness: {},
    correctAnswers: {},
    showResults: false,
    score: 0,
  });

  const currentQuestion = questions[quizState.currentIndex];
  const token = localStorage.getItem("token");

  // ✅ Just store user answer, don’t validate yet
  const handleAnswerSelect = (selectedOption: string) => {
    setQuizState(prev => ({
      ...prev,
      answers: { ...prev.answers, [currentQuestion._id]: selectedOption }
    }));
  };

  // ✅ At the end, validate all answers and record attempts
  const handleFinish = async () => {
    if (!token) return alert("Please login first");

    try {
      // First validate all answers
      const res = await axios.post(`${BACKEND_URL}/v1/quiz/validate`, {
        subject: subjectPath,
        answers: quizState.answers   // send all answers to backend
      }, {
        headers: { token }
      });
      console.log("res", res)

      const { correctness, correctAnswers } = res.data; // e.g. { qid1: true, qid2: false, ... }
      const score = Object.values(correctness).filter(Boolean).length;

      // Record attempts for each question to prevent repetition
      for (const [questionId, selectedOption] of Object.entries(quizState.answers)) {
        try {
          await axios.post(`${BACKEND_URL}/v1/quiz/attempt`, {
            questionId,
            selectedOption,
            subject: subjectPath
          }, {
            headers: { token }
          });
        } catch (attemptErr: any) {
          // If question already attempted, that's fine - just log it
          if (attemptErr.response?.status !== 409) {
            console.error("Error recording attempt:", attemptErr.response?.data || attemptErr.message);
          }
        }
      }

      setQuizState(prev => ({
        ...prev,
        correctness,
        correctAnswers,
        score,
        showResults: true
      }));

    } catch (err: any) {
      console.error(err.response?.data || err.message);
    }
  };

  const handleNext = () => {
    if (quizState.currentIndex + 1 < questions.length) {
      setQuizState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (quizState.currentIndex > 0) {
      setQuizState(prev => ({ ...prev, currentIndex: prev.currentIndex - 1 }));
    }
  };

  if (quizState.showResults) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl text-white font-bold text-center">🎉 Quiz Complete! 🎉</h1>
          <p className="text-white text-center text-2xl">
            Score: {quizState.score}/{questions.length} (
            {Math.round((quizState.score / questions.length) * 100)}%)
          </p>

          <div className="space-y-4">
            {questions.map((q, idx) => {
              const userAnswer = quizState.answers[q._id];
              const correct = quizState.correctness[q._id];

              return (
                <div key={q._id} className="p-4 border rounded-xl bg-white">
                  <h3 className="font-semibold">Q{idx + 1}: {q.question}</h3>
                  <p className={`${correct ? "text-green-700" : "text-red-700"}`}>
                    Your answer: {userAnswer || "Not answered"} {correct ? "✓" : "✗"}
                  </p>
                  <p className="text-gray-600">
                    Correct answer: {quizState.correctAnswers[q._id] || "Unknown"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-xl
              cursor-pointer transistion duration-200 ease-in-out
            hover:bg-blue-900 active:scale-95"
              onClick={() => navigate(-1)}
            >
              Back to Home Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Allow reselection: no disable
  const getOptionClass = (option: string) => {
    const selected = quizState.answers[currentQuestion._id] === option;
    return selected
      ? "border-blue-500 bg-blue-50"
      : "border-gray-300 hover:border-blue-400 hover:bg-blue-50";
  };

  return (
    <div className="min-h-screen p-6 flex justify-center items-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="p-4 bg-white rounded-xl shadow flex justify-between">
          <p>Question {quizState.currentIndex + 1} of {questions.length}</p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow space-y-4">
          <h2 className="text-xl font-semibold">{currentQuestion.question}</h2>

          <div className="space-y-2">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${getOptionClass(option)}
                cursor-pointer active:scale-95`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-4">
            <button
              onClick={handlePrevious}
              disabled={quizState.currentIndex === 0}
              className="px-4 py-2 bg-gray-600 text-white rounded-xl disabled:opacity-50 cursor-pointer transistion duration-200 ease-in-out
            hover:bg-gray-900 active:scale-95"
            >
              Previous
            </button>

            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl cursor-pointer transistion duration-200 ease-in-out
            hover:bg-blue-800 active:scale-95"
            >
              {quizState.currentIndex + 1 === questions.length ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
