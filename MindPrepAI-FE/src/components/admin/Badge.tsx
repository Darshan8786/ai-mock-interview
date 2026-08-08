export type BadgeTone = "gray" | "green" | "yellow" | "red" | "blue" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  gray: "bg-gray-500/10 text-gray-300 border-gray-600/40",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  red: "bg-red-500/10 text-red-400 border-red-500/30",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export function Badge({ children, tone = "gray" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
