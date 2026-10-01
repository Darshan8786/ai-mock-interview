import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent hover:bg-accent-hover text-white border border-transparent",
  secondary: "bg-surface text-fg-2 hover:text-fg hover:bg-surface-2 border border-line-strong",
  danger: "bg-red-600 hover:bg-red-700 text-white border border-transparent",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2 border border-transparent",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const spinner = variant === "primary" || variant === "success" || variant === "danger" ? "border-white/40 border-t-white" : "border-line-strong border-t-fg-2";
  return (
    <button
      disabled={disabled || loading}
      data-variant={variant}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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
      className={`p-1.5 rounded-md text-subtle hover:text-fg hover:bg-surface-2 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
