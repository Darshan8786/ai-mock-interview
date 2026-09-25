import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface FloatingCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Keep small (default) - this wraps real UI
   * (stats, forms, buttons), not a showpiece; usability over spectacle. */
  intensity?: number;
}

/**
 * DOM/CSS 3D tilt wrapper (mouse-parallax), not a WebGL canvas - this wraps
 * arbitrary card content (text, buttons, real interactive elements), which
 * isn't practical to render inside a <Canvas>. Lives in components/3d/
 * alongside the WebGL pieces because it's the "3D depth" primitive for
 * ordinary DOM cards (stat tiles, feature cards, admin analytics cards).
 */
export function FloatingCard({ children, className = "", intensity = 6 }: FloatingCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        reducedMotion
          ? undefined
          : { rotateX, rotateY, transformStyle: "preserve-3d", transformPerspective: 800 }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
