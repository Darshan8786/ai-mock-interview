import { SeedQuestion } from "./seedTypes";

// Verbal Ability — 15 topics
export const verbalSeed: SeedQuestion[] = [
  // ── Synonyms ──
  { cat: "Verbal Ability", topic: "Synonyms", diff: "beginner", q: "Choose the synonym of 'ANOMALOUS':", opts: ["Normal", "Abnormal", "Regular", "Typical"], a: 1, exp: "Anomalous = deviating from the normal → Abnormal", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Synonyms", diff: "beginner", q: "Choose the synonym of 'BRIEF':", opts: ["Long", "Short", "Bright", "Blunt"], a: 1, exp: "Brief = short in duration", tags: ["Infosys"], time: 30 },
  { cat: "Verbal Ability", topic: "Synonyms", diff: "intermediate", q: "Choose the synonym of 'MUNIFICENT':", opts: ["Stingy", "Generous", "Moody", "Ancient"], a: 1, exp: "Munificent = very generous", tags: ["Accenture"], time: 60 },
  { cat: "Verbal Ability", topic: "Synonyms", diff: "advanced", q: "Choose the synonym of 'OBDURATE':", opts: ["Flexible", "Stubborn", "Obedient", "Transparent"], a: 1, exp: "Obdurate = stubbornly persistent", tags: ["Wipro"], time: 60 },

  // ── Antonyms ──
  { cat: "Verbal Ability", topic: "Antonyms", diff: "beginner", q: "Choose the antonym of 'EPHEMERAL':", opts: ["Short-lived", "Eternal", "Temporary", "Brief"], a: 1, exp: "Ephemeral = short-lived; antonym = eternal", tags: ["TCS"], time: 60 },
  { cat: "Verbal Ability", topic: "Antonyms", diff: "beginner", q: "Choose the antonym of 'MITIGATE':", opts: ["Alleviate", "Aggravate", "Relieve", "Soften"], a: 1, exp: "Mitigate = make less severe; antonym = aggravate", tags: ["Infosys"], time: 60 },
  { cat: "Verbal Ability", topic: "Antonyms", diff: "intermediate", q: "Choose the antonym of 'AMICABLE':", opts: ["Friendly", "Hostile", "Polite", "Cordial"], a: 1, exp: "Amicable = friendly; antonym = hostile", tags: ["Accenture"], time: 45 },
  { cat: "Verbal Ability", topic: "Antonyms", diff: "advanced", q: "Choose the antonym of 'ERUDITE':", opts: ["Learned", "Ignorant", "Wise", "Scholarly"], a: 1, exp: "Erudite = scholarly; antonym = ignorant", tags: ["Wipro"], time: 45 },

  // ── Spelling ──
  { cat: "Verbal Ability", topic: "Spelling", diff: "beginner", q: "Select the correct spelling:", opts: ["Accomodate", "Acommodate", "Accommodate", "Acomodate"], a: 2, exp: "Accommodate — double c, double m", tags: ["TCS"], time: 30 },
  { cat: "Verbal Ability", topic: "Spelling", diff: "beginner", q: "Select the correct spelling:", opts: ["Embarass", "Embarrass", "Embbarass", "Embaras"], a: 1, exp: "Embarrass — double r, double s", tags: ["Infosys"], time: 30 },
  { cat: "Verbal Ability", topic: "Spelling", diff: "intermediate", q: "Select the correct spelling:", opts: ["Occurence", "Occurrence", "Ocurrence", "Occurence"], a: 1, exp: "Occurrence — double c, double r", tags: ["Accenture"], time: 45 },
  { cat: "Verbal Ability", topic: "Spelling", diff: "advanced", q: "Select the correctly spelt word:", opts: ["Perseverence", "Perseverance", "Perseverense", "Perservance"], a: 1, exp: "Perseverance", tags: ["Wipro"], time: 45 },

  // ── Sentence Correction ──
  { cat: "Verbal Ability", topic: "Sentence Correction", diff: "beginner", q: "Select the correct sentence:", opts: ["I look forward to meet you.", "I look forward to meeting you.", "I look forward for meeting you.", "I look forward meet you."], a: 1, exp: "'Look forward to' takes a gerund", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Sentence Correction", diff: "beginner", q: "Choose the correct form: 'Neither of the answers ___ correct.'", opts: ["are", "is", "were", "have been"], a: 1, exp: "'Neither' takes a singular verb", tags: ["Infosys"], time: 45 },
  { cat: "Verbal Ability", topic: "Sentence Correction", diff: "intermediate", q: "Choose the best correction: 'He is one of the boys who ___ the prize.'", opts: ["wins", "win", "is winning", "has won"], a: 1, exp: "'Who' refers to boys → plural verb 'win'", tags: ["Accenture"], time: 60 },
  { cat: "Verbal Ability", topic: "Sentence Correction", diff: "advanced", q: "Choose the best sentence:", opts: ["She sang better than any girl in the class.", "She sang better than any other girl in the class.", "She sang best than any girl in the class.", "She sang more better than any girl."], a: 1, exp: "Comparison within a group needs 'any other'", tags: ["Wipro"], time: 60 },

  // ── Spotting Errors ──
  { cat: "Verbal Ability", topic: "Spotting Errors", diff: "beginner", q: "Find the error: 'The team of scientists are working on the project.'", opts: ["The team", "of scientists", "are working", "No error"], a: 2, exp: "Collective noun 'team' takes a singular verb → 'is working'", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Spotting Errors", diff: "intermediate", q: "Find the error: 'He did not went to school yesterday.'", opts: ["He did not", "went to", "school", "yesterday"], a: 1, exp: "After 'did not' use the base form → 'go'", tags: ["Infosys"], time: 45 },
  { cat: "Verbal Ability", topic: "Spotting Errors", diff: "intermediate", q: "Find the error: 'One of my friend is coming tomorrow.'", opts: ["One of", "my friend", "is coming", "tomorrow"], a: 1, exp: "'One of' is followed by a plural noun → 'friends'", tags: ["Accenture"], time: 45 },

  // ── Fill in the Blanks ──
  { cat: "Verbal Ability", topic: "Fill in the Blanks", diff: "beginner", q: "Fill in the blank: 'She has been working here ___ 2015.'", opts: ["for", "since", "from", "by"], a: 1, exp: "'Since' with a point of time", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Fill in the Blanks", diff: "beginner", q: "Fill in the blank: 'We must ___ the deadline.'", opts: ["meat", "meet", "mete", "met"], a: 1, exp: "'Meet the deadline' is correct", tags: ["Infosys"], time: 30 },
  { cat: "Verbal Ability", topic: "Fill in the Blanks", diff: "intermediate", q: "Fill in the blank: 'The committee ___ divided in its opinion.'", opts: ["were", "was", "have been", "are"], a: 1, exp: "Committee acting as a unit takes a singular verb", tags: ["Accenture"], time: 45 },
  { cat: "Verbal Ability", topic: "Fill in the Blanks", diff: "advanced", q: "Fill in the blank: 'He is ___ honest man.'", opts: ["a", "an", "the", "no article"], a: 1, exp: "'Honest' begins with a vowel sound → 'an'", tags: ["Wipro"], time: 30 },

  // ── Sentence Arrangement ──
  { cat: "Verbal Ability", topic: "Sentence Arrangement", diff: "intermediate", q: "Arrange: (P) to the station (Q) we hurried (R) before the train left (S) as fast as we could", opts: ["QSRP", "QRSP", "QS RP", "PSRQ"], a: 1, exp: "We hurried as fast as we could to the station before the train left → QRSP", tags: ["TCS"], time: 90 },
  { cat: "Verbal Ability", topic: "Sentence Arrangement", diff: "intermediate", q: "Arrange: (P) is the root of all evil (Q) money (R) 'The love of' (S) it is often said that", opts: ["SRQP", "SRPQ", "RSPQ", "SQPR"], a: 0, exp: "It is often said that 'the love of money is the root of all evil' → SRQP", tags: ["Infosys"], time: 90 },
  { cat: "Verbal Ability", topic: "Sentence Arrangement", diff: "advanced", q: "Arrange: (P) and the river was calm (Q) the sun was setting (R) casting long shadows (S) over the hills", opts: ["QSPR", "QSRP", "SQPR", "RSPQ"], a: 1, exp: "The sun was setting over the hills casting long shadows and the river was calm → QSRP", tags: ["Accenture"], time: 90 },

  // ── Para Jumbles ──
  { cat: "Verbal Ability", topic: "Para Jumbles", diff: "intermediate", q: "Arrange into a paragraph: (1) Hence, it needs care. (2) A plant is a living thing. (3) It grows and breathes. (4) Like us, it needs food.", opts: ["2 3 4 1", "1 2 3 4", "3 4 2 1", "2 4 3 1"], a: 0, exp: "Introduction (2), growth (3), food (4), conclusion (1)", tags: ["TCS"], time: 90 },
  { cat: "Verbal Ability", topic: "Para Jumbles", diff: "advanced", q: "Arrange: (1) This habit builds confidence. (2) Start with small tasks. (3) Finishing them creates a sense of achievement. (4) Success follows naturally.", opts: ["2 3 1 4", "1 2 3 4", "2 1 3 4", "3 2 1 4"], a: 0, exp: "Advice (2), outcome (3), benefit (1), final (4)", tags: ["Infosys"], time: 90 },

  // ── Reading Comprehension ──
  { cat: "Verbal Ability", topic: "Reading Comprehension", diff: "beginner", q: "Passage: 'The internet has connected the world. Remote work is now possible for millions. Education too has gone online.' The main idea is:", opts: ["The internet only helps offices", "The internet has transformed work and learning", "Online education is expensive", "Remote work is difficult"], a: 1, exp: "The passage highlights the internet's impact on work and education", tags: ["TCS"], time: 90 },
  { cat: "Verbal Ability", topic: "Reading Comprehension", diff: "intermediate", q: "Passage: 'Renewable energy is becoming cheaper. Solar panels now cost a fraction of earlier prices. Many nations are switching away from coal.' What can be inferred?", opts: ["Coal is still the cheapest energy", "Renewables are now cost-competitive", "Solar energy is unreliable", "Nations ignore climate issues"], a: 1, exp: "Falling prices imply renewables are cost-competitive", tags: ["Accenture"], time: 90 },
  { cat: "Verbal Ability", topic: "Reading Comprehension", diff: "advanced", q: "Passage: 'The author argues that curiosity drives innovation. However, curiosity alone without discipline rarely produces results.' The author believes:", opts: ["Discipline alone drives innovation", "Curiosity must be paired with discipline", "Curiosity is unnecessary", "Innovation is purely accidental"], a: 1, exp: "The passage requires both curiosity and discipline", tags: ["Wipro"], time: 90 },

  // ── Idioms and Phrases ──
  { cat: "Verbal Ability", topic: "Idioms and Phrases", diff: "beginner", q: "The idiom 'to hit the nail on the head' means:", opts: ["To hurt oneself", "To do exactly the right thing", "To work very hard", "To be very strong"], a: 1, exp: "It means being precisely correct", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Idioms and Phrases", diff: "beginner", q: "The phrase 'once in a blue moon' means:", opts: ["Every month", "Very rarely", "Very often", "During the day"], a: 1, exp: "It means very rarely", tags: ["Infosys"], time: 45 },
  { cat: "Verbal Ability", topic: "Idioms and Phrases", diff: "intermediate", q: "The idiom 'to bite the bullet' means:", opts: ["To be brave", "To face a painful situation bravely", "To eat quickly", "To fight someone"], a: 1, exp: "To endure a difficult situation", tags: ["Accenture"], time: 45 },
  { cat: "Verbal Ability", topic: "Idioms and Phrases", diff: "advanced", q: "The phrase 'a bitter pill to swallow' means:", opts: ["A tasty medicine", "An unpleasant fact one must accept", "A small problem", "A quick remedy"], a: 1, exp: "An unpleasant but necessary acceptance", tags: ["Wipro"], time: 60 },

  // ── One Word Substitution ──
  { cat: "Verbal Ability", topic: "One Word Substitution", diff: "beginner", q: "One who cannot read or write:", opts: ["Illiterate", "Ignorant", "Novice", "Amateur"], a: 0, exp: "Illiterate", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "One Word Substitution", diff: "intermediate", q: "A person who loves mankind and works for its welfare:", opts: ["Philanthropist", "Misanthrope", "Patriot", "Altruist"], a: 0, exp: "Philanthropist", tags: ["Infosys"], time: 60 },
  { cat: "Verbal Ability", topic: "One Word Substitution", diff: "intermediate", q: "A place where bees are kept:", opts: ["Apiary", "Aviary", "Aquarium", "Stable"], a: 0, exp: "Apiary", tags: ["Accenture"], time: 45 },
  { cat: "Verbal Ability", topic: "One Word Substitution", diff: "advanced", q: "The study of the origin and history of words:", opts: ["Etymology", "Entomology", "Anthropology", "Archaeology"], a: 0, exp: "Etymology", tags: ["Wipro"], time: 45 },

  // ── Cloze Test ──
  { cat: "Verbal Ability", topic: "Cloze Test", diff: "intermediate", q: "Complete: 'The company ___ a new policy that ___ employees to work from home.'", opts: ["introduced / allows", "introduces / allowed", "introduce / allow", "introduced / allowing"], a: 0, exp: "Past tense pair: introduced / allows (or allowed); best fit is introduced + allows", tags: ["TCS"], time: 60 },
  { cat: "Verbal Ability", topic: "Cloze Test", diff: "advanced", q: "Complete: 'Despite the heavy rain, the match ___ place as ___ .'", opts: ["took / scheduled", "was took / schedule", "take / scheduled", "took / scheduling"], a: 0, exp: "took place as scheduled", tags: ["Infosys"], time: 60 },

  // ── Prepositions ──
  { cat: "Verbal Ability", topic: "Prepositions", diff: "beginner", q: "Choose the correct preposition: 'He is good ___ mathematics.'", opts: ["in", "at", "on", "for"], a: 1, exp: "'Good at' is the idiom", tags: ["TCS"], time: 30 },
  { cat: "Verbal Ability", topic: "Prepositions", diff: "beginner", q: "Choose the correct preposition: 'The book is ___ the table.'", opts: ["on", "at", "in", "above"], a: 0, exp: "'On' for surface contact", tags: ["Infosys"], time: 30 },
  { cat: "Verbal Ability", topic: "Prepositions", diff: "intermediate", q: "Choose the correct preposition: 'She is angry ___ her brother.'", opts: ["with", "on", "at", "to"], a: 0, exp: "'Angry with' a person", tags: ["Accenture"], time: 45 },

  // ── Active and Passive Voice ──
  { cat: "Verbal Ability", topic: "Active and Passive Voice", diff: "beginner", q: "Change to passive: 'The chef cooked the meal.'", opts: ["The meal is cooked by the chef.", "The meal was cooked by the chef.", "The meal has cooked the chef.", "The meal was cooking the chef."], a: 1, exp: "Simple past passive: was cooked", tags: ["TCS"], time: 45 },
  { cat: "Verbal Ability", topic: "Active and Passive Voice", diff: "intermediate", q: "Change to passive: 'They will build a new bridge.'", opts: ["A new bridge will be built by them.", "A new bridge would build by them.", "A new bridge is being built.", "They are building a new bridge."], a: 0, exp: "Future passive: will be built", tags: ["Infosys"], time: 60 },

  // ── Direct and Indirect Speech ──
  { cat: "Verbal Ability", topic: "Direct and Indirect Speech", diff: "intermediate", q: "Convert to indirect: He said, 'I am busy.'", opts: ["He said that he was busy.", "He said that I am busy.", "He said that he is busy.", "He says that he was busy."], a: 0, exp: "Backshift: am → was", tags: ["TCS"], time: 60 },
  { cat: "Verbal Ability", topic: "Direct and Indirect Speech", diff: "advanced", q: "Convert to indirect: She asked, 'Where do you live?'", opts: ["She asked me where I lived.", "She asked me where do I live.", "She asked where I live.", "She asked that I live where."], a: 0, exp: "Wh-word question → statement word order + backshift", tags: ["Accenture"], time: 60 },
];
