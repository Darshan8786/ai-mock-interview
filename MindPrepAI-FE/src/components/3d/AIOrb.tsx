import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
// Imported from the specific submodule, not the "@react-three/drei" barrel:
// the barrel's index re-exports SpotLight.js, which imports `LinearEncoding`
// from three - an export removed in the installed three version (0.181.x).
// MeshDistortMaterial itself has no such dependency, so this path avoids the
// broken export entirely without needing to upgrade/patch drei.
import { MeshDistortMaterial } from "@react-three/drei/core/MeshDistortMaterial";
import type { Mesh } from "three";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface AIOrbProps {
  color?: string;
  wireColor?: string;
  scale?: number;
}

/** Abstract, professional "AI assistant" object - a distorted, slowly
 * rotating core with a wireframe shell. Not a literal robot/character, per
 * the "professional, not gaming-style" brief. Meant to sit inside a <Scene>. */
export function AIOrb({ color = "#8b5cf6", wireColor = "#22d3ee", scale = 1.4 }: AIOrbProps) {
  const coreRef = useRef<Mesh>(null);
  const wireRef = useRef<Mesh>(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    if (reducedMotion) return;
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.15;
      coreRef.current.rotation.x += delta * 0.05;
    }
    if (wireRef.current) {
      wireRef.current.rotation.y -= delta * 0.08;
    }
  });

  return (
    <group scale={scale}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          distort={0.35}
          speed={reducedMotion ? 0 : 1.5}
          roughness={0.15}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={wireRef} scale={1.35}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={0.25} />
      </mesh>
    </group>
  );
}
