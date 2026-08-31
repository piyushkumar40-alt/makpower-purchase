import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { CheckCircle2, RefreshCw, Sparkles } from "lucide-react";

const LoadingContext = createContext({
  startLoading: () => {},
  updateProgress: () => {},
  finishLoading: () => {},
  withLoading: async () => {}
});

export const useLoading = () => useContext(LoadingContext);

/**
 * Universal Loading Progress Provider
 * - Displays a 0-100% progress modal ONLY when an operation takes longer than 2 seconds (2000ms threshold).
 * - Animates progress smoothly from 0 to 100%.
 */
export function LoadingProvider({ children }) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("Processing...");
  const [detail, setDetail] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const delayTimerRef = useRef(null);
  const tickerIntervalRef = useRef(null);
  const activeRef = useRef(false);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, []);

  const updateProgress = useCallback((percent, customDetail) => {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    setProgress(clamped);
    if (customDetail !== undefined) {
      setDetail(customDetail);
    }
  }, []);

  const startLoading = useCallback((taskTitle = "Processing...", initialDetail = "", initialPercent = 5) => {
    // Clear any previous timers
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);

    activeRef.current = true;
    setActive(true);
    setVisible(false);
    setIsCompleted(false);
    setProgress(initialPercent);
    setTitle(taskTitle);
    setDetail(initialDetail || "Please wait while operation completes...");

    // Rule: Appears ONLY if the task takes more than 2 seconds (2000ms)
    delayTimerRef.current = setTimeout(() => {
      if (activeRef.current) {
        setVisible(true);

        // Smoothly tick progress towards 95% if manual progress updates aren't provided
        tickerIntervalRef.current = setInterval(() => {
          setProgress(prev => {
            if (prev < 30) return prev + Math.floor(Math.random() * 8 + 4);
            if (prev < 70) return prev + Math.floor(Math.random() * 5 + 2);
            if (prev < 92) return prev + Math.floor(Math.random() * 2 + 1);
            return prev;
          });
        }, 300);
      }
    }, 2000);
  }, []);

  const finishLoading = useCallback((completedMessage = "Completed successfully!") => {
    activeRef.current = false;
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);

    if (visible) {
      // If modal was already shown to user, animate to 100% and show success briefly
      setProgress(100);
      setIsCompleted(true);
      if (completedMessage) setDetail(completedMessage);

      setTimeout(() => {
        setVisible(false);
        setActive(false);
        setIsCompleted(false);
      }, 600);
    } else {
      // Finished before 2s: instantly reset without ever showing modal
      setVisible(false);
      setActive(false);
      setIsCompleted(false);
    }
  }, [visible]);

  /**
   * Helper wrapper to execute any async function with progress
   */
  const withLoading = useCallback(async (asyncFn, { title = "Processing...", detail = "", total = null } = {}) => {
    startLoading(title, detail, total ? 5 : 10);
    try {
      const result = await asyncFn((current, customText) => {
        if (typeof current === "number") {
          if (total) {
            const pct = Math.round((current / total) * 100);
            updateProgress(pct, customText || `Processed ${current} of ${total} (${pct}%)`);
          } else {
            updateProgress(current, customText);
          }
        } else if (typeof current === "string") {
          setDetail(current);
        }
      });
      finishLoading();
      return result;
    } catch (err) {
      finishLoading();
      throw err;
    }
  }, [startLoading, updateProgress, finishLoading]);

  // Expose global window access for non-React contexts if needed
  useEffect(() => {
    window.__startLoadingProgress = startLoading;
    window.__updateLoadingProgress = updateProgress;
    window.__finishLoadingProgress = finishLoading;
    window.__withLoadingProgress = withLoading;
    return () => {
      delete window.__startLoadingProgress;
      delete window.__updateLoadingProgress;
      delete window.__finishLoadingProgress;
      delete window.__withLoadingProgress;
    };
  }, [startLoading, updateProgress, finishLoading, withLoading]);

  return (
    <LoadingContext.Provider value={{ startLoading, updateProgress, finishLoading, withLoading }}>
      {children}

      {/* Global 0-100% Progress Modal Overlay (Visible only after 2 seconds) */}
      {visible && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            backgroundColor: "rgba(5, 8, 22, 0.78)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div 
            className="glass-panel card-fade-in"
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
              border: `1px solid ${isCompleted ? "rgba(16, 185, 129, 0.5)" : "rgba(56, 189, 248, 0.4)"}`,
              boxShadow: `0 25px 60px -15px ${isCompleted ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.35)"}`,
              borderRadius: "20px",
              padding: "32px 28px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px"
            }}
          >
            {/* Top Animated Icon */}
            <div 
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: isCompleted 
                  ? "rgba(16, 185, 129, 0.15)" 
                  : "linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))",
                border: `2px solid ${isCompleted ? "#10b981" : "#38bdf8"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isCompleted 
                  ? "0 0 24px rgba(16, 185, 129, 0.4)" 
                  : "0 0 24px rgba(56, 189, 248, 0.4)",
                transition: "all 0.3s ease"
              }}
            >
              {isCompleted ? (
                <CheckCircle2 size={34} style={{ color: "#10b981" }} />
              ) : (
                <RefreshCw size={30} style={{ color: "#38bdf8", animation: "spin 1.2s linear infinite" }} />
              )}
            </div>

            {/* Title & Progress % Display */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "6px" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  {isCompleted ? "Operation Complete" : title}
                </h3>
                <span 
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 900,
                    color: isCompleted ? "#34d399" : "#38bdf8",
                    fontFamily: "monospace",
                    background: isCompleted ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.15)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: `1px solid ${isCompleted ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.3)"}`
                  }}
                >
                  {progress}%
                </span>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: 0, minHeight: "22px" }}>
                {detail}
              </p>
            </div>

            {/* Sleek 0-100 Progress Bar */}
            <div 
              style={{
                width: "100%",
                height: "12px",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "999px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                position: "relative",
                padding: "2px"
              }}
            >
              <div 
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: isCompleted
                    ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)"
                    : "linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #818cf8 100%)",
                  boxShadow: isCompleted
                    ? "0 0 12px rgba(16, 185, 129, 0.8)"
                    : "0 0 14px rgba(56, 189, 248, 0.8)",
                  transition: "width 0.25s ease-out, background 0.3s ease"
                }}
              />
            </div>

            {/* Bottom Status Tip */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.45)" }}>
              <Sparkles size={12} style={{ color: "#38bdf8" }} />
              <span>Processing your request securely in real-time</span>
            </div>

          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}