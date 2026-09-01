import React, { useState } from "react";
import { LogIn, Key, Mail, Shield, User, CornerDownRight } from "lucide-react";

export default function LoginPage({ onLogin, onEnterAsGuest, users }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await onLogin(email, password);
    if (result && !result.success) {
      setError(result.message);
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
      <div className="glass-panel card-fade-in" style={{ padding: "40px 30px", width: "100%", maxWidth: "440px" }}>
        
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ fontSize: "2rem", color: "var(--primary)", textShadow: "0 0 15px var(--primary-glow)", marginBottom: "4px" }}>
            Mak Power Portal
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
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
                placeholder="you@makpowerindia.com" 
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

          {/* Action button */}
          <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px", marginTop: "8px" }}>
            <LogIn size={18} /> Login to Dashboard
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
