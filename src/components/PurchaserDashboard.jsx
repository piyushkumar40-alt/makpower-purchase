import React, { useState } from "react";
import { AlertTriangle, Clock, Plus, HelpCircle, Upload, Eye, FileText, CheckCircle2, ChevronRight, ChevronDown, Check, Edit3, ArrowRight, Truck, XCircle, Ban, RotateCcw } from "lucide-react";
import AnalyticsPanel from "./AnalyticsPanel";

export default function PurchaserDashboard({
  currentUser,
  requests,
  vendors,
  cargos,
  cargoCompanies = [],
  purchasers,
  onUpdateRequest,
  onCancelOrder,
  onUndoCargoAssignment,
  onUndoPricing,
  onAddCargo,
  onUpdateCargo,
  onAddVendor,
  onUpdateVendor,
  onRemoveVendor,
  onAddCargoCompany,
  onUpdateCargoCompany,
  onRemoveCargoCompany
}) {
  const [activeTab, setActiveTab] = useState("alerts"); // "alerts" | "pending" | "planner" | "shipments" | "all" | "cancelled" | "vendors" | "cargocompanies"
  
  // Modals state
  const [editingRequest, setEditingRequest] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [creatingCargo, setCreatingCargo] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState(null);
  const [selectedCargoCompanyForDetail, setSelectedCargoCompanyForDetail] = useState(null);
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [receivingCargo, setReceivingCargo] = useState(null); // cargo awaiting receive date
  // Vendor-ready bulk selection
  const [vrFilter, setVrFilter] = useState("");        // vendor filter for vendor-ready tab
  const [vrChecked, setVrChecked] = useState([]);     // checked request ids
  const [vrDate, setVrDate] = useState(new Date().toISOString().split("T")[0]);
  // Cargo-pickup bulk selection
  const [cpFilter, setCpFilter] = useState("");        // vendor filter for cargo-pickup tab
  const [cpChecked, setCpChecked] = useState([]);     // checked request ids
  const [cpDate, setCpDate] = useState(new Date().toISOString().split("T")[0]); // request to cancel

  // Form states for cargo planner
  const [plannerVendorId, setPlannerVendorId] = useState("");
  const [checkedRequestIds, setCheckedRequestIds] = useState([]);

  // Filter requests based on user role (Admin sees all, Purchaser sees their own)
  const isSearchAdmin = currentUser.role === "superadmin";
  const allMyRequests = isSearchAdmin ? requests : requests.filter(r => r.purchaserId === currentUser.id);
  // Active requests (not cancelled)
  const myRequests = allMyRequests.filter(r => r.status !== "Cancelled");
  // Cancelled requests
  const cancelledRequests = allMyRequests.filter(r => r.status === "Cancelled");
  const myCargos = cargos; // Keep it simple, let them manage all cargos or let admin override

  // Calculate today's date for alerts
  const todayStr = "2026-06-11"; // Mock system date
  const today = new Date(todayStr);

  // Helper: check due status for pricing items
  const getEddAlertStatus = (r) => {
    if (!r.vendorEdd || r.isMaterialRec === "Yes" || r.cargoId) return null;
    const edd = new Date(r.vendorEdd);
    const diffTime = edd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "OVERDUE", type: "danger", days: Math.abs(diffDays) };
    if (diffDays <= 3) return { label: "DUE SOON", type: "warning", days: diffDays };
    return null;
  };

  // Helper: check cargo ETA status
  const getEtaAlertStatus = (c) => {
    if (!c.cargoEta || c.isMaterialRec === "Yes") return null;
    const eta = new Date(c.cargoEta);
    const diffTime = eta - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "CARGO OVERDUE", type: "danger", days: Math.abs(diffDays) };
    if (diffDays <= 3) return { label: "CARGO ETA SOON", type: "warning", days: diffDays };
    return null;
  };

  // Compile alerts
  const overdueRequests = myRequests.map(r => ({ req: r, alert: getEddAlertStatus(r) })).filter(x => x.alert !== null);
  const overdueCargos = myCargos.map(c => ({ cargo: c, alert: getEtaAlertStatus(c) })).filter(x => x.alert !== null);

  const totalAlertsCount = overdueRequests.length + overdueCargos.length;

  // 48-hour window helper — returns hours remaining (or 0 if expired)
  const hoursRemaining48 = (timestamp) => {
    if (!timestamp) return 0;
    const ms = 48 * 60 * 60 * 1000 - (Date.now() - new Date(timestamp).getTime());
    return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60)) : 0;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      
      {/* Top Navbar Tabs */}
      <div style={{ background: "rgba(10, 15, 30, 0.4)", borderBottom: "1px solid var(--border-glass)", padding: "0 24px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button 
            onClick={() => setActiveTab("alerts")} 
            className={`tab-btn ${activeTab === "alerts" ? "active" : ""}`}
            style={{ position: "relative" }}
          >
            Operations Alerts
            {totalAlertsCount > 0 && (
              <span style={{ 
                position: "absolute", top: "4px", right: "-6px", background: "var(--danger)", 
                color: "#fff", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "99px", fontWeight: "bold" 
              }}>
                {totalAlertsCount}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("pending")} className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}>
            Step 1: Commercial & Timeline Specification
          </button>
          <button onClick={() => setActiveTab("vendorready")} className={`tab-btn ${activeTab === "vendorready" ? "active" : ""}`}>
            Step 2: Vendor Ready
          </button>
          <button onClick={() => setActiveTab("planner")} className={`tab-btn ${activeTab === "planner" ? "active" : ""}`}>
            Step 3: Cargo Consolidation
          </button>
          <button onClick={() => setActiveTab("cargopickup")} className={`tab-btn ${activeTab === "cargopickup" ? "active" : ""}`}>
            Step 4: Cargo Pickup
          </button>
          <button onClick={() => setActiveTab("shipments")} className={`tab-btn ${activeTab === "shipments" ? "active" : ""}`}>
            Step 5: Transit Tracking & Receipt
          </button>
          <button onClick={() => setActiveTab("all")} className={`tab-btn ${activeTab === "all" ? "active" : ""}`}>
            Received History
          </button>
          {/* Pending Documents tab with alert badge */}
          {(() => {
            const pendingDocCount = myCargos.filter(c => !c.packingListFile || !c.invoiceFile).length;
            return (
              <button
                onClick={() => setActiveTab("docs")}
                className={`tab-btn ${activeTab === "docs" ? "active" : ""}`}
                style={{ position: "relative" }}
              >
                Pending Documents
                {pendingDocCount > 0 && (
                  <span style={{
                    position: "absolute", top: "4px", right: "-6px",
                    background: "#f59e0b", color: "#0f172a",
                    fontSize: "0.65rem", padding: "2px 6px", borderRadius: "99px", fontWeight: "bold"
                  }}>{pendingDocCount}</span>
                )}
              </button>
            );
          })()}
          <button onClick={() => setActiveTab("cancelled")} className={`tab-btn ${activeTab === "cancelled" ? "active" : ""}`}>
            Cancelled Orders
          </button>
          <button onClick={() => setActiveTab("vendors")} className={`tab-btn ${activeTab === "vendors" ? "active" : ""}`}>
            Vendor Registry
          </button>
          <button onClick={() => setActiveTab("cargocompanies")} className={`tab-btn ${activeTab === "cargocompanies" ? "active" : ""}`}>
            Logistics Carriers
          </button>
        </div>
      </div>

      <div className="main-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Core Analytics bar visible across all panels */}
        <AnalyticsPanel requests={myRequests} vendors={vendors} cargos={cargos} />

        {/* ==================== ALERTS TAB ==================== */}
        {activeTab === "alerts" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Action Alerts ({totalAlertsCount})</h3>

            {totalAlertsCount === 0 ? (
              <div className="glass-panel" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                <CheckCircle2 size={36} style={{ color: "var(--success)", marginBottom: "12px", display: "inline" }} /><br/>
                All shipments and vendor delivery timelines are currently on track. No pending alerts!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Vendor EDD alerts */}
                {overdueRequests.map(({ req, alert }) => {
                  const vName = vendors.find(v => v.id === req.vendorId)?.name || "Unknown Vendor";
                  return (
                    <div 
                      key={req.id} 
                      className={`alert-strip glass-panel ${alert.type === "danger" ? "alert-danger" : "alert-warning"}`} 
                      style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <Clock size={20} />
                        <div>
                          <span className={`badge ${alert.type === "danger" ? "badge-rejected" : "badge-pending"}`} style={{ marginRight: "10px" }}>
                            {alert.label}
                          </span>
                          <strong>{req.model}</strong> ({req.orderQuantity} units) — Vendor: {vName}
                          <div style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "4px" }}>
                            {alert.type === "danger" 
                              ? `Overdue by ${alert.days} days (EDD: ${req.vendorEdd})`
                              : `Due in ${alert.days} days (EDD: ${req.vendorEdd})`
                            }
                          </div>
                        </div>
                      </div>
                      
                      <button onClick={() => setEditingRequest(req)} className="btn btn-secondary btn-sm" style={{ alignSelf: "center" }}>
                        <Edit3 size={14} /> Fulfill Details
                      </button>
                    </div>
                  );
                })}

                {/* Cargo ETA alerts */}
                {overdueCargos.map(({ cargo, alert }) => {
                  const vName = vendors.find(v => v.id === cargo.vendorId)?.name || "Unknown Vendor";
                  const cargoItems = requests.filter(r => r.cargoId === cargo.id);
                  return (
                    <div 
                      key={cargo.id} 
                      className={`alert-strip glass-panel ${alert.type === "danger" ? "alert-danger" : "alert-warning"}`} 
                      style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <AlertTriangle size={20} />
                        <div>
                          <span className={`badge ${alert.type === "danger" ? "badge-rejected" : "badge-pending"}`} style={{ marginRight: "10px" }}>
                            {alert.label}
                          </span>
                          <strong>Cargo: {cargo.cargoDetail || cargo.id}</strong> — Vendor: {vName} ({cargoItems.length} items bundled)
                          <div style={{ fontSize: "0.8rem", opacity: 0.8, marginTop: "4px" }}>
                            {alert.type === "danger" 
                              ? `Arrival Overdue by ${alert.days} days (ETA: ${cargo.cargoEta})`
                              : `Arrival Expected in ${alert.days} days (ETA: ${cargo.cargoEta})`
                            }
                          </div>
                        </div>
                      </div>
                      
                      <button onClick={() => setEditingCargo(cargo)} className="btn btn-secondary btn-sm" style={{ alignSelf: "center" }}>
                        <Truck size={14} /> Track / Receive Cargo
                      </button>
                    </div>
                  );
                })}

              </div>
            )}
          </div>
        )}

        {/* ==================== AWAITING DETAILS (STEP 1) TAB ==================== */}
        {activeTab === "pending" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Step 1: Commercial & Timeline Specification</h3>
            <div className="glass-panel" style={{ padding: "20px" }}>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Order Date</th>
                      <th>Model / Description</th>
                      <th>Quantity</th>
                      <th>Vendor</th>
                      <th>Type</th>
                      <th>Actions</th>
                      <th>Cancel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.filter(r => !r.priceRmb).length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                          No pending requests. All items have pricing details populated!
                        </td>
                      </tr>
                    ) : (
                      myRequests.filter(r => !r.priceRmb).map(r => {
                        const vName = vendors.find(v => v.id === r.vendorId)?.name || "Unknown";
                        return (
                          <tr key={r.id}>
                            <td>{r.orderDate}</td>
                            <td style={{ fontWeight: 600 }}>{r.model}</td>
                            <td>{r.orderQuantity}</td>
                            <td>{vName}</td>
                            <td>{r.type}</td>
                            <td>
                              <button onClick={() => setEditingRequest(r)} className="btn btn-primary btn-sm">
                                <Plus size={14} /> Add Price & EDD
                              </button>
                            </td>
                            <td>
                              <button onClick={() => setCancellingRequest(r)} className="btn btn-danger btn-sm">
                                <XCircle size={14} /> Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== CARGO PLANNER (STEP 3) TAB ==================== */}
        {activeTab === "planner" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Step 3: Cargo Consolidation</h3>
            
            <div className="glass-panel" style={{ padding: "24px", marginBottom: "20px" }}>
              <div className="form-group" style={{ maxWidth: "400px" }}>
                <label className="form-label">Select Vendor to Plan Shipment</label>
                <select 
                  className="form-control"
                  value={plannerVendorId}
                  onChange={e => {
                    setPlannerVendorId(e.target.value);
                    setCheckedRequestIds([]);
                  }}
                >
                  <option value="" style={{ background: "#0f172a" }}>Select Vendor...</option>
                  {vendors
                    .filter(v => v.status !== "Inactive")
                    .filter(v => currentUser.role === "superadmin" || v.purchaserIds?.includes(currentUser.id))
                    .map(v => {
                      const metrics = calculateVendorMetrics(v, requests);
                      const scoreText = metrics.scorePending
                        ? `Rating: Pending — Insufficient History [${metrics.completedCount}/5 completed]`
                        : `Rating: ${metrics.score}/100`;
                      return (
                        <option key={v.id} value={v.id} style={{ background: "#0f172a" }}>
                          {v.name} ({scoreText})
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {plannerVendorId && (
              <div className="glass-panel card-fade-in" style={{ padding: "24px" }}>
                <h4 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "var(--primary)" }}>
                  Available Items ready for Shipping (No active Cargo)
                </h4>

                <div className="table-container" style={{ marginBottom: "20px" }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}>
                          <input 
                            type="checkbox"
                            className="checkbox-input"
                            checked={
                             myRequests.filter(r => r.vendorId === plannerVendorId && r.priceRmb && !r.cargoId).length > 0 &&
                              checkedRequestIds.length === myRequests.filter(r => r.vendorId === plannerVendorId && r.priceRmb && !r.cargoId).length
                            }
                            onChange={(e) => {
                              const readyRequests = myRequests.filter(r => r.vendorId === plannerVendorId && r.priceRmb && !r.cargoId);
                              if (e.target.checked) {
                                setCheckedRequestIds(readyRequests.map(r => r.id));
                              } else {
                                setCheckedRequestIds([]);
                              }
                            }}
                          />
                        </th>
                        <th>Order Date</th>
                        <th>Model</th>
                        <th>Quantity</th>
                        <th>Total Price</th>
                        <th>Vendor EDD</th>
                        <th>Ready Date</th>
                        <th>Cancel</th>
                        <th>Undo Pricing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.filter(r => r.vendorId === plannerVendorId && r.priceRmb && !r.cargoId).length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                            No items priced for this vendor. Go to <strong>Step 1: Commercial & Timeline Specification</strong> to assign vendor and price.
                          </td>
                        </tr>
                      ) : (
                        myRequests.filter(r => r.vendorId === plannerVendorId && r.priceRmb && !r.cargoId).map(r => {
                          const isChecked = checkedRequestIds.includes(r.id);
                          const undoHours = hoursRemaining48(r.pricedAt);
                          return (
                            <tr key={r.id} className={isChecked ? "planner-row-selected" : ""}>
                              <td>
                                <input 
                                  type="checkbox"
                                  className="checkbox-input"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setCheckedRequestIds(prev => [...prev, r.id]);
                                    } else {
                                      setCheckedRequestIds(prev => prev.filter(id => id !== r.id));
                                    }
                                  }}
                                />
                              </td>
                              <td>{r.orderDate}</td>
                              <td style={{ fontWeight: 600 }}>{r.model}</td>
                              <td>{r.orderQuantity}</td>
                              <td>{getCurrencySymbol(r.currency)}{Number(r.totalRmb).toLocaleString()}</td>
                              <td>{r.vendorEdd}</td>
                              <td style={{ color: r.vendorReadyDate ? "var(--success)" : "var(--text-muted)", fontSize: "0.8rem" }}>
                                {r.vendorReadyDate || "Not Ready"}
                              </td>
                              <td>
                                <button onClick={() => setCancellingRequest(r)} className="btn btn-danger btn-sm">
                                  <XCircle size={14} /> Cancel
                                </button>
                              </td>
                              <td>
                                {undoHours > 0 ? (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Undo pricing & vendor for "${r.model}"? Item will return to Step 1 (unpriced).`)) {
                                        onUndoPricing(r.id);
                                      }
                                    }}
                                    className="btn btn-sm"
                                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", gap: "5px" }}
                                    title={`Undo window: ${undoHours}h remaining`}
                                  >
                                    <RotateCcw size={13} /> Undo ({undoHours}h)
                                  </button>
                                ) : r.pricedAt ? (
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.6 }}>Undo expired</span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    {checkedRequestIds.length} item(s) selected for combined cargo.
                  </div>
                  <button 
                    disabled={checkedRequestIds.length === 0}
                    onClick={() => setCreatingCargo(true)}
                    className="btn btn-primary"
                  >
                    <Plus size={16} /> Combine Selected into Cargo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== STEP 2: VENDOR READY TAB ==================== */}
        {activeTab === "vendorready" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "6px" }}>Step 2: Vendor Ready Confirmation</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              Mark the date when vendor confirms the order is ready for pickup. This date is used to calculate vendor on-time performance scores.
            </p>

            {/* Controls row */}
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filter by Vendor</label>
                <select className="form-control" value={vrFilter} onChange={e => { setVrFilter(e.target.value); setVrChecked([]); }} style={{ minWidth: "200px" }}>
                  <option value="">All Vendors</option>
                  {vendors.filter(v => v.status !== "Inactive").map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ready Date</label>
                <input type="date" className="form-control" value={vrDate} onChange={e => setVrDate(e.target.value)} style={{ minWidth: "160px" }} />
              </div>
              <button
                disabled={vrChecked.length === 0 || !vrDate}
                onClick={() => {
                  vrChecked.forEach(id => {
                    const r = myRequests.find(x => x.id === id);
                    if (r) onUpdateRequest({ ...r, vendorReadyDate: vrDate });
                  });
                  setVrChecked([]);
                }}
                className="btn btn-success"
                style={{ alignSelf: "flex-end" }}
              >
                <Check size={15} /> Mark {vrChecked.length || ""} Selected as Vendor Ready
              </button>
            </div>

            {(() => {
              const vrItems = myRequests.filter(r =>
                r.priceRmb && !r.vendorReadyDate && r.status !== "Cancelled" &&
                (vrFilter === "" || r.vendorId === vrFilter)
              );
              const allChecked = vrItems.length > 0 && vrChecked.length === vrItems.length;
              return vrItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={32} style={{ color: "var(--success)", marginBottom: "10px", display: "inline" }} /><br />
                  All priced orders have been marked as Vendor Ready.
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: "4px" }}>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <input type="checkbox" className="checkbox-input"
                              checked={allChecked}
                              onChange={e => setVrChecked(e.target.checked ? vrItems.map(r => r.id) : [])}
                            />
                          </th>
                          <th>Item / Model</th>
                          <th>Qty</th>
                          <th>Vendor</th>
                          <th>Order Date</th>
                          <th>EDD</th>
                          <th>Priced At</th>
                          <th>EDD Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vrItems.map(r => {
                          const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                          const isLate = vrDate && r.vendorEdd && vrDate > r.vendorEdd;
                          return (
                            <tr key={r.id} className={vrChecked.includes(r.id) ? "planner-row-selected" : ""}>
                              <td>
                                <input type="checkbox" className="checkbox-input"
                                  checked={vrChecked.includes(r.id)}
                                  onChange={e => setVrChecked(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{r.model}</td>
                              <td>{r.orderQuantity}</td>
                              <td>{vName}</td>
                              <td>{r.orderDate}</td>
                              <td>{r.vendorEdd || "—"}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.pricedAt ? r.pricedAt.split("T")[0] : "—"}</td>
                              <td>
                                {r.vendorEdd ? (
                                  isLate
                                    ? <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.8rem" }}>⚠ Late vs EDD</span>
                                    : <span style={{ color: "var(--success)", fontSize: "0.8rem" }}>✓ On Time</span>
                                ) : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No EDD set</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Already-ready items */}
            {(() => {
              const readyDone = myRequests.filter(r => r.priceRmb && r.vendorReadyDate && !r.cargoId && r.status !== "Cancelled" &&
                (vrFilter === "" || r.vendorId === vrFilter));
              return readyDone.length > 0 ? (
                <div style={{ marginTop: "24px" }}>
                  <h4 style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "10px" }}>✓ Already Marked Ready — Awaiting Cargo Assignment ({readyDone.length})</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {readyDone.map(r => {
                      const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                      const isLate = r.vendorEdd && r.vendorReadyDate > r.vendorEdd;
                      return (
                        <div key={r.id} className="glass-panel" style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", opacity: 0.75 }}>
                          <div style={{ fontSize: "0.87rem" }}><strong>{r.model}</strong> — {vName} — Qty: {r.orderQuantity}</div>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.82rem" }}>
                            <span style={{ color: "var(--success)" }}>Ready: {r.vendorReadyDate}</span>
                            {isLate && <span style={{ color: "var(--danger)" }}>⚠ Late ({Math.ceil((new Date(r.vendorReadyDate)-new Date(r.vendorEdd))/(1000*60*60*24))} days)</span>}
                            <button onClick={() => onUpdateRequest({ ...r, vendorReadyDate: "" })} className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: "0.72rem" }}>Undo</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* ==================== STEP 4: CARGO PICKUP TAB ==================== */}
        {activeTab === "cargopickup" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "6px" }}>Step 4: Cargo Pickup Confirmation</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              Mark the date when the logistics carrier physically picked up order items from the vendor.
            </p>

            {/* Controls row */}
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filter by Vendor</label>
                <select className="form-control" value={cpFilter} onChange={e => { setCpFilter(e.target.value); setCpChecked([]); }} style={{ minWidth: "200px" }}>
                  <option value="">All Vendors</option>
                  {vendors.filter(v => v.status !== "Inactive").map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pickup Date</label>
                <input type="date" className="form-control" value={cpDate} onChange={e => setCpDate(e.target.value)} style={{ minWidth: "160px" }} />
              </div>
              <button
                disabled={cpChecked.length === 0 || !cpDate}
                onClick={() => {
                  cpChecked.forEach(id => {
                    const r = myRequests.find(x => x.id === id);
                    if (r) onUpdateRequest({ ...r, cargoPickupDate: cpDate });
                  });
                  setCpChecked([]);
                }}
                className="btn btn-success"
                style={{ alignSelf: "flex-end" }}
              >
                <Truck size={15} /> Mark {cpChecked.length || ""} Selected as Picked Up
              </button>
            </div>

            {/* Table */}
            {(() => {
              const cpItems = myRequests.filter(r =>
                r.cargoId && !r.cargoPickupDate && r.status !== "Cancelled" &&
                (cpFilter === "" || r.vendorId === cpFilter)
              );
              const allCpChecked = cpItems.length > 0 && cpChecked.length === cpItems.length;
              return cpItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={32} style={{ color: "var(--success)", marginBottom: "10px", display: "inline" }} /><br />
                  All cargo-assigned items have been marked as picked up.
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: "4px" }}>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <input type="checkbox" className="checkbox-input"
                              checked={allCpChecked}
                              onChange={e => setCpChecked(e.target.checked ? cpItems.map(r => r.id) : [])}
                            />
                          </th>
                          <th>Item / Model</th>
                          <th>Qty</th>
                          <th>Vendor</th>
                          <th>Cargo</th>
                          <th>Vendor Ready</th>
                          <th>Cargo Assigned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cpItems.map(r => {
                          const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                          return (
                            <tr key={r.id} className={cpChecked.includes(r.id) ? "planner-row-selected" : ""}>
                              <td>
                                <input type="checkbox" className="checkbox-input"
                                  checked={cpChecked.includes(r.id)}
                                  onChange={e => setCpChecked(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{r.model}</td>
                              <td>{r.orderQuantity}</td>
                              <td>{vName}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.cargoId}</td>
                              <td style={{ color: "var(--success)", fontSize: "0.8rem" }}>{r.vendorReadyDate || "—"}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.cargoAssignedAt ? r.cargoAssignedAt.split("T")[0] : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Already picked up */}
            {(() => {
              const cpDone = myRequests.filter(r => r.cargoId && r.cargoPickupDate && r.status !== "Cancelled" &&
                (cpFilter === "" || r.vendorId === cpFilter));
              return cpDone.length > 0 ? (
                <div style={{ marginTop: "24px" }}>
                  <h4 style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "10px" }}>✓ Already Picked Up ({cpDone.length})</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {cpDone.map(r => (
                      <span key={r.id} style={{ fontSize: "0.78rem", background: "rgba(16,185,129,0.1)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "6px", padding: "4px 10px" }}>
                        {r.model} — Pickup: {r.cargoPickupDate}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* ==================== CARGO SHIPMENTS (STEP 5) TAB ==================== */}
        {activeTab === "shipments" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Step 5: Transit Tracking & Warehouse Receipting</h3>

            {(() => {
              const inTransitCargos = myCargos.filter(c => c.isMaterialRec !== "Yes");
              return inTransitCargos.length === 0 ? (
                <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No active in-transit cargo shipments registered yet. Go to the Cargo Planner to combine requests.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {inTransitCargos.map(cargo => {
                  const vName = vendors.find(v => v.id === cargo.vendorId)?.name || "Unknown Vendor";
                  const cargoItems = requests.filter(r => r.cargoId === cargo.id);
                  
                  return (
                    <div key={cargo.id} className="glass-panel" style={{ padding: "24px" }}>
                      
                      {/* Cargo Header Info */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <h4 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                              Cargo Code: {cargo.id}
                            </h4>
                            <span className={`badge ${cargo.isMaterialRec === "Yes" ? "badge-received" : "badge-cargo"}`}>
                              {cargo.isMaterialRec === "Yes" ? "Received" : "In Transit"}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Vendor: <strong>{vName}</strong> | Transport Mode: <strong>{cargo.modeOfTransport}</strong>
                            {cargo.cargoCompanyId && (
                              <>
                                {" "}| Cargo Company: <strong>{cargoCompanies.find(cc => cc.id === cargo.cargoCompanyId)?.name || "—"}</strong>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quick actions for cargo */}
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {cargo.isMaterialRec !== "Yes" && (
                            <button 
                              onClick={() => setReceivingCargo(cargo)}
                              className="btn btn-success btn-sm"
                            >
                              <Check size={14} /> Bulk Receive ({cargoItems.length} items)
                            </button>
                          )}
                          <button onClick={() => setEditingCargo(cargo)} className="btn btn-secondary btn-sm">
                            <Edit3 size={14} /> Edit Shipping Details
                          </button>
                        </div>
                      </div>

                      {/* Cargo Detail grids */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "16px", fontSize: "0.85rem" }}>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>Cargo Detail:</div>
                          <div style={{ fontWeight: 500 }}>{cargo.cargoDetail || "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>Shipping / ETA Dates:</div>
                          <div style={{ fontWeight: 500 }}>
                            {cargo.cargoShippingDate || "—"} <ArrowRight size={12} style={{ verticalAlign: "middle" }} /> {cargo.cargoEta || "—"}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>Volume (CBM):</div>
                          <div style={{ fontWeight: 500 }}>{cargo.cbmPackingList ? `${cargo.cbmPackingList} CBM` : "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>Cargo Cost:</div>
                          <div style={{ fontWeight: 500 }}>
                            {getCurrencySymbol(cargo.currency)}{cargo.cargoPrice} ({cargo.cargoPriceUom || "Total"})
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>Cargo Company Contact:</div>
                          <div style={{ fontWeight: 500 }}>
                            {(() => {
                              const ccObj = cargoCompanies.find(cc => cc.id === cargo.cargoCompanyId);
                              return ccObj ? `${ccObj.name} (${ccObj.phone || "No phone"})` : "—";
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Associated Files */}
                      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "0.85rem", background: "rgba(0,0,0,0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                        <div style={{ fontWeight: 600, color: "var(--primary)" }}>Documents:</div>
                        <div>
                          Packing List: {cargo.packingListFile ? <span className="doc-link">📄 {cargo.packingListFile}</span> : <span style={{ color: "var(--text-muted)" }}>Missing</span>}
                        </div>
                        <div>
                          Invoice: {cargo.invoiceFile ? <span className="doc-link">📄 {cargo.invoiceFile}</span> : <span style={{ color: "var(--text-muted)" }}>Missing</span>}
                        </div>
                      </div>

                      {/* Combined Items List with Undo Cargo buttons */}
                      <div style={{ marginTop: "16px" }}>
                        <details>
                          <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", userSelect: "none" }}>
                            Show Bundled Items ({cargoItems.length})
                          </summary>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                            {cargoItems.map(item => {
                              const undoHrs = hoursRemaining48(item.cargoAssignedAt);
                              const canUndo = cargo.isMaterialRec !== "Yes" && undoHrs > 0;
                              return (
                                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--border-glass)", padding: "8px 14px", borderRadius: "6px", fontSize: "0.85rem", flexWrap: "wrap", gap: "8px" }}>
                                  <div>
                                    <strong>{item.model}</strong> — Quantity: {item.orderQuantity} units
                                    {item.status === "Cancelled" && (
                                      <span className="badge badge-rejected" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>Cancelled</span>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                    <span style={{ color: "var(--primary)" }}>
                                      Price: {getCurrencySymbol(item.currency)}{Number(item.totalRmb).toLocaleString()} | Balance: {getCurrencySymbol(item.currency)}{Number(item.balancePayment).toLocaleString()}
                                    </span>
                                    {canUndo ? (
                                      <button
                                        onClick={() => {
                                          if (window.confirm(`Undo cargo assignment for "${item.model}"? Item will return to Step 3 (Cargo Planner).`)) {
                                            onUndoCargoAssignment(item.id);
                                          }
                                        }}
                                        className="btn btn-sm"
                                        style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", gap: "5px" }}
                                        title={`Undo window closes in ${undoHrs}h`}
                                      >
                                        <RotateCcw size={12} /> Undo Cargo ({undoHrs}h left)
                                      </button>
                                    ) : cargo.isMaterialRec !== "Yes" && item.cargoAssignedAt ? (
                                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", opacity: 0.55 }}>Undo window expired</span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </div>

                    </div>
                  );
                })}
              </div>
            );
          })()}
          </div>
        )}

        {/* ==================== ALL LEDGER LOGS TAB ==================== */}
        {activeTab === "all" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Received Order History</h3>
            
            <div className="glass-panel" style={{ padding: "20px" }}>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Receive Date</th>
                      <th>Order Date</th>
                      <th>Model / Description</th>
                      <th>Qty</th>
                      <th>Vendor</th>
                      <th>Total Spend</th>
                      <th>Cargo Code</th>
                      <th>Lead Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const receivedRequests = myRequests.filter(r => r.isMaterialRec === "Yes");
                      return receivedRequests.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                            No orders have been received yet. Go to <strong>Step 6: Transit Tracking & Receipt</strong> to bulk receive.
                          </td>
                        </tr>
                      ) : (
                        receivedRequests.map(r => {
                          const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                          const leadTimeDays = (() => {
                            if (!r.actualReceivedDate || !r.orderDate) return "—";
                            const start = new Date(r.orderDate);
                            const end = new Date(r.actualReceivedDate);
                            const diffTime = Math.abs(end - start);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return `${diffDays} days`;
                          })();
                          return (
                            <tr key={r.id}>
                              <td style={{ color: "var(--success)", fontWeight: 600 }}>{r.actualReceivedDate || "—"}</td>
                              <td>{r.orderDate}</td>
                              <td style={{ fontWeight: 600 }}>{r.model}</td>
                              <td>{r.orderQuantity}</td>
                              <td>{vName}</td>
                              <td style={{ fontWeight: 500 }}>
                                {r.priceRmb ? `${getCurrencySymbol(r.currency)}${Number(r.totalRmb).toLocaleString()}` : "—"}
                              </td>
                              <td style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>{r.cargoId || "—"}</td>
                              <td>
                                <span className="badge badge-success" style={{ background: "rgba(16,185,129,0.1)", color: "var(--success)" }}>
                                  {leadTimeDays}
                                </span>
                              </td>
                              <td>
                                <button onClick={() => setViewingRequest(r)} className="btn btn-secondary btn-sm" style={{ padding: "6px" }}>
                                  <Eye size={14} /> View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PENDING DOCUMENTS TAB ==================== */}
        {activeTab === "docs" && (
          <PendingDocumentsPanel
            cargos={myCargos}
            requests={myRequests}
            vendors={vendors}
            cargoCompanies={cargoCompanies}
            onUpdateCargo={onUpdateCargo}
            onUpdateRequest={onUpdateRequest}
          />
        )}
        {activeTab === "cancelled" && (
          <div className="card-fade-in">
            <h3 style={{ fontSize: "1.4rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Ban size={22} style={{ color: "var(--danger)" }} /> Cancelled Orders ({cancelledRequests.length})
            </h3>

            {cancelledRequests.length === 0 ? (
              <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <CheckCircle2 size={36} style={{ color: "var(--success)", marginBottom: "12px", display: "inline" }} /><br/>
                No cancelled orders. All purchase orders are active.
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "20px" }}>
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Cancelled On</th>
                        <th>Order Date</th>
                        <th>Model / Description</th>
                        <th>Qty</th>
                        <th>Vendor</th>
                        <th>Stage at Cancellation</th>
                        <th>Cancellation Reason</th>
                        <th>View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledRequests.map(r => {
                        const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                        let stage = "Step 1: Submitted";
                        if (r.priceRmb && r.cargoId) stage = "Step 3: In Cargo";
                        else if (r.priceRmb) stage = "Step 2: Priced";
                        return (
                          <tr key={r.id} style={{ opacity: 0.85 }}>
                            <td style={{ color: "var(--danger)", fontWeight: 600 }}>{r.cancelledAt || "—"}</td>
                            <td>{r.orderDate}</td>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{r.model}</span>
                            </td>
                            <td>{r.orderQuantity}</td>
                            <td>{vName}</td>
                            <td>
                              <span className="badge badge-pending" style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)" }}>
                                {stage}
                              </span>
                            </td>
                            <td style={{ fontStyle: "italic", color: "var(--text-muted)", maxWidth: "200px" }}>
                              {r.cancellationReason || <span style={{ opacity: 0.5 }}>No reason provided</span>}
                            </td>
                            <td>
                              <button onClick={() => setViewingRequest(r)} className="btn btn-secondary btn-sm" style={{ padding: "6px" }}>
                                <Eye size={14} /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== MY VENDORS TAB ==================== */}
        {activeTab === "vendors" && (
          <MyVendorsPanel 
            currentUser={currentUser}
            vendors={vendors}
            onAddVendor={onAddVendor}
            onUpdateVendor={onUpdateVendor}
            onRemoveVendor={onRemoveVendor}
            onSelectVendor={setSelectedVendorForDetail}
          />
        )}

        {/* ==================== CARGO COMPANIES TAB ==================== */}
        {activeTab === "cargocompanies" && (
          <CargoCompaniesPanel 
            cargoCompanies={cargoCompanies}
            onAddCargoCompany={onAddCargoCompany}
            onUpdateCargoCompany={onUpdateCargoCompany}
            onRemoveCargoCompany={onRemoveCargoCompany}
            onSelectCargoCompany={setSelectedCargoCompanyForDetail}
          />
        )}

      </div>

      {/* ==================== STEP 2: EDITING REQUEST DETAILS MODAL ==================== */}
      {editingRequest && (
        <EditRequestModal 
          request={editingRequest}
          requests={requests}
          vendors={vendors}
          currentUser={currentUser}
          onClose={() => setEditingRequest(null)}
          onSave={(updated) => {
            onUpdateRequest(updated);
            setEditingRequest(null);
          }}
        />
      )}

      {/* ==================== DETAILED READ-ONLY VIEW MODAL ==================== */}
      {viewingRequest && (
        <ViewRequestModal 
          request={viewingRequest}
          vendors={vendors}
          cargos={cargos}
          cargoCompanies={cargoCompanies}
          purchasers={purchasers}
          onClose={() => setViewingRequest(null)}
          onCancelOrder={viewingRequest.status !== "Cancelled" && viewingRequest.isMaterialRec !== "Yes" ? (req) => { setViewingRequest(null); setCancellingRequest(req); } : null}
        />
      )}

      {/* ==================== CANCEL ORDER CONFIRMATION MODAL ==================== */}
      {cancellingRequest && (
        <CancelOrderModal
          request={cancellingRequest}
          vendors={vendors}
          onClose={() => setCancellingRequest(null)}
          onConfirm={(reason) => {
            onCancelOrder(cancellingRequest.id, reason);
            setCancellingRequest(null);
          }}
        />
      )}

      {/* ==================== RECEIVE CARGO DATE MODAL ==================== */}
      {receivingCargo && (
        <ReceiveCargoModal
          cargo={receivingCargo}
          requests={requests.filter(r => r.cargoId === receivingCargo.id)}
          onClose={() => setReceivingCargo(null)}
          onConfirm={(receiveDate) => {
            onUpdateCargo({ ...receivingCargo, isMaterialRec: "Yes", receivedDate: receiveDate });
            setReceivingCargo(null);
          }}
        />
      )}

      {/* ==================== CREATE CARGO BUNDLE MODAL ==================== */}
      {creatingCargo && (
        <CreateCargoModal 
          vendorId={plannerVendorId}
          vendorName={vendors.find(v => v.id === plannerVendorId)?.name}
          selectedIds={checkedRequestIds}
          requests={myRequests}
          cargos={cargos}
          cargoCompanies={cargoCompanies}
          onClose={() => setCreatingCargo(false)}
          onSave={(cargoDetails) => {
            onAddCargo(cargoDetails, checkedRequestIds);
            setCreatingCargo(false);
            setCheckedRequestIds([]);
            setActiveTab("cargopickup"); // Go to Cargo Pickup step next
          }}
        />
      )}

      {/* ==================== EDIT CARGO MODAL ==================== */}
      {editingCargo && (
        <EditCargoModal 
          cargo={editingCargo}
          cargos={cargos}
          requests={requests}
          cargoCompanies={cargoCompanies}
          onClose={() => setEditingCargo(null)}
          onSave={(updated) => {
            onUpdateCargo(updated);
            setEditingCargo(null);
          }}
        />
      )}

      {/* ==================== VENDOR DETAIL MODAL ==================== */}
      {selectedVendorForDetail && (
        <VendorDetailModal 
          vendor={selectedVendorForDetail}
          requests={requests}
          cargos={cargos}
          purchasers={purchasers}
          currentUser={currentUser}
          onUpdateVendor={onUpdateVendor}
          onRemoveVendor={onRemoveVendor}
          onClose={() => setSelectedVendorForDetail(null)}
        />
      )}

      {/* ==================== CARGO COMPANY DETAIL MODAL ==================== */}
      {selectedCargoCompanyForDetail && (
        <CargoCompanyDetailModal 
          company={selectedCargoCompanyForDetail}
          cargos={cargos}
          requests={requests}
          currentUser={currentUser}
          onUpdateCargoCompany={onUpdateCargoCompany}
          onRemoveCargoCompany={onRemoveCargoCompany}
          onClose={() => setSelectedCargoCompanyForDetail(null)}
        />
      )}

    </div>
  );
}

// --------------------- SUB COMPONENT MODALS ---------------------

// Helper for currency symbols
export const getCurrencySymbol = (currency) => {
  if (currency === "USD") return "$";
  if (currency === "INR") return "₹";
  return "¥"; // Default RMB
};

export const convertToRmb = (amount, currency) => {
  const num = parseFloat(amount || 0);
  const cur = currency || "RMB";
  if (cur === "USD") return num * 7.25;
  if (cur === "INR") return num * 0.087;
  return num;
};

// 1. STEP 2: EDIT REQUEST DETAILS MODAL
function EditRequestModal({ request, requests, vendors, currentUser, onClose, onSave }) {
  const [vendorId, setVendorId] = useState(request.vendorId || "");
  const [currency, setCurrency] = useState(request.currency || "RMB");
  const [price, setPrice] = useState(request.priceRmb || "");
  const [advance, setAdvance] = useState(request.advancePayment || "");
  const [edd, setEdd] = useState(request.vendorEdd || "");
  const [photo, setPhoto] = useState(request.photo || "");
  const [useHistoryPhoto, setUseHistoryPhoto] = useState(true);
  const [notes, setNotes] = useState(request.notes || "");

  // Auto-calculated totals
  const totalRmb = price ? parseFloat(price) * request.orderQuantity : 0;
  const balanceRmb = price ? totalRmb - (advance ? parseFloat(advance) : 0) : 0;

  // Historical photo lookup
  const historicalPhoto = React.useMemo(() => {
    // Find requests for the same model that have a photo
    const match = requests.find(r => r.model.toLowerCase() === request.model.toLowerCase() && r.photo);
    return match ? match.photo : null;
  }, [request.model, requests]);

  // Set default photo to historical if available and none uploaded yet
  React.useEffect(() => {
    if (historicalPhoto && !request.photo && useHistoryPhoto) {
      setPhoto(historicalPhoto);
    }
  }, [historicalPhoto, request.photo, useHistoryPhoto]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhoto(event.target.result); // Base64 encoding
      setUseHistoryPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!price || !edd || !vendorId) return;

    onSave({
      ...request,
      vendorId: vendorId,
      currency: currency,
      priceRmb: parseFloat(price),
      totalRmb: totalRmb,
      advancePayment: parseFloat(advance || 0),
      balancePayment: balanceRmb,
      vendorEdd: edd,
      photo: photo,
      notes: notes,
      // Stamp pricedAt only on first pricing (not on edits, to preserve 48h window)
      pricedAt: request.pricedAt || new Date().toISOString()
    });
  };

  const vName = vendors.find(v => v.id === vendorId)?.name || "Not Selected Yet";

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content">
        <h3 style={{ fontSize: "1.4rem", marginBottom: "6px", color: "var(--primary)" }}>Fulfill Purchase Details (Step 1)</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Model: <strong>{request.model}</strong> | Qty: {request.orderQuantity} | Vendor: {vName}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* Vendor Selection (Required) */}
          <div className="form-group">
            <label className="form-label">Vendor / Supplier</label>
            <select 
              className="form-control"
              value={vendorId}
              onChange={e => setVendorId(e.target.value)}
              required
            >
              <option value="" style={{ background: "#0f172a" }}>Select Vendor...</option>
              {vendors
                .filter(v => v.status !== "Inactive")
                .filter(v => currentUser.role === "superadmin" || v.purchaserIds?.includes(currentUser.id))
                .map(v => {
                  const metrics = calculateVendorMetrics(v, requests);
                  const scoreText = metrics.scorePending
                    ? `Rating: Pending — Insufficient History [${metrics.completedCount}/5 completed]`
                    : `Rating: ${metrics.score}/100`;
                  return (
                    <option key={v.id} value={v.id} style={{ background: "#0f172a" }}>
                      {v.name} ({scoreText})
                    </option>
                  );
                })}
            </select>
          </div>
          
          {/* Currency selection & Price per unit */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Select Currency</label>
              <select 
                className="form-control"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                <option value="RMB" style={{ background: "#0f172a" }}>RMB (¥)</option>
                <option value="USD" style={{ background: "#0f172a" }}>USD ($)</option>
                <option value="INR" style={{ background: "#0f172a" }}>INR (₹)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Price Per Unit ({currency})</label>
              <input 
                type="number" 
                className="form-control" 
                placeholder={`${currency} price`} 
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
                min="0.01"
                step="any"
              />
            </div>
          </div>

          {/* Total & Advance Payment */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Calculated Total ({currency})</label>
              <input 
                type="text" 
                className="form-control" 
                value={`${getCurrencySymbol(currency)}${totalRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                disabled
              />
            </div>

            <div className="form-group">
              <label className="form-label">Advance Payment ({currency})</label>
              <input 
                type="number" 
                className="form-control" 
                placeholder={`${currency} advance`} 
                value={advance}
                onChange={e => setAdvance(e.target.value)}
                min="0"
                step="any"
              />
            </div>
          </div>

          {/* Balance Payment */}
          <div className="form-group">
            <label className="form-label">Balance Payment ({currency})</label>
            <input 
              type="text" 
              className="form-control" 
              value={`${getCurrencySymbol(currency)}${balanceRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              disabled
            />
          </div>

          {/* Delivery & Photo */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendor EDD (Delivery Date)</label>
              <input 
                type="date" 
                className="form-control" 
                value={edd}
                onChange={e => setEdd(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Model Photo</label>
              <label className="doc-upload-btn" style={{ height: "42px", padding: "8px" }}>
                <Upload size={14} /> <span>Upload Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          {/* Photo Preview & Lookup alert */}
          {historicalPhoto && !request.photo && (
            <div className="glass-panel" style={{ padding: "12px", background: "rgba(56, 189, 248, 0.05)", display: "flex", gap: "10px", alignItems: "center" }}>
              <img src={historicalPhoto} alt="Historical" style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Previous Photo Found!</div>
                <label className="checkbox-label" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  <input 
                    type="checkbox" 
                    className="checkbox-input" 
                    checked={useHistoryPhoto} 
                    onChange={e => {
                      setUseHistoryPhoto(e.target.checked);
                      if (e.target.checked) setPhoto(historicalPhoto);
                      else setPhoto("");
                    }} 
                  /> Use historical photo
                </label>
              </div>
            </div>
          )}

          {photo && (
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Photo Preview:</span>
              <img src={photo} className="photo-preview-large" alt="Product" />
            </div>
          )}



          <div className="form-group">
            <label className="form-label">Purchaser Internal Notes</label>
            <textarea 
              className="form-control" 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="2"
              placeholder="e.g. advance paid via bank wire, vendor confirmed production timeline"
            />
          </div>

          {/* Confirm */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Fulfill Details</button>
          </div>

        </form>
      </div>
    </div>
  );
}

// 2. DETAILED READ-ONLY VIEW MODAL (ALL 27 FIELDS)
function ViewRequestModal({ request, vendors, cargos, cargoCompanies = [], purchasers, onClose, onCancelOrder }) {
  const pName = purchasers.find(p => p.id === request.purchaserId)?.name || "Unknown";
  const vName = vendors.find(v => v.id === request.vendorId)?.name || "Unknown";
  
  // Find linked Cargo details
  const cargo = cargos.find(c => c.id === request.cargoId);

  // Stepper calculations
  let currentStep = 1; // Submitted
  if (request.priceRmb) currentStep = 2; // Priced
  if (request.cargoId) currentStep = 3; // In Cargo
  if (request.isMaterialRec === "Yes") currentStep = 4; // Received

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "680px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "20px" }}>
          <div>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Order ID: {request.id}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Logged Date: {request.orderDate}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {request.status === "Cancelled" && (
              <span className="badge badge-rejected" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>CANCELLED</span>
            )}
            {onCancelOrder && (
              <button onClick={() => onCancelOrder(request)} className="btn btn-danger btn-sm">
                <XCircle size={14} /> Cancel Order
              </button>
            )}
            <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
          </div>
        </div>

        {/* Stepper progress */}
        <div className="stepper">
          <div className={`stepper-step ${currentStep >= 1 ? "completed" : ""}`}>
            <div className="stepper-dot">{currentStep > 1 ? "✓" : "1"}</div>
            <div>Step 1: Submitted</div>
          </div>
          <div className={`stepper-step ${currentStep >= 2 ? (currentStep === 2 ? "active" : "completed") : ""}`}>
            <div className="stepper-dot">{currentStep > 2 ? "✓" : "2"}</div>
            <div>Step 2: Priced</div>
          </div>
          <div className={`stepper-step ${currentStep >= 3 ? (currentStep === 3 ? "active" : "completed") : ""}`}>
            <div className="stepper-dot">{currentStep > 3 ? "✓" : "3"}</div>
            <div>Step 3: In Cargo</div>
          </div>
          <div className={`stepper-step ${currentStep >= 4 ? "completed" : ""}`}>
            <div className="stepper-dot">4</div>
            <div>Step 4: Received</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {/* Column A: Purchase details */}
          <div>
            <h4 style={{ color: "var(--primary)", fontSize: "1rem", borderBottom: "1px solid var(--border-glass)", paddingBottom: "6px", marginBottom: "10px" }}>
              Order & Payments
            </h4>
            <div className="details-list">
              <div className="details-term">Entry By:</div><div className="details-def">{request.entryBy || "—"}</div>
              <div className="details-term">Purchaser:</div><div className="details-def">{pName}</div>
              <div className="details-term">Vendor:</div><div className="details-def">{vName}</div>
              <div className="details-term">Item Name:</div><div className="details-def" style={{ fontWeight: 600 }}>{request.model}</div>
              <div className="details-term">Item Nature:</div><div className="details-def">{request.itemNature || "—"}</div>
              <div className="details-term">Category:</div><div className="details-def">{request.category || "—"}</div>
              <div className="details-term">Quantity:</div><div className="details-def">{request.orderQuantity}</div>
              <div className="details-term">Type:</div><div className="details-def">{request.type}</div>
              <div className="details-term">Required By Date:</div><div className="details-def">{request.requiredByDate || "—"}</div>
              <div className="details-term">Currency:</div><div className="details-def">{request.currency || "RMB"}</div>
              <div className="details-term">Price per unit:</div><div className="details-def">{request.priceRmb ? `${getCurrencySymbol(request.currency)}${request.priceRmb}` : "—"}</div>
              <div className="details-term">Total Price:</div><div className="details-def">{request.totalRmb ? `${getCurrencySymbol(request.currency)}${Number(request.totalRmb).toLocaleString()}` : "—"}</div>
              <div className="details-term">Advance Payment:</div><div className="details-def">{request.advancePayment ? `${getCurrencySymbol(request.currency)}${Number(request.advancePayment).toLocaleString()}` : "—"}</div>
              <div className="details-term">Balance Payment:</div><div className="details-def">{request.balancePayment ? `${getCurrencySymbol(request.currency)}${Number(request.balancePayment).toLocaleString()}` : "—"}</div>
              <div className="details-term">Vendor EDD:</div><div className="details-def">{request.vendorEdd || "—"}</div>
              <div className="details-term">Received?</div><div className="details-def" style={{ fontWeight: 600, color: request.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>{request.isMaterialRec}</div>
            </div>
          </div>

          {/* Column B: Cargo Logistics & Documents */}
          <div>
            <h4 style={{ color: "var(--secondary)", fontSize: "1rem", borderBottom: "1px solid var(--border-glass)", paddingBottom: "6px", marginBottom: "10px" }}>
              Cargo & Logistics
            </h4>
            {cargo ? (
              <div className="details-list">
                <div className="details-term">Cargo ID:</div><div className="details-def" style={{ fontWeight: 600 }}>{cargo.id}</div>
                <div className="details-term">Cargo Order Date:</div><div className="details-def">{cargo.cargoOrderDate || "—"}</div>
                <div className="details-term">Cargo Detail:</div><div className="details-def">{cargo.cargoDetail || "—"}</div>
                <div className="details-term">Cargo Cost:</div><div className="details-def">{cargo.cargoPrice ? `${getCurrencySymbol(cargo.currency)}${cargo.cargoPrice} (${cargo.cargoPriceUom || "Total"})` : "—"}</div>
                <div className="details-term">Volume (CBM):</div><div className="details-def">{cargo.cbmPackingList ? `${cargo.cbmPackingList} CBM` : "—"}</div>
                <div className="details-term">Total Cargo Price:</div><div className="details-def">{cargo.totalCargoPrice ? `${getCurrencySymbol(cargo.currency)}${Number(cargo.totalCargoPrice).toLocaleString()}` : "—"}</div>
                <div className="details-term">Transport Mode:</div><div className="details-def" style={{ fontWeight: 600 }}>{cargo.modeOfTransport || "—"}</div>
                <div className="details-term">Cargo Company:</div><div className="details-def">{cargoCompanies.find(cc => cc.id === cargo.cargoCompanyId)?.name || "—"}</div>
                <div className="details-term">Shipping Date:</div><div className="details-def">{cargo.cargoShippingDate || "—"}</div>
                <div className="details-term">Cargo ETA:</div><div className="details-def">{cargo.cargoEta || "—"}</div>
                <div className="details-term">Packing List:</div><div className="details-def">{cargo.packingListFile ? <span className="doc-link">📄 {cargo.packingListFile}</span> : "—"}</div>
                <div className="details-term">Invoice:</div><div className="details-def">{cargo.invoiceFile ? <span className="doc-link">📄 {cargo.invoiceFile}</span> : "—"}</div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "10px 0" }}>
                This item is not yet assigned to an active cargo shipment.
              </div>
            )}

            {/* Photo display */}
            {request.photo && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>Product Photo:</div>
                <img src={request.photo} className="photo-preview-large" alt="Product thumbnail" />
              </div>
            )}
          </div>
        </div>

        {request.notes && (
          <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-glass)", paddingTop: "14px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>Internal logs / Notes:</div>
            <p style={{ fontSize: "0.9rem", fontStyle: "italic" }}>{request.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}

// 2b. CANCEL ORDER CONFIRMATION MODAL
function CancelOrderModal({ request, vendors, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const vName = vendors.find(v => v.id === request.vendorId)?.name || "—";

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "480px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ background: "rgba(239,68,68,0.15)", borderRadius: "50%", padding: "10px", display: "flex" }}>
            <XCircle size={24} style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--danger)" }}>Cancel Purchase Order</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>This action cannot be undone.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.9rem" }}>
            <div><span style={{ color: "var(--text-muted)" }}>Item:</span> <strong>{request.model}</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Qty:</span> {request.orderQuantity}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Vendor:</span> {vName}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Order Date:</span> {request.orderDate}</div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label className="form-label">Cancellation Reason <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
          <textarea
            className="form-control"
            rows="3"
            placeholder="e.g. Procurement halted due to budget freeze, duplicate order, vendor non-compliance..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} className="btn btn-secondary">Keep Order Active</button>
          <button 
            onClick={() => onConfirm(reason)}
            className="btn btn-danger"
          >
            <XCircle size={16} /> Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
}

// 2c. RECEIVE CARGO DATE MODAL
function ReceiveCargoModal({ cargo, requests, onClose, onConfirm }) {
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split("T")[0]);
  const activeItems = requests.filter(r => r.status !== "Cancelled");

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "460px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ background: "rgba(16,185,129,0.15)", borderRadius: "50%", padding: "10px", display: "flex" }}>
            <Check size={24} style={{ color: "var(--success)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Confirm Cargo Received</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Cargo: {cargo.id} — {activeItems.length} item(s)</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "14px", marginBottom: "18px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>Items being received</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {activeItems.map(r => (
              <div key={r.id} style={{ fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                <span><strong>{r.model}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Qty: {r.orderQuantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label className="form-label">Date Received at Warehouse</label>
          <input
            type="date"
            className="form-control"
            value={receiveDate}
            onChange={e => setReceiveDate(e.target.value)}
            required
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            onClick={() => receiveDate && onConfirm(receiveDate)}
            disabled={!receiveDate}
            className="btn btn-success"
          >
            <Check size={16} /> Confirm Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. CREATE CARGO BUNDLE MODAL
function CreateCargoModal({ vendorId, vendorName, selectedIds, requests, cargos = [], cargoCompanies = [], onClose, onSave }) {
  const [detail, setDetail] = useState("");
  const [currency, setCurrency] = useState("RMB");
  const [price, setPrice] = useState("");
  const [uom, setUom] = useState("per CBM");
  const [cbm, setCbm] = useState("");
  const [mode, setMode] = useState("Sea");
  const [cargoCompanyId, setCargoCompanyId] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [eta, setEta] = useState("");
  const [packingListFile, setPackingListFile] = useState(null);   // { name, data }
  const [invoiceFile, setInvoiceFile] = useState(null);           // { name, data }
  const [isRec, setIsRec] = useState("No");

  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ name: file.name, data: e.target.result });
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await readFile(file);
    setter(result);
  };

  // Sum of total price of items combined (converting to RMB base)
  const combinedRequests = requests.filter(r => selectedIds.includes(r.id));
  const totalItemSpendInRmb = combinedRequests.reduce((sum, r) => sum + convertToRmb(r.totalRmb, r.currency), 0);

  // Total Cargo price calculation
  const totalCargoPrice = uom === "per CBM" 
    ? (parseFloat(price || 0) * parseFloat(cbm || 0)) 
    : parseFloat(price || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      vendorId,
      cargoOrderDate: new Date().toISOString().split("T")[0],
      cargoDetail: detail,
      currency,
      cargoPrice: parseFloat(price || 0),
      cargoPriceUom: uom,
      cbmPackingList: parseFloat(cbm || 0),
      totalCargoPrice: totalCargoPrice,
      modeOfTransport: mode,
      cargoCompanyId: cargoCompanyId,
      cargoShippingDate: shipDate,
      cargoEta: eta,
      packingListFile: packingListFile?.name || "",
      packingListData: packingListFile?.data || "",
      invoiceFile: invoiceFile?.name || "",
      invoiceData: invoiceFile?.data || "",
      isMaterialRec: isRec
    });
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "600px" }}>
        <h3 style={{ fontSize: "1.4rem", marginBottom: "6px", color: "var(--primary)" }}>Create Combined Cargo Shipment</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
          Vendor: <strong>{vendorName}</strong> | Combining <strong>{selectedIds.length}</strong> purchase items (Total Value: ¥{totalItemSpendInRmb.toLocaleString(undefined, { maximumFractionDigits: 0 })} Est. in RMB)
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          
          <div className="form-group">
            <label className="form-label">Cargo Description / Detail</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. CNC Spindle shipment via Land" 
              value={detail}
              onChange={e => setDetail(e.target.value)}
              required
            />
          </div>

          {/* Pricing parameters */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo Price</label>
              <div style={{ display: "flex", gap: "6px" }}>
                <select className="form-control" style={{ width: "80px", flexShrink: 0 }} value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="RMB" style={{ background: "#0f172a" }}>RMB</option>
                  <option value="USD" style={{ background: "#0f172a" }}>USD</option>
                  <option value="INR" style={{ background: "#0f172a" }}>INR</option>
                </select>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Shipping rate" 
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  min="0"
                  step="any"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Price Unit (UOM)</label>
              <select className="form-control" value={uom} onChange={e => setUom(e.target.value)}>
                <option value="per CBM" style={{ background: "#0f172a" }}>per CBM</option>
                <option value="Flat Rate" style={{ background: "#0f172a" }}>Flat Rate</option>
                <option value="per KG" style={{ background: "#0f172a" }}>per KG</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CBM Volume (Packing List)</label>
              <input 
                type="number" 
                className="form-control" 
                placeholder="Volume in m³" 
                value={cbm}
                onChange={e => setCbm(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Calculated Cargo Cost</label>
              <input 
                type="text" 
                className="form-control" 
                value={`${getCurrencySymbol(currency)}${totalCargoPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                disabled
              />
            </div>
          </div>

          {/* Shipping logistics */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo Company / Shipper</label>
              <select 
                className="form-control" 
                value={cargoCompanyId} 
                onChange={e => setCargoCompanyId(e.target.value)}
              >
                <option value="" style={{ background: "#0f172a" }}>Select Cargo Company...</option>
                {cargoCompanies.filter(cc => cc.status !== "Inactive").map(cc => {
                  const metrics = calculateCargoCompanyMetrics(cc, cargos, requests);
                  const scoreText = metrics.scorePending
                    ? `Rating: Pending — Insufficient History [${metrics.completedCount}/5 completed]`
                    : `Rating: ${metrics.score}/100`;
                  return (
                    <option key={cc.id} value={cc.id} style={{ background: "#0f172a" }}>
                      {cc.name} ({scoreText})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transport Mode</label>
              <select className="form-control" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="Sea" style={{ background: "#0f172a" }}>Sea Cargo</option>
                <option value="Air" style={{ background: "#0f172a" }}>Air Freight</option>
                <option value="Land" style={{ background: "#0f172a" }}>Land Delivery</option>
                <option value="Express" style={{ background: "#0f172a" }}>Express / Courier</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Shipping Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={shipDate}
                onChange={e => setShipDate(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Expected Cargo ETA</label>
              <input 
                type="date" 
                className="form-control" 
                value={eta}
                onChange={e => setEta(e.target.value)}
              />
            </div>
          </div>

          {/* Document Uploads - Optional */}
          <div style={{ padding: "12px 14px", border: "1px dashed var(--border-glass)", borderRadius: "8px" }}>
            <h5 style={{ fontSize: "0.85rem", marginBottom: "12px", color: "var(--secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Upload size={14} /> Cargo Documents <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional — can be uploaded later)</span>
            </h5>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>
                  Packing List {packingListFile && <span style={{ color: "var(--success)", fontSize: "0.72rem" }}>✓ {packingListFile.name}</span>}
                </label>
                <label className="doc-upload-btn" style={{ height: "38px", padding: "6px 12px", fontSize: "0.8rem" }}>
                  <Upload size={13} /> {packingListFile ? "Replace File" : "Upload Packing List"}
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" onChange={e => handleFileChange(e, setPackingListFile)} style={{ display: "none" }} />
                </label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>
                  Invoice {invoiceFile && <span style={{ color: "var(--success)", fontSize: "0.72rem" }}>✓ {invoiceFile.name}</span>}
                </label>
                <label className="doc-upload-btn" style={{ height: "38px", padding: "6px 12px", fontSize: "0.8rem" }}>
                  <Upload size={13} /> {invoiceFile ? "Replace File" : "Upload Invoice"}
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" onChange={e => handleFileChange(e, setInvoiceFile)} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Is Cargo Received? (Bulk status)</label>
            <select className="form-control" value={isRec} onChange={e => setIsRec(e.target.value)}>
              <option value="No" style={{ background: "#0f172a" }}>No - In Transit</option>
              <option value="Yes" style={{ background: "#0f172a" }}>Yes - Received at Warehouse</option>
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Create Cargo</button>
          </div>

        </form>
      </div>
    </div>
  );
}

// 4. EDIT CARGO MODAL
function EditCargoModal({ cargo, cargos = [], requests = [], cargoCompanies = [], onClose, onSave }) {
  const [detail, setDetail] = useState(cargo.cargoDetail || "");
  const [currency, setCurrency] = useState(cargo.currency || "RMB");
  const [price, setPrice] = useState(cargo.cargoPrice || "");
  const [uom, setUom] = useState(cargo.cargoPriceUom || "per CBM");
  const [cbm, setCbm] = useState(cargo.cbmPackingList || "");
  const [mode, setMode] = useState(cargo.modeOfTransport || "Sea");
  const [cargoCompanyId, setCargoCompanyId] = useState(cargo.cargoCompanyId || "");
  const [shipDate, setShipDate] = useState(cargo.cargoShippingDate || "");
  const [eta, setEta] = useState(cargo.cargoEta || "");
  // File state: keep existing filename/data OR allow new upload
  const [packingListFile, setPackingListFile] = useState(
    cargo.packingListFile ? { name: cargo.packingListFile, data: cargo.packingListData || "" } : null
  );
  const [invoiceFile, setInvoiceFile] = useState(
    cargo.invoiceFile ? { name: cargo.invoiceFile, data: cargo.invoiceData || "" } : null
  );
  const [isRec, setIsRec] = useState(cargo.isMaterialRec || "No");

  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ name: file.name, data: e.target.result });
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await readFile(file);
    setter(result);
  };

  const totalCargoPrice = uom === "per CBM" 
    ? (parseFloat(price || 0) * parseFloat(cbm || 0)) 
    : parseFloat(price || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...cargo,
      cargoDetail: detail,
      currency,
      cargoPrice: parseFloat(price || 0),
      cargoPriceUom: uom,
      cbmPackingList: parseFloat(cbm || 0),
      totalCargoPrice: totalCargoPrice,
      modeOfTransport: mode,
      cargoCompanyId: cargoCompanyId,
      cargoShippingDate: shipDate,
      cargoEta: eta,
      packingListFile: packingListFile?.name || "",
      packingListData: packingListFile?.data || "",
      invoiceFile: invoiceFile?.name || "",
      invoiceData: invoiceFile?.data || "",
      isMaterialRec: isRec
    });
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "600px" }}>
        <h3 style={{ fontSize: "1.4rem", marginBottom: "20px", color: "var(--primary)" }}>Update Shipping & Cargo Details</h3>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          
          <div className="form-group">
            <label className="form-label">Cargo Description / Detail</label>
            <input 
              type="text" 
              className="form-control" 
              value={detail}
              onChange={e => setDetail(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo Price</label>
              <div style={{ display: "flex", gap: "6px" }}>
                <select className="form-control" style={{ width: "80px", flexShrink: 0 }} value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="RMB" style={{ background: "#0f172a" }}>RMB</option>
                  <option value="USD" style={{ background: "#0f172a" }}>USD</option>
                  <option value="INR" style={{ background: "#0f172a" }}>INR</option>
                </select>
                <input 
                  type="number" 
                  className="form-control" 
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  min="0"
                  step="any"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Price Unit (UOM)</label>
              <select className="form-control" value={uom} onChange={e => setUom(e.target.value)}>
                <option value="per CBM" style={{ background: "#0f172a" }}>per CBM</option>
                <option value="Flat Rate" style={{ background: "#0f172a" }}>Flat Rate</option>
                <option value="per KG" style={{ background: "#0f172a" }}>per KG</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CBM Volume (Packing List)</label>
              <input 
                type="number" 
                className="form-control" 
                value={cbm}
                onChange={e => setCbm(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Calculated Cargo Cost</label>
              <input 
                type="text" 
                className="form-control" 
                value={`${getCurrencySymbol(currency)}${totalCargoPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                disabled
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo Company</label>
              <select 
                className="form-control" 
                value={cargoCompanyId} 
                onChange={e => setCargoCompanyId(e.target.value)}
              >
                <option value="" style={{ background: "#0f172a" }}>Select Cargo Company...</option>
                {cargoCompanies.filter(cc => cc.status !== "Inactive").map(cc => {
                  const metrics = calculateCargoCompanyMetrics(cc, cargos, requests);
                  const scoreText = metrics.scorePending
                    ? `Rating: Pending — Insufficient History [${metrics.completedCount}/5 completed]`
                    : `Rating: ${metrics.score}/100`;
                  return (
                    <option key={cc.id} value={cc.id} style={{ background: "#0f172a" }}>
                      {cc.name} ({scoreText})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transport Mode</label>
              <select className="form-control" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="Sea" style={{ background: "#0f172a" }}>Sea Cargo</option>
                <option value="Air" style={{ background: "#0f172a" }}>Air Freight</option>
                <option value="Land" style={{ background: "#0f172a" }}>Land Delivery</option>
                <option value="Express" style={{ background: "#0f172a" }}>Express / Courier</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Shipping Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={shipDate}
                onChange={e => setShipDate(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Expected Cargo ETA</label>
              <input 
                type="date" 
                className="form-control" 
                value={eta}
                onChange={e => setEta(e.target.value)}
              />
            </div>
          </div>

          {/* Document Uploads */}
          <div style={{ padding: "12px 14px", border: "1px dashed var(--border-glass)", borderRadius: "8px" }}>
            <h5 style={{ fontSize: "0.85rem", marginBottom: "12px", color: "var(--secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Upload size={14} /> Cargo Documents <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
            </h5>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>
                  Packing List {packingListFile && <span style={{ color: "var(--success)", fontSize: "0.72rem" }}>✓ {packingListFile.name}</span>}
                  {!packingListFile && <span style={{ color: "#f59e0b", fontSize: "0.72rem" }}> ⚠ Missing</span>}
                </label>
                <label className="doc-upload-btn" style={{ height: "38px", padding: "6px 12px", fontSize: "0.8rem" }}>
                  <Upload size={13} /> {packingListFile ? "Replace File" : "Upload Packing List"}
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" onChange={e => handleFileChange(e, setPackingListFile)} style={{ display: "none" }} />
                </label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>
                  Invoice {invoiceFile && <span style={{ color: "var(--success)", fontSize: "0.72rem" }}>✓ {invoiceFile.name}</span>}
                  {!invoiceFile && <span style={{ color: "#f59e0b", fontSize: "0.72rem" }}> ⚠ Missing</span>}
                </label>
                <label className="doc-upload-btn" style={{ height: "38px", padding: "6px 12px", fontSize: "0.8rem" }}>
                  <Upload size={13} /> {invoiceFile ? "Replace File" : "Upload Invoice"}
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" onChange={e => handleFileChange(e, setInvoiceFile)} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Is Cargo Received? (Propagates to all bundled items)</label>
            <select className="form-control" value={isRec} onChange={e => setIsRec(e.target.value)}>
              <option value="No" style={{ background: "#0f172a" }}>No - In Transit</option>
              <option value="Yes" style={{ background: "#0f172a" }}>Yes - Received at Warehouse</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ==================== PENDING DOCUMENTS PANEL ====================
function PendingDocumentsPanel({ cargos, requests, vendors, cargoCompanies, onUpdateCargo, onUpdateRequest }) {
  const [uploadingCargo, setUploadingCargo] = useState(null); // cargo being edited for docs
  const [itemPackingFiles, setItemPackingFiles] = useState({}); // { requestId: { name, data } }

  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ name: file.name, data: e.target.result });
    reader.readAsDataURL(file);
  });

  // Cargos that have at least one missing document
  const pendingCargos = cargos.filter(c => !c.packingListFile || !c.invoiceFile);
  const completeCargos = cargos.filter(c => c.packingListFile && c.invoiceFile);

  const handleCargoDocUpload = async (cargoId, field, dataField, file) => {
    if (!file) return;
    const result = await readFile(file);
    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo) return;
    onUpdateCargo({ ...cargo, [field]: result.name, [dataField]: result.data });
  };

  const handleItemPackingUpload = async (requestId, file) => {
    if (!file) return;
    const result = await readFile(file);
    setItemPackingFiles(prev => ({ ...prev, [requestId]: result }));
  };

  const saveItemPacking = (request) => {
    const fileData = itemPackingFiles[request.id];
    if (!fileData) return;
    onUpdateRequest({ ...request, itemPackingListFile: fileData.name, itemPackingListData: fileData.data });
    setItemPackingFiles(prev => { const n = { ...prev }; delete n[request.id]; return n; });
  };

  return (
    <div className="card-fade-in">
      <h3 style={{ fontSize: "1.4rem", marginBottom: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
        <FileText size={22} style={{ color: "#f59e0b" }} /> Pending Document Uploads
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
        Upload packing lists and invoices for cargo shipments. Packing lists can be uploaded per order item individually within the same cargo.
      </p>

      {pendingCargos.length === 0 ? (
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <CheckCircle2 size={36} style={{ color: "var(--success)", marginBottom: "12px", display: "inline" }} /><br />
          All cargo shipments have their documents uploaded. No pending uploads.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {pendingCargos.map(cargo => {
            const vName = vendors.find(v => v.id === cargo.vendorId)?.name || "—";
            const cargoItems = requests.filter(r => r.cargoId === cargo.id && r.status !== "Cancelled");
            return (
              <div key={cargo.id} className="glass-panel" style={{ padding: "20px" }}>
                {/* Cargo header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>Cargo: {cargo.id}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Vendor: <strong>{vName}</strong> | Mode: {cargo.modeOfTransport} | {cargoItems.length} item(s)
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {!cargo.packingListFile && <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "6px", padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600 }}>⚠ Packing List Missing</span>}
                    {!cargo.invoiceFile && <span style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "6px", padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600 }}>⚠ Invoice Missing</span>}
                  </div>
                </div>

                {/* Cargo-level uploads: Invoice (one per cargo) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                  {/* Packing List — cargo level (if cargo has one missing) */}
                  <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>CARGO PACKING LIST</div>
                    {cargo.packingListFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--success)" }}>✓</span>
                        <span className="doc-link">📄 {cargo.packingListFile}</span>
                        <label style={{ cursor: "pointer", color: "var(--primary)", fontSize: "0.75rem" }}>
                          Replace
                          <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" style={{ display: "none" }}
                            onChange={e => handleCargoDocUpload(cargo.id, "packingListFile", "packingListData", e.target.files[0])} />
                        </label>
                      </div>
                    ) : (
                      <label className="doc-upload-btn" style={{ height: "36px", padding: "6px 12px", fontSize: "0.8rem" }}>
                        <Upload size={13} /> Upload Cargo Packing List
                        <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" style={{ display: "none" }}
                          onChange={e => handleCargoDocUpload(cargo.id, "packingListFile", "packingListData", e.target.files[0])} />
                      </label>
                    )}
                  </div>

                  {/* Invoice — one per cargo */}
                  <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 600 }}>INVOICE</div>
                    {cargo.invoiceFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--success)" }}>✓</span>
                        <span className="doc-link">📄 {cargo.invoiceFile}</span>
                        <label style={{ cursor: "pointer", color: "var(--primary)", fontSize: "0.75rem" }}>
                          Replace
                          <input type="file" accept=".pdf,.xlsx,.xls,image/*" style={{ display: "none" }}
                            onChange={e => handleCargoDocUpload(cargo.id, "invoiceFile", "invoiceData", e.target.files[0])} />
                        </label>
                      </div>
                    ) : (
                      <label className="doc-upload-btn" style={{ height: "36px", padding: "6px 12px", fontSize: "0.8rem" }}>
                        <Upload size={13} /> Upload Invoice
                        <input type="file" accept=".pdf,.xlsx,.xls,image/*" style={{ display: "none" }}
                          onChange={e => handleCargoDocUpload(cargo.id, "invoiceFile", "invoiceData", e.target.files[0])} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Per-item packing lists */}
                {cargoItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Per-Order Packing Lists ({cargoItems.length} items)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {cargoItems.map(item => {
                        const staged = itemPackingFiles[item.id];
                        return (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-glass)", borderRadius: "6px", padding: "8px 14px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ fontSize: "0.85rem" }}>
                              <strong>{item.model}</strong> — Qty: {item.orderQuantity}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {item.itemPackingListFile ? (
                                <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>✓ {item.itemPackingListFile}</span>
                              ) : (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No packing list</span>
                              )}
                              {staged ? (
                                <>
                                  <span style={{ fontSize: "0.75rem", color: "#f59e0b" }}>📎 {staged.name}</span>
                                  <button onClick={() => saveItemPacking(item)} className="btn btn-success btn-sm" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                                    <Check size={12} /> Save
                                  </button>
                                  <button onClick={() => setItemPackingFiles(prev => { const n = { ...prev }; delete n[item.id]; return n; })} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>✕</button>
                                </>
                              ) : (
                                <label className="doc-upload-btn" style={{ height: "30px", padding: "4px 10px", fontSize: "0.75rem", margin: 0 }}>
                                  <Upload size={11} /> {item.itemPackingListFile ? "Replace" : "Upload"}
                                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" style={{ display: "none" }}
                                    onChange={e => handleItemPackingUpload(item.id, e.target.files[0])} />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete cargos section */}
      {completeCargos.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} /> Documents Complete ({completeCargos.length} cargos)
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {completeCargos.map(cargo => {
              const vName = vendors.find(v => v.id === cargo.vendorId)?.name || "—";
              const cargoItems = requests.filter(r => r.cargoId === cargo.id && r.status !== "Cancelled");
              return (
                <div key={cargo.id} className="glass-panel" style={{ padding: "14px 18px", opacity: 0.75 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ fontSize: "0.9rem" }}>
                      <strong>{cargo.id}</strong> — {vName} — {cargoItems.length} item(s)
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--success)" }}>✓ Packing List: {cargo.packingListFile}</span>
                      <span style={{ color: "var(--success)" }}>✓ Invoice: {cargo.invoiceFile}</span>
                    </div>
                  </div>
                  {/* Per-item packing list status */}
                  {cargoItems.some(i => i.itemPackingListFile) && (
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {cargoItems.map(item => item.itemPackingListFile ? (
                        <span key={item.id} style={{ fontSize: "0.72rem", background: "rgba(16,185,129,0.1)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "4px", padding: "2px 8px" }}>
                          {item.model}: {item.itemPackingListFile}
                        </span>
                      ) : null)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 5. MY VENDORS PANEL FOR PURCHASERS
function MyVendorsPanel({ currentUser, vendors, onAddVendor, onUpdateVendor, onRemoveVendor, onSelectVendor }) {
  const [newVendorName, setNewVendorName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const myVendors = vendors.filter(v => v.purchaserIds?.includes(currentUser.id));
  const displayedVendors = myVendors.filter(v => showInactive || v.status !== "Inactive");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    const res = onAddVendor(
      newVendorName.trim(), 
      [currentUser.id], 
      location.trim(), 
      phone.trim(), 
      history.trim()
    );
    if (res && !res.success) {
      setError(res.message);
      setTimeout(() => setError(""), 4000);
      return;
    }
    setSuccess(`Vendor "${newVendorName}" registered successfully!`);
    setNewVendorName("");
    setLocation("");
    setPhone("");
    setHistory("");
    setError("");
    setTimeout(() => setSuccess(""), 3000);
  };

  return (
    <div className="card-fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "30px", alignItems: "start" }}>
      {/* Vendor List */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", color: "var(--primary)", margin: 0 }}>Registered Vendor Directory</h3>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={showInactive} 
              onChange={e => setShowInactive(e.target.checked)} 
              style={{ cursor: "pointer" }}
            />
            Show Inactive
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
          {displayedVendors.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
              {showInactive ? "No vendors registered." : "No active vendors. Check 'Show Inactive' or register one on the right!"}
            </div>
          ) : (
            displayedVendors.map(vendor => (
              <div 
                key={vendor.id} 
                className="glass-panel" 
                onClick={() => onSelectVendor(vendor)}
                style={{ 
                  padding: "16px 20px", 
                  background: "rgba(255, 255, 255, 0.02)", 
                  cursor: "pointer", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  borderRadius: "8px",
                  border: "1px solid var(--border-glass)",
                  transition: "all 0.2s ease",
                  opacity: vendor.status === "Inactive" ? 0.55 : 1
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  {vendor.name} {vendor.status === "Inactive" && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>(Inactive)</span>}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>View Details</span>
                  <ChevronRight size={16} style={{ color: "var(--primary)" }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Register Vendor */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Register New Vendor</h3>
        {success && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{success}</div>}
        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Vendor Name</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shenzhen Supply Hub"
              value={newVendorName}
              onChange={e => setNewVendorName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location / Address</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shenzhen, China"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. +86 755 8888 9999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">History / Notes</label>
            <textarea 
              className="form-control" 
              placeholder="e.g. Original PLC chips supplier, reliable..."
              value={history}
              onChange={e => setHistory(e.target.value)}
              rows="3"
              style={{ resize: "vertical" }}
            />
          </div>

          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px", display: "block", lineHeight: "1.4" }}>
            Note: Once registered, you cannot edit the vendor name. Only the Super User can edit registered vendor names.
          </span>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            <Plus size={16} /> Register Vendor
          </button>
        </form>
      </div>
    </div>
  );
}

// 6. CARGO COMPANIES PANEL FOR PURCHASERS & ADMINS
export function CargoCompaniesPanel({ cargoCompanies, onAddCargoCompany, onUpdateCargoCompany, onRemoveCargoCompany, onSelectCargoCompany }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [history, setHistory] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const displayedCargoCompanies = cargoCompanies.filter(cc => showInactive || cc.status !== "Inactive");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = onAddCargoCompany(name.trim(), location.trim(), phone.trim(), history.trim());
    if (res && !res.success) {
      setError(res.message);
      setTimeout(() => setError(""), 4000);
      return;
    }
    setSuccess(`Cargo Company "${name}" registered successfully!`);
    setName("");
    setLocation("");
    setPhone("");
    setHistory("");
    setError("");
    setTimeout(() => setSuccess(""), 3000);
  };

  return (
    <div className="card-fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "30px", alignItems: "start" }}>
      {/* Cargo Companies List */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", color: "var(--primary)", margin: 0 }}>Registered Logistics Carriers</h3>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={showInactive} 
              onChange={e => setShowInactive(e.target.checked)} 
              style={{ cursor: "pointer" }}
            />
            Show Inactive
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
          {displayedCargoCompanies.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
              {showInactive ? "No cargo carriers registered." : "No active logistics carriers. Check 'Show Inactive' or register one on the right!"}
            </div>
          ) : (
            displayedCargoCompanies.map(cc => (
              <div 
                key={cc.id} 
                className="glass-panel" 
                onClick={() => onSelectCargoCompany(cc)}
                style={{ 
                  padding: "16px 20px", 
                  background: "rgba(255, 255, 255, 0.02)", 
                  cursor: "pointer", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  borderRadius: "8px",
                  border: "1px solid var(--border-glass)",
                  transition: "all 0.2s ease",
                  opacity: cc.status === "Inactive" ? 0.55 : 1
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  {cc.name} {cc.status === "Inactive" && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>(Inactive)</span>}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>View Details</span>
                  <ChevronRight size={16} style={{ color: "var(--primary)" }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Register Cargo Company */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Register Logistics Carrier</h3>
        {success && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{success}</div>}
        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Maersk Logistics"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location / Address</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shenzhen Port, China"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. +86 755 8888 1234"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">History / Notes</label>
            <textarea 
              className="form-control" 
              placeholder="e.g. Preferred carrier for ocean freight..."
              value={history}
              onChange={e => setHistory(e.target.value)}
              rows="3"
              style={{ resize: "vertical" }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
            <Plus size={16} /> Register Cargo Company
          </button>
        </form>
      </div>
    </div>
  );
}

// 7. VENDOR DETAIL MODAL WITH HISTORY & PROFILE EDITS
export function VendorDetailModal({ 
  vendor, 
  requests, 
  cargos, 
  purchasers, 
  currentUser, 
  onUpdateVendor, 
  onRemoveVendor, 
  onClose 
}) {
  const [name, setName] = useState(vendor.name);
  const [location, setLocation] = useState(vendor.location || "");
  const [phone, setPhone] = useState(vendor.phone || "");
  const [history, setHistory] = useState(vendor.history || "");
  const [status, setStatus] = useState(vendor.status || "Active");
  const [purchaserIds, setPurchaserIds] = useState(vendor.purchaserIds || []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUser.role === "superadmin";
  const vendorRequests = requests.filter(r => r.vendorId === vendor.id && (isAdmin || r.purchaserId === currentUser.id));

  // Calculate Metrics
  const metrics = calculateVendorMetrics(vendor, requests);
  const { score, scorePending, completedCount, otdRate, avgDelay, totalOrders, delayedOrders, categoryData, statusData, delays } = metrics;

  // Score styling
  let scoreColor = "var(--success)";
  let scoreGlow = "rgba(16, 185, 129, 0.2)";
  if (scorePending) {
    scoreColor = "var(--text-muted)";
    scoreGlow = "rgba(255, 255, 255, 0.05)";
  } else if (score < 70) {
    scoreColor = "var(--danger)";
    scoreGlow = "rgba(239, 68, 68, 0.2)";
  } else if (score < 85) {
    scoreColor = "var(--warning)";
    scoreGlow = "rgba(245, 158, 11, 0.2)";
  }

  // SVG parameters
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (otdRate / 100) * circumference;

  const handleSave = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Vendor name cannot be empty.");
      return;
    }

    const updatedVendor = {
      ...vendor,
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: status,
      purchaserIds: purchaserIds
    };

    const res = onUpdateVendor(updatedVendor);
    if (res && !res.success) {
      setError(res.message);
      return;
    }

    setSuccess("Vendor details updated successfully!");
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "780px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)" }}>Vendor Profile & Performance Tracker</h3>
          <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}
        {success && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{success}</div>}

        {/* KPI Scorecard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1.5px solid ${scoreColor}`, boxShadow: `0 0 12px ${scoreGlow}` }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Performance Rating</span>
            <span style={{ fontSize: "1.8rem", fontWeight: "extrabold", color: scoreColor, margin: "6px 0" }}>{scorePending ? "Pending" : `${score}/100`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>{scorePending ? `Progress: ${completedCount}/5 deliveries` : "Overall Vendor Rating"}</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>On-Time Fulfillment Rate</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: scorePending ? "var(--text-muted)" : (otdRate >= 85 ? "var(--success)" : otdRate >= 70 ? "var(--warning)" : "var(--danger)"), margin: "6px 0" }}>{scorePending ? "N/A" : `${otdRate}%`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Target KPI: &ge; 85%</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Average Fulfillment Delay</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: scorePending ? "var(--text-muted)" : (avgDelay === 0 ? "var(--success)" : avgDelay <= 3 ? "var(--warning)" : "var(--danger)"), margin: "6px 0" }}>{scorePending ? "N/A" : `${avgDelay}d`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Overdue days per order</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Fulfillment Transactions</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: "var(--secondary)", margin: "6px 0" }}>{totalOrders}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>With EDD populated</span>
          </div>
        </div>

        {/* SVG Charts Panel */}
        {totalOrders > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {/* Donut chart for OTD Rate */}
            {scorePending ? (
              <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "20px", alignItems: "center", border: "1px dashed var(--border-glass)" }}>
                <div style={{ flexShrink: 0, width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(255,255,255,0.02)", border: "2px dashed var(--border-glass)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "bold" }}>Pending</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", color: "var(--text-muted)" }}>On-Time Fulfillment Rate</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                    Performance rating and timeline analysis will activate once the vendor completes at least 5 successful deliveries (Currently: {completedCount}/5).
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ flexShrink: 0 }}>
                  <svg width="90" height="90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="9"/>
                    <circle cx="50" cy="50" r={radius} fill="none" stroke={otdRate >= 85 ? "var(--success)" : otdRate >= 70 ? "var(--warning)" : "var(--danger)"} strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 50 50)"/>
                    <text x="50" y="56" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">{otdRate}%</text>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", color: "var(--primary)" }}>On-Time Fulfillment Rate</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                    Measures the vendor's fulfillment timeliness against committed estimated delivery timelines.
                  </p>
                </div>
              </div>
            )}

            {/* Categorywise & Status bar chart combo */}
            <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--secondary)" }}>Fulfillment Category Distribution</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem", width: "100%" }}>
                {categoryData.slice(0, 3).map(item => {
                  const maxVal = Math.max(...categoryData.map(c => c.value), 1);
                  const percent = (item.value / maxVal) * 100;
                  return (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "110px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.name}</div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px" }}>
                        <div style={{ background: "var(--secondary)", height: "100%", width: `${percent}%`, borderRadius: "4px" }}></div>
                      </div>
                      <div style={{ width: "16px", fontWeight: "bold", fontSize: "0.75rem", textAlign: "right" }}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Profile Editing Form */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Vendor Name {!isAdmin && " (Read Only)"}</label>
              <input 
                type="text" 
                className="form-control" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                disabled={!isAdmin} 
                style={{ opacity: isAdmin ? 1 : 0.7 }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Location / Address</label>
              <input 
                type="text" 
                className="form-control" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select 
                className="form-control" 
                value={status} 
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Active" style={{ background: "#0f172a" }}>Active</option>
                <option value="Inactive" style={{ background: "#0f172a" }}>Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">History Logs / Profile Notes</label>
            <textarea 
              className="form-control" 
              value={history} 
              onChange={e => setHistory(e.target.value)} 
              rows="2"
            />
          </div>

          {/* Assigned Purchasers (Only visible to Admin) */}
          {isAdmin && (
            <div className="form-group">
              <label className="form-label" style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Assigned Purchasers (Shared Vendor Hub):
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                {purchasers.map(p => {
                  const isAssigned = purchaserIds.includes(p.id);
                  return (
                    <label key={p.id} className="checkbox-label" style={{ fontSize: "0.8rem" }}>
                      <input 
                        type="checkbox"
                        className="checkbox-input"
                        checked={isAssigned}
                        onChange={e => {
                          if (e.target.checked) {
                            setPurchaserIds(prev => [...prev, p.id]);
                          } else {
                            setPurchaserIds(prev => prev.filter(id => id !== p.id));
                          }
                        }}
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>

        {/* Fulfillment Exception Log */}
        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "16px", marginBottom: "20px" }}>
          <h4 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--danger)" }}>Fulfillment Exception Log ({delays.length})</h4>
          {delays.length === 0 ? (
            <div style={{ color: "var(--success)", fontSize: "0.85rem", padding: "12px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.1)" }}>
              ✓ Excellent performance! No unreceived overdue orders or late deliveries recorded for this vendor.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Expected Delivery (EDD)</th>
                    <th>Date Received/Status</th>
                    <th>Delay Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {delays.map((d, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{d.model}</td>
                      <td>{d.edd}</td>
                      <td>{d.received}</td>
                      <td style={{ color: "var(--danger)", fontWeight: "bold" }}>+{d.days} days</td>
                      <td>
                        <span className={`badge ${d.status === "Overdue" ? "badge-rejected" : "badge-pending"}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purchase Orders History */}
        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "16px" }}>
          <h4 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--secondary)" }}>Transaction History ({vendorRequests.length} Orders)</h4>
          {vendorRequests.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
              No purchase orders found for this vendor.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Order Date</th>
                    <th>Model</th>
                    <th>Qty</th>
                    <th>Total Price</th>
                    <th>Cargo ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorRequests.map(r => {
                    let statusLabel = "Awaiting Details";
                    let statusClass = "badge-pending";
                    if (r.isMaterialRec === "Yes") {
                      statusLabel = "Received";
                      statusClass = "badge-received";
                    } else if (r.cargoId) {
                      statusLabel = "In Transit";
                      statusClass = "badge-cargo";
                    } else if (r.priceRmb) {
                      statusLabel = "Priced";
                      statusClass = "badge-approved";
                    }

                    return (
                      <tr key={r.id}>
                        <td>{r.orderDate}</td>
                        <td style={{ fontWeight: 600 }}>{r.model}</td>
                        <td>{r.orderQuantity}</td>
                        <td>{r.priceRmb ? `${getCurrencySymbol(r.currency)}${Number(r.totalRmb).toLocaleString()}` : "—"}</td>
                        <td>{r.cargoId || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td>
                          <span className={`badge ${statusClass}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 8. CARGO COMPANY DETAIL MODAL WITH HISTORY & PROFILE EDITS
export function CargoCompanyDetailModal({
  company,
  cargos,
  requests,
  currentUser,
  onUpdateCargoCompany,
  onRemoveCargoCompany,
  onClose
}) {
  const [name, setName] = useState(company.name);
  const [location, setLocation] = useState(company.location || "");
  const [phone, setPhone] = useState(company.phone || "");
  const [history, setHistory] = useState(company.history || "");
  const [status, setStatus] = useState(company.status || "Active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const companyCargos = cargos.filter(c => c.cargoCompanyId === company.id);

  // Calculate metrics
  const metrics = calculateCargoCompanyMetrics(company, cargos, requests);
  const { score, scorePending, completedCount, otaRate, avgDelay, totalCargos, delayedCargos, modeData, delays } = metrics;

  // Score styling
  let scoreColor = "var(--success)";
  let scoreGlow = "rgba(16, 185, 129, 0.2)";
  if (scorePending) {
    scoreColor = "var(--text-muted)";
    scoreGlow = "rgba(255, 255, 255, 0.05)";
  } else if (score < 70) {
    scoreColor = "var(--danger)";
    scoreGlow = "rgba(239, 68, 68, 0.2)";
  } else if (score < 85) {
    scoreColor = "var(--warning)";
    scoreGlow = "rgba(245, 158, 11, 0.2)";
  }

  // SVG parameters
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (otaRate / 100) * circumference;

  const handleSave = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Company name cannot be empty.");
      return;
    }

    const updatedCompany = {
      ...company,
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: status
    };

    const res = onUpdateCargoCompany(updatedCompany);
    if (res && !res.success) {
      setError(res.message);
      return;
    }

    setSuccess("Cargo company details updated successfully!");
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content" style={{ maxWidth: "780px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)" }}>Cargo Company Profile & Performance</h3>
          <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}
        {success && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{success}</div>}

        {/* KPI Scorecard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "20px" }}>
          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1.5px solid ${scoreColor}`, boxShadow: `0 0 12px ${scoreGlow}` }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Logistics Rating</span>
            <span style={{ fontSize: "1.8rem", fontWeight: "extrabold", color: scoreColor, margin: "6px 0" }}>{scorePending ? "Pending" : `${score}/100`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>{scorePending ? `Progress: ${completedCount}/5 shipments` : "Logistics Performance Rating"}</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>On-Time Arrival Rate (OTA)</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: scorePending ? "var(--text-muted)" : (otaRate >= 85 ? "var(--success)" : otaRate >= 70 ? "var(--warning)" : "var(--danger)"), margin: "6px 0" }}>{scorePending ? "N/A" : `${otaRate}%`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Target KPI: &ge; 85%</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Average Transit Delay</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: scorePending ? "var(--text-muted)" : (avgDelay === 0 ? "var(--success)" : avgDelay <= 3 ? "var(--warning)" : "var(--danger)"), margin: "6px 0" }}>{scorePending ? "N/A" : `${avgDelay}d`}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Days per shipment</span>
          </div>

          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Logistics Shipments</span>
            <span style={{ fontSize: "2rem", fontWeight: "extrabold", color: "var(--secondary)", margin: "6px 0" }}>{totalCargos}</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>Total registered cargos</span>
          </div>
        </div>

        {/* SVG Charts Panel */}
        {totalCargos > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {/* Donut chart for OTA Rate */}
            {scorePending ? (
              <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "20px", alignItems: "center", border: "1px dashed var(--border-glass)" }}>
                <div style={{ flexShrink: 0, width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(255,255,255,0.02)", border: "2px dashed var(--border-glass)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "bold" }}>Pending</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", color: "var(--text-muted)" }}>On-Time Arrival Rate</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                    Performance rating and timeline analysis will activate once the carrier completes at least 5 successful cargo shipments (Currently: {completedCount}/5).
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ flexShrink: 0 }}>
                  <svg width="90" height="90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="9"/>
                    <circle cx="50" cy="50" r={radius} fill="none" stroke={otaRate >= 85 ? "var(--success)" : otaRate >= 70 ? "var(--warning)" : "var(--danger)"} strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 50 50)"/>
                    <text x="50" y="56" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">{otaRate}%</text>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase", color: "var(--primary)" }}>On-Time Arrival Rate</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                    Measures how reliably the shipper meets estimated arrival times (ETA) at the destination warehouse.
                  </p>
                </div>
              </div>
            )}

            {/* Transport mode distribution */}
            <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--secondary)" }}>Logistics Mode Distribution</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem", width: "100%" }}>
                {modeData.map(item => {
                  const maxVal = Math.max(...modeData.map(m => m.value), 1);
                  const percent = (item.value / maxVal) * 100;
                  return (
                    <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "90px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{item.name}</div>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", height: "8px", borderRadius: "4px" }}>
                        <div style={{ background: "var(--secondary)", height: "100%", width: `${percent}%`, borderRadius: "4px" }}></div>
                      </div>
                      <div style={{ width: "16px", fontWeight: "bold", fontSize: "0.75rem", textAlign: "right" }}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Profile Editing Form */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Location / Address</label>
              <input 
                type="text" 
                className="form-control" 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select 
                className="form-control" 
                value={status} 
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Active" style={{ background: "#0f172a" }}>Active</option>
                <option value="Inactive" style={{ background: "#0f172a" }}>Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">History Logs / Profile Notes</label>
            <textarea 
              className="form-control" 
              value={history} 
              onChange={e => setHistory(e.target.value)} 
              rows="2"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>

        {/* Logistics Exception Log */}
        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "16px", marginBottom: "20px" }}>
          <h4 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--danger)" }}>Logistics Exception Log ({delays.length})</h4>
          {delays.length === 0 ? (
            <div style={{ color: "var(--success)", fontSize: "0.85rem", padding: "12px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.1)" }}>
              ✓ Excellent performance! No unreceived overdue shipments or late arrivals recorded for this cargo company.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Cargo Code</th>
                    <th>Committed ETA</th>
                    <th>Date Received/Status</th>
                    <th>Delay Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {delays.map((d, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{d.id}</td>
                      <td>{d.eta}</td>
                      <td>{d.received}</td>
                      <td style={{ color: "var(--danger)", fontWeight: "bold" }}>+{d.days} days</td>
                      <td>
                        <span className={`badge ${d.status === "Overdue" ? "badge-rejected" : "badge-pending"}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cargo Shipments History */}
        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "16px" }}>
          <h4 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--secondary)" }}>Shipment History ({companyCargos.length} Shipments)</h4>
          {companyCargos.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
              No shipments found for this cargo company.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th>Cargo Code</th>
                    <th>Shipping Date</th>
                    <th>ETA</th>
                    <th>Volume (CBM)</th>
                    <th>Transport Mode</th>
                    <th>Cargo Cost</th>
                    <th>Bundled Items</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companyCargos.map(c => {
                    const cargoItems = requests.filter(r => r.cargoId === c.id);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.id}</td>
                        <td>{c.cargoShippingDate || "—"}</td>
                        <td>{c.cargoEta || "—"}</td>
                        <td>{c.cbmPackingList ? `${c.cbmPackingList} CBM` : "—"}</td>
                        <td>{c.modeOfTransport || "—"}</td>
                        <td>{getCurrencySymbol(c.currency)}{Number(c.totalCargoPrice || 0).toLocaleString()}</td>
                        <td>{cargoItems.length} items</td>
                        <td>
                          <span className={`badge ${c.isMaterialRec === "Yes" ? "badge-received" : "badge-cargo"}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                            {c.isMaterialRec === "Yes" ? "Received" : "In Transit"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 9. METRIC CALCULATION HELPERS
export const getDelayDays = (date1Str, date2Str) => {
  if (!date1Str || !date2Str) return 0;
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  const diffTime = d1 - d2;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const calculateVendorMetrics = (vendor, requests) => {
  const vendorRequests = requests.filter(r => r.vendorId === vendor.id && r.vendorEdd);
  const totalOrders = vendorRequests.length;
  const completedCount = requests.filter(r => r.vendorId === vendor.id && r.isMaterialRec === "Yes").length;
  const scorePending = completedCount < 5;

  let delayedOrdersCount = 0;
  let totalDelayDays = 0;
  const delays = [];
  const categoryCount = {};
  const statusCount = { awaitingPrice: 0, inTransit: 0, received: 0 };

  vendorRequests.forEach(r => {
    if (r.isMaterialRec === "Yes") {
      statusCount.received += 1;
    } else if (r.cargoId) {
      statusCount.inTransit += 1;
    } else {
      statusCount.awaitingPrice += 1;
    }

    const cat = r.category || "Other";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;

    let delay = 0;
    const systemDate = "2026-06-11";
    if (r.isMaterialRec === "Yes") {
      const recDate = r.actualReceivedDate || systemDate;
      delay = getDelayDays(recDate, r.vendorEdd);
      if (delay > 0) {
        delayedOrdersCount += 1;
        totalDelayDays += delay;
        delays.push({
          model: r.model,
          edd: r.vendorEdd,
          received: recDate,
          days: delay,
          status: "Received"
        });
      }
    } else {
      delay = getDelayDays(systemDate, r.vendorEdd);
      if (delay > 0) {
        delayedOrdersCount += 1;
        totalDelayDays += delay;
        delays.push({
          model: r.model,
          edd: r.vendorEdd,
          received: "Overdue (Expected)",
          days: delay,
          status: "Overdue"
        });
      }
    }
  });

  const otdRate = totalOrders > 0 ? Math.round(((totalOrders - delayedOrdersCount) / totalOrders) * 100) : 100;
  const avgDelay = totalOrders > 0 ? parseFloat((totalDelayDays / totalOrders).toFixed(1)) : 0;

  const score = scorePending
    ? null
    : (totalOrders > 0 
      ? Math.max(0, Math.min(100, Math.round(100 - (avgDelay * 4) - ((delayedOrdersCount / totalOrders) * 50))))
      : 100);

  return {
    score,
    scorePending,
    completedCount,
    otdRate,
    avgDelay,
    totalOrders,
    delayedOrders: delayedOrdersCount,
    categoryData: Object.entries(categoryCount).map(([name, value]) => ({ name, value })),
    statusData: [
      { name: "Awaiting Price", value: statusCount.awaitingPrice },
      { name: "In Transit", value: statusCount.inTransit },
      { name: "Received", value: statusCount.received }
    ],
    delays
  };
};

export const calculateCargoCompanyMetrics = (company, cargos, requests) => {
  const companyCargos = cargos.filter(c => c.cargoCompanyId === company.id);
  const totalCargos = companyCargos.length;
  const completedCount = companyCargos.filter(c => c.isMaterialRec === "Yes").length;
  const scorePending = completedCount < 5;

  let delayedCargosCount = 0;
  let totalDelayDays = 0;
  const delays = [];
  const modeCount = { Sea: 0, Air: 0, Land: 0, Express: 0 };

  companyCargos.forEach(c => {
    const mode = c.modeOfTransport || "Sea";
    if (modeCount[mode] !== undefined) {
      modeCount[mode] += 1;
    }

    let delay = 0;
    const systemDate = "2026-06-11";
    if (c.isMaterialRec === "Yes") {
      const recDate = c.receivedDate || systemDate;
      delay = getDelayDays(recDate, c.cargoEta);
      if (delay > 0) {
        delayedCargosCount += 1;
        totalDelayDays += delay;
        delays.push({
          id: c.id,
          eta: c.cargoEta,
          received: recDate,
          days: delay,
          status: "Arrived Late"
        });
      }
    } else {
      if (c.cargoEta) {
        delay = getDelayDays(systemDate, c.cargoEta);
        if (delay > 0) {
          delayedCargosCount += 1;
          totalDelayDays += delay;
          delays.push({
            id: c.id,
            eta: c.cargoEta,
            received: "Overdue (Transit)",
            days: delay,
            status: "Overdue"
          });
        }
      }
    }
  });

  const otaRate = totalCargos > 0 ? Math.round(((totalCargos - delayedCargosCount) / totalCargos) * 100) : 100;
  const avgDelay = totalCargos > 0 ? parseFloat((totalDelayDays / totalCargos).toFixed(1)) : 0;

  const score = scorePending
    ? null
    : (totalCargos > 0 
      ? Math.max(0, Math.min(100, Math.round(100 - (avgDelay * 5) - ((delayedCargosCount / totalCargos) * 50))))
      : 100);

  return {
    score,
    scorePending,
    completedCount,
    otaRate,
    avgDelay,
    totalCargos,
    delayedCargos: delayedCargosCount,
    modeData: Object.entries(modeCount).map(([name, value]) => ({ name, value })).filter(x => x.value > 0),
    delays
  };
};
