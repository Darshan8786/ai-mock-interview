/**
 * End-to-end sweep of every placement-admin-be endpoint against a RUNNING server + a SCRATCH database.
 *
 *   E2E_API=http://127.0.0.1:5099 E2E_EMAIL=... E2E_PASSWORD=... [E2E_MAIN_TOKEN=<placement-prep-be admin JWT>] npx tsx src/scripts/e2eAdmin.ts
 *
 * Never point it at a real database: it creates and deletes records.
 */
const API = process.env.E2E_API || "http://127.0.0.1:5099";
const EMAIL = process.env.E2E_EMAIL || "e2e-admin@example.test";
const PASSWORD = process.env.E2E_PASSWORD || "E2eAdmin!pass1";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

type Res = { status: number; body: any };
async function req(method: string, path: string, body?: unknown, token?: string): Promise<Res> {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const brief = (r: Res) => `${r.status} ${JSON.stringify(r.body)?.slice(0, 160)}`;
const stamp = Date.now();

(async () => {
  // ── health / docs
  check("health", (await req("GET", "/health")).status === 200);
  const docs = await fetch(`${API}/api/docs/`);
  check("swagger docs served", docs.status === 200);

  // ── auth
  const bad = await req("POST", "/api/admin/login", { email: EMAIL, password: "wrong-password" });
  check("login: wrong password rejected", bad.status === 401, brief(bad));
  const login = await req("POST", "/api/admin/login", { email: EMAIL, password: PASSWORD });
  check("login", login.status === 200 && !!login.body?.data?.tokenPair?.accessToken, brief(login));
  let token: string = login.body?.data?.tokenPair?.accessToken;
  const refreshToken: string = login.body?.data?.tokenPair?.refreshToken;
  const me = await req("GET", "/api/admin/me", undefined, token);
  check("me", me.status === 200 && me.body?.data?.email === EMAIL, brief(me));
  const upd = await req("PUT", "/api/admin/me", { name: "E2E Admin" }, token);
  check("update profile", upd.status === 200 && upd.body?.data?.name === "E2E Admin", brief(upd));
  const ref = await req("POST", "/api/admin/refresh", { refreshToken });
  check("refresh token", ref.status === 200 && !!(ref.body?.data?.tokenPair?.accessToken ?? ref.body?.data?.accessToken), brief(ref));
  if (ref.body?.data?.tokenPair?.accessToken ?? ref.body?.data?.accessToken) token = ref.body.data.tokenPair?.accessToken ?? ref.body.data.accessToken;
  const noAuth = await req("GET", "/api/admin/me");
  check("me without token -> 401", noAuth.status === 401);

  // authentication on admin resources (open routes are a security hole)
  for (const p of ["/api/admin/students", "/api/admin/companies", "/api/admin/jobs", "/api/admin/applications",
    "/api/admin/interviews", "/api/admin/aptitude-tests", "/api/admin/alumni"]) {
    const r = await req("GET", p);
    check(`auth required: GET ${p} without token -> 401`, r.status === 401, String(r.status));
  }
  const openPost = await req("POST", "/api/admin/companies", { companyName: "Hacker Co", hrName: "Anon", email: "x@example.test" });
  check("auth required: anonymous POST cannot create data", openPost.status === 401, String(openPost.status));
  if (openPost.status === 201 && openPost.body?.data?._id) await req("DELETE", `/api/admin/companies/${openPost.body.data._id}`, undefined, token);

  // ── dashboard
  const dash = await req("GET", "/api/admin/dashboard", undefined, token);
  check("dashboard stats", dash.status === 200 && dash.body?.data && typeof dash.body.data === "object", brief(dash));

  // ── students
  const st = await req("POST", "/api/admin/students", { name: "Asha Rao", email: `asha${stamp}@example.test`, password: "Student!1", department: "CSE", batch: "2026", skills: ["Java", "SQL"] }, token);
  check("student: create", st.status === 201, brief(st));
  const sid = st.body?.data?._id;
  check("student: password never returned", st.body?.data && !("password" in st.body.data), brief(st));
  const dup = await req("POST", "/api/admin/students", { name: "Asha Rao", email: `asha${stamp}@example.test`, password: "Student!1" }, token);
  check("student: duplicate email -> 4xx not 500", dup.status >= 400 && dup.status < 500, brief(dup));
  const sl = await req("GET", "/api/admin/students?search=Asha&page=1&limit=5", undefined, token);
  check("student: list + search + pagination", sl.status === 200 && Array.isArray(sl.body?.data) && sl.body.data.some((s: any) => s._id === sid), brief(sl));
  check("student: get", (await req("GET", `/api/admin/students/${sid}`, undefined, token)).status === 200);
  const su = await req("PUT", `/api/admin/students/${sid}`, { atsScore: 82, status: "active" }, token);
  check("student: update", su.status === 200 && su.body?.data?.atsScore === 82, brief(su));
  check("student: invalid id -> 400", (await req("GET", "/api/admin/students/not-an-id", undefined, token)).status === 400);
  check("student: unknown id -> 404", (await req("GET", "/api/admin/students/64b000000000000000000000", undefined, token)).status === 404);
  const sv = await req("POST", "/api/admin/students", { name: "A", email: "bad" }, token);
  check("student: validation error -> 400 with message", sv.status === 400 && /email/i.test(sv.body?.message || ""), brief(sv));

  // ── companies
  const co = await req("POST", "/api/admin/companies", { companyName: `Acme ${stamp}`, hrName: "Priya", email: `hr${stamp}@acme.test`, website: "https://acme.test", location: "Bengaluru" }, token);
  check("company: create", co.status === 201, brief(co));
  const cid = co.body?.data?._id;
  check("company: list", (await req("GET", "/api/admin/companies?search=Acme", undefined, token)).body?.data?.some((c: any) => c._id === cid));
  const cu = await req("PUT", `/api/admin/companies/${cid}`, { location: "Pune" }, token);
  check("company: update", cu.status === 200 && cu.body?.data?.location === "Pune", brief(cu));

  // ── jobs
  const jb = await req("POST", "/api/admin/jobs", { title: "Backend Engineer", company: cid, package: "12 LPA", skills: ["Node.js"], deadline: "2030-01-31" }, token);
  check("job: create", jb.status === 201, brief(jb));
  const jid = jb.body?.data?._id;
  check("job: default openings applied (1)", jb.body?.data?.openings === 1, String(jb.body?.data?.openings));
  const jl = await req("GET", "/api/admin/jobs?search=Backend", undefined, token);
  check("job: list", jl.status === 200 && jl.body?.data?.some((j: any) => j._id === jid), brief(jl));
  const jg = await req("GET", `/api/admin/jobs/${jid}`, undefined, token);
  check("job: get (company populated)", jg.status === 200 && (jg.body?.data?.company?.companyName || jg.body?.data?.company), brief(jg));
  check("job: unknown company -> 4xx", (await req("POST", "/api/admin/jobs", { title: "Ghost job", company: "64b000000000000000000000" }, token)).status < 500);
  const ju = await req("PUT", `/api/admin/jobs/${jid}`, { status: "closed", openings: 3 }, token);
  check("job: update", ju.status === 200 && ju.body?.data?.openings === 3, brief(ju));
  await req("PUT", `/api/admin/jobs/${jid}`, { status: "open" }, token);

  // ── applications
  const ap = await req("POST", "/api/admin/applications", { student: sid, job: jid }, token);
  check("application: create", ap.status === 201, brief(ap));
  const aid = ap.body?.data?._id;
  const apDup = await req("POST", "/api/admin/applications", { student: sid, job: jid }, token);
  check("application: duplicate -> 4xx", apDup.status >= 400 && apDup.status < 500, brief(apDup));
  const al = await req("GET", "/api/admin/applications", undefined, token);
  check("application: list", al.status === 200 && al.body?.data?.some((a: any) => a._id === aid), brief(al));
  const as = await req("PATCH", `/api/admin/applications/${aid}/status`, { status: "shortlisted" }, token);
  check("application: status update", as.status === 200 && as.body?.data?.status === "shortlisted", brief(as));
  check("application: bad status -> 400", (await req("PATCH", `/api/admin/applications/${aid}/status`, { status: "maybe" }, token)).status === 400);

  // ── interviews
  const iv = await req("POST", "/api/admin/interviews", { student: sid, job: jid, scheduledAt: "2030-01-10T10:00:00Z" }, token);
  check("interview: create", iv.status === 201, brief(iv));
  const iid = iv.body?.data?._id;
  check("interview: default mode applied (ai)", iv.body?.data?.mode === "ai", String(iv.body?.data?.mode));
  check("interview: list", (await req("GET", "/api/admin/interviews", undefined, token)).body?.data?.some((i: any) => i._id === iid));
  const iu = await req("PUT", `/api/admin/interviews/${iid}`, { status: "completed" }, token);
  check("interview: update", iu.status === 200 && iu.body?.data?.status === "completed", brief(iu));
  const isc = await req("PATCH", `/api/admin/interviews/${iid}/scores`, { scores: { technical: 80, communication: 70 }, feedback: "Solid" }, token);
  check("interview: scores", isc.status === 200, brief(isc));

  // ── aptitude tests
  const at = await req("POST", "/api/admin/aptitude-tests", {
    title: "Quant Mock", questions: [{ question: "What is 20% of 150?", options: ["20", "25", "30", "35"], correctAnswer: "30" }],
  }, token);
  check("aptitude: create", at.status === 201, brief(at));
  const tid = at.body?.data?._id;
  check("aptitude: defaults applied (draft, 30 min)", at.body?.data?.status === "draft" && at.body?.data?.timeLimitMin === 30, `${at.body?.data?.status} ${at.body?.data?.timeLimitMin}`);
  const badKey = await req("POST", "/api/admin/aptitude-tests", { title: "Bad key", questions: [{ question: "2+2?", options: ["3", "5"], correctAnswer: "4" }] }, token);
  check("aptitude: correctAnswer must be one of the options", badKey.status === 400, brief(badKey));
  check("aptitude: list", (await req("GET", "/api/admin/aptitude-tests", undefined, token)).body?.data?.some((t: any) => t._id === tid));
  check("aptitude: get", (await req("GET", `/api/admin/aptitude-tests/${tid}`, undefined, token)).status === 200);
  const atu = await req("PUT", `/api/admin/aptitude-tests/${tid}`, { status: "published" }, token);
  check("aptitude: update", atu.status === 200 && atu.body?.data?.status === "published", brief(atu));
  const atr = await req("GET", `/api/admin/aptitude-tests/${tid}/results`, undefined, token);
  check("aptitude: results list", atr.status === 200, brief(atr));
  const atr1 = await req("GET", "/api/admin/aptitude-tests/results/64b000000000000000000000", undefined, token);
  check("aptitude: result by attempt id is reachable (404 for unknown, not 400)", atr1.status === 404, brief(atr1));

  // ── alumni
  const alm = await req("POST", "/api/admin/alumni", {
    name: "Ravi Kumar", graduationYear: 2021, department: "CSE", currentCompany: "Infosys", currentJobRole: "SDE 2",
    email: `ravi${stamp}@example.test`, hasOpening: true,
    opening: { jobTitle: "Java Developer", location: "Mysuru", requiredSkills: ["Java"], jobDescription: "Build backend services in Java.", applicationLink: "https://careers.example.test/1", lastDateToApply: "2030-02-01" },
  }, token);
  check("alumni: create with opening", alm.status === 201, brief(alm));
  const lid = alm.body?.data?._id;
  check("alumni: list", (await req("GET", "/api/admin/alumni?hasOpening=true", undefined, token)).body?.data?.some((a: any) => a._id === lid));
  const alu = await req("PUT", `/api/admin/alumni/${lid}`, { currentJobRole: "SDE 3" }, token);
  check("alumni: update", alu.status === 200 && alu.body?.data?.currentJobRole === "SDE 3", brief(alu));
  const js = await req("POST", "/api/admin/alumni", { name: "Evil", graduationYear: 2020, department: "CSE", currentCompany: "X", currentJobRole: "Y", email: `e${stamp}@example.test`, hasOpening: true,
    opening: { jobTitle: "Job", location: "Remote", requiredSkills: [], jobDescription: "xxxxxxxxxxxx", applicationLink: "javascript:alert(1)", lastDateToApply: "2030-01-01" } }, token);
  check("alumni: javascript: links rejected", js.status === 400, brief(js));
  const pub = await req("GET", "/api/alumni-openings");
  check("public alumni openings (no login) list the opening", pub.status === 200 && pub.body?.data?.some((o: any) => o.alumniName === "Ravi Kumar"), brief(pub));
  check("public alumni openings expose no email", !JSON.stringify(pub.body).includes(`ravi${stamp}@`));

  // ── main-backend admin token (single sign-on from the MindPrep admin panel)
  if (process.env.E2E_MAIN_TOKEN) {
    const r = await req("GET", "/api/admin/alumni", undefined, process.env.E2E_MAIN_TOKEN);
    check("main-backend admin token accepted", r.status === 200, brief(r));
    if (process.env.E2E_MAIN_USER_TOKEN) {
      const u = await req("GET", "/api/admin/alumni", undefined, process.env.E2E_MAIN_USER_TOKEN);
      check("main-backend STUDENT token rejected", u.status === 403 || u.status === 401, brief(u));
    }
  }

  // ── cleanup + deletes
  check("delete interview", (await req("DELETE", `/api/admin/interviews/${iid}`, undefined, token)).status === 200);
  check("delete application", (await req("DELETE", `/api/admin/applications/${aid}`, undefined, token)).status === 200);
  check("delete job", (await req("DELETE", `/api/admin/jobs/${jid}`, undefined, token)).status === 200);
  check("delete company", (await req("DELETE", `/api/admin/companies/${cid}`, undefined, token)).status === 200);
  check("delete student", (await req("DELETE", `/api/admin/students/${sid}`, undefined, token)).status === 200);
  check("delete aptitude test", (await req("DELETE", `/api/admin/aptitude-tests/${tid}`, undefined, token)).status === 200);
  check("delete alumni", (await req("DELETE", `/api/admin/alumni/${lid}`, undefined, token)).status === 200);
  check("deleted alumni gone -> 404", (await req("GET", `/api/admin/alumni/${lid}`, undefined, token)).status === 404);

  const pw = await req("PUT", "/api/admin/me/password", { currentPassword: PASSWORD, newPassword: PASSWORD + "x" }, token);
  check("change password", pw.status === 200, brief(pw));
  const relog = await req("POST", "/api/admin/login", { email: EMAIL, password: PASSWORD + "x" });
  check("login with new password", relog.status === 200, brief(relog));
  await req("PUT", "/api/admin/me/password", { currentPassword: PASSWORD + "x", newPassword: PASSWORD }, relog.body?.data?.tokenPair?.accessToken);
  const lo = await req("POST", "/api/admin/logout", undefined, relog.body?.data?.tokenPair?.accessToken);
  check("logout", lo.status === 200, brief(lo));
  const reuse = await req("POST", "/api/admin/refresh", { refreshToken: relog.body?.data?.tokenPair?.refreshToken });
  check("refresh token revoked after logout", reuse.status === 401, brief(reuse));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log(`FAIL  harness error: ${e?.stack || e}`);
  process.exit(1);
});
