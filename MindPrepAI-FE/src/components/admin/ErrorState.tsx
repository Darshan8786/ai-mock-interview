import { Button } from "./Button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/25 rounded-xl p-4 flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 flex items-center justify-center text-sm font-bold">!</span>
        <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">{message}</p>
      </div>
      {onRetry && <Button variant="danger" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
