import { Request, Response } from "express";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { AttemptModel } from "../db";

// Ensure API Keys are present
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
if (!PINECONE_API_KEY) {
    console.error("❌ CRITICAL: PINECONE_API_KEY is missing in .env");
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error("❌ CRITICAL: OPENAI_API_KEY is missing in .env");
}

const pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY || "dummy-key-to-prevent-crash",
});

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY || "dummy-key-to-prevent-crash",
});

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "mindprep-chatbox";

interface AttemptData {
    _id: string;
    userId: string;
    subject: string;
    topic: string;
    correct: boolean;
    selectedOption: string;
}

export async function syncAttemptsToVectorDB(req: Request, res: Response) {
    try {
        // @ts-ignore
        const userId = req.userId as string;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Fetch all attempts for this user
        const attempts = await AttemptModel.find({ userId }).lean();

        if (attempts.length === 0) {
            return res.status(200).json({
                message: "No attempts found to sync",
                synced: 0,
            });
        }

        const index = pinecone.Index(INDEX_NAME);

        // Group attempts by subject and topic
        const groupedData: {
            [subject: string]: { [topic: string]: AttemptData[] };
        } = {};

        attempts.forEach((attempt: any) => {
            const subject = attempt.subject || "Unknown";
            const topic = attempt.topic || "Unknown";

            if (!groupedData[subject]) {
                groupedData[subject] = {};
            }
            if (!groupedData[subject][topic]) {
                groupedData[subject][topic] = [];
            }
            groupedData[subject][topic].push(attempt);
        });

        let totalSynced = 0;

        // Process each subject and topic
        for (const subject in groupedData) {
            for (const topic in groupedData[subject]) {
                const topicAttempts = groupedData[subject][topic];

                // Create a summary text for vectorization
                const correctCount = topicAttempts.filter((a) => a.correct).length;
                const totalCount = topicAttempts.length;
                const accuracy = Math.round((correctCount / totalCount) * 100);

                const summaryText = `User ${userId} attempted ${totalCount} questions on ${subject} - ${topic}. 
        Correct answers: ${correctCount}. Accuracy: ${accuracy}%. 
        Topics studied: ${subject}. Subtopic: ${topic}.`;

                // Generate embedding using OpenAI
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: summaryText,
                });

                const embedding = embeddingResponse.data[0].embedding;

                // Create unique ID for this user-subject-topic combination
                const vectorId = `${userId}-${subject}-${topic}`;

                // Metadata for the vector
                const metadata = {
                    userId,
                    subject,
                    topic,
                    correctCount,
                    totalCount,
                    accuracy,
                    attemptCount: topicAttempts.length,
                    lastUpdated: new Date().toISOString(),
                };

                // Upsert to Pinecone with namespace for user separation
                await index.namespace(userId).upsert([
                    {
                        id: vectorId,
                        values: embedding,
                        metadata,
                    },
                ]);

                totalSynced++;
            }
        }

        return res.status(200).json({
            message: "Attempts synced successfully to vector database",
            synced: totalSynced,
            userId,
            subjects: Object.keys(groupedData),
        });
    } catch (error: any) {
        console.error("Error syncing to Pinecone:", error);
        return res.status(500).json({
            error: "Failed to sync attempts to vector database",
            details: error.message,
        });
    }
}

export async function getVectorDBStats(req: Request, res: Response) {
    try {
        // @ts-ignore
        const userId = req.userId as string;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const index = pinecone.Index(INDEX_NAME);

        // Get index stats
        const stats = await index.namespace(userId).describeIndexStats();

        return res.status(200).json({
            userId,
            stats,
        });
    } catch (error: any) {
        console.error("Error fetching vector DB stats:", error);
        return res.status(500).json({
            error: "Failed to fetch vector database stats",
            details: error.message,
        });
    }
}

export async function ragQuery(req: Request, res: Response) {
    try {
        // @ts-ignore
        const userId = req.userId as string;
        const { query } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!query || typeof query !== "string" || query.trim() === "") {
            return res.status(400).json({ error: "Query is required and must be a non-empty string" });
        }

        const index = pinecone.Index(INDEX_NAME);

        // Generate embedding for the user query
        const queryEmbedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });

        const queryVector = queryEmbedding.data[0].embedding;

        // Query Pinecone with user's namespace (top 5 results)
        const queryResults = await index.namespace(userId).query({
            vector: queryVector,
            topK: 5,
            includeMetadata: true,
        });

        // Build context from retrieved vectors
        let contextText = "";
        if (queryResults.matches && queryResults.matches.length > 0) {
            contextText = queryResults.matches
                .map((match: any) => {
                    const metadata = match.metadata || {};
                    return `Subject: ${metadata.subject}, Topic: ${metadata.topic}, Correct: ${metadata.correctCount}/${metadata.totalCount}, Accuracy: ${metadata.accuracy}%`;
                })
                .join("\n");
        } else {
            contextText = "No relevant study data found in your history.";
        }

        // Create prompt with context
        const systemPrompt = `You are a helpful study assistant. Based on the user's study history and performance data, provide helpful guidance and answers to their questions. Please be conscise and let the answer be always less than 150 words.
        
        Context from user's study history:
        ${contextText}

        Be encouraging, specific to their weak areas, and provide practical study tips.`;

        // Generate response using OpenAI
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: query,
                },
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const answer = chatCompletion.choices[0].message.content || "Unable to generate response";

        return res.status(200).json({
            query,
            answer,
            context: queryResults.matches ? queryResults.matches.length : 0,
            sources: queryResults.matches?.map((match: any) => ({
                subject: match.metadata?.subject,
                topic: match.metadata?.topic,
                accuracy: match.metadata?.accuracy,
                similarity: match.score,
            })) || [],
        });
    } catch (error: any) {
        console.error("Error in RAG query:", error);
        return res.status(500).json({
            error: "Failed to process query",
            details: error.message,
        });
    }
}
