/**
 * Static interview question bank — the server-side fallback used when AI
 * question generation (Groq / ai-service) is unavailable or fails.
 *
 * ~100 questions total, split across the three interview types. `{role}` is
 * replaced with the candidate's job role at selection time. Questions are
 * pitched at campus-placement / early-career level to match
 * INTERVIEW_TYPE_GUIDANCE in the mock interview controller.
 *
 * This is intentionally a plain in-repo list ("for now") — no DB, no admin UI.
 */

export type InterviewBankType = "Technical" | "HR" | "Behavioral";

export const INTERVIEW_QUESTION_BANK: Record<InterviewBankType, string[]> = {
  Technical: [
    // Core CS fundamentals
    "Explain the difference between an array and a linked list, and when you would use each.",
    "What is the time and space complexity of common sorting algorithms like merge sort and quick sort?",
    "How does a hash map work internally, and what causes collisions?",
    "Explain the difference between a stack and a queue with a real-world example.",
    "What is recursion? Describe a problem that is naturally solved recursively and its base case.",
    "Explain Big-O, Big-Theta, and Big-Omega notation in your own words.",
    "What is a binary search tree, and what is its worst-case lookup complexity?",
    "How would you detect a cycle in a linked list?",
    "Explain dynamic programming and give an example of a problem it solves efficiently.",
    "What is the difference between BFS and DFS, and when would you prefer one over the other?",
    // OOP
    "Explain the four pillars of object-oriented programming with short examples.",
    "What is the difference between an abstract class and an interface?",
    "Explain method overloading versus method overriding.",
    "What is the difference between composition and inheritance, and why is composition often preferred?",
    "What are SOLID principles? Explain any two of them.",
    // DBMS
    "What is database normalization, and why do we normalize tables?",
    "Explain the difference between an INNER JOIN and a LEFT JOIN.",
    "What is an index in a database, and what is the trade-off of adding one?",
    "Explain ACID properties in the context of database transactions.",
    "What is the difference between SQL and NoSQL databases, and when would you choose each?",
    "What is a primary key versus a foreign key?",
    // OS
    "Explain the difference between a process and a thread.",
    "What is a deadlock, and what are the conditions required for it to occur?",
    "Explain paging and how virtual memory works at a high level.",
    "What is a race condition, and how can it be prevented?",
    "Explain the difference between preemptive and non-preemptive scheduling.",
    // Networking
    "Walk me through what happens when you type a URL into a browser and press Enter.",
    "Explain the difference between TCP and UDP.",
    "What is the difference between HTTP and HTTPS?",
    "What are the main HTTP methods and what is each used for?",
    "Explain what a status code 200, 301, 404, and 500 each mean.",
    // Web / general engineering
    "Explain the difference between REST and GraphQL APIs.",
    "What is the difference between authentication and authorization?",
    "What is caching, and where in a web application would you add it?",
    "Explain what a JWT is and how it is used for stateless authentication.",
    "What is the difference between synchronous and asynchronous programming?",
    "What is CORS and why does the browser enforce it?",
    "Explain the difference between client-side and server-side rendering.",
    // Practice / craft
    "Describe your approach to debugging a bug you cannot reproduce locally.",
    "How do you decide what to unit test versus integration test?",
    "Walk me through how you would review a teammate's pull request.",
    "What does 'clean code' mean to you? Give a concrete example.",
    "How do you use version control day to day? Explain a merge conflict and how you resolve it.",
    "Explain what CI/CD is and why it matters for a team.",
    // Role-flavoured
    "What technologies and tools are core to a {role} role, and which are you strongest in?",
    "Describe a project relevant to {role} that you are proud of and your specific contribution.",
    "How would you design a scalable system for a common {role} feature? Talk through the trade-offs.",
    "What common mistakes should a {role} avoid, and how do you guard against them?",
    "How do you keep your {role} skills current, and what have you learned recently?",
    "How would you measure whether your work as a {role} is successful?",
  ],

  HR: [
    "Tell me about yourself.",
    "Why are you interested in a {role} position?",
    "Why do you want to work at our company specifically?",
    "What are your three greatest strengths, with an example of each?",
    "What is a weakness you are actively working to improve?",
    "Where do you see yourself in three to five years?",
    "Why should we hire you for this {role} role over other candidates?",
    "What do you know about our company and the products or services we offer?",
    "What motivates you to do your best work?",
    "How do you handle constructive criticism or negative feedback?",
    "Describe your ideal work environment and team culture.",
    "How do you prioritise your work when everything feels urgent?",
    "Tell me about an accomplishment you are most proud of.",
    "Describe a time you failed. What happened and what did you learn?",
    "What are your salary expectations, and how did you arrive at that number?",
    "Are you willing to relocate or work from the office if required?",
    "How do you handle stress and pressure at work?",
    "What kind of manager brings out your best work?",
    "Tell me about a time you had a conflict with a colleague and how you resolved it.",
    "What questions do you have for us about the {role} or the team?",
    "Why are you leaving your current role / looking for a new opportunity?",
    "How do you define success in a {role} position?",
    "What is one thing about yourself that is not on your resume?",
    "Describe a time you had to learn something completely new for a job or project.",
    "How do you stay organised across multiple responsibilities?",
    "What would your previous manager or professor say is your biggest area for growth?",
    "How do you approach working with people whose working style is very different from yours?",
    "What are you looking for in your next role that you did not have before?",
  ],

  Behavioral: [
    "Tell me about a time you worked on a team to deliver something under a tight deadline.",
    "Describe a situation where you disagreed with a teammate. How did you handle it?",
    "Tell me about a time you took the lead on a project or initiative.",
    "Describe a time you made a mistake at work or in a project. What did you do next?",
    "Tell me about a time you had to learn a new tool or technology quickly to get something done.",
    "Describe a situation where you had to persuade others to adopt your idea or approach.",
    "Tell me about a time you received difficult feedback. How did you respond?",
    "Describe a time you had to make a decision without having all the information you wanted.",
    "Tell me about a time a project did not go as planned. What did you learn?",
    "Describe a time you helped a teammate who was struggling.",
    "Tell me about a time you went beyond what was asked of you.",
    "Describe a conflict between two people on your team and how you helped resolve it.",
    "Tell me about a time you had to balance quality with a deadline. What did you choose?",
    "Describe a situation where you had to adapt to a significant change in scope or priorities.",
    "Tell me about a time you had to give someone difficult feedback.",
    "Describe a time you failed to meet a commitment. How did you communicate it?",
    "Tell me about a time you handled multiple competing priorities. How did you decide what came first?",
    "Describe a time you disagreed with a decision made by someone more senior. What did you do?",
    "Tell me about a time you improved a process or made something more efficient.",
    "Describe a time you had to work with limited resources or support.",
    "Tell me about a time you had to stay motivated on a long or tedious task.",
    "Describe a situation where you had to communicate a complex idea to a non-technical audience.",
    "Tell me about a time your initial approach to a problem did not work. What did you do instead?",
    "Describe a time you took responsibility for a team outcome, good or bad.",
    "Tell me about a time you had to build a working relationship with someone difficult.",
    "Describe a time you identified a risk early and what action you took.",
    "Tell me about a time you had to deliver results in an unfamiliar domain relevant to {role}.",
  ],
};

/**
 * Returns `count` distinct questions for the given interview type, role-filled
 * and shuffled. Pads with a generic prompt only if the pool is smaller than
 * `count` (it never is for count <= 15).
 */
export function pickBankQuestions(
  jobRole: string,
  type: string,
  count: number,
  exclude: Set<string> = new Set()
): string[] {
  const pool =
    INTERVIEW_QUESTION_BANK[(type as InterviewBankType)] ?? INTERVIEW_QUESTION_BANK.Technical;

  const fill = (q: string) => q.replace(/\{role\}/g, jobRole || "this");

  const shuffled = [...pool]
    .map((q) => fill(q))
    .sort(() => Math.random() - 0.5);

  const seen = new Set<string>();
  const selected: string[] = [];
  for (const q of shuffled) {
    const key = q.trim().toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    selected.push(q);
    if (selected.length >= count) break;
  }

  while (selected.length < count) {
    selected.push(
      fill(`Tell me about your experience relevant to a {role} role and how you apply it.`)
    );
  }
  return selected.slice(0, count);
}
