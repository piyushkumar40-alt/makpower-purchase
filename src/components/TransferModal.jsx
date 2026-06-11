import React, { useState } from "react";
import { AlertTriangle, UserMinus, ShieldAlert, Check } from "lucide-react";

export default function TransferModal({ purchaser, activeUsers, requests, vendors, onClose, onConfirm }) {
  const [transferDestId, setTransferDestId] = useState("");

  // Calculate statistics of the departing purchaser
  const assignedRequests = requests.filter(r => r.purchaserId === purchaser.id);
  const activeRequestsCount = assignedRequests.filter(r => r.isMaterialRec !== "Yes").length;
  const completedRequestsCount = assignedRequests.filter(r => r.isMaterialRec === "Yes").length;
  const assignedVendorsCount = vendors.filter(v => v.purchaserId === purchaser.id).length;

  // Destination options: other active purchasers or the Super Admin
  const potentialDestinations = activeUsers.filter(u => u.id !== purchaser.id);

  // Set default selection to the first available user
  React.useEffect(() => {
    if (potentialDestinations.length > 0 && !transferDestId) {
      setTransferDestId(potentialDestinations[0].id);
    }
  }, [potentialDestinations, transferDestId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!transferDestId) return;
    onConfirm(purchaser.id, transferDestId);
  };

  const getRecipientName = () => {
    const dest = activeUsers.find(u => u.id === transferDestId);
    return dest ? dest.name : "Selected User";
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "550px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px", color: "var(--danger)" }}>
          <div style={{ display: "flex", padding: "10px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "10px" }}>
            <UserMinus size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.4rem", color: "var(--text-main)" }}>Deactivate Purchaser</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Safe Offboarding & History Transfer</p>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="alert-strip alert-warning" style={{ marginBottom: "20px" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>
            You are deactivating <strong>{purchaser.name}</strong>. Their account will be locked, but their purchase history and vendors must be preserved.
          </span>
        </div>

        {/* Workload Summary */}
        <div className="glass-panel" style={{ padding: "18px", background: "rgba(0, 0, 0, 0.2)", marginBottom: "24px" }}>
          <h4 style={{ fontSize: "0.9rem", color: "var(--primary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Current Workload Summary
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", textAlign: "center" }}>
            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--warning)" }}>{activeRequestsCount}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active Orders</div>
            </div>
            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>{completedRequestsCount}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Completed logs</div>
            </div>
            <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)" }}>{assignedVendorsCount}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Vendors Owned</div>
            </div>
          </div>
        </div>

        {/* Transfer form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Transfer History and Vendors to:</label>
            <select 
              className="form-control" 
              value={transferDestId} 
              onChange={e => setTransferDestId(e.target.value)}
              required
            >
              {potentialDestinations.map(u => (
                <option key={u.id} value={u.id} style={{ background: "#0f172a" }}>
                  {u.name} ({u.role === "superadmin" ? "Super Admin - Hold Data" : `Purchaser - ${u.email}`})
                </option>
              ))}
            </select>
          </div>

          <div className="alert-strip alert-danger" style={{ marginBottom: "24px", fontSize: "0.85rem" }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Crucial:</strong> All {activeRequestsCount + completedRequestsCount} purchase requests and {assignedVendorsCount} vendor accounts will be remapped to <strong>{getRecipientName()}</strong> immediately.
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              <Check size={16} /> Complete Transfer & Lock Account
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
