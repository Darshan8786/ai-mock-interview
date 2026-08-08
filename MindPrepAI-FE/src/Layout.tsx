import { Toaster } from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

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
    { label: "Quiz", path: "/quizpage" },
    { label: "Aptitude", path: "/aptitude" },
    { label: "Interview", path: "/mock-interview/dashboard" },
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
    <div className="min-h-screen w-full bg-black relative">
      <Toaster />
      {/* Black Basic Grid Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: "#000000",
          backgroundImage: `
            linear-gradient(to right, rgba(75, 85, 99, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(75, 85, 99, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header Navigation */}
      {!isAuthPage && (
        <header className={`sticky top-0 z-20 backdrop-blur-md ${isResumeAnalyzer
          ? 'border-b border-gray-200 bg-white/95'
          : 'border-b border-gray-700 bg-black'
          }`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isResumeAnalyzer
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : 'bg-gradient-to-br from-blue-600 to-blue-700'
                  }`}>
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className={`hidden sm:inline font-bold text-lg ${isResumeAnalyzer ? 'text-black' : 'text-white'}`}>MindPrep AI</span>
              </button>

              {/* Desktop Navigation */}
              {isAuthenticated && (
                <nav className="hidden md:flex items-center gap-1">
                  {navLinks.map((link) => (
                    <button
                      key={link.path}
                      onClick={() => navigate(link.path)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${location.pathname === link.path
                        ? isResumeAnalyzer
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-blue-600 text-white'
                        : isResumeAnalyzer
                          ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                          : 'text-gray-300 hover:text-white hover:bg-gray-800'
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isResumeAnalyzer
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
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
              <nav className={`md:hidden pb-4 space-y-2 pt-4 ${isResumeAnalyzer ? 'border-t border-gray-200' : 'border-t border-gray-700'}`}>
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => {
                      navigate(link.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 rounded-lg font-medium transition-all ${location.pathname === link.path
                      ? isResumeAnalyzer
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-600 text-white'
                      : isResumeAnalyzer
                        ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
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
                  className={`block w-full text-left px-4 py-2 rounded-lg font-medium transition-all ${isResumeAnalyzer
                    ? 'text-gray-600 hover:text-black hover:bg-gray-100'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
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


