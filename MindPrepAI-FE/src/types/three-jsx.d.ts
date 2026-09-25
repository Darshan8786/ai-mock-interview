// @react-three/fiber v8 augments the legacy global `JSX.IntrinsicElements`
// namespace with its <mesh>/<group>/... intrinsics. This project's installed
// @types/react (v19) moved JSX types to the `React.JSX` namespace instead, so
// TypeScript (with "jsx": "react-jsx") never sees r3f's augmentation and every
// three.js intrinsic element ("mesh", "group", "ambientLight", ...) fails to
// typecheck. Re-declaring the same ThreeElements under React.JSX is the fix -
// not a type-check suppression, since it's the exact same interface r3f
// already exports, just merged into the namespace TS actually consults.
import type { ThreeElements } from "@react-three/fiber";

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

export {};
