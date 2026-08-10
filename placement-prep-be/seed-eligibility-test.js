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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const User_js_1 = require("./src/models/User.js");
const MONGO_URI = process.env.MONGO_URI;
const PASSWORD = "Test@123";
const users = [
    { name: "Eligible Alice", email: "alice@elig.test", usn: "1GD23CS101", department: "Computer Science", cgpa: 8.9, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "A" },
    { name: "Low CGPA Bob", email: "bob@elig.test", usn: "1GD23CS102", department: "Computer Science", cgpa: 6.8, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "B" },
    { name: "Backlog Carol", email: "carol@elig.test", usn: "1GD23CS103", department: "Computer Science", cgpa: 8.2, backlogs: 2, graduationYear: 2027, year: "4", semester: "7", section: "A" },
    { name: "Wrong Dept Dave", email: "dave@elig.test", usn: "1GD23EC104", department: "Electronics & Communication", cgpa: 9.0, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "C" },
    { name: "Wrong Year Erin", email: "erin@elig.test", usn: "1GD23CS105", department: "Computer Science", cgpa: 8.7, backlogs: 0, graduationYear: 2025, year: "4", semester: "7", section: "B" },
    { name: "Multi Reason Frank", email: "frank@elig.test", usn: "1GD23ME106", department: "Mechanical", cgpa: 6.5, backlogs: 3, graduationYear: 2026, year: "4", semester: "7", section: "C" },
    { name: "No CGPA Grace", email: "grace@elig.test", usn: "1GD23IS107", department: "Information Science", cgpa: null, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "A" },
    { name: "Boundary Henry", email: "henry@elig.test", usn: "1GD23CS108", department: "Computer Science", cgpa: 7.5, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "B" },
    { name: "One Backlog Ivy", email: "ivy@elig.test", usn: "1GD23IS109", department: "Information Science", cgpa: 7.9, backlogs: 1, graduationYear: 2027, year: "4", semester: "7", section: "A" },
    { name: "Inactive Jack", email: "jack@elig.test", usn: "1GD23CS110", department: "Computer Science", cgpa: 8.8, backlogs: 0, graduationYear: 2027, year: "4", semester: "7", section: "B", isActive: false },
];
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(MONGO_URI);
        console.log("connected");
        const removed = yield User_js_1.User.deleteMany({ email: { $regex: "@elig\\.test$" } });
        console.log("removed existing test users:", removed.deletedCount);
        for (const u of users) {
            const created = yield User_js_1.User.create(Object.assign(Object.assign({}, u), { password: PASSWORD, role: "user", verificationStatus: "verified" }));
            console.log(`created ${created.email} -> ${created._id} active=${created.isActive}`);
        }
        yield mongoose_1.default.disconnect();
        console.log("done");
    });
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
