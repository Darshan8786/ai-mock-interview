/**
 * Local skills dictionary used for ALL resume/job-description skill matching
 * (extraction, ATS keyword checks, and skill-gap analysis). No AI API is
 * used anywhere in this matching - it is plain keyword/alias detection
 * against a curated taxonomy, the same technique real ATS keyword scanners
 * use.
 *
 * Each entry maps a canonical skill name to the ways candidates/recruiters
 * actually write it. Matching is case-insensitive, word-boundary aware, and
 * tolerant of common separators (e.g. "Node.js" also matches "nodejs",
 * "node js").
 */

export interface SkillDef {
  canonical: string;
  aliases: string[];
  category: string;
}

export const SKILLS_TAXONOMY: SkillDef[] = [
  // Languages
  { canonical: "Python", aliases: ["python", "python3"], category: "Language" },
  { canonical: "Java", aliases: ["java"], category: "Language" },
  { canonical: "C", aliases: ["c programming", " c ", "c language"], category: "Language" },
  { canonical: "C++", aliases: ["c++", "cpp"], category: "Language" },
  { canonical: "C#", aliases: ["c#", "csharp", "c sharp"], category: "Language" },
  { canonical: "JavaScript", aliases: ["javascript", "js", "ecmascript"], category: "Language" },
  { canonical: "TypeScript", aliases: ["typescript", "ts"], category: "Language" },
  { canonical: "Go", aliases: ["golang", " go "], category: "Language" },
  { canonical: "Rust", aliases: ["rust"], category: "Language" },
  { canonical: "Ruby", aliases: ["ruby"], category: "Language" },
  { canonical: "PHP", aliases: ["php"], category: "Language" },
  { canonical: "Swift", aliases: ["swift"], category: "Language" },
  { canonical: "Kotlin", aliases: ["kotlin"], category: "Language" },
  { canonical: "Scala", aliases: ["scala"], category: "Language" },
  { canonical: "R", aliases: ["r programming", "r language"], category: "Language" },
  { canonical: "MATLAB", aliases: ["matlab"], category: "Language" },

  // Web / Frontend
  { canonical: "HTML", aliases: ["html", "html5"], category: "Web" },
  { canonical: "CSS", aliases: ["css", "css3"], category: "Web" },
  { canonical: "React", aliases: ["react", "react.js", "reactjs"], category: "Web" },
  { canonical: "Redux", aliases: ["redux"], category: "Web" },
  { canonical: "Angular", aliases: ["angular", "angularjs"], category: "Web" },
  { canonical: "Vue.js", aliases: ["vue", "vue.js", "vuejs"], category: "Web" },
  { canonical: "Next.js", aliases: ["next.js", "nextjs"], category: "Web" },
  { canonical: "Node.js", aliases: ["node.js", "nodejs", "node js"], category: "Web" },
  { canonical: "Express.js", aliases: ["express.js", "expressjs", "express"], category: "Web" },
  { canonical: "Tailwind CSS", aliases: ["tailwind", "tailwind css", "tailwindcss"], category: "Web" },
  { canonical: "Bootstrap", aliases: ["bootstrap"], category: "Web" },
  { canonical: "jQuery", aliases: ["jquery"], category: "Web" },
  { canonical: "REST API", aliases: ["rest api", "restful", "rest apis"], category: "Web" },
  { canonical: "GraphQL", aliases: ["graphql"], category: "Web" },
  { canonical: "WebSockets", aliases: ["websocket", "websockets"], category: "Web" },
  { canonical: "Django", aliases: ["django"], category: "Web" },
  { canonical: "Flask", aliases: ["flask"], category: "Web" },
  { canonical: "Spring Boot", aliases: ["spring boot", "spring framework", "springboot"], category: "Web" },
  { canonical: ".NET", aliases: [".net", "dotnet", "asp.net"], category: "Web" },
  { canonical: "FastAPI", aliases: ["fastapi"], category: "Web" },
  { canonical: "Sass/SCSS", aliases: ["sass", "scss"], category: "Web" },
  { canonical: "Webpack", aliases: ["webpack"], category: "Web" },
  { canonical: "Vite", aliases: ["vite", "vite.js", "vitejs"], category: "Web" },
  { canonical: "Socket.io", aliases: ["socket.io", "socketio"], category: "Web" },
  { canonical: "Material UI", aliases: ["material ui", "material-ui", "mui"], category: "Web" },

  // Databases
  { canonical: "SQL", aliases: ["sql"], category: "Database" },
  { canonical: "MySQL", aliases: ["mysql"], category: "Database" },
  { canonical: "PostgreSQL", aliases: ["postgresql", "postgres"], category: "Database" },
  { canonical: "MongoDB", aliases: ["mongodb", "mongo"], category: "Database" },
  { canonical: "Redis", aliases: ["redis"], category: "Database" },
  { canonical: "SQLite", aliases: ["sqlite"], category: "Database" },
  { canonical: "Oracle DB", aliases: ["oracle db", "oracle database", "pl/sql"], category: "Database" },
  { canonical: "DBMS", aliases: ["dbms", "database management"], category: "Database" },
  { canonical: "Firebase", aliases: ["firebase", "firestore"], category: "Database" },
  { canonical: "Elasticsearch", aliases: ["elasticsearch", "elastic search"], category: "Database" },

  // Cloud / DevOps
  { canonical: "AWS", aliases: ["aws", "amazon web services"], category: "Cloud/DevOps" },
  { canonical: "Azure", aliases: ["azure", "microsoft azure"], category: "Cloud/DevOps" },
  { canonical: "Google Cloud", aliases: ["gcp", "google cloud"], category: "Cloud/DevOps" },
  { canonical: "Docker", aliases: ["docker", "containerization"], category: "Cloud/DevOps" },
  { canonical: "Kubernetes", aliases: ["kubernetes", "k8s"], category: "Cloud/DevOps" },
  { canonical: "Terraform", aliases: ["terraform"], category: "Cloud/DevOps" },
  { canonical: "CI/CD", aliases: ["ci/cd", "continuous integration", "continuous deployment"], category: "Cloud/DevOps" },
  { canonical: "Jenkins", aliases: ["jenkins"], category: "Cloud/DevOps" },
  { canonical: "GitHub Actions", aliases: ["github actions"], category: "Cloud/DevOps" },
  { canonical: "Linux", aliases: ["linux", "unix"], category: "Cloud/DevOps" },
  { canonical: "Bash", aliases: ["bash", "shell scripting"], category: "Cloud/DevOps" },
  { canonical: "Nginx", aliases: ["nginx"], category: "Cloud/DevOps" },
  { canonical: "Ansible", aliases: ["ansible"], category: "Cloud/DevOps" },
  { canonical: "Kafka", aliases: ["kafka", "apache kafka"], category: "Cloud/DevOps" },
  { canonical: "RabbitMQ", aliases: ["rabbitmq"], category: "Cloud/DevOps" },
  { canonical: "gRPC", aliases: ["grpc"], category: "Cloud/DevOps" },
  { canonical: "Heroku", aliases: ["heroku"], category: "Cloud/DevOps" },
  { canonical: "Vercel", aliases: ["vercel"], category: "Cloud/DevOps" },
  { canonical: "Netlify", aliases: ["netlify"], category: "Cloud/DevOps" },

  // Data / ML
  { canonical: "Machine Learning", aliases: ["machine learning", " ml "], category: "Data/ML" },
  { canonical: "Deep Learning", aliases: ["deep learning"], category: "Data/ML" },
  { canonical: "TensorFlow", aliases: ["tensorflow"], category: "Data/ML" },
  { canonical: "PyTorch", aliases: ["pytorch"], category: "Data/ML" },
  { canonical: "Scikit-learn", aliases: ["scikit-learn", "sklearn"], category: "Data/ML" },
  { canonical: "Pandas", aliases: ["pandas"], category: "Data/ML" },
  { canonical: "NumPy", aliases: ["numpy"], category: "Data/ML" },
  { canonical: "Data Analysis", aliases: ["data analysis", "data analytics"], category: "Data/ML" },
  { canonical: "NLP", aliases: ["nlp", "natural language processing"], category: "Data/ML" },
  { canonical: "Computer Vision", aliases: ["computer vision", "opencv"], category: "Data/ML" },
  { canonical: "Data Visualization", aliases: ["data visualization"], category: "Data/ML" },
  { canonical: "Tableau", aliases: ["tableau"], category: "Data/ML" },
  { canonical: "Power BI", aliases: ["power bi", "powerbi"], category: "Data/ML" },
  { canonical: "Big Data", aliases: ["big data", "hadoop", "spark", "pyspark"], category: "Data/ML" },
  { canonical: "Excel", aliases: ["excel", "microsoft excel"], category: "Data/ML" },

  // Testing / QA
  { canonical: "Unit Testing", aliases: ["unit testing", "unit tests"], category: "Testing" },
  { canonical: "Selenium", aliases: ["selenium"], category: "Testing" },
  { canonical: "Jest", aliases: ["jest"], category: "Testing" },
  { canonical: "Cypress", aliases: ["cypress"], category: "Testing" },
  { canonical: "JUnit", aliases: ["junit"], category: "Testing" },
  { canonical: "TDD", aliases: ["tdd", "test driven development"], category: "Testing" },
  { canonical: "Postman", aliases: ["postman"], category: "Testing" },

  // Tools
  { canonical: "Git", aliases: ["git"], category: "Tool" },
  { canonical: "GitHub", aliases: ["github"], category: "Tool" },
  { canonical: "Jira", aliases: ["jira"], category: "Tool" },
  { canonical: "Figma", aliases: ["figma"], category: "Tool" },
  { canonical: "VS Code", aliases: ["vs code", "visual studio code"], category: "Tool" },

  // Mobile
  { canonical: "Android", aliases: ["android", "android development"], category: "Mobile" },
  { canonical: "iOS", aliases: ["ios", "ios development"], category: "Mobile" },
  { canonical: "React Native", aliases: ["react native"], category: "Mobile" },
  { canonical: "Flutter", aliases: ["flutter"], category: "Mobile" },

  // Other
  { canonical: "Unity", aliases: ["unity", "unity3d"], category: "Tool" },
  { canonical: "Solidity", aliases: ["solidity"], category: "Tool" },
  { canonical: "Blockchain", aliases: ["blockchain"], category: "Tool" },

  // CS fundamentals
  { canonical: "Data Structures", aliases: ["data structures", "dsa"], category: "Fundamentals" },
  { canonical: "Algorithms", aliases: ["algorithms"], category: "Fundamentals" },
  { canonical: "OOP", aliases: ["oop", "object oriented programming", "object-oriented"], category: "Fundamentals" },
  { canonical: "System Design", aliases: ["system design"], category: "Fundamentals" },
  { canonical: "Operating Systems", aliases: ["operating systems"], category: "Fundamentals" },
  { canonical: "Computer Networks", aliases: ["computer networks", "networking"], category: "Fundamentals" },
  { canonical: "Microservices", aliases: ["microservices", "microservice architecture"], category: "Fundamentals" },

  // Methodologies
  { canonical: "Agile", aliases: ["agile", "agile methodology"], category: "Methodology" },
  { canonical: "Scrum", aliases: ["scrum"], category: "Methodology" },
  { canonical: "Kanban", aliases: ["kanban"], category: "Methodology" },

  // Soft skills
  { canonical: "Communication", aliases: ["communication skills", "communication"], category: "Soft Skill" },
  { canonical: "Leadership", aliases: ["leadership"], category: "Soft Skill" },
  { canonical: "Teamwork", aliases: ["teamwork", "team player", "collaboration"], category: "Soft Skill" },
  { canonical: "Problem Solving", aliases: ["problem solving", "problem-solving"], category: "Soft Skill" },
  { canonical: "Time Management", aliases: ["time management"], category: "Soft Skill" },
  { canonical: "Adaptability", aliases: ["adaptability"], category: "Soft Skill" },
  { canonical: "Critical Thinking", aliases: ["critical thinking"], category: "Soft Skill" },
  { canonical: "Project Management", aliases: ["project management"], category: "Soft Skill" },
];

function toWordBoundaryRegex(alias: string): RegExp {
  const trimmed = alias.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s.-]*");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

const COMPILED = SKILLS_TAXONOMY.map((def) => ({
  def,
  patterns: def.aliases.map(toWordBoundaryRegex),
}));

/** Returns the canonical skill names found anywhere in `text`, in taxonomy order. */
export function extractSkillsFromText(text: string): string[] {
  const found: string[] = [];
  for (const { def, patterns } of COMPILED) {
    if (patterns.some((re) => re.test(text))) {
      found.push(def.canonical);
    }
  }
  return found;
}

/** Maps free-text skill labels (e.g. from a resume-builder form) to canonical names, unmatched labels pass through unchanged. */
export function canonicalizeSkillLabel(label: string): string {
  const lower = label.trim().toLowerCase();
  for (const { def, patterns } of COMPILED) {
    if (patterns.some((re) => re.test(lower))) return def.canonical;
  }
  return label.trim();
}
