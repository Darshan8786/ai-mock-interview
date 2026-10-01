import { lazy, Suspense, useEffect, useState } from "react";

// three.js only downloads when the ambient layer actually renders.
const AmbientScene = lazy(() => import("../3d/AmbientScene"));

/** Site-wide ambient 3D layer, rendered only where it is worth the GPU:
 * not on focus pages (`off`), and not on small screens where content fills
 * the width anyway. */
export function Ambient3D({ variant = "student", off = false }: { variant?: "student" | "admin"; off?: boolean }) {
  const [wide, setWide] = useState(() => window.matchMedia?.("(min-width: 768px)").matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 768px)");
    if (!mq) return;
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (off || !wide) return null;
  return (
    <Suspense fallback={null}>
      <AmbientScene variant={variant} />
    </Suspense>
  );
}
