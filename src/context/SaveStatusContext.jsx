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
  trackSave: async (promise) => promise,
  resetSaveStatus: () => {},
  saveError: null
});

export const useSaveStatus = () => useContext(SaveStatusContext);

function formatCurrentTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Internal endpoints that are fire-and-forget, telemetry, or external integrations
// and must NEVER trigger a false-alarm "Save Issue" for database state
const NON_DATABASE_SAVE_PATTERNS = [
  "/api/audit-logs",
  "/api/auth/",
  "/api/settings/force-refresh",
  "/api/google-sheets/sync",
  "/api/storage/",
  "/api/migrate-photos-to-cloudinary",
  "/api/state"
];

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
  const lastSavedTimeRef = useRef(null);
  const autoCloseAlertTimeoutRef = useRef(null);
  const autoClearErrorTimeoutRef = useRef(null);

  // Sync ref
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  // Clean up auto-close & auto-clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoCloseAlertTimeoutRef.current) clearTimeout(autoCloseAlertTimeoutRef.current);
      if (autoClearErrorTimeoutRef.current) clearTimeout(autoClearErrorTimeoutRef.current);
    };
  }, []);

  const resetSaveStatus = useCallback(() => {
    if (autoClearErrorTimeoutRef.current) clearTimeout(autoClearErrorTimeoutRef.current);
    setSaveStatus(lastSavedTimeRef.current ? "saved" : "idle");
    setSaveError(null);
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
        lastSavedTimeRef.current = timeStr;
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

        // Auto-revert transient error to "saved" after 6 seconds so the header doesn't stay permanently stuck
        if (autoClearErrorTimeoutRef.current) clearTimeout(autoClearErrorTimeoutRef.current);
        autoClearErrorTimeoutRef.current = setTimeout(() => {
          setSaveStatus(prev => (prev === "error" ? (lastSavedTimeRef.current ? "saved" : "idle") : prev));
          setSaveError(null);
        }, 6000);
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
    window.__resetSaveStatus = resetSaveStatus;
    return () => {
      delete window.__beginSave;
      delete window.__endSave;
      delete window.__isSaving;
      delete window.__showSavingAlert;
      delete window.__resetSaveStatus;
    };
  }, [beginSave, endSave, resetSaveStatus]);

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

      const urlStr = typeof resource === "string" ? resource : (resource?.url || "");

      // Only track internal backend database mutations, never external webhooks, blobs, or telemetry
      const isInternalApi =
        urlStr.startsWith("/api/") ||
        (typeof window !== "undefined" && urlStr.startsWith(window.location.origin + "/api/")) ||
        (!urlStr.startsWith("http://") && !urlStr.startsWith("https://") && !urlStr.startsWith("blob:") && !urlStr.startsWith("data:") && urlStr.includes("/api/"));

      const isNonSave = NON_DATABASE_SAVE_PATTERNS.some((pattern) => urlStr.includes(pattern));
      const isSaveOp = isMutation && isInternalApi && !isNonSave;

      let saveId = null;
      if (isSaveOp) {
        saveId = beginSave(`Request: ${method} ${urlStr.slice(0, 40)}`);
      }

      try {
        const response = await originalFetch.apply(this, args);
        if (isSaveOp && saveId) {
          // Direct real-time link between browser and database confirmation:
          // ONLY mark as "saved" when the database server actually returns HTTP 200..299 ok.
          if (response.ok) {
            endSave(saveId, true);
          } else {
            const isRateLimit = response.status === 429;
            const errMsg = isRateLimit ? "Server busy (429 Rate Limit), retrying..." : `Server error (HTTP ${response.status})`;
            endSave(saveId, false, errMsg);
          }
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
        resetSaveStatus,
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
          onClick={() => {
            // Only allow closing if save has finished
            if (!isSaving) setShowSavingAlert(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              background: "var(--bg-card, #0f172a)",
              border: isSaving
                ? "1.5px solid rgba(245, 158, 11, 0.55)"
                : saveStatus === "error"
                ? "1.5px solid rgba(239, 68, 68, 0.55)"
                : "1.5px solid rgba(16, 185, 129, 0.55)",
              borderRadius: "18px",
              padding: "36px 30px",
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
              boxShadow: isSaving
                ? "0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(245, 158, 11, 0.28)"
                : saveStatus === "error"
                ? "0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(239, 68, 68, 0.28)"
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
                background: isSaving
                  ? "rgba(245, 158, 11, 0.15)"
                  : saveStatus === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                border: isSaving
                  ? "2.5px solid #f59e0b"
                  : saveStatus === "error"
                  ? "2.5px solid #ef4444"
                  : "2.5px solid #10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: isSaving
                  ? "0 0 25px rgba(245, 158, 11, 0.45)"
                  : saveStatus === "error"
                  ? "0 0 25px rgba(239, 68, 68, 0.45)"
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
              ) : saveStatus === "error" ? (
                <ShieldAlert size={36} style={{ color: "#ef4444" }} />
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
                color: isSaving
                  ? "#f59e0b"
                  : saveStatus === "error"
                  ? "#ef4444"
                  : "#10b981",
                letterSpacing: "-0.01em"
              }}
            >
              {isSaving
                ? "Saving, Please Wait!"
                : saveStatus === "error"
                ? "Database Sync Note"
                : "All Changes Saved!"}
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
                : saveStatus === "error"
                ? (saveError ? `Notice: ${saveError}. If your changes already appear on screen, they are safely preserved. You can refresh or dismiss this note.` : "A recent background sync encountered a temporary delay. Your saved orders and items in the active session remain intact.")
                : (lastSavedTime
                    ? `Your changes have been safely stored in the PostgreSQL database. (Last verified at ${lastSavedTime})`
                    : "Your changes have been safely stored in the database. You can now refresh or continue working safely.")}
            </p>

            {/* Live Status Pill or Action Buttons */}
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
            ) : saveStatus === "error" ? (
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    resetSaveStatus();
                    setShowSavingAlert(false);
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: "9px 20px",
                    fontWeight: 600,
                    borderRadius: "10px",
                    fontSize: "0.88rem"
                  }}
                >
                  Dismiss Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetSaveStatus();
                    setShowSavingAlert(false);
                    if (window.__forceRefreshApp) window.__forceRefreshApp();
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: "9px 22px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    fontSize: "0.88rem",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "none",
                    boxShadow: "0 4px 15px rgba(59, 130, 246, 0.35)"
                  }}
                >
                  Refresh Data
                </button>
              </div>
            ) : (
              <button
                type="button"
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
