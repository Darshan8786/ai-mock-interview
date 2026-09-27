import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseInput =
  "w-full bg-white/70 backdrop-blur border border-white shadow-[inset_0_1px_2px_rgba(49,46,129,0.08)] rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 disabled:bg-slate-50 disabled:text-slate-500 transition-colors";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseInput} pr-8 ${props.className || ""}`} />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-indigo-900/70 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
