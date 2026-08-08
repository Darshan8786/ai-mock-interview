import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 border border-transparent",
  secondary: "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700",
  danger: "bg-red-600/15 text-red-400 hover:bg-red-600/25 border border-red-500/30",
  ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
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
      className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
