import { SeedQuestion } from "./seedTypes";

// Logical Reasoning — 17 topics
export const logicalSeed: SeedQuestion[] = [
  // ── Number Series ──
  { cat: "Logical Reasoning", topic: "Number Series", diff: "beginner", q: "Find the next term: 2, 6, 12, 20, 30, ?", opts: ["40", "42", "44", "48"], a: 1, exp: "Pattern n×(n+1): 1×2, 2×3 ... 6×7 = 42", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Number Series", diff: "beginner", q: "Find the next term: 3, 9, 27, 81, ?", opts: ["162", "243", "324", "405"], a: 1, exp: "Multiply by 3 → 81×3 = 243", tags: ["Infosys"], time: 45 },
  { cat: "Logical Reasoning", topic: "Number Series", diff: "intermediate", q: "Find the missing term: 1, 1, 2, 6, 24, ?", opts: ["48", "96", "120", "144"], a: 2, exp: "Multiply by 1,2,3,4,5 → 24×5 = 120", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Number Series", diff: "advanced", q: "Find the wrong term: 3, 7, 15, 27, 63, 127", opts: ["7", "15", "27", "63"], a: 2, exp: "Pattern ×2+1: 15×2+1 = 31, not 27", tags: ["Accenture"], time: 90 },

  // ── Letter Series ──
  { cat: "Logical Reasoning", topic: "Letter Series", diff: "beginner", q: "Find the next term: A, C, E, G, ?", opts: ["H", "I", "J", "K"], a: 1, exp: "Skip one letter each time → I", tags: ["TCS"], time: 45 },
  { cat: "Logical Reasoning", topic: "Letter Series", diff: "intermediate", q: "Find the next term: AZ, BY, CX, ?", opts: ["DW", "DU", "EW", "DV"], a: 0, exp: "First letter +1, second −1 → DW", tags: ["Infosys"], time: 60 },
  { cat: "Logical Reasoning", topic: "Letter Series", diff: "advanced", q: "Find the next term: B2, D4, F6, ?", opts: ["G8", "H8", "H7", "I8"], a: 1, exp: "Letter +2, number +2 → H8", tags: ["Wipro"], time: 60 },

  // ── Coding Decoding ──
  { cat: "Logical Reasoning", topic: "Coding Decoding", diff: "beginner", q: "If PAPER is coded as QBRFS, how is PENCIL coded?", opts: ["QFODJM", "QFOJMD", "QFOJDK", "QODJMF"], a: 0, exp: "Each letter shifted +1 → QFODJM", tags: ["TCS"], time: 75 },
  { cat: "Logical Reasoning", topic: "Coding Decoding", diff: "beginner", q: "If FRIEND is coded as 6-18-9-5-14-4, how is ENEMY coded?", opts: ["5-14-5-13-25", "5-14-4-13-24", "5-14-5-12-25", "5-13-5-14-25"], a: 0, exp: "Letters → alphabet positions: E=5,N=14,E=5,M=13,Y=25", tags: ["Infosys"], time: 75 },
  { cat: "Logical Reasoning", topic: "Coding Decoding", diff: "intermediate", q: "If CAT is coded as DBU, how is DOG coded?", opts: ["EPH", "EPG", "EQH", "DPH"], a: 0, exp: "Each letter shifted +1: D→E, O→P, G→H → EPH", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Coding Decoding", diff: "advanced", q: "In a certain code, 'ne pi se' means 'you are good'. Which word means 'good' if 'pi' appears in both 'ne pi se' (you are good) and 'ri pi ka' (good boy wins)?", opts: ["ne", "pi", "se", "ka"], a: 1, exp: "'pi' is common to both → 'pi' = good", tags: ["Accenture"], time: 90 },

  // ── Blood Relations ──
  { cat: "Logical Reasoning", topic: "Blood Relations", diff: "beginner", q: "Pointing to a man, a woman says, 'He is my father's only son.' How is the man related to the woman?", opts: ["Father", "Brother", "Uncle", "Cousin"], a: 1, exp: "Father's only son = her brother", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Blood Relations", diff: "intermediate", q: "Ravi is the son of the only daughter of Ramesh. Ramesh is Ravi's:", opts: ["Father", "Grandfather", "Uncle", "Brother"], a: 1, exp: "Only daughter of Ramesh = Ravi's mother → Ramesh = grandfather", tags: ["Infosys"], time: 60 },
  { cat: "Logical Reasoning", topic: "Blood Relations", diff: "advanced", q: "A is B's sister. C is B's mother. D is C's father. E is D's mother. How is A related to D?", opts: ["Daughter", "Granddaughter", "Sister", "Niece"], a: 1, exp: "D is A's maternal grandfather → A is D's granddaughter", tags: ["Wipro"], time: 90 },

  // ── Direction Sense ──
  { cat: "Logical Reasoning", topic: "Direction Sense", diff: "beginner", q: "A man walks 5 km north, turns right and walks 5 km. In which direction is he from his start?", opts: ["North-East", "North-West", "East", "South-East"], a: 0, exp: "North 5, then East 5 → North-East", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Direction Sense", diff: "intermediate", q: "Rohan walks 10 m south, turns left and walks 20 m, turns left and walks 10 m. How far is he from the starting point?", opts: ["10 m", "20 m", "30 m", "40 m"], a: 1, exp: "Ends up 20 m East of start", tags: ["Infosys"], time: 75 },
  { cat: "Logical Reasoning", topic: "Direction Sense", diff: "advanced", q: "A person facing North turns 90° clockwise, then 135° anticlockwise. Which direction is he facing now?", opts: ["North-West", "South-West", "North-East", "South-East"], a: 0, exp: "90°CW = East, then 135°ACW = NW", tags: ["Accenture"], time: 90 },

  // ── Seating Arrangement ──
  { cat: "Logical Reasoning", topic: "Seating Arrangement", diff: "beginner", q: "Five friends A, B, C, D, E sit in a row. A is at one end, B is second from the right, C sits between A and D, E is at the other end. Who is exactly in the middle?", opts: ["A", "C", "D", "B"], a: 1, exp: "Arrangement A C D B E → C is middle", tags: ["TCS"], time: 120 },
  { cat: "Logical Reasoning", topic: "Seating Arrangement", diff: "intermediate", q: "In a row of 40 students, Raj is 15th from the left. What is his position from the right?", opts: ["25th", "26th", "24th", "27th"], a: 1, exp: "40 − 15 + 1 = 26th", tags: ["Infosys"], time: 45 },
  { cat: "Logical Reasoning", topic: "Seating Arrangement", diff: "intermediate", q: "Six people P, Q, R, S, T, U sit in a circle facing centre. P is opposite R, Q is to the immediate right of P, S is between R and T. Who is opposite Q?", opts: ["S", "T", "U", "Cannot be determined"], a: 2, exp: "Opposite Q must be U", tags: ["Wipro"], time: 120 },

  // ── Syllogisms ──
  { cat: "Logical Reasoning", topic: "Syllogisms", diff: "beginner", q: "All roses are flowers. Some flowers are red. Which conclusion follows?", opts: ["All red things are roses", "Some roses are red", "Some red things may be roses", "No rose is red"], a: 2, exp: "From 'some flowers are red' and 'all roses are flowers', some red things may be roses", tags: ["TCS"], time: 75 },
  { cat: "Logical Reasoning", topic: "Syllogisms", diff: "intermediate", q: "All cats are animals. No animal is a stone. Therefore:", opts: ["Some cats are stones", "No cat is a stone", "All stones are cats", "Some animals are cats but no cats exist"], a: 1, exp: "If no animal is a stone and all cats are animals, no cat is a stone", tags: ["Infosys"], time: 75 },
  { cat: "Logical Reasoning", topic: "Syllogisms", diff: "advanced", q: "Some pens are pencils. All pencils are books. Which conclusion necessarily follows?", opts: ["All pens are books", "Some pens are books", "No pen is a book", "All books are pencils"], a: 1, exp: "Some pens (which are pencils) are books", tags: ["Accenture"], time: 75 },

  // ── Logical Venn Diagrams ──
  { cat: "Logical Reasoning", topic: "Logical Venn Diagrams", diff: "beginner", q: "Which of these can be represented in a Venn diagram with all three categories overlapping?", opts: ["Mothers, Women, Teachers", "Cars, Tyres, Wheels", "Pencils, Pens, Stationery", "Roses, Flowers, Red"], a: 0, exp: "A woman can be both mother and teacher", tags: ["TCS"], time: 75 },
  { cat: "Logical Reasoning", topic: "Logical Venn Diagrams", diff: "intermediate", q: "In a group of 50 people, 30 like tea and 25 like coffee. If 15 like both, how many like neither?", opts: ["5", "8", "10", "12"], a: 2, exp: "50 − (30 + 25 − 15) = 10", tags: ["Infosys"], time: 75 },

  // ── Analogy ──
  { cat: "Logical Reasoning", topic: "Analogy", diff: "beginner", q: "Doctor : Hospital :: Teacher : ?", opts: ["School", "Class", "Student", "Books"], a: 0, exp: "A doctor works in a hospital, a teacher in a school", tags: ["TCS"], time: 45 },
  { cat: "Logical Reasoning", topic: "Analogy", diff: "beginner", q: "Bird : Nest :: Bee : ?", opts: ["Flower", "Hive", "Honey", "Wing"], a: 1, exp: "Birds live in nests, bees in hives", tags: ["Infosys"], time: 45 },
  { cat: "Logical Reasoning", topic: "Analogy", diff: "intermediate", q: "12 : 144 :: 15 : ?", opts: ["150", "180", "225", "30"], a: 2, exp: "Square relation: 12² = 144, 15² = 225", tags: ["Accenture"], time: 45 },
  { cat: "Logical Reasoning", topic: "Analogy", diff: "advanced", q: "Book : Author :: Symphony : ?", opts: ["Orchestra", "Composer", "Conductor", "Music"], a: 1, exp: "A book is created by an author, a symphony by a composer", tags: ["Wipro"], time: 60 },

  // ── Odd One Out ──
  { cat: "Logical Reasoning", topic: "Odd One Out", diff: "beginner", q: "Find the odd one out: Apple, Mango, Potato, Orange", opts: ["Apple", "Mango", "Potato", "Orange"], a: 2, exp: "Potato is a vegetable, others are fruits", tags: ["TCS"], time: 30 },
  { cat: "Logical Reasoning", topic: "Odd One Out", diff: "beginner", q: "Find the odd one out: 121, 144, 169, 196, 225, 232", opts: ["169", "196", "225", "232"], a: 3, exp: "All others are perfect squares", tags: ["Infosys"], time: 45 },
  { cat: "Logical Reasoning", topic: "Odd One Out", diff: "intermediate", q: "Find the odd one out: Tiger, Lion, Elephant, Leopard", opts: ["Tiger", "Lion", "Elephant", "Leopard"], a: 2, exp: "Elephant is a herbivore; others are big cats/carnivores", tags: ["Accenture"], time: 45 },

  // ── Ranking and Order ──
  { cat: "Logical Reasoning", topic: "Ranking and Order", diff: "beginner", q: "In a class of 30, a student ranks 8th from the top. His rank from the bottom is:", opts: ["22nd", "23rd", "21st", "24th"], a: 1, exp: "30 − 8 + 1 = 23rd", tags: ["TCS"], time: 45 },
  { cat: "Logical Reasoning", topic: "Ranking and Order", diff: "intermediate", q: "In a row of girls, A is 10th from left and B is 15th from right. If they interchange positions, A becomes 20th from left. How many girls are in the row?", opts: ["30", "34", "35", "36"], a: 1, exp: "Total = 20 + 15 − 1 = 34", tags: ["Infosys"], time: 90 },
  { cat: "Logical Reasoning", topic: "Ranking and Order", diff: "advanced", q: "A is taller than B, B is shorter than C but taller than D, E is tallest. Who is the second tallest?", opts: ["A", "B", "C", "E"], a: 2, exp: "E tallest, then C → C is second tallest", tags: ["Wipro"], time: 75 },

  // ── Data Sufficiency ──
  { cat: "Logical Reasoning", topic: "Data Sufficiency", diff: "beginner", q: "What is R's age? (I) R is twice as old as S. (II) S is 12.", opts: ["Statement I alone is sufficient", "Statement II alone is sufficient", "Both statements together are sufficient", "Both together are not sufficient"], a: 2, exp: "R = 2×S = 2×12 = 24", tags: ["TCS"], time: 75 },
  { cat: "Logical Reasoning", topic: "Data Sufficiency", diff: "intermediate", q: "Is x an even number? (I) x is divisible by 4. (II) x > 5.", opts: ["Statement I alone is sufficient", "Statement II alone is sufficient", "Both statements together are sufficient", "Both together are not sufficient"], a: 0, exp: "If divisible by 4, x is even", tags: ["Infosys"], time: 75 },
  { cat: "Logical Reasoning", topic: "Data Sufficiency", diff: "advanced", q: "What is the value of a+b? (I) a−b = 10. (II) ab = 24.", opts: ["Statement I alone is sufficient", "Statement II alone is sufficient", "Both statements together are sufficient", "Both together are not sufficient"], a: 3, exp: "a−b and ab don't give a+b uniquely; multiple pairs exist", tags: ["Accenture"], time: 90 },

  // ── Statement and Conclusion ──
  { cat: "Logical Reasoning", topic: "Statement and Conclusion", diff: "beginner", q: "Statement: 'Drinking water after every hour is healthy.' Conclusion I: Dehydration can be avoided by drinking water. Conclusion II: Drinking too much water is harmful.", opts: ["Only I follows", "Only II follows", "Both follow", "Neither follows"], a: 0, exp: "Only I is a direct consequence", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Statement and Conclusion", diff: "intermediate", q: "Statement: 'All students of class X passed.' Conclusion I: Class X has only passing students. Conclusion II: No student of class X failed.", opts: ["Only I follows", "Only II follows", "Both follow", "Neither follows"], a: 1, exp: "II restates the statement; I adds info about other classes", tags: ["Infosys"], time: 60 },

  // ── Statement and Assumption ──
  { cat: "Logical Reasoning", topic: "Statement and Assumption", diff: "beginner", q: "Statement: 'Buy our toothpaste for whiter teeth.' Assumption I: Customers want whiter teeth. Assumption II: The advertisement is truthful.", opts: ["Only I is implicit", "Only II is implicit", "Both are implicit", "Neither is implicit"], a: 0, exp: "Advertising appeals to desire (I); truthfulness is not assumed", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Statement and Assumption", diff: "intermediate", q: "Statement: 'Government has announced free education for girls in rural areas.' Assumption I: Rural girls will enrol. Assumption II: Parents in rural areas cannot afford school fees.", opts: ["Only I is implicit", "Only II is implicit", "Both are implicit", "Neither is implicit"], a: 2, exp: "The scheme assumes both need and willingness", tags: ["Infosys"], time: 75 },

  // ── Cause and Effect ──
  { cat: "Logical Reasoning", topic: "Cause and Effect", diff: "beginner", q: "I: Heavy rains lashed the city. II: Several roads were waterlogged.", opts: ["I is the cause, II is the effect", "II is the cause, I is the effect", "Both are effects of a common cause", "No relation"], a: 0, exp: "Rains caused waterlogging", tags: ["TCS"], time: 60 },
  { cat: "Logical Reasoning", topic: "Cause and Effect", diff: "intermediate", q: "I: The college announced an internal exam. II: Many students complained about the syllabus.", opts: ["I is the cause, II is the effect", "II is the cause, I is the effect", "Both are effects of a common cause", "No relation"], a: 1, exp: "Syllabus complaints prompted the internal exam", tags: ["Infosys"], time: 60 },

  // ── Logical Connectives ──
  { cat: "Logical Reasoning", topic: "Logical Connectives", diff: "beginner", q: "If 'A implies B' and B is true, then:", opts: ["A must be true", "A may be true or false", "A is false", "B is false"], a: 1, exp: "Affirming the consequent is invalid → A may be true or false", tags: ["TCS"], time: 75 },
  { cat: "Logical Reasoning", topic: "Logical Connectives", diff: "intermediate", q: "'If it rains, the match is cancelled.' Which statement is logically equivalent?", opts: ["If the match is not cancelled, it did not rain", "If the match is cancelled, it rained", "If it does not rain, the match is played", "The match is cancelled only if it rains"], a: 0, exp: "Contrapositive: ¬C → ¬R", tags: ["Accenture"], time: 90 },
  { cat: "Logical Reasoning", topic: "Logical Connectives", diff: "advanced", q: "P and Q are statements. If (P AND Q) is true, then:", opts: ["P is true", "Q is false", "P is false", "Cannot be determined"], a: 0, exp: "Both P and Q must be true for the conjunction to be true", tags: ["Wipro"], time: 45 },

  // ── Puzzles ──
  { cat: "Logical Reasoning", topic: "Puzzles", diff: "beginner", q: "Three people A, B, C each have a different profession: doctor, engineer, teacher. A is not a doctor. B is not a teacher. C is an engineer. What is A?", opts: ["Doctor", "Engineer", "Teacher", "Cannot be determined"], a: 2, exp: "C engineer, so A and B are doctor/teacher. B not teacher → B doctor, A teacher", tags: ["TCS"], time: 90 },
  { cat: "Logical Reasoning", topic: "Puzzles", diff: "intermediate", q: "Five houses in a row. The green house is immediately left of the white house. The blue house is at one end. If the red house is in the middle, which house is immediately right of the red house?", opts: ["Green", "White", "Blue", "Cannot be determined"], a: 1, exp: "Order must place white right of red", tags: ["Infosys"], time: 120 },
];
