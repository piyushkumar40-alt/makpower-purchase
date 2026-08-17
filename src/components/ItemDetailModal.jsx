import React, { useState } from "react";
import { 
  X, Package, MapPin, Truck, Calendar, User, DollarSign, Clock, 
  CheckCircle2, AlertTriangle, ExternalLink, Layers, Building2, 
  ZoomIn, ArrowRight, ShieldCheck, Tag, Info, History
} from "lucide-react";

export default function ItemDetailModal({ 
  item, 
  onClose, 
  requests = [], 
  cargos = [], 
  vendors = [], 
  users = [], 
  cargoCompanies = [] 
}) {
  const [enlargedImage, setEnlargedImage] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("overview"); // "overview" | "orders" | "cargos" | "vendors"

  if (!item) return null;

  // Match purchase requests for this item by Item ID or Name/Model
  const itemKey = (item.name || "").trim().toLowerCase();
  const itemIdStr = String(item.id).trim().toUpperCase();

  const matchingRequests = requests.filter(r => {
    const rModel = (r.model || "").trim().toLowerCase();
    const rCat = (r.category || "").trim().toLowerCase();
    const rId = String(r.itemId || r.id || "").trim().toUpperCase();
    return rId === itemIdStr || rModel === itemKey || (rModel && itemKey && rModel.includes(itemKey));
  });

  // Calculate Live Item Metrics ("Now Item is Where")
  const totalOrderedQty = matchingRequests.reduce((sum, r) => sum + (parseInt(r.orderQuantity, 10) || 0), 0);
  
  const receivedRequests = matchingRequests.filter(r => r.isMaterialRec === "Yes");
  const totalReceivedQty = receivedRequests.reduce((sum, r) => sum + (parseInt(r.orderQuantity, 10) || 0), 0);

  const inTransitRequests = matchingRequests.filter(r => r.cargoId && r.isMaterialRec !== "Yes");
  const totalInTransitQty = inTransitRequests.reduce((sum, r) => sum + (parseInt(r.orderQuantity, 10) || 0), 0);

  const pendingRequests = matchingRequests.filter(r => !r.cargoId && r.isMaterialRec !== "Yes");
  const totalPendingQty = pendingRequests.reduce((sum, r) => sum + (parseInt(r.orderQuantity, 10) || 0), 0);

  const totalRmbSpend = matchingRequests.reduce((sum, r) => sum + (parseFloat(r.totalRmb) || 0), 0);

  // Cargo Shipments involving this item
  const matchingCargoIds = Array.from(new Set(matchingRequests.map(r => r.cargoId).filter(Boolean)));
  const matchingCargos = cargos.filter(c => matchingCargoIds.includes(c.id));

  // Vendor Supply Breakdown
  const vendorMap = {};
  matchingRequests.forEach(r => {
    if (r.vendorId) {
      const v = vendors.find(v => v.id === r.vendorId);
      const vName = v ? v.name : (r.vendorName || "Unknown Vendor");
      if (!vendorMap[vName]) {
        vendorMap[vName] = { name: vName, totalSpend: 0, orderCount: 0, totalQty: 0 };
      }
      vendorMap[vName].totalSpend += parseFloat(r.totalRmb) || 0;
      vendorMap[vName].totalQty += parseInt(r.orderQuantity, 10) || 0;
      vendorMap[vName].orderCount += 1;
    }
  });
  const vendorList = Object.values(vendorMap).sort((a, b) => b.totalSpend - a.totalSpend);

  const isFG = item.itemType === "FG";

  return (
    <div className="modal-backdrop card-fade-in" style={{ zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      
      {/* Lightbox Image Zoom Modal */}
      {enlargedImage && (
        <div 
          onClick={() => setEnlargedImage(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "rgba(0, 0, 0, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            backdropFilter: "blur(8px)",
            cursor: "zoom-out"
          }}
        >
          <button 
            onClick={() => setEnlargedImage(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={24} />
          </button>
          
          <img 
            src={item.photo} 
            alt={item.name} 
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "2px solid rgba(255, 255, 255, 0.2)"
            }} 
          />
          <div style={{ color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700, marginTop: "16px" }}>
            #{item.id} — {item.name} ({item.category || "General"})
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "4px" }}>
            Click anywhere to close image preview
          </div>
        </div>
      )}

      {/* Main Item Detail Card Modal */}
      <div 
        className="glass-panel" 
        style={{
          width: "100%",
          maxWidth: "1050px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid var(--border-glass)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
        }}
      >
        
        {/* Modal Top Header Bar */}
        <div style={{ 
          padding: "20px 24px", 
          background: "rgba(15, 23, 42, 0.9)", 
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justify: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {item.photo ? (
              <div 
                onClick={() => setEnlargedImage(true)}
                style={{ 
                  position: "relative",
                  cursor: "zoom-in",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "2px solid var(--primary)"
                }}
                title="Click to Enlarge Image"
              >
                <img 
                  src={item.photo} 
                  alt={item.name} 
                  style={{ width: "52px", height: "52px", objectFit: "cover" }} 
                />
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.2s"
                }} className="img-hover-overlay">
                  <ZoomIn size={18} style={{ color: "#fff" }} />
                </div>
              </div>
            ) : (
              <div style={{ 
                width: "52px", 
                height: "52px", 
                borderRadius: "10px", 
                background: "rgba(99, 102, 241, 0.15)", 
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center" 
              }}>
                <Package size={26} style={{ color: "var(--primary)" }} />
              </div>
            )}

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                  {item.name}
                </h2>
                <span className="badge badge-primary" style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                  Item ID #{item.id}
                </span>
                <span className="badge" style={{ 
                  fontSize: "0.78rem", 
                  fontWeight: 700, 
                  background: isFG ? "rgba(16, 185, 129, 0.2)" : "rgba(99, 102, 241, 0.2)", 
                  color: isFG ? "#34d399" : "#a5b4fc",
                  border: `1px solid ${isFG ? "rgba(16, 185, 129, 0.4)" : "rgba(99, 102, 241, 0.4)"}`
                }}>
                  {isFG ? "FG (Finished Goods)" : "RM (Raw Material)"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px", fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                <span>Category: <strong style={{ color: "var(--text-main)" }}>{item.category || "General"}</strong></span>
                <span>•</span>
                <span>Nature: <strong style={{ color: "var(--text-main)" }}>{item.itemNature || "Non Consumables"}</strong></span>
                <span>•</span>
                <span>Unit: <strong style={{ color: "var(--text-main)" }}>{item.unit || "Pcs"}</strong></span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: "50%", width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Status Banners ("Now Item is Where") */}
        <div style={{ padding: "16px 24px", background: "rgba(0, 0, 0, 0.2)", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <MapPin size={14} /> Real-Time Item Location & Stock Tracking
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            {/* Warehouse Stock / Received */}
            <div className="glass-panel" style={{ padding: "12px 16px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ fontSize: "0.75rem", color: "#6ee7b7", fontWeight: 600 }}>🏭 In Warehouse / Received</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>
                {totalReceivedQty.toLocaleString()} {item.unit || "Pcs"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {receivedRequests.length} orders received
              </div>
            </div>

            {/* In Transit on Cargo */}
            <div className="glass-panel" style={{ padding: "12px 16px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ fontSize: "0.75rem", color: "#7dd3fc", fontWeight: 600 }}>🚢 In-Transit (On Cargo)</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8", marginTop: "2px" }}>
                {totalInTransitQty.toLocaleString()} {item.unit || "Pcs"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {inTransitRequests.length} shipments on sea/road
              </div>
            </div>

            {/* Purchaser Processing */}
            <div className="glass-panel" style={{ padding: "12px 16px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <div style={{ fontSize: "0.75rem", color: "#fcd34d", fontWeight: 600 }}>📝 Purchaser Processing</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f59e0b", marginTop: "2px" }}>
                {totalPendingQty.toLocaleString()} {item.unit || "Pcs"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {pendingRequests.length} POs pending cargo
              </div>
            </div>

            {/* Total Lifetime Ordered */}
            <div className="glass-panel" style={{ padding: "12px 16px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <div style={{ fontSize: "0.75rem", color: "#a5b4fc", fontWeight: 600 }}>📊 Total Lifetime Ordered</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#818cf8", marginTop: "2px" }}>
                {totalOrderedQty.toLocaleString()} {item.unit || "Pcs"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Total Spend: ¥{totalRmbSpend.toLocaleString()} RMB
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", padding: "12px 24px 0", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.1)" }}>
          <button 
            onClick={() => setActiveSubTab("overview")}
            className={`btn btn-sm ${activeSubTab === "overview" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: "0.85rem" }}
          >
            <Info size={14} /> Item Specifications
          </button>

          <button 
            onClick={() => setActiveSubTab("orders")}
            className={`btn btn-sm ${activeSubTab === "orders" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: "0.85rem" }}
          >
            <History size={14} /> Order History ({matchingRequests.length})
          </button>

          <button 
            onClick={() => setActiveSubTab("cargos")}
            className={`btn btn-sm ${activeSubTab === "cargos" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: "0.85rem" }}
          >
            <Truck size={14} /> Cargo Shipments ({matchingCargos.length})
          </button>

          <button 
            onClick={() => setActiveSubTab("vendors")}
            className={`btn btn-sm ${activeSubTab === "vendors" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: "0.85rem" }}
          >
            <Building2 size={14} /> Vendor Supply History ({vendorList.length})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>

          {/* TAB 1: SPECIFICATIONS & OVERVIEW */}
          {activeSubTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              
              {/* Photo & Description Card */}
              <div className="glass-panel" style={{ padding: "20px" }}>
                <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Package size={16} /> Item Master Image & Description
                </h4>

                {item.photo ? (
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <img 
                      src={item.photo} 
                      alt={item.name} 
                      onClick={() => setEnlargedImage(true)}
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: "220px", 
                        borderRadius: "10px", 
                        objectFit: "contain",
                        cursor: "zoom-in",
                        border: "1px solid var(--border-glass)"
                      }} 
                    />
                    <div style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: "6px" }}>
                      🔍 Click image to enlarge full screen
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
                    <Package size={48} style={{ opacity: 0.3, marginBottom: "8px" }} />
                    <p style={{ fontSize: "0.85rem" }}>No image uploaded for this item.</p>
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Description & Technical Specs</label>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-main)", marginTop: "4px", lineHeight: "1.5" }}>
                    {item.description || "No specific description recorded."}
                  </p>
                </div>
              </div>

              {/* Master System Attributes Card */}
              <div className="glass-panel" style={{ padding: "20px" }}>
                <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Tag size={16} /> Master Catalog Attributes
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.88rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Master Item ID:</span>
                    <strong style={{ color: "var(--primary)" }}>#{item.id}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Name / Model:</span>
                    <strong style={{ color: "var(--text-main)" }}>{item.name}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Product Category:</span>
                    <strong style={{ color: "var(--text-main)" }}>{item.category || "General"}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Classification Type:</span>
                    <strong style={{ color: isFG ? "#34d399" : "#a5b4fc" }}>{isFG ? "Finished Goods (FG)" : "Raw Material (RM)"}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Item Nature:</span>
                    <strong>{item.itemNature || "Non Consumables"}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Unit of Measure (UOM):</span>
                    <strong>{item.unit || "Pcs"}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Lifetime Spend:</span>
                    <strong style={{ color: "var(--success)" }}>¥{totalRmbSpend.toLocaleString()} RMB</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: COMPLETE ORDER HISTORY */}
          {activeSubTab === "orders" && (
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={18} /> Purchase Order Requisition History
              </h4>

              {matchingRequests.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }} className="glass-panel">
                  No purchase orders recorded for this item yet.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="custom-table" style={{ fontSize: "0.83rem" }}>
                    <thead>
                      <tr>
                        <th>PO ID</th>
                        <th>Order Date</th>
                        <th>Purchaser</th>
                        <th>Quantity</th>
                        <th>Price (RMB)</th>
                        <th>Total Spend</th>
                        <th>Vendor</th>
                        <th>Current Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingRequests.map((req, idx) => {
                        const purchaserObj = users.find(u => u.id === req.purchaserId);
                        const vendorObj = vendors.find(v => v.id === req.vendorId);
                        return (
                          <tr key={req.id || idx}>
                            <td style={{ fontWeight: 700, color: "var(--primary)" }}>{req.id}</td>
                            <td>{req.orderDate || req.createdDate || "-"}</td>
                            <td style={{ fontWeight: 600 }}>{purchaserObj ? purchaserObj.name : req.entryBy}</td>
                            <td style={{ fontWeight: 700 }}>{(parseInt(req.orderQuantity, 10) || 0).toLocaleString()} {item.unit || "Pcs"}</td>
                            <td>¥{parseFloat(req.priceRmb || 0).toFixed(2)}</td>
                            <td style={{ fontWeight: 700, color: "var(--success)" }}>¥{parseFloat(req.totalRmb || 0).toLocaleString()}</td>
                            <td>{vendorObj ? vendorObj.name : (req.vendorName || "-")}</td>
                            <td>
                              {req.isMaterialRec === "Yes" ? (
                                <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>
                                  <CheckCircle2 size={10} /> Received ({req.actualReceivedDate || "Warehouse"})
                                </span>
                              ) : req.cargoId ? (
                                <span className="badge badge-secondary" style={{ fontSize: "0.7rem", color: "#38bdf8" }}>
                                  <Truck size={10} /> In-Transit (Cargo #{req.cargoId})
                                </span>
                              ) : (
                                <span className="badge badge-warning" style={{ fontSize: "0.7rem" }}>
                                  <Clock size={10} /> Processing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CARGO SHIPMENTS */}
          {activeSubTab === "cargos" && (
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Truck size={18} /> Logistics & Cargo Shipments History
              </h4>

              {matchingCargos.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }} className="glass-panel">
                  No cargo shipments assigned to this item yet.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="custom-table" style={{ fontSize: "0.83rem" }}>
                    <thead>
                      <tr>
                        <th>Cargo ID</th>
                        <th>Mark / Ref</th>
                        <th>Carrier Company</th>
                        <th>Tracking / B/L No</th>
                        <th>ETD Date</th>
                        <th>ETA Date</th>
                        <th>Received Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingCargos.map((cargo) => {
                        const carrierObj = cargoCompanies.find(c => c.id === cargo.cargoCompanyId);
                        return (
                          <tr key={cargo.id}>
                            <td style={{ fontWeight: 700, color: "var(--primary)" }}>#{cargo.id}</td>
                            <td style={{ fontWeight: 600 }}>{cargo.cargoMark || "-"}</td>
                            <td>{carrierObj ? carrierObj.name : (cargo.cargoCompanyName || "-")}</td>
                            <td style={{ fontFamily: "monospace" }}>{cargo.billNumber || "-"}</td>
                            <td>{cargo.cargoEtd || "-"}</td>
                            <td>{cargo.cargoEta || "-"}</td>
                            <td>
                              {cargo.isMaterialRec === "Yes" ? (
                                <span className="badge badge-success">Delivered</span>
                              ) : (
                                <span className="badge badge-secondary" style={{ color: "#38bdf8" }}>In-Transit</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VENDOR SUPPLY HISTORY */}
          {activeSubTab === "vendors" && (
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={18} /> Vendor Supply & Price Scorecard
              </h4>

              {vendorList.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }} className="glass-panel">
                  No vendor purchase data recorded for this item yet.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="custom-table" style={{ fontSize: "0.83rem" }}>
                    <thead>
                      <tr>
                        <th>Vendor / Supplier Name</th>
                        <th>Total Orders</th>
                        <th>Total Quantity Supplied</th>
                        <th>Total Spend (RMB)</th>
                        <th>Avg RMB / Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorList.map((v, idx) => {
                        const avgPrice = v.totalQty > 0 ? (v.totalSpend / v.totalQty).toFixed(2) : "0.00";
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, color: "var(--text-main)" }}>{v.name}</td>
                            <td>{v.orderCount} POs</td>
                            <td style={{ fontWeight: 600 }}>{v.totalQty.toLocaleString()} {item.unit || "Pcs"}</td>
                            <td style={{ fontWeight: 700, color: "var(--success)" }}>¥{v.totalSpend.toLocaleString()}</td>
                            <td style={{ fontWeight: 600, color: "var(--primary)" }}>¥{avgPrice}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div style={{ padding: "16px 24px", background: "rgba(15, 23, 42, 0.9)", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Item Details
          </button>
        </div>

      </div>
    </div>
  );
}
