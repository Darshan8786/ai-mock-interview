import { Request, Response } from "express";
import { AptitudeQuestion } from "../../models/AptitudeQuestion";
import { AptitudeTopic } from "../../models/AptitudeTopic";
import { AptitudeTestConfig } from "../../models/AptitudeTestConfig";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { parsePagination, buildSearch, buildFilter } from "../../utils/queryHelpers";

// ── Questions ─────────────────────────────────────────────

export const getQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);
  const filter = buildFilter(req.query, ["category", "topic", "difficulty", "isActive"]);
  const search = buildSearch(req.query, ["question", "subtopic", "explanation"]);
  if (search) filter.$and = [search];
  if (req.query.tag) filter["companyTags.name"] = req.query.tag;

  const [total, docs] = await Promise.all([
    AptitudeQuestion.countDocuments(filter),
    AptitudeQuestion.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);

  res.json({ status: "success", results: docs.length, total, page, limit, data: docs });
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const q = await AptitudeQuestion.findById(req.params.id).lean();
  if (!q) throw new AppError("Question not found", 404);
  res.json({ status: "success", data: q });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const {
    category,
    topic,
    subtopic,
    difficulty,
    companyTags,
    question,
    options,
    correctAnswer,
    explanation,
    estimatedTime,
  } = req.body;

  if (!category || !topic || !question || !Array.isArray(options) || options.length < 2) {
    throw new AppError("category, topic, question and options (2+) are required", 400);
  }
  if (correctAnswer === undefined || correctAnswer < 0 || correctAnswer >= options.length) {
    throw new AppError("correctAnswer must be a valid option index", 400);
  }

  const doc = await AptitudeQuestion.create({
    category,
    topic,
    subtopic: subtopic || "",
    difficulty: difficulty || "intermediate",
    companyTags: Array.isArray(companyTags) ? companyTags : [],
    question,
    options,
    correctAnswer,
    explanation: explanation || "",
    estimatedTime: Number(estimatedTime || 60),
    createdBy: (req as any).user?._id || null,
  });

  res.status(201).json({ status: "success", data: doc });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { options, correctAnswer } = req.body;
  if (options && Array.isArray(options) && options.length < 2) {
    throw new AppError("options must have at least 2 entries", 400);
  }
  if (correctAnswer !== undefined && options && Array.isArray(options) && correctAnswer >= options.length) {
    throw new AppError("correctAnswer must be a valid option index", 400);
  }
  const doc = await AptitudeQuestion.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new AppError("Question not found", 404);
  res.json({ status: "success", data: doc });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const doc = await AptitudeQuestion.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError("Question not found", 404);
  res.json({ status: "success", data: null });
});

// ── Topics ────────────────────────────────────────────────

export const getAdminTopics = asyncHandler(async (_req: Request, res: Response) => {
  const topics = await AptitudeTopic.find().sort({ order: 1 }).lean();
  const counts = await AptitudeQuestion.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
  ]);
  const countMap: Record<string, number> = {};
  counts.forEach((c) => {
    countMap[`${c._id.category}::${c._id.topic}`] = c.count;
  });
  res.json({
    status: "success",
    data: topics.map((t: any) => ({
      ...t,
      questionCount: countMap[`${t.category}::${t.name}`] || 0,
    })),
  });
});

export const createTopic = asyncHandler(async (req: Request, res: Response) => {
  const { category, name, description } = req.body;
  if (!category || !name) throw new AppError("category and name are required", 400);
  const existing = await AptitudeTopic.findOne({ category, name });
  if (existing) throw new AppError("Topic already exists for this category", 409);
  const count = await AptitudeTopic.countDocuments();
  const doc = await AptitudeTopic.create({ category, name, description: description || "", order: count });
  res.status(201).json({ status: "success", data: doc });
});

export const updateTopic = asyncHandler(async (req: Request, res: Response) => {
  const doc = await AptitudeTopic.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new AppError("Topic not found", 404);
  res.json({ status: "success", data: doc });
});

export const deleteTopic = asyncHandler(async (req: Request, res: Response) => {
  const doc = await AptitudeTopic.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError("Topic not found", 404);
  res.json({ status: "success", data: null });
});

// ── Test configs ──────────────────────────────────────────

export const getAdminTests = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, skip } = parsePagination(req.query);
  const filter = buildFilter(req.query, ["category", "isActive"]);
  const search = buildSearch(req.query, ["title", "description"]);
  if (search) filter.$and = [search];

  const [total, docs] = await Promise.all([
    AptitudeTestConfig.countDocuments(filter),
    AptitudeTestConfig.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  res.json({ status: "success", results: docs.length, total, page, limit, data: docs });
});

export const createAdminTest = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, category, topics, difficulty, questionCount, durationMinutes, marksPerQuestion, negativeMarksPerQuestion, passingScore, shuffle, isActive } = req.body;
  if (!title || !questionCount) throw new AppError("title and questionCount are required", 400);
  const doc = await AptitudeTestConfig.create({
    title,
    description: description || "",
    category: category || "",
    topics: Array.isArray(topics) ? topics : [],
    difficulty: difficulty || "",
    questionCount: Number(questionCount),
    durationMinutes: Number(durationMinutes || 20),
    marksPerQuestion: Number(marksPerQuestion ?? 1),
    negativeMarksPerQuestion: Number(negativeMarksPerQuestion || 0),
    passingScore: Number(passingScore ?? 50),
    shuffle: shuffle !== false,
    isActive: isActive !== false,
    createdBy: (req as any).user?._id || null,
  });
  res.status(201).json({ status: "success", data: doc });
});

export const updateAdminTest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await AptitudeTestConfig.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new AppError("Test not found", 404);
  res.json({ status: "success", data: doc });
});

export const deleteAdminTest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await AptitudeTestConfig.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError("Test not found", 404);
  res.json({ status: "success", data: null });
});
