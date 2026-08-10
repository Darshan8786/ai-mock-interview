"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pinecone_1 = require("@pinecone-database/pinecone");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const pc = new pinecone_1.Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const name = process.env.PINECONE_INDEX_NAME || "mindprep";
        console.log("1. Describing current index:", name);
        let before = null;
        try {
            before = yield pc.describeIndex(name);
            console.log("   dimension:", before.dimension, "| metric:", before.metric);
        }
        catch (e) {
            console.log("   index does not exist yet:", e.message.split("\n")[0]);
        }
        if (before && before.dimension === 1536) {
            console.log("2. Dimension already 1536 — no change needed.");
        }
        else {
            if (before) {
                console.log("2. Deleting index (it has 0 records, safe)...");
                yield pc.deleteIndex(name);
                console.log("   deleted. Waiting for it to disappear...");
                for (let i = 0; i < 40; i++) {
                    yield new Promise((r) => setTimeout(r, 3000));
                    let gone = false;
                    try {
                        yield pc.describeIndex(name);
                    }
                    catch (e2) {
                        if (String(e2.message).includes("404") || String(e2.message).toLowerCase().includes("not found")) {
                            gone = true;
                        }
                    }
                    if (gone) {
                        console.log(`   gone after ${i + 1} polls.`);
                        break;
                    }
                }
            }
            console.log("3. Creating index with dimension 1536, cosine...");
            yield pc.createIndex({
                name,
                dimension: 1536,
                metric: "cosine",
                spec: { serverless: { cloud: "aws", region: "us-east-1" } },
            });
            console.log("   createIndex called. Waiting for it to become ready...");
            for (let i = 0; i < 30; i++) {
                yield new Promise((r) => setTimeout(r, 4000));
                const desc = yield pc.describeIndex(name);
                const state = (_a = desc.status) === null || _a === void 0 ? void 0 : _a.state;
                console.log(`   [${i + 1}] status=${state} dimension=${desc.dimension} metric=${desc.metric}`);
                if (state === "Ready")
                    break;
            }
        }
        const idx = pc.index(name);
        const stats = yield idx.describeIndexStats();
        console.log("FINAL STATS:", JSON.stringify(stats, null, 2));
    });
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
