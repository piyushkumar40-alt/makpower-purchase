import React, { useState, useEffect } from "react";
import { 
  Home, Clock, AlertTriangle, CheckCircle2, User, Users, HardDrive, 
  Database, RefreshCw, BarChart2, Package, ArrowRight, ShieldCheck, 
  Sparkles, Calendar, FileText, Activity, Layers, AlertCircle,
  Truck, Building2, Eye, Check
} from "lucide-react";
import ItemMasterView from "./ItemMasterView";
import { isRequestForUser, calculateCargoTotalCartons } from "../utils/formatters";

export default function HomePage({
  currentUser,
  users = [],
  requests = [],
  vendors = [],
  cargos = [],
  cargoCompanies = [],
  onNavigateView,
  onLogout
}) {
  const [storageMetrics, setStorageMetrics] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Fetch metrics for SuperAdmin & system views
  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch("/api/storage/metrics"),
        fetch("/api/auth/sessions")
      ]);
      const mData = await mRes.json();
      const sData = await sRes.json();
      if (mData.success) setStorageMetrics(mData);
      if (sData.success) setActiveSessions(sData.activeSessions || []);
    } catch (err) {
      console.error("Error fetching homepage metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const [homeUpcomingTab, setHomeUpcomingTab] = useState("all"); // 'all' | 'cargos' | 'vendor_lots'
  const [homeExpandedCargos, setHomeExpandedCargos] = useState({});
  const [homeExpandedLots, setHomeExpandedLots] = useState({});

  // Active non-cancelled requests
  const activeRequests = requests.filter(r => r.status !== "Cancelled");

  // Purchaser-specific data
  const isAdminOrManager = currentUser?.role === "superadmin" || currentUser?.role === "owner" || currentUser?.role === "purchase_manager";
  const myRequests = activeRequests.filter(r => isAdminOrManager || isRequestForUser(r, currentUser, users));

  // Purchaser-specific in-transit cargos
  const myCargos = (cargos || []).filter(c => {
    const cargoItems = (requests || []).filter(r => r.cargoId === c.id && r.status !== "Cancelled");
    if (cargoItems.length === 0) return false;
    if (isAdminOrManager) return true;
    return cargoItems.some(r => isRequestForUser(r, currentUser, users));
  });

  const inTransitCargos = myCargos.filter(c => c.isMaterialRec !== "Yes");

  // Upcoming in-transit cargo consignments
  const upcomingCargoLots = inTransitCargos.map(cargo => {
    const vName = (vendors || []).find(v => v.id === cargo.vendorId)?.name || cargo.vendorName || "Unknown Vendor";
    const cargoName = (cargoCompanies || []).find(cc => cc.id === cargo.cargoCompanyId)?.name || cargo.cargoDetail || cargo.cargoCompanyName || "—";
    const cargoItems = (requests || []).filter(r => r.cargoId === cargo.id && r.status !== "Cancelled");
    const totalPcs = cargoItems.reduce((acc, r) => acc + (Number(r.vendorOrderQuantity || r.orderQuantity) || 0), 0);
    const totalCartons = calculateCargoTotalCartons(cargo, requests);

    let diffDays = null;
    let statusLabel = "In Transit";
    let statusBadge = "badge-cargo";

    if (cargo.cargoEta) {
      const eta = new Date(cargo.cargoEta);
      diffDays = Math.ceil((eta - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        statusLabel = `Overdue by ${Math.abs(diffDays)}d`;
        statusBadge = "badge-rejected";
      } else if (diffDays === 0) {
        statusLabel = "Arriving Today!";
        statusBadge = "badge-pending";
      } else if (diffDays === 1) {
        statusLabel = "Arriving Tomorrow";
        statusBadge = "badge-pending";
      } else if (diffDays <= 14) {
        statusLabel = `Arriving in ${diffDays} days (${diffDays}d left)`;
        statusBadge = "badge-cargo";
      } else {
        statusLabel = `In Transit (${diffDays}d left)`;
        statusBadge = "badge-received";
      }
    }

    return {
      ...cargo,
      vendorName: vName,
      cargoName,
      cargoItems,
      totalPcs,
      totalCartons,
      diffDays,
      statusLabel,
      statusBadge
    };
  }).sort((a, b) => {
    if (a.cargoEta && b.cargoEta) return a.cargoEta.localeCompare(b.cargoEta);
    if (a.cargoEta) return -1;
    if (b.cargoEta) return 1;
    return 0;
  });

  // Upcoming vendor ready lots (grouped by vendor + order date)
  const pendingVendorOrders = myRequests.filter(r => r.isMaterialRec !== "Yes" && !r.cargoId);
  const vendorLotMap = new Map();

  pendingVendorOrders.forEach(r => {
    const vId = r.vendorId || "unknown";
    const lotDate = r.orderDate || "No Date";
    const lotKey = `${vId}__${lotDate}`;

    if (!vendorLotMap.has(lotKey)) {
      const vName = (vendors || []).find(v => v.id === vId)?.name || r.vendorName || "Unknown Vendor";
      vendorLotMap.set(lotKey, {
        lotKey,
        vendorId: vId,
        vendorName: vName,
        orderDate: lotDate,
        items: [],
        totalQty: 0,
        edds: new Set(),
        models: []
      });
    }

    const lot = vendorLotMap.get(lotKey);
    lot.items.push(r);
    lot.totalQty += Number(r.vendorOrderQuantity || r.orderQuantity) || 0;
    if (r.vendorEdd) lot.edds.add(r.vendorEdd);
    if (!lot.models.includes(r.model)) lot.models.push(r.model);
  });

  const upcomingVendorLots = Array.from(vendorLotMap.values()).map(lot => {
    const eddList = Array.from(lot.edds).filter(Boolean).sort();
    const primaryEdd = eddList[0] || "";
    let diffDays = null;
    let statusLabel = "Awaiting EDD";
    let statusBadge = "badge-pending";

    if (primaryEdd) {
      const edd = new Date(primaryEdd);
      diffDays = Math.ceil((edd - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        statusLabel = `Overdue by ${Math.abs(diffDays)}d`;
        statusBadge = "badge-rejected";
      } else if (diffDays === 0) {
        statusLabel = "Ready Today";
        statusBadge = "badge-pending";
      } else if (diffDays === 1) {
        statusLabel = "Ready Tomorrow";
        statusBadge = "badge-pending";
      } else if (diffDays <= 14) {
        statusLabel = `Due in ${diffDays} days`;
        statusBadge = "badge-cargo";
      } else {
        statusLabel = `In ${diffDays} days`;
        statusBadge = "badge-received";
      }
    }

    return {
      ...lot,
      primaryEdd,
      diffDays,
      statusLabel,
      statusBadge
    };
  }).sort((a, b) => {
    if (a.primaryEdd && b.primaryEdd) return a.primaryEdd.localeCompare(b.primaryEdd);
    if (a.primaryEdd) return -1;
    if (b.primaryEdd) return 1;
    return b.orderDate.localeCompare(a.orderDate);
  });

  // Upcoming tasks for Purchaser (required/EDD within 14 days or pending action)
  const upcomingTasks = myRequests.filter(r => {
    if (r.isMaterialRec === "Yes") return false;
    if (!r.vendorEdd && !r.requiredByDate) return true; // Pending specification
    const targetDateStr = r.vendorEdd || r.requiredByDate;
    if (!targetDateStr) return true;
    const target = new Date(targetDateStr);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  });

  const purchaserDelayedCount = myRequests.filter(r => {
    if (r.isMaterialRec === "Yes") return false;
    if (!r.vendorEdd) return false;
    const edd = new Date(r.vendorEdd);
    return edd < today;
  }).length;

  // Person-wise delayed task breakdown for PC / Coordinator
  const activePurchasers = users.filter(u => (u.role === "purchaser" || u.role === "purchase_manager") && u.status === "active");
  const personWiseTaskStats = activePurchasers.map(p => {
    const pReqs = activeRequests.filter(r => isRequestForUser(r, p, activePurchasers));
    const total = pReqs.length;
    const received = pReqs.filter(r => r.isMaterialRec === "Yes").length;
    const pending = pReqs.filter(r => r.isMaterialRec !== "Yes");
    const delayed = pending.filter(r => {
      if (!r.vendorEdd && !r.requiredByDate) return false;
      const dStr = r.vendorEdd || r.requiredByDate;
      return new Date(dStr) < today;
    }).length;
    const onTime = total - delayed - received;
    const inTransit = pending.filter(r => r.cargoId).length;

    return {
      purchaser: p,
      total,
      received,
      pending: pending.length,
      delayed,
      onTime: Math.max(0, onTime),
      inTransit
    };
  });

  const totalDelayedAllPersons = personWiseTaskStats.reduce((sum, item) => sum + item.delayed, 0);

  // Overall Task Status Stats for charts
  const totalPendingPrice = activeRequests.filter(r => !r.priceRmb).length;
  const totalInTransit = activeRequests.filter(r => r.cargoId && r.isMaterialRec !== "Yes").length;
  const totalReceived = activeRequests.filter(r => r.isMaterialRec === "Yes").length;
  const totalActiveUsers = users.filter(u => u.status === "active").length;

  return (
    <div style={{ flex: 1, padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Welcome Banner */}
      <div className="glass-panel" style={{ padding: "24px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", background: "linear-gradient(135deg, rgba(13, 20, 38, 0.75) 0%, rgba(30, 41, 70, 0.75) 100%)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Sparkles size={22} style={{ color: "var(--primary)" }} />
            <h1 style={{ fontSize: "1.8rem", color: "var(--primary)", textShadow: "0 0 15px var(--primary-glow)", margin: 0 }}>
              Welcome Back, {currentUser?.name || "User"}!
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", margin: 0 }}>
            {["crm", "asm", "tsm", "rsm"].includes(currentUser?.role)
              ? "CRM & Field Sales Command Center"
              : "Purchase Ledger & Operations Command Center"} • Role: <strong style={{ color: "var(--text-main)", textTransform: "capitalize" }}>{currentUser?.role === "purchase_manager" ? "Purchase Manager" : (currentUser?.role || "Staff")}</strong>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={fetchMetrics} className="btn btn-secondary btn-sm" title="Refresh Dashboard Data">
            <RefreshCw size={14} className={loadingMetrics ? "spin" : ""} /> Refresh Status
          </button>
          {currentUser?.role === "superadmin" && (
            <button onClick={() => onNavigateView("admin")} className="btn btn-primary btn-sm">
              <ShieldCheck size={14} /> Open Admin Panel
            </button>
          )}
          {(currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm" || currentUser?.role === "rsm" || currentUser?.role === "superadmin" || currentUser?.role === "owner") && (
            <button onClick={() => onNavigateView("crm")} className="btn btn-primary btn-sm" style={{ background: "linear-gradient(135deg, #0284c7, #6366f1)" }}>
              <Activity size={14} /> Dashboard
            </button>
          )}
          {currentUser?.role === "superadmin" && (
            <button onClick={() => onNavigateView("ims")} className="btn btn-primary btn-sm" style={{ background: "linear-gradient(135deg, #0ea5e9, #10b981)" }}>
              <Layers size={14} /> IMS Stock Ledger
            </button>
          )}
          {["purchaser", "purchase_manager", "nitin", "rahul", "coordinator"].includes(currentUser?.role) && (
            <button onClick={() => onNavigateView(["purchaser", "purchase_manager"].includes(currentUser?.role) ? "dashboard" : currentUser?.role)} className="btn btn-primary btn-sm">
              <BarChart2 size={14} /> View Workboard
            </button>
          )}
        </div>
      </div>

      {/* ==================== ROLE VIEW: CRM EXECUTIVE HOME DASHBOARD ==================== */}
      {(currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm" || currentUser?.role === "rsm") && (
        <div className="card-fade-in glass-panel" style={{ padding: "26px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)" }}>
          <div>
            <span className="badge badge-primary" style={{ marginBottom: "6px" }}>Customer Relationship Management</span>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              {currentUser.name}'s Dashboard
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "4px", margin: 0 }}>
              Manage your assigned party accounts, field sales representatives (ASM/TSM/RSM), item-wise sales, and dispatch fulfillment.
            </p>
          </div>
          <button onClick={() => onNavigateView("crm")} className="btn btn-primary" style={{ padding: "10px 22px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            Open Dashboard <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ==================== ROLE VIEW 1: PURCHASER HOME DASHBOARD ==================== */}
      {(currentUser?.role === "purchaser" || currentUser?.role === "purchase_manager") && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Quick Metrics Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
                <Calendar size={26} />
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Upcoming Schedules (Next 14 Days)</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {upcomingCargoLots.length + upcomingVendorLots.filter(l => l.diffDays !== null && l.diffDays <= 14).length} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Orders (Lots)</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
                  {upcomingCargoLots.reduce((acc, c) => acc + c.cargoItems.length, 0) + upcomingVendorLots.filter(l => l.diffDays !== null && l.diffDays <= 14).reduce((acc, l) => acc + l.items.length, 0)} Items requiring action
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: purchaserDelayedCount > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)", color: purchaserDelayedCount > 0 ? "var(--danger)" : "var(--success)" }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>My Delayed Tasks</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: purchaserDelayedCount > 0 ? "var(--danger)" : "var(--success)" }}>
                  {purchaserDelayedCount > 0 ? `${purchaserDelayedCount} Items` : "0 (Good)"}
                </div>
                <div style={{ fontSize: "0.75rem", color: purchaserDelayedCount > 0 ? "var(--danger)" : "var(--success)" }}>
                  {purchaserDelayedCount > 0 ? "Missed vendor EDD target" : "All orders on track"}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
                <Clock size={26} />
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Pending Pricing / Specs</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {myRequests.filter(r => !r.priceRmb && r.isMaterialRec !== "Yes").length} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Items</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#f59e0b" }}>Awaiting supplier quotation</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Completed / Received</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--success)" }}>
                  {myRequests.filter(r => r.isMaterialRec === "Yes").length} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Items</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--success)" }}>Successfully delivered</div>
              </div>
            </div>
          </div>

          {/* ==================== UPCOMING SCHEDULES & CARGO IN-TRANSIT ==================== */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0, fontWeight: 700 }}>
                  <Clock size={20} /> My Upcoming Tasks & Action Schedule
                </h3>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "3px" }}>
                  Active shipments in transit (with live ETAs) and upcoming vendor ready dates (lot-wise).
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {/* View Pills */}
                <div style={{ display: "inline-flex", background: "rgba(255, 255, 255, 0.04)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border-glass)", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setHomeUpcomingTab("all")}
                    className={`btn btn-sm ${homeUpcomingTab === "all" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: homeUpcomingTab === "all" ? 700 : 500 }}
                  >
                    All Schedules ({upcomingCargoLots.length + upcomingVendorLots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeUpcomingTab("cargos")}
                    className={`btn btn-sm ${homeUpcomingTab === "cargos" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: homeUpcomingTab === "cargos" ? 700 : 500 }}
                  >
                    🚢 Cargo In-Transit ({upcomingCargoLots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeUpcomingTab("vendor_lots")}
                    className={`btn btn-sm ${homeUpcomingTab === "vendor_lots" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: homeUpcomingTab === "vendor_lots" ? 700 : 500 }}
                  >
                    🏭 Vendor Lots ({upcomingVendorLots.length})
                  </button>
                </div>

                <button onClick={() => onNavigateView("dashboard")} className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Go to Full Purchaser Workboard <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* UPCOMING CARGO SHIPMENTS SECTION */}
            {(homeUpcomingTab === "all" || homeUpcomingTab === "cargos") && (
              <div style={{ marginBottom: homeUpcomingTab === "all" ? "28px" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px" }}>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8" }}>
                    <Truck size={17} /> Upcoming Cargo Shipments (In-Transit & ETAs) ({upcomingCargoLots.length} Cargo Orders)
                  </h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Total: <strong style={{ color: "var(--text-main)" }}>{upcomingCargoLots.reduce((acc, c) => acc + c.totalPcs, 0).toLocaleString()} Pcs</strong> | <strong style={{ color: "var(--warning, #f59e0b)" }}>📦 {upcomingCargoLots.reduce((acc, c) => acc + c.totalCartons, 0)} Cartons</strong>
                  </span>
                </div>

                {upcomingCargoLots.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    No active in-transit cargo shipments found.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Cargo Company / Name</th>
                          <th>Vendor</th>
                          <th>Shipped Date</th>
                          <th>Upcoming Cargo ETA</th>
                          <th>Arrival Countdown</th>
                          <th>Items & Quantity</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingCargoLots.map(cargo => {
                          const isExpanded = !!homeExpandedCargos[cargo.id];
                          return (
                            <React.Fragment key={cargo.id}>
                              <tr>
                                <td>
                                  <div style={{ fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>📦 {cargo.cargoName}</span>
                                    <span className="badge badge-cargo" style={{ fontSize: "0.68rem", padding: "1px 5px" }}>
                                      {cargo.modeOfTransport || "Sea"}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                    {cargo.id}
                                  </div>
                                </td>
                                <td><strong>{cargo.vendorName}</strong></td>
                                <td>{cargo.cargoShippingDate || "—"}</td>
                                <td>
                                  <strong style={{ color: "var(--primary)" }}>
                                    🏁 {cargo.cargoEta || "No ETA"}
                                  </strong>
                                </td>
                                <td>
                                  <span className={`badge ${cargo.statusBadge}`} style={{ fontWeight: 700 }}>
                                    {cargo.statusLabel}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700 }}>
                                    {cargo.totalPcs.toLocaleString()} Pcs
                                  </div>
                                  <div style={{ fontSize: "0.74rem", color: "var(--warning, #f59e0b)", fontWeight: 600 }}>
                                    📦 {cargo.totalCartons} Cartons
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: "inline-flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHomeExpandedCargos(prev => ({
                                          ...prev,
                                          [cargo.id]: !prev[cargo.id]
                                        }));
                                      }}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: "3px 8px", fontSize: "0.74rem" }}
                                    >
                                      {isExpanded ? "Hide" : "Items"}
                                    </button>
                                    <button 
                                      onClick={() => onNavigateView("dashboard")} 
                                      className="btn btn-primary btn-sm" 
                                      style={{ padding: "3px 8px", fontSize: "0.74rem" }}
                                    >
                                      Open Cargo
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ background: "rgba(56, 189, 248, 0.02)" }}>
                                  <td colSpan="7" style={{ padding: "10px 16px" }}>
                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", marginBottom: "6px" }}>
                                      Bundled Items in Cargo ({cargo.cargoName} - {cargo.id}):
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
                                      {cargo.cargoItems.map(item => (
                                        <div key={item.id} style={{ background: "rgba(0,0,0,0.12)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.78rem" }}>
                                          <strong style={{ color: "var(--text-main)" }}>{item.model}</strong>
                                          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                                            Qty: {item.vendorOrderQuantity || item.orderQuantity} Pcs
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* UPCOMING VENDOR READY DATES (LOT-WISE) SECTION */}
            {(homeUpcomingTab === "all" || homeUpcomingTab === "vendor_lots") && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px" }}>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)" }}>
                    <Building2 size={17} /> Upcoming Vendor Ready Dates (Lot-wise) ({upcomingVendorLots.length} Orders / Lots)
                  </h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Total: <strong style={{ color: "var(--text-main)" }}>{upcomingVendorLots.reduce((acc, l) => acc + l.totalQty, 0).toLocaleString()} Pcs</strong> pending with vendors
                  </span>
                </div>

                {upcomingVendorLots.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    No upcoming vendor lots pending.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Vendor Name</th>
                          <th>Order Lot Date</th>
                          <th>Upcoming Vendor EDD</th>
                          <th>Ready Status</th>
                          <th>Items & Quantity</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingVendorLots.map(lot => {
                          const isExpanded = !!homeExpandedLots[lot.lotKey];
                          return (
                            <React.Fragment key={lot.lotKey}>
                              <tr>
                                <td>
                                  <strong style={{ color: "var(--text-main)" }}>{lot.vendorName}</strong>
                                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                    {lot.items.length} item line(s)
                                  </div>
                                </td>
                                <td>📅 {lot.orderDate}</td>
                                <td>
                                  <strong style={{ color: lot.primaryEdd ? "var(--primary)" : "var(--text-muted)" }}>
                                    {lot.primaryEdd || "Not Set"}
                                  </strong>
                                </td>
                                <td>
                                  <span className={`badge ${lot.statusBadge}`} style={{ fontWeight: 700 }}>
                                    {lot.statusLabel}
                                  </span>
                                </td>
                                <td>
                                  <strong style={{ color: "var(--text-main)" }}>
                                    {lot.totalQty.toLocaleString()} Pcs
                                  </strong>
                                </td>
                                <td>
                                  <div style={{ display: "inline-flex", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHomeExpandedLots(prev => ({
                                          ...prev,
                                          [lot.lotKey]: !prev[lot.lotKey]
                                        }));
                                      }}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: "3px 8px", fontSize: "0.74rem" }}
                                    >
                                      {isExpanded ? "Hide" : "Models"}
                                    </button>
                                    <button 
                                      onClick={() => onNavigateView("dashboard")} 
                                      className="btn btn-primary btn-sm" 
                                      style={{ padding: "3px 8px", fontSize: "0.74rem" }}
                                    >
                                      Open Lot
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ background: "rgba(56, 189, 248, 0.02)" }}>
                                  <td colSpan="6" style={{ padding: "10px 16px" }}>
                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", marginBottom: "6px" }}>
                                      Models in Lot ({lot.orderDate} - {lot.vendorName}):
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
                                      {lot.items.map(item => (
                                        <div key={item.id} style={{ background: "rgba(0,0,0,0.12)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-glass)", fontSize: "0.78rem" }}>
                                          <strong style={{ color: "var(--text-main)" }}>{item.model}</strong>
                                          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                                            Qty: {item.vendorOrderQuantity || item.orderQuantity} Pcs
                                            {item.priceRmb ? ` • ¥${item.priceRmb}` : " • Unpriced"}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

{/* ==================== ROLE VIEW 2: PC / COORDINATOR HOME DASHBOARD ==================== */}
      {(currentUser?.role === "coordinator" || currentUser?.role === "nitin" || currentUser?.role === "rahul") && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Top Summary Banner */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" }}>
                <AlertTriangle size={28} />
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Delayed Tasks (All Persons)</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--danger)" }}>{totalDelayedAllPersons}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Target date missed</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <Users size={28} />
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>Purchaser Controllers</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)" }}>{activePurchasers.length}</div>
                <div style={{ fontSize: "0.75rem", color: "#38bdf8" }}>Active team members</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", color: "var(--success)" }}>
                <CheckCircle2 size={28} />
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>Delivered & Cleared</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--success)" }}>{totalReceived}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--success)" }}>Complete ledger orders</div>
              </div>
            </div>
          </div>

          {/* PC Person-Wise Delayed Task Matrix Table */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <Users size={20} /> Person-Wise Delayed Task Breakdown
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px", margin: 0 }}>
                  Live tracking of assigned tasks, delayed items, and delivery health per person.
                </p>
              </div>

              <span className="badge badge-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                Total Active Items: {activeRequests.length} Items
              </span>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Person / Purchaser Name</th>
                    <th>Total Assigned</th>
                    <th>Pending Items</th>
                    <th>In-Transit Cargo</th>
                    <th>Delayed Tasks (Target Missed)</th>
                    <th>On-Time Rate %</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {personWiseTaskStats.map(stat => {
                    const delayedRate = stat.pending > 0 ? ((stat.delayed / stat.pending) * 100).toFixed(0) : 0;
                    const onTimeRate = 100 - Number(delayedRate);

                    return (
                      <tr key={stat.purchaser.id}>
                        <td style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: stat.delayed > 0 ? "var(--danger)" : "var(--success)" }}></div>
                            {stat.purchaser.name} ({stat.purchaser.email})
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{stat.total} items</td>
                        <td>{stat.pending} pending</td>
                        <td><span className="badge badge-cargo">{stat.inTransit} shipments</span></td>
                        <td>
                          <span style={{ 
                            padding: "4px 10px", 
                            borderRadius: "6px", 
                            fontWeight: 700, 
                            background: stat.delayed > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.15)",
                            color: stat.delayed > 0 ? "#fca5a5" : "#a7f3d0"
                          }}>
                            {stat.delayed} Delayed
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "8px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                              <div style={{ width: `${onTimeRate}%`, height: "100%", background: onTimeRate < 60 ? "var(--danger)" : onTimeRate < 85 ? "#f59e0b" : "var(--success)", borderRadius: "99px" }}></div>
                            </div>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{onTimeRate}%</span>
                          </div>
                        </td>
                        <td>
                          <button 
                            onClick={() => onNavigateView(currentUser?.role === "coordinator" ? "coordinator" : "dashboard")}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                          >
                            View Person Tasks
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

  {/* ==================== ROLE VIEW 3: SUPER ADMIN ==================== */}
  {currentUser?.role === "superadmin" && (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        
        {/* Active Users Card */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
            <Users size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Active Registered Users</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)" }}>
              {totalActiveUsers} Users
            </div>
          </div>
        </div>

        {/* Cloudinary Usage Card */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
            <HardDrive size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Media Storage Usage</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--text-main)" }}>
              {storageMetrics?.cloudinary?.usageStr || "0.5 MB"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* ==================== GLOBAL VISUAL REPORTS & CHARTS SECTION (PURCHASE TEAM ONLY) ==================== */}
  {!["crm", "asm", "tsm", "rsm"].includes(currentUser?.role) && (
    <div className="glass-panel" style={{ padding: "24px" }}>
      <h3 style={{ fontSize: "1.3rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <BarChart2 size={20} /> System Performance Analytics & Progress Charts
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Chart 1: Order Lifecycle Status Distribution */}
        <div className="glass-panel" style={{ padding: "20px", background: "rgba(0,0,0,0.2)" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={16} style={{ color: "#38bdf8" }} /> Order Lifecycle Distribution
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                <span>Pending Commercial Specifications</span>
                <strong>{totalPendingPrice} ({((totalPendingPrice / Math.max(1, activeRequests.length)) * 100).toFixed(0)}%)</strong>
              </div>
              <div style={{ height: "10px", borderRadius: "99px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${(totalPendingPrice / Math.max(1, activeRequests.length)) * 100}%`, height: "100%", background: "#f59e0b" }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                <span>In-Transit Cargo Shipments</span>
                <strong>{totalInTransit} ({((totalInTransit / Math.max(1, activeRequests.length)) * 100).toFixed(0)}%)</strong>
              </div>
              <div style={{ height: "10px", borderRadius: "99px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${(totalInTransit / Math.max(1, activeRequests.length)) * 100}%`, height: "100%", background: "#818cf8" }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                <span>Completed Warehouse Receipts</span>
                <strong>{totalReceived} ({((totalReceived / Math.max(1, activeRequests.length)) * 100).toFixed(0)}%)</strong>
              </div>
              <div style={{ height: "10px", borderRadius: "99px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${(totalReceived / Math.max(1, activeRequests.length)) * 100}%`, height: "100%", background: "var(--success)" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Material Nature & Logistics Breakdown */}
        <div className="glass-panel" style={{ padding: "20px", background: "rgba(0,0,0,0.2)" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Package size={16} style={{ color: "#f59e0b" }} /> Shipment Types & Categories
          </h4>

          {(() => {
            const localCount = activeRequests.filter(r => r.type === "Local").length;
            const importCount = activeRequests.filter(r => r.type === "Import").length;
            const totalCount = Math.max(1, localCount + importCount);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", height: "24px", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ width: `${(localCount / totalCount) * 100}%`, background: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: "0.75rem", fontWeight: "bold" }}>
                    Local ({localCount})
                  </div>
                  <div style={{ width: `${(importCount / totalCount) * 100}%`, background: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.75rem", fontWeight: "bold" }}>
                    Import ({importCount})
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.85rem" }}>
                  <div style={{ padding: "10px", background: "rgba(56, 189, 248, 0.1)", borderRadius: "8px" }}>
                    <span style={{ color: "#38bdf8", fontWeight: 600 }}>Local Procurement:</span><br />
                    <strong>{localCount} requisitions</strong>
                  </div>
                  <div style={{ padding: "10px", background: "rgba(129, 140, 248, 0.1)", borderRadius: "8px" }}>
                    <span style={{ color: "#818cf8", fontWeight: 600 }}>Import Procurement:</span><br />
                    <strong>{importCount} requisitions</strong>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  )}

    </div>
  );
}
