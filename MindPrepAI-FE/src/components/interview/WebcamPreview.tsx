import { type RefObject, type MutableRefObject, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface WebcamPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  cameraOn: boolean;
  microphoneOn: boolean;
  internetOn: boolean;
}

export function WebcamPreview({
  videoRef,
  streamRef,
  cameraOn,
  microphoneOn,
  internetOn,
}: WebcamPreviewProps) {
  const [videoLoading, setVideoLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;

    const attachStream = async () => {
      if (!video || !stream) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.muted = true;
        try {
          await video.play();
        } catch (e) {
          console.warn('Video play failed:', e);
        }
      } else {
        if (video.paused) {
          video.play().catch(e => console.warn('Video play failed:', e));
        }
      }
      // If the video is already in a playable/playing state (e.g. after the
      // setup→interview transition where the stream is already active),
      // the browser won't fire onCanPlay again — clear the loading spinner now.
      if (video.readyState >= 2) {
        setVideoLoading(false);
      }
    };

    attachStream();

    // Safety net: if the media events never fire (e.g. the <video> was briefly
    // hidden when the stream attached), don't leave the spinner up forever once
    // the stream is actually live.
    const t = window.setTimeout(() => {
      if (streamRef.current?.getVideoTracks()[0]?.readyState === "live") {
        setVideoLoading(false);
      }
    }, 3000);
    return () => window.clearTimeout(t);
  }, [videoRef, streamRef, cameraOn]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-gray-900 shadow-2xl w-full transition-colors duration-500"
      style={{ minHeight: "320px", aspectRatio: "16 / 9", maxHeight: "500px" }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onCanPlay={() => setVideoLoading(false)}
        onLoadedMetadata={() => setVideoLoading(false)}
        onPlaying={() => setVideoLoading(false)}
        className="w-full h-full object-cover bg-black"
        style={{ transform: "scaleX(-1)" }}
      />

      {videoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10 rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-emerald-400 border-t-transparent mx-auto mb-3" />
            <p className="text-gray-300 text-sm font-medium">Loading camera...</p>
          </div>
        </div>
      )}

      {!cameraOn && !videoLoading && (
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

      {/* Status dots - CAM / MIC / NET */}
      <div className="absolute bottom-3 left-3 flex gap-2 z-20">
        <StatusDot label="CAM" active={cameraOn} color="green" />
        <StatusDot label="MIC" active={microphoneOn} color="blue" />
        <StatusDot label="NET" active={internetOn} color="yellow" />
      </div>
    </motion.div>
  );
}

function StatusDot({ label, active, color }: { label: string; active: boolean; color: string }) {
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
