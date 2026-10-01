import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ThemeToggle } from "../../theme/ThemeProvider";
import { CodeBackdrop } from "../common/CodeBackdrop";
import { Ambient3D } from "../common/Ambient3D";
import { TerminalPath } from "../common/TerminalPath";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
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
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {children}
    </svg>
  );
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", path: "/admin", icon: <NavIcon>{icons.dashboard}</NavIcon> },
      { label: "Reports & Analytics", path: "/admin/reports", icon: <NavIcon>{icons.reports}</NavIcon> },
    ],
  },
  {
    title: "Students",
    items: [
      { label: "Students", path: "/admin/students", icon: <NavIcon>{icons.students}</NavIcon> },
      { label: "Resumes", path: "/admin/resumes", icon: <NavIcon>{icons.resumes}</NavIcon> },
    ],
  },
  {
    title: "Assessments",
    items: [
      { label: "Interviews", path: "/admin/interviews", icon: <NavIcon>{icons.interviews}</NavIcon> },
      { label: "Aptitude", path: "/admin/aptitude", icon: <NavIcon>{icons.aptitude}</NavIcon> },
    ],
  },
  {
    title: "Placements",
    items: [
      { label: "Jobs", path: "/admin/jobs", icon: <NavIcon>{icons.jobs}</NavIcon> },
      { label: "Alumni", path: "/admin/alumni", icon: <NavIcon>{icons.alumni}</NavIcon> },
      { label: "Announcements", path: "/admin/announcements", icon: <NavIcon>{icons.announcements}</NavIcon> },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", path: "/admin/settings", icon: <NavIcon>{icons.settings}</NavIcon> }],
  },
];
const allItems = navGroups.flatMap((g) => g.items);

const isActive = (path: string, pathname: string) =>
  path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-mono text-[12px] font-bold tracking-tighter">&lt;/&gt;</span>
      <span className="font-poppins font-bold text-fg tracking-tight">
        MindPrep <span className="text-accent-fg">AI</span>
      </span>
      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-accent-soft text-accent-fg">
        Admin
      </span>
    </button>
  );
}

function SidebarNav({ onNavigate, onSignOut }: { onNavigate: (path: string) => void; onSignOut: () => void }) {
  const location = useLocation();
  const adminName = localStorage.getItem("user_name") || "Administrator";
  const adminEmail = localStorage.getItem("user_email") || "Placement cell";

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-line shrink-0">
        <Brand onClick={() => onNavigate("/admin")} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 font-mono text-[11px] text-subtle">// {group.title.toLowerCase()}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path, location.pathname);
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-accent-soft text-accent-fg" : "text-muted hover:text-fg hover:bg-surface-2"
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-line shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-fg flex items-center justify-center text-sm font-semibold shrink-0">
            {adminName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg truncate">{adminName}</p>
            <p className="text-xs text-subtle truncate">{adminEmail}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-fg hover:bg-surface-2 transition-colors"
        >
          <NavIcon>{icons.logout}</NavIcon>
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = allItems.find((i) => isActive(i.path, location.pathname));

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleSignOut = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminRole");
    navigate("/admin/signin");
  };

  return (
    <div className="admin-scope min-h-screen bg-page text-fg">
      <CodeBackdrop variant="admin" />
      <Ambient3D variant="admin" />
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-surface border-r border-line z-30">
        <SidebarNav onNavigate={navigate} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface border-r border-line shadow-pop">
            <SidebarNav onNavigate={navigate} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-surface/85 backdrop-blur border-b border-line">
          <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
              <span className="font-semibold text-fg truncate">{current?.label || "Dashboard"}</span>
              <TerminalPath className="hidden md:block" />
            </nav>
            <div className="flex-1" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted px-2.5 py-1 rounded-full border border-line">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live data
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
