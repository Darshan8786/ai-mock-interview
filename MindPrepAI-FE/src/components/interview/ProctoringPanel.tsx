import { type RefObject, type MutableRefObject } from "react";
import { WebcamPreview } from "./WebcamPreview";
import { InterviewMonitor } from "./InterviewMonitor";
import { CheatingCounter } from "./CheatingCounter";
import type { ProctoringResult } from "../../hooks/useProctoring";

interface ProctoringPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  cameraOn: boolean;
  microphoneOn: boolean;
  internetOn: boolean;
  proctorStatus: "idle" | "connecting" | "active" | "error" | "terminated";
  proctorStalled: boolean;
  proctorResult: ProctoringResult | null;
  cheatingCount: number;
}

/**
 * The proctoring system, rendered as a sibling of the question system.
 *
 * This component and everything it renders are driven ONLY by the webcam stream
 * and the proctoring WebSocket. It receives no question / AI / loading / error
 * props and cannot be unmounted by question-generation state. If AI question
 * generation is slow or fails, this panel keeps monitoring unaffected.
 */
export function ProctoringPanel({
  videoRef,
  streamRef,
  cameraOn,
  microphoneOn,
  internetOn,
  proctorStatus,
  proctorStalled,
  proctorResult,
  cheatingCount,
}: ProctoringPanelProps) {
  return (
    <div className="space-y-3">
      <WebcamPreview
        videoRef={videoRef}
        streamRef={streamRef}
        cameraOn={cameraOn}
        microphoneOn={microphoneOn}
        internetOn={internetOn}
      />
      <InterviewMonitor
        status={proctorStatus}
        stalled={proctorStalled}
        result={proctorResult}
      />
      <CheatingCounter count={cheatingCount} maxCount={3} />
    </div>
  );
}
