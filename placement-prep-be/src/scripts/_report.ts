import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

(async () => {
  await mongoose.connect(process.env.MONGO_URI || "");
  const c = mongoose.connection.collection("aptitudequestions");
  const total = await c.countDocuments({ isActive: true });
  const bySource = await c
    .aggregate([{ $match: { isActive: true } }, { $group: { _id: "$source", count: { $sum: 1 } } }])
    .toArray();
  const perTopic = await c
    .aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { category: "$category", topic: "$topic" }, count: { $sum: 1 } } },
      { $sort: { count: 1 } },
    ])
    .toArray();
  console.log("TOTAL active:", total);
  console.log("BY SOURCE:", JSON.stringify(bySource));
  const groups: Record<string, number> = { "1-3": 0, "4-6": 0, "7-10": 0, "11-15": 0, "16-20": 0, "20+": 0 };
  perTopic.forEach((t: any) => {
    const n = t.count;
    if (n <= 3) groups["1-3"]++;
    else if (n <= 6) groups["4-6"]++;
    else if (n <= 10) groups["7-10"]++;
    else if (n <= 15) groups["11-15"]++;
    else if (n <= 20) groups["16-20"]++;
    else groups["20+"]++;
  });
  console.log("TOPIC COUNT BUCKETS:", JSON.stringify(groups), "total topics =", perTopic.length);
  console.log("SMALLEST TOPICS (top 10):");
  perTopic.slice(0, 10).forEach((t: any) => console.log("  " + t._id.category + " / " + t._id.topic + ": " + t.count));
  await mongoose.disconnect();
  process.exit(0);
})();
