import React, { useState } from "react";
import { 
  Building2, TrendingUp, DollarSign, Package, Truck, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Search, Filter, ShieldCheck, 
  Users, Award, ArrowUpRight, BarChart3, Clock, PieChart, RefreshCw 
} from "lucide-react";

export default function OwnerDashboard({
  currentUser = {},
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  items = [],
  cargoCompanies = [],
  onLogout
}) {
  const [selectedPurchaser, setSelectedPurchaser] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("all"); // "all" | "30days" | "thisYear"
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate High-Level Metrics
  const activeRequests = requests.filter(r => r.status !== "Cancelled");
  
  // Total Spend (RMB)
  const totalRmbSpend = activeRequests.reduce((sum, r) => sum + (parseFloat(r.totalRmb) || 0), 0);
  // Total Advance Paid
  const totalAdvancePaid = activeRequests.reduce((sum, r) => sum + (parseFloat(r.advancePayment) || 0), 0);
  // Total Balance Due
  const totalBalanceDue = activeRequests.reduce((sum, r) => sum + (parseFloat(r.balancePayment) || 0), 0);

  // In-Transit Cargos & Cargo Freight Spend
  const inTransitCargos = cargos.filter(c => c.isMaterialRec !== "Yes");
  const totalCargoFreightSpend = cargos.reduce((sum, c) => sum + (parseFloat(c.totalCargoPrice) || 0), 0);

  // Completed Orders Count
  const completedOrders = activeRequests.filter(r => r.isMaterialRec === "Yes");
  const pendingOrders = activeRequests.filter(r => r.isMaterialRec !== "Yes");

  // Filter requests based on user filters
  const filteredRequests = activeRequests.filter(r => {
    const matchesPurchaser = selectedPurchaser === "all" || r.purchaserId === selectedPurchaser || r.entryBy === selectedPurchaser;
    const matchesCategory = categoryFilter === "all" || (r.category && r.category.toLowerCase() === categoryFilter.toLowerCase());
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (r.id && r.id.toLowerCase().includes(q)) || 
      (r.model && r.model.toLowerCase().includes(q)) || 
      (r.category && r.category.toLowerCase().includes(q));
    return matchesPurchaser && matchesCategory && matchesSearch;
  });

  // Spend Breakdown by Category
  const categorySpendMap = {};
  activeRequests.forEach(r => {
    const cat = r.category || "General";
    categorySpendMap[cat] = (categorySpendMap[cat] || 0) + (parseFloat(r.totalRmb) || 0);
  });
  const categorySpendList = Object.entries(categorySpendMap)
    .map(([cat, amount]) => ({ category: cat, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Spend Breakdown by Item Type (FG vs RM)
  let fgSpend = 0;
  let rmSpend = 0;
  activeRequests.forEach(r => {
    const amt = parseFloat(r.totalRmb) || 0;
    if (r.type === "FG" || (r.type && r.type.includes("FG"))) {
      fgSpend += amt;
    } else {
      rmSpend += amt;
    }
  });

  // Vendor Performance Table Data
  const vendorPerformance = vendors.map(v => {
    const vRequests = activeRequests.filter(r => r.vendorId === v.id);
    const vSpend = vRequests.reduce((sum, r) => sum + (parseFloat(r.totalRmb) || 0), 0);
    const vCompleted = vRequests.filter(r => r.isMaterialRec === "Yes").length;
    const fulfillmentRate = vRequests.length > 0 ? Math.round((vCompleted / vRequests.length) * 100) : 100;
    return {
      id: v.id,
      name: v.name,
      spend: vSpend,
      totalOrders: vRequests.length,
      completedOrders: vCompleted,
      fulfillmentRate
    };
  }).sort((a, b) => b.spend - a.spend);

  // Purchaser Activity & Workload Table Data
  const purchaserWorkload = users.map(u => {
    const pRequests = activeRequests.filter(r => r.purchaserId === u.id || r.entryBy === u.name);
    const pSpend = pRequests.reduce((sum, r) => sum + (parseFloat(r.totalRmb) || 0), 0);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      designation: u.designation || u.role,
      orderCount: pRequests.length,
      spend: pSpend
    };
  }).filter(u => u.orderCount > 0 || u.designation === "Purchaser" || u.designation === "Owner");

  // Critical Risk & Delay Alerts
  const today = new Date().toISOString().slice(0, 10);
  const delayedCargos = cargos.filter(c => c.isMaterialRec !== "Yes" && c.cargoEta && c.cargoEta < today);
  const highValuePendingOrders = activeRequests.filter(r => r.isMaterialRec !== "Yes" && parseFloat(r.totalRmb) > 20000);

  // Download Owner Executive Summary Report CSV
  const handleExportExecutiveReport = () => {
    const headers = [
      "PO Number", "Order Date", "Category", "Item Model / Name", "Item Type", 
      "Quantity", "Price (RMB)", "Total (RMB)", "Advance Paid", "Balance Due", 
      "Vendor", "Delivery Status", "Cargo ETA"
    ];

    const rows = activeRequests.map(r => {
      const vendorObj = vendors.find(v => v.id === r.vendorId);
      const cargoObj = cargos.find(c => c.id === r.cargoId);
      return [
        `"${r.id}"`,
        `"${r.orderDate || ""}"`,
        `"${r.category || "General"}"`,
        `"${(r.model || "").replace(/"/g, '""')}"`,
        `"${r.type || "RM"}"`,
        r.orderQuantity || 0,
        r.priceRmb || 0,
        r.totalRmb || 0,
        r.advancePayment || 0,
        r.balancePayment || 0,
        `"${(vendorObj ? vendorObj.name : r.vendorId || "").replace(/"/g, '""')}"`,
        r.isMaterialRec === "Yes" ? "Received" : "Pending / In-Transit",
        `"${cargoObj ? cargoObj.cargoEta || "" : ""}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Makpower_Owner_Executive_Summary_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card-fade-in" style={{ paddingBottom: "40px" }}>
      
      {/* Executive Welcome & Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px" }}>
              <Building2 size={32} style={{ color: "#38bdf8" }} /> Executive Owner Dashboard
            </h1>
            <span className="badge" style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#fff", padding: "4px 12px", fontSize: "0.8rem", borderRadius: "12px", fontWeight: 700 }}>
              <ShieldCheck size={14} style={{ display: "inline", marginRight: "4px" }} /> Executive Owner Mode
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time financial analytics, procurement spend breakdown, vendor scorecards, and supply chain risk intelligence for Makpower India.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            onClick={handleExportExecutiveReport}
            className="btn btn-secondary"
            style={{ borderColor: "#38bdf8", color: "#7dd3fc", fontWeight: 600 }}
          >
            <Download size={16} /> Export Executive Report (.csv)
          </button>

          {onLogout && (
            <button onClick={onLogout} className="btn btn-danger btn-sm">
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Financial Executive KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        
        {/* Total Purchase Spend */}
        <div className="stat-card" style={{ borderTop: "4px solid #38bdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Total Purchase Spend</span>
            <div className="stat-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#38bdf8" }}>
            ¥ {totalRmbSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
            Advance Paid: <strong>¥ {totalAdvancePaid.toLocaleString()}</strong> | Bal: <strong>¥ {totalBalanceDue.toLocaleString()}</strong>
          </div>
        </div>

        {/* Total Active Purchase Orders */}
        <div className="stat-card" style={{ borderTop: "4px solid #818cf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Active Purchase Orders</span>
            <div className="stat-icon" style={{ background: "rgba(129, 140, 248, 0.15)", color: "#818cf8" }}>
              <Package size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#818cf8" }}>
            {activeRequests.length} <span style={{ fontSize: "1rem", fontWeight: 500 }}>POs</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
            Received: <strong style={{ color: "#34d399" }}>{completedOrders.length}</strong> | Pending: <strong style={{ color: "#fbbf24" }}>{pendingOrders.length}</strong>
          </div>
        </div>

        {/* Cargo & Logistics In-Transit */}
        <div className="stat-card" style={{ borderTop: "4px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Cargos In-Transit</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              <Truck size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>
            {inTransitCargos.length} <span style={{ fontSize: "1rem", fontWeight: 500 }}>Shipments</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
            Freight Spend: <strong>¥ {totalCargoFreightSpend.toLocaleString()}</strong>
          </div>
        </div>

        {/* Active Vendors & Master Catalog */}
        <div className="stat-card" style={{ borderTop: "4px solid #34d399" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="stat-label">Vendors & Catalog</span>
            <div className="stat-icon" style={{ background: "rgba(52, 211, 153, 0.15)", color: "#34d399" }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "#34d399" }}>
            {vendors.length} <span style={{ fontSize: "1rem", fontWeight: 500 }}>Vendors</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
            Master Items in Catalog: <strong>{items.length}</strong>
          </div>
        </div>

      </div>

      {/* Critical Executive Risk Alerts Strip */}
      {(delayedCargos.length > 0 || highValuePendingOrders.length > 0) && (
        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "#f87171", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <AlertTriangle size={20} /> Executive Supply Chain Risk Alerts
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            
            {delayedCargos.length > 0 && (
              <div className="alert-strip alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>🚨 {delayedCargos.length} Cargo Shipment(s) Delayed Beyond ETA:</strong>
                  <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                    Shipments ({delayedCargos.map(c => c.id).join(", ")}) passed expected arrival date.
                  </div>
                </div>
              </div>
            )}

            {highValuePendingOrders.length > 0 && (
              <div className="alert-strip alert-warning" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>⚠️ {highValuePendingOrders.length} High-Value Pending Order(s) &gt; ¥20,000:</strong>
                  <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                    High-budget orders requiring owner monitoring before completion.
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Analytics Grid: Category Spend & Item Type Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        
        {/* Category Spend Distribution */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <PieChart size={18} style={{ color: "#38bdf8" }} /> Spend Distribution by Category
          </h3>

          {categorySpendList.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No active order spend data available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {categorySpendList.map(item => {
                const percentage = totalRmbSpend > 0 ? Math.round((item.amount / totalRmbSpend) * 100) : 0;
                return (
                  <div key={item.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>{item.category}</span>
                      <span><strong>¥ {item.amount.toLocaleString()}</strong> ({percentage}%)</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${percentage}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #818cf8)", borderRadius: "4px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Finished Goods (FG) vs Raw Materials (RM) Breakdown */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <BarChart3 size={18} style={{ color: "#34d399" }} /> Item Type Spend Ratio (FG vs RM)
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
              <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 700 }}>FINISHED GOODS (FG)</span>
              <h4 style={{ fontSize: "1.3rem", marginTop: "6px", color: "var(--text-main)" }}>
                ¥ {fgSpend.toLocaleString()}
              </h4>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {totalRmbSpend > 0 ? Math.round((fgSpend / totalRmbSpend) * 100) : 0}% of total spend
              </span>
            </div>

            <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(129, 140, 248, 0.08)", border: "1px solid rgba(129, 140, 248, 0.2)" }}>
              <span style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 700 }}>RAW MATERIALS (RM)</span>
              <h4 style={{ fontSize: "1.3rem", marginTop: "6px", color: "var(--text-main)" }}>
                ¥ {rmSpend.toLocaleString()}
              </h4>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {totalRmbSpend > 0 ? Math.round((rmSpend / totalRmbSpend) * 100) : 0}% of total spend
              </span>
            </div>
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Award size={16} style={{ color: "#fbbf24" }} /> Total Catalog Item Master Count: <strong>{items.length} items</strong>
          </div>
        </div>

      </div>

      {/* Top Vendors by Spend & Fulfillment Rate */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Building2 size={20} style={{ color: "var(--primary)" }} /> Top Vendors Spend & Fulfillment Scorecards
        </h3>

        <div className="table-container" style={{ maxHeight: "300px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.85rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <th>Vendor Name</th>
                <th>Total Spend (RMB)</th>
                <th>Total Orders</th>
                <th>Completed Orders</th>
                <th>Fulfillment Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendorPerformance.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                    No vendor performance data available.
                  </td>
                </tr>
              ) : (
                vendorPerformance.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, color: "var(--text-main)" }}>{v.name}</td>
                    <td style={{ fontWeight: 800, color: "#38bdf8" }}>¥ {v.spend.toLocaleString()}</td>
                    <td>{v.totalOrders}</td>
                    <td>{v.completedOrders}</td>
                    <td>
                      <span className={`badge ${v.fulfillmentRate >= 80 ? "badge-success" : v.fulfillmentRate >= 50 ? "badge-warning" : "badge-danger"}`}>
                        {v.fulfillmentRate}%
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-approved">Active Partner</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchaser Staff Activity Overview */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Users size={20} style={{ color: "#a855f7" }} /> Staff & Purchaser Performance Overview
        </h3>

        <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.85rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <th>Staff Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Orders Created</th>
                <th>Total Spend Managed</th>
              </tr>
            </thead>
            <tbody>
              {purchaserWorkload.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, color: "var(--text-main)" }}>{p.name}</td>
                  <td style={{ color: "var(--text-muted)" }}>{p.email}</td>
                  <td>
                    <span className="badge badge-secondary" style={{ fontSize: "0.75rem", textTransform: "capitalize" }}>
                      {p.designation}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.orderCount} POs</td>
                  <td style={{ fontWeight: 800, color: "#38bdf8" }}>¥ {p.spend.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Purchase Order Requisitions Audit Trail */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileSpreadsheet size={20} style={{ color: "#38bdf8" }} /> Executive Purchase Orders Audit Trail
          </h3>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search PO #, Item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "30px", fontSize: "0.82rem", width: "180px" }}
              />
            </div>
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: "400px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.83rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <th>PO Number</th>
                <th>Order Date</th>
                <th>Category</th>
                <th>Item Model / Name</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Total (RMB)</th>
                <th>Advance Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No purchase orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRequests.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: "var(--primary)" }}>{r.id}</td>
                    <td>{r.orderDate || "-"}</td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: "0.72rem" }}>
                        {r.category || "General"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.model}</td>
                    <td>
                      <span className={`badge ${r.type === "FG" ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "0.72rem" }}>
                        {r.type || "RM"}
                      </span>
                    </td>
                    <td>{r.orderQuantity}</td>
                    <td style={{ fontWeight: 800, color: "#38bdf8" }}>¥ {parseFloat(r.totalRmb || 0).toLocaleString()}</td>
                    <td>¥ {parseFloat(r.advancePayment || 0).toLocaleString()}</td>
                    <td>¥ {parseFloat(r.balancePayment || 0).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${r.isMaterialRec === "Yes" ? "badge-success" : "badge-warning"}`}>
                        {r.isMaterialRec === "Yes" ? "Received" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
