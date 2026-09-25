// Imported from the specific submodule, not the "@react-three/drei" barrel -
// see the comment in AIOrb.tsx for why (a barrel re-export elsewhere in drei
// is broken against the installed three version; Sparkles itself is clean).
import { Sparkles } from "@react-three/drei/core/Sparkles";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface ParticleFieldProps {
  count?: number;
  color?: string;
  size?: number;
  scale?: number | [number, number, number];
}

/** Subtle ambient particles for background depth - deliberately sparse and
 * slow (this is a professional placement platform, not a game). Uses drei's
 * Sparkles (a single optimized Points draw call, not per-particle meshes).
 * Meant to sit inside a <Scene>. */
export function ParticleField({ count = 80, color = "#a78bfa", size = 2, scale = 6 }: ParticleFieldProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Sparkles
      count={count}
      scale={scale}
      size={size}
      speed={reducedMotion ? 0 : 0.3}
      color={color}
      opacity={0.6}
    />
  );
}
