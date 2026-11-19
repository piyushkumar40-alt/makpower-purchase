import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowRightLeft, 
  AlertTriangle, 
  Check, 
  ShieldAlert, 
  Users, 
  Package, 
  CheckCircle2, 
  Building2, 
  X, 
  GitMerge, 
  History 
} from "lucide-react";
import useModalEscape from "../utils/useModalEscape";

export default function VendorTransferModal({
  isOpen = true,
  vendor,
  initialSourcePurchaserId = null,
  vendors = [],
  requests = [],
  purchasers = [],
  currentUser,
  onConfirm,
  onTransfer,
  onClose
}) {
  useModalEscape(onClose, isOpen);

  if (!isOpen || !vendor) return null;

  // 1. Gather all orders belonging to this vendor
  const vendorRequests = useMemo(() => {
    return (requests || []).filter(r => r && r.vendorId === vendor.id && r.status !== "Cancelled");
  }, [requests, vendor.id]);

  // 2. Identify all purchasers who currently hold orders for this vendor
  const purchaserStats = useMemo(() => {
    const map = new Map();
    vendorRequests.forEach(r => {
      const pid = r.purchaserId || "unassigned";
      if (!map.has(pid)) {
        map.set(pid, { count: 0, qty: 0, models: new Set() });
      }
      const item = map.get(pid);
      item.count += 1;
      item.qty += Number(r.vendorOrderQuantity || r.orderQuantity || 0);
      if (r.model) item.models.add(r.model);
    });

    // Also include vendor.purchaserIds even if they have 0 orders yet
    (vendor.purchaserIds || []).forEach(pid => {
      if (!map.has(pid)) {
        map.set(pid, { count: 0, qty: 0, models: new Set() });
      }
    });

    return map;
  }, [vendorRequests, vendor.purchaserIds]);

  const sourcePurchaserOptions = useMemo(() => {
    const list = [];
    purchaserStats.forEach((stats, pid) => {
      const p = (purchasers || []).find(u => u.id === pid);
      const name = p ? p.name : (pid === "unassigned" ? "Unassigned Purchaser" : pid);
      const modelsList = Array.from(stats.models).slice(0, 3).join(", ");
      list.push({
        id: pid,
        name,
        count: stats.count,
        qty: stats.qty,
        summary: stats.count > 0 
          ? `${name} (${stats.count} Order${stats.count > 1 ? "s" : ""}, ${stats.qty.toLocaleString()} Pcs${modelsList ? `: ${modelsList}` : ""})`
          : `${name} (0 Orders)`
      });
    });
    return list;
  }, [purchaserStats, purchasers]);

  // Determine initial source purchaser
  const defaultSourceId = useMemo(() => {
    if (initialSourcePurchaserId && purchaserStats.has(initialSourcePurchaserId)) {
      return initialSourcePurchaserId;
    }
    if (sourcePurchaserOptions.length === 1) {
      return sourcePurchaserOptions[0].id;
    }
    // Pick the one with orders first
    const withOrders = sourcePurchaserOptions.find(o => o.count > 0);
    return withOrders ? withOrders.id : (sourcePurchaserOptions[0]?.id || "all");
  }, [initialSourcePurchaserId, purchaserStats, sourcePurchaserOptions]);

  const [sourcePurchaserId, setSourcePurchaserId] = useState(defaultSourceId);
  const [targetPurchaserId, setTargetPurchaserId] = useState("");
  const [action, setAction] = useState("merge"); // "merge" | "transfer"
  const [mergeNotes, setMergeNotes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter available target purchasers (exclude current selected source)
  const availableTargetPurchasers = useMemo(() => {
    return (purchasers || []).filter(p => {
      if (!p || !p.id) return false;
      if (sourcePurchaserId !== "all" && p.id === sourcePurchaserId) return false;
      return true;
    });
  }, [purchasers, sourcePurchaserId]);

  // Auto-select first available target purchaser
  useEffect(() => {
    if (availableTargetPurchasers.length > 0) {
      if (!targetPurchaserId || targetPurchaserId === sourcePurchaserId) {
        setTargetPurchaserId(availableTargetPurchasers[0].id);
      }
    }
  }, [availableTargetPurchasers, sourcePurchaserId, targetPurchaserId]);

  // 3. Duplicate / Existing vendor detection in Target Purchaser
  const targetExistingVendor = useMemo(() => {
    if (!targetPurchaserId) return null;
    const cleanCurrentName = (vendor.name || "").trim().toLowerCase();

    // Check for another vendor record with same name
    const matchingNamedVendor = (vendors || []).find(v => {
      if (v.id === vendor.id) return false;
      const vName = (v.name || "").trim().toLowerCase();
      if (vName !== cleanCurrentName) return false;
      const assigned = Array.isArray(v.purchaserIds) && v.purchaserIds.includes(targetPurchaserId);
      const hasRequests = requests.some(r => r.vendorId === v.id && r.purchaserId === targetPurchaserId);
      return assigned || hasRequests;
    });

    if (matchingNamedVendor) return matchingNamedVendor;

    // Also check if current vendor record is already assigned to target purchaser
    const isCurrentAlreadyAssigned = Array.isArray(vendor.purchaserIds) && vendor.purchaserIds.includes(targetPurchaserId);
    const hasTargetRequests = requests.some(r => r.vendorId === vendor.id && r.purchaserId === targetPurchaserId);
    if (isCurrentAlreadyAssigned || hasTargetRequests) {
      return vendor; // Same vendor record already shared
    }

    return null;
  }, [vendors, vendor, targetPurchaserId, requests]);

  // 4. Calculate affected requests
  const affectedRequests = useMemo(() => {
    return vendorRequests.filter(r => {
      if (!sourcePurchaserId || sourcePurchaserId === "all") return true;
      return r.purchaserId === sourcePurchaserId;
    });
  }, [vendorRequests, sourcePurchaserId]);

  const totalAffectedQty = useMemo(() => {
    return affectedRequests.reduce((sum, r) => sum + (Number(r.vendorOrderQuantity || r.orderQuantity) || 0), 0);
  }, [affectedRequests]);

  const affectedModelsSummary = useMemo(() => {
    const set = new Set();
    affectedRequests.forEach(r => { if (r.model) set.add(r.model); });
    const arr = Array.from(set);
    if (arr.length <= 4) return arr.join(", ");
    return `${arr.slice(0, 4).join(", ")} +${arr.length - 4} more`;
  }, [affectedRequests]);

  const targetPurchaserName = useMemo(() => {
    const p = (purchasers || []).find(u => u.id === targetPurchaserId);
    return p ? p.name : "Selected Purchaser";
  }, [purchasers, targetPurchaserId]);

  const sourcePurchaserName = useMemo(() => {
    if (sourcePurchaserId === "all") return "All Purchasers";
    const p = (purchasers || []).find(u => u.id === sourcePurchaserId);
    return p ? p.name : sourcePurchaserId;
  }, [purchasers, sourcePurchaserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!targetPurchaserId) {
      setError("Please select a target destination purchaser.");
      return;
    }
    if (sourcePurchaserId !== "all" && sourcePurchaserId === targetPurchaserId) {
      setError("Source and destination purchaser cannot be the same.");
      return;
    }

    setIsSubmitting(true);
    try {
      const willMerge = Boolean(targetExistingVendor && action === "merge");
      const targetVId = (willMerge && targetExistingVendor) ? targetExistingVendor.id : vendor.id;

      const transferFn = onConfirm || onTransfer;
      if (!transferFn) {
        throw new Error("No transfer callback provided.");
      }

      const res = await transferFn({
        sourceVendorId: vendor.id,
        sourcePurchaserId: sourcePurchaserId === "all" ? null : sourcePurchaserId,
        targetPurchaserId,
        action: willMerge ? "merge" : "transfer",
        targetVendorId: targetVId,
        mergeNotes
      });

      if (res && res.success !== false) {
        setSuccess(res.message || "Vendor and orders transferred successfully!");
        setTimeout(() => {
          onClose();
        }, 1100);
      } else {
        setError(res?.message || "Failed to transfer vendor.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred during transfer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div 
        className="glass-panel modal-content" 
        style={{ 
          maxWidth: "600px", 
          width: "95%", 
          border: "1px solid rgba(56, 189, 248, 0.35)", 
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          maxHeight: "92vh",
          overflowY: "auto"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "18px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)", fontWeight: 700 }}>
                Transfer / Merge Vendor
              </h3>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Admin Tool: Reassign vendor, orders, and history across purchasers
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: "4px 8px", borderRadius: "50%", minWidth: "32px", height: "32px" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Vendor Identity Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "12px 16px", marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={18} style={{ color: "var(--primary)" }} />
              <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>{vendor.name}</strong>
              {vendor.location && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>📍 {vendor.location}</span>}
            </div>
            <span className="badge badge-secondary" style={{ fontSize: "0.78rem" }}>
              📦 {vendorRequests.length} Total Orders ({vendorRequests.reduce((s, r) => s + Number(r.vendorOrderQuantity || r.orderQuantity || 0), 0).toLocaleString()} Pcs)
            </span>
          </div>
          {vendor.phone && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
              📞 {vendor.phone}
            </div>
          )}
        </div>

        {error && (
          <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="alert-strip alert-success" style={{ marginBottom: "16px" }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* 1. Source Purchaser Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
              1. Transfer From (Source Purchaser):
            </label>
            <select
              className="form-control"
              value={sourcePurchaserId}
              onChange={e => setSourcePurchaserId(e.target.value)}
              required
            >
              {sourcePurchaserOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.summary}
                </option>
              ))}
              {sourcePurchaserOptions.length > 1 && (
                <option value="all">
                  🌐 All Purchasers (Transfer vendor & ALL orders entirely)
                </option>
              )}
            </select>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Selected source holds: <strong>{affectedRequests.length} Order(s)</strong> ({totalAffectedQty.toLocaleString()} Pcs)
            </span>
          </div>

          {/* 2. Destination Purchaser Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
              2. Transfer To (Destination Purchaser):
            </label>
            <select
              className="form-control"
              value={targetPurchaserId}
              onChange={e => setTargetPurchaserId(e.target.value)}
              required
            >
              <option value="">-- Choose Target Purchaser --</option>
              {availableTargetPurchasers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role === "purchase_manager" ? "Purchase Manager" : "Purchaser"})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Merge Detection & Action Choice */}
          {targetPurchaserId && (
            <div style={{ marginTop: "4px" }}>
              {targetExistingVendor ? (
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "8px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: "#fbbf24" }}>
                    <GitMerge size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <strong style={{ fontSize: "0.95rem" }}>
                        Duplicate Vendor Detected in {targetPurchaserName}!
                      </strong>
                      <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                        A vendor named <strong>"{targetExistingVendor.name}"</strong> is already created or assigned under <strong>{targetPurchaserName}</strong>.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", paddingLeft: "30px" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                      <input 
                        type="radio" 
                        name="vendorAction" 
                        value="merge" 
                        checked={action === "merge"} 
                        onChange={() => setAction("merge")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <strong style={{ color: "var(--success)" }}>Merge with existing vendor (Recommended)</strong>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Consolidates all {affectedRequests.length} orders into {targetPurchaserName}'s existing vendor "{targetExistingVendor.name}". Merges notes/history and removes duplicate vendor record.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
                      <input 
                        type="radio" 
                        name="vendorAction" 
                        value="transfer" 
                        checked={action === "transfer"} 
                        onChange={() => setAction("transfer")}
                        style={{ marginTop: "3px" }}
                      />
                      <div>
                        <strong>Transfer without merging</strong>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Keeps vendor separate and reassigns orders to {targetPurchaserName}.
                        </div>
                      </div>
                    </label>
                  </div>

                  {action === "merge" && (
                    <div style={{ paddingLeft: "30px", marginTop: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={mergeNotes} 
                          onChange={e => setMergeNotes(e.target.checked)} 
                        />
                        <span>Append contact notes & history into target vendor record</span>
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px", padding: "12px 14px", display: "flex", gap: "10px", alignItems: "center", color: "var(--success)" }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
                    Vendor <strong>"{vendor.name}"</strong> does not yet exist under <strong>{targetPurchaserName}</strong>. It will be assigned directly.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 4. Impact Preview Card */}
          <div style={{ background: "var(--bg-card, rgba(30, 41, 59, 0.5))", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "14px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)" }}>
              📊 Transfer Impact Summary
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", textAlign: "center", marginBottom: "10px" }}>
              <div style={{ padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)" }}>{affectedRequests.length}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Orders Moving</div>
              </div>
              <div style={{ padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-main)" }}>{totalAffectedQty.toLocaleString()}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Total Pcs</div>
              </div>
              <div style={{ padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: action === "merge" && targetExistingVendor ? "var(--warning)" : "var(--success)", paddingTop: "4px" }}>
                  {action === "merge" && targetExistingVendor ? "Merge" : "Transfer"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Action Mode</div>
              </div>
            </div>

            {affectedRequests.length > 0 ? (
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><strong>Models included:</strong> {affectedModelsSummary}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success)", marginTop: "4px" }}>
                  <Check size={13} />
                  <span>All pricing, cargos, milestone dates, EDD revisions, and order notes will remain 100% intact.</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>
                No active orders for this source purchaser. Only vendor access will be assigned.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
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
              className={`btn ${action === "merge" && targetExistingVendor ? "btn-warning" : "btn-primary"}`}
              style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "8px" }}
              disabled={isSubmitting || !targetPurchaserId}
            >
              {isSubmitting ? (
                <>Processing Transfer...</>
              ) : action === "merge" && targetExistingVendor ? (
                <><GitMerge size={16} /> Confirm Transfer & Merge</>
              ) : (
                <><ArrowRightLeft size={16} /> Confirm Transfer</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
