import { useState, useEffect, useCallback, useRef } from "react";
import { BACKEND_URL } from "../config/config";

interface CheatingEvent {
  type: string;
  description: string;
  timestamp: Date;
}

interface CheatingState {
  count: number;
  events: CheatingEvent[];
  terminated: boolean;
}

export function useCheatingDetection(
  interviewId: string | null,
  maxViolations: number = 3
) {
  const [state, setState] = useState<CheatingState>({
    count: 0,
    events: [],
    terminated: false,
  });
  const [popup, setPopup] = useState<CheatingEvent | null>(null);

  const prevFullscreenRef = useRef<boolean>(!!document.fullscreenElement);
  const devToolsOpenRef = useRef<boolean>(false);
  const lastWarningTime = useRef<number>(0);
  const tabSwitchCount = useRef<number>(0);

  const reportCheating = useCallback(
    async (type: string, description: string, metadata?: any) => {
      const now = Date.now();
      if (now - lastWarningTime.current < 1000) return;

      lastWarningTime.current = now;

      const isTabSwitch = type === "tab_switch";
      if (isTabSwitch) {
        tabSwitchCount.current += 1;
        if (tabSwitchCount.current >= 2) {
          setState((prev) => ({
            count: prev.count + 1,
            events: [...prev.events, { type, description, timestamp: new Date() }],
            terminated: true,
          }));
          if (interviewId) {
            try {
              const token = localStorage.getItem("token");
              await fetch(
                `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/cheating`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ type, description, metadata }),
                }
              );
              await fetch(
                `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/terminate`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
            } catch (err) {
              console.error("Failed to report cheating:", err);
            }
          }
          return;
        }
      }

      const event: CheatingEvent = { type, description, timestamp: new Date() };
      setPopup(event);

      setState((prev) => {
        const newCount = prev.count + 1;
        return {
          count: newCount,
          events: [...prev.events, event],
          terminated: newCount >= maxViolations,
        };
      });

      if (interviewId) {
        try {
          const token = localStorage.getItem("token");
          await fetch(
            `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/cheating`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ type, description, metadata }),
            }
          );
          if (state.count + 1 >= maxViolations) {
            await fetch(
              `${BACKEND_URL}/api/v1/mock-interview/${interviewId}/terminate`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
          }
        } catch (err) {
          console.error("Failed to report cheating:", err);
        }
      }

      setTimeout(() => setPopup(null), 4000);
    },
    [interviewId, maxViolations, state.count]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportCheating("tab_switch", "Browser tab switched");
      }
    };

    const handleWindowBlur = () => {
      reportCheating("window_minimized", "Window minimized or lost focus");
    };

    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (prevFullscreenRef.current && !isFullscreen) {
        reportCheating("fullscreen_exit", "Fullscreen mode exited");
      }
      prevFullscreenRef.current = isFullscreen;
    };

    const handleCopy = () => {
      reportCheating("copy", "Copy action detected");
    };

    const handlePaste = () => {
      reportCheating("paste", "Paste action detected");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportCheating("right_click", "Right click detected");
    };

    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if ((widthThreshold || heightThreshold) && !devToolsOpenRef.current) {
        devToolsOpenRef.current = true;
        reportCheating("devtools_open", "Developer tools detected");
      } else if (!widthThreshold && !heightThreshold) {
        devToolsOpenRef.current = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    const devToolsInterval = setInterval(detectDevTools, 2000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      clearInterval(devToolsInterval);
    };
  }, [reportCheating]);

  const dismissPopup = useCallback(() => {
    setPopup(null);
  }, []);

  return {
    cheatingCount: state.count,
    cheatingEvents: state.events,
    terminated: state.terminated,
    popup,
    dismissPopup,
    reportCheating,
  };
}
