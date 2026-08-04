import type { Request, Response } from "express";
import mongoose from "mongoose";
import { AttemptModel } from "../db";
import { fetchYouTubeTutorials, formatDuration } from "../utils/youtubeService";
import { getDocumentationForSubject } from "../utils/documentationService";

interface WeakSubject {
    subject: string;
    accuracy: number;
    correctCount: number;
    totalCount: number;
}

interface Resource {
    subject: string;
    accuracy: number;
    tutorials: any[];
    documentation: any[];
}

/**
 * Get learning resources for weak subjects (< 50% accuracy)
 * Includes YouTube tutorials and official documentation
 */
export async function getLearningResources(req: Request, res: Response) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).userId as string | undefined;

    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // Get subject-wise attempt statistics
        const subjectData = await AttemptModel.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: "$subject",
                    correctCount: {
                        $sum: {
                            $cond: [{ $eq: ["$correct", true] }, 1, 0],
                        },
                    },
                    totalCount: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Identify weak subjects (< 50% accuracy)
        const weakSubjects: WeakSubject[] = subjectData
            .map((item) => {
                const accuracy = item.totalCount > 0
                    ? Math.round((item.correctCount / item.totalCount) * 100)
                    : 0;
                return {
                    subject: item._id || "Unknown",
                    accuracy,
                    correctCount: item.correctCount,
                    totalCount: item.totalCount,
                };
            })
            .filter((item) => item.accuracy < 50); // Only weak subjects

        // Fetch resources for each weak subject
        const resources: Resource[] = await Promise.all(
            weakSubjects.map(async (weak) => {
                try {
                    const [tutorials, documentation] = await Promise.all([
                        fetchYouTubeTutorials(weak.subject, weak.subject),
                        Promise.resolve(getDocumentationForSubject(weak.subject)),
                    ]);

                    return {
                        subject: weak.subject,
                        accuracy: weak.accuracy,
                        tutorials: tutorials.map((tutorial) => ({
                            id: tutorial.id,
                            title: tutorial.title,
                            channelTitle: tutorial.channelTitle,
                            description: tutorial.description,
                            thumbnailUrl: tutorial.thumbnailUrl,
                            videoUrl: `https://www.youtube.com/${tutorial.id}`,
                            duration: formatDuration(tutorial.duration),
                            viewCount: tutorial.viewCount.toLocaleString(),
                        })),
                        documentation,
                    };
                } catch (error) {
                    console.error(`Error fetching resources for ${weak.subject}:`, error);
                    return {
                        subject: weak.subject,
                        accuracy: weak.accuracy,
                        tutorials: [],
                        documentation: [],
                    };
                }
            })
        );

        return res.json({
            weakSubjects: weakSubjects.map((w) => ({
                subject: w.subject,
                accuracy: w.accuracy,
                correctCount: w.correctCount,
                totalCount: w.totalCount,
            })),
            resources: resources.filter((r) => r.tutorials.length > 0 || r.documentation.length > 0),
        });
    } catch (error) {
        console.error("Error fetching learning resources:", error);
        return res.status(500).json({ error: "Failed to fetch learning resources" });
    }
}

/**
 * Get resources for a specific subject
 */
export async function getResourcesForSubject(req: Request, res: Response) {
    const { subject } = req.params;

    if (!subject) {
        return res.status(400).json({ error: "Subject parameter is required" });
    }

    try {
        const [tutorials, documentation] = await Promise.all([
            fetchYouTubeTutorials(subject, subject),
            Promise.resolve(getDocumentationForSubject(subject)),
        ]);

        return res.json({
            subject,
            tutorials: tutorials.map((tutorial) => ({
                id: tutorial.id,
                title: tutorial.title,
                channelTitle: tutorial.channelTitle,
                description: tutorial.description,
                thumbnailUrl: tutorial.thumbnailUrl,
                videoUrl: `https://www.youtube.com/${tutorial.id}`,
                duration: formatDuration(tutorial.duration),
                viewCount: tutorial.viewCount.toLocaleString(),
            })),
            documentation,
        });
    } catch (error) {
        console.error(`Error fetching resources for ${subject}:`, error);
        return res.status(500).json({ error: "Failed to fetch resources" });
    }
}
