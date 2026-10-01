import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type StudentNotification,
} from "./services/notificationsApi";
import { ThemeToggle } from "./theme/ThemeProvider";
import { CodeBackdrop } from "./components/common/CodeBackdrop";
import { Ambient3D } from "./components/common/Ambient3D";
import { TerminalPath } from "./components/common/TerminalPath";

// Focus pages: tests, quizzes and the proctored interview. The CSE backdrop
// keeps only its static grid there so nothing moves near the questions.
const FOCUS_ROUTES = ["/mock-interview/room", "/aptitude/session/", "/aptitude/test/", "/aptitude/practice", "/aptitude/adaptive/", "/tech-practice/quiz", "/tech-practice/adaptive/"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getMyNotifications();
        if (mounted) {
          setUnread(res.unread);
          setNotifications(res.notifications);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await getMyNotifications();
        setUnread(res.unread);
        setNotifications(res.notifications);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClick = async (n: StudentNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.job?.id) navigate(`/jobs/${n.job.id}`);
    else if (n.type === "job_status") navigate("/my-applications");
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setUnread(0);
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[420px] overflow-hidden rounded-xl bg-surface border border-line shadow-pop z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs font-medium text-accent-fg hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <p className="text-xs px-4 py-6 text-center text-subtle">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm px-4 py-8 text-center text-subtle">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`block w-full text-left px-4 py-3 transition-colors border-b border-line last:border-b-0 hover:bg-surface-2 ${n.read ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-fg">{n.title}</p>
                      <p className="text-xs mt-0.5 line-clamp-2 text-muted">{n.body}</p>
                      <p className="text-[10px] mt-1 uppercase tracking-wide text-subtle">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ICONS: Record<string, string> = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  aptitude: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  tech: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  interview: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  jobs: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  applications: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  resume: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  builder: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  analytics: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  profile: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  signout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};

export function Icon({ name, className = "w-[18px] h-[18px]" }: { name: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  );
}

const NAV_GROUPS: { label: string; links: { label: string; path: string; icon: string; match?: string }[] }[] = [
  {
    label: "Overview",
    links: [
      { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
      { label: "Analytics", path: "/personalizedreport", icon: "analytics" },
    ],
  },
  {
    label: "Practice",
    links: [
      { label: "Aptitude", path: "/aptitude", icon: "aptitude", match: "/aptitude" },
      { label: "Tech Practice", path: "/tech-practice", icon: "tech", match: "/tech-practice" },
      { label: "Mock Interview", path: "/mock-interview/dashboard", icon: "interview", match: "/mock-interview" },
    ],
  },
  {
    label: "Career",
    links: [
      { label: "Jobs", path: "/jobs", icon: "jobs", match: "/jobs" },
      { label: "My Applications", path: "/my-applications", icon: "applications" },
      { label: "Resume Analyzer", path: "/resume-analyzer", icon: "resume" },
      { label: "Resume Builder", path: "/resume-builder", icon: "builder" },
    ],
  },
  {
    label: "Account",
    links: [{ label: "Profile", path: "/profile", icon: "profile" }],
  },
];

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-mono text-[12px] font-bold tracking-tighter">&lt;/&gt;</span>
      <span className="font-poppins font-bold text-fg tracking-tight">
        MindPrep <span className="text-accent-fg">AI</span>
      </span>
    </button>
  );
}

function SidebarNav({ onNavigate, onSignOut }: { onNavigate: (path: string) => void; onSignOut: () => void }) {
  const location = useLocation();
  const isActive = (path: string, match?: string) =>
    match ? location.pathname.startsWith(match) : location.pathname === path;

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-line shrink-0">
        <Brand onClick={() => onNavigate("/dashboard")} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 font-mono text-[11px] text-subtle">// {group.label.toLowerCase()}</p>
            <div className="space-y-0.5">
              {group.links.map((link) => {
                const active = isActive(link.path, link.match);
                return (
                  <button
                    key={link.path}
                    onClick={() => onNavigate(link.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-accent-soft text-accent-fg" : "text-muted hover:text-fg hover:bg-surface-2"
                    }`}
                  >
                    <Icon name={link.icon} />
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-line shrink-0">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors"
        >
          <Icon name="signout" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !!localStorage.getItem("token");
  // Auth pages and the admin panel render their own full-page layouts.
  const isBarePage =
    location.pathname === "/signin" ||
    location.pathname === "/signup" ||
    location.pathname.startsWith("/admin");

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);
  const focusPage = FOCUS_ROUTES.some((r) => location.pathname.startsWith(r));

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/signin");
  };

  if (isBarePage) return <>{children}</>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-page">
        <header className="h-16 border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl h-full px-4 sm:px-6 flex items-center justify-between">
            <Brand onClick={() => navigate("/")} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={() => navigate("/signin")} className="px-3.5 py-2 rounded-lg text-sm font-medium text-fg-2 hover:bg-surface-2">
                Sign in
              </button>
              <button onClick={() => navigate("/signup")} className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent-hover text-white">
                Sign up
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <CodeBackdrop quiet={focusPage} />
      <Ambient3D off={focusPage} />
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-surface border-r border-line z-30">
        <SidebarNav onNavigate={navigate} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface border-r border-line shadow-pop">
            <SidebarNav onNavigate={navigate} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-surface/85 backdrop-blur border-b border-line">
          <div className="h-full px-4 sm:px-6 flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="lg:hidden">
              <Brand onClick={() => navigate("/dashboard")} />
            </div>
            <TerminalPath className="hidden lg:block" />
            <div className="flex-1" />
            <ThemeToggle />
            <NotificationsBell />
            <button
              onClick={() => navigate("/profile")}
              className="ml-1 w-8 h-8 rounded-full bg-accent-soft text-accent-fg flex items-center justify-center"
              aria-label="Profile"
            >
              <Icon name="profile" className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
