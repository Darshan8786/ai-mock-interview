import { useState, useRef, useCallback, useEffect } from "react";

interface WebcamStatus {
  camera: boolean;
  microphone: boolean;
  internet: boolean;
}

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>({
    camera: false,
    microphone: false,
    internet: true,
  });
  const [error, setError] = useState<string | null>(null);

  const checkInternet = useCallback(() => {
    setStatus((prev) => ({ ...prev, internet: navigator.onLine }));
  }, []);

  useEffect(() => {
    checkInternet();
    window.addEventListener("online", checkInternet);
    window.addEventListener("offline", checkInternet);
    return () => {
      window.removeEventListener("online", checkInternet);
      window.removeEventListener("offline", checkInternet);
    };
  }, [checkInternet]);

  const startWebcam = useCallback(async () => {
    try {
      console.log('🎥 Starting webcam...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      console.log('✅ Stream obtained');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.style.transform = 'scaleX(-1)';
        
        console.log('✅ Stream attached to video element');
        
        // Play immediately
        try {
          await videoRef.current.play();
          console.log('✅ Video playback started');
        } catch (playError) {
          console.warn('⚠️ Play failed (may auto-play):', playError);
        }
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      console.log('📹 Tracks - Video:', videoTrack?.enabled, 'Audio:', audioTrack?.enabled);

      setStatus({
        camera: videoTrack?.enabled ?? false,
        microphone: audioTrack?.enabled ?? false,
        internet: navigator.onLine,
      });

      setError(null);
      return stream;
    } catch (err: any) {
      console.error('❌ Webcam error:', err.name, err.message);
      const message =
        err.name === "NotAllowedError"
          ? "Camera and microphone permission denied"
          : err.name === "NotFoundError"
          ? "Camera or microphone not found"
          : `Webcam error: ${err.message}`;
      setError(message);

      setStatus((prev) => ({
        ...prev,
        camera: false,
        microphone: false,
      }));

      return null;
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus({ camera: false, microphone: false, internet: navigator.onLine });
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setStatus((prev) => ({ ...prev, camera: track.enabled }));
      }
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setStatus((prev) => ({ ...prev, microphone: track.enabled }));
      }
    }
  }, []);

  return {
    videoRef,
    streamRef,
    status,
    error,
    startWebcam,
    stopWebcam,
    captureFrame,
    toggleCamera,
    toggleMicrophone,
  };
}
