import mongoose from "mongoose";

const cheatingEventSchema = new mongoose.Schema({
  interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [
      "tab_switch",
      "window_minimized",
      "fullscreen_exit",
      "copy",
      "paste",
      "right_click",
      "devtools_open",
      "face_not_visible",
      "multiple_faces",
      "looking_left",
      "looking_right",
      "looking_down",
      "looking_away",
      "person_left",
      "camera_disabled",
      "microphone_disabled",
    ],
    required: true,
  },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

cheatingEventSchema.index({ interview: 1, timestamp: -1 });
cheatingEventSchema.index({ user: 1 });

export const CheatingEvent = mongoose.model("CheatingEvent", cheatingEventSchema);
