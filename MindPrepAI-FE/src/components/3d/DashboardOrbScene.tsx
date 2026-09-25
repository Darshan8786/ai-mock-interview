import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Scene } from "./Scene";
import { AIOrb } from "./AIOrb";
import { ParticleField } from "./ParticleField";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

/** Gently rotates its children to follow the pointer - the "mouse/parallax
 * interaction" from the brief. Lerped, not 1:1, so it reads as ambient depth
 * rather than a literal cursor-follow toy. */
function ParallaxRig({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += (state.pointer.x * 0.4 - ref.current.rotation.y) * 0.04;
    ref.current.rotation.x += (-state.pointer.y * 0.2 - ref.current.rotation.x) * 0.04;
  });

  return <group ref={ref}>{children}</group>;
}

/** Default export so this whole module (and its three.js/@react-three/fiber
 * imports) can be code-split via React.lazy - pages without 3D content never
 * pay for this bundle. */
export default function DashboardOrbScene() {
  return (
    <Scene
      className="w-full h-full"
      cameraPosition={[0, 0, 5]}
      fallback={<div className="w-full h-full bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-cyan-500/10" />}
    >
      <ParallaxRig>
        <AIOrb />
      </ParallaxRig>
      <ParticleField count={60} scale={5} />
    </Scene>
  );
}
