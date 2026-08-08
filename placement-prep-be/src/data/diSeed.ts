import { SeedQuestion } from "./seedTypes";

// Data Interpretation — 8 topics (answers computed against the given table/chart)
export const diSeed: SeedQuestion[] = [
  // ── Tables ──
  {
    cat: "Data Interpretation", topic: "Tables", diff: "beginner", time: 90,
    q: "A class's marks: Rohit 82, Sneha 91, Aman 68, Priya 85. How many students scored above 80?",
    opts: ["1", "2", "3", "4"], a: 2,
    exp: "Rohit (82), Sneha (91), Priya (85) → 3 students",
  },
  {
    cat: "Data Interpretation", topic: "Tables", diff: "intermediate", time: 120,
    q: "Sales (in ₹ lakh): Jan 40, Feb 55, Mar 50, Apr 65, May 70. What is the average monthly sales?",
    opts: ["50", "52", "56", "60"], a: 2,
    exp: "(40+55+50+65+70)/5 = 280/5 = 56",
    tags: ["TCS"],
  },
  {
    cat: "Data Interpretation", topic: "Tables", diff: "intermediate", time: 120,
    q: "Production (units): 2019=1200, 2020=1500, 2021=1800, 2022=2100. Percentage growth from 2020 to 2022 is:",
    opts: ["30%", "40%", "50%", "60%"], a: 1,
    exp: "(2100 − 1500)/1500 = 40%",
    tags: ["Infosys"],
  },

  // ── Bar Graphs ──
  {
    cat: "Data Interpretation", topic: "Bar Graphs", diff: "beginner", time: 90,
    q: "A bar graph shows exports: 2018=50, 2019=60, 2020=45 (units in $mn). The year with the highest export is:",
    opts: ["2018", "2019", "2020", "All equal"], a: 1,
    exp: "2019 has the tallest bar (60)",
    tags: ["TCS"],
  },
  {
    cat: "Data Interpretation", topic: "Bar Graphs", diff: "intermediate", time: 120,
    q: "Imports vs Exports (₹ crore): Year I: Im 80, Ex 60; Year II: Im 90, Ex 100. Trade surplus exists in:",
    opts: ["Year I only", "Year II only", "Both years", "Neither year"], a: 1,
    exp: "Surplus = exports > imports; only Year II (100 > 90)",
    tags: ["Accenture"],
  },

  // ── Line Graphs ──
  {
    cat: "Data Interpretation", topic: "Line Graphs", diff: "beginner", time: 90,
    q: "A line graph shows temperature (°C): Mon 28, Tue 30, Wed 27, Thu 33. Highest temperature was on:",
    opts: ["Monday", "Tuesday", "Wednesday", "Thursday"], a: 3,
    exp: "Thursday 33°C is the peak",
  },
  {
    cat: "Data Interpretation", topic: "Line Graphs", diff: "intermediate", time: 120,
    q: "Revenue trend (₹ lakh): Q1 60, Q2 75, Q3 90, Q4 105. The increase is constant at:",
    opts: ["10 per quarter", "15 per quarter", "20 per quarter", "25 per quarter"], a: 1,
    exp: "Each quarter rises by 15",
    tags: ["TCS"],
  },

  // ── Pie Charts ──
  {
    cat: "Data Interpretation", topic: "Pie Charts", diff: "beginner", time: 90,
    q: "A pie chart of a ₹1200 budget: Food 50%, Rent 25%, Savings 25%. Amount spent on food is:",
    opts: ["₹300", "₹400", "₹600", "₹900"], a: 2,
    exp: "50% of 1200 = ₹600",
    tags: ["Infosys"],
  },
  {
    cat: "Data Interpretation", topic: "Pie Charts", diff: "intermediate", time: 120,
    q: "A pie chart shows department split of 480 students: CS 45%, EC 25%, ME 20%, Civil 10%. Number of EC students is:",
    opts: ["96", "108", "120", "144"], a: 2,
    exp: "25% of 480 = 120",
    tags: ["TCS"],
  },
  {
    cat: "Data Interpretation", topic: "Pie Charts", diff: "advanced", time: 150,
    q: "In the same pie chart (480 students), by what number does CS exceed Civil?",
    opts: ["120", "168", "216", "240"], a: 1,
    exp: "CS 45% − Civil 10% = 35% of 480 = 168",
    tags: ["Wipro"],
  },

  // ── Mixed Graphs ──
  {
    cat: "Data Interpretation", topic: "Mixed Graphs", diff: "intermediate", time: 120,
    q: "Company revenue (bar, ₹mn) and profit % (line): 2019: Rev 200, Profit 10%; 2020: Rev 250, Profit 12%. Profit in ₹ for 2020 is:",
    opts: ["₹20 mn", "₹25 mn", "₹30 mn", "₹35 mn"], a: 2,
    exp: "12% of 250 = ₹30 mn",
    tags: ["Accenture"],
  },
  {
    cat: "Data Interpretation", topic: "Mixed Graphs", diff: "advanced", time: 150,
    q: "Using the same data, profit in ₹ in 2019 was 10% of 200 = ₹20 mn. By how much did profit grow from 2019 to 2020?",
    opts: ["₹5 mn", "₹8 mn", "₹10 mn", "₹12 mn"], a: 2,
    exp: "30 − 20 = ₹10 mn",
    tags: ["Infosys"],
  },

  // ── Caselets ──
  {
    cat: "Data Interpretation", topic: "Caselets", diff: "beginner", time: 90,
    q: "A class of 60 students: 40 pass maths, 35 pass science, 25 pass both. Students passing exactly one subject:",
    opts: ["15", "20", "25", "35"], a: 2,
    exp: "Only maths 15 + only science 10 = 25",
    tags: ["TCS"],
  },
  {
    cat: "Data Interpretation", topic: "Caselets", diff: "intermediate", time: 120,
    q: "In the same class (60 students, 40 maths, 35 science, 25 both), students failing both subjects:",
    opts: ["5", "8", "10", "12"], a: 2,
    exp: "60 − (40+35−25) = 60 − 50 = 10",
    tags: ["Infosys"],
  },
  {
    cat: "Data Interpretation", topic: "Caselets", diff: "advanced", time: 150,
    q: "Of 200 employees, 120 are engineers, 90 are managers, 40 are both. How many are neither?",
    opts: ["20", "30", "40", "50"], a: 1,
    exp: "200 − (120 + 90 − 40) = 30",
    tags: ["Accenture"],
  },

  // ── Missing Data DI ──
  {
    cat: "Data Interpretation", topic: "Missing Data DI", diff: "intermediate", time: 120,
    q: "Total sales = 500 units across A, B, C. A sold 30%, B sold 200 units. Units sold by C are:",
    opts: ["100", "150", "200", "250"], a: 1,
    exp: "A = 150, B = 200, so C = 500 − 350 = 150",
    tags: ["Wipro"],
  },
  {
    cat: "Data Interpretation", topic: "Missing Data DI", diff: "advanced", time: 150,
    q: "Average marks of 5 subjects is 70. Four subjects are 60, 75, 80, 65. The missing subject score is:",
    opts: ["65", "70", "75", "80"], a: 1,
    exp: "Total = 350; sum of four = 280 → missing = 70",
    tags: ["TCS"],
  },

  // ── Data Sufficiency (DI based) ──
  {
    cat: "Data Interpretation", topic: "Data Sufficiency (DI)", diff: "intermediate", time: 120,
    q: "What is the total production in 2022? (I) Production in 2021 was 2000 units. (II) Production grew 25% from 2021 to 2022.",
    opts: ["Statement I alone is sufficient", "Statement II alone is sufficient", "Both statements together are sufficient", "Both together are not sufficient"], a: 2,
    exp: "Need both: 2000 × 1.25 = 2500",
    tags: ["Infosys"],
  },
  {
    cat: "Data Interpretation", topic: "Data Sufficiency (DI)", diff: "advanced", time: 120,
    q: "What percentage of total exports went to Asia? (I) Exports to Asia were $240 mn. (II) Total exports were $800 mn.",
    opts: ["Statement I alone is sufficient", "Statement II alone is sufficient", "Both statements together are sufficient", "Both together are not sufficient"], a: 2,
    exp: "240/800 = 30% needs both values",
    tags: ["Accenture"],
  },
];
