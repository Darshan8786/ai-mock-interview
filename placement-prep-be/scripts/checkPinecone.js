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
        const pc = new pinecone_1.Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const name = process.env.PINECONE_INDEX_NAME || "mindprep";
        console.log("Checking index:", name);
        try {
            const desc = yield pc.describeIndex(name);
            console.log("INDEX EXISTS");
            console.log("  dimension:", desc.dimension);
            console.log("  metric:", desc.metric);
            console.log("  model:", desc.deletionProtection);
            console.log("  spec:", JSON.stringify(desc.spec || desc.configuration, null, 2));
        }
        catch (e) {
            console.log("DESCRIBE FAILED:", e.message);
        }
        try {
            const idx = pc.index(name);
            const stats = yield idx.describeIndexStats();
            console.log("STATS:", JSON.stringify(stats, null, 2));
        }
        catch (e) {
            console.log("STATS FAILED:", e.message);
        }
    });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
