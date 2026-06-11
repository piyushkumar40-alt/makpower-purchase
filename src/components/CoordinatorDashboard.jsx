import React, { useState } from "react";
import { LogOut, Filter, ShieldAlert, Clock, AlertTriangle, CheckCircle, Search, User } from "lucide-react";

export default function CoordinatorDashboard({ currentUser, requests, vendors, cargos, users, onLogout }) {
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "delayed"
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const todayStr = "2026-06-11";
  const today = new Date(todayStr);

  const getDaysOverdue = (dateStr) => {
    if (!dateStr) return 0;
    const target = new Date(dateStr);
    const diff = today - target;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Compile all tasks
  const allTasks = [];

  requests.forEach(r => {
    const purchaser = users.find(u => u.id === r.purchaserId);
    const purchaserName = purchaser?.name || "Purchaser";
    const vendorName = vendors.find(v => v.id === r.vendorId)?.name || "—";
    const cargo = cargos.find(c => c.id === r.cargoId);

    // 1. PURCHASER: Awaiting Price (Step 1)
    if (!r.priceRmb && r.status !== "Cancelled") {
      const isDelayed = r.requiredByDate && new Date(r.requiredByDate) < today;
      const daysOverdue = isDelayed ? getDaysOverdue(r.requiredByDate) : 0;
      allTasks.push({
        id: `price-${r.id}`,
        reqId: r.id,
        assigneeId: r.purchaserId,
        assigneeName: purchaserName,
        assigneeRole: "Purchaser",
        taskType: "Pricing",
        taskName: "Set Price & Select Vendor",
        itemDesc: `${r.model} (${r.orderQuantity} qty)`,
        vendor: vendorName,
        stage: "Step 1: Commercial Spec",
        targetDate: r.requiredByDate || "—",
        isDelayed,
        daysOverdue,
        severity: daysOverdue > 7 ? "Critical" : daysOverdue > 0 ? "Warning" : "Normal"
      });
    }

    // 2. PURCHASER: Awaiting Cargo assignment (Step 3)
    if (r.priceRmb && !r.cargoId && r.status !== "Cancelled") {
      // Delay if it's past vendor Edd or vendorReadyDate
      const delayDate = r.vendorReadyDate || r.vendorEdd;
      const isDelayed = delayDate && new Date(delayDate) < today;
      const daysOverdue = isDelayed ? getDaysOverdue(delayDate) : 0;
      allTasks.push({
        id: `cargo-${r.id}`,
        reqId: r.id,
        assigneeId: r.purchaserId,
        assigneeName: purchaserName,
        assigneeRole: "Purchaser",
        taskType: "Cargo Assignment",
        taskName: "Consolidate into Cargo",
        itemDesc: `${r.model} (${r.orderQuantity} qty)`,
        vendor: vendorName,
        stage: "Step 3: Cargo Consolidation",
        targetDate: delayDate || "—",
        isDelayed,
        daysOverdue,
        severity: daysOverdue > 5 ? "Critical" : daysOverdue > 0 ? "Warning" : "Normal"
      });
    }

    // 3. NITIN: Awaiting Packing Order (Import items only)
    if (r.priceRmb && r.vendorId && r.type === "Import" && r.packingOrderedByNitin !== "Yes" && r.status !== "Cancelled") {
      const delayDate = r.vendorReadyDate || r.vendorEdd;
      const isDelayed = delayDate && new Date(delayDate) < today;
      const daysOverdue = isDelayed ? getDaysOverdue(delayDate) : 0;
      allTasks.push({
        id: `packing-${r.id}`,
        reqId: r.id,
        assigneeId: "u-nitin",
        assigneeName: "Nitin Kumar",
        assigneeRole: "Packing Coordinator",
        taskType: "Packing",
        taskName: "Order Packing Material",
        itemDesc: `${r.model} (${r.orderQuantity} qty)`,
        vendor: vendorName,
        stage: "Nitin Checklist",
        targetDate: delayDate || "—",
        isDelayed,
        daysOverdue,
        severity: daysOverdue > 3 ? "Critical" : daysOverdue > 0 ? "Warning" : "Normal"
      });
    }

    // 4. RAHUL: Awaiting Purchase Update
    if (r.priceRmb && r.vendorId && r.purchaseUpdated !== "Yes" && r.status !== "Cancelled") {
      const delayDate = r.vendorReadyDate || r.vendorEdd;
      const isDelayed = delayDate && new Date(delayDate) < today;
      const daysOverdue = isDelayed ? getDaysOverdue(delayDate) : 0;
      allTasks.push({
        id: `update-${r.id}`,
        reqId: r.id,
        assigneeId: "u-rahul",
        assigneeName: "Rahul Dev",
        assigneeRole: "Purchase Updater",
        taskType: "Purchase Update",
        taskName: "Submit Purchase Ledger Update",
        itemDesc: `${r.model} (${r.orderQuantity} qty)`,
        vendor: vendorName,
        stage: "Rahul Checklist",
        targetDate: delayDate || "—",
        isDelayed,
        daysOverdue,
        severity: daysOverdue > 3 ? "Critical" : daysOverdue > 0 ? "Warning" : "Normal"
      });
    }
  });

  // 5. CARGO: Transit tracking / Receipt delays
  cargos.forEach(c => {
    if (c.isMaterialRec !== "Yes") {
      const isDelayed = c.cargoEta && new Date(c.cargoEta) < today;
      const daysOverdue = isDelayed ? getDaysOverdue(c.cargoEta) : 0;
      
      // Find purchaser responsible (via first item in cargo)
      const cargoItems = requests.filter(r => r.cargoId === c.id);
      const responsiblePurchaserId = cargoItems[0]?.purchaserId || "";
      const purchaser = users.find(u => u.id === responsiblePurchaserId);
      const purchaserName = purchaser?.name || "Unassigned";

      allTasks.push({
        id: `transit-${c.id}`,
        cargoId: c.id,
        assigneeId: responsiblePurchaserId,
        assigneeName: purchaserName,
        assigneeRole: "Purchaser",
        taskType: "Transit Tracking",
        taskName: `Track Cargo Delivery (${c.id})`,
        itemDesc: `Cargo: ${c.cargoDetail || "Consolidated Cargo"}`,
        vendor: vendors.find(v => v.id === c.vendorId)?.name || "—",
        stage: "Step 5: Transit Tracking",
        targetDate: c.cargoEta || "—",
        isDelayed,
        daysOverdue,
        severity: daysOverdue > 5 ? "Critical" : daysOverdue > 0 ? "Warning" : "Normal"
      });
    }
  });

  // Filter tasks based on active view and filters
  const currentTabTasks = allTasks.filter(t => activeTab === "pending" ? true : t.isDelayed);

  const filteredTasks = currentTabTasks.filter(t => {
    const assigneeMatch = filterAssignee === "" || t.assigneeId === filterAssignee || t.assigneeName.toLowerCase().includes(filterAssignee.toLowerCase());
    const typeMatch = filterType === "" || t.taskType === filterType;
    const searchMatch = searchTerm === "" || 
      t.itemDesc.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    return assigneeMatch && typeMatch && searchMatch;
  });

  // Overview Counts
  const totalPending = allTasks.length;
  const totalDelayed = allTasks.filter(t => t.isDelayed).length;

  // Active unique staff dropdown list
  const activeStaffList = Array.from(new Set(allTasks.map(t => JSON.stringify({ id: t.assigneeId, name: t.assigneeName, role: t.assigneeRole }))))
    .map(str => JSON.parse(str))
    .filter(u => u.id);

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", color: "var(--primary)", textShadow: "0 0 10px var(--primary-glow)" }}>Process Coordination Console</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>Work Progress, Delivery Breaches & Operations Auditing</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="user-badge" style={{ padding: "6px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "var(--accent)" }}>
            Role: Process Coordinator
          </span>
          <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ padding: "8px 14px" }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div>
            <div className="metric-label">Awaiting Progress (Pending)</div>
            <div className="metric-value" style={{ color: "var(--primary)" }}>{totalPending}</div>
          </div>
          <div style={{ padding: "10px", background: "var(--primary-glow)", borderRadius: "12px", color: "var(--primary)" }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <div>
            <div className="metric-label">Overdue & Delayed Tasks</div>
            <div className="metric-value" style={{ color: "var(--danger)" }}>{totalDelayed}</div>
          </div>
          <div style={{ padding: "10px", background: "var(--danger-glow)", borderRadius: "12px", color: "var(--danger)" }}>
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
        <button 
          onClick={() => setActiveTab("pending")} 
          className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
        >
          All Pending Workflow Tasks ({totalPending})
        </button>
        <button 
          onClick={() => setActiveTab("delayed")} 
          className={`tab-btn ${activeTab === "delayed" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {totalDelayed > 0 && <AlertTriangle size={14} style={{ color: "var(--danger)" }} />}
          Delayed & Overdue Tasks ({totalDelayed})
        </button>
      </div>

      {/* Filters Panel */}
      <div className="glass-panel" style={{ padding: "18px 24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", fontSize: "0.9rem", fontWeight: 600, color: "var(--primary)" }}>
          <Filter size={16} /> Coordinator Task Filters
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          
          {/* Staff / Name Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Assignee Name (Purchaser/Nitin/Rahul)</label>
            <select className="form-control" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
              <option value="" style={{ background: "#0f172a" }}>All Staff Members</option>
              {activeStaffList.map(u => (
                <option key={u.id} value={u.id} style={{ background: "#0f172a" }}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Task Type Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Workflow Task Type</label>
            <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="" style={{ background: "#0f172a" }}>All Task Types</option>
              <option value="Pricing" style={{ background: "#0f172a" }}>Pricing</option>
              <option value="Packing" style={{ background: "#0f172a" }}>Nitin Packing</option>
              <option value="Purchase Update" style={{ background: "#0f172a" }}>Rahul Ledger Update</option>
              <option value="Cargo Assignment" style={{ background: "#0f172a" }}>Cargo Planner</option>
              <option value="Transit Tracking" style={{ background: "#0f172a" }}>Transit Tracking</option>
            </select>
          </div>

          {/* Search box */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Description / Vendor</label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="text"
                className="form-control"
                style={{ paddingLeft: "36px" }}
                placeholder="Search description, models..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Task List Table */}
      {filteredTasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)" }}>
          <CheckCircle size={36} style={{ color: "var(--success)", marginBottom: "12px", display: "inline" }} /><br />
          No pending or overdue tasks found matching your filters.
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: "4px" }}>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Responsible Person</th>
                  <th>Staff Role</th>
                  <th>Task Action Required</th>
                  <th>Item / Description</th>
                  <th>Vendor</th>
                  <th>Target Date</th>
                  <th>Workflow Stage</th>
                  {activeTab === "delayed" && <th>Overdue Days</th>}
                  <th>Breach Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => (
                  <tr key={t.id} style={{ background: t.isDelayed ? "rgba(239, 68, 68, 0.02)" : "" }}>
                    <td style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={12} style={{ color: "var(--text-muted)" }} />
                      {t.assigneeName}
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", color: "var(--text-muted)" }}>
                        {t.assigneeRole}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--primary)" }}>{t.taskName}</td>
                    <td style={{ fontSize: "0.85rem", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.itemDesc}>
                      {t.itemDesc}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{t.vendor}</td>
                    <td style={{ fontSize: "0.85rem" }}>{t.targetDate}</td>
                    <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t.stage}</td>
                    {activeTab === "delayed" && (
                      <td style={{ fontWeight: 700, color: "var(--danger)" }}>
                        {t.daysOverdue} days
                      </td>
                    )}
                    <td>
                      {t.isDelayed ? (
                        <span className="badge badge-rejected" style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                          Overdue ({t.severity})
                        </span>
                      ) : (
                        <span className="badge badge-pending" style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                          On Track
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
