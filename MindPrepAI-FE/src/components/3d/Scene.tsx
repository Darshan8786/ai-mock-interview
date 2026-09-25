import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

interface SceneProps {
  children: ReactNode;
  className?: string;
  /** Rendered instead of the canvas when WebGL isn't available. Keep it a
   * plain, non-3D visual (e.g. a CSS gradient) so the page never looks broken. */
  fallback?: ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
  /** Lower = cheaper. Dashboard/decorative scenes should stay near the default. */
  dpr?: [number, number];
}

/**
 * Shared <Canvas> wrapper for every 3d/ component: WebGL-availability check
 * (renders `fallback` instead of a broken canvas on unsupported devices),
 * consistent low-power renderer settings, and standard three-point lighting
 * so individual scenes don't each reimplement it. Intended to be lazy-loaded
 * at the call site (`React.lazy`) since @react-three/fiber + three are a
 * meaningful bundle-size cost that pages without 3D content shouldn't pay.
 */
export function Scene({
  children,
  className = "",
  fallback = null,
  cameraPosition = [0, 0, 5],
  fov = 50,
  dpr = [1, 1.5],
}: SceneProps) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  if (webglOk === false) {
    return <div className={className}>{fallback}</div>;
  }
  // Unknown yet (first paint) - render an empty shell rather than flashing
  // the fallback, since most devices do support WebGL.
  if (webglOk === null) {
    return <div className={className} />;
  }

  return (
    <div className={className}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: cameraPosition, fov }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <pointLight position={[5, 5, 5]} intensity={0.8} color="#a78bfa" />
          <pointLight position={[-5, -5, 5]} intensity={0.5} color="#22d3ee" />
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
