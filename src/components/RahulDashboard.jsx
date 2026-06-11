import React, { useState } from "react";
import { LogOut, Filter, CheckSquare, Square, CheckCircle, PackageOpen, Download } from "lucide-react";

export default function RahulDashboard({ currentUser, requests, vendors, cargos, onBatchUpdateRequests, onLogout }) {
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "submitted"
  
  // Filters state
  const [filterVendor, setFilterVendor] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCargo, setFilterCargo] = useState("");
  
  // Selection check
  const [checkedIds, setCheckedIds] = useState([]);

  // Filter requests: priced, vendor assigned (all items, not just Import)
  const eligibleRequests = requests.filter(r => r.priceRmb && r.vendorId);

  // Partitioned requests
  const pendingRequests = eligibleRequests.filter(r => r.purchaseUpdated !== "Yes" && r.status !== "Cancelled");
  const submittedRequests = eligibleRequests.filter(r => r.purchaseUpdated === "Yes" && r.status !== "Cancelled");

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

  const handleSubmitUpdate = () => {
    if (checkedIds.length === 0) return;
    const updated = pendingRequests.filter(r => checkedIds.includes(r.id)).map(r => ({
      ...r,
      purchaseUpdated: "Yes"
    }));
    onBatchUpdateRequests(updated);
    setCheckedIds([]);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", color: "var(--primary)", textShadow: "0 0 10px var(--primary-glow)" }}>Rahul's Purchase Update Panel</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>Financial Audit & Ledger Confirmation Updates</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="user-badge" style={{ padding: "6px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "var(--success)" }}>
            Role: Rahul
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
          Pending Purchase Updates ({pendingRequests.length})
        </button>
        <button 
          onClick={() => { setActiveTab("submitted"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "submitted" ? "active" : ""}`}
        >
          Submitted Updates Archive ({submittedRequests.length})
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
            onClick={handleSubmitUpdate}
            disabled={checkedIds.length === 0}
            className="btn btn-primary"
            style={{ padding: "10px 20px" }}
          >
            <CheckCircle size={16} /> Submit {checkedIds.length || ""} Purchase Updates
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
                  <th>Purchase Updated</th>
                  <th>Material Rec</th>
                  <th>Cargo Slip</th>
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
                        <span className="badge badge-cargo" style={{ fontSize: "0.78rem" }}>{r.type}</span>
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
                      
                      {/* Purchase Updated badge */}
                      <td>
                        <span className={`badge ${r.purchaseUpdated === "Yes" ? "badge-received" : "badge-pending"}`} style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                          {r.purchaseUpdated === "Yes" ? "Yes" : "No"}
                        </span>
                      </td>

                      {/* Material Rec */}
                      <td>
                        <span style={{ fontWeight: 600, color: r.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>
                          {r.isMaterialRec}
                        </span>
                      </td>

                      {/* Cargo Slip (Documents) */}
                      <td>
                        {cargo && (cargo.packingListFile || cargo.invoiceFile) ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {cargo.packingListFile && (
                              <span className="doc-link" style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                📄 PL: {cargo.packingListFile.length > 12 ? `${cargo.packingListFile.substring(0, 10)}...` : cargo.packingListFile}
                              </span>
                            )}
                            {cargo.invoiceFile && (
                              <span className="doc-link" style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                📄 INV: {cargo.invoiceFile.length > 12 ? `${cargo.invoiceFile.substring(0, 10)}...` : cargo.invoiceFile}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>
                        )}
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
  );
}
