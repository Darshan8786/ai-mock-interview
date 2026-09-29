import type { ReactNode } from "react";
import { GRADIENTS, gradientFor } from "./gradients";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={`gloss rounded-2xl mb-6 px-6 py-6 bg-gradient-to-r ${GRADIENTS[gradientFor(title)]}`}>
      <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute right-40 -bottom-20 w-40 h-40 rounded-full bg-white/10" />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">{title}</h1>
          {subtitle && <p className="text-sm text-white/85 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 [&_button]:ring-2 [&_button]:ring-white/50 [&_button[data-variant=ghost]]:!text-white [&_button[data-variant=ghost]]:hover:!bg-white/15">{actions}</div>}
      </div>
    </div>
  );
}
