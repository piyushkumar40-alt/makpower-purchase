import React, { useState, useEffect } from "react";
import { 
  User, 
  Phone, 
  Mail, 
  Shield, 
  Key, 
  X, 
  Check, 
  PhoneCall, 
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useModalEscape } from "../utils/useModalEscape";

/**
 * UserProfileModal:
 * Allows any logged-in staff/purchaser/admin to view their profile details
 * and add/update their phone number and launch password change.
 */
export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateUserInfo,
  onChangePasswordClick
}) {
  useModalEscape(onClose, isOpen);

  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (currentUser) {
      setPhone(currentUser.phone || "");
      setSuccessMsg("");
      setErrorMsg("");
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleSavePhone = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanPhone = phone.trim();
    setIsSaving(true);
    try {
      if (onUpdateUserInfo) {
        await onUpdateUserInfo(currentUser.id, { phone: cleanPhone });
      }
      setSuccessMsg("Phone number updated successfully!");
      setTimeout(() => {
        setSuccessMsg("");
      }, 3000);
    } catch (err) {
      setErrorMsg("Failed to update phone number. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleDisplayName = (role) => {
    if (role === "superadmin") return "System Administrator";
    if (role === "owner") return "Executive Owner";
    if (role === "rahul") return "Accounts & Ledger (Rahul)";
    if (role === "nitin") return "Packing Operations (Nitin)";
    if (role === "coordinator") return "Logistics Coordinator";
    if (role === "crm") return "CRM Executive";
    if (role === "asm") return "Area Sales Manager (ASM)";
    if (role === "tsm") return "Territory Sales Manager (TSM)";
    if (role === "rsm") return "Regional Sales Manager (RSM)";
    if (role === "purchase_manager") return "Purchase Manager";
    return currentUser.designation || "Purchaser";
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        zIndex: 1200,
        backdropFilter: "blur(6px)",
        background: "rgba(15, 23, 42, 0.75)",
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div 
        className="glass-panel card-fade-in" 
        onClick={e => e.stopPropagation()}
        style={{
          width: "95vw",
          maxWidth: "480px",
          borderRadius: "16px",
          border: "1px solid var(--border-glass)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
          padding: 0,
          background: "var(--card-bg, #1e293b)"
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-glass)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(99, 102, 241, 0.05))"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div 
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0284c7, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff"
              }}
            >
              <User size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
                User Profile
              </h3>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Account Settings & Contact Information
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: "6px", borderRadius: "8px" }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "22px 24px" }}>
          
          {/* User Identity Card */}
          <div 
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div 
              style={{
                width: "48px",
                height: "48px",
                minWidth: "48px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)"
              }}
            >
              {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "AP"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.email}
              </div>
              <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span 
                  className="badge" 
                  style={{ 
                    fontSize: "0.68rem", 
                    padding: "2px 8px", 
                    background: "rgba(56, 189, 248, 0.15)", 
                    color: "#38bdf8", 
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    fontWeight: 700 
                  }}
                >
                  <Shield size={11} style={{ marginRight: "4px" }} />
                  {getRoleDisplayName(currentUser.role)}
                </span>
                {currentUser.territory && (
                  <span className="badge badge-secondary" style={{ fontSize: "0.68rem", padding: "2px 8px" }}>
                    📍 {currentUser.territory}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          {successMsg && (
            <div 
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: "0.82rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px"
              }}
            >
              <Check size={16} /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div 
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: "0.82rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px"
              }}
            >
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          {/* Phone Number Form */}
          <form onSubmit={handleSavePhone}>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label" style={{ fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <Phone size={14} style={{ color: "var(--primary)" }} /> Mobile / Phone Number
              </label>
              <div style={{ position: "relative" }}>
                <input 
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210 or +91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{
                    padding: "9px 12px 9px 38px",
                    fontSize: "0.9rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid var(--border-glass)"
                  }}
                />
                <Phone 
                  size={16} 
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)"
                  }}
                />
              </div>
              <small style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: "5px", display: "block" }}>
                Used by team members and logistics coordinators to reach you for urgent shipment and order updates.
              </small>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "22px" }}>
              {onChangePasswordClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onChangePasswordClick();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.78rem",
                    padding: "8px 12px"
                  }}
                >
                  <Key size={13} style={{ color: "var(--primary)" }} /> Change Password
                </button>
              )}

              <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: "8px 18px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {isSaving ? "Saving..." : <><Check size={14} /> Save Phone</>}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

/**
 * PhonePromptModal:
 * First-time prompt when user opens dashboard and phone number is missing.
 * Explicitly optional / non-compulsory with a "Skip for Now" option.
 */
export function PhonePromptModal({
  isOpen,
  onClose,
  currentUser,
  onSavePhone,
  onSkip
}) {
  useModalEscape(onSkip || onClose, isOpen);

  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg("Please enter your phone number, or click 'Skip for Now' below.");
      return;
    }
    setIsSaving(true);
    try {
      if (onSavePhone) {
        await onSavePhone(cleanPhone);
      }
      onClose();
    } catch (err) {
      setErrorMsg("Failed to save phone number. You can try again or skip.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipClick = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleSkipClick}
      style={{
        zIndex: 1300,
        backdropFilter: "blur(8px)",
        background: "rgba(15, 23, 42, 0.8)",
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div 
        className="glass-panel card-fade-in" 
        onClick={e => e.stopPropagation()}
        style={{
          width: "95vw",
          maxWidth: "460px",
          borderRadius: "18px",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)",
          overflow: "hidden",
          padding: 0,
          background: "var(--card-bg, #1e293b)"
        }}
      >
        {/* Glowing Top Banner */}
        <div 
          style={{
            padding: "24px 24px 16px 24px",
            textAlign: "center",
            background: "linear-gradient(180deg, rgba(56, 189, 248, 0.12), transparent)"
          }}
        >
          <div 
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #0284c7, #3b82f6)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 6px 18px rgba(37, 99, 235, 0.4)"
            }}
          >
            <PhoneCall size={28} />
          </div>

          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
            Add Your Phone Number
          </h3>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            Welcome, <strong>{currentUser.name}</strong>! Stay connected with your team and logistics coordinators for urgent purchase & shipment alerts.
          </p>
        </div>

        {/* Content & Input */}
        <div style={{ padding: "16px 24px 24px 24px" }}>
          
          {/* Reassurance Banner: Not compulsory, can skip */}
          <div 
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              fontSize: "0.78rem",
              color: "#38bdf8",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Sparkles size={15} style={{ flexShrink: 0 }} />
            <span>
              This is <strong>not compulsory</strong>. You can skip for now and add or update it anytime from your Profile.
            </span>
          </div>

          {errorMsg && (
            <div 
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: "0.8rem",
                marginBottom: "14px"
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                Mobile / Phone Number
              </label>
              <div style={{ position: "relative" }}>
                <input 
                  type="tel"
                  autoFocus
                  className="form-control"
                  placeholder="Enter 10-digit number (e.g. 9876543210)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{
                    padding: "10px 12px 10px 38px",
                    fontSize: "0.95rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    letterSpacing: "0.5px"
                  }}
                />
                <Phone 
                  size={16} 
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--primary)"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleSkipClick}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "0.85rem",
                  fontWeight: 600
                }}
              >
                Skip for Now
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary"
                style={{
                  flex: 1.4,
                  padding: "10px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {isSaving ? "Saving..." : <>Save & Continue <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
