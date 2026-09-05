import React, { useState, useMemo } from "react";
import { History, User, Filter, Search, Download, Clock, ShieldCheck, Tag, FileText, ChevronRight, X, AlertCircle } from "lucide-react";
import { useSortableData } from "../utils/useSortableData";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";
import { downloadCsv } from "../utils/formatters";

export default function AuditLogsPanel({ auditLogs = [], users = [], requests = [], vendors = [] }) {
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectLog, setInspectLog] = useState(null); // Selected log for version snapshot diff modal

  // 1. Filter Audit Logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return auditLogs.filter(log => {
      // User Filter
      if (selectedUser !== "all") {
        const uObj = (users || []).find(u => u.id === selectedUser || u.name === selectedUser);
        const searchName = uObj ? uObj.name.toLowerCase() : selectedUser.toLowerCase();
        const logUserId = (log.userId || "").toLowerCase();
        const logUserName = (log.userName || "").toLowerCase();
        const logDetails = (log.details || "").toLowerCase();

        const matchId = logUserId === selectedUser.toLowerCase();
        const matchName = logUserName.includes(searchName);
        const matchDetails = logDetails.includes(searchName);
        if (!matchId && !matchName && !matchDetails) return false;
      }

      // Action Filter
      if (selectedAction !== "all") {
        const act = (log.action || "").toUpperCase();
        if (selectedAction === "PRICING" && !act.includes("PRICE") && !act.includes("FULFILL") && !act.includes("DETAILS")) return false;
        if (selectedAction === "CARGO" && !act.includes("CARGO")) return false;
        if (selectedAction === "VENDOR" && !act.includes("VENDOR")) return false;
        if (selectedAction === "REQUEST" && !act.includes("REQUEST") && !act.includes("ORDER") && !act.includes("PACKING") && !act.includes("BATCH") && !act.includes("CREATE")) return false;
        if (selectedAction === "ITEM" && !act.includes("ITEM") && !act.includes("CATALOG")) return false;
        if (selectedAction === "USER" && !act.includes("USER") && !act.includes("LOGIN") && !act.includes("LOGOUT")) return false;
      }

      // Date Range Filter
      if (startDate || endDate) {
        const logTime = log.isoTime || log.timestamp;
        if (!isDateInBetween(logTime, startDate, endDate)) return false;
      }

      // Search Query Filter
      if (q) {
        const matchUser = (log.userName || "").toLowerCase().includes(q);
        const matchAction = (log.action || "").toLowerCase().includes(q);
        const matchDetails = (log.details || "").toLowerCase().includes(q);
        const matchEntity = (log.entityType || "").toLowerCase().includes(q);
        const matchId = (log.entityId || "").toLowerCase().includes(q);

        if (!matchUser && !matchAction && !matchDetails && !matchEntity && !matchId) return false;
      }

      return true;
    });
  }, [auditLogs, selectedUser, selectedAction, startDate, endDate, searchQuery, users]);

  const { items: sortedLogs, RenderSortHeader } = useSortableData(filteredLogs);

  // Helper: Export to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Log ID", "Timestamp (IST)", "User Name", "Role", "Action Type", "Entity Type", "Entity ID", "Details"];
    const rows = filteredLogs.map(log => [
      log.id || "",
      log.timestamp || log.isoTime || "",
      log.userName || "",
      log.role || "",
      log.action || "",
      log.entityType || "",
      log.entityId || "",
      log.details || ""
    ]);

    downloadCsv(headers, rows, `MakPower_Audit_Logs_Version_History_${new Date().toISOString().split("T")[0]}`);
  };

  // Helper: Render Action Badge
  const renderActionBadge = (action = "") => {
    const act = action.toUpperCase();
    let bg = "rgba(56, 189, 248, 0.15)";
    let color = "#38bdf8";
    let border = "rgba(56, 189, 248, 0.3)";

    if (act.includes("CREATE") || act.includes("REGISTER") || act.includes("ADD")) {
      bg = "rgba(16, 185, 129, 0.15)";
      color = "#a7f3d0";
      border = "rgba(16, 185, 129, 0.3)";
    } else if (act.includes("PRICE") || act.includes("FULFILL")) {
      bg = "rgba(245, 158, 11, 0.15)";
      color = "#fdba74";
      border = "rgba(245, 158, 11, 0.3)";
    } else if (act.includes("CANCEL") || act.includes("DELETE") || act.includes("REMOVE")) {
      bg = "rgba(239, 68, 68, 0.15)";
      color = "#fca5a5";
      border = "rgba(239, 68, 68, 0.3)";
    } else if (act.includes("CARGO")) {
      bg = "rgba(129, 140, 248, 0.15)";
      color = "#c7d2fe";
      border = "rgba(129, 140, 248, 0.3)";
    } else if (act.includes("LOGIN") || act.includes("AUTH")) {
      bg = "rgba(236, 72, 153, 0.15)";
      color = "#fbcfe8";
      border = "rgba(236, 72, 153, 0.3)";
    }

    return (
      <span style={{ 
        display: "inline-flex", 
        alignItems: "center", 
        padding: "3px 8px", 
        borderRadius: "6px", 
        fontSize: "0.75rem", 
        fontWeight: 700, 
        background: bg, 
        color: color, 
        border: `1px solid ${border}`,
        whiteSpace: "nowrap"
      }}>
        {action}
      </span>
    );
  };

  return (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Top Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h3 style={{ fontSize: "1.4rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={22} /> Version History & System Audit Logs
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>
            Complete real-time Google Sheets-style activity log — trace who made every change, when, and what values were modified.
          </p>
        </div>

        <button onClick={handleExportCsv} className="btn btn-secondary btn-sm" disabled={filteredLogs.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Download size={14} /> Export History (CSV)
        </button>
      </div>

      {/* Filter Toolbar Bar */}
      <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by User, Model, Order ID, or Keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
        </div>

        {/* User Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <User size={15} style={{ color: "var(--primary)" }} />
          <select className="form-control" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ minWidth: "160px" }}>
            <option value="all" style={{ background: "#0f172a" }}>All Staff Users ({users.length})</option>
            {users.map(u => (
              <option key={u.id} value={u.id} style={{ background: "#0f172a" }}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Action Category Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={15} style={{ color: "var(--secondary)" }} />
          <select className="form-control" value={selectedAction} onChange={e => setSelectedAction(e.target.value)} style={{ minWidth: "160px" }}>
            <option value="all" style={{ background: "#0f172a" }}>All Action Types</option>
            <option value="PRICING" style={{ background: "#0f172a" }}>Pricing & Commercials</option>
            <option value="CARGO" style={{ background: "#0f172a" }}>Cargo & Logistics</option>
            <option value="REQUEST" style={{ background: "#0f172a" }}>Requisitions & Orders</option>
            <option value="VENDOR" style={{ background: "#0f172a" }}>Vendor Operations</option>
            <option value="ITEM" style={{ background: "#0f172a" }}>Master Item Catalog</option>
            <option value="USER" style={{ background: "#0f172a" }}>User Sessions & Security</option>
          </select>
        </div>

        {/* Looker Studio Style Date Range Filter */}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={() => {
            setStartDate("");
            setEndDate("");
          }}
        />

      </div>

      {/* Version History & Audit Log Table */}
      <div className="glass-panel" style={{ padding: "4px" }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <History size={36} style={{ color: "var(--primary)", marginBottom: "10px", display: "inline" }} /><br />
            No audit history logs match your active filter criteria.
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: "650px", overflowY: "auto" }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <RenderSortHeader colKey="timestamp" title="Date & Time (IST)" getValue={log => log.isoTime || log.timestamp} style={{ width: "170px" }} />
                  <RenderSortHeader colKey="userName" title="User (Who)" style={{ width: "160px" }} />
                  <RenderSortHeader colKey="action" title="Action" style={{ width: "130px" }} />
                  <RenderSortHeader colKey="details" title="Activity Description & Entity Details" />
                  <th style={{ width: "110px", textAlign: "center" }}>Version Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      <Clock size={12} style={{ marginRight: "4px", verticalAlign: "middle", opacity: 0.7 }} />
                      {log.timestamp || (log.isoTime ? new Date(log.isoTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "N/A")}
                    </td>

                    <td>
                      <strong style={{ fontSize: "0.85rem", color: "var(--primary)" }}>{log.userName || "System"}</strong>
                      {log.role && (
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", textTransform: "capitalize" }}>
                          ({log.role})
                        </span>
                      )}
                    </td>

                    <td>
                      {renderActionBadge(log.action)}
                    </td>

                    <td style={{ fontSize: "0.85rem" }}>
                      <div>{log.details || "System action recorded"}</div>
                      {log.entityId && (
                        <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "2px", fontWeight: 600 }}>
                          Target ID: {log.entityId} {log.entityType ? `(${log.entityType})` : ""}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {(log.oldData || log.newData) ? (
                        <button 
                          onClick={() => setInspectLog(log)} 
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.76rem", padding: "4px 8px" }}
                          title="View field-level version history diff"
                        >
                          Diff Snapshot
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.5 }}>Standard Log</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot Diff Modal */}
      {inspectLog && (
        <div className="modal-overlay" style={{ zIndex: 999999 }}>
          <div className="glass-panel modal-content" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={18} /> Version History Diff Snapshot
              </h3>
              <button type="button" onClick={() => setInspectLog(null)} className="modal-close"><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "0.85rem" }}>
                <strong>Action:</strong> {inspectLog.action} | <strong>User:</strong> {inspectLog.userName} ({inspectLog.role})
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {inspectLog.timestamp} — {inspectLog.details}
              </div>

              {inspectLog.oldData && (
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--danger)", marginBottom: "4px" }}>Previous Version State (Before):</div>
                  <pre style={{ background: "rgba(15, 23, 42, 0.7)", padding: "10px", borderRadius: "6px", fontSize: "0.78rem", color: "#fca5a5", overflowX: "auto" }}>
                    {typeof inspectLog.oldData === "string" ? inspectLog.oldData : JSON.stringify(inspectLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {inspectLog.newData && (
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--success)", marginBottom: "4px" }}>Updated Version State (After):</div>
                  <pre style={{ background: "rgba(15, 23, 42, 0.7)", padding: "10px", borderRadius: "6px", fontSize: "0.78rem", color: "#a7f3d0", overflowX: "auto" }}>
                    {typeof inspectLog.newData === "string" ? inspectLog.newData : JSON.stringify(inspectLog.newData, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <button type="button" onClick={() => setInspectLog(null)} className="btn btn-secondary">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
