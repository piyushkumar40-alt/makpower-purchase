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

  const handleQuickLogin = async (presetEmail, presetPassword) => {
    setEmail(presetEmail);
    setPassword(presetPassword);
    setError("");
    const result = await onLogin(presetEmail, presetPassword);
    if (result && !result.success) {
      setError(result.message);
    }
  };

  // Find active purchasers, CRM executives, and key role users for quick login buttons
  const superAdmin = users.find(u => u.role === "superadmin" || u.email === "admin@makpowerindia.com" || u.email === "admin@company.com");
  const nitinUser = users.find(u => u.id === "u-nitin" || u.email === "nitin@makpowerindia.com" || u.role === "nitin");
  const rahulUser = users.find(u => u.id === "u-rahul" || u.email === "rahul@makpowerindia.com" || u.role === "rahul");
  const coordinatorUser = users.find(u => u.id === "u-coordinator" || u.email === "pc@makpowerindia.com" || u.role === "coordinator");
  const crmUsers = users.filter(u => u.role === "crm" && u.status === "active");
  const activePurchasers = users.filter(u => u.role === "purchaser" && u.status === "active");
  const fieldTeam = users.filter(u => (u.role === "asm" || u.role === "tsm") && u.status === "active");

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
      <div className="glass-panel card-fade-in" style={{ padding: "40px 30px", width: "100%", maxWidth: "480px" }}>
        
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
                type="text" 
                name="user_login_sec_key"
                autoComplete="off"
                data-lpignore="true"
                className="form-control" 
                placeholder="........" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingLeft: "42px", WebkitTextSecurity: "disc" }}
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

        {/* Quick Testing Presets */}
        <div style={{ marginTop: "24px", background: "rgba(255, 255, 255, 0.02)", border: "1px dashed var(--border-glass)", borderRadius: "10px", padding: "16px" }}>
          <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Shield size={12} /> Quick Testing Login
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
            {/* Super Admin Preset */}
            <button 
              onClick={() => handleQuickLogin(superAdmin?.email || "admin@makpowerindia.com", superAdmin?.password || "MakPower#Admin2026!")}
              className="btn btn-primary btn-sm"
              style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%", fontWeight: 700 }}
            >
              <Shield size={13} /> 
              <strong>Super Admin:</strong> {superAdmin?.email || "admin@makpowerindia.com"}
            </button>

            {/* CRM Presets */}
            {crmUsers.map(crm => (
              <button 
                key={crm.id}
                onClick={() => handleQuickLogin(crm.email, crm.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)" }}
              >
                <User size={12} style={{ color: "#818cf8" }} /> 
                <strong>CRM ({crm.name}):</strong> {crm.email}
              </button>
            ))}

            {nitinUser && (
              <button 
                onClick={() => handleQuickLogin(nitinUser.email, nitinUser.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%" }}
              >
                <User size={12} style={{ color: "#ec4899" }} /> 
                <strong>Nitin (Packing):</strong> {nitinUser.name}
              </button>
            )}
            {rahulUser && (
              <button 
                onClick={() => handleQuickLogin(rahulUser.email, rahulUser.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%" }}
              >
                <User size={12} style={{ color: "#10b981" }} /> 
                <strong>Rahul (Updates):</strong> {rahulUser.name}
              </button>
            )}
            {coordinatorUser && (
              <button 
                onClick={() => handleQuickLogin(coordinatorUser.email, coordinatorUser.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%" }}
              >
                <User size={12} style={{ color: "var(--accent)" }} /> 
                <strong>Coordinator:</strong> {coordinatorUser.name}
              </button>
            )}
            {activePurchasers.map(purchaser => (
              <button 
                key={purchaser.id}
                onClick={() => handleQuickLogin(purchaser.email, purchaser.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%" }}
              >
                <User size={12} style={{ color: "var(--primary)" }} /> 
                <strong>Purchaser:</strong> {purchaser.name}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
