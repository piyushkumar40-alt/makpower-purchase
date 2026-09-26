import React, { useState } from "react";
import { Calendar, AlertTriangle, Clock, CheckCircle2, History, X, Save, ArrowRight, User } from "lucide-react";
import { useModalEscape } from "../utils/useModalEscape";

export default function AddEddModal({
  isOpen,
  onClose,
  type = "vendor", // "vendor" or "cargo"
  item,
  items = [],
  currentUser,
  onSave
}) {
  useModalEscape(onClose, isOpen);

  const effectiveItems = Array.isArray(items) && items.length > 0 
    ? items 
    : (item ? [item] : []);
  const isBatch = effectiveItems.length > 1;
  const primaryItem = effectiveItems[0] || null;

  const isVendor = type === "vendor";
  const allSameDate = effectiveItems.length > 0 && effectiveItems.every(x => 
    (isVendor ? (x?.vendorEdd || "") : (x?.cargoEta || "")) === 
    (isVendor ? (primaryItem?.vendorEdd || "") : (primaryItem?.cargoEta || ""))
  );
  const currentDate = allSameDate 
    ? (isVendor ? (primaryItem?.vendorEdd || "") : (primaryItem?.cargoEta || ""))
    : "";

  const historyList = isVendor ? (primaryItem?.vendorEddHistory || []) : (primaryItem?.cargoEtaHistory || []);
  const safeHistory = Array.isArray(historyList)
    ? historyList
    : (() => {
        try {
          return JSON.parse(historyList || "[]");
        } catch (e) {
          return [];
        }
      })();

  const totalBatchRevs = effectiveItems.reduce((acc, itm) => {
    const h = isVendor ? (itm?.vendorEddHistory || []) : (itm?.cargoEtaHistory || []);
    const list = Array.isArray(h) ? h : (() => { try { return JSON.parse(h || "[]"); } catch (e) { return []; } })();
    return acc + list.length;
  }, 0);

  const [newDate, setNewDate] = useState("");
  const [reasonPreset, setReasonPreset] = useState("");
  const [reasonCustom, setReasonCustom] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen || effectiveItems.length === 0) return null;

  const hasExistingDate = Boolean(currentDate);

  const vendorPresets = [
    "Vendor confirmed production timeline",
    "Initial vendor delivery commitment",
    "Vendor postponed commitment",
    "Factory production delay",
    "Raw material shortage",
    "Supplier component backlog",
    "Quality test / re-inspection required",
    "Mold / tooling maintenance",
    "Packaging delay",
    "Advance delivery / ready early",
    "Vendor revised readiness date",
    "Other custom reason"
  ];

  const cargoPresets = [
    "Vessel / flight departure postponed",
    "Port congestion / container dwell delay",
    "Customs inspection / clearance hold",
    "Transshipment hub delay",
    "Adverse weather / route disruption",
    "Freight forwarder rescheduling",
    "Other custom reason"
  ];

  const presets = isVendor ? vendorPresets : cargoPresets;

  // Calculate difference
  let diffDays = 0;
  if (currentDate && newDate) {
    const d1 = new Date(currentDate);
    const d2 = new Date(newDate);
    if (!isNaN(d1) && !isNaN(d2)) {
      diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    }
  }

  const effectiveReason = reasonPreset === "Other custom reason"
    ? reasonCustom.trim()
    : (reasonPreset || reasonCustom.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newDate) {
      setError("Please select a new date.");
      return;
    }

    if (!isBatch && currentDate && newDate === currentDate) {
      setError("The selected date is the same as the current date.");
      return;
    }

    if (!effectiveReason) {
      setError("Please provide a reason for revising this delivery commitment.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isBatch) {
        await onSave({
          itemIds: effectiveItems.map(x => x.id),
          itemId: primaryItem.id,
          newDate,
          reason: effectiveReason,
          diffDays: diffDays > 0 ? diffDays : 0,
          changedBy: currentUser?.name || currentUser?.id || "Staff",
          type
        });
        setSuccess(`New EDD saved and impact recorded successfully for ${effectiveItems.length} orders!`);
      } else {
        await onSave({
          itemId: primaryItem.id,
          newDate,
          reason: effectiveReason,
          diffDays: diffDays > 0 ? diffDays : 0,
          changedBy: currentUser?.name || currentUser?.id || "Staff",
          type
        });
        setSuccess("New EDD saved and impact recorded successfully!");
      }
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 900);
    } catch (err) {
      setIsSubmitting(false);
      setError(err?.message || "Failed to update date. Please try again.");
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div 
        className="glass-panel modal-content" 
        style={{ 
          maxWidth: "600px", 
          width: "95%", 
          maxHeight: "90vh", 
          overflowY: "auto", 
          padding: "24px",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.6)"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={20} />
              {isBatch 
                ? (isVendor ? `Update Vendor EDD (${effectiveItems.length} Orders Selected)` : `Update Cargo ETA (${effectiveItems.length} Shipments)`)
                : (isVendor ? "Add / Revise Vendor EDD" : "Add / Revise Cargo ETA")}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {isBatch 
                ? `Selected: ${effectiveItems.map(x => x.model || x.cargoDetail || "Item").slice(0, 4).join(", ")}${effectiveItems.length > 4 ? ` + ${effectiveItems.length - 4} more` : ""}`
                : (isVendor 
                    ? `Item: ${primaryItem?.model || "PO Item"} (#${primaryItem?.id})`
                    : `Shipment: ${primaryItem?.cargoDetail || "Cargo Shipment"} (#${primaryItem?.id})`)}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}
        {success && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{success}</div>}

        {/* Current State Indicator */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
          <div className="glass-panel" style={{ padding: "12px", background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              {isBatch && !allSameDate ? "Current Status" : "Current Committed Date"}
            </span>
            <div style={{ fontSize: isBatch && !allSameDate ? "0.95rem" : "1.2rem", fontWeight: 800, color: currentDate ? "#fff" : "var(--text-muted)", marginTop: "4px" }}>
              {isBatch && !allSameDate
                ? `Various Dates (${effectiveItems.filter(x => isVendor ? x.vendorEdd : x.cargoEta).length} set)`
                : (currentDate || "Not Set")}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "12px", background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Revision History
            </span>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: (isBatch ? totalBatchRevs : safeHistory.length) > 0 ? "#f59e0b" : "var(--success)", marginTop: "4px" }}>
              {isBatch 
                ? (totalBatchRevs === 0 ? "0 Prior Revisions" : `${totalBatchRevs} Prior Revisions`)
                : (safeHistory.length === 0 ? "0 Revisions (Original)" : `${safeHistory.length} Revision(s)`)}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>New {isVendor ? "Vendor Expected Date (EDD)" : "Cargo Arrival ETA"} *</span>
              {currentDate && newDate && (
                <span style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 700, 
                  color: diffDays > 0 ? "var(--danger)" : diffDays < 0 ? "var(--success)" : "var(--text-muted)" 
                }}>
                  {diffDays > 0 && `⚠️ Postponed by +${diffDays} days (Bad Impact)`}
                  {diffDays < 0 && `✓ Advanced earlier by ${Math.abs(diffDays)} days`}
                  {diffDays === 0 && `Same date`}
                </span>
              )}
            </label>
            <input 
              type="date"
              className="form-control"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              required
              style={{ fontSize: "1rem", padding: "8px 12px" }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Reason for New EDD / Postponement *</label>
            <select
              className="form-control"
              value={reasonPreset}
              onChange={e => setReasonPreset(e.target.value)}
              required
              style={{ marginBottom: reasonPreset === "Other custom reason" ? "8px" : "0" }}
            >
              <option value="">Select reason...</option>
              {presets.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {reasonPreset === "Other custom reason" && (
              <input 
                type="text"
                className="form-control"
                placeholder="Type specific reason here..."
                value={reasonCustom}
                onChange={e => setReasonCustom(e.target.value)}
                required
              />
            )}
          </div>

          {/* Bad Impact Notice */}
          {diffDays > 0 && (
            <div style={{ 
              background: "rgba(239, 68, 68, 0.1)", 
              border: "1px solid rgba(239, 68, 68, 0.3)", 
              padding: "10px 14px", 
              borderRadius: "8px", 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              fontSize: "0.82rem",
              color: "#fca5a5"
            }}>
              <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
              <div>
                <strong>Performance & Bad Impact Notice:</strong> Postponing this date will increment the {isVendor ? "vendor's" : "cargo's"} revision count and record a <strong>+{diffDays} days</strong> delivery penalty in performance reports.
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting || !newDate}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}
            >
              <Save size={16} />
              {isSubmitting ? "Saving..." : "Save New Date"}
            </button>
          </div>
        </form>

        {/* Batch Selected Items List */}
        {isBatch && (
          <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-glass)", paddingTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", color: "#38bdf8", fontSize: "0.88rem", fontWeight: 700 }}>
              <Calendar size={15} />
              <span>Target Orders to Update ({effectiveItems.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
              {effectiveItems.map((itm, idx) => (
                <div 
                  key={itm.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-glass)",
                    borderRadius: "6px",
                    fontSize: "0.78rem"
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {itm.model || itm.cargoDetail || "Item"} <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>(#{itm.id})</span>
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    Current: <strong style={{ color: (isVendor ? itm.vendorEdd : itm.cargoEta) ? "#38bdf8" : "var(--text-muted)" }}>{(isVendor ? itm.vendorEdd : itm.cargoEta) || "Not Set"}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Revision History Timeline for Single Item */}
        {!isBatch && safeHistory.length > 0 && (
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-glass)", paddingTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", color: "#38bdf8", fontSize: "0.9rem", fontWeight: 700 }}>
              <History size={16} />
              <span>Prior Revision Timeline ({safeHistory.length})</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
              {safeHistory.map((rev, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: "8px 12px", 
                    borderRadius: "6px", 
                    background: "rgba(255,255,255,0.03)", 
                    border: "1px solid var(--border-glass)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Rev #{idx + 1}:</span>
                      {rev.previousEdd || rev.previousEta ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--text-muted)" }}>
                            {rev.previousEdd || rev.previousEta}
                          </span>
                          <ArrowRight size={12} />
                        </>
                      ) : null}
                      <span style={{ color: "#38bdf8" }}>{rev.edd || rev.eta}</span>
                      {rev.postponedDays > 0 && (
                        <span style={{ color: "var(--danger)", fontSize: "0.75rem", fontWeight: 800 }}>
                          (+{rev.postponedDays}d slip)
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                      Reason: <em>"{rev.reason || "Rescheduled"}"</em>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <div>{rev.changedBy || "Staff"}</div>
                    <div>{rev.changedAt ? rev.changedAt.split("T")[0] : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
