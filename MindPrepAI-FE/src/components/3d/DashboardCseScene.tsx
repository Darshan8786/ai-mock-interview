import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import { Scene } from "./Scene";
import { CseStructures } from "./CseBackdrop";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useTheme } from "../../theme/themeContext";

/** Tilts toward the pointer while it is over the canvas. */
function Tilt({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.y = MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.35, 0.05);
    ref.current.rotation.x = MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.2, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

/** Default export so the dashboard can lazy-load three.js. */
export default function DashboardCseScene() {
  const reduced = usePrefersReducedMotion();
  const dark = useTheme().theme === "dark";
  return (
    <Scene className="w-full h-full" cameraPosition={[0, 0, 5.3]} fov={45} fallback={<div className="w-full h-full" />}>
      <directionalLight position={[2, 4, 5]} intensity={1.2} />
      <Tilt reduced={reduced}>
        <CseStructures dark={dark} reduced={reduced} />
      </Tilt>
    </Scene>
  );
}
