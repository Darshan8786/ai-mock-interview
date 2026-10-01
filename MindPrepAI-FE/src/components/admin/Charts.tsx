import type { ReactNode } from "react";

export function ChartCard({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl bg-surface border border-line shadow-card p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}
