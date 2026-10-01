import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
// Submodule imports, not the drei barrel - see AIOrb.tsx for why.
import { MeshDistortMaterial } from "@react-three/drei/core/MeshDistortMaterial";
import { Sparkles } from "@react-three/drei/core/Sparkles";
import { Color, MathUtils, Vector3, type Group, type Mesh } from "three";
import { Scene } from "./Scene";
import { CseBackdrop, type AuthVariant } from "./CseBackdrop";

export type { AuthVariant };
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useTheme } from "../../theme/themeContext";

/** What the sign-in form is doing right now; the scene reacts to it. */
export type AuthMood = "idle" | "email" | "password" | "loading" | "error" | "success";

interface AuthSceneProps {
  mood: AuthMood;
  /** Incremented on every keystroke - each bump sends a ripple through the orb. */
  pulse: number;
  /** Pointer position normalised to [-1, 1] over the whole window, so the scene
   * follows the cursor even while it is over the form (the canvas never sees
   * those events itself). */
  pointer: MutableRefObject<{ x: number; y: number }>;
  /** Empty DOM element marking where the orb should sit. The canvas covers the
   * whole viewport; each frame the orb is moved to this slot's centre and sized
   * to its height, so it tracks the responsive layout exactly. */
  anchor: RefObject<HTMLElement | null>;
  variant?: AuthVariant;
}

const ADMIN_MOOD_COLOR: Record<AuthMood, string> = {
  idle: "#a78bfa",
  email: "#8b5cf6",
  password: "#c084fc",
  loading: "#38bdf8",
  error: "#f87171",
  success: "#34d399",
};

const MOOD_COLOR: Record<AuthMood, string> = {
  idle: "#60a5fa",
  email: "#3b82f6",
  password: "#818cf8",
  loading: "#38bdf8",
  error: "#f87171",
  success: "#34d399",
};

const SATELLITES = [
  // `color` reads on the dark backdrop, `light` on the light-blue one.
  { radius: 2.3, speed: 0.45, tilt: 0.35, size: 0.22, shape: "octa", color: "#e0e7ff", light: "#4f46e5" },
  { radius: 2.7, speed: -0.3, tilt: -0.5, size: 0.18, shape: "torus", color: "#f5d0fe", light: "#db2777" },
  { radius: 2.0, speed: 0.6, tilt: 1.1, size: 0.16, shape: "box", color: "#bae6fd", light: "#0284c7" },
  { radius: 3.0, speed: 0.22, tilt: -1.2, size: 0.2, shape: "tetra", color: "#ddd6fe", light: "#7c3aed" },
] as const;

function Satellite({ index, mood, reduced, dark }: { index: number; mood: AuthMood; reduced: boolean; dark: boolean }) {
  const s = SATELLITES[index];
  const ref = useRef<Mesh>(null);
  const angle = useRef(index * (Math.PI / 2));
  const orbit = useMemo(() => new Vector3(), []);
  // In "password" mood the satellites gather in front of the orb like a shield.
  const shield = useMemo(
    () => new Vector3((index - 1.5) * 0.55, (index % 2 ? 0.25 : -0.25), 1.9),
    [index]
  );

  useFrame((_, delta) => {
    if (!ref.current) return;
    const speedBoost = mood === "loading" ? 3.5 : mood === "success" ? 2 : 1;
    if (!reduced) angle.current += delta * s.speed * speedBoost;
    const a = angle.current;
    orbit.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius * Math.sin(s.tilt), Math.sin(a) * s.radius * Math.cos(s.tilt));
    const target = mood === "password" ? shield : orbit;
    ref.current.position.lerp(target, reduced ? 1 : 1 - Math.pow(0.002, delta));
    if (!reduced) {
      ref.current.rotation.x += delta * 0.8;
      ref.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <mesh ref={ref} scale={s.size}>
      {s.shape === "octa" && <octahedronGeometry args={[1, 0]} />}
      {s.shape === "torus" && <torusGeometry args={[1, 0.38, 16, 32]} />}
      {s.shape === "box" && <boxGeometry args={[1.3, 1.3, 1.3]} />}
      {s.shape === "tetra" && <tetrahedronGeometry args={[1.2, 0]} />}
      <meshStandardMaterial color={dark ? s.color : s.light} roughness={0.25} metalness={0.5} emissive={dark ? s.color : s.light} emissiveIntensity={0.15} />
    </mesh>
  );
}

function Core({ mood, pulse, pointer, anchor, dark, variant }: AuthSceneProps & { dark: boolean }) {
  const colors = variant === "admin" ? ADMIN_MOOD_COLOR : MOOD_COLOR;
  const slot = useRef<Group>(null);
  const rig = useRef<Group>(null);
  const orb = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);
  // MeshDistortMaterial's runtime object exposes `distort`/`speed`; its type in
  // this drei version is not exported, so keep the ref loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const material = useRef<any>(null);
  const reduced = usePrefersReducedMotion();
  const lastPulse = useRef(pulse);
  const ripple = useRef(0);
  const flash = useRef(0);
  const prevMood = useRef(mood);
  const targetColor = useMemo(() => new Color(), []);
  const viewport = useThree((s) => s.viewport);

  useFrame((state, delta) => {
    // Follow the DOM slot (screen px -> world units on the z=0 plane).
    const el = anchor.current;
    if (slot.current && el) {
      const r = el.getBoundingClientRect();
      const { width: W, height: H } = state.size;
      slot.current.position.set(
        ((r.left + r.width / 2) / W - 0.5) * viewport.width,
        -((r.top + r.height / 2) / H - 0.5) * viewport.height,
        0
      );
      // Orb + wireframe shell is ~3.8 units across; let it fill the slot height.
      slot.current.scale.setScalar(Math.max(0.15, ((r.height / H) * viewport.height) / 3.6));
    }

    // Keystroke ripple and error flash decay over time.
    if (pulse !== lastPulse.current) {
      lastPulse.current = pulse;
      ripple.current = 1;
    }
    if (mood !== prevMood.current) {
      if (mood === "error") flash.current = 1;
      prevMood.current = mood;
    }
    ripple.current = Math.max(0, ripple.current - delta * 2.5);
    flash.current = Math.max(0, flash.current - delta * 1.2);

    // Pointer parallax (lerped - ambient depth, not a cursor toy).
    if (rig.current && !reduced) {
      const p = pointer.current;
      rig.current.rotation.y = MathUtils.lerp(rig.current.rotation.y, p.x * 0.5, 0.06);
      rig.current.rotation.x = MathUtils.lerp(rig.current.rotation.x, -p.y * 0.3, 0.06);
      // Error shake.
      rig.current.position.x = flash.current > 0 ? Math.sin(state.clock.elapsedTime * 60) * 0.08 * flash.current : 0;
    }

    if (orb.current) {
      const base = mood === "success" ? 1.25 : mood === "password" ? 0.9 : 1;
      const s = base + ripple.current * 0.08;
      orb.current.scale.setScalar(MathUtils.lerp(orb.current.scale.x, s, 0.15));
      if (!reduced) orb.current.rotation.y += delta * (mood === "loading" ? 1.6 : 0.25);
    }
    if (shell.current && !reduced) {
      shell.current.rotation.y -= delta * (mood === "loading" ? 0.9 : 0.12);
      shell.current.rotation.z += delta * 0.05;
    }

    const m = material.current;
    if (m) {
      targetColor.set(colors[mood]);
      m.color.lerp(targetColor, 0.08);
      m.emissive.lerp(targetColor, 0.08);
      // A metallic orb on a light backdrop has little to reflect and reads
      // as dark navy; let it glow more so it stays a light, airy blue.
      m.emissiveIntensity = dark ? 0.12 : 0.55;
      m.metalness = dark ? 0.55 : 0.25;
      const distortTarget = (mood === "loading" ? 0.55 : mood === "email" ? 0.38 : 0.3) + ripple.current * 0.25;
      m.distort = MathUtils.lerp(m.distort, distortTarget, 0.12);
      m.speed = reduced ? 0 : mood === "loading" ? 4 : 1.6;
    }
  });

  return (
    <group ref={slot}>
    <group ref={rig}>
      <mesh ref={orb}>
        <icosahedronGeometry args={[1.15, 5]} />
        <MeshDistortMaterial
          ref={material}
          color={colors.idle}
          emissive={colors.idle}
          emissiveIntensity={0.12}
          distort={0.3}
          speed={1.6}
          roughness={0.08}
          metalness={0.55}
        />
      </mesh>
      <mesh ref={shell} scale={1.65}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={dark ? "#e0e7ff" : variant === "admin" ? "#6d28d9" : "#1d4ed8"} wireframe transparent opacity={dark ? 0.18 : 0.3} />
      </mesh>
      {SATELLITES.map((_, i) => (
        <Satellite key={i} index={i} mood={mood} reduced={reduced} dark={dark} />
      ))}
    </group>
    </group>
  );
}

/** Default export so the page can lazy-load three.js only when it renders. */
export default function AuthScene(props: AuthSceneProps) {
  const reduced = usePrefersReducedMotion();
  // Read outside the <Canvas> (a separate React renderer) and pass down.
  const dark = useTheme().theme === "dark";
  return (
    <Scene
      className="fixed inset-0"
      cameraPosition={[0, 0, 7]}
      fov={45}
      fallback={<div className="w-full h-full bg-gradient-to-br from-white/30 dark:from-white/10 to-transparent" />}
    >
      <directionalLight position={[2, 4, 5]} intensity={1.4} />
      <pointLight position={[-4, 2, 3]} intensity={2.5} color="#f0abfc" />
      <pointLight position={[4, -3, 2]} intensity={2} color="#7dd3fc" />
      <CseBackdrop variant={props.variant} mood={props.mood} dark={dark} reduced={reduced} pointer={props.pointer} />
      <Core {...props} dark={dark} />
      <Sparkles count={60} scale={[16, 9, 4]} size={2.2} speed={reduced ? 0 : 0.35} color={dark ? "#e0e7ff" : props.variant === "admin" ? "#7c3aed" : "#2563eb"} opacity={dark ? 0.7 : 0.55} />
    </Scene>
  );
}
