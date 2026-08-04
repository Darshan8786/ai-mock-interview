import { motion } from "framer-motion";
import type { ProctorStatus } from "../../types/proctor";

interface InterviewMonitorProps {
  status: ProctorStatus;
  result?: {
    headDirection: string;
    headYaw: number;
    headPitch: number;
    headRoll: number;
    eyeDirection: string;
    persons: number;
    phoneConfidence: number;
    similarity?: number;
  } | null;
}

export function InterviewMonitor({ status, result }: InterviewMonitorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-3"
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Live Proctoring
      </h3>

      <div className="space-y-2">
        <MonitorRow label="Face" status={status.face} />
        <MonitorRow label="Head Pose" status={status.headPose} />
        <MonitorRow label="Eye Gaze" status={status.eyeGaze} />
        <MonitorRow label="Phone" status={status.phone} />
        <MonitorRow label="Identity" status={status.identity} />
        <MonitorRow label="Camera" status={status.camera} />
        <MonitorRow label="Microphone" status={status.microphone} />
        <MonitorRow label="Internet" status={status.internet} />
      </div>

      {result && (
        <div className="pt-2 border-t border-gray-700/50 space-y-1">
          <DetailRow label="Head" value={result.headDirection} />
          <DetailRow label="Eyes" value={result.eyeDirection} />
          {result.persons > 0 && <DetailRow label="Persons" value={`${result.persons}`} />}
          {result.phoneConfidence > 0 && (
            <DetailRow label="Phone" value={`${(result.phoneConfidence * 100).toFixed(0)}%`} />
          )}
          {result.similarity !== undefined && (
            <DetailRow label="Match" value={`${(result.similarity * 100).toFixed(0)}%`} />
          )}
        </div>
      )}
    </motion.div>
  );
}

function MonitorRow({ label, status }: { label: string; status: string }) {
  const icons: Record<string, string> = {
    ok: "✓",
    warning: "!",
    violation: "✗",
    pending: "⋯",
  };
  const colors: Record<string, string> = {
    ok: "text-emerald-400",
    warning: "text-yellow-400",
    violation: "text-red-400",
    pending: "text-gray-500",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-bold ${colors[status] || "text-gray-500"}`}>
        {icons[status] || "?"}
      </span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-[10px] font-mono text-gray-300">{value}</span>
    </div>
  );
}
