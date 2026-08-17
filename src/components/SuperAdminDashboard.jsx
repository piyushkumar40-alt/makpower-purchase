import React, { useState } from "react";
import { Users, Building, Database, FileText, Plus, UserMinus, RefreshCw, Download, Upload, Eye, Truck, ChevronRight, Sliders, Package, ShieldCheck, Clock, UserX, LogOut, Folder, HardDrive, Trash2, Copy, ExternalLink, Key } from "lucide-react";
import TransferModal from "./TransferModal";
import { getCurrencySymbol, CargoCompaniesPanel, VendorDetailModal, CargoCompanyDetailModal } from "./PurchaserDashboard";
import ItemMasterView from "./ItemMasterView";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";
import ItemCatalogPanel from "./ItemCatalogPanel";

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
  onUpdateUserInfo,
  settings = { isHidden: false, redirectUrl: "" },
  onUpdateSettings,
  onBatchUpdateRequests,
  items = [],
  onAddItem,
  onBulkAddItems,
  onDeleteItems,
  onPurgeAllData,
  onUpdateItem,
  onMergeItems,
  designations = [],
  onAddDesignation
}) {
  const [subTab, setSubTab] = useState(() => {
    return localStorage.getItem("makpower_admin_subtab") || "purchasers";
  });

  React.useEffect(() => {
    localStorage.setItem("makpower_admin_subtab", subTab);
  }, [subTab]);
  
  // Storage & File Manager State
  const [storageMetrics, setStorageMetrics] = useState(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [storageFolders, setStorageFolders] = useState([]);
  const [storageFiles, setStorageFiles] = useState([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [storageStatusMsg, setStorageStatusMsg] = useState("");

  const loadStorageData = async (folderPath = "") => {
    setLoadingStorage(true);
    try {
      const [mRes, fRes] = await Promise.all([
        fetch("/api/storage/metrics"),
        fetch(`/api/storage/files?folder=${encodeURIComponent(folderPath)}`)
      ]);
      const mData = await mRes.json();
      const fData = await fRes.json();

      if (mData.success) setStorageMetrics(mData);
      if (fData.success) {
        setCurrentFolder(fData.currentFolder || "");
        setStorageFolders(fData.folders || []);
        setStorageFiles(fData.files || []);
      }
    } catch (err) {
      console.error("Storage fetch error:", err.message);
    } finally {
      setLoadingStorage(false);
    }
  };

  React.useEffect(() => {
    if (subTab === "filemanager") {
      loadStorageData(currentFolder);
    }
  }, [subTab]);

  // Storage Manager Filters & Selection State
  const [storageFilterSource, setStorageFilterSource] = useState("all"); // "all" | "postgres" | "cloudinary"
  const [storageFileType, setStorageFileType] = useState("all"); // "all" | "image" | "pdf"
  const [storageSearchQuery, setStorageSearchQuery] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  const handleBatchDeleteStorageFiles = async () => {
    if (selectedFileIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedFileIds.length} selected asset(s)?`)) return;

    setLoadingStorage(true);
    let successCount = 0;
    for (const public_id of selectedFileIds) {
      try {
        const res = await fetch("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id })
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (e) {
        console.error("Batch delete item error:", e);
      }
    }

    setStorageStatusMsg(`✅ Successfully deleted ${successCount} file assets!`);
    setSelectedFileIds([]);
    loadStorageData(currentFolder);
    setTimeout(() => setStorageStatusMsg(""), 3500);
  };

  const handleDeleteStorageFile = async (public_id) => {
    if (!window.confirm(`Are you sure you want to delete asset "${public_id}"?`)) return;
    try {
      const res = await fetch("/api/storage/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id })
      });
      const data = await res.json();
      if (data.success) {
        setStorageStatusMsg(`✅ Deleted asset ${public_id}`);
        loadStorageData(currentFolder);
        setTimeout(() => setStorageStatusMsg(""), 3000);
      } else {
        setStorageStatusMsg(`❌ Delete failed: ${data.error}`);
      }
    } catch (err) {
      setStorageStatusMsg(`❌ Delete error: ${err.message}`);
    }
  };

  const handleDeleteAllCloudinaryImages = async () => {
    if (!window.confirm("⚠️ ARE YOU SURE? This will permanently delete ALL images from Cloudinary storage itself!")) return;
    setLoadingStorage(true);
    try {
      const res = await fetch("/api/storage/delete-all-cloudinary", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStorageStatusMsg(`✅ ${data.message}`);
        loadStorageData(currentFolder);
      } else {
        setStorageStatusMsg(`❌ Purge failed: ${data.error}`);
      }
    } catch (err) {
      setStorageStatusMsg(`❌ Purge error: ${err.message}`);
    } finally {
      setLoadingStorage(false);
    }
  };

  // System Settings State
  const [redirectUrlInput, setRedirectUrlInput] = useState(settings.redirectUrl || "https://www.instagram.com/makpowerofficial/");
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Admin Password Update State
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [adminPassMsg, setAdminPassMsg] = useState({ text: "", type: "" });
  const [updatingAdminPass, setUpdatingAdminPass] = useState(false);

  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    setAdminPassMsg({ text: "", type: "" });

    if (!newAdminPassword || newAdminPassword.trim().length === 0) {
      setAdminPassMsg({ text: "Please enter a new password.", type: "danger" });
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminPassMsg({ text: "Passwords do not match. Please verify.", type: "danger" });
      return;
    }

    setUpdatingAdminPass(true);
    try {
      const adminUser = users.find(u => u.role === "superadmin" || u.id === "u-admin") || { id: "u-admin" };
      const res = await onUpdateUserInfo(adminUser.id, { password: newAdminPassword.trim() });
      if (res && res.success) {
        setAdminPassMsg({ text: "✅ Admin password updated successfully! Use your new password on next login.", type: "success" });
        setNewAdminPassword("");
        setConfirmAdminPassword("");
      } else {
        setAdminPassMsg({ text: `❌ Update failed: ${res?.message || "Unknown error"}`, type: "danger" });
      }
    } catch (err) {
      setAdminPassMsg({ text: `❌ Error: ${err.message}`, type: "danger" });
    } finally {
      setUpdatingAdminPass(false);
    }
  };

  // Google Sheets Integration State
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState(settings.googleSheetWebhookUrl || "");
  const [sheetAutoSync, setSheetAutoSync] = useState(settings.googleSheetAutoSyncEnabled === "true" || settings.googleSheetAutoSyncEnabled === true);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetStatusMsg, setSheetStatusMsg] = useState("");
  const [showAppsScriptCode, setShowAppsScriptCode] = useState(false);

  // Cloudinary Photo Migration State
  const [migratingPhotos, setMigratingPhotos] = useState(false);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState("");

  const handleMigratePhotos = async () => {
    setMigratingPhotos(true);
    setMigrationStatusMsg("");
    try {
      const res = await fetch("/api/migrate-photos-to-cloudinary", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMigrationStatusMsg(`✅ ${data.message}`);
      } else {
        setMigrationStatusMsg(`❌ Migration Error: ${data.error}`);
      }
    } catch (err) {
      setMigrationStatusMsg(`❌ Network Error: ${err.message}`);
    } finally {
      setMigratingPhotos(false);
    }
  };

  React.useEffect(() => {
    if (settings.redirectUrl) {
      setRedirectUrlInput(settings.redirectUrl);
    }
    if (settings.googleSheetWebhookUrl !== undefined) {
      setSheetWebhookUrl(settings.googleSheetWebhookUrl || "");
    }
    if (settings.googleSheetAutoSyncEnabled !== undefined) {
      setSheetAutoSync(settings.googleSheetAutoSyncEnabled === "true" || settings.googleSheetAutoSyncEnabled === true);
    }
  }, [settings.redirectUrl, settings.googleSheetWebhookUrl, settings.googleSheetAutoSyncEnabled]);

  const handleManualSheetSync = async () => {
    setSheetSyncing(true);
    setSheetStatusMsg("");
    try {
      // First ensure latest settings are saved
      await handleSaveSheetSettings(sheetWebhookUrl, sheetAutoSync);

      const res = await fetch("/api/google-sheets/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSheetStatusMsg(`✅ Successfully synced ${data.count} rows to Google Sheets at ${data.syncedAt}!`);
      } else {
        setSheetStatusMsg(`❌ Sync Error: ${data.error}`);
      }
    } catch (err) {
      setSheetStatusMsg(`❌ Network Error: ${err.message}`);
    } finally {
      setSheetSyncing(false);
    }
  };

  const handleSaveSheetSettings = async (urlVal, syncVal) => {
    const updated = {
      ...settings,
      googleSheetWebhookUrl: (urlVal || "").trim(),
      googleSheetAutoSyncEnabled: syncVal
    };
    const res = await onUpdateSettings(updated);
    if (res && res.success) {
      setSheetStatusMsg("Google Sheets Webhook settings saved successfully!");
      setTimeout(() => setSheetStatusMsg(""), 3500);
    }
  };

  // Purchaser / Staff State
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPassword, setPPassword] = useState("");
  const [pDesignation, setPDesignation] = useState("Purchaser");
  const [customDesignationInput, setCustomDesignationInput] = useState("");
  const [pError, setPError] = useState("");
  const [pSuccess, setPSuccess] = useState("");

  // Staff Edit State
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editNameVal, setEditNameVal] = useState("");
  const [editPasswordVal, setEditPasswordVal] = useState("");
  const [editDesignationVal, setEditDesignationVal] = useState("Purchaser");
  const [editRoleVal, setEditRoleVal] = useState("purchaser");
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

  // Active User Sessions & Auth Audit Logs State
  const [activeSessions, setActiveSessions] = useState([]);
  const [authAuditLogs, setAuthAuditLogs] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessionsData = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions data:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  React.useEffect(() => {
    fetchSessionsData();
    const interval = setInterval(fetchSessionsData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForceLogout = async (userId, sessionId) => {
    try {
      const res = await fetch("/api/auth/force-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionId })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Error signing out user:", err);
    }
  };

  const handleForceLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to sign out ALL active users?")) return;
    try {
      const res = await fetch("/api/auth/force-logout-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentAdminId: "u_admin" })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Error signing out all users:", err);
    }
  };

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

    let finalDesignation = pDesignation;
    if (pDesignation === "Custom" && customDesignationInput.trim()) {
      finalDesignation = customDesignationInput.trim();
      if (onAddDesignation) onAddDesignation(finalDesignation);
    }

    let roleVal = "purchaser";
    const dLower = finalDesignation.toLowerCase();
    if (dLower.includes("owner")) roleVal = "owner";
    else if (dLower.includes("admin") || dLower.includes("superadmin")) roleVal = "superadmin";
    else if (dLower.includes("logistics") || dLower.includes("coordinator")) roleVal = "coordinator";
    else if (dLower.includes("packing") || dLower.includes("nitin")) roleVal = "nitin";
    else if (dLower.includes("accounts") || dLower.includes("rahul")) roleVal = "rahul";

    const res = onAddPurchaser(pName, pEmail, pPassword, finalDesignation, roleVal);
    if (res.success) {
      setPSuccess(`Staff account ${pName} created successfully as ${finalDesignation}!`);
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

        <button 
          onClick={() => setSubTab("settings")}
          className={`sidebar-link ${subTab === "settings" ? "active" : ""}`}
        >
          <Sliders size={16} /> System Settings
        </button>

        <button 
          onClick={() => setSubTab("itemmaster")}
          className={`sidebar-link ${subTab === "itemmaster" ? "active" : ""}`}
          style={{ color: "#38bdf8", fontWeight: 700 }}
        >
          <Package size={16} /> Item Catalog & Stock
        </button>

        <button 
          onClick={() => setSubTab("sessions")}
          className={`sidebar-link ${subTab === "sessions" ? "active" : ""}`}
          style={{ color: "#10b981", fontWeight: 700 }}
        >
          <ShieldCheck size={16} /> User Sessions & Logs
        </button>

        <button 
          onClick={() => setSubTab("filemanager")}
          className={`sidebar-link ${subTab === "filemanager" ? "active" : ""}`}
          style={{ color: "#f59e0b", fontWeight: 700 }}
        >
          <Folder size={16} /> Storage & File Manager
        </button>
      </aside>

      {/* Main content display */}
      <section className="main-content">

        {/* USER SESSIONS & AUTH LOGS TAB */}
        {subTab === "sessions" && (
          <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Header & Global Action Bar */}
            <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <ShieldCheck size={24} style={{ color: "#10b981" }} /> User Active Sessions & Authentication Logs
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Monitor who is signed in right now, view login & logout timestamp history, and remotely sign out specific users or all users.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={fetchSessionsData} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <RefreshCw size={14} className={loadingSessions ? "spin" : ""} /> Refresh
                </button>

                <button 
                  onClick={handleForceLogoutAll} 
                  className="btn btn-danger" 
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <LogOut size={14} /> Sign Out All Users
                </button>
              </div>
            </div>

            {/* Currently Active Logged-In Users */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "var(--success)" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--success)" }}></span>
                  Currently Logged In Right Now ({activeSessions.length})
                </h3>
              </div>

              {activeSessions.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  No active user sessions currently registered.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "650px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "20%", textAlign: "center" }}>Status</th>
                        <th style={{ width: "25%", textAlign: "center" }}>User Name</th>
                        <th style={{ width: "15%", textAlign: "center" }}>Role</th>
                        <th style={{ width: "25%", textAlign: "center" }}>Signed In At</th>
                        <th style={{ width: "15%", textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.map(s => {
                        const displayRole = s.role === "superadmin" ? "Admin" : s.role;
                        const displayName = (s.userName || "").replace(/super\s*admin/gi, "Admin");

                        return (
                          <tr key={s.sessionId}>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }}></span> 🟢 Active Now
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: "var(--primary)", textAlign: "center" }}>{displayName}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-secondary" style={{ textTransform: "capitalize" }}>{displayRole}</span>
                            </td>
                            <td style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>{s.loginTime}</td>
                            <td style={{ textAlign: "center" }}>
                              <button 
                                onClick={() => handleForceLogout(s.userId, s.sessionId)} 
                                className="btn btn-sm btn-danger"
                                style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                              >
                                Sign Out
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Login & Logout History Audit Trail */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={18} style={{ color: "var(--primary)" }} /> Authentication History & Timestamp Log
              </h3>

              {authAuditLogs.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  No authentication logs recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: "450px" }}>
                  <table className="table" style={{ width: "100%", minWidth: "650px" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{ width: "24%", textAlign: "center" }}>Date & Time</th>
                        <th style={{ width: "26%", textAlign: "center" }}>User Name</th>
                        <th style={{ width: "16%", textAlign: "center" }}>Role</th>
                        <th style={{ width: "18%", textAlign: "center" }}>Auth Event Action</th>
                        <th style={{ width: "16%", textAlign: "center" }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authAuditLogs.map(log => {
                        const displayRole = log.role === "superadmin" ? "Admin" : log.role;
                        const displayName = (log.userName || "").replace(/super\s*admin/gi, "Admin");

                        return (
                          <tr key={log.id}>
                            <td style={{ fontSize: "0.83rem", color: "var(--text-muted)", textAlign: "center" }}>{log.timestamp}</td>
                            <td style={{ fontWeight: 600, textAlign: "center" }}>{displayName}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-secondary" style={{ textTransform: "capitalize" }}>{displayRole}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`badge ${log.action === "Login" ? "badge-success" : log.action === "Logout" ? "badge-secondary" : "badge-danger"}`}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>{log.details || "N/A"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ITEM MASTER & STOCK TAB */}
        {subTab === "itemmaster" && (
          <ItemCatalogPanel 
            items={items}
            onAddItem={onAddItem}
            onBulkAddItems={onBulkAddItems}
            onDeleteItems={onDeleteItems}
            onUpdateItem={onUpdateItem}
            onMergeItems={onMergeItems}
            currentUser={{ role: "superadmin", name: "Admin" }}
            requests={requests}
            cargos={cargos}
            vendors={vendors}
            users={users}
            cargoCompanies={cargoCompanies}
          />
        )}

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
                                <span className="badge" style={{ fontSize: "0.65rem", padding: "2px 8px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700 }}>
                                  {staff.designation || getRoleLabel(staff.role)}
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
                                  setEditDesignationVal(staff.designation || "Purchaser");
                                  setEditRoleVal(staff.role || "purchaser");
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

                              <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>System Access Role (Permissions)</label>
                                <select 
                                  className="form-control" 
                                  style={{ padding: "4px 8px", fontSize: "0.85rem", height: "32px", fontWeight: 700, color: "var(--primary)" }}
                                  value={editRoleVal}
                                  onChange={e => {
                                    const r = e.target.value;
                                    setEditRoleVal(r);
                                    if (r === "owner") setEditDesignationVal("Owner");
                                    else if (r === "purchaser") setEditDesignationVal("Purchaser");
                                    else if (r === "nitin") setEditDesignationVal("Packing");
                                    else if (r === "rahul") setEditDesignationVal("Accounts and Updates");
                                    else if (r === "coordinator") setEditDesignationVal("Logistics");
                                  }}
                                >
                                  <option value="owner">👑 Owner (Executive Dashboard)</option>
                                  <option value="purchaser">🛒 Purchaser (Order Processing)</option>
                                  <option value="nitin">📦 Packing</option>
                                  <option value="rahul">💰 Accounts & Updates</option>
                                  <option value="coordinator">🚚 Logistics Coordinator</option>
                                  <option value="superadmin">⚡ System Admin</option>
                                </select>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>Designation Title</label>
                                <select 
                                  className="form-control" 
                                  style={{ padding: "4px 8px", fontSize: "0.85rem", height: "32px" }}
                                  value={editDesignationVal}
                                  onChange={e => setEditDesignationVal(e.target.value)}
                                >
                                  <option value="Purchaser">Purchaser</option>
                                  <option value="Packing">Packing</option>
                                  <option value="Accounts and Updates">Accounts and Updates</option>
                                  <option value="Accounts">Accounts</option>
                                  <option value="Warehouse">Warehouse</option>
                                  <option value="Logistics">Logistics</option>
                                  <option value="Owner">Owner (Executive Dashboard)</option>
                                  <option value="System Admin">System Admin</option>
                                  {(designations || []).map(d => (
                                    <option key={d.id} value={d.title}>{d.title}</option>
                                  ))}
                                </select>
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
                                    let roleVal = editRoleVal;
                                    const dLower = editDesignationVal.toLowerCase();
                                    if (dLower.includes("owner")) roleVal = "owner";
                                    else if (dLower.includes("admin") || dLower.includes("superadmin")) roleVal = "superadmin";
                                    else if (dLower.includes("logistics") || dLower.includes("coordinator")) roleVal = "coordinator";
                                    else if (dLower.includes("packing") || dLower.includes("nitin")) roleVal = "nitin";
                                    else if (dLower.includes("accounts") || dLower.includes("rahul")) roleVal = "rahul";
                                    
                                    const updates = { 
                                      name: editNameVal.trim(), 
                                      designation: editDesignationVal,
                                      role: roleVal 
                                    };
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

              {/* Add Staff Account Form */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Create Staff Account</h3>
                {pError && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{pError}</div>}
                {pSuccess && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{pSuccess}</div>}

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
                      placeholder="e.g. nitin@makpowerindia.com"
                      value={pEmail}
                      onChange={e => setPEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Designation</label>
                    <select 
                      className="form-control"
                      value={pDesignation}
                      onChange={e => setPDesignation(e.target.value)}
                    >
                      <option value="Purchaser">Purchaser</option>
                      <option value="Packing">Packing</option>
                      <option value="Accounts and Updates">Accounts and Updates</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Logistics">Logistics</option>
                      <option value="Owner">Owner (Executive Dashboard)</option>
                      <option value="System Admin">System Admin</option>
                      {(designations || []).map(d => (
                        <option key={d.id} value={d.title}>{d.title}</option>
                      ))}
                      <option value="Custom">+ Write-in Custom Designation</option>
                    </select>
                  </div>

                  {pDesignation === "Custom" && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Custom Designation Title*</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Quality Control, Factory Head"
                        value={customDesignationInput}
                        onChange={e => setCustomDesignationInput(e.target.value)}
                        required
                      />
                    </div>
                  )}

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
                          const purchaserMatch = purchaserObj && purchaserObj.name ? purchaserObj.name.toLowerCase().includes(searchLower) : false;
                          
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
                  Upload a previously saved Mak Power backup file. This will restore the entire database state. 
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

              {/* Cloudinary Image Migration Panel */}
              <div className="glass-panel" style={{ padding: "24px", gridColumn: "1 / -1" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={18} style={{ color: "#38bdf8" }} /> Cloudinary Photo Storage Migration Engine
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
                  Automatically scans your database for any local SVG, base64, or data-URI photos, uploads them to your Cloudinary database storage, and converts database references to fast HTTPS Cloudinary URLs.
                </p>

                {migrationStatusMsg && (
                  <div className={`alert-strip ${migrationStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {migrationStatusMsg}
                  </div>
                )}

                <button 
                  onClick={handleMigratePhotos}
                  disabled={migratingPhotos}
                  className="btn btn-primary"
                  style={{ padding: "12px 24px", fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <RefreshCw size={16} className={migratingPhotos ? "spin" : ""} />
                  {migratingPhotos ? "Migrating Database Photos to Cloudinary..." : "Migrate All Database Photos to Cloudinary"}
                </button>
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

        {/* SYSTEM SETTINGS TAB */}
        {subTab === "settings" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>System Settings</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
              
              {/* Admin Password Management Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Key size={20} style={{ color: "#38bdf8" }} /> Update Admin Password
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Update the master password for the Super Admin account (<code>admin@company.com</code>).
                </p>

                {adminPassMsg.text && (
                  <div className={`alert-strip alert-${adminPassMsg.type}`} style={{ marginBottom: "16px" }}>
                    {adminPassMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdateAdminPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">New Admin Password</label>
                    <input 
                      type="password"
                      className="form-control"
                      placeholder="Enter new password"
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Confirm New Admin Password</label>
                    <input 
                      type="password"
                      className="form-control"
                      placeholder="Re-enter new password"
                      value={confirmAdminPassword}
                      onChange={e => setConfirmAdminPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingAdminPass}
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}
                  >
                    {updatingAdminPass ? "Updating Admin Password..." : "Update Admin Password"}
                  </button>
                </form>
              </div>
              
              {/* Visibility Controller Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>System Visibility Mode</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Toggling panic mode hides the entire application. Anyone trying to visit the website will be forced to redirect to the URL configured on the right.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: settings.isHidden ? "var(--danger)" : "var(--success)", boxShadow: settings.isHidden ? "0 0 10px var(--danger)" : "0 0 10px var(--success)" }}></div>
                    <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                      System Status: {settings.isHidden ? "HIDDEN (Panic Mode)" : "ACTIVE / VISIBLE"}
                    </span>
                  </div>

                  <button 
                    onClick={async () => {
                      const updated = { ...settings, isHidden: !settings.isHidden };
                      const res = await onUpdateSettings(updated);
                      if (res && res.success) {
                        setSettingsSuccessMsg(`System visibility updated to: ${updated.isHidden ? "Hidden" : "Visible"}`);
                        setTimeout(() => setSettingsSuccessMsg(""), 3000);
                      }
                    }} 
                    className={`btn ${settings.isHidden ? "btn-primary" : "btn-danger"}`}
                    style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
                  >
                    {settings.isHidden ? "Show Application (Turn Off Panic)" : "Hide App & Force Redirect Users"}
                  </button>
                </div>

                {settingsSuccessMsg && (
                  <div className="alert-strip alert-success" style={{ marginTop: "16px", marginBottom: 0 }}>
                    {settingsSuccessMsg}
                  </div>
                )}
              </div>

              {/* Cloudinary CDN Photo Migration Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={20} style={{ color: "#38bdf8" }} /> Cloudinary Storage & Photo Migration
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Scans all database order items and catalog model photos. Converts raw Base64 data images (`data:image...`) into hosted Cloudinary HTTPS CDN URLs for Google Sheets rendering.
                </p>

                {migrationStatusMsg && (
                  <div className={`alert-strip ${migrationStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {migrationStatusMsg}
                  </div>
                )}

                <button
                  onClick={handleMigratePhotos}
                  disabled={migratingPhotos}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <RefreshCw size={16} className={migratingPhotos ? "spin" : ""} />
                  {migratingPhotos ? "Migrating All Photos to Cloudinary..." : "Migrate All Database Photos to Cloudinary CDN"}
                </button>
              </div>

              {/* Data Purge / Wipe Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--danger)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Trash2 size={20} style={{ color: "var(--danger)" }} /> Purge Operational Data
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Wipes all operational data (orders, requests, vendors, items, cargo shipments) starting completely fresh with 0 records. User accounts are preserved.
                </p>

                <button
                  onClick={async () => {
                    if (!window.confirm("⚠️ ARE YOU SURE? This will permanently delete ALL orders, vendors, items, and cargo shipments!")) return;
                    if (onPurgeAllData) {
                      await onPurgeAllData(true);
                      alert("✅ All operational data, vendors, and items have been purged successfully!");
                    }
                  }}
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}
                >
                  Purge All Orders, Vendors, Cargo & Items Data
                </button>
              </div>

              {/* Redirect Settings Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Panic Redirect Settings</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Redirect Target URL</label>
                    <input 
                      type="url" 
                      className="form-control" 
                      placeholder="https://www.instagram.com/makpowerofficial/"
                      value={redirectUrlInput}
                      onChange={e => setRedirectUrlInput(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      if (!redirectUrlInput.trim()) return;
                      const updated = { ...settings, redirectUrl: redirectUrlInput.trim() };
                      const res = await onUpdateSettings(updated);
                      if (res && res.success) {
                        setSettingsSuccessMsg("Redirect URL updated successfully!");
                        setTimeout(() => setSettingsSuccessMsg(""), 3000);
                      }
                    }} 
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Save Redirect URL
                  </button>

                  <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px", marginTop: "6px" }}>
                    <label className="form-label" style={{ color: "var(--primary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                      Instant Panic Trigger Link (/web):
                    </label>
                    <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "0.8rem", wordBreak: "break-all", justifyContent: "space-between", alignItems: "center" }}>
                      <code>{window.location.origin}/web</code>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                      Share this link with trusted team members. Opening this link in any browser will immediately lock the app and redirect them to your Instagram page.
                    </span>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px", marginTop: "6px" }}>
                    <label className="form-label" style={{ color: "var(--primary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                      Bypass Code Link (?bypass=true):
                    </label>
                    <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "0.8rem", wordBreak: "break-all", justifyContent: "space-between", alignItems: "center" }}>
                      <code>{window.location.origin}/?bypass=true</code>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                      Use this bypass link to access the app and log back in as Super Admin when panic mode is active.
                    </span>
                  </div>
                </div>
              </div>

              {/* Google Sheets Integration Panel */}
              <div className="glass-panel" style={{ padding: "24px", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={20} style={{ color: "#10b981" }} /> Google Sheets 27-Column Auto-Sync (Every 10 Mins)
                  </h3>

                  {settings.lastGoogleSheetSyncTime && (
                    <span className="badge badge-success" style={{ fontSize: "0.78rem" }}>
                      Last Synced: {settings.lastGoogleSheetSyncTime}
                    </span>
                  )}
                </div>

                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "16px" }}>
                  Automatically syncs all 27 purchase & cargo tracking columns to your Google Sheet every 10 minutes. If any information is missing, blank values (`""`) are sent.
                </p>

                {sheetStatusMsg && (
                  <div className={`alert-strip ${sheetStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {sheetStatusMsg}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Google Apps Script Webhook URL</label>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                      <input 
                        type="url" 
                        className="form-control" 
                        placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                        value={sheetWebhookUrl}
                        onChange={e => setSheetWebhookUrl(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button 
                        onClick={() => handleSaveSheetSettings(sheetWebhookUrl, sheetAutoSync)}
                        className="btn btn-secondary"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        Save Settings
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <input 
                        type="checkbox" 
                        id="sheetAutoSyncToggle"
                        checked={sheetAutoSync}
                        onChange={e => {
                          const val = e.target.checked;
                          setSheetAutoSync(val);
                          handleSaveSheetSettings(sheetWebhookUrl, val);
                        }}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <label htmlFor="sheetAutoSyncToggle" style={{ fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                        Enable Automatic 10-Minute Sync Engine
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
                    <button 
                      onClick={handleManualSheetSync}
                      disabled={sheetSyncing}
                      className="btn btn-primary"
                      style={{ padding: "12px", fontSize: "0.92rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <RefreshCw size={16} className={sheetSyncing ? "spin" : ""} />
                      {sheetSyncing ? "Syncing 27 Columns to Google Sheets..." : "Sync to Google Sheet Now"}
                    </button>

                    <button 
                      onClick={() => setShowAppsScriptCode(!showAppsScriptCode)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8rem" }}
                    >
                      {showAppsScriptCode ? "Hide Google Apps Script Setup Code" : "📋 View Google Apps Script Setup Code"}
                    </button>
                  </div>
                </div>

                {showAppsScriptCode && (
                  <div style={{ marginTop: "20px", background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                    <h4 style={{ fontSize: "0.88rem", color: "var(--primary)", marginBottom: "8px" }}>Google Apps Script Receiver Code (Copy & Paste into Google Sheets → Extensions → Apps Script):</h4>
                    <pre style={{ background: "#0f172a", color: "#38bdf8", padding: "12px", borderRadius: "6px", fontSize: "0.75rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>
{`function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Imported Data From App";
  var sheet = ss.getSheetByName(sheetName);
  
  // If the sheet tab "Imported Data From App" does not exist, create it automatically
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var headers = ["Purchaser", "Vendor", "Order Date", "Type", "Model", "Order Quantity", "Price (RMB)", "Total (RMB)", "Advance Payment", "Balance Payment", "Photo", "Vendor EDD", "Cargo Order Date", "Cargo Detail", "Cargo Price", "Cargo Price UOM", "CBM as per Packing List", "Total Cargo Price", "Mode of Transport", "Cargo Shipping Date", "Cargo ETA", "Packing List", "Invoice", "Is Material Rec?", "Packing Slip", "Packing Ordered By Nitin", "Purchase Updated?"];
  sheet.clearContents();
  sheet.appendRow(headers);

  if (data.rows && data.rows.length > 0) {
    data.rows.forEach(function(r) {
      sheet.appendRow([r.purchaser || "", r.vendor || "", r.orderDate || "", r.type || "", r.model || "", r.orderQuantity || "", r.priceRmb || "", r.totalRmb || "", r.advancePayment || "", r.balancePayment || "", r.photo || "", r.vendorEdd || "", r.cargoOrderDate || "", r.cargoDetail || "", r.cargoPrice || "", r.cargoPriceUom || "", r.cbmPackingList || "", r.totalCargoPrice || "", r.modeOfTransport || "", r.cargoShippingDate || "", r.cargoEta || "", r.packingListFile || "", r.invoiceFile || "", r.isMaterialRec || "", r.packingSlip || "", r.packingOrderedByNitin || "", r.purchaseUpdated || ""]);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success", sheet: sheetName, count: data.rows ? data.rows.length : 0 })).setMimeType(ContentService.MimeType.JSON);
}`}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* STORAGE & DESKTOP FILE MANAGER TAB */}
        {subTab === "filemanager" && (() => {
          // Requirement 2: Live Filtered Files Calculation
          const rawFiles = Array.isArray(storageFiles) ? storageFiles : [];
          const rawFolders = Array.isArray(storageFolders) ? storageFolders : [];
          const rawSelectedIds = Array.isArray(selectedFileIds) ? selectedFileIds : [];

          const filteredStorageFiles = rawFiles.filter(file => {
            if (!file) return false;
            const isCloudinary = file.storageType === "Cloudinary CDN" || (file.url && file.url.includes("cloudinary.com"));

            if (storageFilterSource === "postgres" && isCloudinary) return false;
            if (storageFilterSource === "cloudinary" && !isCloudinary) return false;

            if (storageSearchQuery && storageSearchQuery.trim() !== "") {
              const q = storageSearchQuery.toLowerCase();
              const matchName = file.name ? file.name.toLowerCase().includes(q) : false;
              const matchId = file.public_id ? file.public_id.toLowerCase().includes(q) : false;
              if (!matchName && !matchId) return false;
            }

            if (storageFileType && storageFileType !== "all") {
              const fmt = (file.format || "").toLowerCase();
              if (storageFileType === "image") {
                const isImg = ["jpg", "png", "jpeg", "webp", "gif", "svg"].includes(fmt) || (file.url && file.url.startsWith("data:image"));
                if (!isImg) return false;
              } else if (storageFileType === "pdf") {
                const isPdf = fmt === "pdf" || (file.name && file.name.toLowerCase().endsWith(".pdf")) || (file.url && file.url.toLowerCase().endsWith(".pdf"));
                if (!isPdf) return false;
              }
            }

            return true;
          });

          const isAllSelected = filteredStorageFiles.length > 0 && filteredStorageFiles.every(f => rawSelectedIds.includes(f.public_id));

          const handleSelectAllFiles = (e) => {
            if (e.target.checked) {
              setSelectedFileIds(filteredStorageFiles.map(f => f.public_id));
            } else {
              setSelectedFileIds([]);
            }
          };

          const handleToggleFileSelect = (public_id) => {
            setSelectedFileIds(prev =>
              (Array.isArray(prev) ? prev : []).includes(public_id) 
                ? prev.filter(id => id !== public_id) 
                : [...(Array.isArray(prev) ? prev : []), public_id]
            );
          };

          return (
            <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Header */}
              <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <HardDrive size={24} style={{ color: "#f59e0b" }} /> Live Storage Usage & Desktop File Manager
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    Real-time database storage metrics for PostgreSQL and Cloudinary CDN, plus desktop folder browsing, multi-select, and asset deletion.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button 
                    onClick={handleDeleteAllCloudinaryImages}
                    className="btn btn-danger"
                    disabled={loadingStorage}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    title="Permanently delete all images from Cloudinary storage"
                  >
                    <Trash2 size={16} /> Delete All Images from Cloudinary
                  </button>
                  <button 
                    onClick={() => loadStorageData(currentFolder)} 
                    className="btn btn-secondary"
                    disabled={loadingStorage}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <RefreshCw size={16} className={loadingStorage ? "spin" : ""} /> Refresh Storage Metrics
                  </button>
                </div>
              </div>

              {/* Requirement 2: Interactive Storage Source Metric Cards (Click to Filter) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                
                {/* PostgreSQL Storage Card */}
                <div 
                  className="glass-panel" 
                  onClick={() => setStorageFilterSource(storageFilterSource === "postgres" ? "all" : "postgres")}
                  style={{ 
                    padding: "20px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "16px", 
                    cursor: "pointer",
                    border: storageFilterSource === "postgres" ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
                    background: storageFilterSource === "postgres" ? "rgba(56, 189, 248, 0.12)" : "var(--bg-card)",
                    transition: "all 0.2s ease"
                  }}
                  title="Click to view PostgreSQL Database assets only"
                >
                  <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                    <Database size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>PostgreSQL Database Storage</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {storageMetrics?.postgres?.sizeStr || "Loading..."}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: "2px", fontWeight: 600 }}>
                      {storageFilterSource === "postgres" ? "✓ FILTERING: PostgreSQL Data Only" : "Click to show PostgreSQL Data only"}
                    </div>
                  </div>
                </div>

                {/* Cloudinary Storage Card */}
                <div 
                  className="glass-panel" 
                  onClick={() => setStorageFilterSource(storageFilterSource === "cloudinary" ? "all" : "cloudinary")}
                  style={{ 
                    padding: "20px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "16px", 
                    cursor: "pointer",
                    border: storageFilterSource === "cloudinary" ? "2px solid #f59e0b" : "1px solid var(--border-glass)",
                    background: storageFilterSource === "cloudinary" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-card)",
                    transition: "all 0.2s ease"
                  }}
                  title="Click to view Cloudinary CDN assets only"
                >
                  <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    <HardDrive size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Cloudinary Media CDN Storage</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {storageMetrics?.cloudinary?.usageStr || "Loading..."}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "2px", fontWeight: 600 }}>
                      {storageFilterSource === "cloudinary" ? "✓ FILTERING: Cloudinary Data Only" : "Click to show Cloudinary Data only"}
                    </div>
                  </div>
                </div>

              </div>

              {/* Requirement 2: Data Filters, Search, Select All, and Multi-Select Batch Actions Toolbar */}
              <div className="glass-panel" style={{ padding: "18px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "16px" }}>
                  
                  {/* Left Filters */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>Data Filters:</span>
                    
                    {/* Storage Source Filter */}
                    <select 
                      className="form-control" 
                      style={{ width: "200px" }}
                      value={storageFilterSource}
                      onChange={e => setStorageFilterSource(e.target.value)}
                    >
                      <option value="all" style={{ background: "#0f172a" }}>All Storage Sources</option>
                      <option value="postgres" style={{ background: "#0f172a" }}>PostgreSQL Database Only</option>
                      <option value="cloudinary" style={{ background: "#0f172a" }}>Cloudinary CDN Only</option>
                    </select>

                    {/* File Format Filter */}
                    <select 
                      className="form-control" 
                      style={{ width: "160px" }}
                      value={storageFileType}
                      onChange={e => setStorageFileType(e.target.value)}
                    >
                      <option value="all" style={{ background: "#0f172a" }}>All File Types</option>
                      <option value="image" style={{ background: "#0f172a" }}>Images Only</option>
                      <option value="pdf" style={{ background: "#0f172a" }}>PDF Documents</option>
                    </select>

                    {/* Search Input */}
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Search asset name or ID..."
                      style={{ width: "220px" }}
                      value={storageSearchQuery}
                      onChange={e => setStorageSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Right Select & Select All Option */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <label className="checkbox-label" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      <input 
                        type="checkbox"
                        className="checkbox-input"
                        checked={isAllSelected}
                        onChange={handleSelectAllFiles}
                      />
                      Select All ({filteredStorageFiles.length})
                    </label>

                    {selectedFileIds.length > 0 && (
                      <button 
                        onClick={handleBatchDeleteStorageFiles}
                        className="btn btn-danger btn-sm"
                        style={{ padding: "6px 14px" }}
                      >
                        <Trash2 size={14} /> Delete Selected ({selectedFileIds.length})
                      </button>
                    )}
                  </div>

                </div>

                {/* Filter summary status strip */}
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>Showing <strong>{filteredStorageFiles.length}</strong> of {storageFiles.length} total files</span>
                  {storageFilterSource !== "all" && (
                    <span className="badge badge-primary" style={{ fontSize: "0.7rem" }}>
                      Source: {storageFilterSource === "postgres" ? "PostgreSQL Database" : "Cloudinary CDN"}
                    </span>
                  )}
                  {selectedFileIds.length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: "0.7rem" }}>
                      {selectedFileIds.length} files selected
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop File Manager Explorer */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                  
                  {/* Breadcrumbs */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", fontWeight: 600 }}>
                    <button 
                      onClick={() => loadStorageData("")}
                      className="btn btn-sm btn-secondary"
                      style={{ padding: "4px 10px" }}
                    >
                      Root /
                    </button>
                    {currentFolder && (
                      <span style={{ color: "var(--primary)" }}>{currentFolder}</span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {storageFolders.length} folders, {filteredStorageFiles.length} matching files
                  </div>
                </div>

                {storageStatusMsg && (
                  <div className={`alert-strip ${storageStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {storageStatusMsg}
                  </div>
                )}

                {/* Folders List */}
                {storageFolders.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folders</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                      {storageFolders.map(folder => (
                        <div 
                          key={folder.path}
                          onClick={() => loadStorageData(folder.path)}
                          className="glass-panel"
                          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", border: "1px solid var(--border-glass)", transition: "all 0.2s ease" }}
                        >
                          <Folder size={20} style={{ color: "#f59e0b" }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Grid with Select Option on every file card */}
                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Files & Assets</h4>
                
                {filteredStorageFiles.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No files match the selected filter criteria.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                    {filteredStorageFiles.map(file => {
                      const isChecked = selectedFileIds.includes(file.public_id);

                      return (
                        <div 
                          key={file.public_id}
                          className="glass-panel"
                          style={{ 
                            padding: "14px", 
                            display: "flex", 
                            flexDirection: "column", 
                            justify: "space-between", 
                            gap: "10px", 
                            border: isChecked ? "2px solid var(--primary)" : "1px solid var(--border-glass)",
                            background: isChecked ? "rgba(56, 189, 248, 0.08)" : "var(--bg-card)",
                            position: "relative"
                          }}
                        >
                          {/* Selection Checkbox */}
                          <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 5 }}>
                            <input 
                              type="checkbox"
                              className="checkbox-input"
                              checked={isChecked}
                              onChange={() => handleToggleFileSelect(file.public_id)}
                              title="Select asset"
                            />
                          </div>

                          <div>
                            {/* Thumbnail */}
                            <div style={{ width: "100%", height: "110px", borderRadius: "6px", background: "rgba(0,0,0,0.3)", overflow: "hidden", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {file.url ? (
                                <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <FileText size={32} style={{ opacity: 0.4 }} />
                              )}
                            </div>

                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "20px" }} title={file.name}>
                              {file.name}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Size: {file.sizeStr}</span>
                              <span className="badge badge-secondary" style={{ fontSize: "0.62rem" }}>{file.storageType || "Database"}</span>
                            </div>
                          </div>

                          {/* File Card Actions */}
                          <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border-glass)", paddingTop: "8px" }}>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-sm btn-secondary"
                              style={{ flex: 1, padding: "4px", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                            >
                              <ExternalLink size={12} /> View
                            </a>
                            <button 
                              onClick={() => handleDeleteStorageFile(file.public_id)}
                              className="btn btn-sm btn-secondary"
                              style={{ color: "var(--danger)", padding: "4px 8px" }}
                              title="Delete File Asset"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>
          );
        })()}

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
