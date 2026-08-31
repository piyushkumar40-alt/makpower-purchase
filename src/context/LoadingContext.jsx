import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X, RefreshCw, Sparkles } from "lucide-react";

const LoadingContext = createContext({
  startLoading: () => {},
  updateProgress: () => {},
  finishLoading: () => {},
  withLoading: async () => {},
  showToast: () => {},
  showSuccessToast: () => {},
  showErrorToast: () => {},
  showInfoToast: () => {}
});

export const useLoading = () => useContext(LoadingContext);

/**
 * Universal Loading Progress & Toast Popup Notification Provider
 */
export function LoadingProvider({ children }) {
  // Modal Loading State
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("Processing...");
  const [detail, setDetail] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  // Toast Notification Popup State
  const [toasts, setToasts] = useState([]); // [{ id, message, type: 'success'|'error'|'info', title }]

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

  const showToast = useCallback((message, type = "success", customTitle = "") => {
    const id = "toast_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const newToast = {
      id,
      message: message || (type === "success" ? "Saved successfully!" : "Notification"),
      type,
      title: customTitle || (type === "success" ? "Success" : type === "error" ? "Error" : "Notice")
    };

    setToasts(prev => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 3.8s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }, []);

  const showSuccessToast = useCallback((msg, title = "Saved Successfully") => {
    showToast(msg || "Saved successfully!", "success", title);
  }, [showToast]);

  const showErrorToast = useCallback((msg, title = "Action Failed") => {
    showToast(msg || "An error occurred while processing.", "error", title);
  }, [showToast]);

  const showInfoToast = useCallback((msg, title = "Information") => {
    showToast(msg, "info", title);
  }, [showToast]);

  const updateProgress = useCallback((percent, customDetail) => {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    setProgress(clamped);
    if (customDetail !== undefined) {
      setDetail(customDetail);
    }
  }, []);

  const startLoading = useCallback((taskTitle = "Processing...", initialDetail = "", initialPercent = 5) => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);

    activeRef.current = true;
    setActive(true);
    setVisible(false);
    setIsCompleted(false);
    setProgress(initialPercent);
    setTitle(taskTitle);
    setDetail(initialDetail || "Please wait while operation completes...");

    // Show progress modal if task exceeds 1.5s
    delayTimerRef.current = setTimeout(() => {
      if (activeRef.current) {
        setVisible(true);
        tickerIntervalRef.current = setInterval(() => {
          setProgress(prev => {
            if (prev < 30) return prev + Math.floor(Math.random() * 8 + 4);
            if (prev < 70) return prev + Math.floor(Math.random() * 5 + 2);
            if (prev < 92) return prev + Math.floor(Math.random() * 2 + 1);
            return prev;
          });
        }, 300);
      }
    }, 1500);
  }, []);

  const finishLoading = useCallback((completedMessage = "Saved successfully!", showPopup = true) => {
    activeRef.current = false;
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);

    if (visible) {
      setProgress(100);
      setIsCompleted(true);
      if (completedMessage) setDetail(completedMessage);

      setTimeout(() => {
        setVisible(false);
        setActive(false);
        setIsCompleted(false);
        if (showPopup && completedMessage) {
          showSuccessToast(completedMessage);
        }
      }, 500);
    } else {
      setVisible(false);
      setActive(false);
      setIsCompleted(false);
      if (showPopup && completedMessage) {
        showSuccessToast(completedMessage);
      }
    }
  }, [visible, showSuccessToast]);

  const withLoading = useCallback(async (asyncFn, { title = "Processing...", detail = "", total = null, successMsg = "Saved successfully!" } = {}) => {
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
      finishLoading(successMsg);
      return result;
    } catch (err) {
      finishLoading();
      showErrorToast(err.message || "Failed to complete operation");
      throw err;
    }
  }, [startLoading, updateProgress, finishLoading, showErrorToast]);

  // Expose global window access for non-React contexts if needed
  useEffect(() => {
    window.__startLoadingProgress = startLoading;
    window.__updateLoadingProgress = updateProgress;
    window.__finishLoadingProgress = finishLoading;
    window.__withLoadingProgress = withLoading;
    window.__showSuccessToast = showSuccessToast;
    window.__showErrorToast = showErrorToast;
    return () => {
      delete window.__startLoadingProgress;
      delete window.__updateLoadingProgress;
      delete window.__finishLoadingProgress;
      delete window.__withLoadingProgress;
      delete window.__showSuccessToast;
      delete window.__showErrorToast;
    };
  }, [startLoading, updateProgress, finishLoading, withLoading, showSuccessToast, showErrorToast]);

  return (
    <LoadingContext.Provider value={{ 
      startLoading, 
      updateProgress, 
      finishLoading, 
      withLoading, 
      showToast, 
      showSuccessToast, 
      showErrorToast, 
      showInfoToast 
    }}>
      {children}

      {/* ==================== GLOBAL FLOATING TOAST POPUPS ==================== */}
      {toasts.length > 0 && (
        <div 
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 9999999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "420px",
            width: "calc(100% - 48px)",
            pointerEvents: "none"
          }}
        >
          {toasts.map(t => {
            const isSuccess = t.type === "success";
            const isError = t.type === "error";

            return (
              <div
                key={t.id}
                style={{
                  pointerEvents: "auto",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  background: isSuccess 
                    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.96) 0%, rgba(5, 150, 105, 0.96) 100%)"
                    : isError
                    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.96) 0%, rgba(185, 28, 28, 0.96) 100%)"
                    : "linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.96) 100%)",
                  color: "#ffffff",
                  boxShadow: isSuccess 
                    ? "0 12px 30px -6px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(255,255,255,0.2)"
                    : isError
                    ? "0 12px 30px -6px rgba(239, 68, 68, 0.5), 0 0 0 1px rgba(255,255,255,0.2)"
                    : "0 12px 30px -6px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.15)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer"
                }}
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              >
                <div 
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  {isSuccess ? (
                    <CheckCircle2 size={22} style={{ color: "#ffffff" }} />
                  ) : isError ? (
                    <AlertCircle size={22} style={{ color: "#ffffff" }} />
                  ) : (
                    <Info size={22} style={{ color: "#ffffff" }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                    {t.message}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.88, marginTop: "2px" }}>
                    {isSuccess ? "Action completed & verified" : isError ? "Please check details and retry" : "System Notification"}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts(prev => prev.filter(x => x.id !== t.id));
                  }}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Global 0-100% Progress Modal Overlay (Visible for long tasks) */}
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