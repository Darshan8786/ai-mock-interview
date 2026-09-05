interface InterviewMonitorProps {
  status: "idle" | "connecting" | "active" | "error" | "terminated";
  stalled?: boolean;
  result: any;
}

interface PlaceholderState {
  label: string;
  dotClass: string;
  pingClass: string;
}

function placeholderFor(
  status: InterviewMonitorProps["status"],
  stalled: boolean
): PlaceholderState {
  if (status === "connecting") {
    return {
      label: "Connecting to proctoring…",
      dotClass: "bg-yellow-500",
      pingClass: "bg-yellow-400",
    };
  }
  if (status === "active" && stalled) {
    return {
      label: "Proctoring reconnecting…",
      dotClass: "bg-amber-500",
      pingClass: "bg-amber-400",
    };
  }
  if (status === "active") {
    // Socket is up, first analysis result not in yet.
    return {
      label: "Starting analysis…",
      dotClass: "bg-emerald-500",
      pingClass: "bg-emerald-400",
    };
  }
  if (status === "error") {
    return {
      label: "Proctoring unavailable — retrying…",
      dotClass: "bg-red-500",
      pingClass: "bg-red-400",
    };
  }
  if (status === "terminated") {
    return { label: "Proctoring ended", dotClass: "bg-gray-500", pingClass: "bg-gray-400" };
  }
  return { label: "Proctoring idle", dotClass: "bg-gray-500", pingClass: "bg-gray-400" };
}

export function InterviewMonitor({ status, stalled = false, result }: InterviewMonitorProps) {
  const showLive = status === "active" && !stalled && !!result;

  if (!showLive) {
    const ph = placeholderFor(status, stalled);
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          AI Proctoring
        </h4>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ph.pingClass}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ph.dotClass}`}
            ></span>
          </span>
          {ph.label}
        </div>
      </div>
    );
  }

  const faceStatus: string = result?.faceStatus ?? "unknown";
  const lookingDirection: string = result?.lookingDirection ?? "unknown";
  const lookingAway: boolean = !!result?.lookingAway;
  const degraded: boolean = !!result?.analysisDegraded;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 space-y-3">
      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex justify-between">
        <span>AI Proctoring</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {degraded ? "Limited" : "Live"}
        </span>
      </h4>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Face Status</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              faceStatus === "normal"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {faceStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Looking Direction</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              !lookingAway
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            {lookingDirection.toUpperCase()}
          </span>
        </div>

        {(result?.mobilePhone || result?.headset) && (
          <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
            <span className="text-gray-400">Objects Detected</span>
            <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-xs font-medium flex gap-1">
              {result?.mobilePhone && <span>📱 Phone</span>}
              {result?.headset && <span>🎧 Headset</span>}
            </span>
          </div>
        )}

        {result?.cameraObstructed && (
          <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
            <span className="text-gray-400">Camera</span>
            <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-xs font-medium">
              🚫 Obstructed
            </span>
          </div>
        )}

        {degraded && (
          <p className="text-[11px] text-amber-400/80 border-t border-gray-700 pt-2 mt-2">
            Some analysis passes are degraded — monitoring is still active.
          </p>
        )}
      </div>
    </div>
  );
}
