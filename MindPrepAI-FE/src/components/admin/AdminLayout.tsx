import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./admin.css";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Icon-chip colour for this item. */
  chip: string;
}

const icons = {
  dashboard: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" />,
  students: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  resumes: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  interviews: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
  aptitude: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  jobs: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  alumni: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />,
  reports: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  announcements: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  settings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {children}
    </svg>
  );
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", path: "/admin", icon: <NavIcon>{icons.dashboard}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
      { label: "Reports & Analytics", path: "/admin/reports", icon: <NavIcon>{icons.reports}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
    ],
  },
  {
    title: "Students",
    items: [
      { label: "Students", path: "/admin/students", icon: <NavIcon>{icons.students}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
      { label: "Resumes", path: "/admin/resumes", icon: <NavIcon>{icons.resumes}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
    ],
  },
  {
    title: "Assessments",
    items: [
      { label: "Interviews", path: "/admin/interviews", icon: <NavIcon>{icons.interviews}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
      { label: "Aptitude", path: "/admin/aptitude", icon: <NavIcon>{icons.aptitude}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
    ],
  },
  {
    title: "Placements",
    items: [
      { label: "Jobs", path: "/admin/jobs", icon: <NavIcon>{icons.jobs}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
      { label: "Alumni", path: "/admin/alumni", icon: <NavIcon>{icons.alumni}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
      { label: "Announcements", path: "/admin/announcements", icon: <NavIcon>{icons.announcements}</NavIcon>, chip: "from-indigo-400 to-violet-500" },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", path: "/admin/settings", icon: <NavIcon>{icons.settings}</NavIcon>, chip: "from-indigo-400 to-violet-500" }],
  },
];
const allItems = navGroups.flatMap((g) => g.items);

const isActive = (path: string, pathname: string) =>
  path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl gloss-sm bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
        <span className="text-white font-bold text-sm">M</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">MindPrep AI</p>
        <p className="text-[11px] text-white/70">Placement Admin</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const adminName = localStorage.getItem("user_name") || "Administrator";
  const adminEmail = localStorage.getItem("user_email") || "Placement cell";

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    navigate("/signin");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-5 h-16 border-b border-white/10">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path, location.pathname);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      onNavigate?.();
                    }}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-white/95 text-indigo-800 shadow-[inset_0_1px_0_#fff,0_8px_20px_-6px_rgba(0,0,0,0.45)]"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span className={`w-8 h-8 shrink-0 rounded-lg gloss-sm flex items-center justify-center text-white bg-gradient-to-br ${item.chip} [&_svg]:w-[18px] [&_svg]:h-[18px]`}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/10 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div className="w-8 h-8 rounded-full gloss-sm bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center text-sm font-semibold">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{adminName}</p>
            <p className="text-xs text-white/60 truncate">{adminEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <NavIcon>{icons.logout}</NavIcon>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current = allItems.find((i) => isActive(i.path, location.pathname));

  return (
    <div className="min-h-screen admin-backdrop text-slate-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 glass-dark z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed inset-y-0 left-0 w-64 glass-dark z-50 lg:hidden"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 h-14 glass-strong border-b border-white/70 shadow-[0_1px_0_rgba(255,255,255,0.9),0_6px_20px_-12px_rgba(49,46,129,0.25)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <nav className="flex items-center gap-1.5 text-sm">
              <span className="text-slate-400">Admin</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{current?.label || "Dashboard"}</span>
            </nav>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 glass px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" /> Live data
          </span>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
