import React, { useState, useMemo } from "react";
import { 
  X, 
  Package, 
  Building2, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle, 
  RotateCcw, 
  Eye, 
  CheckSquare, 
  Square, 
  Search, 
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Truck,
  Ship,
  Plane,
  Edit3
} from "lucide-react";
import { useModalEscape } from "../utils/useModalEscape";
import { getPurchaserDisplayName, formatPunchDateTime, calculateTotalCargoPrice } from "../utils/formatters";
import { getOrderStage } from "./MasterOrderTracker";

export default function GroupedOrderModal({
  orderGroup,
  requests = [],
  cargos = [],
  vendors = [],
  cargoCompanies = [],
  purchasers = [],
  currentUser = {},
  onClose,
  onBatchUpdateRequests,
  onInspectSingleOrder = null,
  onOpenDocument = null,
  onEditCargo = null
}) {
  useModalEscape(onClose);

  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("all"); // "all" | "pending" | "marked"
  const [modalCheckedIds, setModalCheckedIds] = useState([]);

  if (!orderGroup) return null;

  const isCargoGroup = orderGroup.groupType === "cargo";

  // Resolve live items from current requests state
  const liveItems = useMemo(() => {
    const groupItemIds = new Set((orderGroup.items || []).map(it => it.id));
    const matched = (requests || []).filter(r => groupItemIds.has(r.id));
    return matched.length > 0 ? matched : (orderGroup.items || []);
  }, [requests, orderGroup]);

  // Vendor & Purchaser Details
  const vendorObj = vendors.find(v => v.id === orderGroup.vendorId);
  const vendorName = vendorObj?.name || orderGroup.vendorName || "Unassigned Vendor";
  const purchaserName = orderGroup.purchaserName || "Unassigned Purchaser";
  const orderDate = orderGroup.orderDate || "No Date";

  // Financials and Aggregates
  const totalPcs = useMemo(() => {
    return liveItems.reduce((sum, r) => sum + (parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0), 0);
  }, [liveItems]);

  const totalRmb = useMemo(() => {
    return liveItems.reduce((sum, r) => {
      const q = parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0;
      const p = parseFloat(r.priceRmb) || 0;
      return sum + (q * p);
    }, 0);
  }, [liveItems]);

  const totalCartons = useMemo(() => {
    return liveItems.reduce((sum, r) => {
      const q = parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0;
      const ipc = parseInt(r.itemsPerCarton, 10);
      const ctns = r.totalCartons || (ipc > 0 ? Math.ceil(q / ipc) : 0);
      return sum + ctns;
    }, 0);
  }, [liveItems]);

  const markedItems = useMemo(() => liveItems.filter(r => r.purchaseUpdated === "Yes"), [liveItems]);
  const pendingItems = useMemo(() => liveItems.filter(r => r.purchaseUpdated !== "Yes"), [liveItems]);
  const markedCount = markedItems.length;
  const pendingCount = pendingItems.length;
  const isAllMarked = liveItems.length > 0 && markedCount === liveItems.length;

  // EDD summary
  const eddArr = useMemo(() => {
    return Array.from(new Set(liveItems.map(r => r.vendorEdd).filter(Boolean))).sort();
  }, [liveItems]);
  const eddDisplay = eddArr.length === 0 ? "—" : (eddArr.length === 1 ? eddArr[0] : `${eddArr[0]} ~ ${eddArr[eddArr.length - 1]}`);

  // Filtered items inside modal
  const filteredModalItems = useMemo(() => {
    return liveItems.filter(r => {
      if (modalStatusFilter === "pending" && r.purchaseUpdated === "Yes") return false;
      if (modalStatusFilter === "marked" && r.purchaseUpdated !== "Yes") return false;

      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const match = (
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.id && String(r.id).toLowerCase().includes(q)) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.cargoId && String(r.cargoId).toLowerCase().includes(q))
        );
        if (!match) return false;
      }
      return true;
    });
  }, [liveItems, modalStatusFilter, modalSearch]);

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setModalCheckedIds(filteredModalItems.map(it => it.id));
    } else {
      setModalCheckedIds([]);
    }
  };

  const handleToggleItem = (id) => {
    setModalCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Marking Actions
  const punchByName = currentUser?.name || "Mr. Rahul Mann";
  const punchById = currentUser?.id || "u-rahul";

  const handleMarkList = (itemsToUpdate, isMarked = true) => {
    if (!onBatchUpdateRequests || itemsToUpdate.length === 0) return;
    const now = new Date().toISOString();
    const updated = itemsToUpdate.map(r => ({
      ...r,
      purchaseUpdated: isMarked ? "Yes" : "No",
      purchaseUpdatedAt: isMarked ? now : "",
      purchaseUpdatedBy: isMarked ? punchByName : "",
      purchaseUpdatedById: isMarked ? punchById : ""
    }));
    onBatchUpdateRequests(updated);
    // Remove updated from checked IDs if needed
    setModalCheckedIds(prev => prev.filter(id => !itemsToUpdate.some(x => x.id === id)));
  };

  const handleMarkAllOrder = (isMarked = true) => {
    const targets = isMarked ? pendingItems : markedItems;
    handleMarkList(targets, isMarked);
  };

  const handleMarkSelected = (isMarked = true) => {
    const targets = liveItems.filter(r => modalCheckedIds.includes(r.id));
    handleMarkList(targets, isMarked);
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        zIndex: 1100, 
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
        className="glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: "96vw", 
          maxWidth: "1200px", 
          maxHeight: "92vh", 
          display: "flex", 
          flexDirection: "column", 
          padding: 0, 
          overflow: "hidden", 
          borderRadius: "16px", 
          border: "1px solid var(--border-glass)", 
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
          background: "var(--bg-card, #ffffff)",
          color: "var(--text-main, #0f172a)"
        }}
      >
        {/* ==================== HEADER ==================== */}
        <div 
          style={{ 
            padding: "18px 24px", 
            borderBottom: "1px solid var(--border-glass)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            background: isCargoGroup 
              ? "linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.06))"
              : "linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(99, 102, 241, 0.04))"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
            <div 
              style={{ 
                width: "46px", 
                height: "46px", 
                borderRadius: "12px", 
                background: isCargoGroup
                  ? "linear-gradient(135deg, #0284c7, #0d9488)"
                  : "linear-gradient(135deg, #0284c7, #2563eb)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "#fff",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                flexShrink: 0
              }}
            >
              {isCargoGroup ? (
                orderGroup.modeOfTransport?.toLowerCase().includes("air") ? <Plane size={24} /> :
                orderGroup.modeOfTransport?.toLowerCase().includes("road") ? <Truck size={24} /> :
                <Ship size={24} />
              ) : (
                <Package size={24} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
                  {isCargoGroup 
                    ? ((orderGroup.cargoDetail && !orderGroup.cargoDetail.startsWith("cargo-") ? orderGroup.cargoDetail : null) || 
                       (orderGroup.carrierName && orderGroup.carrierName !== "—" ? orderGroup.carrierName : null) || 
                       (orderGroup.vendorSummary ? `${orderGroup.vendorSummary} Cargo` : (orderGroup.cargoId ? `Cargo #${orderGroup.cargoId.slice(-6)}` : "Cargo Shipment")))
                    : vendorName}
                </h3>
                {isCargoGroup ? (
                  <>
                    {orderGroup.modeOfTransport && orderGroup.modeOfTransport !== "—" && (
                      <span className="badge badge-cargo" style={{ fontSize: "0.76rem" }}>
                        {orderGroup.modeOfTransport}
                      </span>
                    )}
                    {orderGroup.carrierName && orderGroup.carrierName !== "—" && (
                      <span className="badge badge-secondary" style={{ fontSize: "0.76rem" }}>
                        🚚 {orderGroup.carrierName}
                      </span>
                    )}
                    {orderGroup.cargoShippingDate && orderGroup.cargoShippingDate !== "—" && (
                      <span className="badge badge-cargo" style={{ fontSize: "0.76rem" }}>
                        🚢 Shipped: {orderGroup.cargoShippingDate}
                      </span>
                    )}
                    {orderGroup.cargoEta && orderGroup.cargoEta !== "—" && (
                      <span className="badge badge-secondary" style={{ fontSize: "0.76rem", color: "#38bdf8", fontWeight: 700 }}>
                        ⏱️ ETA: {orderGroup.cargoEta}
                      </span>
                    )}
                    {orderGroup.arrivalStatus && (
                      <span 
                        style={{ 
                          padding: "3px 8px", 
                          borderRadius: "6px", 
                          fontSize: "0.74rem", 
                          fontWeight: 700, 
                          background: orderGroup.arrivalStatus.bgColor, 
                          color: orderGroup.arrivalStatus.badgeColor, 
                          border: `1px solid ${orderGroup.arrivalStatus.borderColor}` 
                        }}
                      >
                        {orderGroup.arrivalStatus.label}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="badge badge-cargo" style={{ fontSize: "0.76rem" }}>
                    📅 Order Date: {orderDate}
                  </span>
                )}
                <span 
                  style={{ 
                    fontSize: "0.76rem", 
                    padding: "3px 10px", 
                    borderRadius: "6px", 
                    background: isAllMarked ? "rgba(16, 185, 129, 0.2)" : (markedCount > 0 ? "rgba(56, 189, 248, 0.2)" : "rgba(245, 158, 11, 0.2)"), 
                    color: isAllMarked ? "#10b981" : (markedCount > 0 ? "#38bdf8" : "#f59e0b"),
                    border: `1px solid ${isAllMarked ? "rgba(16, 185, 129, 0.4)" : (markedCount > 0 ? "rgba(56, 189, 248, 0.4)" : "rgba(245, 158, 11, 0.4)")}`,
                    fontWeight: 700 
                  }}
                >
                  {isAllMarked ? "✓ Fully Marked in Ledger" : (markedCount > 0 ? `⚡ ${markedCount}/${liveItems.length} Marked` : "⏳ Pending Mark in Ledger")}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                {isCargoGroup ? (
                  <>
                    <span>Vendors Included: <strong style={{ color: "var(--text-main)" }}>{orderGroup.vendorSummary || "—"}</strong></span>
                    <span>•</span>
                    <span>Purchasers: <strong style={{ color: "var(--primary)" }}>{orderGroup.purchaserSummary || purchaserName}</strong></span>
                    <span>•</span>
                    <span>Cargo Code: <code>{orderGroup.cargoId || "—"}</code></span>
                  </>
                ) : (
                  <>
                    <span>Purchaser: <strong style={{ color: "var(--primary)" }}>{purchaserName}</strong></span>
                    <span>•</span>
                    <span>Vendor EDD: <strong style={{ color: "#38bdf8" }}>{eddDisplay}</strong></span>
                    <span>•</span>
                    <span>Lot: <code>{orderGroup.groupKey}</code></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {isCargoGroup && onEditCargo && (orderGroup.cargoObj || orderGroup.cargoId) && (
              <button
                type="button"
                onClick={() => onEditCargo(orderGroup.cargoObj || { id: orderGroup.cargoId, cargoDetail: orderGroup.cargoDetail })}
                className="btn btn-warning btn-sm"
                style={{ padding: "6px 12px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}
                title="Edit Cargo Shipping Details, Carrier & Documents"
              >
                <Edit3 size={14} /> Edit Cargo Details
              </button>
            )}
            <button 
              onClick={onClose} 
              className="btn btn-secondary btn-sm"
              style={{ padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Close popup (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ==================== SUMMARY KPI STATS ==================== */}
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: isCargoGroup && (orderGroup.cargoFreightPrice > 0 || orderGroup.cargoObj) ? "repeat(auto-fit, minmax(150px, 1fr))" : "repeat(auto-fit, minmax(180px, 1fr))", 
            gap: "12px", 
            padding: "14px 24px", 
            background: "var(--bg-main, #f8fafc)", 
            borderBottom: "1px solid var(--border-glass, #cbd5e1)" 
          }}
        >
          {/* Models & Requisitions */}
          <div style={{ background: "var(--bg-card, #ffffff)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              {isCargoGroup ? "Cargo Lines / Items" : "Order Models / Lines"}
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
              {liveItems.length} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>Requisitions</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#38bdf8", marginTop: "2px" }}>
              {Array.from(new Set(liveItems.map(it => it.model))).length} Distinct Models
            </div>
          </div>

          {/* Total Quantity */}
          <div style={{ background: "var(--bg-card, #ffffff)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Total Quantity & Cartons
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>
              {totalPcs.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 600, marginTop: "2px" }}>
              📦 {(isCargoGroup && orderGroup.totalCartons ? orderGroup.totalCartons : totalCartons).toLocaleString()} Cartons
            </div>
          </div>

          {/* Total Goods RMB */}
          <div style={{ background: "var(--bg-card, #ffffff)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Goods RMB Total
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--warning, #b45309)", marginTop: "2px" }}>
              ¥{Math.round(totalRmb).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Avg: ¥{(totalPcs > 0 ? (totalRmb / totalPcs).toFixed(2) : "0.00")}/pc
            </div>
          </div>

          {/* Cargo Freight (if cargo group) */}
          {isCargoGroup && (orderGroup.cargoFreightPrice > 0 || orderGroup.cargoObj) && (
            <div style={{ background: "var(--bg-card, #ffffff)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Cargo Freight Price
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>
                ¥{Math.round(orderGroup.cargoFreightPrice || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Grand: <strong>¥{Math.round(totalRmb + (orderGroup.cargoFreightPrice || 0)).toLocaleString()}</strong>
              </div>
            </div>
          )}

          {/* Purchase Update Progress */}
          <div style={{ background: "var(--bg-card, #ffffff)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Ledger Punch Progress
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: isAllMarked ? "#10b981" : "#38bdf8", marginTop: "2px" }}>
              {markedCount} / {liveItems.length} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>Marked</span>
            </div>
            <div style={{ width: "100%", height: "4px", background: "var(--border-glass, rgba(148, 163, 184, 0.3))", borderRadius: "4px", marginTop: "6px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  width: `${(markedCount / (liveItems.length || 1)) * 100}%`, 
                  background: isAllMarked ? "#10b981" : "linear-gradient(90deg, #38bdf8, #818cf8)",
                  borderRadius: "4px",
                  transition: "width 0.3s ease"
                }} 
              />
            </div>
          </div>
        </div>

        {/* ==================== ACTION TOOLBAR ==================== */}
        <div 
          style={{ 
            padding: "12px 24px", 
            borderBottom: "1px solid var(--border-glass)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            gap: "12px", 
            flexWrap: "wrap",
            background: "var(--bg-card, #ffffff)"
          }}
        >
          {/* Left: Quick search & status filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search models in this order..." 
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                style={{ fontSize: "0.8rem", padding: "5px 10px 5px 30px", height: "34px" }}
              />
            </div>

            <div style={{ display: "inline-flex", borderRadius: "8px", border: "1px solid var(--border-glass)", overflow: "hidden" }}>
              <button 
                type="button"
                onClick={() => setModalStatusFilter("all")}
                className={`btn btn-sm ${modalStatusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "5px 10px", borderRadius: 0, height: "34px" }}
              >
                All ({liveItems.length})
              </button>
              <button 
                type="button"
                onClick={() => setModalStatusFilter("pending")}
                className={`btn btn-sm ${modalStatusFilter === "pending" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "5px 10px", borderRadius: 0, height: "34px", color: modalStatusFilter === "pending" ? "#fff" : "#f59e0b" }}
              >
                ⏳ Pending ({pendingCount})
              </button>
              <button 
                type="button"
                onClick={() => setModalStatusFilter("marked")}
                className={`btn btn-sm ${modalStatusFilter === "marked" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.75rem", padding: "5px 10px", borderRadius: 0, height: "34px", color: modalStatusFilter === "marked" ? "#fff" : "#10b981" }}
              >
                ✓ Marked ({markedCount})
              </button>
            </div>

            {modalCheckedIds.length > 0 && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Selected: <strong style={{ color: "var(--primary)" }}>{modalCheckedIds.length}</strong> items
              </span>
            )}
          </div>

          {/* Right: Group-wise and batch action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* If items selected via checkbox */}
            {modalCheckedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleMarkSelected(true)}
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", padding: "6px 14px", fontWeight: 700 }}
                >
                  <CheckCircle size={15} /> Mark Selected ({modalCheckedIds.length}) as Purchased
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkSelected(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", padding: "6px 12px", color: "#ef4444" }}
                >
                  <RotateCcw size={14} /> Revert Selected
                </button>
              </>
            )}

            {/* Whole order group action */}
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => handleMarkAllOrder(true)}
                className="btn btn-primary btn-sm"
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  fontSize: "0.8rem", 
                  padding: "7px 16px", 
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                }}
              >
                <CheckCircle size={15} /> ✓ Mark Entire Order ({pendingCount}) as Purchased
              </button>
            )}

            {markedCount > 0 && (
              <button
                type="button"
                onClick={() => handleMarkAllOrder(false)}
                className="btn btn-secondary btn-sm"
                style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  fontSize: "0.78rem", 
                  padding: "6px 12px",
                  color: "#ef4444",
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  background: "rgba(239, 68, 68, 0.1)"
                }}
                title="Undo marked purchase status for all items in this order"
              >
                <RotateCcw size={14} /> Revert Entire Order
              </button>
            )}
          </div>
        </div>

        {/* ==================== ITEMS TABLE ==================== */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
          <table className="custom-table" style={{ fontSize: "0.83rem", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: "42px", textAlign: "center" }}>
                  <input 
                    type="checkbox" 
                    className="checkbox-input"
                    checked={filteredModalItems.length > 0 && filteredModalItems.every(it => modalCheckedIds.includes(it.id))}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th style={{ width: "55px", textAlign: "center" }}>Inspect</th>
                <th>Model / Item</th>
                {isCargoGroup && <th>Vendor</th>}
                <th>Category</th>
                <th>Qty</th>
                <th>Price (¥)</th>
                <th>Total RMB (¥)</th>
                <th>Where Item Is Now</th>
                {!isCargoGroup && <th>Vendor EDD</th>}
                {!isCargoGroup && <th>Cargo / Transport</th>}
                <th>Purchase Status</th>
                <th style={{ textAlign: "center", width: "130px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredModalItems.map(r => {
                const isChecked = modalCheckedIds.includes(r.id);
                const isMarked = r.purchaseUpdated === "Yes";
                const cargo = cargos.find(c => c.id === r.cargoId || String(c.id) === String(r.cargoId));
                const stage = getOrderStage(r, cargo);
                const qty = parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0;
                const price = parseFloat(r.priceRmb) || 0;
                const totalRmbVal = qty * price;
                const ipc = parseInt(r.itemsPerCarton, 10);
                const ctns = r.totalCartons || (ipc > 0 ? Math.ceil(qty / ipc) : 0);

                return (
                  <tr key={r.id} className={isChecked ? "planner-row-selected" : ""}>
                    {/* Checkbox */}
                    <td style={{ textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        className="checkbox-input"
                        checked={isChecked}
                        onChange={() => handleToggleItem(r.id)}
                      />
                    </td>

                    {/* Inspect Button */}
                    <td style={{ textAlign: "center" }}>
                      {onInspectSingleOrder && (
                        <button
                          type="button"
                          onClick={() => onInspectSingleOrder(r)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "3px 6px", fontSize: "0.72rem" }}
                          title="View single item inspection & financials"
                        >
                          <Eye size={12} />
                        </button>
                      )}
                    </td>

                    {/* Model */}
                    <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                      <div>{r.model}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{r.id}</div>
                    </td>

                    {/* Vendor (when cargo group) */}
                    {isCargoGroup && (
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Building2 size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                          <span>{vendors.find(v => v.id === r.vendorId)?.name || r.vendorName || "—"}</span>
                        </div>
                      </td>
                    )}

                    {/* Category */}
                    <td>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        {r.category || "—"}
                      </span>
                    </td>

                    {/* Qty & Cartons */}
                    <td style={{ fontWeight: 700 }}>
                      <div>{qty.toLocaleString()} Pcs</div>
                      {(ipc > 0 || ctns > 0) && (
                        <div style={{ fontSize: "0.7rem", color: "#a855f7", fontWeight: 600 }}>
                          📦 {ctns} Ctns {ipc > 0 ? `(${ipc}/c)` : ""}
                        </div>
                      )}
                    </td>

                    {/* Price RMB */}
                    <td style={{ fontWeight: 600, color: "var(--warning, #b45309)" }}>
                      {price > 0 ? `¥${price.toFixed(2)}` : "—"}
                    </td>

                    {/* Total RMB */}
                    <td style={{ fontWeight: 800, color: "var(--warning, #b45309)" }}>
                      {totalRmbVal > 0 ? `¥${Math.round(totalRmbVal).toLocaleString()}` : "—"}
                    </td>

                    {/* Stage Badge */}
                    <td>
                      <span 
                        style={{ 
                          padding: "3px 8px", 
                          borderRadius: "6px", 
                          fontSize: "0.72rem", 
                          fontWeight: 700, 
                          background: stage.bgColor, 
                          color: stage.badgeColor, 
                          border: `1px solid ${stage.borderColor}`,
                          whiteSpace: "nowrap",
                          display: "inline-block"
                        }}
                      >
                        {stage.label}
                      </span>
                    </td>

                    {/* Vendor EDD (only when not cargo group) */}
                    {!isCargoGroup && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        {r.vendorEdd || "—"}
                      </td>
                    )}

                    {/* Cargo / Transport (only when not cargo group) */}
                    {!isCargoGroup && (
                      <td style={{ fontSize: "0.78rem" }}>
                        {cargo ? (
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--primary)" }}>
                              📦 {cargo.cargoDetail || `#${cargo.id}`}
                            </div>
                            {cargo.modeOfTransport && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                {cargo.modeOfTransport}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    )}

                    {/* Purchase Status */}
                    <td>
                      {isMarked ? (
                        <div>
                          <span 
                            style={{ 
                              padding: "2px 7px", 
                              borderRadius: "5px", 
                              fontSize: "0.72rem", 
                              fontWeight: 700, 
                              background: "rgba(16, 185, 129, 0.15)", 
                              color: "#10b981", 
                              border: "1px solid rgba(16, 185, 129, 0.3)" 
                            }}
                          >
                            ✓ Marked
                          </span>
                          {r.purchaseUpdatedAt && (
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                              {formatPunchDateTime(r.purchaseUpdatedAt)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span 
                          style={{ 
                            padding: "2px 7px", 
                            borderRadius: "5px", 
                            fontSize: "0.72rem", 
                            fontWeight: 700, 
                            background: "rgba(245, 158, 11, 0.15)", 
                            color: "#f59e0b", 
                            border: "1px solid rgba(245, 158, 11, 0.3)" 
                          }}
                        >
                          ⏳ Pending
                        </span>
                      )}
                    </td>

                    {/* Individual Action Button */}
                    <td style={{ textAlign: "center" }}>
                      {isMarked ? (
                        <button
                          type="button"
                          onClick={() => handleMarkList([r], false)}
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            padding: "3px 8px", 
                            fontSize: "0.72rem", 
                            color: "#ef4444", 
                            borderColor: "rgba(239, 68, 68, 0.3)",
                            background: "rgba(239, 68, 68, 0.08)"
                          }}
                          title="Undo marked purchase status"
                        >
                          <RotateCcw size={12} style={{ marginRight: "3px" }} /> Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkList([r], true)}
                          className="btn btn-primary btn-sm"
                          style={{ 
                            padding: "4px 10px", 
                            fontSize: "0.74rem", 
                            fontWeight: 700,
                            background: "#10b981",
                            borderColor: "#10b981"
                          }}
                          title="Mark this individual item as purchased"
                        >
                          <CheckCircle size={12} style={{ marginRight: "3px" }} /> Mark
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ==================== FOOTER ==================== */}
        <div 
          style={{ 
            padding: "14px 24px", 
            borderTop: "1px solid var(--border-glass)", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            background: "var(--bg-main, #f8fafc)",
            flexWrap: "wrap",
            gap: "10px"
          }}
        >
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Showing <strong>{filteredModalItems.length}</strong> of <strong>{liveItems.length}</strong> items • Total: <strong style={{ color: "var(--primary)" }}>{totalPcs.toLocaleString()} Pcs</strong> • Value: <strong style={{ color: "var(--warning, #b45309)" }}>¥{Math.round(totalRmb).toLocaleString()}</strong>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary"
            style={{ padding: "6px 20px", fontSize: "0.85rem" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
