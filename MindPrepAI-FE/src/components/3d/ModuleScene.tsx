import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Group, type Mesh } from "three";
import { Scene } from "./Scene";
import { AIOrb } from "./AIOrb";
import { TextSprite } from "./CseBackdrop";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { useTheme } from "../../theme/themeContext";

/* 3D hero scenes for the three practice modules. Each is small (a handful of
 * meshes), lazy-loaded with the page, tilts toward the pointer while it is over
 * the canvas, and freezes for prefers-reduced-motion. */

export type ModuleKind = "aptitude" | "tech" | "interview";

interface Colors {
  primary: string;
  secondary: string;
  soft: string;
  text: string;
}
const LIGHT: Colors = { primary: "#4f46e5", secondary: "#0ea5e9", soft: "#c7d2fe", text: "#312e81" };
const DARK: Colors = { primary: "#818cf8", secondary: "#38bdf8", soft: "#3730a3", text: "#e0e7ff" };

function Tilt({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.y = MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.4, 0.05);
    ref.current.rotation.x = MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.25, 0.05);
  });
  return <group ref={ref}>{children}</group>;
}

/** Glyphs orbiting slowly around the centre. */
function Orbiters({ glyphs, color, radius, reduced }: { glyphs: string[]; color: string; radius: number; reduced: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!reduced && ref.current) ref.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={ref}>
      {glyphs.map((g, i) => {
        const a = (i / glyphs.length) * Math.PI * 2;
        return (
          <group key={g} position={[Math.cos(a) * radius, Math.sin(a * 2) * 0.45, Math.sin(a) * radius]}>
            <TextSprite text={g} color={color} height={0.34} opacity={0.9} />
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------ aptitude --- */

/** A 3D bar chart whose bars ripple - quant / data interpretation. */
function BarChart({ c, reduced }: { c: Colors; reduced: boolean }) {
  const bars = useRef<(Mesh | null)[]>([]);
  const base = useMemo(() => [0.9, 1.5, 1.1, 1.9, 1.3, 2.2], []);
  const spin = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (reduced) return;
    if (spin.current) spin.current.rotation.y += delta * 0.18;
    bars.current.forEach((m, i) => {
      if (!m) return;
      const h = base[i] * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.4 + i * 0.9));
      m.scale.y = h;
      m.position.y = -1 + h / 2;
    });
  });
  return (
    <group ref={spin}>
      <mesh position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 1.6]} />
        <meshStandardMaterial color={c.soft} transparent opacity={0.35} />
      </mesh>
      {base.map((h, i) => (
        <mesh key={i} ref={(m) => { bars.current[i] = m; }} position={[(i - 2.5) * 0.55, -1 + h / 2, 0]} scale={[1, h, 1]}>
          <boxGeometry args={[0.36, 1, 0.36]} />
          <meshStandardMaterial color={i % 2 ? c.secondary : c.primary} roughness={0.35} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- tech --- */

const LAYERS = ["frontend", "api", "database", "os"];

/** A stack of system layers with a packet travelling down through them. */
function LayerStack({ c, reduced }: { c: Colors; reduced: boolean }) {
  const spin = useRef<Group>(null);
  const packet = useRef<Mesh>(null);
  useFrame(({ clock }, delta) => {
    if (reduced) return;
    if (spin.current) spin.current.rotation.y += delta * 0.3;
    if (packet.current) {
      const t = (clock.elapsedTime * 0.45) % 1;
      packet.current.position.y = 1.2 - t * 2.4;
    }
  });
  return (
    <group rotation={[0.35, 0, 0]}>
      <group ref={spin}>
        {LAYERS.map((name, i) => (
          <group key={name} position={[0, 0.9 - i * 0.6, 0]}>
            <mesh>
              <boxGeometry args={[2.2, 0.08, 1.5]} />
              <meshStandardMaterial color={i % 2 ? c.secondary : c.primary} transparent opacity={0.55} roughness={0.3} />
            </mesh>
            <mesh>
              <boxGeometry args={[2.22, 0.1, 1.52]} />
              <meshBasicMaterial color={c.primary} wireframe transparent opacity={0.35} />
            </mesh>
          </group>
        ))}
        <mesh ref={packet} position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
      {LAYERS.map((name, i) => (
        <group key={name} position={[1.75, 0.9 - i * 0.6, 0]}>
          <TextSprite text={name} color={c.text} height={0.22} opacity={0.85} />
        </group>
      ))}
    </group>
  );
}

/* ----------------------------------------------------------- interview --- */

/** The AI interviewer: an orb with "speaking" rings pulsing outward. */
function SpeakingOrb({ c, reduced }: { c: Colors; reduced: boolean }) {
  const rings = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.5 + i / 3) % 1;
      m.scale.setScalar(1 + t * 1.1);
      const mat = m.material as { opacity: number };
      mat.opacity = 0.45 * (1 - t);
    });
  });
  return (
    <group>
      <AIOrb color={c.primary} wireColor={c.secondary} scale={0.9} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { rings.current[i] = m; }}>
          <torusGeometry args={[1.25, 0.018, 8, 64]} />
          <meshBasicMaterial color={c.secondary} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const GLYPHS: Record<ModuleKind, string[]> = {
  aptitude: ["∑", "π", "%", "x²", "√n", "∞"],
  tech: ["</>", "{ }", "=>", "SQL", "O(n)"],
  interview: ["STAR", "Q&A", "why?", "tell me", "✓"],
};

/** Default export so module pages can lazy-load three.js. */
export default function ModuleScene({ kind }: { kind: ModuleKind }) {
  const reduced = usePrefersReducedMotion();
  const c = useTheme().theme === "dark" ? DARK : LIGHT;
  return (
    <Scene className="w-full h-full" cameraPosition={[0, 0.2, 5.6]} fov={45} fallback={<div className="w-full h-full" />}>
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <Tilt reduced={reduced}>
        {kind === "aptitude" && <BarChart c={c} reduced={reduced} />}
        {kind === "tech" && <LayerStack c={c} reduced={reduced} />}
        {kind === "interview" && <SpeakingOrb c={c} reduced={reduced} />}
        <Orbiters glyphs={GLYPHS[kind]} color={c.text} radius={kind === "tech" ? 2.3 : kind === "interview" ? 1.8 : 2.1} reduced={reduced} />
      </Tilt>
    </Scene>
  );
}
