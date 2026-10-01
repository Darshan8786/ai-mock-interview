import { useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { getMyNotifications, type StudentNotification } from "../services/notificationsApi";
import { Icon } from "../Layout";

// three.js only loads for the dashboard's 3D panel, after the page renders.
const DashboardCseScene = lazy(() => import("../components/3d/DashboardCseScene"));

const PRACTICE = [
    {
        icon: "aptitude",
        title: "Aptitude",
        fn: "aptitude.start()",
        description: "Quant, logical and verbal tests, or an adaptive session that tunes difficulty as you go.",
        path: "/aptitude",
        cta: "Start aptitude",
        tint: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
    {
        icon: "tech",
        title: "Tech Practice",
        fn: "tech.practice()",
        description: "Topic-wise MCQs and short answers for languages, DSA, DBMS, OS and more.",
        path: "/tech-practice",
        cta: "Practice tech",
        tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    {
        icon: "interview",
        title: "Mock Interview",
        fn: "interview.run()",
        description: "A proctored AI interview with spoken answers and a detailed feedback report.",
        path: "/mock-interview/dashboard",
        cta: "Start interview",
        tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
];

const TOOLS = [
    { icon: "jobs", title: "Job Opportunities", description: "Placement drives you can apply to", path: "/jobs" },
    { icon: "applications", title: "My Applications", description: "Track your application status", path: "/my-applications" },
    { icon: "resume", title: "Resume Analyzer", description: "AI feedback on your resume", path: "/resume-analyzer" },
    { icon: "builder", title: "Resume Builder", description: "Build an ATS-friendly resume", path: "/resume-builder" },
    { icon: "analytics", title: "Performance Analytics", description: "Progress and weak areas", path: "/personalizedreport" },
    { icon: "profile", title: "Profile", description: "Academic details and skills", path: "/profile" },
];

function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

/** Lines "typed" into the dashboard terminal, one after another. */
function terminalLines(): { prompt?: boolean; text: string; tone?: string }[] {
    return [
        { prompt: true, text: "mindprep status --me" },
        { text: `${greeting()}! Your prep environment is ready.`, tone: "text-fg" },
        { text: "✓ aptitude    adaptive · quant · logical · verbal", tone: "text-emerald-700 dark:text-emerald-400" },
        { text: "✓ tech        DSA · DBMS · OS · CN · languages", tone: "text-emerald-700 dark:text-emerald-400" },
        { text: "✓ interview   AI mock interview with live proctoring", tone: "text-emerald-700 dark:text-emerald-400" },
        { prompt: true, text: "next --suggest" },
        { text: "→ one adaptive session a day keeps the weak topics away", tone: "text-accent-fg" },
    ];
}

function Terminal() {
    const reduced = usePrefersReducedMotion();
    const lines = terminalLines();
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-surface-2/70">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-3 font-mono text-xs text-subtle">student@mindprep: ~</span>
            </div>
            <div className="flex-1 p-5 font-mono text-[13px] leading-relaxed space-y-1 whitespace-pre-wrap" aria-label="Status summary">
                {lines.map((l, i) => (
                    <motion.p
                        key={i}
                        initial={reduced ? false : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: reduced ? 0 : 0.25 + i * 0.35, duration: 0.25 }}
                        className={l.prompt ? "text-fg-2" : `${l.tone ?? "text-muted"} pl-4`}
                    >
                        {l.prompt && <span className="text-accent-fg">$ </span>}
                        {l.text}
                    </motion.p>
                ))}
                <motion.p
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : 0.25 + lines.length * 0.35 }}
                    className="text-fg-2"
                >
                    <span className="text-accent-fg">$ </span>
                    <span className="cse-caret text-accent-fg" aria-hidden />
                </motion.p>
            </div>
        </div>
    );
}

export function Dashboard() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<StudentNotification[]>([]);

    useEffect(() => {
        getMyNotifications()
            .then((res) => setNotifications(res.notifications.filter((n) => !n.read).slice(0, 4)))
            .catch(() => {});
    }, []);

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <p className="font-mono text-xs text-accent-fg">// dashboard</p>
                    <h1 className="font-poppins text-2xl sm:text-3xl font-bold text-fg tracking-tight mt-1">
                        What are you practising today?
                    </h1>
                </div>
                <button
                    onClick={() => navigate("/personalizedreport")}
                    className="self-start sm:self-auto px-4 py-2 rounded-lg border border-line-strong bg-surface text-sm font-medium text-fg-2 hover:bg-surface-2 transition-colors"
                >
                    View my progress
                </button>
            </header>

            {/* Terminal + 3D data structures */}
            <section className="mb-8 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] rounded-xl bg-surface border border-line shadow-card overflow-hidden">
                <Terminal />
                <div className="relative hidden sm:block h-64 lg:h-auto lg:min-h-[17rem] border-t lg:border-t-0 lg:border-l border-line bg-surface-2/40">
                    <Suspense fallback={null}>
                        <DashboardCseScene />
                    </Suspense>
                    <p className="absolute top-3 left-4 font-mono text-[11px] text-subtle">// data structures you'll be asked about</p>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PRACTICE.map((p) => (
                    <div key={p.title} className="flex flex-col rounded-xl bg-surface border border-line shadow-card p-6">
                        <span className={`w-11 h-11 rounded-lg flex items-center justify-center ${p.tint}`}>
                            <Icon name={p.icon} className="w-5 h-5" />
                        </span>
                        <p className="mt-4 font-mono text-xs text-accent-fg">{p.fn}</p>
                        <h2 className="mt-0.5 font-poppins text-lg font-semibold text-fg">{p.title}</h2>
                        <p className="mt-1.5 text-sm text-muted flex-1">{p.description}</p>
                        <button
                            onClick={() => navigate(p.path)}
                            className="mt-6 w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
                        >
                            {p.cta}
                        </button>
                    </div>
                ))}
            </section>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <section className="lg:col-span-2 rounded-xl bg-surface border border-line shadow-card">
                    <div className="px-6 py-4 border-b border-line">
                        <h2 className="font-semibold text-fg">Career tools</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line rounded-b-xl overflow-hidden">
                        {TOOLS.map((t) => (
                            <button
                                key={t.title}
                                onClick={() => navigate(t.path)}
                                className="group flex items-center gap-4 px-6 py-4 text-left bg-surface hover:bg-surface-2 transition-colors"
                            >
                                <span className="w-9 h-9 rounded-lg bg-surface-2 text-muted group-hover:text-accent-fg flex items-center justify-center shrink-0 transition-colors">
                                    <Icon name={t.icon} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-fg">{t.title}</span>
                                    <span className="block text-xs text-muted mt-0.5">{t.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl bg-surface border border-line shadow-card flex flex-col">
                    <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                        <h2 className="font-semibold text-fg">Notifications</h2>
                        <button onClick={() => navigate("/jobs")} className="text-xs font-medium text-accent-fg hover:underline">
                            View jobs →
                        </button>
                    </div>
                    {notifications.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
                            <span className="w-10 h-10 rounded-full bg-surface-2 text-subtle flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <p className="mt-3 text-sm font-medium text-fg">You're all caught up</p>
                            <p className="text-xs text-muted mt-1">New placement drives will show up here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-line">
                            {notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => n.job?.id && navigate(`/jobs/${n.job.id}`)}
                                    className="w-full text-left flex items-start gap-3 px-6 py-4 hover:bg-surface-2 transition-colors"
                                >
                                    <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-fg">{n.title}</span>
                                        <span className="block text-xs text-muted mt-0.5 line-clamp-2">{n.body}</span>
                                        {n.job && (
                                            <span className="block text-xs text-accent-fg mt-1.5 font-medium">
                                                {n.job.companyName} · {n.job.jobTitle}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
