import type { KbEntry } from "../types";

/** Aptitude & reasoning knowledge: formulas, shortcuts and exam strategy. */
export const aptitudeKb: KbEntry[] = [
  {
    id: "apt-percentage",
    topic: "Aptitude · Percentages",
    title: "Percentage formulas",
    questions: [
      "percentage formulas",
      "how to calculate percentage quickly",
      "how do i find percentage change",
      "what is percentage increase and decrease",
      "successive percentage change formula",
      "x percent of y trick",
      "what is 35 percent of 240",
      "a price rises from 80 to 100 what is the percentage increase",
      "by what percent did the value change",
    ],
    answer:
      "Percentage = (part / whole) × 100. X% of Y = XY / 100.\n• % change = (new − old) / old × 100.\n• Successive changes a% then b% = a + b + ab/100 (use negative numbers for decreases).\n• If a value goes up by r%, to get back to the original it must fall by r/(100 + r) × 100 %.\nTip: convert to fractions (12.5% = 1/8, 16.67% = 1/6, 33.33% = 1/3) to skip long multiplication.",
  },
  {
    id: "apt-profit-loss",
    topic: "Aptitude · Profit, Loss & Discount",
    title: "Profit, loss and discount",
    questions: [
      "profit and loss formulas",
      "how to calculate profit percentage",
      "what is the formula for discount",
      "cost price selling price marked price relation",
      "successive discount formula",
      "profit loss tricks",
      "an article bought for 500 is sold for 600 find the gain percent",
      "a shopkeeper gives 10 percent discount on the marked price",
      "cost price of 12 articles equals selling price of 10 articles",
    ],
    answer:
      "• Profit % = (SP − CP) / CP × 100; Loss % = (CP − SP) / CP × 100 — always on cost price.\n• SP = CP × (100 + P%) / 100.\n• Discount % = (MP − SP) / MP × 100 — always on marked price.\n• Successive discounts d1 and d2 = d1 + d2 − d1·d2/100.\n• If two items are sold at the same price, one at x% profit and one at x% loss, there is always a net loss of x²/100 %.",
  },
  {
    id: "apt-simple-interest",
    topic: "Aptitude · Simple Interest",
    title: "Simple interest",
    questions: [
      "simple interest formula",
      "how to calculate simple interest",
      "si formula principal rate time",
      "interest on a loan without compounding",
      "find the interest on 8000 at 5 percent per annum for 3 years",
      "at what rate will a sum double in 10 years",
    ],
    answer:
      "Simple Interest SI = P × R × T / 100, where P = principal, R = rate per annum, T = time in years.\nAmount A = P + SI = P(1 + RT/100).\nTime in months? Divide by 12. The interest is the same every year because it is only charged on the original principal.",
  },
  {
    id: "apt-compound-interest",
    topic: "Aptitude · Compound Interest",
    title: "Compound interest",
    questions: [
      "compound interest formula",
      "how to calculate compound interest",
      "difference between simple interest and compound interest",
      "ci minus si for 2 years",
      "half yearly compounding formula",
      "find the compound interest on 5000 for 2 years at 8 percent",
      "what will 10000 amount to after 3 years compounded annually",
    ],
    answer:
      "Amount A = P(1 + R/100)ⁿ, and CI = A − P.\n• Half-yearly: rate becomes R/2 and time 2n; quarterly: R/4 and 4n.\n• For 2 years, CI − SI = P(R/100)².\n• For 3 years, CI − SI = P(R/100)² × (3 + R/100).\nQuick check: at 10% for 2 years, CI is 21% of P and SI is 20% of P.",
  },
  {
    id: "apt-time-speed-distance",
    topic: "Aptitude · Time, Speed & Distance",
    title: "Time, speed and distance",
    questions: [
      "speed distance time formula",
      "how to solve time speed and distance problems",
      "average speed formula",
      "relative speed formula",
      "how to convert kmph to m/s",
      "train crossing a platform problem",
      "train speed problems",
      "speed of a car and distance travelled",
      "how long does a train take to cross a bridge",
      "a train 150 m long passes a pole in 15 seconds find its speed",
      "a man walks at 5 kmph for 2 hours how much distance does he cover",
      "two trains run towards each other when will they meet",
      "a person travels 60 km at 30 kmph and returns at 20 kmph find average speed",
    ],
    answer:
      "Distance = Speed × Time.\n• km/h → m/s: × 5/18; m/s → km/h: × 18/5.\n• Average speed over equal distances at speeds x and y = 2xy / (x + y) (not the simple average).\n• Relative speed: opposite directions add speeds, same direction subtract them.\n• A train crossing a pole covers its own length; crossing a platform covers train + platform length.",
  },
  {
    id: "apt-time-work",
    topic: "Aptitude · Time & Work",
    title: "Time and work",
    questions: [
      "time and work formula",
      "how to solve work problems",
      "a can do a work in 10 days b in 15 days together",
      "men days hours work formula",
      "lcm method for time and work",
      "efficiency and work problems",
      "two workers finishing a job together",
      "how long will a and b take to complete work together",
      "work done per day",
      "a can finish a task in 20 days and b in 30 days in how many days together",
      "15 workers build a wall in 8 days how many workers to build it in 5 days",
      "a and b together complete a project in 6 days if a alone takes 10 days find b",
    ],
    answer:
      "Work = Rate × Time. If A finishes in a days and B in b days, together they take ab / (a + b) days.\n• LCM method: take total work = LCM of the days, so each person's daily work is an integer, then add rates.\n• M1·D1·H1 / W1 = M2·D2·H2 / W2 for men/days/hours problems.\n• Efficiency is inversely proportional to time taken.",
  },
  {
    id: "apt-pipes-cisterns",
    topic: "Aptitude · Pipes & Cisterns",
    title: "Pipes and cisterns",
    questions: [
      "pipes and cisterns formula",
      "how to solve tank filling problems",
      "inlet and outlet pipe problem method",
      "leak in a tank problem",
      "pipe a fills a tank in 6 hours and pipe b in 9 hours how long together",
      "a tank has a leak that empties it in 12 hours while a pipe fills it in 4 hours",
    ],
    answer:
      "Treat pipes like workers: an inlet pipe does positive work, an outlet or leak does negative work.\n• Inlet fills in a hours, outlet empties in b hours → net rate = 1/a − 1/b.\n• Use the LCM method: pick tank capacity = LCM of the times, then each pipe's litres/hour is an integer; add inlets and subtract outlets.",
  },
  {
    id: "apt-boats-streams",
    topic: "Aptitude · Boats & Streams",
    title: "Boats and streams",
    questions: [
      "boats and streams formula",
      "upstream and downstream speed",
      "speed of boat in still water formula",
      "how to solve boat and stream problems",
      "a boat covers 24 km upstream in 6 hours and downstream in 4 hours find the speed of the stream",
      "a rower can row 8 kmph in still water and the river flows at 2 kmph",
    ],
    answer:
      "Let boat speed in still water = u and stream speed = v.\n• Downstream speed = u + v; upstream speed = u − v.\n• u = (downstream + upstream) / 2 and v = (downstream − upstream) / 2.\n• For the same distance, time is inversely proportional to speed.",
  },
  {
    id: "apt-ratio",
    topic: "Aptitude · Ratio & Proportion",
    title: "Ratio and proportion",
    questions: [
      "ratio and proportion basics",
      "how to divide an amount in a given ratio",
      "what is direct and inverse proportion",
      "ratio problems shortcut",
      "divide 1200 among a b and c in the ratio 2 3 5",
      "two numbers are in the ratio 3 to 5 and their sum is 64 find them",
    ],
    answer:
      "• a : b = c : d means ad = bc (cross-multiply).\n• To divide N in ratio a : b, the parts are aN/(a + b) and bN/(a + b).\n• Direct proportion: y = kx (both rise together). Inverse: xy = k (one rises, the other falls).\n• Combine ratios by making the common term equal, e.g. A:B = 2:3 and B:C = 4:5 → A:B:C = 8:12:15.",
  },
  {
    id: "apt-averages",
    topic: "Aptitude · Averages",
    title: "Averages",
    questions: [
      "average formula",
      "how to calculate weighted average",
      "average when a new person joins the group",
      "average problems tricks",
      "the average of 6 numbers is 20 and one number is 26 find the average of the rest",
      "the average age of a class of 30 students is 15 years",
    ],
    answer:
      "Average = Sum / Number of items, so Sum = Average × Count.\n• Weighted average = Σ(value × weight) / Σ weights.\n• When a new member joins, new member = old average + (change in average × new count).\n• Average of consecutive numbers = middle value (or mean of first and last).",
  },
  {
    id: "apt-ages",
    topic: "Aptitude · Problems on Ages",
    title: "Problems on ages",
    questions: [
      "problems on ages tricks",
      "how to solve age problems",
      "father is 3 times as old as son age problem",
      "age ratio problem method",
      "five years ago a was twice as old as b find their present ages",
      "the sum of the ages of a father and son is 60 years",
    ],
    answer:
      "Assign a variable to the present age of the younger person, translate each sentence into an equation and solve.\n• 'n years ago' → age − n; 'after n years' → age + n.\n• Ratio given? Write ages as ax and bx, then apply the time shift to both.\n• The difference between two people's ages never changes with time.",
  },
  {
    id: "apt-mixtures",
    topic: "Aptitude · Mixtures & Alligation",
    title: "Mixtures and alligation",
    questions: [
      "alligation formula",
      "how to solve mixture problems",
      "alligation rule method",
      "mixing two solutions of different concentration",
    ],
    answer:
      "Alligation: (quantity of cheaper) / (quantity of dearer) = (dearer price − mean price) / (mean price − cheaper price).\nDraw the cross: cheaper c and dearer d on top, mean m in the middle; the ratio of quantities is (d − m) : (m − c).\nFor repeated replacement: final quantity of the original = x(1 − y/x)ⁿ, where y is removed and replaced n times from a vessel of x.",
  },
  {
    id: "apt-partnership",
    topic: "Aptitude · Partnership",
    title: "Partnership",
    questions: [
      "partnership problems formula",
      "how to divide profit between partners",
      "profit sharing ratio with different investment time",
    ],
    answer:
      "Profits are shared in the ratio of (capital × time) for each partner.\n• Same time → ratio of investments; same capital → ratio of time.\n• Sleeping partners get only their share by the same ratio.\n• If one partner joins later, multiply the capital by the months he was invested.",
  },
  {
    id: "apt-permutation-combination",
    topic: "Aptitude · Permutation & Combination",
    title: "Permutations and combinations",
    questions: [
      "permutation and combination formula",
      "difference between permutation and combination",
      "ncr and npr formulas",
      "circular permutation formula",
      "how many ways to arrange letters of a word",
      "in how many ways can 5 people be seated in a row",
      "how many committees of 3 can be formed from 8 people",
      "how many words can be formed from the letters of the word listen",
    ],
    answer:
      "• Permutation (order matters): nPr = n! / (n − r)!.\n• Combination (order does not matter): nCr = n! / (r!(n − r)!).\n• Circular arrangement of n distinct objects = (n − 1)!.\n• Arranging letters with repeats = n! / (p! q! …) for each repeated letter.\nAsk yourself: does swapping two chosen items give a different outcome? If yes, permutation.",
  },
  {
    id: "apt-probability",
    topic: "Aptitude · Probability",
    title: "Probability",
    questions: [
      "probability formula",
      "how to solve probability problems",
      "probability of drawing cards or balls",
      "or and and rule in probability",
      "chance of an event happening",
      "coin toss and dice probability",
      "odds of drawing a card",
      "likelihood of getting heads",
      "a bag has 4 red and 6 blue balls what is the probability of drawing red",
      "two dice are thrown find the probability that the sum is 7",
      "a card is drawn from a pack of 52 what is the probability of a king",
    ],
    answer:
      "P(event) = favourable outcomes / total outcomes, always between 0 and 1.\n• P(not A) = 1 − P(A).\n• P(A or B) = P(A) + P(B) − P(A and B).\n• P(A and B) = P(A) × P(B) if independent.\n• For 'at least one' questions, use 1 − P(none).",
  },
  {
    id: "apt-number-system",
    topic: "Aptitude · Number System",
    title: "Divisibility and number system",
    questions: [
      "divisibility rules",
      "how to check if a number is divisible by 11",
      "hcf and lcm relation",
      "find remainder trick",
      "number system tricks",
      "find the remainder when 2345 is divided by 7",
      "find the hcf and lcm of 12 and 18",
      "what is the smallest number divisible by 4 6 and 8",
      "find the unit digit of 7 raised to the power 45",
    ],
    answer:
      "Divisibility: by 3 → digit sum divisible by 3; by 9 → digit sum divisible by 9; by 4 → last two digits; by 8 → last three digits; by 11 → (sum of odd-place digits) − (sum of even-place digits) is 0 or a multiple of 11; by 6 → divisible by both 2 and 3.\nHCF × LCM = product of the two numbers.\nHCF divides all the numbers; LCM is divisible by all of them.",
  },
  {
    id: "apt-progressions",
    topic: "Aptitude · AP & GP",
    title: "Arithmetic and geometric progressions",
    questions: [
      "ap and gp formulas",
      "sum of arithmetic progression",
      "geometric progression sum formula",
      "nth term of an ap",
      "sum of series formula",
      "find sum of first n terms of gp",
    ],
    answer:
      "AP: nth term = a + (n − 1)d; sum of n terms = n/2 [2a + (n − 1)d].\nGP: nth term = a·rⁿ⁻¹; sum = a(rⁿ − 1)/(r − 1) for r > 1, and a(1 − rⁿ)/(1 − r) for r < 1; infinite sum = a / (1 − r) when |r| < 1.\nSum of first n natural numbers = n(n + 1)/2; of squares = n(n + 1)(2n + 1)/6.",
  },
  {
    id: "apt-quadratic",
    topic: "Aptitude · Quadratic Equations",
    title: "Quadratic equations",
    questions: [
      "quadratic equation formula",
      "how to find roots of a quadratic equation",
      "what is the discriminant",
      "sum and product of roots",
      "roots of an equation",
      "solving x squared equations",
      "factorise quadratic",
    ],
    answer:
      "For ax² + bx + c = 0, roots = (−b ± √(b² − 4ac)) / 2a.\nDiscriminant D = b² − 4ac: D > 0 two real roots, D = 0 equal roots, D < 0 no real roots.\nSum of roots = −b/a; product of roots = c/a.\nFor competitive tests, try factorising first (split the middle term) — it is faster than the formula.",
  },
  {
    id: "apt-mensuration",
    topic: "Aptitude · Mensuration & Geometry",
    title: "Mensuration and geometry formulas",
    questions: [
      "mensuration formulas",
      "area and volume formulas",
      "volume of cylinder cone sphere",
      "area of circle triangle formula",
      "geometry angle sum formulas",
      "find the area of a rectangle with length 12 cm and breadth 8 cm",
      "a cylinder has radius 7 cm and height 10 cm find its volume",
    ],
    answer:
      "• Circle: area πr², circumference 2πr.\n• Cylinder: volume πr²h, curved area 2πrh, total 2πr(r + h).\n• Cone: volume ⅓πr²h, curved area πrl (l = √(r² + h²)).\n• Sphere: volume ⁴⁄₃πr³, surface 4πr². Cube: volume a³, surface 6a². Cuboid: volume lbh, surface 2(lb + bh + hl).\n• Triangle angles sum to 180°; a polygon's interior angles sum to (n − 2) × 180°.",
  },
  {
    id: "apt-data-interpretation",
    topic: "Aptitude · Data Interpretation",
    title: "Data interpretation strategy",
    questions: [
      "data interpretation tips",
      "how to solve di questions faster",
      "bar graph pie chart table questions strategy",
      "data interpretation approximation",
    ],
    answer:
      "1. Read the title, units and legend first; misreading units is the most common mistake.\n2. Answer the question asked from only the relevant rows/bars.\n3. Approximate: round to 1–2 significant figures, then compare the answer options — often only one is close.\n4. Learn table-of-squares and fraction-percentage equivalents.\n5. For pie charts, use 1% = 3.6° to convert between degrees and share.",
  },
  {
    id: "apt-number-series",
    topic: "Aptitude · Number Series",
    title: "Number series",
    questions: [
      "number series tricks",
      "how to find the missing number in a series",
      "series pattern types in aptitude",
      "alphabet series tricks",
      "what comes next in the series 3 6 11 18",
      "find the wrong number in the series 2 5 10 17 26 37",
    ],
    answer:
      "Try these patterns in order:\n1. Constant difference or ratio.\n2. Differences that themselves form a pattern (second differences).\n3. Squares, cubes, primes or n² ± n.\n4. Alternating series — treat odd and even positions as two separate series.\n5. Operations that change each step (×1 + 1, ×2 + 2, …).\nFor alphabet series, convert letters to positions (A = 1 … Z = 26) and use the same steps.",
  },
  {
    id: "apt-coding-decoding",
    topic: "Reasoning · Coding & Decoding",
    title: "Coding and decoding",
    questions: [
      "coding decoding tricks",
      "how to solve letter coding questions",
      "if cat is coded as dbu then what is dog",
      "coding decoding methods",
    ],
    answer:
      "Convert letters to their alphabet positions (A = 1 … Z = 26) and look for the rule: a fixed shift (+1, −2), reversal (A ↔ Z, i.e. 27 − position), or a position-based shift.\nExample: CAT → DBU is a +1 shift for every letter, so DOG → EPH.\nFor word-to-code mapping, compare two sentences that share a word: the common code word belongs to the common word.",
  },
  {
    id: "apt-blood-relations",
    topic: "Reasoning · Blood Relations",
    title: "Blood relations",
    questions: [
      "blood relation tricks",
      "how to solve blood relation puzzles",
      "family tree reasoning questions",
      "pointing to a photograph relation problem",
    ],
    answer:
      "1. Start from the person the question is about and draw a family tree.\n2. Use symbols: □ or + for male, ○ or − for female, a horizontal line for marriage, a vertical line for children.\n3. Translate phrases step by step: 'my mother's brother' = maternal uncle; 'my father's sister's son' = cousin.\n4. Do not assume gender unless the statement gives it.\nPractise by writing each relation in one hop at a time.",
  },
  {
    id: "apt-direction-sense",
    topic: "Reasoning · Direction Sense",
    title: "Direction sense",
    questions: [
      "direction sense test tricks",
      "how to solve direction problems",
      "shortest distance after walking north east",
      "left and right turn direction question",
    ],
    answer:
      "Draw a rough map: North up, East right. Right turn from facing North → East, another right → South, etc.\nFor the shortest distance from the start, use Pythagoras on the net displacement: √(net east-west² + net north-south²).\nShadow questions: in the morning the shadow points West, in the evening East.",
  },
  {
    id: "apt-syllogism",
    topic: "Reasoning · Syllogisms",
    title: "Syllogisms",
    questions: [
      "syllogism tricks",
      "how to solve syllogism questions",
      "all some no statements conclusion",
      "venn diagram method for syllogism",
    ],
    answer:
      "Draw Venn circles for each statement:\n• 'All A are B' → circle A inside B.\n• 'Some A are B' → overlapping circles.\n• 'No A is B' → separate circles.\nA conclusion follows only if it is true in every possible diagram. Draw the diagram in the most flexible way and test the conclusion; 'Some' means at least one, and 'All' + 'All' gives 'All'.",
  },
  {
    id: "apt-seating-arrangement",
    topic: "Reasoning · Seating Arrangement & Puzzles",
    title: "Seating arrangements and puzzles",
    questions: [
      "seating arrangement tricks",
      "how to solve circular seating arrangement",
      "puzzle reasoning method",
      "linear arrangement questions strategy",
      "five friends sit in a row a is to the left of b and c sits at the end",
      "six persons are sitting around a circular table facing the centre",
    ],
    answer:
      "1. Read every clue, then start with the most definite ones (fixed position, direct neighbour).\n2. Draw the arrangement — a row for linear, a circle for circular — and fill sure facts in pencil.\n3. In circular seating facing the centre, left and right are swapped compared to facing outwards; check the direction first.\n4. Use elimination for negative clues ('A is not next to B') and revisit when new facts appear.\nFor tables of attributes, build a grid and tick/cross.",
  },
  {
    id: "apt-clock-calendar",
    topic: "Reasoning · Clocks & Calendars",
    title: "Clock and calendar problems",
    questions: [
      "clock angle formula",
      "angle between hour hand and minute hand",
      "how to find the day of the week for a date",
      "calendar odd days trick",
      "leap year rules",
    ],
    answer:
      "Clock: angle = |30H − 5.5M| (H = hour, M = minutes); take 360° minus it if you need the reflex angle. In every 12 hours the hands coincide 11 times and are at right angles 22 times.\nCalendar: 100 years = 5 odd days, 200 = 3, 300 = 1, 400 = 0. A year is leap if divisible by 4, except century years, which must be divisible by 400. Odd days = total days mod 7.",
  },
  {
    id: "apt-verbal-reading",
    topic: "Verbal · Reading Comprehension",
    title: "Reading comprehension",
    questions: [
      "reading comprehension tips",
      "how to improve reading comprehension speed",
      "rc passage strategy",
      "how to solve passage questions in aptitude",
    ],
    answer:
      "1. Skim the questions first so you know what to look for.\n2. Read the passage once for the main idea; note the first and last lines of each paragraph.\n3. Answer from the passage only — never from your own opinion.\n4. Eliminate extreme words (always, never, only) unless the passage uses them.\nRead newspaper editorials 20 minutes a day to build speed and vocabulary.",
  },
  {
    id: "apt-verbal-grammar",
    topic: "Verbal · Grammar & Error Detection",
    title: "Error detection and sentence correction",
    questions: [
      "error detection tips",
      "how to solve sentence correction questions",
      "subject verb agreement rules",
      "common grammar mistakes in aptitude tests",
      "para jumbles strategy",
    ],
    answer:
      "Check in this order: subject-verb agreement, tense consistency, pronoun agreement, articles (a/an/the), prepositions, parallel structure, and modifiers.\nRules of thumb: 'each', 'every', 'either' take a singular verb; 'a number of' is plural while 'the number of' is singular.\nPara jumbles: find the opening sentence (introduces the topic, no pronoun without a noun), then chain sentences using linking words (however, therefore, this).",
  },
  {
    id: "apt-time-management",
    topic: "Aptitude · Test Strategy",
    title: "Time management in aptitude tests",
    questions: [
      "how to manage time in aptitude test",
      "how many minutes per question in aptitude",
      "should i skip difficult questions",
      "how to attempt more questions in less time",
      "how to avoid negative marking mistakes",
    ],
    answer:
      "• Budget roughly 60–90 seconds per quantitative question; skip if you are stuck after 30 seconds and return later.\n• Take a first pass for easy questions, a second for medium ones.\n• Use option elimination and estimation instead of exact calculation.\n• With negative marking, guess only after removing at least two options.\n• Practise in timed mode on this platform so speed becomes habit, not effort.",
  },
  {
    id: "apt-improve-accuracy",
    topic: "Aptitude · Preparation",
    title: "How to improve aptitude accuracy",
    questions: [
      "how to improve accuracy in aptitude",
      "how do i get better at quantitative aptitude",
      "how to prepare for aptitude test in 30 days",
      "aptitude preparation plan",
      "how to increase my aptitude score",
    ],
    answer:
      "1. Learn the formulas above and keep a one-page cheat sheet.\n2. Practise topic by topic: 10–15 questions daily in your weakest topic, then a mixed timed set.\n3. After each test, read the explanation for every wrong answer and note the mistake type (concept, calculation, misread).\n4. Memorise squares to 30, cubes to 10, and fraction-percent tables.\n5. Take one full mock test weekly and compare with your history in Analytics.",
  },
];
