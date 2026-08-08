require("ts-node").register({ transpileOnly: true });
const q1 = require("../src/data/quantSeed1").quantSeed1;
const q2 = require("../src/data/quantSeed2").quantSeed2;
const l1 = require("../src/data/logicalSeed1").logicalSeed1;
const l2 = require("../src/data/logicalSeed2").logicalSeed2;
const v1 = require("../src/data/verbalSeed1").verbalSeed1;
const v2 = require("../src/data/verbalSeed2").verbalSeed2;
const d2 = require("../src/data/diSeed2").diSeed2;
const topics = require("../src/data/aptitudeTopics").aptitudeTopics;

const all = [...q1, ...q2, ...l1, ...l2, ...v1, ...v2, ...d2];
const topicNames = new Set(topics.map((t) => t.name));
const errs = [];
const seenQ = new Set();

all.forEach((x, i) => {
  if (!x.cat || !x.topic || !x.q || !Array.isArray(x.opts) || x.opts.length !== 4 || x.a === undefined || !x.exp)
    errs.push(i + ": missing field");
  if (!topicNames.has(x.topic)) errs.push(i + ': unknown topic "' + x.topic + '"');
  if (x.a < 0 || x.a > 3) errs.push(i + ": a out of range " + x.a);
  if (new Set(x.opts).size !== 4) errs.push(i + ": duplicate options");
  if (!["beginner", "intermediate", "advanced"].includes(x.diff)) errs.push(i + ": bad diff " + x.diff);
  const key = x.cat + "::" + x.topic + "::" + x.q;
  if (seenQ.has(key)) errs.push(i + ": duplicate question");
  seenQ.add(key);
});

const cats = {};
all.forEach((x) => {
  cats[x.cat] = (cats[x.cat] || 0) + 1;
});

// verify every topic has at least 15 questions
const perTopic = {};
all.forEach((x) => {
  perTopic[x.topic] = (perTopic[x.topic] || 0) + 1;
});

console.log("TOTAL:", all.length, JSON.stringify(cats));
const low = Object.entries(perTopic).filter(([k, v]) => v < 15);
console.log("TOPICS <15:", JSON.stringify(low));
console.log("ERRORS:", errs.length);
if (errs.length) console.log(errs.slice(0, 30).join("\n"));
