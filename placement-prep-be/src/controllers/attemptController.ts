import { Request, Response } from "express";
import { getQuestionModel } from "../models/Question";
import { AttemptModel } from "../db";

export async function attemptController(req: Request, res: Response) {
  try {
    const { questionId, selectedOption, subject } = req.body;
    // @ts-ignore
    const userId = req.userId;

    if (!questionId || !selectedOption || !subject) {
      return res.status(400).json({ message: "questionId, selectedOption, subject required" });
    }

    const QuestionModel = getQuestionModel(subject);

    const question = await QuestionModel.findById(questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });

    const alreadyAttempted = await AttemptModel.findOne({ userId, questionId });
    if (alreadyAttempted) return res.status(409).json({ message: "Question already attempted" });

    const correct = question.correctAnswer === selectedOption;

    await AttemptModel.create({ userId, questionId, selectedOption, correct, subject, topic: question.topic });

    res.status(200).json({
      correct,
      correctAnswer: question.correctAnswer
    });

  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
