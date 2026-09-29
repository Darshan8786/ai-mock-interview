import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl gloss bg-gradient-to-br from-indigo-500 via-violet-500 to-violet-500 text-white flex items-center justify-center text-2xl mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-slate-900 font-semibold">{title}</h3>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
