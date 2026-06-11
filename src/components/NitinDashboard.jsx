import React, { useState } from "react";
import { LogOut, Filter, CheckSquare, Square, CheckCircle, PackageOpen, Eye, X } from "lucide-react";

export default function NitinDashboard({ currentUser, requests, vendors, cargos, onBatchUpdateRequests, onLogout }) {
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "submitted"
  
  // Filters state
  const [filterVendor, setFilterVendor] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCargo, setFilterCargo] = useState("");
  
  // Selection check
  const [checkedIds, setCheckedIds] = useState([]);
  
  // Thumbnail modal state
  const [viewPhoto, setViewPhoto] = useState(null);

  // Filter requests: priced, vendor assigned, and type Import ONLY
  const eligibleRequests = requests.filter(r => r.priceRmb && r.vendorId && r.type === "Import");

  // Partitioned requests
  const pendingRequests = eligibleRequests.filter(r => r.packingOrderedByNitin !== "Yes" && r.status !== "Cancelled");
  const submittedRequests = eligibleRequests.filter(r => r.packingOrderedByNitin === "Yes" && r.status !== "Cancelled");

  // Active requests for the current tab
  const currentTabRequests = activeTab === "pending" ? pendingRequests : submittedRequests;

  // Filtered requests
  const filteredRequests = currentTabRequests.filter(r => {
    const cargoIdMatch = filterCargo === "" || r.cargoId === filterCargo;
    const vendorMatch = filterVendor === "" || r.vendorId === filterVendor;
    const categoryMatch = filterCategory === "" || (r.category && r.category.toLowerCase().includes(filterCategory.toLowerCase()));
    return cargoIdMatch && vendorMatch && categoryMatch;
  });

  // Extract filter options dynamically
  const uniqueVendors = Array.from(new Set(eligibleRequests.map(r => r.vendorId)))
    .map(id => vendors.find(v => v.id === id))
    .filter(Boolean);

  const uniqueCategories = Array.from(new Set(eligibleRequests.map(r => r.category).filter(Boolean)));
  const uniqueCargos = Array.from(new Set(eligibleRequests.map(r => r.cargoId).filter(Boolean)));

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedIds(filteredRequests.map(r => r.id));
    } else {
      setCheckedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmitPacking = () => {
    if (checkedIds.length === 0) return;
    const updated = pendingRequests.filter(r => checkedIds.includes(r.id)).map(r => ({
      ...r,
      packingOrderedByNitin: "Yes"
    }));
    onBatchUpdateRequests(updated);
    setCheckedIds([]);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", color: "var(--primary)", textShadow: "0 0 10px var(--primary-glow)" }}>Nitin's Packing Order Panel</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>Import Operations & Packing Confirmations</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="user-badge" style={{ padding: "6px 14px", background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)", color: "#ec4899" }}>
            Role: Nitin
          </span>
          <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ padding: "8px 14px" }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
        <button 
          onClick={() => { setActiveTab("pending"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
        >
          Pending Packing Orders ({pendingRequests.length})
        </button>
        <button 
          onClick={() => { setActiveTab("submitted"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "submitted" ? "active" : ""}`}
        >
          Submitted Packing Archive ({submittedRequests.length})
        </button>
      </div>

      {/* Filters Panel */}
      <div className="glass-panel" style={{ padding: "18px 24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", fontSize: "0.9rem", fontWeight: 600, color: "var(--primary)" }}>
          <Filter size={16} /> Filter Requisitions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Vendor filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Vendor</label>
            <select className="form-control" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
              <option value="" style={{ background: "#0f172a" }}>All Vendors</option>
              {uniqueVendors.map(v => (
                <option key={v.id} value={v.id} style={{ background: "#0f172a" }}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-control" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="" style={{ background: "#0f172a" }}>All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat} style={{ background: "#0f172a" }}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Cargo filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Cargo Code</label>
            <select className="form-control" value={filterCargo} onChange={e => setFilterCargo(e.target.value)}>
              <option value="" style={{ background: "#0f172a" }}>All Cargo Shipments</option>
              {uniqueCargos.map(cid => (
                <option key={cid} value={cid} style={{ background: "#0f172a" }}>{cid}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Row */}
      {activeTab === "pending" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Checked: <strong>{checkedIds.length}</strong> of {filteredRequests.length} items
          </span>
          <button 
            onClick={handleSubmitPacking}
            disabled={checkedIds.length === 0}
            className="btn btn-primary"
            style={{ padding: "10px 20px" }}
          >
            <CheckCircle size={16} /> Submit {checkedIds.length || ""} Selected Packing Orders
          </button>
        </div>
      )}

      {/* Requisitions List Table */}
      {filteredRequests.length === 0 ? (
        <div className="glass-panel" style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)" }}>
          <PackageOpen size={36} style={{ color: "var(--primary)", marginBottom: "12px", display: "inline" }} /><br />
          No requests match the selected filters.
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: "4px" }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  {activeTab === "pending" && (
                    <th style={{ width: "45px" }}>
                      <input 
                        type="checkbox" 
                        className="checkbox-input"
                        checked={checkedIds.length > 0 && checkedIds.length === filteredRequests.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th>Purchaser</th>
                  <th>Vendor</th>
                  <th>Order Date</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Qty</th>
                  <th>EDD</th>
                  <th>Cargo Date</th>
                  <th>Cargo Detail</th>
                  <th>Transport</th>
                  <th>Ship Date</th>
                  <th>ETA</th>
                  <th>Packing Ordered?</th>
                  <th>Photo</th>
                  <th>Material Rec</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(r => {
                  const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                  const cargo = cargos.find(c => c.id === r.cargoId);
                  const isChecked = checkedIds.includes(r.id);

                  return (
                    <tr key={r.id} className={isChecked ? "planner-row-selected" : ""}>
                      {activeTab === "pending" && (
                        <td>
                          <input 
                            type="checkbox" 
                            className="checkbox-input"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(r.id)}
                          />
                        </td>
                      )}
                      <td style={{ fontSize: "0.85rem" }}>{r.entryBy || "Purchaser"}</td>
                      <td style={{ fontWeight: 500 }}>{vName}</td>
                      <td>{r.orderDate}</td>
                      <td>
                        <span className="badge badge-cargo" style={{ background: "rgba(129, 140, 248, 0.12)", color: "#818cf8" }}>{r.type}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.model}</td>
                      <td style={{ fontWeight: 600 }}>{r.orderQuantity}</td>
                      <td>{r.vendorEdd || "—"}</td>
                      
                      {/* Cargo columns */}
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{cargo?.cargoOrderDate || "—"}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cargo?.cargoDetail}>{cargo?.cargoDetail || "—"}</td>
                      <td>
                        {cargo?.modeOfTransport ? (
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--primary)" }}>{cargo.modeOfTransport}</span>
                        ) : "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>{cargo?.cargoShippingDate || "—"}</td>
                      <td style={{ fontSize: "0.8rem" }}>{cargo?.cargoEta || "—"}</td>
                      
                      {/* Packing Ordered status badge */}
                      <td>
                        <span className={`badge ${r.packingOrderedByNitin === "Yes" ? "badge-received" : "badge-pending"}`} style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                          {r.packingOrderedByNitin === "Yes" ? "Yes" : "No"}
                        </span>
                      </td>

                      {/* Photo Thumbnail */}
                      <td>
                        {r.photo ? (
                          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setViewPhoto(r.photo)}>
                            <img src={r.photo} alt="Thumbnail" style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border-glass)" }} />
                            <div style={{ position: "absolute", bottom: 0, right: 0, background: "rgba(0,0,0,0.6)", borderRadius: "3px", padding: "1px" }}>
                              <Eye size={10} style={{ color: "#fff" }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>No Photo</span>
                        )}
                      </td>

                      {/* Material Rec */}
                      <td>
                        <span style={{ fontWeight: 600, color: r.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>
                          {r.isMaterialRec}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image zoom modal overlay */}
      {viewPhoto && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setViewPhoto(null)}>
          <div className="glass-panel modal-content" style={{ maxWidth: "500px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewPhoto(null)} 
              className="btn btn-secondary btn-sm"
              style={{ position: "absolute", top: "14px", right: "14px", minWidth: "auto", padding: "4px" }}
            >
              <X size={16} />
            </button>
            <h4 style={{ fontSize: "1.1rem", marginBottom: "6px", color: "var(--primary)" }}>Item Photo Preview</h4>
            <div style={{ textAlign: "center" }}>
              <img src={viewPhoto} alt="Enlarged preview" style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "8px", border: "1px solid var(--border-glass)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
