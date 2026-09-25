import { Scene } from "./Scene";
import { ProgressRing3D } from "./ProgressRing3D";

interface AtsScoreSceneProps {
  score: number;
  color?: string;
}

/** Small ATS-score ring for the resume analyzer's stat row. Default export
 * so it can be React.lazy-loaded - the resume analyzer page shouldn't pay
 * the three.js bundle cost until a score actually exists to visualize. */
export default function AtsScoreScene({ score, color = "#a78bfa" }: AtsScoreSceneProps) {
  return (
    <Scene
      className="w-full h-full"
      cameraPosition={[0, 0, 4]}
      fallback={
        <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color }}>
          {score}%
        </div>
      }
    >
      <ProgressRing3D progress={score} color={color} radius={1.1} thickness={0.16} />
    </Scene>
  );
}
