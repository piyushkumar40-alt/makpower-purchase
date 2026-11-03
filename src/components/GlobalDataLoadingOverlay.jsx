import React, { useState, useEffect, useRef } from "react";
import { Clock, RefreshCw, Zap, Shield, Database } from "lucide-react";

export default function GlobalDataLoadingOverlay({ currentUser, onDirectPull, activeView }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPullingDirect, setIsPullingDirect] = useState(false);
  const startRef = useRef(Date.now());

  // Real-time duration timer updating every 50ms for smooth live feedback
  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Compute elapsed seconds with one decimal point (e.g., 0.8s, 2.4s)
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const secondsNum = elapsedMs / 1000;

  // Compute smooth, organic progress percentage based on real-time elapsed duration
  let progress = 15;
  if (secondsNum < 0.8) {
    progress = 15 + Math.round((secondsNum / 0.8) * 25); // 15% -> 40%
  } else if (secondsNum < 2.0) {
    progress = 40 + Math.round(((secondsNum - 0.8) / 1.2) * 28); // 40% -> 68%
  } else if (secondsNum < 4.0) {
    progress = 68 + Math.round(((secondsNum - 2.0) / 2.0) * 18); // 68% -> 86%
  } else if (secondsNum < 7.0) {
    progress = 86 + Math.round(((secondsNum - 4.0) / 3.0) * 8); // 86% -> 94%
  } else {
    progress = Math.min(97, 94 + Math.round((secondsNum - 7.0) * 0.5)); // crawls up to 97%
  }

  // Auto-launch direct pull if initial state load takes longer than 3.5s
  useEffect(() => {
    const autoRescue = setTimeout(() => {
      if (onDirectPull && !isPullingDirect) {
        handleDirectPull();
      }
    }, 3500);
    return () => clearTimeout(autoRescue);
  }, [onDirectPull]);

  // Format real-time duration in mm:ss.s or s.ss format
  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    if (mins > 0) {
      return `${mins}m ${secs.padStart(4, "0")}s`;
    }
    return `${secs}s`;
  };

  // Role-specific description
  const roleLower = String(currentUser?.role || "").toLowerCase();
  const desigLower = String(currentUser?.designation || "").toLowerCase();
  const isRahul = roleLower === "rahul" || currentUser?.id === "u-rahul" || desigLower.includes("mark purchase") || desigLower.includes("accounts");
  const isPurchase = isRahul || ["purchaser", "purchase_manager", "requester", "coordinator", "nitin", "warehouse", "packing"].includes(roleLower);

  const syncDescription = isRahul
    ? "Syncing commercial purchase orders, cargo shipments, bills & ledger records from cloud server..."
    : isPurchase
    ? "Syncing purchase orders, vendors, transit cargos & items from cloud server..."
    : "Syncing party accounts, orders, dispatches & dashboard metrics from cloud server...";

  const handleDirectPull = async () => {
    if (onDirectPull && !isPullingDirect) {
      setIsPullingDirect(true);
      try {
        await onDirectPull();
      } catch (e) {
        console.warn("Direct pull warning:", e);
      } finally {
        setIsPullingDirect(false);
      }
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
      <div 
        className="glass-panel card-fade-in" 
        style={{ 
          padding: "36px 32px", 
          textAlign: "center", 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: "18px", 
          maxWidth: "500px", 
          width: "100%", 
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)", 
          borderRadius: "20px", 
          border: "1px solid rgba(56, 189, 248, 0.35)",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.15)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Top glowing accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #10b981, #38bdf8, #8b5cf6)" }} />

        {/* Top Spinner */}
        <div style={{ position: "relative", width: "56px", height: "56px" }}>
          <div 
            style={{ 
              width: "56px", 
              height: "56px", 
              borderRadius: "50%", 
              border: "4px solid rgba(56, 189, 248, 0.15)", 
              borderTopColor: "#38bdf8", 
              borderRightColor: "rgba(56, 189, 248, 0.6)",
              animation: "globalSpin 0.75s linear infinite" 
            }} 
          />
          <div 
            style={{ 
              position: "absolute", 
              top: "50%", 
              left: "50%", 
              transform: "translate(-50%, -50%)", 
              width: "28px", 
              height: "28px", 
              borderRadius: "50%", 
              background: "rgba(56, 189, 248, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Database size={14} style={{ color: "#38bdf8" }} />
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: "0 0 8px 0", letterSpacing: "-0.01em" }}>
            Loading data please wait!
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.5, maxWidth: "420px" }}>
            {syncDescription}
          </p>
        </div>

        {/* ================= REAL-TIME LOADING BAR & DURATION ================= */}
        <div style={{ width: "100%", marginTop: "4px" }}>
          
          {/* Header row above bar: Percentage & Real-time Duration */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "0.82rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)" }}>
              <span>Progress</span>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>{progress}%</span>
            </div>

            {/* Live Duration Badge */}
            <div 
              style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                gap: "6px", 
                padding: "3px 10px", 
                borderRadius: "12px", 
                background: "rgba(56, 189, 248, 0.12)", 
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "0.8rem",
                fontVariantNumeric: "tabular-nums"
              }}
            >
              <Clock size={12} className="spin-animation" style={{ animationDuration: "3s" }} />
              <span>Real-Time Duration: {formatDuration(secondsNum)}</span>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div 
            style={{ 
              width: "100%", 
              height: "10px", 
              background: "rgba(255, 255, 255, 0.08)", 
              borderRadius: "8px", 
              overflow: "hidden", 
              position: "relative",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)"
            }}
          >
            {/* Animated Fill Bar */}
            <div 
              style={{ 
                height: "100%", 
                width: `${progress}%`, 
                background: "linear-gradient(90deg, #10b981 0%, #38bdf8 50%, #818cf8 100%)", 
                borderRadius: "8px", 
                transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 14px rgba(56, 189, 248, 0.6)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {/* Shimmer overlay effect */}
              <div 
                style={{ 
                  position: "absolute", 
                  top: 0, 
                  left: 0, 
                  bottom: 0, 
                  right: 0, 
                  background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.35) 50%, transparent 100%)",
                  animation: "shimmerSlide 1.5s infinite"
                }} 
              />
            </div>
          </div>

          {/* Status footer below bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "0.74rem", color: "var(--text-muted)" }}>
            <span>Connecting to cloud database...</span>
            <span style={{ color: "#10b981", fontWeight: 600 }}>Active Stream</span>
          </div>

        </div>

        {/* Syncing Badge */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "6px 16px", borderRadius: "20px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
          <span 
            style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: "#38bdf8", 
              display: "inline-block",
              boxShadow: "0 0 8px #38bdf8"
            }} 
          />
          <span>Secure Cloud Syncing...</span>
        </div>

        {/* Quick Rescue Fast Direct Pull (Appears if duration > 3.5s) */}
        {secondsNum >= 3.5 && onDirectPull && (
          <div style={{ marginTop: "4px", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", width: "100%", display: "flex", justifyContent: "center", gap: "10px" }}>
            <button
              onClick={handleDirectPull}
              disabled={isPullingDirect}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.8rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Zap size={13} /> {isPullingDirect ? "Pulling..." : "⚡ Fast Direct Pull"}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
            >
              Reload
            </button>
          </div>
        )}

        <style>{`
          @keyframes globalSpin {
            to { transform: rotate(360deg); }
          }
          @keyframes shimmerSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
