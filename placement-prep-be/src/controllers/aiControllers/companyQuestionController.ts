import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "mindprep";

if (!OPENAI_API_KEY || !PINECONE_API_KEY) {
  console.error("❌ CRITICAL: Missing API keys in companyQuestionController");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "dummy-key" });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY || "dummy-key" });
const index = pinecone.Index(PINECONE_INDEX_NAME);

function normalizeCompanyName(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/company|companies|inc|ltd|corp|corporation/gi, "")
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

async function generateCompanyQuestions(company: string): Promise<string[]> {
  const prompt = `Generate 3 interview questions for the company "${company}":
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

export async function getQuestionsForCompany(validatedCompany: string) {
  try {
    const canonicalCompany = normalizeCompanyName(validatedCompany);
    console.log(`🎯 Searching for company: ${validatedCompany} → canonical: ${canonicalCompany}`);

    const queryVector = await getEmbedding(`Interview questions for ${canonicalCompany}`);

    const results = await index.namespace("quiz").query({
      vector: queryVector,
      topK: 20,
      includeMetadata: true,
    });

    const STRICT_THRESHOLD = 0.80;
    const matchedDocs = (results.matches || []).filter((m) => (m.score ?? 0) >= STRICT_THRESHOLD);

    if (matchedDocs.length > 0) {
      const matchedCompany = (matchedDocs[0].metadata?.company as string) || canonicalCompany;
      const shuffled = [...matchedDocs].sort(() => Math.random() - 0.5);
      const questions = shuffled
        .map((m) =>
          String(m.metadata?.question || m.id)
            .replace(/^Question:\s*/i, "")
            .replace(/\n*\s*Company:.*$/i, "")
            .trim()
        )
        .slice(0, 3);

      console.log(`✅ Found ${matchedDocs.length} matches for "${matchedCompany}". Showing 3 random ones.`);
      return { source: "pinecone", matchedCompany, questions };
    }

    console.log(`🆕 No match found. Generating questions for "${canonicalCompany}"...`);
    const newQuestions = await generateCompanyQuestions(canonicalCompany);

    const embeddings = await Promise.all(
      newQuestions.map((q) => getEmbedding(`Question: ${q}\n\nCompany: ${canonicalCompany}`))
    );

    await index.namespace("quiz").upsert(
      newQuestions.map((q, i) => ({
        id: `company-${canonicalCompany}-${Date.now()}-${i}`,
        values: embeddings[i],
        metadata: { company: canonicalCompany, question: q, type: "question" },
      }))
    );

    console.log(`✅ Generated and stored ${newQuestions.length} questions for "${canonicalCompany}"`);
    return { source: "openai", matchedCompany: canonicalCompany, questions: newQuestions };
  } catch (err) {
    console.error("❌ Error in getQuestionsForCompany:", err);
    return { error: "Failed to fetch questions" };
  }
}
