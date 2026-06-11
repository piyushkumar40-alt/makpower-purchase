import React, { useState } from "react";
import { LogIn, Key, Mail, Shield, User, CornerDownRight } from "lucide-react";

export default function LoginPage({ onLogin, onEnterAsGuest, users }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const result = onLogin(email, password);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleQuickLogin = (presetEmail, presetPassword) => {
    setEmail(presetEmail);
    setPassword(presetPassword);
    setError("");
    onLogin(presetEmail, presetPassword);
  };

  // Find active purchasers for quick login buttons
  const activePurchasers = users.filter(u => u.role === "purchaser" && u.status === "active");
  const superAdmin = users.find(u => u.role === "superadmin");
  const nitinUser = users.find(u => u.role === "nitin");
  const rahulUser = users.find(u => u.role === "rahul");
  const coordinatorUser = users.find(u => u.role === "coordinator");

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
      <div className="glass-panel card-fade-in" style={{ padding: "40px 30px", width: "100%", maxWidth: "450px" }}>
        
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ fontSize: "2rem", color: "var(--primary)", textShadow: "0 0 15px var(--primary-glow)", marginBottom: "4px" }}>
            Mak Power Portal
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Purchase Request & Shipment Logistics
          </p>
        </div>

        {error && (
          <div className="alert-strip alert-danger" style={{ marginBottom: "20px" }}>
            <Shield size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Email input */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="email" 
                className="form-control" 
                placeholder="you@company.com" 
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

        {/* Quick Testing Presets */}
        <div style={{ marginTop: "24px", background: "rgba(255, 255, 255, 0.02)", border: "1px dashed var(--border-glass)", borderRadius: "10px", padding: "16px" }}>
          <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Shield size={12} /> Quick Testing Login
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {superAdmin && (
              <button 
                onClick={() => handleQuickLogin(superAdmin.email, superAdmin.password)}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: "flex-start", fontSize: "0.8rem", width: "100%" }}
              >
                <Shield size={12} style={{ color: "var(--accent)" }} /> 
                <strong>Super Admin:</strong> {superAdmin.name}
              </button>
            )}
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
