import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "gloss bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-700 text-white hover:brightness-110 border border-indigo-700/40",
  secondary: "glass text-indigo-700 hover:bg-white",
  danger: "gloss bg-gradient-to-b from-rose-400 via-rose-500 to-violet-600 text-white hover:brightness-110 border border-rose-600/40",
  ghost: "bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent",
  success: "gloss bg-gradient-to-b from-indigo-400 via-indigo-500 to-indigo-600 text-white hover:brightness-110 border border-indigo-600/40",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const spinner = variant === "primary" || variant === "success" || variant === "danger" ? "border-white/40 border-t-white" : "border-slate-300 border-t-slate-600";
  return (
    <button
      disabled={disabled || loading}
      data-variant={variant}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <span className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${spinner}`} />}
      {children}
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
