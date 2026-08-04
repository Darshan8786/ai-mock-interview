import { Request, Response } from "express";
import { getQuestionModel } from "../models/Question";

export async function validateAnswersController(req: Request, res: Response) {
  try {
    const { subject, answers } = req.body;
    // @ts-ignore
    const userId = req.userId;

    if (!subject || !answers || typeof answers !== 'object') {
      return res.status(400).json({ 
        message: "subject and answers object required" 
      });
    }

    const QuestionModel = getQuestionModel(subject);
    const correctness: Record<string, boolean> = {};
    const correctAnswers: Record<string, string> = {};

    for (const [questionId, selectedOption] of Object.entries(answers)) {
      try {
        const question = await QuestionModel.findById(questionId);
        if (question) {
          const isCorrect = question.correctAnswer === selectedOption;
          correctness[questionId] = isCorrect;
          correctAnswers[questionId] = question.correctAnswer;
        } else {
          correctness[questionId] = false;
          correctAnswers[questionId] = "Question not found";
        }
      } catch (error) {
        correctness[questionId] = false;
        correctAnswers[questionId] = "Error processing question";
      }
    }

    res.status(200).json({ 
      correctness,
      correctAnswers,
      totalQuestions: Object.keys(answers).length,
      correctCount: Object.values(correctness).filter(Boolean).length
    });

  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({ message: "Server Error", error: "Internal server error" });
  }
}
