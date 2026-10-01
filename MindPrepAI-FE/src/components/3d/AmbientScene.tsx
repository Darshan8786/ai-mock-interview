import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type Group, type Mesh } from "three";
import { Scene } from "./Scene";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useTheme } from "../../theme/themeContext";

/* Site-wide ambient 3D layer: a few wireframe polyhedra floating near the
 * edges of the viewport, drifting with the pointer and with page scroll at
 * different depths (parallax). Fixed behind the app content; kept light -
 * nine meshes, low DPR - and the shells unmount it on focus pages (tests,
 * quizzes, the proctored interview) and on small screens. */

type Shape = "ico" | "octa" | "torus" | "tetra" | "dodeca";

const SHAPES: { shape: Shape; x: number; y: number; z: number; size: number; speed: number }[] = [
  { shape: "ico", x: -0.44, y: 0.3, z: -2, size: 0.55, speed: 0.18 },
  { shape: "torus", x: 0.43, y: 0.36, z: -3, size: 0.5, speed: -0.14 },
  { shape: "octa", x: -0.38, y: -0.32, z: -1.5, size: 0.42, speed: 0.22 },
  { shape: "dodeca", x: 0.4, y: -0.3, z: -2.5, size: 0.5, speed: -0.16 },
  { shape: "tetra", x: 0.08, y: 0.46, z: -4, size: 0.4, speed: 0.2 },
  { shape: "ico", x: -0.12, y: -0.46, z: -3.5, size: 0.35, speed: -0.2 },
  { shape: "torus", x: -0.47, y: 0.02, z: -4.5, size: 0.38, speed: 0.12 },
  { shape: "octa", x: 0.47, y: 0.0, z: -1.8, size: 0.3, speed: 0.25 },
  { shape: "tetra", x: 0.24, y: -0.12, z: -5, size: 0.45, speed: -0.1 },
];

function Geometry({ shape }: { shape: Shape }) {
  switch (shape) {
    case "ico":
      return <icosahedronGeometry args={[1, 0]} />;
    case "octa":
      return <octahedronGeometry args={[1, 0]} />;
    case "torus":
      return <torusGeometry args={[0.8, 0.3, 10, 24]} />;
    case "tetra":
      return <tetrahedronGeometry args={[1, 0]} />;
    default:
      return <dodecahedronGeometry args={[1, 0]} />;
  }
}

function Floaters({ color, opacity, reduced }: { color: string; opacity: number; reduced: boolean }) {
  const { viewport, camera } = useThree();
  const group = useRef<Group>(null);
  const meshes = useRef<(Mesh | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);

  // Window-level listeners: the canvas sits behind the content, so it never
  // receives pointer events itself.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onScroll = () => {
      scroll.current = window.scrollY;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Place each shape relative to the visible area at its own depth.
  const placed = useMemo(
    () =>
      SHAPES.map((s) => {
        const k = (camera.position.z - s.z) / camera.position.z;
        return { ...s, px: s.x * viewport.width * k, py: s.y * viewport.height * k, depth: k };
      }),
    [viewport.width, viewport.height, camera.position.z]
  );

  useFrame((_, delta) => {
    if (reduced) return;
    const p = pointer.current;
    placed.forEach((s, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.rotation.x += delta * s.speed;
      m.rotation.y += delta * s.speed * 1.3;
      // Nearer shapes move more: pointer + scroll parallax.
      const par = 1 / s.depth;
      const tx = s.px + p.x * 0.35 * par;
      // Bounded: shapes sway with scrolling instead of drifting off-screen on long pages.
      const ty = s.py + p.y * 0.25 * par + Math.sin(scroll.current * 0.0025 + i) * 0.45 * par;
      m.position.x = MathUtils.lerp(m.position.x, tx, 0.05);
      m.position.y = MathUtils.lerp(m.position.y, ty, 0.05);
    });
  });

  return (
    <group ref={group}>
      {placed.map((s, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} position={[s.px, s.py, s.z]} scale={s.size}>
          <Geometry shape={s.shape} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

/** Default export so the shells can lazy-load three.js. */
export default function AmbientScene({ variant = "student" }: { variant?: "student" | "admin" }) {
  const reduced = usePrefersReducedMotion();
  const dark = useTheme().theme === "dark";
  const color = variant === "admin" ? (dark ? "#a78bfa" : "#7c3aed") : dark ? "#818cf8" : "#4f46e5";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Scene className="w-full h-full" cameraPosition={[0, 0, 6]} fov={50} dpr={[1, 1.25]} fallback={null}>
        <Floaters color={color} opacity={dark ? 0.22 : 0.16} reduced={reduced} />
      </Scene>
    </div>
  );
}
