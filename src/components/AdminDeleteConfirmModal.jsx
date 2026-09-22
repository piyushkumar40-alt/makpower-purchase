import React, { useState } from "react";
import useModalEscape from "../utils/useModalEscape";
import { Trash2 } from "lucide-react";

/**
 * Admin Permanent Delete Confirmation Modal
 * Reusable modal for confirming permanent deletion of purchase orders.
 */
export function AdminDeleteConfirmModal({ confirmData, onClose, onConfirm }) {
  useModalEscape(onClose);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!confirmData) return null;

  const { title, description, requestIds = [], orderDate, targets = [] } = confirmData;
  const count = requestIds.length || targets.length;
  const totalQty = targets.reduce((sum, r) => sum + parseInt(r.vendorOrderQuantity || r.orderQuantity || 0, 10), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "560px", width: "95%", border: "1px solid rgba(239, 68, 68, 0.4)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(239, 68, 68, 0.2)", paddingBottom: "14px", marginBottom: "16px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
            <Trash2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#f87171", fontWeight: 700 }}>
              {title || "Confirm Permanent Order Deletion"}
            </h3>
            <p style={{ margin: "3px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Admin Action • Irreversible Operation
            </p>
          </div>
        </div>

        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5 }}>
            {description}
          </p>
        </div>

        {/* Order Details Summary */}
        <div style={{ background: "var(--bg-card, rgba(30, 41, 59, 0.5))", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", border: "1px solid var(--border-glass)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: targets.length > 0 ? "10px" : 0 }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Orders to Delete</span>
              <strong style={{ fontSize: "1.1rem", color: "#f87171" }}>{count} Order{count !== 1 ? "s" : ""}</strong>
            </div>
            {totalQty > 0 && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total Quantity</span>
                <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>{totalQty.toLocaleString()} Pcs</strong>
              </div>
            )}
            {orderDate && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Order Date</span>
                <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>{orderDate}</strong>
              </div>
            )}
          </div>

          {targets.length > 0 && (
            <div style={{ marginTop: "10px", borderTop: "1px solid var(--border-glass)", paddingTop: "8px" }}>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Target Items:</span>
              <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {targets.slice(0, 15).map(t => (
                  <span key={t.id} style={{ fontSize: "0.75rem", background: "rgba(255, 255, 255, 0.06)", padding: "3px 8px", borderRadius: "4px", border: "1px solid var(--border-glass)" }}>
                    {t.model} ({t.vendorOrderQuantity || t.orderQuantity} Pcs)
                  </span>
                ))}
                {targets.length > 15 && (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "3px 6px" }}>
                    +{targets.length - 15} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "18px" }}>
            <label className="form-label" style={{ fontSize: "0.82rem" }}>
              Reason for Deletion (Optional):
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Uploaded by mistake, duplicate entry, customer cancelled..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={isSubmitting}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "#ef4444", fontWeight: 700 }}
            >
              {isSubmitting ? (
                <>Deleting...</>
              ) : (
                <>
                  <Trash2 size={15} /> Yes, Permanently Delete
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminDeleteConfirmModal;
