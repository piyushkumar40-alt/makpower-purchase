import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Shield, Database, Truck, FileSpreadsheet, CheckCircle2, ArrowRight, Zap, LogOut } from "lucide-react";

export default function RahulDashboardLoading({ 
  currentUser, 
  onDirectPull, 
  onLogout 
}) {
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState(1);
  const [progress, setProgress] = useState(15);
  const [isPullingDirect, setIsPullingDirect] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Progressive stepper based on elapsed seconds
    if (elapsed >= 1 && activeStep < 2) {
      setActiveStep(2);
      setProgress(40);
    }
    if (elapsed >= 3 && activeStep < 3) {
      setActiveStep(3);
      setProgress(72);
    }
    if (elapsed >= 5 && activeStep < 4) {
      setActiveStep(4);
      setProgress(90);
    }
  }, [elapsed, activeStep]);

  const handleFastPull = async () => {
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
    <div style={{ minHeight: "85vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "30px 20px" }}>
      
      {/* Container Glass Panel */}
      <div 
        className="glass-panel card-fade-in" 
        style={{ 
          maxWidth: "680px", 
          width: "100%", 
          padding: "36px 32px", 
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.45)", 
          border: "1px solid rgba(56, 189, 248, 0.3)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Glowing top line accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #10b981, #38bdf8, #8b5cf6)" }} />

        {/* Top identity banner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: "6px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 700, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
              Accounts & Purchase Marking Panel
            </span>
            <span style={{ fontSize: "0.8rem", padding: "4px 10px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontWeight: 700, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              {currentUser?.name || "Mr. Rahul Mann"}
            </span>
          </div>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            >
              <LogOut size={12} /> Sign Out
            </button>
          )}
        </div>

        {/* Central visual header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div 
            style={{ 
              width: "64px", 
              height: "64px", 
              borderRadius: "50%", 
              background: "radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(16,185,129,0.08) 70%)", 
              border: "1px solid rgba(56,189,248,0.4)",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto 16px",
              boxShadow: "0 0 24px rgba(56, 189, 248, 0.3)"
            }}
          >
            <RefreshCw size={28} className="spin-animation" style={{ color: "#38bdf8" }} />
          </div>

          <h2 style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
            Synchronizing Accounts & Commercial Ledgers
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "480px", margin: "0 auto" }}>
            Connecting to high-speed purchase database, loading requisitions, cargo shipments, and preparing ledger records.
          </p>
        </div>

        {/* Dynamic Progress Bar */}
        <div style={{ marginBottom: "26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "8px" }}>
            <span>Retrieving System State</span>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "6px", overflow: "hidden", position: "relative" }}>
            <div 
              style={{ 
                height: "100%", 
                width: `${progress}%`, 
                background: "linear-gradient(90deg, #10b981 0%, #38bdf8 100%)", 
                borderRadius: "6px", 
                transition: "width 0.4s ease-in-out",
                boxShadow: "0 0 12px rgba(56, 189, 248, 0.5)"
              }} 
            />
          </div>
        </div>

        {/* Step-by-Step Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "26px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: activeStep >= 1 ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)", border: activeStep >= 1 ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent" }}>
            <div style={{ color: activeStep >= 1 ? "#10b981" : "var(--text-muted)" }}>
              <CheckCircle2 size={16} />
            </div>
            <div style={{ fontSize: "0.85rem", color: activeStep >= 1 ? "var(--text-main)" : "var(--text-muted)" }}>
              Accounts permissions verified for <strong>Mr. Rahul Mann</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: activeStep >= 2 ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)", border: activeStep >= 2 ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid transparent" }}>
            <div style={{ color: activeStep >= 2 ? "#38bdf8" : "var(--text-muted)" }}>
              {activeStep > 2 ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <Database size={16} className="spin-animation" />}
            </div>
            <div style={{ fontSize: "0.85rem", color: activeStep >= 2 ? "var(--text-main)" : "var(--text-muted)" }}>
              Pulling purchase requisitions & financial audit rows...
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: activeStep >= 3 ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)", border: activeStep >= 3 ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid transparent" }}>
            <div style={{ color: activeStep >= 3 ? "#38bdf8" : "var(--text-muted)" }}>
              {activeStep > 3 ? <CheckCircle2 size={16} style={{ color: "#10b981" }} /> : <Truck size={16} />}
            </div>
            <div style={{ fontSize: "0.85rem", color: activeStep >= 3 ? "var(--text-main)" : "var(--text-muted)" }}>
              Bundling active cargo shipments & in-transit packing documents...
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: activeStep >= 4 ? "rgba(139, 92, 246, 0.08)" : "rgba(255, 255, 255, 0.02)", border: activeStep >= 4 ? "1px solid rgba(139, 92, 246, 0.25)" : "1px solid transparent" }}>
            <div style={{ color: activeStep >= 4 ? "#a78bfa" : "var(--text-muted)" }}>
              <Zap size={16} />
            </div>
            <div style={{ fontSize: "0.85rem", color: activeStep >= 4 ? "var(--text-main)" : "var(--text-muted)" }}>
              Writing instant browser cache for future zero-second loading...
            </div>
          </div>

        </div>

        {/* Feature Announcement / Cache Note */}
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.05)", border: "1px dashed rgba(56, 189, 248, 0.3)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Zap size={18} style={{ color: "#38bdf8", flexShrink: 0 }} />
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            <strong style={{ color: "var(--text-main)" }}>Remember Browser Enabled:</strong> After this initial pull completes, this browser will cache the accounts dataset locally. Future visits will open in less than 1 second!
          </div>
        </div>

        

      </div>
    </div>
  );
}
