import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../../theme/ThemeProvider";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import type { AuthMood, AuthVariant } from "../3d/AuthScene";

export type { AuthMood, AuthVariant };

// three.js is only downloaded once the auth page renders, after the form.
const AuthScene = lazy(() => import("../3d/AuthScene"));

const MOOD_CAPTION: Record<AuthVariant, Record<AuthMood, string>> = {
  student: {
    idle: "Your placement prep, all in one place.",
    email: "Nice to see you.",
    password: "We'll look away while you type.",
    loading: "Signing you in…",
    error: "Hmm, that didn't work. Try again?",
    success: "Welcome back!",
  },
  admin: {
    idle: "Placement cell control centre.",
    email: "Welcome back, admin.",
    password: "We'll look away while you type.",
    loading: "Verifying admin access…",
    error: "Hmm, that didn't work. Try again?",
    success: "Access granted.",
  },
};

/** Colour treatment per variant: blue for students, violet for admins. Kept as
 * full class strings so Tailwind can see them. */
const STYLES: Record<
  AuthVariant,
  {
    page: string;
    blobA: string;
    blobB: string;
    logo: string;
    cardShadow: string;
    link: string;
    inputIdle: string;
    button: string;
  }
> = {
  student: {
    page: "from-sky-100 via-sky-200 to-blue-300 dark:from-[#0b1a33] dark:via-[#0f2a52] dark:to-[#173a6e]",
    blobA: "bg-white/70 dark:bg-sky-400/20",
    blobB: "bg-cyan-300/40 dark:bg-blue-400/20",
    logo: "bg-blue-600 ring-blue-700/20",
    cardShadow: "shadow-sky-900/10 dark:shadow-blue-950/40",
    link: "text-blue-700 hover:text-blue-800",
    inputIdle: "hover:border-sky-300 focus:border-blue-500 focus:ring-blue-500/20",
    button: "bg-blue-600 hover:bg-blue-700 shadow-blue-900/15 dark:text-blue-800 dark:hover:bg-blue-50",
  },
  admin: {
    page: "from-violet-100 via-purple-200 to-fuchsia-200 dark:from-[#160b2e] dark:via-[#25104d] dark:to-[#3b1366]",
    blobA: "bg-white/70 dark:bg-fuchsia-400/20",
    blobB: "bg-violet-300/40 dark:bg-purple-400/20",
    logo: "bg-violet-600 ring-violet-700/20",
    cardShadow: "shadow-violet-900/10 dark:shadow-purple-950/40",
    link: "text-violet-700 hover:text-violet-800",
    inputIdle: "hover:border-violet-300 focus:border-violet-500 focus:ring-violet-500/20",
    button: "bg-violet-600 hover:bg-violet-700 shadow-violet-900/15 dark:text-violet-800 dark:hover:bg-violet-50",
  },
};

const VariantContext = createContext<AuthVariant>("student");

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  mood?: AuthMood;
  /** Bump on every keystroke so the 3D orb reacts to typing. */
  pulse?: number;
  /** Bump to shake the form (failed submit). */
  shake?: number;
  /** Link to the other auth page shown under the submit button, e.g. "New here?" + "Create an account". */
  switchPrompt: { text: string; label: string; to: string };
  /** Small link in the footer (defaults to the admin sign-in link). */
  footerLink?: { text: string; label: string; to: string };
  variant?: AuthVariant;
}

const ADMIN_LINK = { text: "Placement admin?", label: "Admin sign in →", to: "/admin/signin" };

/** Frame for the sign-in / sign-up pages (student and admin): an
 * interactive 3D scene filling the page, a frosted-glass form card centred
 * over it, and the orb floating just above, reacting to what the user does.
 * The fields below are styled for that glass card only. */
export function AuthShell({
  title,
  subtitle,
  children,
  mood = "idle",
  pulse = 0,
  shake = 0,
  switchPrompt,
  footerLink = ADMIN_LINK,
  variant = "student",
}: AuthShellProps) {
  const navigate = useNavigate();
  const st = STYLES[variant];
  const reduced = usePrefersReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const orbSlot = useRef<HTMLDivElement>(null);
  const shakeControls = useAnimationControls();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (shake === 0 || reduced) return;
    shakeControls.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.45 } });
  }, [shake, reduced, shakeControls]);

  return (
    <VariantContext.Provider value={variant}>
    <div className={`relative min-h-screen overflow-hidden text-slate-900 dark:text-white bg-gradient-to-br ${st.page}`}>
      {/* Soft light blobs behind the scene for depth. */}
      <div aria-hidden className={`fixed -top-32 -left-24 w-[30rem] h-[30rem] rounded-full blur-3xl ${st.blobA}`} />
      <div aria-hidden className={`fixed -bottom-40 -right-24 w-[34rem] h-[34rem] rounded-full blur-3xl ${st.blobB}`} />

      <Suspense fallback={null}>
        <AuthScene mood={mood} pulse={pulse} pointer={pointer} anchor={orbSlot} variant={variant} />
      </Suspense>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 sm:px-8 pt-4">
          <div className="flex items-center gap-2.5">
            <span className={`w-9 h-9 rounded-xl text-white dark:bg-white/15 ring-1 dark:ring-white/25 backdrop-blur flex items-center justify-center font-mono text-[12px] font-bold tracking-tighter ${st.logo}`}>&lt;/&gt;</span>
            <span className="hidden sm:inline font-poppins font-bold">MindPrep AI</span>
            {variant === "admin" && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-violet-600/10 text-violet-800 ring-1 ring-violet-600/20 dark:bg-white/10 dark:text-white dark:ring-white/20">
                Admin
              </span>
            )}
          </div>
          <ThemeToggle tone="onBrand" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-4">
          {/* The 3D orb is drawn into this empty slot (see AuthScene). */}
          <div ref={orbSlot} aria-hidden className="w-full max-w-[420px] h-[clamp(84px,16vh,168px)] shrink-0" />

          <motion.p
            key={mood}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-2 mb-4 h-6 text-center font-poppins text-base sm:text-lg font-semibold text-slate-800 dark:text-white dark:drop-shadow-sm"
            aria-live="polite"
          >
            {MOOD_CAPTION[variant][mood]}
          </motion.p>

          <motion.div animate={shakeControls} className="w-full max-w-[420px]">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`auth-glass rounded-2xl bg-white/45 dark:bg-white/[0.07] backdrop-blur-xl backdrop-saturate-150 border border-white/80 dark:border-white/15 shadow-xl p-6 sm:p-8 ${st.cardShadow}`}
            >
              <h1 className="font-poppins text-2xl sm:text-[1.75rem] font-bold text-slate-900 dark:text-white tracking-tight text-center">{title}</h1>
              <p className="text-sm text-slate-600 dark:text-white/70 mt-1.5 mb-6 text-center">{subtitle}</p>
              {children}
              <p className="mt-5 text-center text-sm text-slate-600 dark:text-white/70">
                {switchPrompt.text}{" "}
                <button
                  type="button"
                  onClick={() => navigate(switchPrompt.to)}
                  className={`font-semibold dark:text-white dark:hover:text-white hover:underline ${st.link}`}
                >
                  {switchPrompt.label}
                </button>
              </p>
            </motion.div>
          </motion.div>
        </main>

        <footer className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 px-5 sm:px-8 pb-4 text-xs text-slate-600 dark:text-white/65">
          <p>© {new Date().getFullYear()} MindPrep AI</p>
          <p>
            {footerLink.text}{" "}
            <button onClick={() => navigate(footerLink.to)} className="font-semibold text-slate-800 hover:text-slate-950 dark:text-white/90 dark:hover:text-white hover:underline">
              {footerLink.label}
            </button>
          </p>
        </footer>
      </div>
    </div>
    </VariantContext.Provider>
  );
}

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  adornment?: React.ReactNode;
}

export function AuthField({ label, error, hint, adornment, id, ...props }: AuthFieldProps) {
  const st = STYLES[useContext(VariantContext)];
  const inputId = id || `auth-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-white/85 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          {...props}
          className={`w-full px-3.5 py-3 rounded-lg bg-white/60 dark:bg-white/10 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/45 text-sm outline-none transition focus:bg-white/85 dark:focus:bg-white/15 focus:ring-4 ${
            adornment ? "pr-11" : ""
          } ${
            error
              ? "border-red-400 dark:border-red-300/80 focus:ring-red-400/20 dark:focus:ring-red-300/25"
              : `border-white/90 dark:border-white/25 dark:hover:border-white/40 dark:focus:border-white/70 dark:focus:ring-white/15 ${st.inputIdle}`
          }`}
        />
        {adornment && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{adornment}</div>}
      </div>
      {(error || hint) && (
        <p id={`${inputId}-msg`} className={`mt-1.5 text-xs ${error ? "text-red-600 dark:text-red-200" : "text-amber-700 dark:text-amber-200"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle and a Caps Lock warning. */
export function PasswordField({
  label = "Password",
  onCapsLock,
  ...props
}: Omit<AuthFieldProps, "type" | "adornment" | "label"> & { label?: string; onCapsLock?: (on: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const on = e.getModifierState?.("CapsLock") ?? false;
    setCaps(on);
    onCapsLock?.(on);
  };
  return (
    <AuthField
      {...props}
      label={label}
      type={visible ? "text" : "password"}
      onKeyDown={(e) => { checkCaps(e); props.onKeyDown?.(e); }}
      onKeyUp={checkCaps}
      hint={props.error ? undefined : caps ? "Caps Lock is on" : undefined}
      adornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white/70 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 5.09A9.77 9.77 0 0112 4.8c5 0 8.27 4.2 9 7.2a10.4 10.4 0 01-2.63 4.24M6.1 6.1C4.27 7.33 3.05 9.2 2.5 12c.73 3 4 7.2 9.5 7.2 1.6 0 3-.36 4.2-.97" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12C3.23 9 6.5 4.8 12 4.8S20.77 9 21.5 12c-.73 3-4 7.2-9.5 7.2S3.23 15 2.5 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      }
    />
  );
}

export function AuthSubmit({
  loading,
  success,
  loadingLabel = "Signing in…",
  successLabel = "Signed in",
  children,
}: {
  loading: boolean;
  success?: boolean;
  loadingLabel?: string;
  successLabel?: string;
  children: React.ReactNode;
}) {
  const st = STYLES[useContext(VariantContext)];
  return (
    <motion.button
      type="submit"
      disabled={loading || success}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed overflow-hidden shadow-lg ${
        success ? "bg-emerald-500 text-white" : `text-white dark:bg-white disabled:opacity-80 ${st.button}`
      }`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading && (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {success && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {success ? successLabel : loading ? loadingLabel : children}
      </span>
    </motion.button>
  );
}

