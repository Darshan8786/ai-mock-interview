// Two-colour (indigo + violet) gradients for the admin panel.
export const GRADIENTS = {
  indigo: "from-indigo-500 to-violet-600",
  violet: "from-violet-500 to-indigo-600",
  deep: "from-indigo-600 to-violet-700",
  soft: "from-indigo-400 to-violet-500",
} as const;

export type GradientName = keyof typeof GRADIENTS;
export const GRADIENT_ORDER: GradientName[] = ["indigo", "violet", "deep", "soft"];

/** Stable gradient for a string (e.g. a page title). */
export function gradientFor(key: string): GradientName {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENT_ORDER[h % GRADIENT_ORDER.length];
}
