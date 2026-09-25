import { upsertVector, queryVectors } from "./vectorStore";
import { embedText } from "./embeddingService";

/**
 * Store a completed mock interview as a searchable vector in the user's
 * namespace (same namespace as the quiz chat assistant). Backed by Pinecone
 * when configured, otherwise a local MongoDB-based store — see vectorStore.ts.
 */
export async function syncInterviewToVectorDB(userId: string, interview: any) {
  try {
    const answered = (interview.questions || []).filter(
      (q: any) => q.evaluation && !q.skipped
    );
    const summaryText = [
      `User ${userId} completed a ${interview.difficulty} level ${interview.interviewType} mock interview for ${interview.jobRole}.`,
      `Overall score: ${interview.overallScore}. Technical: ${interview.technicalScore}, Communication: ${interview.communicationScore}, Confidence: ${interview.confidenceScore}, Grammar: ${interview.grammarScore}, Fluency: ${interview.fluencyScore}.`,
      `Questions answered: ${answered.length} of ${interview.totalQuestions}.`,
      `Weaknesses: ${(interview.weaknesses || []).join("; ")}.`,
      `Areas to improve: ${(interview.areasToImprove || []).join("; ")}.`,
    ].join(" ");

    const vector = await embedText(summaryText);
    await upsertVector(userId, `interview-${interview._id}`, vector, {
      userId,
      type: "interview",
      subject: "Mock Interview",
      topic: interview.jobRole || "General",
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      overallScore: interview.overallScore,
      technicalScore: interview.technicalScore,
      communicationScore: interview.communicationScore,
      correctCount: answered.length,
      totalCount: interview.totalQuestions,
      accuracy: interview.overallScore,
      weaknesses: (interview.weaknesses || []).join("; "),
      areasToImprove: (interview.areasToImprove || []).join("; "),
      lastUpdated: new Date().toISOString(),
    });
    console.log(`Interview RAG: synced interview ${interview._id} for user ${userId}`);
  } catch (error: any) {
    console.error("Interview RAG sync failed:", error.message);
  }
}

/**
 * Retrieve the student's relevant past performance (quiz + interview summaries)
 * so question generation can be personalised.
 */
export async function getInterviewContext(userId: string, query: string): Promise<string> {
  try {
    // Bound the whole embed + query sequence, not just the vector lookup — a
    // slow/stuck Ollama embedding must not delay interview creation.
    const matches = await Promise.race([
      (async () => {
        const vector = await embedText(query);
        return queryVectors(userId, vector, 5);
      })(),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("RAG context lookup timed out (3s)")), 3000)
      ),
    ]);
    if (!matches.length) return "";

    const lines = matches.map((m: any) => {
      const md = m.metadata || {};
      if (md.type === "interview") {
        const weaknesses = md.weaknesses ? ` Weaknesses: ${md.weaknesses}.` : "";
        const areas = md.areasToImprove ? ` Areas to improve: ${md.areasToImprove}.` : "";
        return (
          `Mock Interview for ${md.topic} (${md.difficulty} ${md.interviewType || ""}): ` +
          `overall ${md.overallScore}/100, technical ${md.technicalScore}/100, ` +
          `answered ${md.correctCount}/${md.totalCount}.${weaknesses}${areas}`
        );
      }
      return (
        `Quiz performance on ${md.subject || "Unknown"} - ${md.topic || "Unknown"}: ` +
        `${md.correctCount}/${md.totalCount} correct, accuracy ${md.accuracy || 0}%.`
      );
    });
    return lines.join("\n");
  } catch (error: any) {
    console.error("Interview RAG retrieval failed:", error.message);
    return "";
  }
}
