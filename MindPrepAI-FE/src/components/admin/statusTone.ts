import type { BadgeTone } from "./Badge";

// Helper to pick a badge tone from a status string
export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("open") || s.includes("completed") || s.includes("published") || s.includes("ready") || s.includes("hired") || s.includes("analyzed") || s.includes("shortlist")) {
    return "green";
  }
  if (s.includes("blocked") || s.includes("terminated") || s.includes("failed") || s.includes("closed") || s.includes("rejected") || s.includes("urgent") || s.includes("high")) {
    return "red";
  }
  if (s.includes("pending") || s.includes("draft") || s.includes("in-progress") || s.includes("parsing") || s.includes("scheduled") || s.includes("important") || s.includes("medium")) {
    return "yellow";
  }
  if (s.includes("archived") || s.includes("inactive") || s.includes("applied")) {
    return "gray";
  }
  return "blue";
}
