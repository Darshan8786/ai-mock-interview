import type { KbEntry } from "../types";

/** More aptitude/reasoning topics plus behavioural and career-situation questions. */
export const moreKb: KbEntry[] = [
  // ── Aptitude / reasoning ─────────────────────────────
  {
    id: "apt-simplification",
    topic: "Aptitude · Simplification",
    title: "Simplification and BODMAS",
    questions: [
      "what is bodmas",
      "order of operations in simplification",
      "how to simplify expressions quickly",
      "approximation tricks in aptitude",
    ],
    answer:
      "BODMAS order: Brackets, Orders (powers/roots), Division and Multiplication (left to right, equal priority), Addition and Subtraction (left to right).\nSpeed tricks: round numbers to the nearest easy value for approximation questions, use fraction equivalents (1/8 = 12.5%), and remember squares to 30 and cubes to 10.",
  },
  {
    id: "apt-speed-math",
    topic: "Aptitude · Calculation Tricks",
    title: "Quick multiplication and squaring tricks",
    questions: [
      "vedic maths tricks for quick calculation",
      "how to square a number ending in 5",
      "trick to multiply by 11",
      "how to calculate faster without a calculator",
      "mental maths tricks",
    ],
    answer:
      "• Square of a number ending in 5: (n5)² = n × (n + 1) followed by 25 (35² → 3×4 = 12, so 1225).\n• Multiply a two-digit number by 11: keep the outer digits and put their sum in the middle (36 × 11 = 396).\n• Multiply by 5: multiply by 10 and halve. By 25: multiply by 100 and divide by 4.\n• Use (a + b)(a − b) = a² − b² for numbers like 47 × 53.",
  },
  {
    id: "apt-venn-sets",
    topic: "Reasoning · Venn Diagrams & Sets",
    title: "Sets and Venn diagrams",
    questions: [
      "venn diagram formula for two sets",
      "how to solve problems on sets",
      "n a union b formula",
      "three set venn diagram problems",
    ],
    answer:
      "Two sets: n(A ∪ B) = n(A) + n(B) − n(A ∩ B).\nThree sets: n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A ∩ B) − n(B ∩ C) − n(A ∩ C) + n(A ∩ B ∩ C).\nFill the diagram from the innermost region (all three) outward, subtracting as you go, so no region is counted twice.",
  },
  {
    id: "apt-ranking",
    topic: "Reasoning · Ranking & Order",
    title: "Ranking and ordering",
    questions: [
      "ranking and order problems formula",
      "position from left and right find total number of students",
      "how to solve rank problems in reasoning",
    ],
    answer:
      "Total people = (rank from top) + (rank from bottom) − 1.\nFor a position counted from the left and from the right, the same formula applies. Draw a line of boxes, place known positions, and count the gap for 'between' questions (between two ranks = difference − 1).",
  },
  {
    id: "apt-data-sufficiency",
    topic: "Reasoning · Data Sufficiency",
    title: "Data sufficiency",
    questions: [
      "how to solve data sufficiency questions",
      "data sufficiency strategy",
      "which statement is sufficient to answer the question",
    ],
    answer:
      "1. Read the question and decide exactly what you need to find it.\n2. Test Statement I alone — can it give one definite answer? Then Statement II alone.\n3. If neither alone works, combine them.\nSufficient means a single definite answer, not necessarily a numerical value you calculated. Do not use outside knowledge to fill gaps.",
  },
  {
    id: "apt-logic-statements",
    topic: "Reasoning · Statements & Analogies",
    title: "Statement–conclusion, assumption, analogy and odd-one-out",
    questions: [
      "how to solve statement and assumption questions",
      "statement and conclusion reasoning tricks",
      "how to solve analogy questions",
      "odd one out questions approach",
      "course of action reasoning",
    ],
    answer:
      "• Statement–conclusion: accept only what follows from the given statements, even if it contradicts common sense.\n• Assumption: an assumption is something taken for granted for the statement to make sense — test by asking 'is the statement invalid without this?'.\n• Analogy: find the exact relationship in the first pair (part-whole, tool-user, cause-effect) and apply the same to the second.\n• Odd one out: find the property shared by all but one (category, function, number pattern).",
  },
  // ── Behavioural & HR ─────────────────────────────────
  {
    id: "hr-failure",
    topic: "Interview · Behavioural",
    title: "Talking about failure or a mistake",
    questions: [
      "tell me about a time you failed",
      "what is your biggest mistake",
      "how to answer a question about failure in an interview",
      "describe a setback and how you handled it",
    ],
    answer:
      "Pick a real but recoverable failure (a missed deadline, a bug that reached testing), own it without blaming others, and spend most of your answer on what you did to fix it and what you changed afterwards. Use STAR: Situation, Task, Action, Result — ending with the lesson and how you applied it later.",
  },
  {
    id: "hr-teamwork-leadership",
    topic: "Interview · Behavioural",
    title: "Teamwork, conflict and leadership",
    questions: [
      "how to answer teamwork questions in an interview",
      "give an example of leadership",
      "how do you handle conflict in a team",
      "tell me about a time you worked in a team",
      "what role do you play in a team",
    ],
    answer:
      "Choose a project where you had a clear role. Describe the goal, how the work was divided, one disagreement or obstacle, and how you resolved it by listening, proposing options and agreeing on data or a decision-maker. For leadership, show initiative and outcome — even leading a college project or event counts. Keep 'we' for the team result and 'I' for your actions.",
  },
  {
    id: "hr-achievement",
    topic: "Interview · Behavioural",
    title: "Greatest achievement",
    questions: [
      "what is your greatest achievement",
      "what are you most proud of",
      "how to talk about my achievements in an interview",
    ],
    answer:
      "Pick something relevant and recent (a project, hackathon, competition, internship) and quantify it: what the challenge was, what you did, and the measurable result (users, performance gain, rank). Explain what it taught you and how it prepares you for this role.",
  },
  {
    id: "hr-pressure",
    topic: "Interview · Behavioural",
    title: "Handling pressure and deadlines",
    questions: [
      "how do you handle pressure",
      "how do you manage tight deadlines",
      "how do you handle stress at work",
      "how do you prioritise tasks",
    ],
    answer:
      "Describe a concrete example: how you broke the work into tasks, prioritised by impact and deadline, communicated early about risks, and stayed calm (breaks, focusing on one task at a time). Show the outcome. Avoid saying you 'never feel pressure'.",
  },
  {
    id: "hr-why-field-gap",
    topic: "Interview · HR Round",
    title: "Why this field, gap year, and career switches",
    questions: [
      "why did you choose this branch or field",
      "how to explain a gap year in an interview",
      "i have an education gap how to explain",
      "why are you changing career path",
    ],
    answer:
      "Be honest, brief and forward-looking. For your field: a genuine trigger (a project, a teacher, a problem you enjoyed) and how you built skills since. For a gap: state the reason plainly (health, family, preparation, upskilling), then show what you did — courses, projects, freelance work — and that you are ready now. Never sound defensive or blame anyone.",
  },
  {
    id: "hr-relocation-bond",
    topic: "Interview · HR Round",
    title: "Relocation, shifts and service agreements",
    questions: [
      "are you willing to relocate",
      "are you okay with night shifts",
      "what is a service agreement or bond",
      "how to answer willingness to relocate",
    ],
    answer:
      "If you can, say yes with enthusiasm — for freshers flexibility is valued. If you have genuine constraints, state them politely and early. For a service agreement (bond), read the duration, the penalty and the conditions on the offer letter before signing, and ask HR to clarify anything unclear.",
  },
  {
    id: "hr-strategy-mistakes",
    topic: "Interview · Preparation",
    title: "Common interview mistakes",
    questions: [
      "common mistakes freshers make in interviews",
      "what should i avoid in an interview",
      "why do candidates get rejected in interviews",
      "how to impress the interviewer",
    ],
    answer:
      "Frequent mistakes: not researching the company, listing skills you cannot explain, memorised answers, rambling, criticising a previous teacher/employer, speaking without thinking, and not asking questions. Instead: prepare 2–3 stories, clarify questions before answering, think aloud on problems, and be honest about what you don't know.",
  },
  {
    id: "hr-company-research",
    topic: "Interview · Preparation",
    title: "Researching a company",
    questions: [
      "how to research a company before an interview",
      "what should i know about the company",
      "how to prepare for a company specific interview",
    ],
    answer:
      "Read the company's website, product pages and recent news; find their tech stack and values; check the job description line by line; look at past interview experiences for that company. Prepare one sentence on what the company does, one on why it interests you, and two questions you'd like to ask.",
  },
  {
    id: "hr-followup",
    topic: "Interview · After the Interview",
    title: "Follow-up and thank-you email",
    questions: [
      "should i send a thank you email after an interview",
      "how to follow up after an interview",
      "what to do after an interview",
      "how long to wait for interview results",
    ],
    answer:
      "Send a short thank-you email within 24 hours: thank them, mention one specific thing you discussed, and reaffirm your interest. If you have heard nothing after the timeline they gave (or about a week), send one polite follow-up. Meanwhile keep applying and preparing.",
  },
  // ── Career situations ────────────────────────────────
  {
    id: "career-offcampus",
    topic: "Career · Job Search",
    title: "Off-campus job search",
    questions: [
      "how to find off campus jobs",
      "how to get a job without campus placement",
      "how to get referrals for a job",
      "how to apply for jobs online as a fresher",
    ],
    answer:
      "Use the Jobs page here plus company career pages, LinkedIn, and fresher-focused job boards. Ask seniors and alumni for referrals — a referred resume is read first. Apply widely (10–20 a week), tailor your resume to each description, and keep building projects and a GitHub profile while you wait.",
  },
  {
    id: "career-linkedin-github",
    topic: "Career · Profile",
    title: "LinkedIn and GitHub profile",
    questions: [
      "how to make a good linkedin profile",
      "how to build a github portfolio",
      "what should i put on my github",
      "how to network on linkedin",
    ],
    answer:
      "• LinkedIn: clear photo, a headline with your role and skills, a short summary, projects and certifications; connect with seniors, recruiters and alumni and send a personalised note.\n• GitHub: 3–5 pinned projects with a good README (what it does, screenshots, tech stack, how to run), meaningful commit history, and clean code. Recruiters skim, so make the first screen count.",
  },
  {
    id: "career-coding-round",
    topic: "Career · Coding Rounds",
    title: "Online coding test tips",
    questions: [
      "tips for online coding assessment",
      "how to prepare for a hackerrank test",
      "how to manage time in a coding round",
      "what to do if my code fails test cases",
    ],
    answer:
      "Read every problem first and start with the easiest to bank marks. Handle edge cases (empty input, single element, large values), estimate complexity against the constraints, and test with your own cases before submitting. Partial credit counts, so submit a correct brute force if you cannot optimise in time. Practise on the same platform beforehand to learn its input format.",
  },
  {
    id: "career-internship",
    topic: "Career · Internships",
    title: "Getting an internship",
    questions: [
      "how to get an internship",
      "how to find internships as a student",
      "how important are internships for placements",
      "internship application tips",
    ],
    answer:
      "Start with projects and a tidy resume, then apply on LinkedIn, Internshala and company pages, and ask seniors/professors for leads. Write a short, specific message to the hiring team about what you can contribute. Even a small or remote internship shows practical experience and often converts into a pre-placement offer.",
  },
  {
    id: "career-low-cgpa",
    topic: "Career · Eligibility",
    title: "Low CGPA or backlogs",
    questions: [
      "how to get placed with low cgpa",
      "can i get a job with backlogs",
      "cgpa below the cutoff what can i do",
      "how to improve chances with a low percentage",
    ],
    answer:
      "Many companies (especially product and startups) filter on skills, not marks. Build strong projects and a GitHub profile, do internships, ace the aptitude and coding rounds, and apply off-campus where cutoffs are absent. Clear your backlogs as soon as possible, and be ready to explain them briefly and honestly.",
  },
  {
    id: "career-offers",
    topic: "Career · Offers",
    title: "Handling offers and joining",
    questions: [
      "what to do if i get multiple offers",
      "how to compare job offers",
      "what is an offer letter",
      "can a company revoke an offer",
      "what is ctc",
    ],
    answer:
      "Compare offers on role and learning, tech stack, location, growth, and the whole CTC (fixed vs variable, joining bonus, bond). Once you accept, honour it; if you must decline, do so politely and early. An offer letter states role, CTC and joining date — read it fully. Offers can be revoked for false information or failed background checks, so keep everything you submit accurate.",
  },
  {
    id: "career-study-plan-motivation",
    topic: "Career · Preparation",
    title: "Daily schedule and staying motivated",
    questions: [
      "how many hours should i study for placements",
      "how to stay motivated during placement preparation",
      "how to make a daily study schedule",
      "i feel demotivated after rejection",
      "how to handle rejection in placements",
    ],
    answer:
      "Consistency beats marathons: 2–3 focused hours a day (aptitude, one DSA topic, one CS subject, a little revision) plus a weekly mock test and interview. Track progress in Analytics so improvement is visible. Rejection is normal — note what went wrong, fix one thing, and move on to the next opportunity; each interview makes the next easier.",
  },
  {
    id: "career-higher-studies",
    topic: "Career · Planning",
    title: "Placement vs higher studies",
    questions: [
      "should i go for higher studies or a job",
      "gate versus placement",
      "should i do mba or ms after btech",
      "job or masters after engineering",
    ],
    answer:
      "It depends on your goal. A job gives income and experience now; a Master's/MBA can open specialised or research roles but costs time and money. Consider your interests, finances and the career you want in five years. It is fine to work first and study later — many employers sponsor further education.",
  },
];
