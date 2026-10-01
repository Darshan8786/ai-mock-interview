import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseInput =
  "w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-muted transition-colors";

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
      <span className="block text-xs font-semibold text-fg-2 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
