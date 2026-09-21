import type { AreaStat, StudentAnalytics } from "../analyticsService";
import { WEAK_BELOW, STRONG_FROM } from "../analyticsService";
import { getDocumentationForSubject } from "../../utils/documentationService";

export interface ChatSource {
  name: string;
  group: string;
  accuracy: number;
  correct: number;
  total: number;
}

export interface ChatResource {
  name: string;
  url: string;
  description: string;
}

export interface ChatSuggestion {
  label: string;
  prompt: string;
}

export interface ChatReply {
  answer: string;
  kind: "knowledge" | "personal" | "smalltalk" | "suggest" | "fallback";
  /** Chip shown under the answer, e.g. "Aptitude · Percentages". */
  topic?: string;
  /** False when the match was plausible but below the confidence bar. */
  confident: boolean;
  suggestions: ChatSuggestion[];
  /** The student's own numbers the answer is based on (personal answers only). */
  sources: ChatSource[];
  resources: ChatResource[];
  /** A deep link into the app that acts on the answer. */
  action?: { label: string; path: string };
  /** Which matcher understood the message: the fine-tuned neural model, the keyword model, or both (hybrid). */
  engine?: "neural" | "keyword" | "hybrid";
}

export const STARTER_SUGGESTIONS: ChatSuggestion[] = [
  { label: "My weak areas", prompt: "What are my weak areas?" },
  { label: "How am I doing?", prompt: "How am I doing overall?" },
  { label: "What should I study next?", prompt: "What should I study next?" },
  { label: "Deadlock", prompt: "What is deadlock and how to prevent it?" },
  { label: "Tell me about yourself", prompt: "How do I answer tell me about yourself?" },
  { label: "Time & work formulas", prompt: "Time and work formula" },
];

export function reply(partial: Partial<ChatReply> & { answer: string; kind: ChatReply["kind"] }): ChatReply {
  return { confident: true, suggestions: [], sources: [], resources: [], ...partial };
}

const toSource = (a: AreaStat): ChatSource => ({
  name: a.name,
  group: a.group,
  accuracy: a.accuracy,
  correct: a.correct,
  total: a.total,
});

const label = (a: AreaStat) => {
  const where = a.source === "tech" ? `${a.group} quiz` : a.group !== a.name ? a.group : "Aptitude";
  return `${a.name} (${where})`;
};

const line = (a: AreaStat) => `• ${label(a)} — ${a.accuracy}% (${a.correct}/${a.total} correct)`;

const NO_DATA =
  "I don't have any results for you yet. Complete an aptitude test, a tech quiz or a mock interview and I'll be able to " +
  "tell you where you stand.";

const START_ACTIONS: ChatReply["action"] = { label: "Start an aptitude practice", path: "/aptitude/practice" };

/** Static, key-free practice links per aptitude category (section landing pages). */
const APTITUDE_RESOURCES: Record<string, ChatResource> = {
  quantitative: {
    name: "IndiaBix — Quantitative Aptitude",
    url: "https://www.indiabix.com/aptitude/questions-and-answers/",
    description: "Topic-wise questions with worked solutions",
  },
  "logical reasoning": {
    name: "IndiaBix — Logical Reasoning",
    url: "https://www.indiabix.com/logical-reasoning/questions-and-answers/",
    description: "Series, seating, syllogisms and more",
  },
  "verbal ability": {
    name: "IndiaBix — Verbal Ability",
    url: "https://www.indiabix.com/verbal-ability/questions-and-answers/",
    description: "Grammar, comprehension and vocabulary practice",
  },
  "data interpretation": {
    name: "IndiaBix — Data Interpretation",
    url: "https://www.indiabix.com/data-interpretation/questions-and-answers/",
    description: "Tables, bar graphs, pie charts and line graphs",
  },
};

function resourcesFor(areas: AreaStat[]): ChatResource[] {
  const out: ChatResource[] = [];
  const seen = new Set<string>();
  const add = (r: ChatResource) => {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      out.push(r);
    }
  };
  for (const a of areas) {
    if (a.source === "aptitude") {
      const r = APTITUDE_RESOURCES[a.group.toLowerCase()];
      if (r) add(r);
    } else if (a.source === "tech") {
      // Technology names (Java, Python, ...) map straight onto the documentation list.
      getDocumentationForSubject(a.group).forEach((d) => add({ name: d.name, url: d.url, description: d.description }));
    }
  }
  return out.slice(0, 6);
}

// ── personal intents ───────────────────────────────────────────

export function personalReply(intent: string, d: StudentAnalytics): ChatReply {
  switch (intent) {
    case "my_weak_areas":
      return weakAreas(d);
    case "my_strengths":
      return strengths(d);
    case "my_progress":
      return progress(d);
    case "my_aptitude":
      return aptitude(d);
    case "my_interview":
      return interview(d);
    case "my_techquiz":
      return techQuiz(d);
    case "next_steps":
      return nextSteps(d);
    case "my_resources":
      return resources(d);
    default:
      return reply({ kind: "fallback", answer: "I couldn't work that out from your data." });
  }
}

function weakAreas(d: StudentAnalytics): ChatReply {
  if (!d.hasData) return reply({ kind: "personal", answer: NO_DATA, action: START_ACTIONS });

  const parts: string[] = [];
  if (d.weakAreas.length) {
    parts.push(`Your weakest areas (below ${WEAK_BELOW}% accuracy):\n${d.weakAreas.slice(0, 6).map(line).join("\n")}`);
  } else {
    const all = [...d.aptitude.topics, ...d.techQuiz.topics].sort((a, b) => a.accuracy - b.accuracy);
    const judged = all.filter((a) => a.total >= 3);
    if (judged.length) {
      const lowest = judged[0];
      parts.push(
        `Good news — none of your topics are below ${WEAK_BELOW}% right now. Your lowest is ${label(lowest)} at ${lowest.accuracy}%, so start there to keep improving.`
      );
    } else if (all.length) {
      parts.push(
        "I don't have enough answers per topic yet to call anything a weak area (I need at least 3 per topic). " +
          `So far your lowest is ${label(all[0])} at ${all[0].accuracy}% (${all[0].total} question${all[0].total === 1 ? "" : "s"}). Keep practising and I'll get more precise.`
      );
    } else {
      parts.push("I can't see topic-level results yet. Complete a few practice sets and I'll show where you're losing marks.");
    }
  }
  if (d.interview.attempts && d.interview.improvementAreas.length) {
    parts.push(
      `From your mock interviews, the feedback that came up most:\n${d.interview.improvementAreas
        .slice(0, 3)
        .map((i) => `• ${i.text}`)
        .join("\n")}`
    );
  }
  const worst = d.weakAreas[0];
  return reply({
    kind: "personal",
    topic: "Your analytics",
    answer: parts.join("\n\n"),
    sources: d.weakAreas.slice(0, 6).map(toSource),
    suggestions: [
      { label: "What should I study next?", prompt: "What should I study next?" },
      { label: "Resources for my weak areas", prompt: "Recommend resources for my weak topics" },
    ],
    action: worst?.source === "tech" ? { label: "Practise in Tech Practice", path: "/tech-practice" } : START_ACTIONS,
  });
}

function strengths(d: StudentAnalytics): ChatReply {
  if (!d.hasData) return reply({ kind: "personal", answer: NO_DATA, action: START_ACTIONS });
  if (!d.strengths.length) {
    return reply({
      kind: "personal",
      topic: "Your analytics",
      answer:
        `You don't have a topic at ${STRONG_FROM}%+ yet (with at least a few questions answered). ` +
        "Keep practising and your strongest areas will show up here.",
      suggestions: [{ label: "My weak areas", prompt: "What are my weak areas?" }],
      action: START_ACTIONS,
    });
  }
  return reply({
    kind: "personal",
    topic: "Your analytics",
    answer: `Your strongest areas (${STRONG_FROM}%+ accuracy):\n${d.strengths.slice(0, 6).map(line).join("\n")}\n\nKeep them warm with an occasional timed set while you work on weaker topics.`,
    sources: d.strengths.slice(0, 6).map(toSource),
    suggestions: [{ label: "My weak areas", prompt: "What are my weak areas?" }],
  });
}

function progress(d: StudentAnalytics): ChatReply {
  if (!d.hasData) return reply({ kind: "personal", answer: NO_DATA, action: START_ACTIONS });
  const o = d.overview;
  const lines = [`Your readiness score is ${o.readiness}% (the average of the areas you've practised).`];
  if (d.aptitude.attempts) {
    const trend = describeTrend(d.aptitude.trend.map((t) => t.score));
    lines.push(
      `• Aptitude: ${d.aptitude.attempts} test${s(d.aptitude.attempts)}, average ${d.aptitude.avgScore}%, best ${d.aptitude.bestScore}%${trend}.`
    );
  }
  if (d.techQuiz.attempts) {
    const trend = describeTrend(d.techQuiz.trend.map((t) => t.score));
    lines.push(`• Tech quizzes: ${d.techQuiz.attempts} completed, average ${d.techQuiz.avgScore}%${trend}.`);
  }
  if (d.interview.attempts) {
    const trend = describeTrend(d.interview.trend.map((t) => t.score));
    lines.push(`• Mock interviews: ${d.interview.attempts} completed, average ${d.interview.avgOverall}%${trend}.`);
  }
  const untouched: string[] = [];
  if (!d.aptitude.attempts) untouched.push("aptitude tests");
  if (!d.techQuiz.attempts) untouched.push("tech quizzes");
  if (!d.interview.attempts) untouched.push("mock interviews");
  if (untouched.length) lines.push(`You haven't tried ${untouched.join(" or ")} yet — they're part of a complete preparation.`);
  if (d.weakAreas[0]) lines.push(`Biggest opportunity: ${label(d.weakAreas[0])} at ${d.weakAreas[0].accuracy}%.`);

  return reply({
    kind: "personal",
    topic: "Your analytics",
    answer: lines.join("\n"),
    sources: d.weakAreas.slice(0, 3).map(toSource),
    suggestions: [
      { label: "My weak areas", prompt: "What are my weak areas?" },
      { label: "What should I study next?", prompt: "What should I study next?" },
    ],
  });
}

function aptitude(d: StudentAnalytics): ChatReply {
  const a = d.aptitude;
  if (!a.attempts) {
    return reply({
      kind: "personal",
      answer: "You haven't completed an aptitude test yet. Take one from the Aptitude page and I'll break your score down by category.",
      action: START_ACTIONS,
    });
  }
  const cats = a.categories.length
    ? `\n\nBy category:\n${a.categories.map((c) => `• ${c.name} — ${c.accuracy}% (${c.correct}/${c.total})`).join("\n")}`
    : "";
  return reply({
    kind: "personal",
    topic: "Your aptitude results",
    answer:
      `You've completed ${a.attempts} aptitude test${s(a.attempts)}. Average score ${a.avgScore}%, best ${a.bestScore}%, ` +
      `latest ${a.lastScore}%${describeTrend(a.trend.map((t) => t.score))}.${cats}`,
    sources: a.categories.map(toSource),
    action: { label: "See aptitude progress", path: "/aptitude/progress" },
  });
}

function interview(d: StudentAnalytics): ChatReply {
  const i = d.interview;
  if (!i.attempts) {
    return reply({
      kind: "personal",
      answer:
        (i.terminated
          ? `Your ${i.terminated} interview${s(i.terminated)} ended early, so there is no score to show yet. `
          : "You haven't completed a mock interview yet. ") + "Complete one and I'll summarise your feedback.",
      action: { label: "Start a mock interview", path: "/mock-interview/setup" },
    });
  }
  const sorted = [...i.skills].sort((a, b) => a.score - b.score);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const lines = [
    `Across ${i.attempts} completed mock interview${s(i.attempts)} your average overall score is ${i.avgOverall}%${describeTrend(i.trend.map((t) => t.score))}.`,
    i.skills.map((k) => `• ${k.label}: ${k.score}%`).join("\n"),
    `Strongest: ${highest.label} (${highest.score}%). Focus next on ${lowest.label} (${lowest.score}%).`,
  ];
  if (i.improvementAreas.length) {
    lines.push(`Feedback that repeats:\n${i.improvementAreas.slice(0, 3).map((x) => `• ${x.text}`).join("\n")}`);
  }
  if (i.terminated) lines.push(`Note: ${i.terminated} interview${s(i.terminated)} ended early and ${i.terminated === 1 ? "isn't" : "aren't"} counted.`);
  return reply({
    kind: "personal",
    topic: "Your interview results",
    answer: lines.join("\n\n"),
    suggestions: [{ label: "How to improve communication", prompt: "How to improve communication skills?" }],
    action: { label: "Open interview dashboard", path: "/mock-interview/dashboard" },
  });
}

function techQuiz(d: StudentAnalytics): ChatReply {
  const t = d.techQuiz;
  if (!t.attempts) {
    return reply({
      kind: "personal",
      answer: "You haven't completed a tech quiz yet. Pick a technology in Tech Practice and I'll track your accuracy per topic.",
      action: { label: "Open Tech Practice", path: "/tech-practice" },
    });
  }
  const techs = t.technologies
    .slice(0, 5)
    .map((x) => `• ${x.technology} — ${x.attempts} quiz${x.attempts === 1 ? "" : "zes"}, average ${x.avgScore}%, best ${x.bestScore}%`)
    .join("\n");
  const weak = t.topics.filter((x) => x.total >= 3 && x.accuracy < WEAK_BELOW).slice(0, 3);
  return reply({
    kind: "personal",
    topic: "Your tech quiz results",
    answer:
      `You've completed ${t.attempts} tech quiz${t.attempts === 1 ? "" : "zes"} with an average of ${t.avgScore}%${describeTrend(t.trend.map((x) => x.score))}.\n\n${techs}` +
      (weak.length ? `\n\nTopics to revisit:\n${weak.map(line).join("\n")}` : ""),
    sources: weak.map(toSource),
    action: { label: "Practise in Tech Practice", path: "/tech-practice" },
  });
}

function nextSteps(d: StudentAnalytics): ChatReply {
  if (!d.hasData) {
    return reply({
      kind: "personal",
      answer:
        "Here's a simple start:\n1. Take an aptitude practice set (15 questions) to find your baseline.\n" +
        "2. Try one Tech Practice quiz in your main language.\n3. Do a short mock interview.\nCome back afterwards and I'll build a plan from your results.",
      action: START_ACTIONS,
    });
  }
  const steps: string[] = [];
  d.weakAreas.slice(0, 3).forEach((a, i) => {
    const where = a.source === "tech" ? "Tech Practice" : "Aptitude → Practice";
    steps.push(`${i + 1}. Work on ${a.name} (${a.accuracy}%): 10–15 questions daily in ${where}, then read the explanation for every miss.`);
  });
  if (!d.interview.attempts) steps.push(`${steps.length + 1}. Take a mock interview — you haven't done one yet.`);
  else if (d.interview.skills.length) {
    const low = [...d.interview.skills].sort((a, b) => a.score - b.score)[0];
    steps.push(`${steps.length + 1}. Improve ${low.label.toLowerCase()} in interviews (currently ${low.score}%): record yourself answering and review.`);
  }
  if (!d.techQuiz.attempts) steps.push(`${steps.length + 1}. Try a Tech Practice quiz to check your technical fundamentals.`);
  if (!d.aptitude.attempts) steps.push(`${steps.length + 1}. Take an aptitude test to get a baseline.`);
  if (steps.length === 0) steps.push("1. Take a full timed mock test this week to keep your edge, then re-check Analytics.");

  const first = d.weakAreas[0];
  return reply({
    kind: "personal",
    topic: "Your analytics",
    answer: `A plan based on your results:\n${steps.join("\n")}`,
    sources: d.weakAreas.slice(0, 3).map(toSource),
    suggestions: [{ label: "Resources for my weak areas", prompt: "Recommend resources for my weak topics" }],
    action: first?.source === "tech" ? { label: "Open Tech Practice", path: "/tech-practice" } : START_ACTIONS,
  });
}

function resources(d: StudentAnalytics): ChatReply {
  if (!d.hasData) return reply({ kind: "personal", answer: NO_DATA, action: START_ACTIONS });
  const areas = d.weakAreas.length
    ? d.weakAreas
    : [...d.aptitude.categories, ...d.techQuiz.topics].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const res = resourcesFor(areas);
  return reply({
    kind: "personal",
    topic: "Your analytics",
    answer: res.length
      ? `Here are free resources matched to ${d.weakAreas.length ? "your weak areas" : "your lowest-scoring areas"}: ${areas
          .slice(0, 3)
          .map((a) => a.name)
          .join(", ")}.`
      : "I don't have curated links for your current weak topics yet, but the Aptitude → Practice explanations are a good place to start.",
    sources: areas.slice(0, 4).map(toSource),
    resources: res,
    action: START_ACTIONS,
  });
}

// ── small talk ─────────────────────────────────────────────────

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export function smalltalkReply(intent: string): ChatReply {
  switch (intent) {
    case "greeting":
      return reply({
        kind: "smalltalk",
        answer: pick([
          "Hi! I'm your placement-prep assistant. Ask me about aptitude formulas, interview questions, CS fundamentals — or about your own progress.",
          "Hello! Ready to prep? Ask me a concept, an interview question, or how you're doing.",
        ]),
        suggestions: STARTER_SUGGESTIONS.slice(0, 4),
      });
    case "thanks":
      return reply({ kind: "smalltalk", answer: pick(["You're welcome! Anything else you'd like to go over?", "Happy to help — good luck with your prep!"]) });
    case "goodbye":
      return reply({ kind: "smalltalk", answer: "Good luck with your preparation — come back any time!" });
    case "identity":
      return reply({
        kind: "smalltalk",
        answer:
          "I'm the MindPrep study assistant. I run entirely on this platform — no external AI service or API key — using a knowledge base of placement topics and your own results. " +
          "I can answer aptitude, CS and interview questions and summarise your progress, but I may not know everything outside those areas.",
        suggestions: STARTER_SUGGESTIONS.slice(0, 4),
      });
    default:
      return reply({ kind: "smalltalk", answer: "I'm here to help with placement prep." });
  }
}

// ── helpers ────────────────────────────────────────────────────

function s(n: number) {
  return n === 1 ? "" : "s";
}

/** " (up 8 points vs your earlier average)" — compares the latest 3 results with the ones before. */
function describeTrend(scores: number[]): string {
  if (scores.length < 4) return "";
  const recent = scores.slice(-3);
  const before = scores.slice(0, -3);
  const mean = (x: number[]) => x.reduce((p, c) => p + c, 0) / x.length;
  const diff = Math.round(mean(recent) - mean(before));
  if (Math.abs(diff) < 3) return " (steady)";
  return diff > 0 ? ` (up ${diff} points recently)` : ` (down ${Math.abs(diff)} points recently)`;
}
