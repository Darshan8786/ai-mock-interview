import { SeedQuestion } from "./seedTypes";

// Quantitative Aptitude — 26 topics
export const quantSeed: SeedQuestion[] = [
  // ── Percentage ──
  { cat: "Quantitative", topic: "Percentage", diff: "beginner", q: "What is 20% of 150?", opts: ["20", "25", "30", "35"], a: 2, exp: "150 × 20/100 = 30", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Percentage", diff: "beginner", q: "If 30% of a number is 45, what is the number?", opts: ["120", "135", "150", "180"], a: 2, exp: "Number × 30/100 = 45 → Number = 150", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Percentage", diff: "intermediate", q: "A number is first increased by 20% and then decreased by 20%. The net change is:", opts: ["No change", "4% increase", "4% decrease", "2% decrease"], a: 2, exp: "Net = x × 1.2 × 0.8 = 0.96x → 4% decrease", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Percentage", diff: "intermediate", q: "In an exam, a student scored 420 out of 600. What is his percentage?", opts: ["65%", "70%", "72%", "75%"], a: 1, exp: "420/600 × 100 = 70%", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Percentage", diff: "advanced", q: "A candidate got 45% of the total votes and lost by 300 votes. Total votes polled were:", opts: ["1200", "1500", "3000", "6000"], a: 2, exp: "Loser 45%, winner 55%, difference 10% = 300 → total = 3000", tags: ["Wipro"], time: 75 },

  // ── Profit and Loss ──
  { cat: "Quantitative", topic: "Profit and Loss", diff: "beginner", q: "A shopkeeper buys an article for ₹200 and sells it for ₹250. His profit percent is:", opts: ["20%", "25%", "30%", "50%"], a: 1, exp: "Profit = 50; Profit% = 50/200 × 100 = 25%", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Profit and Loss", diff: "beginner", q: "A pen is sold at ₹90 at a loss of 10%. Its cost price is:", opts: ["₹81", "₹99", "₹100", "₹110"], a: 2, exp: "SP = 90% of CP → CP = 90/0.9 = ₹100", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Profit and Loss", diff: "intermediate", q: "An article is sold at a profit of 20%. If it had been sold at a profit of 35%, the gain would have been ₹150 more. The cost price is:", opts: ["₹800", "₹900", "₹1000", "₹1200"], a: 2, exp: "15% of CP = 150 → CP = 1000", tags: ["Accenture"], time: 60 },
  { cat: "Quantitative", topic: "Profit and Loss", diff: "intermediate", q: "A trader marks his goods 25% above CP and gives a 10% discount. His net profit percent is:", opts: ["10%", "12.5%", "15%", "17.5%"], a: 1, exp: "SP = 1.25CP × 0.9 = 1.125CP → 12.5% profit", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Profit and Loss", diff: "advanced", q: "By selling 33 metres of cloth, a shopkeeper gains the selling price of 11 metres. The gain percent is:", opts: ["25%", "33.33%", "50%", "66.66%"], a: 2, exp: "Gain = 11m SP on 33m → profit% = 11/22 × 100 = 50%", tags: ["Wipro"], time: 75 },

  // ── Simple Interest ──
  { cat: "Quantitative", topic: "Simple Interest", diff: "beginner", q: "Simple interest on ₹1000 at 8% per annum for 2 years is:", opts: ["₹120", "₹140", "₹160", "₹180"], a: 2, exp: "SI = 1000 × 8 × 2 / 100 = ₹160", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Simple Interest", diff: "beginner", q: "In how many years will ₹600 double itself at 10% simple interest?", opts: ["5", "8", "10", "12"], a: 2, exp: "SI = P → 600 = 600 × 10 × t/100 → t = 10 years", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Simple Interest", diff: "intermediate", q: "A sum becomes ₹2200 in 2 years and ₹2800 in 5 years at simple interest. The principal is:", opts: ["₹1600", "₹1800", "₹2000", "₹2400"], a: 1, exp: "SI in 3 years = 600 → per year 200; 2-year SI = 400 → P = 2200 − 400 = 1800", tags: ["TCS"], time: 75 },
  { cat: "Quantitative", topic: "Simple Interest", diff: "intermediate", q: "At what rate percent per annum will ₹4000 yield ₹600 as simple interest in 3 years?", opts: ["4%", "5%", "6%", "7.5%"], a: 1, exp: "R = 600 × 100 / (4000 × 3) = 5%", tags: ["Infosys"], time: 60 },

  // ── Compound Interest ──
  { cat: "Quantitative", topic: "Compound Interest", diff: "beginner", q: "Compound interest on ₹5000 at 10% per annum for 2 years (compounded annually) is:", opts: ["₹1000", "₹1025", "₹1050", "₹1100"], a: 2, exp: "A = 5000 × 1.1² = 6050 → CI = 1050", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Compound Interest", diff: "intermediate", q: "The difference between CI and SI on ₹4000 for 2 years at 10% is:", opts: ["₹20", "₹40", "₹60", "₹80"], a: 1, exp: "Diff = P(r/100)² = 4000 × 0.01 = ₹40", tags: ["Infosys"], time: 75 },
  { cat: "Quantitative", topic: "Compound Interest", diff: "advanced", q: "At what rate percent per annum (compounded annually) will ₹2000 amount to ₹2662 in 3 years?", opts: ["8%", "10%", "12%", "15%"], a: 1, exp: "2662/2000 = 1.331 = 1.1³ → 10%", tags: ["Accenture"], time: 90 },
  { cat: "Quantitative", topic: "Compound Interest", diff: "intermediate", q: "The compound interest on a sum for 2 years is ₹820 and simple interest is ₹800. The rate of interest per annum is:", opts: ["2.5%", "5%", "7.5%", "10%"], a: 1, exp: "Diff 20 = P(r/100)² and 800 = P × r × 2/100 → r = 5%", tags: ["Wipro"], time: 90 },

  // ── Average ──
  { cat: "Quantitative", topic: "Average", diff: "beginner", q: "Average of first 10 natural numbers is:", opts: ["5", "5.5", "6", "4.5"], a: 1, exp: "(10 × 11 / 2) / 10 = 5.5", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Average", diff: "beginner", q: "The average of 5 numbers is 27. If one number is excluded, the average becomes 25. The excluded number is:", opts: ["30", "32", "35", "38"], a: 2, exp: "Sum5 = 135, Sum4 = 100, excluded = 35", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Average", diff: "intermediate", q: "The average of 11 numbers is 50. The average of first 6 is 49 and of last 6 is 52. The 6th number is:", opts: ["52", "54", "56", "58"], a: 2, exp: "6th = (49×6 + 52×6) − 50×11 = 606 − 550 = 56", tags: ["TCS"], time: 90 },
  { cat: "Quantitative", topic: "Average", diff: "intermediate", q: "The average age of a group of 20 students is 15. If a teacher's age is added, the average becomes 16. The teacher's age is:", opts: ["30", "32", "35", "36"], a: 3, exp: "Total21 = 21×16 = 336; students = 20×15 = 300 → teacher = 36", tags: ["Accenture"], time: 60 },

  // ── Ratio and Proportion ──
  { cat: "Quantitative", topic: "Ratio and Proportion", diff: "beginner", q: "If A:B = 3:4 and B:C = 6:5, then A:C is:", opts: ["9:10", "3:5", "18:20", "9:20"], a: 0, exp: "A:C = 3×6 : 4×5 = 18:20 = 9:10", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Ratio and Proportion", diff: "beginner", q: "Two numbers are in the ratio 5:7 and their sum is 60. The larger number is:", opts: ["25", "30", "35", "42"], a: 2, exp: "12 parts = 60 → part = 5 → 7×5 = 35", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Ratio and Proportion", diff: "intermediate", q: "In a mixture of 80 litres, milk and water are in ratio 3:1. How much water must be added to make the ratio 2:1?", opts: ["5 L", "8 L", "10 L", "12 L"], a: 2, exp: "Milk 60, Water 20. Add x water: 60/(20+x) = 2/1 → x = 10", tags: ["Wipro"], time: 90 },
  { cat: "Quantitative", topic: "Ratio and Proportion", diff: "advanced", q: "The ratio of incomes of A and B is 4:5 and their expenditures are 5:6. If each saves ₹600, A's income is:", opts: ["₹1800", "₹2000", "₹2400", "₹3000"], a: 2, exp: "(4x−5y)/(5x−6y) ... solve savings: 4x−5y=600, 5x−6y=600 → x=600,y=360 → A income 2400", tags: ["TCS"], time: 120 },

  // ── Time and Work ──
  { cat: "Quantitative", topic: "Time and Work", diff: "beginner", q: "A alone can do a work in 10 days and B alone in 15 days. Working together, they will finish in:", opts: ["5 days", "6 days", "7.5 days", "12.5 days"], a: 1, exp: "Together = 10×15/25 = 6 days", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Time and Work", diff: "beginner", q: "A can do a piece of work in 12 days. How much of the work can he do in 3 days?", opts: ["1/4", "1/3", "1/2", "2/3"], a: 0, exp: "3/12 = 1/4", tags: ["Infosys"], time: 30 },
  { cat: "Quantitative", topic: "Time and Work", diff: "intermediate", q: "A and B can do a work in 12 days, B and C in 15 days, C and A in 20 days. A alone will take:", opts: ["24 days", "30 days", "36 days", "40 days"], a: 1, exp: "2(A+B+C) = 1/12+1/15+1/20 = 1/5 → A+B+C = 1/10 → A = 1/10 − 1/15 = 1/30 → 30 days", tags: ["Accenture"], time: 120 },
  { cat: "Quantitative", topic: "Time and Work", diff: "intermediate", q: "20 men can do a work in 15 days. How many men are needed to do the same work in 10 days?", opts: ["25", "30", "35", "40"], a: 1, exp: "M1×D1 = M2×D2 → 20×15 = M2×10 → M2 = 30", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Time and Work", diff: "advanced", q: "A is twice as good as B and together they finish a work in 18 days. A alone will finish in:", opts: ["24 days", "27 days", "30 days", "36 days"], a: 1, exp: "Let A's rate = 2x, B = x. 3x = 1/18 → x = 1/54 → A = 1/27 → 27 days", tags: ["Wipro"], time: 90 },

  // ── Pipes and Cisterns ──
  { cat: "Quantitative", topic: "Pipes and Cisterns", diff: "beginner", q: "A pipe can fill a tank in 8 hours and another pipe can empty it in 12 hours. If both are opened together, the tank will fill in:", opts: ["20 hours", "24 hours", "30 hours", "36 hours"], a: 1, exp: "Net rate = 1/8 − 1/12 = 1/24 → 24 hours", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Pipes and Cisterns", diff: "beginner", q: "Three pipes can fill a tank in 10, 15 and 30 hours. All opened together, the tank fills in:", opts: ["5 hours", "6 hours", "7.5 hours", "8 hours"], a: 0, exp: "Rate = 1/10+1/15+1/30 = 1/5 → 5 hours", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Pipes and Cisterns", diff: "intermediate", q: "A pipe fills a tank in 6 hours. Due to a leak, it now takes 9 hours. The leak alone can empty the full tank in:", opts: ["12 hours", "15 hours", "18 hours", "24 hours"], a: 2, exp: "Leak rate = 1/6 − 1/9 = 1/18 → 18 hours", tags: ["Accenture"], time: 75 },

  // ── Time, Speed and Distance ──
  { cat: "Quantitative", topic: "Time, Speed and Distance", diff: "beginner", q: "A car travels 180 km in 3 hours. Its speed is:", opts: ["50 km/h", "55 km/h", "60 km/h", "65 km/h"], a: 2, exp: "180/3 = 60 km/h", tags: ["TCS"], time: 30 },
  { cat: "Quantitative", topic: "Time, Speed and Distance", diff: "beginner", q: "A man covers a distance at 4 km/h and returns at 6 km/h. His average speed for the whole journey is:", opts: ["4.5 km/h", "4.8 km/h", "5 km/h", "5.2 km/h"], a: 1, exp: "Avg = 2×4×6/(4+6) = 4.8 km/h", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Time, Speed and Distance", diff: "intermediate", q: "A train 150 m long crosses a pole in 15 seconds. Its speed in km/h is:", opts: ["30", "36", "45", "54"], a: 1, exp: "Speed = 150/15 = 10 m/s = 36 km/h", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Time, Speed and Distance", diff: "intermediate", q: "Walking at 3/4 of his usual speed, a man is 20 minutes late. His usual time is:", opts: ["40 min", "60 min", "75 min", "80 min"], a: 1, exp: "Time ratio 4:3, difference 1 part = 20 → usual = 60 min", tags: ["Wipro"], time: 90 },
  { cat: "Quantitative", topic: "Time, Speed and Distance", diff: "advanced", q: "Two trains 120 m and 80 m long run in opposite directions at 60 km/h and 48 km/h. Time taken to cross each other is:", opts: ["5 s", "6.67 s", "7.5 s", "8 s"], a: 1, exp: "Relative = 108 km/h = 30 m/s; distance = 200 m → 200/30 = 6.67 s", tags: ["Accenture"], time: 90 },

  // ── Problems on Trains ──
  { cat: "Quantitative", topic: "Problems on Trains", diff: "beginner", q: "A 300 m long train crosses a platform of 200 m in 50 seconds. Its speed is:", opts: ["30 km/h", "36 km/h", "40 km/h", "45 km/h"], a: 1, exp: "Distance = 500 m, time 50 s → 10 m/s = 36 km/h", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Problems on Trains", diff: "intermediate", q: "A train 200 m long crosses a pole in 10 seconds. Its speed in km/h is:", opts: ["60", "72", "80", "90"], a: 1, exp: "200/10 = 20 m/s = 72 km/h", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Problems on Trains", diff: "advanced", q: "A train 150 m long passes a man running at 9 km/h in the same direction in 15 seconds. The train's speed is:", opts: ["36 km/h", "45 km/h", "50 km/h", "54 km/h"], a: 1, exp: "Relative = 150/15 = 10 m/s = 36 km/h → train = 36 + 9 = 45 km/h", tags: ["Wipro"], time: 90 },

  // ── Boats and Streams ──
  { cat: "Quantitative", topic: "Boats and Streams", diff: "beginner", q: "A boat goes 12 km upstream in 3 hours and 12 km downstream in 2 hours. The speed of the stream is:", opts: ["1 km/h", "1.5 km/h", "2 km/h", "2.5 km/h"], a: 0, exp: "Down 6, Up 4 → stream = (6−4)/2 = 1 km/h", tags: ["TCS"], time: 75 },
  { cat: "Quantitative", topic: "Boats and Streams", diff: "intermediate", q: "Speed of a boat in still water is 8 km/h and stream is 2 km/h. Time to go 30 km upstream is:", opts: ["3 h", "4 h", "5 h", "6 h"], a: 2, exp: "Upstream speed 6 → 30/6 = 5 hours", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Boats and Streams", diff: "intermediate", q: "A man can row upstream at 10 km/h and downstream at 14 km/h. Speed of the stream is:", opts: ["1 km/h", "2 km/h", "3 km/h", "4 km/h"], a: 1, exp: "(14 − 10)/2 = 2 km/h", tags: ["Accenture"], time: 45 },

  // ── Problems on Ages ──
  { cat: "Quantitative", topic: "Problems on Ages", diff: "beginner", q: "The sum of ages of a father and son is 50. The father is 30 years older. The son's age is:", opts: ["8", "10", "12", "15"], a: 1, exp: "x + (x+30) = 50 → x = 10", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Problems on Ages", diff: "intermediate", q: "A father is three times as old as his son. After 12 years, he will be twice as old. The son's present age is:", opts: ["10", "12", "14", "16"], a: 1, exp: "3x + 12 = 2(x + 12) → x = 12", tags: ["Infosys"], time: 75 },
  { cat: "Quantitative", topic: "Problems on Ages", diff: "intermediate", q: "Five years ago, A's age was twice B's. In five years, A will be 1.5 times B. A's present age is:", opts: ["20", "25", "30", "35"], a: 1, exp: "A−5 = 2(B−5); A+5 = 1.5(B+5) → B=15, A=25", tags: ["Wipro"], time: 120 },

  // ── Number System ──
  { cat: "Quantitative", topic: "Number System", diff: "beginner", q: "Which of the following is a prime number?", opts: ["91", "87", "93", "97"], a: 3, exp: "97 is prime; 91=7×13, 87=3×29, 93=3×31", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Number System", diff: "beginner", q: "The sum of the first 20 natural numbers is:", opts: ["190", "210", "220", "400"], a: 1, exp: "20×21/2 = 210", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Number System", diff: "intermediate", q: "The product of two numbers is 120 and their HCF is 6. Their LCM is:", opts: ["12", "20", "24", "30"], a: 1, exp: "LCM = Product/HCF = 120/6 = 20", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Number System", diff: "advanced", q: "What least number must be added to 1825 to make it a perfect square?", opts: ["14", "21", "24", "25"], a: 2, exp: "43² = 1849 and 1849 − 1825 = 24", tags: ["Accenture"], time: 90 },

  // ── HCF and LCM ──
  { cat: "Quantitative", topic: "HCF and LCM", diff: "beginner", q: "HCF of 36, 48 and 60 is:", opts: ["6", "8", "12", "16"], a: 2, exp: "12 divides all three", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "HCF and LCM", diff: "beginner", q: "LCM of 8, 12 and 18 is:", opts: ["48", "60", "72", "96"], a: 2, exp: "LCM = 72", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "HCF and LCM", diff: "intermediate", q: "The smallest number which leaves remainder 3 when divided by 4, 6 and 10 is:", opts: ["57", "60", "63", "67"], a: 2, exp: "LCM(4,6,10) = 60 → 60 + 3 = 63", tags: ["Accenture"], time: 75 },

  // ── Partnership ──
  { cat: "Quantitative", topic: "Partnership", diff: "beginner", q: "A invests ₹5000 and B invests ₹7000 in a business. Profit of ₹2400 is shared as:", opts: ["A 1000, B 1400", "A 1200, B 1200", "A 1400, B 1000", "A 1100, B 1300"], a: 0, exp: "Ratio 5:7 → A = 2400×5/12 = 1000, B = 1400", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Partnership", diff: "intermediate", q: "A and B start a business; A invests ₹6000 for 8 months and B ₹4000 for 12 months. Profit ratio is:", opts: ["1:1", "2:1", "3:2", "4:3"], a: 0, exp: "6000×8 : 4000×12 = 48000 : 48000 = 1:1", tags: ["Infosys"], time: 75 },
  { cat: "Quantitative", topic: "Partnership", diff: "intermediate", q: "A, B and C invest in ratio 2:3:4. B's share in a profit of ₹4500 is:", opts: ["₹1000", "₹1500", "₹1800", "₹2000"], a: 1, exp: "9 parts = 4500 → part 500 → B = 3×500 = 1500", tags: ["Wipro"], time: 60 },

  // ── Mixtures and Alligation ──
  { cat: "Quantitative", topic: "Mixtures and Alligation", diff: "beginner", q: "A mixture of 40 litres contains milk and water in ratio 3:1. Milk present is:", opts: ["20 L", "25 L", "30 L", "35 L"], a: 2, exp: "40 × 3/4 = 30 L", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Mixtures and Alligation", diff: "intermediate", q: "In what ratio must a shopkeeper mix two varieties of rice at ₹30/kg and ₹40/kg to get a mixture worth ₹35/kg?", opts: ["1:1", "1:2", "2:1", "3:2"], a: 0, exp: "(35−30):(40−35) = 5:5 = 1:1", tags: ["Infosys"], time: 75 },
  { cat: "Quantitative", topic: "Mixtures and Alligation", diff: "advanced", q: "A vessel contains 80 L milk. 16 L is drawn and replaced by water, done twice. Milk left is:", opts: ["48 L", "51.2 L", "54 L", "56 L"], a: 1, exp: "80(1 − 16/80)² = 80 × 0.8² = 51.2 L", tags: ["Accenture"], time: 90 },

  // ── Permutation and Combination ──
  { cat: "Quantitative", topic: "Permutation and Combination", diff: "beginner", q: "In how many ways can 4 books be arranged on a shelf?", opts: ["12", "16", "24", "48"], a: 2, exp: "4! = 24", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Permutation and Combination", diff: "intermediate", q: "How many 3-digit numbers can be formed from digits 1,2,3,4,5 without repetition?", opts: ["60", "90", "120", "125"], a: 0, exp: "5P3 = 60", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Permutation and Combination", diff: "intermediate", q: "In how many ways can a committee of 3 be chosen from 7 people?", opts: ["21", "30", "35", "42"], a: 2, exp: "7C3 = 35", tags: ["TCS"], time: 60 },
  { cat: "Quantitative", topic: "Permutation and Combination", diff: "advanced", q: "The number of arrangements of the word 'BANANA' is:", opts: ["60", "72", "120", "360"], a: 0, exp: "6!/(3!×2!) = 60", tags: ["Wipro"], time: 75 },

  // ── Probability ──
  { cat: "Quantitative", topic: "Probability", diff: "beginner", q: "Probability of getting an even number on a single die roll is:", opts: ["1/6", "1/3", "1/2", "2/3"], a: 2, exp: "Favourable 2,4,6 → 3/6 = 1/2", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Probability", diff: "intermediate", q: "Two coins are tossed. Probability of at least one head is:", opts: ["1/4", "1/2", "3/4", "1"], a: 2, exp: "1 − P(TT) = 1 − 1/4 = 3/4", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Probability", diff: "intermediate", q: "A card is drawn from a pack. Probability it is a king is:", opts: ["1/13", "1/52", "1/4", "1/26"], a: 0, exp: "4/52 = 1/13", tags: ["Accenture"], time: 45 },
  { cat: "Quantitative", topic: "Probability", diff: "advanced", q: "A bag has 4 red and 3 blue balls. Two balls drawn at random. Probability both are red is:", opts: ["2/7", "3/7", "4/7", "6/7"], a: 0, exp: "4C2/7C2 = 6/21 = 2/7", tags: ["Wipro"], time: 75 },

  // ── Mensuration ──
  { cat: "Quantitative", topic: "Mensuration", diff: "beginner", q: "Area of a circle of radius 7 cm is:", opts: ["44 cm²", "77 cm²", "154 cm²", "308 cm²"], a: 2, exp: "πr² = 22/7 × 49 = 154 cm²", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Mensuration", diff: "beginner", q: "The perimeter of a rectangle 12 cm × 8 cm is:", opts: ["20 cm", "32 cm", "40 cm", "96 cm"], a: 2, exp: "2(12+8) = 40 cm", tags: ["Infosys"], time: 30 },
  { cat: "Quantitative", topic: "Mensuration", diff: "intermediate", q: "The volume of a cube whose surface area is 150 cm² is:", opts: ["100 cm³", "125 cm³", "150 cm³", "250 cm³"], a: 1, exp: "6a² = 150 → a = 5 → volume = 125", tags: ["Accenture"], time: 75 },
  { cat: "Quantitative", topic: "Mensuration", diff: "intermediate", q: "The area of an equilateral triangle of side 6 cm is:", opts: ["9√3", "18", "18√3", "9"], a: 0, exp: "(√3/4)×36 = 9√3 cm²", tags: ["Wipro"], time: 75 },

  // ── Geometry ──
  { cat: "Quantitative", topic: "Geometry", diff: "beginner", q: "The sum of interior angles of a triangle is:", opts: ["90°", "180°", "270°", "360°"], a: 1, exp: "Sum = 180°", tags: ["TCS"], time: 30 },
  { cat: "Quantitative", topic: "Geometry", diff: "beginner", q: "In a right triangle with legs 3 and 4, the hypotenuse is:", opts: ["5", "6", "7", "8"], a: 0, exp: "3-4-5 triangle", tags: ["Infosys"], time: 30 },
  { cat: "Quantitative", topic: "Geometry", diff: "intermediate", q: "The sum of interior angles of a hexagon is:", opts: ["540°", "720°", "900°", "1080°"], a: 1, exp: "(6−2)×180 = 720°", tags: ["TCS"], time: 60 },

  // ── Trigonometry ──
  { cat: "Quantitative", topic: "Trigonometry", diff: "beginner", q: "The value of sin 30° is:", opts: ["0", "1/2", "√3/2", "1"], a: 1, exp: "sin 30° = 1/2", tags: ["TCS"], time: 30 },
  { cat: "Quantitative", topic: "Trigonometry", diff: "intermediate", q: "If tan θ = 3/4, then sin θ is:", opts: ["3/5", "4/5", "3/4", "5/4"], a: 0, exp: "opposite 3, adjacent 4, hyp 5 → sin = 3/5", tags: ["Infosys"], time: 60 },
  { cat: "Quantitative", topic: "Trigonometry", diff: "intermediate", q: "The value of (sin² 30° + cos² 30°) is:", opts: ["0", "1/2", "1", "√3/2"], a: 2, exp: "sin²x + cos²x = 1", tags: ["Accenture"], time: 45 },

  // ── Logarithms ──
  { cat: "Quantitative", topic: "Logarithms", diff: "beginner", q: "If log₂ 64 = x, then x is:", opts: ["4", "5", "6", "7"], a: 2, exp: "2^6 = 64", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Logarithms", diff: "intermediate", q: "log₁₀ 1 is equal to:", opts: ["0", "1", "10", "Undefined"], a: 0, exp: "Any log of 1 is 0", tags: ["Infosys"], time: 30 },
  { cat: "Quantitative", topic: "Logarithms", diff: "advanced", q: "If log₁₀ 2 = 0.3010, then log₁₀ 8 is:", opts: ["0.6020", "0.9030", "0.9542", "1.2040"], a: 1, exp: "log 8 = 3 log 2 = 0.9030", tags: ["Wipro"], time: 75 },

  // ── Simplification ──
  { cat: "Quantitative", topic: "Simplification", diff: "beginner", q: "12 + 6 ÷ 3 − 2 × 2 = ?", opts: ["6", "10", "12", "14"], a: 1, exp: "12 + 2 − 4 = 10 (BODMAS)", tags: ["TCS"], time: 45 },
  { cat: "Quantitative", topic: "Simplification", diff: "beginner", q: "Which of the following is the largest? 0.4, 1/4, 35%, 0.3", opts: ["0.4", "1/4", "35%", "0.3"], a: 0, exp: "0.4 = 40% largest", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Simplification", diff: "intermediate", q: "The value of (25² − 24²) is:", opts: ["1", "47", "49", "51"], a: 2, exp: "25² − 24² = (25−24)(25+24) = 49", tags: ["Accenture"], time: 45 },

  // ── Decimals and Fractions ──
  { cat: "Quantitative", topic: "Decimals and Fractions", diff: "beginner", q: "0.6 × 0.6 = ?", opts: ["0.36", "3.6", "0.036", "0.6"], a: 0, exp: "0.6 × 0.6 = 0.36", tags: ["TCS"], time: 30 },
  { cat: "Quantitative", topic: "Decimals and Fractions", diff: "beginner", q: "1/4 + 3/8 = ?", opts: ["1/2", "5/8", "3/8", "4/12"], a: 1, exp: "2/8 + 3/8 = 5/8", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Decimals and Fractions", diff: "intermediate", q: "0.05 as a fraction in lowest terms is:", opts: ["5/10", "1/20", "1/5", "5/100"], a: 1, exp: "0.05 = 5/100 = 1/20", tags: ["Wipro"], time: 30 },

  // ── Surds and Indices ──
  { cat: "Quantitative", topic: "Surds and Indices", diff: "beginner", q: "The value of 2⁵ is:", opts: ["16", "25", "32", "64"], a: 2, exp: "2⁵ = 32", tags: ["TCS"], time: 30 },
  { cat: "Quantitative", topic: "Surds and Indices", diff: "intermediate", q: "The value of (2⁴ × 2³) ÷ 2⁵ is:", opts: ["2", "4", "8", "16"], a: 1, exp: "2^(4+3−5) = 2² = 4", tags: ["Infosys"], time: 45 },
  { cat: "Quantitative", topic: "Surds and Indices", diff: "advanced", q: "√(16/81) simplifies to:", opts: ["4/9", "2/9", "8/9", "4/81"], a: 0, exp: "√16/√81 = 4/9", tags: ["Accenture"], time: 45 },

  // ── Calendar and Clocks ──
  { cat: "Quantitative", topic: "Calendar and Clocks", diff: "beginner", q: "At what time between 3 and 4 are the hands of a clock together?", opts: ["3:15", "3:16 4/11 min", "3:18", "3:20"], a: 1, exp: "Minutes past 3 = 3×60/11 = 16 4/11", tags: ["TCS"], time: 90 },
  { cat: "Quantitative", topic: "Calendar and Clocks", diff: "intermediate", q: "What day of the week was 15 August 1947?", opts: ["Monday", "Friday", "Sunday", "Wednesday"], a: 1, exp: "It was a Friday", tags: ["Infosys"], time: 90 },
  { cat: "Quantitative", topic: "Calendar and Clocks", diff: "intermediate", q: "The angle between the hands of a clock at 3:30 is:", opts: ["65°", "70°", "75°", "80°"], a: 2, exp: "Hour at 105°, minute at 180° → 75°", tags: ["Accenture"], time: 75 },
];
