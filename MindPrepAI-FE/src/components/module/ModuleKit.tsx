import { lazy, Suspense, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ModuleKind } from "../3d/ModuleScene";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/* Shared layout pieces for the Aptitude, Tech Practice and Mock Interview
 * pages, so the three modules look and behave like one product. */

const ModuleScene = lazy(() => import("../3d/ModuleScene"));

export function ModuleHero({
  kind,
  kicker,
  title,
  description,
  stats = [],
  actions,
}: {
  kind: ModuleKind;
  kicker: string;
  title: string;
  description: string;
  stats?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden mb-8 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] rounded-2xl bg-surface border border-line shadow-card"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative p-6 sm:p-8 flex flex-col">
        <p className="font-mono text-xs text-accent-fg">{kicker}</p>
        <h1 className="mt-1.5 font-poppins text-3xl sm:text-4xl font-bold text-fg tracking-tight">{title}</h1>
        <p className="mt-3 text-sm sm:text-[15px] text-muted max-w-xl leading-relaxed">{description}</p>
        {stats.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2/70 border border-line px-3.5 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-subtle">{s.label}</dt>
                <dd className="mt-1 text-xl font-bold text-fg tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {actions && <div className="mt-6 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      <div className="relative h-56 sm:h-64 lg:h-auto lg:min-h-[19rem] border-t lg:border-t-0 lg:border-l border-line bg-gradient-to-br from-accent-soft/60 to-transparent">
        <Suspense fallback={null}>
          <ModuleScene kind={kind} />
        </Suspense>
      </div>
    </motion.section>
  );
}

export function Panel({
  kicker,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-surface border border-line shadow-card ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 pt-5">
        <div>
          {kicker && <p className="font-mono text-[11px] text-accent-fg">{kicker}</p>}
          <h2 className="font-poppins text-lg font-semibold text-fg">{title}</h2>
          {description && <p className="text-xs text-muted mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="grid gap-1 p-1 rounded-xl bg-surface-2 border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-lg px-3 py-2.5 text-left transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            {active && (
              <motion.span layoutId={`seg-${options.map((x) => x.value).join("-")}`} className="absolute inset-0 rounded-lg bg-surface border border-line shadow-card" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative block text-sm font-semibold">{o.label}</span>
            {o.hint && <span className="relative block text-[11px] text-muted mt-0.5 leading-snug">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
        active ? "bg-accent-soft text-accent-fg border-accent/40" : "bg-surface text-fg-2 border-line-strong hover:border-accent/40 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
