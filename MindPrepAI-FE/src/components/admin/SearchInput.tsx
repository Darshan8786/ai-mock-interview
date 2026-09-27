interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="w-4 h-4 text-violet-500 absolute left-3.5 top-1/2 -translate-y-1/2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/70 backdrop-blur border border-white shadow-[inset_0_1px_2px_rgba(49,46,129,0.08)] rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 transition-colors"
      />
    </div>
  );
}
