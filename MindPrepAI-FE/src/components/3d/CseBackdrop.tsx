import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MathUtils,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Sprite,
} from "three";
import type { AuthMood } from "./AuthScene";

/* Computer-science themed background for the auth pages: a binary tree running
 * BFS, a network graph with packets in flight, floating code tokens and
 * drifting binary. Everything sits around the edges of the viewport so the
 * centred orb and form stay clear, and reacts to the form's mood. */

interface Palette {
  text: string;
  node: string;
  highlight: string;
  edge: string;
  edgeOpacity: number;
  graphNode: string;
  packet: string;
  binary: string;
}

const LIGHT: Palette = {
  text: "#1e3a8a",
  node: "#93c5fd",
  highlight: "#2563eb",
  edge: "#3b82f6",
  edgeOpacity: 0.45,
  graphNode: "#6366f1",
  packet: "#0ea5e9",
  binary: "#1d4ed8",
};
const DARK: Palette = {
  text: "#dbeafe",
  node: "#475569",
  highlight: "#7dd3fc",
  edge: "#94a3b8",
  edgeOpacity: 0.35,
  graphNode: "#a5b4fc",
  packet: "#fde68a",
  binary: "#bfdbfe",
};
/** Admin sign-in uses the same scene in violet. */
const LIGHT_ADMIN: Palette = {
  text: "#4c1d95",
  node: "#c4b5fd",
  highlight: "#7c3aed",
  edge: "#8b5cf6",
  edgeOpacity: 0.45,
  graphNode: "#c026d3",
  packet: "#f59e0b",
  binary: "#6d28d9",
};
const DARK_ADMIN: Palette = {
  text: "#ede9fe",
  node: "#4c4566",
  highlight: "#f0abfc",
  edge: "#a78bfa",
  edgeOpacity: 0.35,
  graphNode: "#c4b5fd",
  packet: "#fde68a",
  binary: "#ddd6fe",
};

export type AuthVariant = "student" | "admin";

const ERROR = "#ef4444";
const CAMERA_Z = 7; // matches AuthScene's camera
const SUCCESS = "#22c55e";

const CODE_TOKENS = ["</>", "{ }", "O(log n)", "git push", "#include", "SELECT *", "=>", "0x1F", "λx.x", "i++", "[ ]", "&&", "null", "def()"];
// Placement-cell analytics flavour for the admin sign-in.
const ADMIN_TOKENS = ["SELECT *", "GROUP BY", "COUNT(*)", "avg(cgpa)", "JOIN", "offers++", "ORDER BY", "WHERE", "</>", "200 OK", "cron()", "INSERT", "{ }", "HAVING"];
// Swapped in while the password field is focused.
const CRYPTO_TOKENS = ["SHA-256", "AES-128", "****", "0x9f3a", "RSA", "hash()", "salt", "bcrypt", "TLS 1.3", "****", "0xE7", "nonce", "HMAC", "****"];

/** Seeded RNG so the layout is stable between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Text rendered to a canvas texture: no font download, uses the system monospace. */
function useTextTexture(text: string, color: string) {
  const tex = useMemo(() => {
    const px = 64;
    const font = `600 ${px}px ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w;
    canvas.height = Math.ceil(px * 1.35);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 12, canvas.height / 2);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return { texture: t, aspect: canvas.width / canvas.height };
  }, [text, color]);
  useEffect(() => () => tex.texture.dispose(), [tex]);
  return tex;
}

export function TextSprite({ text, color, height, opacity }: { text: string; color: string; height: number; opacity: number }) {
  const { texture, aspect } = useTextTexture(text, color);
  return (
    <sprite scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </sprite>
  );
}

/* ---------------------------------------------------------------- tree --- */

const TREE_DEPTH = 4; // 15 nodes
const STRUCTURE_Z = -0.6;
const TREE_K = CAMERA_Z / (CAMERA_Z - STRUCTURE_Z);

function treeLayout() {
  const nodes: Vector3[] = [];
  const edges: [number, number][] = [];
  for (let level = 0; level < TREE_DEPTH; level++) {
    const count = 2 ** level;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * 2.6;
      const y = 1 - level * 0.7;
      const z = Math.sin((i + level) * 1.7) * 0.25;
      nodes.push(new Vector3(x, y, z));
      const index = nodes.length - 1;
      if (index > 0) edges.push([Math.floor((index - 1) / 2), index]);
    }
  }
  return { nodes, edges };
}

function edgeGeometry(nodes: Vector3[], edges: [number, number][]) {
  const g = new BufferGeometry();
  const pos: number[] = [];
  for (const [a, b] of edges) pos.push(nodes[a].x, nodes[a].y, nodes[a].z, nodes[b].x, nodes[b].y, nodes[b].z);
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

function BinaryTree({ palette, mood, reduced }: { palette: Palette; mood: AuthMood; reduced: boolean }) {
  const { nodes, edges } = useMemo(treeLayout, []);
  const geometry = useMemo(() => edgeGeometry(nodes, edges), [nodes, edges]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const group = useRef<Group>(null);
  const meshes = useRef<(Mesh | null)[]>([]);
  const step = useRef(0);
  const c = useMemo(() => ({ base: new Color(), hi: new Color(), target: new Color() }), []);

  useFrame((_, delta) => {
    if (group.current && !reduced) group.current.rotation.y += delta * 0.18;
    // BFS order == array order for a heap-shaped tree. Visit one node per
    // tick, hold the fully-visited tree briefly, then start over.
    const speed = mood === "loading" ? 9 : 2.2;
    if (!reduced) step.current = (step.current + delta * speed) % (nodes.length + 5);
    c.base.set(palette.node);
    c.hi.set(palette.highlight);
    meshes.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as MeshStandardMaterial;
      if (mood === "error") c.target.set(ERROR);
      else if (mood === "success") c.target.set(SUCCESS);
      else c.target.copy(!reduced && i <= step.current ? c.hi : c.base);
      mat.color.lerp(c.target, 0.15);
      mat.emissive.copy(mat.color);
      const s = !reduced && Math.floor(step.current) === i ? 1.35 : 1;
      m.scale.setScalar(MathUtils.lerp(m.scale.x, s, 0.2));
    });
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={palette.edge} transparent opacity={palette.edgeOpacity} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p} ref={(m) => { meshes.current[i] = m; }}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={palette.node} emissive={palette.node} emissiveIntensity={0.35} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- graph --- */

function graphLayout() {
  const n = 11;
  const nodes: Vector3[] = [];
  // Fibonacci sphere - evenly spread points.
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    nodes.push(new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(1.25));
  }
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  nodes.forEach((p, i) => {
    nodes
      .map((q, j) => ({ j, d: p.distanceTo(q) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        if (!seen.has(key(i, j))) {
          seen.add(key(i, j));
          edges.push([i, j]);
        }
      });
  });
  const adjacency = nodes.map((_, i) => edges.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])));
  return { nodes, edges, adjacency };
}

function NetworkGraph({ palette, mood, reduced }: { palette: Palette; mood: AuthMood; reduced: boolean }) {
  const { nodes, edges, adjacency } = useMemo(graphLayout, []);
  const geometry = useMemo(() => edgeGeometry(nodes, edges), [nodes, edges]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const group = useRef<Group>(null);
  const packetRefs = useRef<(Mesh | null)[]>([]);
  const rand = useMemo(() => mulberry32(7), []);
  // Each packet travels from -> to along an edge, then hops to a neighbour.
  const packets = useMemo(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const from = (k * 2) % nodes.length;
        return { from, to: adjacency[from][0], t: k / 6 };
      }),
    [nodes.length, adjacency]
  );
  const nodeMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const target = useMemo(() => new Color(), []);

  useFrame((_, delta) => {
    if (group.current && !reduced) {
      group.current.rotation.y -= delta * 0.22;
      group.current.rotation.x = Math.sin(performance.now() / 4000) * 0.25;
    }
    const speed = mood === "loading" ? 2.4 : 0.7;
    packets.forEach((pk, k) => {
      if (!reduced) pk.t += delta * speed;
      if (pk.t >= 1) {
        pk.t = 0;
        pk.from = pk.to;
        const next = adjacency[pk.from];
        pk.to = next[Math.floor(rand() * next.length)];
      }
      packetRefs.current[k]?.position.lerpVectors(nodes[pk.from], nodes[pk.to], pk.t);
    });
    target.set(mood === "error" ? ERROR : mood === "success" ? SUCCESS : palette.graphNode);
    nodeMats.current.forEach((m) => {
      if (!m) return;
      m.color.lerp(target, 0.12);
      m.emissive.copy(m.color);
    });
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={palette.edge} transparent opacity={palette.edgeOpacity} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <icosahedronGeometry args={[0.1, 1]} />
          <meshStandardMaterial
            ref={(m) => { nodeMats.current[i] = m; }}
            color={palette.graphNode}
            emissive={palette.graphNode}
            emissiveIntensity={0.3}
            roughness={0.35}
            flatShading
          />
        </mesh>
      ))}
      {packets.map((_, k) => (
        <mesh key={k} ref={(m) => { packetRefs.current[k] = m; }}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshBasicMaterial color={palette.packet} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------- code tokens --- */

function CodeTokens({
  tokens,
  palette,
  mood,
  reduced,
  width,
  height,
  avoid,
}: {
  tokens: string[];
  palette: Palette;
  mood: AuthMood;
  reduced: boolean;
  width: number;
  height: number;
  /** Rectangles (in world units, centre + half-size) tokens must not land in. */
  avoid: { x: number; y: number; hw: number; hh: number }[];
}) {
  const spots = useMemo(() => {
    const rnd = mulberry32(42);
    const out: { pos: Vector3; screen: { x: number; y: number }; phase: number; size: number }[] = [];
    let guard = 0;
    while (out.length < tokens.length && guard++ < 2000) {
      const z = -0.5 - rnd() * 2;
      // Perspective pulls farther tokens toward the centre of the screen, so
      // test where the token actually appears (projected onto z = 0).
      const k = CAMERA_Z / (CAMERA_Z - z);
      const x = ((rnd() - 0.5) * width * 0.84) / k;
      const y = ((rnd() - 0.5) * height * 0.78) / k;
      const px = x * k;
      const py = y * k;
      if (avoid.some((r) => Math.abs(px - r.x) < r.hw && Math.abs(py - r.y) < r.hh)) continue;
      if (out.some((o) => Math.hypot(o.screen.x - px, o.screen.y - py) < Math.min(width, height) * 0.16)) continue;
      out.push({ pos: new Vector3(x, y, z), screen: { x: px, y: py }, phase: rnd() * Math.PI * 2, size: 0.22 + rnd() * 0.14 });
    }
    return out;
  }, [width, height, avoid, tokens.length]);
  const refs = useRef<(Group | null)[]>([]);
  const secure = mood === "password";

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    spots.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(s.pos.x + Math.sin(t * 0.3 + s.phase) * 0.12, s.pos.y + Math.sin(t * 0.6 + s.phase) * 0.15, s.pos.z);
    });
  });

  return (
    <>
      {spots.map((s, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }} position={s.pos}>
          <TextSprite
            text={secure ? CRYPTO_TOKENS[i % CRYPTO_TOKENS.length] : tokens[i]}
            color={palette.text}
            height={s.size}
            opacity={0.55 + (s.pos.z + 2.5) * 0.12}
          />
        </group>
      ))}
    </>
  );
}

/* --------------------------------------------------------- binary drift --- */

function BinaryDrift({ palette, reduced, width, height }: { palette: Palette; reduced: boolean; width: number; height: number }) {
  const zero = useTextTexture("0", palette.binary);
  const one = useTextTexture("1", palette.binary);
  const Z = -4;
  // Visible area grows with distance from the camera (at z=7).
  const spread = (7 - Z) / 7;
  const bits = useMemo(() => {
    const rnd = mulberry32(99);
    return Array.from({ length: 46 }, () => ({
      x: (rnd() - 0.5) * width * spread,
      y: (rnd() - 0.5) * height * spread,
      speed: 0.12 + rnd() * 0.25,
      one: rnd() > 0.5,
    }));
  }, [width, height, spread]);
  const refs = useRef<(Sprite | null)[]>([]);

  useFrame((_, delta) => {
    if (reduced) return;
    const top = (height * spread) / 2 + 0.3;
    bits.forEach((b, i) => {
      b.y += b.speed * delta;
      if (b.y > top) b.y = -top;
      refs.current[i]?.position.set(b.x, b.y, Z);
    });
  });

  return (
    <>
      {bits.map((b, i) => (
        <sprite key={i} ref={(s) => { refs.current[i] = s; }} position={[b.x, b.y, Z]} scale={[0.32 * zero.aspect, 0.32, 1]}>
          <spriteMaterial map={b.one ? one.texture : zero.texture} transparent opacity={0.22} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- root --- */

export function CseBackdrop({
  variant = "student",
  mood,
  dark,
  reduced,
  pointer,
}: {
  variant?: AuthVariant;
  mood: AuthMood;
  dark: boolean;
  reduced: boolean;
  pointer: MutableRefObject<{ x: number; y: number }>;
}) {
  const admin = variant === "admin";
  const palette = admin ? (dark ? DARK_ADMIN : LIGHT_ADMIN) : dark ? DARK : LIGHT;
  const tokens = admin ? ADMIN_TOKENS : CODE_TOKENS;
  const viewport = useThree((s) => s.viewport);
  const { width, height } = viewport;
  // Phones / narrow windows: the form fills the width, so skip the big
  // structures and keep only the light, decorative layers.
  const roomy = viewport.aspect > 1.15;
  const s = Math.min(height / 5.8, (width * 0.24) / 2.8);
  const treeX = -width * 0.33;
  const graphX = width * 0.33;
  const near = useRef<Group>(null);
  const far = useRef<Group>(null);

  // Keep tokens out of the centre column (orb + form) and off the structures.
  const avoid = useMemo(
    () => [
      // Orb + card column, with a margin for the token's own width.
      { x: 0, y: 0, hw: Math.max(width * 0.17, 2.1) + 0.6, hh: height * 0.5 },
      // Tree / graph including their labels underneath (projected from z = -0.6).
      ...(roomy
        ? [
            { x: treeX * TREE_K, y: -0.4 * s * TREE_K, hw: 1.9 * s, hh: 1.9 * s },
            { x: graphX * TREE_K, y: -0.35 * s * TREE_K, hw: 1.9 * s, hh: 2.1 * s },
          ]
        : []),
    ],
    [width, height, roomy, treeX, graphX, s]
  );

  useFrame(() => {
    if (reduced) return;
    const p = pointer.current;
    // Two depth layers moving at different rates = parallax.
    if (near.current) {
      near.current.rotation.y = MathUtils.lerp(near.current.rotation.y, p.x * 0.12, 0.05);
      near.current.rotation.x = MathUtils.lerp(near.current.rotation.x, -p.y * 0.08, 0.05);
    }
    if (far.current) {
      far.current.position.x = MathUtils.lerp(far.current.position.x, -p.x * 0.35, 0.04);
      far.current.position.y = MathUtils.lerp(far.current.position.y, -p.y * 0.2, 0.04);
    }
  });

  return (
    <>
      <group ref={far}>
        <BinaryDrift palette={palette} reduced={reduced} width={width} height={height} />
      </group>
      <group ref={near}>
        <CodeTokens tokens={tokens} palette={palette} mood={mood} reduced={reduced} width={width} height={height} avoid={avoid} />
        {roomy && (
          <>
            <group position={[treeX, -0.1 * s, STRUCTURE_Z]} scale={s}>
              <BinaryTree palette={palette} mood={mood} reduced={reduced} />
              <group position={[0, -1.55, 0]}>
                <TextSprite text={admin ? "index.btree()" : "bfs(root)"} color={palette.text} height={0.24} opacity={0.75} />
              </group>
            </group>
            <group position={[graphX, 0, STRUCTURE_Z]} scale={s}>
              <NetworkGraph palette={palette} mood={mood} reduced={reduced} />
              <group position={[0, -1.75, 0]}>
                <TextSprite text={admin ? "drives.sync()" : "graph.route()"} color={palette.text} height={0.24} opacity={0.75} />
              </group>
            </group>
          </>
        )}
      </group>
    </>
  );
}

/** Just the binary tree and network graph, side by side - for the compact 3D
 * panel on the student dashboard. */
export function CseStructures({ variant = "student", dark, reduced }: { variant?: AuthVariant; dark: boolean; reduced: boolean }) {
  const admin = variant === "admin";
  const palette = admin ? (dark ? DARK_ADMIN : LIGHT_ADMIN) : dark ? DARK : LIGHT;
  return (
    <>
      <group position={[-1.75, 0.15, 0]} scale={0.95}>
        <BinaryTree palette={palette} mood="idle" reduced={reduced} />
        <group position={[0, -1.5, 0]}>
          <TextSprite text="bfs(root)" color={palette.text} height={0.24} opacity={0.8} />
        </group>
      </group>
      <group position={[1.85, 0.1, 0]} scale={0.95}>
        <NetworkGraph palette={palette} mood="idle" reduced={reduced} />
        <group position={[0, -1.7, 0]}>
          <TextSprite text="graph.route()" color={palette.text} height={0.24} opacity={0.8} />
        </group>
      </group>
    </>
  );
}
