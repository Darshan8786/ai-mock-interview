import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group } from "three";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface ProgressRing3DProps {
  /** 0-100. The actual number should still be rendered as real DOM text
   * next to/over this - this is a visual accent, not the only source of the
   * value (accessibility, and so it's never blocked by a WebGL failure). */
  progress: number;
  color?: string;
  trackColor?: string;
  radius?: number;
  thickness?: number;
}

/** A tilted 3D progress ring (e.g. ATS score, aptitude completion). Meant to
 * sit inside a <Scene>. */
export function ProgressRing3D({
  progress,
  color = "#a78bfa",
  trackColor = "#ffffff33",
  radius = 1.2,
  thickness = 0.18,
}: ProgressRing3DProps) {
  const groupRef = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(100, progress));
  const arcLength = (clamped / 100) * Math.PI * 2;

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z += delta * 0.05;
  });

  return (
    <group ref={groupRef} rotation={[0.35, 0, 0]}>
      <mesh>
        <ringGeometry args={[radius - thickness, radius, 64]} />
        <meshBasicMaterial color={trackColor} side={DoubleSide} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <ringGeometry args={[radius - thickness, radius, 64, 1, 0, arcLength]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} side={DoubleSide} />
      </mesh>
    </group>
  );
}
