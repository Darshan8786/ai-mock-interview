export interface ProctorFrameResult {
  faceDetected: boolean;
  multipleFaces: boolean;
  faceTooFar: boolean;
  faceTooClose: boolean;
  facePartial: boolean;
  headDirection: "Center" | "Left" | "Right" | "Up" | "Down";
  headYaw: number;
  headPitch: number;
  headRoll: number;
  eyeDirection: "Center" | "Left" | "Right";
  eyesClosed: boolean;
  lookingAway: boolean;
  persons: number;
  multiplePersons: boolean;
  phoneDetected: boolean;
  phoneConfidence: number;
  warnings: string[];
  cheatingCount: number;
  identityVerified?: boolean;
  similarity?: number;
}

export interface ProctorStatus {
  face: "ok" | "warning" | "violation";
  headPose: "ok" | "warning" | "violation";
  eyeGaze: "ok" | "warning" | "violation";
  phone: "ok" | "violation";
  identity: "ok" | "violation" | "pending";
  camera: "ok" | "violation";
  microphone: "ok" | "violation";
  internet: "ok" | "violation";
}

export interface ProctorEvent {
  type: string;
  timestamp: number;
  description: string;
  severity: "info" | "warning" | "violation";
}
