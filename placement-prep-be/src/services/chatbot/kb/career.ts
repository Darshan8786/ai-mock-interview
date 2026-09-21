import type { KbEntry } from "../types";

/** Interview, resume and campus-placement guidance. */
export const careerKb: KbEntry[] = [
  {
    id: "hr-tell-me-about-yourself",
    topic: "Interview · HR Round",
    title: "Tell me about yourself",
    questions: [
      "how to answer tell me about yourself",
      "tell me about yourself sample answer",
      "how do i introduce myself in an interview",
      "self introduction for freshers",
    ],
    answer:
      "Use a 60–90 second present → past → future structure:\n1. Present: your degree, college and the skills you are strongest in.\n2. Past: one or two projects/internships with a measurable result.\n3. Future: why this role and company fit what you want to learn.\nSkip family history and hobbies unless relevant, and practise it aloud until it sounds natural, not memorised.",
  },
  {
    id: "hr-strengths-weaknesses",
    topic: "Interview · HR Round",
    title: "Strengths and weaknesses",
    questions: [
      "what are your strengths and weaknesses",
      "how to answer what is your weakness",
      "best answer for greatest weakness in interview",
      "how to talk about my strengths",
      "how to answer the weakness question in an interview",
      "what to say about my weakness",
      "interview question what is your biggest weakness",
    ],
    answer:
      "Strengths: pick 2–3 that match the job and back each with a short example (e.g. 'I debug systematically — in my project I traced a memory leak to …').\nWeakness: choose a real, non-critical one, then show what you are doing about it (e.g. 'I used to over-polish before asking for feedback; now I share drafts early'). Never say 'I have no weakness' or name a core job skill.",
  },
  {
    id: "hr-why-hire",
    topic: "Interview · HR Round",
    title: "Why should we hire you / why this company",
    questions: [
      "why should we hire you",
      "why do you want to join this company",
      "why do you want this job",
      "how to answer why us in interview",
    ],
    answer:
      "Match your proof to their need: (1) name the skills the role needs, (2) give one project or result that shows you have them, (3) show you researched the company — its product, tech stack or values — and say what you would contribute and learn.\nAvoid answers about salary or location alone, and never criticise another employer.",
  },
  {
    id: "hr-five-years",
    topic: "Interview · HR Round",
    title: "Where do you see yourself in five years",
    questions: [
      "where do you see yourself in 5 years",
      "how to answer five year goal question",
      "what are your career goals",
    ],
    answer:
      "Show ambition that fits the company: mastering your craft, taking ownership of larger modules, and growing toward a technical lead or specialist role.\nExample: 'In five years I want to be a strong engineer who owns features end to end and mentors newer team members.' Avoid specifics like 'I'll be a manager by year 2', and never say you plan to leave.",
  },
  {
    id: "hr-star-method",
    topic: "Interview · Behavioural",
    title: "STAR method for behavioural questions",
    questions: [
      "what is the star method",
      "how to answer behavioural interview questions",
      "tell me about a time you faced a challenge",
      "how to describe a conflict with a teammate",
      "how to answer situational questions",
    ],
    answer:
      "STAR = Situation, Task, Action, Result.\n• Situation — brief context (1–2 sentences).\n• Task — what you were responsible for.\n• Action — what YOU did, step by step (use 'I', not 'we', for your part). This is the longest section.\n• Result — outcome with numbers if possible, plus what you learned.\nPrepare 4–5 stories (teamwork, conflict, failure, leadership, deadline pressure) that you can adapt.",
  },
  {
    id: "hr-dont-know",
    topic: "Interview · Technical Round",
    title: "What to do when you don't know an answer",
    questions: [
      "what if i do not know the answer in an interview",
      "how to handle a question i can't answer",
      "how to stay calm when i get stuck in interview",
      "how to deal with interview nervousness",
      "how to overcome interview anxiety",
      "i get nervous before interviews",
      "how to overcome fear of interviews",
      "how to stay confident during an interview",
      "i am scared of facing interviews",
    ],
    answer:
      "Be honest, then show your thinking: 'I haven't used that directly, but here is how I would reason about it…' and connect to something you know. Ask clarifying questions, think aloud, and offer an approach even if incomplete.\nFor nerves: slow your breathing, pause for a few seconds before answering, and rehearse with mock interviews — familiarity is the best cure for anxiety.",
  },
  {
    id: "hr-ask-interviewer",
    topic: "Interview · HR Round",
    title: "Questions to ask the interviewer",
    questions: [
      "what questions should i ask the interviewer",
      "do you have any questions for us",
      "good questions to ask at the end of an interview",
    ],
    answer:
      "Always ask 2–3. Good ones: 'What does success look like in the first six months?', 'What tech stack and processes does the team use?', 'How do new joiners get onboarded and mentored?', 'What are the biggest challenges the team is facing?'\nAvoid asking about salary, leave or perks in a first technical round.",
  },
  {
    id: "hr-salary",
    topic: "Interview · HR Round",
    title: "Salary expectations",
    questions: [
      "how to answer expected salary question",
      "what are your salary expectations as a fresher",
      "how to negotiate salary in campus placement",
    ],
    answer:
      "For campus drives packages are usually fixed, so say you are open to the company's standard fresher package. In off-campus roles, research the market range (Glassdoor-style data, seniors' offers), give a range, and emphasise you value learning and growth.\nNegotiate only after you have an offer, politely and with evidence of your skills.",
  },
  {
    id: "interview-virtual-tips",
    topic: "Interview · Preparation",
    title: "Virtual / online interview tips",
    questions: [
      "tips for online video interview",
      "how to prepare for a virtual interview",
      "what to do before an interview",
      "interview day checklist",
      "how to dress for an interview",
    ],
    answer:
      "• Test camera, mic, internet and the meeting link 30 minutes early; close other tabs and apps.\n• Sit in a quiet, well-lit place with the camera at eye level and a plain background.\n• Dress in neat formals; look at the camera, not the screen, when you speak.\n• Keep your resume, a pen and paper nearby.\n• Speak clearly and pause before answering. Note that proctored rounds monitor tab switches and camera, so stay in the window.",
  },
  {
    id: "interview-technical-prep",
    topic: "Interview · Preparation",
    title: "Preparing for a technical interview",
    questions: [
      "how to prepare for technical interview",
      "how to crack a campus placement interview",
      "how to prepare for placements in 3 months",
      "study plan for placements",
      "placement preparation roadmap",
    ],
    answer:
      "A 12-week plan: weeks 1–4 aptitude + core CS (OS, DBMS, CN, OOP); weeks 3–8 DSA practice daily; weeks 6–10 projects and resume, revise your own project's design and trade-offs; weeks 9–12 mock interviews and full timed tests.\nFor every skill on your resume, be ready to explain it in depth — interviewers go deep on what you claim. Use this platform's Mock Interview, Aptitude and Tech Practice, then check Analytics for weak spots.",
  },
  {
    id: "interview-projects",
    topic: "Interview · Technical Round",
    title: "Explaining your project",
    questions: [
      "how to explain my project in an interview",
      "what questions are asked about projects",
      "how to present a final year project",
      "project explanation tips",
    ],
    answer:
      "Cover: the problem, why it matters, your architecture and tech stack, YOUR contribution, one hard challenge and how you solved it, and the result or what you would improve.\nExpect follow-ups: why this database / framework, how does authentication work, how would it scale, what if X failed? Know every technology on the project's tech list.",
  },
  {
    id: "resume-tips",
    topic: "Resume",
    title: "Resume tips",
    questions: [
      "how to write a good resume for freshers",
      "resume tips for campus placement",
      "what should i include in my resume",
      "how long should a fresher resume be",
      "resume format for freshers",
    ],
    answer:
      "• Keep it to one page with clear sections: Contact, Education, Skills, Projects, Internships, Achievements.\n• Lead each bullet with an action verb and add a metric: 'Reduced page load time by 35% by lazy-loading images'.\n• List only skills you can be questioned on; group them (Languages, Web, Databases, Tools).\n• Use a clean, single-column layout, consistent dates, and no photo or personal details beyond contact links.\nUse the Resume Analyzer and Builder on this platform to check and improve it.",
  },
  {
    id: "resume-ats",
    topic: "Resume",
    title: "ATS-friendly resume",
    questions: [
      "what is an ats resume",
      "how to improve my ats score",
      "how to make my resume ats friendly",
      "why is my resume rejected by ats",
      "ats keywords in resume",
    ],
    answer:
      "An ATS (Applicant Tracking System) parses and ranks resumes before a human sees them. To score well:\n• Use standard headings (Education, Skills, Experience, Projects) and simple formatting — avoid tables, columns, images and text boxes.\n• Mirror keywords from the job description where they are true for you.\n• Save as PDF or DOCX text (not a scanned image).\n• Spell out acronyms once (e.g. 'Machine Learning (ML)').\nThe Resume Analyzer here shows an ATS score and missing keywords.",
  },
  {
    id: "gd-tips",
    topic: "Interview · Group Discussion",
    title: "Group discussion tips",
    questions: [
      "how to perform well in group discussion",
      "group discussion tips for placements",
      "how to start a group discussion",
      "gd topics for freshers",
    ],
    answer:
      "• Listen first; the evaluators note structure and content, not volume.\n• Start with a definition or a fact if you are confident, otherwise contribute early with a well-reasoned point.\n• Speak in short, structured points ('Firstly… Secondly…'), refer to others' ideas, and disagree politely.\n• Stay calm, do not interrupt, and use a closing line to summarise if the group ends without one.\nQuality of 2–3 contributions beats many weak ones.",
  },
  {
    id: "placement-process",
    topic: "Placement Process",
    title: "Typical campus placement process",
    questions: [
      "what is the campus placement process",
      "rounds in campus recruitment",
      "stages of a placement drive",
      "how does campus hiring work",
      "steps in a placement drive",
      "what happens in a campus recruitment drive",
    ],
    answer:
      "Typical stages: 1) pre-placement talk and registration, 2) online test (aptitude + reasoning + verbal, sometimes coding), 3) group discussion (some companies), 4) technical interview(s), 5) HR / managerial interview, 6) offer letter and joining formalities.\nEligibility often depends on CGPA cut-offs, backlogs and branch; check company criteria in the Jobs section, and apply before the deadline.",
  },
  {
    id: "placement-eligibility",
    topic: "Placement Process",
    title: "Eligibility criteria",
    questions: [
      "why am i not eligible for a job",
      "cgpa cutoff for placements",
      "do backlogs affect placements",
      "how to check job eligibility",
    ],
    answer:
      "Companies set eligibility on CGPA / percentage, active or history of backlogs, branch and graduation year. On this platform each job lists its criteria and shows whether you are eligible based on your profile — so keep your Profile (CGPA, backlogs, branch, graduation year) accurate and up to date.\nIf you fall just short, build strong skills and projects and look for off-campus openings that do not enforce cut-offs.",
  },
  {
    id: "communication-skills",
    topic: "Interview · Soft Skills",
    title: "Improve communication skills",
    questions: [
      "how to improve communication skills",
      "how to speak fluently in english for interviews",
      "how to reduce filler words",
      "how can i improve my confidence while speaking",
    ],
    answer:
      "• Practise answering common questions aloud daily and record yourself; review pace, filler words ('um', 'like') and clarity.\n• Structure answers: point first, reason, example.\n• Read editorials and listen to podcasts to build vocabulary; speak in short, simple sentences.\n• Mock interviews on this platform score fluency, grammar and confidence, so use the feedback to track progress.",
  },
  // ── Platform help ────────────────────────────────────
  {
    id: "platform-overview",
    topic: "Platform Help",
    title: "What can MindPrep AI do",
    questions: [
      "what can you do",
      "what features does this platform have",
      "how do i use mindprep",
      "help me get started",
      "what is mindprep ai",
      "how does this website work",
      "what can i do on this platform",
      "what all features are available here",
      "what services does this website offer",
    ],
    answer:
      "MindPrep AI helps you prepare for placements:\n• Aptitude — topic practice, timed mock tests, company-wise tests, progress and history.\n• Mock Interview — proctored AI interview with feedback on technical, communication and confidence scores.\n• Tech Practice — technology quizzes that adapt to your weak topics.\n• Resume Analyzer & Builder — ATS score, keywords and a resume editor.\n• Jobs — browse openings, see eligibility and track applications.\n• Analytics — your scores and weak areas (this page). Ask me anything about prep or your progress!",
  },
  {
    id: "platform-aptitude-how",
    topic: "Platform Help",
    title: "How to take an aptitude test",
    questions: [
      "how do i start an aptitude test",
      "how to take a mock test here",
      "where can i practice aptitude questions",
      "how do company wise aptitude tests work",
      "what is the difference between practice and mock test",
    ],
    answer:
      "Open Aptitude from the top menu. Choose Practice to pick topics and question counts at your own pace, or pick a Mock / Company test for a timed, full-length paper with scoring. Answer, then submit to see your score, per-category breakdown and explanations.\nProgress and History pages show how you are trending over time.",
  },
  {
    id: "platform-proctoring",
    topic: "Platform Help",
    title: "Proctoring, tab switching and camera",
    questions: [
      "what happens if i switch tabs during a test",
      "why was my test auto submitted",
      "how does proctoring work",
      "why is my camera not working in the interview",
      "does the interview use my webcam",
    ],
    answer:
      "Tests and interviews are proctored to keep them fair. In aptitude tests, leaving the test tab counts as a warning, and after 3 warnings the attempt is auto-submitted. Interviews additionally use your webcam to flag no face, multiple faces or a mobile phone in view.\nIf the camera does not start: allow camera permission in your browser's address bar, close other apps using the camera (Zoom, Teams), and reload the page.",
  },
  {
    id: "platform-mock-interview-how",
    topic: "Platform Help",
    title: "How the mock interview works",
    questions: [
      "how do i start a mock interview",
      "how does the ai mock interview work",
      "how is my interview scored",
      "what does the interview report show",
      "can i do a resume based interview",
    ],
    answer:
      "Go to Interview → Setup, choose the job role, experience level, interview type (technical / HR / mixed, or resume-based) and difficulty. Answer each question by voice or text. At the end you get a report with overall, technical, communication, confidence, grammar and fluency scores, plus strengths and areas to improve.\nCheck the Interview dashboard to compare attempts.",
  },
  {
    id: "platform-tech-practice-how",
    topic: "Platform Help",
    title: "How Tech Practice works",
    questions: [
      "what is tech practice",
      "how do technology quizzes work",
      "how do i practice java or python questions here",
      "why did the difficulty change in tech quiz",
    ],
    answer:
      "Tech Practice lets you pick a technology and a difficulty and answers questions one by one. It tracks your accuracy per topic: weak topics are served more often, and your level steps up or down by one level after each completed quiz. The results page shows your strengths and weaknesses per topic.",
  },
  {
    id: "platform-analytics-how",
    topic: "Platform Help",
    title: "How Analytics works",
    questions: [
      "how do i see my progress",
      "where can i see my scores",
      "how is my readiness score calculated",
      "what does the analytics page show",
    ],
    answer:
      "The Analytics page combines your completed aptitude tests, tech quizzes and mock interviews. It shows totals, average scores, a trend over time, per-topic accuracy, and your strongest and weakest areas. The readiness score is the average of the areas you have practised. Ask me 'what are my weak areas?' for a personalised summary.",
  },
];
