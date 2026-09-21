/**
 * Lists the messages the study chatbot could not answer, most frequent first.
 *
 *   npm run chatbot:unanswered
 *
 * This is the training backlog: add the missing topics/phrasings to
 * src/services/chatbot/kb/*.ts, then run `npm run train:chatbot`.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { ChatbotUnanswered } from "../models/ChatbotUnanswered";

(async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
  const rows = await ChatbotUnanswered.aggregate([
    {
      $group: {
        _id: { $toLower: "$query" },
        count: { $sum: 1 },
        outcome: { $last: "$outcome" },
        topTarget: { $last: "$topTarget" },
        topScore: { $last: "$topScore" },
        last: { $max: "$createdAt" },
      },
    },
    { $sort: { count: -1, last: -1 } },
    { $limit: 50 },
  ]);

  if (!rows.length) console.log("No unanswered messages logged yet.");
  rows.forEach((r: any) =>
    console.log(
      `${String(r.count).padStart(3)}×  "${r._id}"  [${r.outcome}` +
        (r.topTarget ? `, closest: ${r.topTarget} @ ${r.topScore}` : "") +
        "]"
    )
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
