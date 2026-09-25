import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Scene } from "./Scene";
import { SkillSphere } from "./SkillSphere";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

function AutoRotate({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += delta * 0.15;
  });
  return <group ref={ref}>{children}</group>;
}

interface SkillSphereSceneProps {
  skillCount: number;
  color?: string;
}

/** Compact "skill coverage" accent for a Skills card header - the real skill
 * names still render as a normal text/tag list next to it. Default export
 * so it can be React.lazy-loaded. */
export default function SkillSphereScene({ skillCount, color = "#22d3ee" }: SkillSphereSceneProps) {
  return (
    <Scene className="w-full h-full" cameraPosition={[0, 0, 4.2]}>
      <AutoRotate>
        <SkillSphere skillCount={skillCount} color={color} radius={1.3} />
      </AutoRotate>
    </Scene>
  );
}
