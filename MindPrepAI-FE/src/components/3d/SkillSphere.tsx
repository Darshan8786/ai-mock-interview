import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface SkillSphereProps {
  /** One point is placed per skill (evenly, via a golden-angle spiral) -
   * this visualizes "how many / how broad", not each skill's individual
   * strength. Pair it with a normal text list for the actual skill names. */
  skillCount: number;
  color?: string;
  radius?: number;
}

/** A wireframe sphere with a glowing point per skill - an abstract "skill
 * coverage" visualization. Meant to sit inside a <Scene>. */
export function SkillSphere({ skillCount, color = "#22d3ee", radius = 1.6 }: SkillSphereProps) {
  const groupRef = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  const points = useMemo(() => {
    const n = Math.max(skillCount, 6);
    const pts: [number, number, number][] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / Math.max(n - 1, 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      pts.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
    }
    return pts;
  }, [skillCount, radius]);

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
      </mesh>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
