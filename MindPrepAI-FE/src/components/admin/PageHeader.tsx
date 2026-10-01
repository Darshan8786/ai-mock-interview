import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { pathname } = useLocation();
  // Code-comment kicker, e.g. "// admin/students".
  const kicker = pathname.split("/").filter((s) => s && !/^[0-9a-f]{12,}$/i.test(s)).slice(0, 2).join("/") || "admin";
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="font-mono text-xs text-accent-fg mb-1">// {kicker}</p>
        <h1 className="font-poppins text-2xl font-bold text-fg tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
