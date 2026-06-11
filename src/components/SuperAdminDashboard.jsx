import React, { useState } from "react";
import { Users, Building, Database, FileText, Plus, UserMinus, RefreshCw, Download, Upload, Eye, Truck, ChevronRight } from "lucide-react";
import TransferModal from "./TransferModal";
import { getCurrencySymbol, CargoCompaniesPanel, VendorDetailModal, CargoCompanyDetailModal } from "./PurchaserDashboard";

export default function SuperAdminDashboard({
  users,
  vendors,
  requests,
  cargos,
  cargoCompanies = [],
  onAddPurchaser,
  onRemovePurchaser,
  onAddVendor,
  onUpdateVendor,
  onRemoveVendor,
  onAddCargoCompany,
  onUpdateCargoCompany,
  onRemoveCargoCompany,
  onExportBackup,
  onImportBackup,
  onUpdateUserInfo
}) {
  const [subTab, setSubTab] = useState("purchasers"); // "purchasers" | "vendors" | "audit" | "backup" | "cargocompanies"
  
  // Purchaser State
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPassword, setPPassword] = useState("");
  const [pError, setPError] = useState("");
  const [pSuccess, setPSuccess] = useState("");

  // Staff Edit State
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editNameVal, setEditNameVal] = useState("");
  const [editPasswordVal, setEditPasswordVal] = useState("");
  const [editSuccessMsg, setEditSuccessMsg] = useState("");

  // Vendor State
  const [vName, setVName] = useState("");
  const [vLocation, setVLocation] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vHistory, setVHistory] = useState("");
  const [vPurchaserIds, setVPurchaserIds] = useState([]);
  const [vSuccess, setVSuccess] = useState("");
  const [vError, setVError] = useState("");

  // Audit Logs State
  const [auditFilter, setAuditFilter] = useState("All"); // "All" | "Local" | "Import"
  const [auditSearch, setAuditSearch] = useState("");

  // Offboarding modal state
  const [selectedDeactivateUser, setSelectedDeactivateUser] = useState(null);

  // Backup file state
  const [backupFileError, setBackupFileError] = useState("");
  const [backupFileSuccess, setBackupFileSuccess] = useState("");

  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState(null);
  const [selectedCargoCompanyForDetail, setSelectedCargoCompanyForDetail] = useState(null);
  const [showInactiveVendors, setShowInactiveVendors] = useState(false);
  const [showInactiveCarriers, setShowInactiveCarriers] = useState(false);

  const activePurchasers = users.filter(u => u.role === "purchaser" && u.status === "active");

  // Add Purchaser Submit
  const handleAddPurchaserSubmit = (e) => {
    e.preventDefault();
    setPError("");
    setPSuccess("");
    if (!pName || !pEmail || !pPassword) return;

    const res = onAddPurchaser(pName, pEmail, pPassword);
    if (res.success) {
      setPSuccess(`Purchaser ${pName} created successfully!`);
      setPName("");
      setPEmail("");
      setPPassword("");
    } else {
      setPError(res.message);
    }
  };

  // Add Vendor Submit
  const handleAddVendorSubmit = (e) => {
    e.preventDefault();
    setVSuccess("");
    setVError("");
    if (!vName || vPurchaserIds.length === 0) return;

    const res = onAddVendor(vName.trim(), vPurchaserIds, vLocation.trim(), vPhone.trim(), vHistory.trim());
    if (res && !res.success) {
      setVError(res.message);
      return;
    }
    setVSuccess(`Vendor "${vName}" registered successfully!`);
    setVName("");
    setVLocation("");
    setVPhone("");
    setVHistory("");
    setVPurchaserIds([]);
    setVError("");
  };

  // Handle deletion modal confirmed
  const handleTransferConfirmed = (deletedId, destId) => {
    onRemovePurchaser(deletedId, destId);
    setSelectedDeactivateUser(null);
  };

  // Export File Download
  const triggerExportDownload = () => {
    const dataStr = onExportBackup();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `makpower_backup_${new Date().toISOString().split("T")[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import File Upload
  const handleFileUpload = (e) => {
    setBackupFileError("");
    setBackupFileSuccess("");
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.users && parsed.vendors && parsed.requests && parsed.cargos) {
          onImportBackup(parsed);
          setBackupFileSuccess("System database restored successfully! Refreshing view...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setBackupFileError("Invalid file structure. Must contain users, vendors, requests, and cargos.");
        }
      } catch (err) {
        setBackupFileError("Error parsing JSON file. Please verify it is a valid backup.");
      }
    };
    fileReader.readAsText(file);
  };

  return (
    <div className="main-layout">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid var(--border-glass)", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Admin Console
          </h3>
        </div>

        <button 
          onClick={() => setSubTab("purchasers")}
          className={`sidebar-link ${subTab === "purchasers" ? "active" : ""}`}
        >
          <Users size={16} /> Purchasers
        </button>

        <button 
          onClick={() => setSubTab("vendors")}
          className={`sidebar-link ${subTab === "vendors" ? "active" : ""}`}
        >
          <Building size={16} /> Vendor Hub
        </button>

        <button 
          onClick={() => setSubTab("cargocompanies")}
          className={`sidebar-link ${subTab === "cargocompanies" ? "active" : ""}`}
        >
          <Truck size={16} /> Cargo Companies
        </button>

        <button 
          onClick={() => setSubTab("audit")}
          className={`sidebar-link ${subTab === "audit" ? "active" : ""}`}
        >
          <FileText size={16} /> Audit Purchase Logs
        </button>

        <button 
          onClick={() => setSubTab("backup")}
          className={`sidebar-link ${subTab === "backup" ? "active" : ""}`}
        >
          <Database size={16} /> Database Backup
        </button>
      </aside>

      {/* Main content display */}
      <section className="main-content">

        {/* PURCHASERS MANAGMENT TAB */}
        {subTab === "purchasers" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Staff & Purchaser Accounts</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
              
              {/* Active Staff List */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Active Staff Members</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(() => {
                    const activeStaff = users.filter(u => u.role !== "superadmin" && u.status === "active");
                    const getRoleLabel = (role) => {
                      if (role === "nitin") return "Packing";
                      if (role === "rahul") return "Updates";
                      if (role === "coordinator") return "Coordinator";
                      return "Purchaser";
                    };
                    return activeStaff.map(staff => {
                      const isPurchaser = staff.role === "purchaser";
                      const activeRequests = isPurchaser ? requests.filter(r => r.purchaserId === staff.id && r.isMaterialRec !== "Yes").length : 0;
                      return (
                        <div key={staff.id} className="glass-panel" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255, 255, 255, 0.01)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                                {staff.name}
                                <span className="badge" style={{ fontSize: "0.6rem", padding: "1px 6px", background: "rgba(56, 189, 248, 0.1)", color: "var(--primary)", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                                  {getRoleLabel(staff.role)}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{staff.email}</div>
                              {isPurchaser && (
                                <div style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: "4px" }}>{activeRequests} active purchases in tracking</div>
                              )}
                            </div>
                            
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button 
                                onClick={() => {
                                  setEditingStaffId(staff.id);
                                  setEditNameVal(staff.name);
                                  setEditPasswordVal("");
                                  setEditSuccessMsg("");
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                              >
                                Edit Account
                              </button>
                              
                              {isPurchaser && (
                                <button 
                                  onClick={() => setSelectedDeactivateUser(staff)}
                                  className="btn btn-danger btn-sm"
                                  title="Deactivate and transfer history"
                                  style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                  <UserMinus size={12} /> Remove
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline Edit Form */}
                          {editingStaffId === staff.id && (
                            <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--primary)" }}>Edit Staff Account</div>
                              
                              <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>Display Name</label>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  style={{ padding: "6px 10px", fontSize: "0.85rem", height: "32px" }}
                                  placeholder="Full Name"
                                  value={editNameVal}
                                  onChange={e => setEditNameVal(e.target.value)}
                                />
                              </div>

                              <div className="form-group" style={{ marginBottom: "4px", gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>New Password (leave blank to keep current)</label>
                                <input 
                                  type="password" 
                                  className="form-control" 
                                  style={{ padding: "6px 10px", fontSize: "0.85rem", height: "32px" }}
                                  placeholder="New password"
                                  value={editPasswordVal}
                                  onChange={e => setEditPasswordVal(e.target.value)}
                                />
                              </div>

                              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                <button 
                                  onClick={() => {
                                    if (!editNameVal.trim()) return;
                                    const updates = { name: editNameVal.trim() };
                                    if (editPasswordVal.trim()) {
                                      updates.password = editPasswordVal.trim();
                                    }
                                    onUpdateUserInfo(staff.id, updates);
                                    setEditSuccessMsg("Account updated!");
                                    setTimeout(() => {
                                      setEditingStaffId(null);
                                      setEditSuccessMsg("");
                                    }, 1200);
                                  }}
                                  className="btn btn-success btn-sm"
                                  style={{ padding: "6px 12px", height: "32px", fontSize: "0.8rem" }}
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setEditingStaffId(null)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "6px 12px", height: "32px", fontSize: "0.8rem" }}
                                >
                                  Cancel
                                </button>
                              </div>
                              {editSuccessMsg && (
                                <div style={{ color: "var(--success)", fontSize: "0.78rem", marginTop: "4px" }}>{editSuccessMsg}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Add Purchaser Form */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Create Purchaser Account</h3>
                {pError && <div className="alert-strip alert-danger">{pError}</div>}
                {pSuccess && <div className="alert-strip alert-success">{pSuccess}</div>}

                <form onSubmit={handleAddPurchaserSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Nitin Kumar"
                      value={pName}
                      onChange={e => setPName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control"
                      placeholder="e.g. nitin@company.com"
                      value={pEmail}
                      onChange={e => setPEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Login Password</label>
                    <input 
                      type="password" 
                      className="form-control"
                      placeholder="Choose a strong password"
                      value={pPassword}
                      onChange={e => setPPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
                    <Plus size={16} /> Create Account
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* VENDORS MANAGEMENT TAB */}
        {subTab === "vendors" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Vendor Hub</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
              
              {/* Vendors List & Reassign */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "1.2rem", color: "var(--primary)", margin: 0 }}>Registered Vendors</h3>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={showInactiveVendors} 
                      onChange={e => setShowInactiveVendors(e.target.checked)} 
                      style={{ cursor: "pointer" }}
                    />
                    Show Inactive
                  </label>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
                  {vendors.filter(v => showInactiveVendors || v.status !== "Inactive").length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
                      No vendors found.
                    </div>
                  ) : (
                    vendors
                      .filter(v => showInactiveVendors || v.status !== "Inactive")
                      .map(vendor => (
                        <div 
                          key={vendor.id} 
                          className="glass-panel" 
                          onClick={() => setSelectedVendorForDetail(vendor)}
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
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>View Details & Share</span>
                            <ChevronRight size={16} style={{ color: "var(--primary)" }} />
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Add Vendor Form */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Register New Vendor</h3>
                {vSuccess && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{vSuccess}</div>}
                {vError && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{vError}</div>}

                <form onSubmit={handleAddVendorSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">Vendor / Supplier Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Guangzhou Metalworks Ltd"
                      value={vName}
                      onChange={e => setVName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Location / Address</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. Guangzhou, China"
                      value={vLocation}
                      onChange={e => setVLocation(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. +86 20 8888 7777"
                      value={vPhone}
                      onChange={e => setVPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">History / Notes</label>
                    <textarea 
                      className="form-control"
                      placeholder="e.g. Primary metal casting supplier..."
                      value={vHistory}
                      onChange={e => setVHistory(e.target.value)}
                      rows="2"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign Purchasers (Can select multiple)</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-glass)", maxHeight: "150px", overflowY: "auto" }}>
                      {activePurchasers.map(p => (
                        <label key={p.id} className="checkbox-label" style={{ fontSize: "0.85rem" }}>
                          <input 
                            type="checkbox"
                            className="checkbox-input"
                            checked={vPurchaserIds.includes(p.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setVPurchaserIds(prev => [...prev, p.id]);
                              } else {
                                setVPurchaserIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: "100%", marginTop: "10px" }}
                    disabled={vPurchaserIds.length === 0}
                  >
                    <Plus size={16} /> Register Vendor
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {subTab === "audit" && (
          <div className="card-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ fontSize: "1.8rem" }}>Audit Logs</h2>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <select 
                  className="form-control"
                  style={{ width: "140px" }}
                  value={auditFilter}
                  onChange={e => setAuditFilter(e.target.value)}
                >
                  <option value="All" style={{ background: "#0f172a" }}>All Purchases</option>
                  <option value="Local" style={{ background: "#0f172a" }}>Local Only</option>
                  <option value="Import" style={{ background: "#0f172a" }}>Import Only</option>
                </select>

                <input 
                  type="text"
                  className="form-control"
                  placeholder="Search model, purchaser..."
                  style={{ width: "200px" }}
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Audit Table */}
            <div className="glass-panel" style={{ padding: "20px" }}>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Order Date</th>
                      <th>Type</th>
                      <th>Model</th>
                      <th>Qty</th>
                      <th>Total (RMB)</th>
                      <th>Purchaser</th>
                      <th>Vendor</th>
                      <th>Material Rec?</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests
                      .filter(r => {
                        if (auditFilter !== "All" && r.type !== auditFilter) return false;
                        if (auditSearch) {
                          const searchLower = auditSearch.toLowerCase();
                          const modelMatch = r.model.toLowerCase().includes(searchLower);
                          
                          const purchaserObj = users.find(u => u.id === r.purchaserId);
                          const purchaserMatch = purchaserObj ? purchaserObj.name.toLowerCase().includes(searchLower) : false;
                          
                          return modelMatch || purchaserMatch;
                        }
                        return true;
                      })
                      .map(r => {
                        const pName = users.find(u => u.id === r.purchaserId)?.name || "Unknown";
                        const vName = vendors.find(v => v.id === r.vendorId)?.name || "Unknown";
                        
                        let statusBadge = <span className="badge badge-pending">Pending Price</span>;
                        if (r.isMaterialRec === "Yes") {
                          statusBadge = <span className="badge badge-received">Received</span>;
                        } else if (r.cargoId) {
                          statusBadge = <span className="badge badge-cargo">Cargo In Transit</span>;
                        } else if (r.priceRmb) {
                          statusBadge = <span className="badge badge-approved">Price Set / Tracking</span>;
                        }

                        return (
                          <tr key={r.id}>
                            <td>{r.id}</td>
                            <td>{r.orderDate}</td>
                            <td>{r.type}</td>
                            <td style={{ fontWeight: 500 }}>{r.model}</td>
                            <td>{r.orderQuantity}</td>
                            <td>{r.totalRmb ? `${getCurrencySymbol(r.currency)}${Number(r.totalRmb).toLocaleString()}` : "—"}</td>
                            <td>{pName}</td>
                            <td>{vName}</td>
                            <td>
                              <span style={{ color: r.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>
                                {r.isMaterialRec}
                              </span>
                            </td>
                            <td>{statusBadge}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DATABASE BACKUP TAB */}
        {subTab === "backup" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>System State Synchronization</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "30px" }}>
              
              {/* Export Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)" }}>Export State</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Download a backup file containing all user roles, registered vendors, active purchase sheets, payment history, and linked Cargo logistics data.
                </p>

                <button onClick={triggerExportDownload} className="btn btn-primary" style={{ width: "100%" }}>
                  <Download size={16} /> Download Backup (.json)
                </button>
              </div>

              {/* Import Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)" }}>Import State</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Upload a previously saved Vanguard backup file. This will restore the entire database state. 
                  <strong style={{ color: "var(--danger)" }}> WARNING: This will overwrite your current browser data.</strong>
                </p>

                {backupFileError && <div className="alert-strip alert-danger">{backupFileError}</div>}
                {backupFileSuccess && <div className="alert-strip alert-success">{backupFileSuccess}</div>}

                <div className="form-group">
                  <label className="doc-upload-btn" style={{ justifyContent: "center", padding: "14px", borderStyle: "dashed" }}>
                    <Upload size={16} /> <span>Upload Backup File</span>
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleFileUpload} 
                      style={{ display: "none" }} 
                    />
                  </label>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* CARGO COMPANIES MANAGEMENT TAB */}
        {subTab === "cargocompanies" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Cargo Companies</h2>
            <CargoCompaniesPanel 
              cargoCompanies={cargoCompanies}
              onAddCargoCompany={onAddCargoCompany}
              onUpdateCargoCompany={onUpdateCargoCompany}
              onRemoveCargoCompany={onRemoveCargoCompany}
              onSelectCargoCompany={setSelectedCargoCompanyForDetail}
            />
          </div>
        )}

      </section>

      {/* Render Deactivation modal if open */}
      {selectedDeactivateUser && (
        <TransferModal 
          purchaser={selectedDeactivateUser}
          activeUsers={users.filter(u => u.status === "active")}
          requests={requests}
          vendors={vendors}
          onClose={() => setSelectedDeactivateUser(null)}
          onConfirm={handleTransferConfirmed}
        />
      )}

      {/* ==================== VENDOR DETAIL MODAL ==================== */}
      {selectedVendorForDetail && (
        <VendorDetailModal 
          vendor={selectedVendorForDetail}
          requests={requests}
          cargos={cargos}
          purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
          currentUser={{ role: "superadmin" }}
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
          currentUser={{ role: "superadmin" }}
          onUpdateCargoCompany={onUpdateCargoCompany}
          onRemoveCargoCompany={onRemoveCargoCompany}
          onClose={() => setSelectedCargoCompanyForDetail(null)}
        />
      )}

    </div>
  );
}
