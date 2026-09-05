"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const t = (label, ms) => console.log(`${label.padEnd(38)} ${(ms / 1000).toFixed(2)}s`);
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Ollama embed via backend service
        let t0 = Date.now();
        try {
            const { embedText } = yield Promise.resolve().then(() => __importStar(require("./src/services/embeddingService")));
            const v = yield embedText("Full Stack Developer Technical Entry Level mock interview");
            t("embedText (Ollama)", Date.now() - t0);
            console.log("  vector dims:", v.length);
        }
        catch (e) {
            t("embedText ERROR", Date.now() - t0);
            console.log(" ", e.message);
        }
        // 2. Pinecone query
        t0 = Date.now();
        try {
            const { getInterviewContext } = yield Promise.resolve().then(() => __importStar(require("./src/services/interviewRagService")));
            const ctx = yield getInterviewContext("testuser", "Full Stack Developer Technical Entry Level");
            t("getInterviewContext (Pinecone)", Date.now() - t0);
            console.log("  ctx len:", ctx.length);
        }
        catch (e) {
            t("Pinecone ERROR", Date.now() - t0);
            console.log(" ", e.message);
        }
        // 3. Flask generate-questions over localhost (IPv6 trap) vs 127.0.0.1
        const body = {
            jobRole: "Full Stack Developer",
            experienceLevel: "Entry Level",
            interviewType: "Technical",
            difficulty: "Medium",
            totalQuestions: 3,
        };
        const headers = {
            "Content-Type": "application/json",
            "X-AI-Service-Key": process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026",
        };
        for (const host of ["http://localhost:8000", "http://127.0.0.1:8000"]) {
            t0 = Date.now();
            try {
                yield axios_1.default.post(`${host}/generate-questions`, body, {
                    headers,
                    timeout: 30000,
                });
                t(`generate-questions via ${host}`, Date.now() - t0);
            }
            catch (e) {
                t(`generate-questions via ${host} ERROR`, Date.now() - t0);
                console.log(" ", e.message);
            }
        }
    });
}
main().catch((e) => console.error(e));
