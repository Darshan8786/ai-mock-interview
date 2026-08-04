import type { RefObject, MutableRefObject } from "react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WebcamPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  cameraOn: boolean;
  microphoneOn: boolean;
  internetOn: boolean;
  cheatingCount: number;
}

export function WebcamPreview({
  videoRef,
  streamRef,
  cameraOn,
  microphoneOn,
  internetOn,
  cheatingCount,
}: WebcamPreviewProps) {
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError] = useState<string | null>(null);

  // Re-attach stream whenever this component mounts or the stream changes.
  // This handles the case where the <video> element is remounted (e.g. when
  // transitioning from the setup screen to the interview room).
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.muted = true;
      video.play().catch(() => {});
    }
  }, [videoRef, streamRef]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-900 shadow-2xl w-full"
      style={{
        minHeight: '320px',
        aspectRatio: '16 / 9',
        maxHeight: '500px',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onCanPlay={() => setVideoLoading(false)}
        className="w-full h-full object-cover bg-black"
        style={{ transform: 'scaleX(-1)' }}
      />

      {videoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10 rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-emerald-400 border-t-transparent mx-auto mb-3"></div>
            <p className="text-gray-300 text-sm font-medium">Loading camera...</p>
          </div>
        </div>
      )}

      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10 rounded-xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-300 text-sm font-medium">{videoError}</p>
            <p className="text-gray-400 text-xs mt-2">Check camera permissions</p>
          </div>
        </div>
      )}

      {!cameraOn && !videoError && !videoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10 rounded-xl">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">Camera Disabled</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20">
        <div className="flex gap-2">
          <StatusDot label="CAM" active={cameraOn} color="green" />
          <StatusDot label="MIC" active={microphoneOn} color="blue" />
          <StatusDot label="NET" active={internetOn} color="yellow" />
        </div>
        {cheatingCount > 0 && (
          <div className="bg-red-500/80 text-white px-3 py-1 rounded-full text-xs font-bold">
            ⚠ {cheatingCount}/3
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StatusDot({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: active ? "bg-green-500" : "bg-gray-600",
    blue: active ? "bg-blue-500" : "bg-gray-600",
    yellow: active ? "bg-yellow-500" : "bg-gray-600",
  };

  return (
    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
      <div className={`w-2 h-2 rounded-full ${colors[color]} ${active ? "animate-pulse" : ""}`} />
      <span className="text-[10px] font-mono text-gray-300">{label}</span>
    </div>
  );
}
