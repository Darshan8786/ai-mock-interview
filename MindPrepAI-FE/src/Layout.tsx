import { Toaster } from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type StudentNotification,
} from "./services/notificationsApi";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationsBell({ isResumeAnalyzer }: { isResumeAnalyzer: boolean }) {
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

  const tone = isResumeAnalyzer ? "text-gray-600 hover:bg-gray-100" : "text-gray-300 hover:bg-white/10";

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className={`relative p-2 rounded-lg transition-all ${tone}`} aria-label="Notifications">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 max-h-[420px] overflow-hidden rounded-2xl shadow-2xl z-50 flex flex-col ${
          isResumeAnalyzer ? "bg-white border border-gray-200" : "glass-strong"
        }`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isResumeAnalyzer ? "border-gray-200" : "border-white/10"}`}>
            <p className={`text-sm font-semibold ${isResumeAnalyzer ? "text-black" : "text-white"}`}>Notifications</p>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className={`text-xs font-medium ${isResumeAnalyzer ? "text-blue-600" : "text-blue-400"} hover:underline`}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <p className={`text-xs px-4 py-6 text-center ${isResumeAnalyzer ? "text-gray-500" : "text-gray-500"}`}>Loading…</p>
            ) : notifications.length === 0 ? (
              <p className={`text-sm px-4 py-8 text-center ${isResumeAnalyzer ? "text-gray-500" : "text-gray-500"}`}>
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`block w-full text-left px-4 py-3 transition-colors border-b last:border-b-0 ${
                    isResumeAnalyzer
                      ? "hover:bg-gray-50 border-gray-100"
                      : "hover:bg-white/5 border-white/5"
                  } ${n.read ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isResumeAnalyzer ? "text-black" : "text-white"}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${isResumeAnalyzer ? "text-gray-500" : "text-gray-400"}`}>{n.body}</p>
                      <p className={`text-[10px] mt-1 uppercase tracking-wide ${isResumeAnalyzer ? "text-gray-400" : "text-gray-500"}`}>
                        {timeAgo(n.createdAt)}
                      </p>
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !!localStorage.getItem("token");
  const isAuthPage =
    location.pathname === "/signin" ||
    location.pathname === "/signup" ||
    location.pathname === "/admin/signin" ||
    location.pathname.startsWith("/admin");
  const isResumeAnalyzer = location.pathname === "/resume-analyzer" || location.pathname === "/resume-builder";

  const navLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Profile", path: "/profile" },
    { label: "Aptitude", path: "/aptitude" },
    { label: "Interview", path: "/mock-interview/dashboard" },
    { label: "Tech Practice", path: "/tech-practice" },
    { label: "Jobs", path: "/jobs" },
    { label: "My Apps", path: "/my-applications" },
    { label: "Analytics", path: "/personalizedreport" },
    { label: "Resume", path: "/resume-analyzer" },
    { label: "Builder", path: "/resume-builder" },
  ];

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/signin");
  };

  return (
    <div className="min-h-screen w-full bg-[#050508] relative">
      <Toaster />
      {/* Aurora gradient + grid background */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#050508]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: "44px 44px",
          }}
        />
        <div className="glow-orb animate-float-slow absolute -top-32 -left-24 w-96 h-96 bg-violet-600/20" />
        <div className="glow-orb animate-float-slow absolute top-1/3 -right-32 w-[28rem] h-[28rem] bg-fuchsia-600/15" style={{ animationDelay: "2s" }} />
        <div className="glow-orb animate-float-slow absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10" style={{ animationDelay: "4s" }} />
      </div>

      {/* Header Navigation */}
      {!isAuthPage && (
        <header className={`sticky top-0 z-20 ${isResumeAnalyzer
          ? 'backdrop-blur-md border-b border-gray-200 bg-white/95'
          : 'glass-strong border-b-0'
          }`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2.5 hover:opacity-90 transition"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${isResumeAnalyzer
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-violet-500/40'
                  }`}>
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className={`hidden sm:inline font-bold text-lg font-poppins ${isResumeAnalyzer ? 'text-black' : 'text-white'}`}>MindPrep <span className={isResumeAnalyzer ? '' : 'gradient-text'}>AI</span></span>
              </button>

              {/* Desktop Navigation */}
              {isAuthenticated && (
                <nav className="hidden md:flex items-center gap-1">
                  {navLinks.map((link) => (
                    <button
                      key={link.path}
                      onClick={() => navigate(link.path)}
                      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${location.pathname === link.path
                        ? isResumeAnalyzer
                          ? 'bg-blue-100 text-blue-700'
                          : 'btn-gradient'
                        : isResumeAnalyzer
                          ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      {link.label}
                    </button>
                  ))}
                </nav>
              )}              {/* Right Side Actions */}
              <div className="flex items-center gap-4">
                {isAuthenticated ? (
                  <>
                    <NotificationsBell isResumeAnalyzer={isResumeAnalyzer} />
                    <button
                      onClick={handleSignOut}
                      className={`hidden sm:inline px-4 py-2 rounded-lg font-medium transition-all ${isResumeAnalyzer
                        ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    {location.pathname !== "/signin" && (
                      <button
                        onClick={() => navigate("/signin")}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isResumeAnalyzer
                          ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        Sign In
                      </button>
                    )}
                    {location.pathname !== "/signup" && (
                      <button
                        onClick={() => navigate("/signup")}
                        className={`px-4 py-2 rounded-full font-medium transition-all ${isResumeAnalyzer
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'btn-gradient'
                          }`}
                      >
                        Sign Up
                      </button>
                    )}
                  </>
                )}

                {/* Mobile Menu Button */}
                {isAuthenticated && (
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`md:hidden p-2 rounded-lg ${isResumeAnalyzer
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-white/10'
                      }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isAuthenticated && mobileMenuOpen && (
              <nav className={`md:hidden pb-4 space-y-1.5 pt-4 ${isResumeAnalyzer ? 'border-t border-gray-200' : 'border-t border-white/10'}`}>
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => {
                      navigate(link.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 rounded-xl font-medium transition-all ${location.pathname === link.path
                      ? isResumeAnalyzer
                        ? 'bg-blue-100 text-blue-700'
                        : 'btn-gradient'
                      : isResumeAnalyzer
                        ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {link.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2 rounded-xl font-medium transition-all ${isResumeAnalyzer
                    ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                  Sign Out
                </button>
              </nav>
            )}
          </div>
        </header>
      )}

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}


