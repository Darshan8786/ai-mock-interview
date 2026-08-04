import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "mindprep";

if (!OPENAI_API_KEY || !PINECONE_API_KEY) {
  console.error("❌ CRITICAL: Missing API keys in roleQuestionController");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "dummy-key" });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY || "dummy-key" });
const index = pinecone.Index(PINECONE_INDEX_NAME);

function normalizeRoleName(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/developer|engineer|role|roles|dev/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function generateQuestions(role: string): Promise<string[]> {
  const prompt = `Generate 3 interview questions for the role "${role}":
- 2 technical questions
- 1 factual one-liner question
Return ONLY a valid JSON array of exactly 3 strings.
Example: ["Question 1", "Question 2", "Question 3"]`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const rawContent = completion.choices[0]?.message?.content || "";
  const cleaned = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.map((q: string) => q.trim()).slice(0, 3) : [];
  } catch {
    return cleaned.split("\n").filter(Boolean).slice(0, 3);
  }
}

export async function getQuestionsForRole(validatedRole: string) {
  try {
    const canonicalRole = normalizeRoleName(validatedRole);
    console.log(`🎯 Searching for role: ${validatedRole} → canonical: ${canonicalRole}`);

    const queryVector = await getEmbedding(`Interview questions for ${canonicalRole}`);

    const results = await index.namespace("quiz").query({
      vector: queryVector,
      topK: 20,
      includeMetadata: true,
    });

    const STRICT_THRESHOLD = 0.80;
    const matchedDocs = (results.matches || []).filter((m) => (m.score ?? 0) >= STRICT_THRESHOLD);

    if (matchedDocs.length > 0) {
      const matchedRole = (matchedDocs[0].metadata?.role as string) || canonicalRole;
      const shuffled = [...matchedDocs].sort(() => Math.random() - 0.5);
      const questions = shuffled
        .map((m) =>
          String(m.metadata?.question || m.id)
            .replace(/^Question:\s*/i, "")
            .replace(/\n*\s*Role:.*$/i, "")
            .trim()
        )
        .slice(0, 3);

      console.log(`✅ Found ${matchedDocs.length} matches for "${matchedRole}". Showing 3 random ones.`);
      return { source: "pinecone", matchedRole, questions };
    }

    console.log(`🆕 No match found. Generating questions for "${canonicalRole}"...`);
    const newQuestions = await generateQuestions(canonicalRole);

    const embeddings = await Promise.all(
      newQuestions.map((q) => getEmbedding(`Question: ${q}\n\nRole: ${canonicalRole}`))
    );

    await index.namespace("quiz").upsert(
      newQuestions.map((q, i) => ({
        id: `role-${canonicalRole}-${Date.now()}-${i}`,
        values: embeddings[i],
        metadata: { role: canonicalRole, question: q, type: "question" },
      }))
    );

    console.log(`✅ Generated and stored ${newQuestions.length} questions for "${canonicalRole}"`);
    return { source: "openai", matchedRole: canonicalRole, questions: newQuestions };
  } catch (err) {
    console.error("❌ Error in getQuestionsForRole:", err);
    return { error: "Failed to fetch questions" };
  }
}
