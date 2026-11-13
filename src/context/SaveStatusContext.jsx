import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw, CheckCircle2, ShieldAlert, AlertTriangle, X } from "lucide-react";

const SaveStatusContext = createContext({
  isSaving: false,
  saveStatus: "idle", // "idle" | "saving" | "saved" | "error"
  lastSavedTime: null,
  lastSavedTimestamp: null,
  activeSavesCount: 0,
  showSavingAlert: false,
  setShowSavingAlert: () => {},
  beginSave: () => "",
  endSave: () => {},
  trackSave: async (promise) => promise
});

export const useSaveStatus = () => useContext(SaveStatusContext);

function formatCurrentTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function SaveStatusProvider({ children }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null);
  const [activeSavesCount, setActiveSavesCount] = useState(0);
  const [showSavingAlert, setShowSavingAlert] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Set of currently active save operation IDs
  const activeSavesRef = useRef(new Map()); // id -> { taskName, timeoutId }
  const isSavingRef = useRef(false);
  const autoCloseAlertTimeoutRef = useRef(null);

  // Sync ref
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  // Clean up auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseAlertTimeoutRef.current) clearTimeout(autoCloseAlertTimeoutRef.current);
    };
  }, []);

  const updateStateFromMap = useCallback((wasSuccess = true, errorMsg = null) => {
    const count = activeSavesRef.current.size;
    setActiveSavesCount(count);

    if (count > 0) {
      setIsSaving(true);
      isSavingRef.current = true;
      setSaveStatus("saving");
      setSaveError(null);
    } else {
      setIsSaving(false);
      isSavingRef.current = false;
      if (wasSuccess) {
        const timeStr = formatCurrentTime();
        setSaveStatus("saved");
        setLastSavedTime(timeStr);
        setLastSavedTimestamp(Date.now());
        setSaveError(null);

        // If the "Saving, Please Wait" alert was opened, notify success then auto-dismiss
        if (autoCloseAlertTimeoutRef.current) clearTimeout(autoCloseAlertTimeoutRef.current);
        autoCloseAlertTimeoutRef.current = setTimeout(() => {
          setShowSavingAlert(false);
        }, 1800);
      } else {
        setSaveStatus("error");
        setSaveError(errorMsg || "An error occurred while saving to database.");
      }
    }
  }, []);

  const beginSave = useCallback((taskName = "Saving to database") => {
    const id = "save_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);

    // Failsafe watchdog timer: If request takes > 25 seconds (e.g. stalled connection), release the lock
    const timeoutId = setTimeout(() => {
      if (activeSavesRef.current.has(id)) {
        console.warn(`[SaveStatus] Save operation "${taskName}" (#${id}) timed out after 25s.`);
        activeSavesRef.current.delete(id);
        updateStateFromMap(false, "Save operation timed out.");
      }
    }, 25000);

    activeSavesRef.current.set(id, { taskName, timeoutId });
    updateStateFromMap(true);
    return id;
  }, [updateStateFromMap]);

  const endSave = useCallback((id, wasSuccess = true, errorMsg = null) => {
    if (!id) {
      // If no ID passed, clear the oldest or all
      if (activeSavesRef.current.size > 0) {
        const firstKey = activeSavesRef.current.keys().next().value;
        const entry = activeSavesRef.current.get(firstKey);
        if (entry?.timeoutId) clearTimeout(entry.timeoutId);
        activeSavesRef.current.delete(firstKey);
      }
    } else if (activeSavesRef.current.has(id)) {
      const entry = activeSavesRef.current.get(id);
      if (entry?.timeoutId) clearTimeout(entry.timeoutId);
      activeSavesRef.current.delete(id);
    }
    updateStateFromMap(wasSuccess, errorMsg);
  }, [updateStateFromMap]);

  const trackSave = useCallback(async (promiseOrAsyncFn, taskName = "Saving data") => {
    const id = beginSave(taskName);
    try {
      const promise = typeof promiseOrAsyncFn === "function" ? promiseOrAsyncFn() : promiseOrAsyncFn;
      const res = await promise;
      endSave(id, true);
      return res;
    } catch (err) {
      endSave(id, false, err.message);
      throw err;
    }
  }, [beginSave, endSave]);

  // Expose global window hooks for external utilities
  useEffect(() => {
    window.__beginSave = beginSave;
    window.__endSave = endSave;
    window.__isSaving = () => isSavingRef.current;
    window.__showSavingAlert = () => setShowSavingAlert(true);
    return () => {
      delete window.__beginSave;
      delete window.__endSave;
      delete window.__isSaving;
      delete window.__showSavingAlert;
    };
  }, [beginSave, endSave]);

  // ==================== BROWSER UNLOAD & REFRESH INTERCEPTOR ====================
  useEffect(() => {
    // 1. Browser Native Tab Close / Reload Guard
    const handleBeforeUnload = (e) => {
      if (isSavingRef.current || activeSavesRef.current.size > 0) {
        e.preventDefault();
        // Standard spec message
        const warningMsg = "Saving in progress, please wait! Your changes are currently being stored in the database.";
        e.returnValue = warningMsg;
        return warningMsg;
      }
    };

    // 2. Keyboard Shortcut Trap (F5, Ctrl+R, Ctrl+Shift+R, Cmd+R)
    const handleKeyDown = (e) => {
      const isF5 = e.key === "F5";
      const isCtrlOrCmdR = (e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R");

      if ((isF5 || isCtrlOrCmdR) && (isSavingRef.current || activeSavesRef.current.size > 0)) {
        e.preventDefault();
        e.stopPropagation();
        setShowSavingAlert(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // ==================== GLOBAL MUTATING FETCH INTERCEPTOR ====================
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const [resource, config] = args;
      const method = config?.method ? String(config.method).toUpperCase() : "GET";
      const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

      // Filter out internal polling/heartbeats if any
      const urlStr = typeof resource === "string" ? resource : (resource?.url || "");
      const isSaveOp = isMutation && !urlStr.includes("/api/auth/sessions");

      let saveId = null;
      if (isSaveOp) {
        saveId = beginSave(`Request: ${method} ${urlStr.slice(0, 40)}`);
      }

      try {
        const response = await originalFetch.apply(this, args);
        if (isSaveOp && saveId) {
          endSave(saveId, response.ok);
        }
        return response;
      } catch (err) {
        if (isSaveOp && saveId) {
          endSave(saveId, false, err.message);
        }
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [beginSave, endSave]);

  return (
    <SaveStatusContext.Provider
      value={{
        isSaving,
        saveStatus,
        lastSavedTime,
        lastSavedTimestamp,
        activeSavesCount,
        showSavingAlert,
        setShowSavingAlert,
        beginSave,
        endSave,
        trackSave,
        saveError
      }}
    >
      {children}

      {/* ==================== GLOBAL "SAVING, PLEASE WAIT" ALERT MODAL ==================== */}
      {showSavingAlert && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(10, 15, 29, 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 99999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={(e) => {
            // Only allow closing if save has finished
            if (!isSaving) setShowSavingAlert(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              background: "var(--bg-card, #0f172a)",
              border: isSaving ? "1.5px solid rgba(245, 158, 11, 0.55)" : "1.5px solid rgba(16, 185, 129, 0.55)",
              borderRadius: "18px",
              padding: "36px 30px",
              maxWidth: "460px",
              width: "100%",
              textAlign: "center",
              boxShadow: isSaving
                ? "0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(245, 158, 11, 0.28)"
                : "0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.28)",
              animation: "fadeIn 0.25s ease-out",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button (visible only when not saving) */}
            {!isSaving && (
              <button
                onClick={() => setShowSavingAlert(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #94a3b8)",
                  cursor: "pointer",
                  padding: "4px"
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}

            {/* Glowing Icon Orb */}
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: isSaving ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                border: isSaving ? "2.5px solid #f59e0b" : "2.5px solid #10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: isSaving
                  ? "0 0 25px rgba(245, 158, 11, 0.45)"
                  : "0 0 25px rgba(16, 185, 129, 0.45)"
              }}
            >
              {isSaving ? (
                <RefreshCw
                  size={32}
                  style={{
                    color: "#f59e0b",
                    animation: "spin 0.9s linear infinite"
                  }}
                />
              ) : (
                <CheckCircle2 size={36} style={{ color: "#10b981" }} />
              )}
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                marginBottom: "10px",
                color: isSaving ? "#f59e0b" : "#10b981",
                letterSpacing: "-0.01em"
              }}
            >
              {isSaving ? "Saving, Please Wait!" : "All Changes Saved!"}
            </h3>

            {/* Explanatory Message */}
            <p
              style={{
                fontSize: "0.94rem",
                color: "var(--text-muted, #cbd5e1)",
                lineHeight: 1.6,
                marginBottom: "22px"
              }}
            >
              {isSaving
                ? "Your submission is currently saving to the server database. Please do NOT refresh, reload, or close the browser until complete so your changes are safely stored."
                : "Your changes have been safely stored in the database. You can now refresh or continue working safely."}
            </p>

            {/* Live Status Pill */}
            {isSaving ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 18px",
                  borderRadius: "999px",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  color: "#f59e0b",
                  fontSize: "0.84rem",
                  fontWeight: 700
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#f59e0b",
                    boxShadow: "0 0 8px #f59e0b",
                    animation: "pulse 1.2s infinite"
                  }}
                ></span>
                Writing changes to database...
              </div>
            ) : (
              <button
                onClick={() => setShowSavingAlert(false)}
                className="btn btn-primary"
                style={{
                  padding: "10px 28px",
                  fontWeight: 700,
                  borderRadius: "10px",
                  fontSize: "0.92rem",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.35)"
                }}
              >
                Got It
              </button>
            )}
          </div>
        </div>
      )}
    </SaveStatusContext.Provider>
  );
}
