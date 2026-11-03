import React, { useState, useEffect } from "react";
import { LogIn, Key, Mail, Shield, User, CornerDownRight, CheckSquare, Square, RefreshCw, Zap } from "lucide-react";
import { getRememberBrowserPreference, saveRememberBrowserPreference } from "../utils/dashboardCache";

export default function LoginPage({ onLogin, onEnterAsGuest, users }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberBrowser, setRememberBrowser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const pref = getRememberBrowserPreference();
      if (pref.remember) {
        setRememberBrowser(true);
        if (pref.email) {
          setEmail(pref.email);
        }
      }
    } catch (e) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      saveRememberBrowserPreference(email, rememberBrowser);
      const result = await onLogin(email, password);
      if (result && !result.success) {
        setError(result.message || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred during sign-in. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
      <div className="glass-panel card-fade-in" style={{ padding: "40px 30px", width: "100%", maxWidth: "440px" }}>
        
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <h2 style={{ fontSize: "2rem", color: "var(--primary)", textShadow: "0 0 15px var(--primary-glow)", marginBottom: "4px" }}>
            Operations & Supply Portal
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Purchase Operations & CRM Command Center
          </p>
        </div>

        {error && (
          <div className="alert-strip alert-danger" style={{ marginBottom: "20px" }}>
            <Shield size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Email input */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="email" 
                name="user_login_email"
                autoComplete="off"
                className="form-control" 
                placeholder="user@company.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ paddingLeft: "42px" }}
              />
            </div>
          </div>

          {/* Password input */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <Key size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="password" 
                name="user_login_sec_key"
                autoComplete="off"
                className="form-control" 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingLeft: "42px" }}
              />
            </div>
          </div>

          {/* Remember Browser & Cache Setting */}
          <div 
            onClick={() => setRememberBrowser(!rememberBrowser)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              cursor: "pointer", 
              padding: "8px 12px", 
              borderRadius: "8px", 
              background: rememberBrowser ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
              border: rememberBrowser ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid var(--border-glass)",
              userSelect: "none",
              transition: "all 0.2s"
            }}
          >
            {rememberBrowser ? (
              <CheckSquare size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            ) : (
              <Square size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            )}
            <div style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
              <span style={{ color: "var(--text-main)", fontWeight: 600 }}>Remember this browser</span>
              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.74rem" }}>
                Cache accounts data locally for instant 0.1-second dashboard opening
              </span>
            </div>
          </div>

          {/* Action button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="btn btn-primary" 
            style={{ width: "100%", padding: "12px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="spin-animation" />
                <span>Opening Dashboard...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Login to Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Guest access */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "24px", borderTop: "1px solid var(--border-glass)", paddingTop: "20px" }}>
          <button 
            onClick={onEnterAsGuest} 
            className="btn btn-secondary btn-sm"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <CornerDownRight size={14} /> Submit a Purchase Request (No Login)
          </button>
        </div>

      </div>
    </div>
  );
}
