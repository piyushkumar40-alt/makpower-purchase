import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, Building2, TrendingUp, Truck, Package, Plus, Search, Filter, 
  Download, Eye, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, 
  Phone, Mail, MapPin, ChevronRight, ArrowUpDown, UserPlus, UserCheck, 
  Shield, Calendar, FileText, BarChart2, RefreshCw, Layers, DollarSign,
  X, Check, ExternalLink, Share2, Briefcase, User, Send, Lock, MessageSquare
} from "lucide-react";
import Pagination from "./Pagination";
import { useLoading } from "../context/LoadingContext";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";

export default function CrmDashboard({
  currentUser,
  users = [],
  crmParties = [],
  crmSalesOrders = [],
  crmDispatches = [],
  crmPartyRemarks = [],
  items = [],
  itemPrices = [],
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onBulkDeleteParties,
  onBatchUploadParties,
  onBatchAssignParties,
  onSavePartyRemark,
  onDeletePartyRemark,
  onAddSalesOrder,
  onUpdateSalesOrder,
  onDeleteSalesOrder,
  onAddDispatch,
  onDeleteDispatch,
  onAddUser,
  onUpdateUser,
  onLogout,
  onPullModuleData,
  loadingModules = {},
  recordSectionVisit,
  currentUserId
}) {
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();
  // Determine if user is superadmin or owner
  const isElevated = currentUser?.role === "superadmin" || currentUser?.role === "owner" || currentUser?.designation?.toLowerCase() === "system admin" || currentUser?.designation?.toLowerCase() === "owner";
  const isAdminOrOwner = isElevated;

  // Available CRM Executives
  const crmExecutives = useMemo(() => {
    const list = users.filter(u => u.role === "crm" && u.status === "active");
    if (list.length === 0) {
      return [
        { id: "u-ankita", name: "Ankita", email: "ankita@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-ajit", name: "Ajit", email: "ajit@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-prince", name: "Prince", email: "prince@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-simran", name: "Simran", email: "simran@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-harish", name: "Harish", email: "harish@makpowerindia.com", role: "crm", designation: "CRM Executive" }
      ];
    }
    return list;
  }, [users]);

  // Selected Executive (for Admin/Owner switching or defaults to current logged in CRM)
  const [selectedExecutiveId, setSelectedExecutiveId] = useState(() => {
    if (currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm") {
      return currentUser.id;
    }
    return "all"; // "all" | specific CRM id
  });

  const activeExecutive = useMemo(() => {
    if (selectedExecutiveId === "all") return null;
    return crmExecutives.find(c => c.id === selectedExecutiveId) || users.find(u => u.id === selectedExecutiveId) || currentUser;
  }, [selectedExecutiveId, crmExecutives, users, currentUser]);

  // Navigation Tabs: "parties" | "team" | "salesreport" | "dispatchreport" | "orders"
  const [activeTab, setActiveTab] = useState("parties");

  const handleCrmTabSwitch = (tab) => {
    setActiveTab(tab);
    let modKey = null;
    if (tab === "parties") modKey = "crmParties";
    else if (tab === "orders" || tab === "salesreport") modKey = "crmSalesOrders";
    else if (tab === "dispatchreport") modKey = "crmDispatches";

    if (modKey) {
      const uId = currentUserId || currentUser?.id;
      if (recordSectionVisit && uId) {
        recordSectionVisit(uId, modKey);
      }
      if (onPullModuleData) {
        onPullModuleData(modKey);
      }
    }
  };

  useEffect(() => {
    if (onPullModuleData) {
      onPullModuleData("crmParties");
    }
    const uId = currentUserId || currentUser?.id;
    if (recordSectionVisit && uId) {
      recordSectionVisit(uId, "crmParties");
    }
  }, []);

  // Filtered Parties based on selected executive
  const currentParties = useMemo(() => {
    if (selectedExecutiveId === "all") return crmParties;
    return crmParties.filter(p => p.assignedCrmId === selectedExecutiveId || p.assignedAsmId === selectedExecutiveId || p.assignedTsmId === selectedExecutiveId);
  }, [crmParties, selectedExecutiveId]);

  // Filtered Sales Orders
  const currentSalesOrders = useMemo(() => {
    if (selectedExecutiveId === "all") return crmSalesOrders;
    return crmSalesOrders.filter(so => so.assignedCrmId === selectedExecutiveId || so.assignedAsmId === selectedExecutiveId || so.assignedTsmId === selectedExecutiveId);
  }, [crmSalesOrders, selectedExecutiveId]);

  // Filtered Dispatches
  const currentDispatches = useMemo(() => {
    if (selectedExecutiveId === "all") return crmDispatches;
    return crmDispatches.filter(d => d.assignedCrmId === selectedExecutiveId || d.assignedAsmId === selectedExecutiveId || d.assignedTsmId === selectedExecutiveId);
  }, [crmDispatches, selectedExecutiveId]);

  // ASMs and TSMs under this executive or all
  const teamMembers = useMemo(() => {
    return users.filter(u => {
      if (u.role !== "asm" && u.role !== "tsm") return false;
      if (selectedExecutiveId === "all") return true;
      return u.parentCrmId === selectedExecutiveId || u.id === selectedExecutiveId;
    });
  }, [users, selectedExecutiveId]);

  const asmList = useMemo(() => users.filter(u => u.role === "asm" && u.status === "active"), [users]);
  const tsmList = useMemo(() => users.filter(u => u.role === "tsm" && u.status === "active"), [users]);

  // KPI Metrics Calculation
  const totalPartiesCount = currentParties.length;
  const activePartiesCount = currentParties.filter(p => p.status === "Active").length;
  const totalSalesRevenue = currentSalesOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);
  const totalOrderedUnits = currentSalesOrders.reduce((acc, o) => acc + (parseInt(o.orderQty) || 0), 0);
  const totalDispatchedUnits = currentDispatches.reduce((acc, d) => acc + (parseInt(d.dispatchedQty) || 0), 0);
  const pendingDispatchUnits = Math.max(0, totalOrderedUnits - totalDispatchedUnits);
  const fulfillmentRate = totalOrderedUnits > 0 ? ((totalDispatchedUnits / totalOrderedUnits) * 100).toFixed(1) : 0;

  // Search & Filter State for Parties
  const [partySearch, setPartySearch] = useState("");
  const [partyStateFilter, setPartyStateFilter] = useState("all");
  const [partyAsmFilter, setPartyAsmFilter] = useState("all");
  const [partyTsmFilter, setPartyTsmFilter] = useState("all");

  // Party Modals State
  const [selectedPartyFor360, setSelectedPartyFor360] = useState(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  // Sales Team Modal State
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [assigningTeamMember, setAssigningTeamMember] = useState(null);
  const [trackingAsmMember, setTrackingAsmMember] = useState(null);

  // Order & Dispatch Modal State
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showRecordDispatchModal, setShowRecordDispatchModal] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null);

  // Report & Table Filters
  const [salesReportCategory, setSalesReportCategory] = useState("all");
  const [salesReportStartDate, setSalesReportStartDate] = useState("");
  const [salesReportEndDate, setSalesReportEndDate] = useState("");

  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("all");
  const [dispatchStartDate, setDispatchStartDate] = useState("");
  const [dispatchEndDate, setDispatchEndDate] = useState("");

  const [ordersStartDate, setOrdersStartDate] = useState("");
  const [ordersEndDate, setOrdersEndDate] = useState("");

  // Format INR currency
  const formatInr = (val) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);
  };

  // Filtered Parties Table Data
  const filteredParties = useMemo(() => {
    return currentParties.filter(p => {
      const matchSearch = !partySearch || 
        p.name?.toLowerCase().includes(partySearch.toLowerCase()) || 
        p.city?.toLowerCase().includes(partySearch.toLowerCase()) || 
        p.phone?.toLowerCase().includes(partySearch.toLowerCase()) ||
        p.contactPerson?.toLowerCase().includes(partySearch.toLowerCase()) ||
        p.gstin?.toLowerCase().includes(partySearch.toLowerCase());

      const matchState = partyStateFilter === "all" || p.state === partyStateFilter;
      const matchAsm = partyAsmFilter === "all" || p.assignedAsmId === partyAsmFilter;
      const matchTsm = partyTsmFilter === "all" || p.assignedTsmId === partyTsmFilter;

      return matchSearch && matchState && matchAsm && matchTsm;
    });
  }, [currentParties, partySearch, partyStateFilter, partyAsmFilter, partyTsmFilter]);

  // Parties Pagination State (Default 100 rows per page)
  const [partiesPage, setPartiesPage] = useState(1);
  const [partiesPerPage, setPartiesPerPage] = useState(50);

  useEffect(() => {
    setPartiesPage(1);
  }, [partySearch, partyStateFilter, partyAsmFilter, partyTsmFilter, selectedExecutiveId]);

  const paginatedParties = useMemo(() => {
    const start = (partiesPage - 1) * partiesPerPage;
    return filteredParties.slice(start, start + partiesPerPage);
  }, [filteredParties, partiesPage, partiesPerPage]);

  // Aggregated Item-Wise Sales Data
  const itemWiseSalesData = useMemo(() => {
    const itemMap = new Map();

    currentSalesOrders
      .filter(o => !salesReportStartDate && !salesReportEndDate ? true : isDateInBetween(o.orderDate, salesReportStartDate, salesReportEndDate))
      .forEach(o => {
        const key = o.itemModel || "Unspecified Model";
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemModel: key,
            category: o.category || "General",
            totalOrders: 0,
            totalQty: 0,
            totalRevenue: 0,
            dispatchedQty: 0,
            pendingQty: 0,
            partySet: new Set(),
            unitPrices: []
          });
        }
        const entry = itemMap.get(key);
        entry.totalOrders += 1;
        entry.totalQty += parseInt(o.orderQty || 0);
        entry.totalRevenue += parseFloat(o.totalInr || 0);
        entry.dispatchedQty += parseInt(o.dispatchedQty || 0);
        entry.pendingQty += Math.max(0, parseInt(o.orderQty || 0) - parseInt(o.dispatchedQty || 0));
        if (o.partyName) entry.partySet.add(o.partyName);
        if (o.unitPriceInr) entry.unitPrices.push(parseFloat(o.unitPriceInr));
      });

    return Array.from(itemMap.values()).map(item => ({
      ...item,
      avgPrice: item.unitPrices.length > 0 ? (item.unitPrices.reduce((a, b) => a + b, 0) / item.unitPrices.length).toFixed(0) : 0,
      partyCount: item.partySet.size,
      partyList: Array.from(item.partySet).join(", "),
      ratePercent: item.totalQty > 0 ? ((item.dispatchedQty / item.totalQty) * 100).toFixed(0) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [currentSalesOrders, salesReportStartDate, salesReportEndDate]);

  // Unique list of states
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(crmParties.map(p => p.state).filter(Boolean)));
  }, [crmParties]);

  // Unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(currentSalesOrders.map(o => o.category).filter(Boolean)));
  }, [currentSalesOrders]);

  // ==================== MONTH & CATEGORY MATRIX DATA + REMARKS ====================
  const [activeRemarkPartyCategory, setActiveRemarkPartyCategory] = useState(null);
  const [matrixMonthFilter, setMatrixMonthFilter] = useState("all");
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState("all");
  const [matrixPartySearch, setMatrixPartySearch] = useState("");
  const [matrixAsmFilter, setMatrixAsmFilter] = useState("all");

  const monthCategoryMatrixData = useMemo(() => {
    const map = new Map();

    currentSalesOrders.forEach(o => {
      const orderMonth = (o.orderDate || "").slice(0, 7) || "2026-08";
      
      let cat = o.category;
      if (!cat || cat === "General" || cat === "Unspecified") {
        const foundItem = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        cat = foundItem?.category || "General";
      }

      const pId = o.partyId || "unknown";
      const pName = o.partyName || "Unknown Party";

      const key = `${pId}___${cat}___${orderMonth}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: pId,
          partyName: pName,
          category: cat,
          month: orderMonth,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0,
          assignedAsmId: o.assignedAsmId || "",
          assignedTsmId: o.assignedTsmId || ""
        });
      }
      const cur = map.get(key);
      cur.totalOrderQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });

    // Also ensure parties with remarks in a category/month are represented
    (crmPartyRemarks || []).forEach(r => {
      const key = `${r.partyId}___${r.category}___${r.month}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: r.partyId,
          partyName: r.partyName,
          category: r.category,
          month: r.month,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0,
          assignedAsmId: "",
          assignedTsmId: ""
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month) || a.partyName.localeCompare(b.partyName));
  }, [currentSalesOrders, items, crmPartyRemarks]);

  const availableMatrixMonths = useMemo(() => {
    const set = new Set();
    monthCategoryMatrixData.forEach(r => { if (r.month && r.month !== "Unspecified") set.add(r.month); });
    return Array.from(set).sort().reverse();
  }, [monthCategoryMatrixData]);

  const availableMatrixCategories = useMemo(() => {
    const set = new Set();
    monthCategoryMatrixData.forEach(r => { if (r.category) set.add(r.category); });
    items.forEach(i => { if (i.category) set.add(i.category); });
    return Array.from(set).sort();
  }, [monthCategoryMatrixData, items]);

  const filteredMonthCategoryMatrix = useMemo(() => {
    return monthCategoryMatrixData.filter(row => {
      if (matrixMonthFilter !== "all" && row.month !== matrixMonthFilter) return false;
      if (matrixCategoryFilter !== "all" && row.category !== matrixCategoryFilter) return false;
      if (matrixAsmFilter !== "all") {
        const party = currentParties.find(p => p.id === row.partyId);
        const matchAsm = row.assignedAsmId === matrixAsmFilter || row.assignedTsmId === matrixAsmFilter || (party && (party.assignedAsmId === matrixAsmFilter || party.assignedTsmId === matrixAsmFilter));
        if (!matchAsm) return false;
      }
      if (matrixPartySearch.trim()) {
        const q = matrixPartySearch.toLowerCase();
        const match = row.partyName.toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [monthCategoryMatrixData, matrixMonthFilter, matrixCategoryFilter, matrixAsmFilter, matrixPartySearch, currentParties]);

  // Export to CSV helper
  const exportCsv = (headers, rows, filename) => {
    const csvContent = "data:text/csv;charset=utf-8," + [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportItemSalesCsv = () => {
    const headers = ["Item Model", "Category", "Total Units Ordered", "Avg Unit Price (INR)", "Total Revenue (INR)", "Dispatched Units", "Pending Units", "Fulfillment Rate %", "Buying Parties"];
    const rows = itemWiseSalesData.map(i => [
      i.itemModel, i.category, i.totalQty, i.avgPrice, i.totalRevenue, i.dispatchedQty, i.pendingQty, `${i.ratePercent}%`, i.partyList
    ]);
    exportCsv(headers, rows, "makpower_itemwise_sales_report");
  };

  const handleExportDispatchesCsv = () => {
    const headers = ["Dispatch Date", "Invoice No", "Party Name", "Item Model", "Dispatched Qty", "Transporter", "Docket / LR No", "Status", "Assigned CRM"];
    const rows = currentDispatches.map(d => [
      d.dispatchDate, d.invoiceNo, d.partyName, d.itemModel, d.dispatchedQty, d.transporterName, d.docketNo, d.status, crmExecutives.find(c => c.id === d.assignedCrmId)?.name || d.assignedCrmId
    ]);
    exportCsv(headers, rows, "makpower_dispatch_qty_report");
  };

  const handleExportMonthlyCategoryCsv = () => {
    const headers = ["Party Name", "Category", "Month", "Total Ordered Qty", "Total Amount (INR)", "Order Bookings", "Remarks Count", "Latest Remark"];
    const rows = filteredMonthCategoryMatrix.map(row => {
      const remarks = (crmPartyRemarks || []).filter(r => r.partyId === row.partyId && r.category === row.category && r.month === row.month);
      const latest = remarks.length > 0 ? `[${remarks[0].authorName} (${remarks[0].authorRole})]: ${remarks[0].remark}` : "";
      return [
        row.partyName, row.category, row.month, row.totalOrderQty, row.totalRevenue, row.orderCount, remarks.length, latest
      ];
    });
    exportCsv(headers, rows, "makpower_monthly_category_remarks_report");
  };

  return (
    <div className="crm-portal-container" style={{ flex: 1, padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* ==================== HEADER & EXECUTIVE SELECTOR ==================== */}
      <div className="glass-panel" style={{ padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)", borderRadius: "16px", border: "1px solid var(--border-glass)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div style={{ padding: "10px", borderRadius: "12px", background: "linear-gradient(135deg, #0284c7, #6366f1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                CRM Command Center
                <span className="badge badge-primary" style={{ fontSize: "0.78rem", padding: "4px 10px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                  {activeExecutive ? `${activeExecutive.name}'s Dashboard` : "All Executives View"}
                </span>
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "4px 0 0 0" }}>
                Customer Relationship Management, Party Portfolios, Sales Execution & Logistics Dispatch Reports
              </p>
            </div>
          </div>
        </div>

        {/* Executive Switcher Bar - Only Visible to Superadmin / Owner */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isElevated ? (
            <>
              <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-glass)" }}>
                <button
                  onClick={() => setSelectedExecutiveId("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: selectedExecutiveId === "all" ? "linear-gradient(135deg, #0284c7, #38bdf8)" : "transparent",
                    color: selectedExecutiveId === "all" ? "#fff" : "var(--text-muted)",
                    fontWeight: selectedExecutiveId === "all" ? 700 : 500,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  🌐 All CRM (Company Overview)
                </button>
              </div>

              <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-glass)", flexWrap: "wrap" }}>
                {crmExecutives.map(exec => {
                  const isSelected = selectedExecutiveId === exec.id;
                  return (
                    <button
                      key={exec.id}
                      onClick={() => setSelectedExecutiveId(exec.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "none",
                        background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
                        color: isSelected ? "#fff" : "var(--text-muted)",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: isSelected ? "0 2px 10px rgba(99, 102, 241, 0.4)" : "none",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <User size={13} />
                      <span>{exec.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "6px 14px", borderRadius: "10px", color: "#a5b4fc", fontWeight: 700, fontSize: "0.85rem" }}>
              <User size={15} /> <span>{currentUser?.name || "My CRM Workspace"} (Assigned Accounts)</span>
            </div>
          )}

          <button 
            onClick={() => setShowAddPartyModal(true)} 
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, padding: "8px 16px" }}
          >
            <Plus size={16} /> Add Party
          </button>
        </div>
      </div>

      {/* ==================== TOP KPI SUMMARY CARDS ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
        
        {/* Card 1: Assigned Parties */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
            <Building2 size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Assigned Parties</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
              {totalPartiesCount} <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 600 }}>({activePartiesCount} Active)</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "2px" }}>Authorized Dealer Network</div>
          </div>
        </div>

        {/* Card 2: Total Sales Revenue */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
            <TrendingUp size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Sales Value</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--success)" }}>
              {formatInr(totalSalesRevenue)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Across {currentSalesOrders.length} logged sales orders
            </div>
          </div>
        </div>

        {/* Card 3: Dispatched Qty & Fulfillment */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
            <Truck size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Dispatched Volume</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
              {totalDispatchedUnits.toLocaleString()} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>/ {totalOrderedUnits.toLocaleString()} Pcs</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <div style={{ flex: 1, height: "6px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${fulfillmentRate}%`, height: "100%", background: "#f59e0b", borderRadius: "99px" }}></div>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b" }}>{fulfillmentRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Sales Team Strength */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.12)", color: "#a855f7" }}>
            <Users size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Field Sales Team</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
              {teamMembers.length} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Members</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#a855f7", marginTop: "2px" }}>
              {teamMembers.filter(t => t.role === "asm").length} ASMs • {teamMembers.filter(t => t.role === "tsm").length} TSMs
            </div>
          </div>
        </div>

      </div>

      {/* ==================== TAB NAVIGATION BAR ==================== */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("parties")}
          className={`nav-tab-item ${activeTab === "parties" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Building2 size={16} /> <span>My Parties ({filteredParties.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`nav-tab-item ${activeTab === "team" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Users size={16} /> <span>Sales Team (ASM / TSM) ({teamMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("monthly_category")}
          className={`nav-tab-item ${activeTab === "monthly_category" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 700, color: activeTab === "monthly_category" ? "#38bdf8" : undefined }}
        >
          <MessageSquare size={16} /> <span>Monthly Category & Remarks ({crmPartyRemarks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("salesreport")}
          className={`nav-tab-item ${activeTab === "salesreport" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <BarChart2 size={16} /> <span>Item-Wise Sales Report</span>
        </button>

        <button
          onClick={() => setActiveTab("dispatchreport")}
          className={`nav-tab-item ${activeTab === "dispatchreport" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Truck size={16} /> <span>Dispatched Qty Report</span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`nav-tab-item ${activeTab === "orders" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <FileText size={16} /> <span>Sales Bookings ({currentSalesOrders.length})</span>
        </button>
      </div>

      {/* ==================== TAB 1: MY PARTIES (DEALER NETWORK) ==================== */}
      {activeTab === "parties" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* Action & Filter Bar */}
          <div className="glass-panel" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "300px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search party by name, city, phone, GSTIN..."
                  value={partySearch}
                  onChange={e => setPartySearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: "40px", height: "38px", fontSize: "0.88rem" }}
                />
              </div>

              {/* State Filter */}
              <select
                value={partyStateFilter}
                onChange={e => setPartyStateFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All States</option>
                {uniqueStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* ASM Filter */}
              <select
                value={partyAsmFilter}
                onChange={e => setPartyAsmFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All ASMs</option>
                {asmList.map(a => (
                  <option key={a.id} value={a.id}>{a.name} (ASM)</option>
                ))}
              </select>

              {/* TSM Filter */}
              <select
                value={partyTsmFilter}
                onChange={e => setPartyTsmFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All TSMs</option>
                {tsmList.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (TSM)</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                onClick={() => {
                  const headers = ["Party Name", "Contact Person", "Phone", "Email", "City", "State", "GSTIN", "Assigned CRM", "Assigned ASM", "Assigned TSM", "Status"];
                  const rows = filteredParties.map(p => [
                    p.name, p.contactPerson, p.phone, p.email, p.city, p.state, p.gstin, p.assignedCrmName, p.assignedAsmName, p.assignedTsmName, p.status
                  ]);
                  exportCsv(headers, rows, "makpower_parties_list");
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Export CSV
              </button>

              {isAdminOrOwner && (
                <button 
                  onClick={() => setShowAddPartyModal(true)} 
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <Plus size={14} /> Add New Party
                </button>
              )}
            </div>
          </div>

          {/* Parties Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {filteredParties.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Building2 size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No parties found matching criteria</h4>
                <p style={{ fontSize: "0.85rem" }}>Click "Add New Party" to create and assign customer/dealer accounts.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th>Party Name & Location</th>
                    <th>Contact Person</th>
                    <th>Assigned CRM / ASM / TSM</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedParties.map(party => {
                    return (
                      <tr key={party.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.95rem" }}>
                              {party.name}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <MapPin size={12} /> {party.city}, {party.state} • {party.gstin ? `GST: ${party.gstin}` : "No GSTIN"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
                            <span style={{ fontWeight: 600 }}>{party.contactPerson || "—"}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{party.phone || "—"}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)", width: "fit-content" }}>
                              CRM: {party.assignedCrmName || crmExecutives.find(c => c.id === party.assignedCrmId)?.name || "Unassigned"}
                            </span>
                            {party.assignedAsmName && (
                              <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.12)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.3)", width: "fit-content" }}>
                                ASM: {party.assignedAsmName}
                              </span>
                            )}
                            {party.assignedTsmName && (
                              <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(245, 158, 11, 0.12)", color: "#fcd34d", border: "1px solid rgba(245, 158, 11, 0.3)", width: "fit-content" }}>
                                TSM: {party.assignedTsmName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className={`badge ${party.status === "Active" ? "badge-success" : "badge-secondary"}`}>
                            {party.status || "Active"}
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => setSelectedPartyFor360(party)}
                              className="btn btn-secondary btn-sm"
                              title="View Party 360 Profile"
                              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                            >
                              <Eye size={13} /> 360°
                            </button>

                            <button
                              onClick={() => setEditingParty(party)}
                              className="btn btn-secondary btn-sm"
                              title="Edit Party Details"
                              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                            >
                              <Edit2 size={13} />
                            </button>

                            {isAdminOrOwner && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete party "${party.name}"?`)) {
                                    onDeleteParty(party.id);
                                  }
                                }}
                                className="btn btn-danger btn-sm"
                                title="Delete Party"
                                style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Parties Pagination (100 rows per page) */}
            <Pagination
              currentPage={partiesPage}
              totalItems={filteredParties.length}
              itemsPerPage={partiesPerPage}
              onPageChange={setPartiesPage}
              onItemsPerPageChange={(n) => {
                setPartiesPerPage(n);
                setPartiesPage(1);
              }}
              perPageOptions={[50, 100, 200, 500]}
            />
          </div>

        </div>
      )}

      {/* ==================== TAB 2: MY SALES TEAM (ASM & TSM) ==================== */}
      {activeTab === "team" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} /> Sales Team Hierarchy & Role Management
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Create and manage Area Sales Managers (ASM) and Territory Sales Managers (TSM), and assign party territories.
              </p>
            </div>

            <button
              onClick={() => setShowAddTeamModal(true)}
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              <UserPlus size={16} /> Create ASM / TSM User
            </button>
          </div>

          {/* Team Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
            {teamMembers.map(member => {
              const assignedParties = currentParties.filter(p => p.assignedAsmId === member.id || p.assignedTsmId === member.id);
              const memberOrders = currentSalesOrders.filter(o => o.assignedAsmId === member.id || o.assignedTsmId === member.id);
              const memberRevenue = memberOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);

              return (
                <div key={member.id} className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px", borderRadius: "14px", border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: member.role === "asm" ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem" }}>
                        {member.name ? member.name.slice(0, 2).toUpperCase() : "SM"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)" }}>{member.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{member.email}</div>
                      </div>
                    </div>

                    <span className="badge" style={{ 
                      background: member.role === "asm" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: member.role === "asm" ? "#34d399" : "#fbbf24",
                      border: member.role === "asm" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      fontWeight: 700,
                      fontSize: "0.75rem"
                    }}>
                      {member.role === "asm" ? "ASM (Area Manager)" : "TSM (Territory Manager)"}
                    </span>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.82rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Territory:</span>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{member.territory || "General"}</div>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Phone:</span>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{member.phone || "—"}</div>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Assigned Parties:</span>
                      <div style={{ fontWeight: 700, color: "#38bdf8" }}>{assignedParties.length} Parties</div>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Total Sales:</span>
                      <div style={{ fontWeight: 700, color: "var(--success)" }}>{formatInr(memberRevenue)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto" }}>
                    <button
                      onClick={() => setAssigningTeamMember(member)}
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: "center", fontSize: "0.8rem", color: "var(--primary)", borderColor: "var(--primary)", fontWeight: 700 }}
                    >
                      <UserCheck size={13} /> Assign Parties ({assignedParties.length})
                    </button>

                    <button
                      onClick={() => setTrackingAsmMember(member)}
                      className="btn btn-primary btn-sm"
                      style={{ justifyContent: "center", fontSize: "0.8rem", fontWeight: 700 }}
                    >
                      <TrendingUp size={13} /> Track Sales ({formatInr(memberRevenue)})
                    </button>

                    <button
                      onClick={() => setEditingTeamMember(member)}
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: "center", fontSize: "0.8rem" }}
                    >
                      <Edit2 size={13} /> Edit Account
                    </button>

                    <button
                      onClick={() => {
                        const newStatus = member.status === "active" ? "inactive" : "active";
                        onUpdateUser(member.id, { status: newStatus });
                      }}
                      className={`btn btn-sm ${member.status === "active" ? "btn-danger" : "btn-success"}`}
                      style={{ fontSize: "0.8rem", justifyContent: "center" }}
                    >
                      {member.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ==================== TAB: MONTH & CATEGORY WISE PERFORMANCE & REMARKS ==================== */}
      {activeTab === "monthly_category" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls Bar */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquare size={20} style={{ color: "#38bdf8" }} /> Party Order Volume — Month & Category Wise Analysis
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Track order quantities month-wise and category-wise per party. ASMs and TSMs can put remarks bound to the party and category; CRM can view and monitor all remarks.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleExportMonthlyCategoryCsv}
                className="btn btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.88rem" }}
              >
                <Download size={15} /> Export Matrix CSV
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search Party */}
            <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search party name or category..."
                value={matrixPartySearch}
                onChange={e => setMatrixPartySearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: "34px", height: "38px", fontSize: "0.86rem" }}
              />
            </div>

            {/* Month Filter */}
            <div style={{ minWidth: "160px" }}>
              <select
                value={matrixMonthFilter}
                onChange={e => setMatrixMonthFilter(e.target.value)}
                className="form-control"
                style={{ height: "38px", fontSize: "0.86rem" }}
              >
                <option value="all">📅 All Months</option>
                {availableMatrixMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: "160px" }}>
              <select
                value={matrixCategoryFilter}
                onChange={e => setMatrixCategoryFilter(e.target.value)}
                className="form-control"
                style={{ height: "38px", fontSize: "0.86rem" }}
              >
                <option value="all">🏷️ All Categories</option>
                {availableMatrixCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Sales Manager Filter */}
            {teamMembers.length > 0 && (
              <div style={{ minWidth: "160px" }}>
                <select
                  value={matrixAsmFilter}
                  onChange={e => setMatrixAsmFilter(e.target.value)}
                  className="form-control"
                  style={{ height: "38px", fontSize: "0.86rem" }}
                >
                  <option value="all">👤 All Sales Team</option>
                  {teamMembers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role.toUpperCase()})</option>
                  ))}
                </select>
              </div>
            )}

            {(matrixPartySearch || matrixMonthFilter !== "all" || matrixCategoryFilter !== "all" || matrixAsmFilter !== "all") && (
              <button
                onClick={() => {
                  setMatrixPartySearch("");
                  setMatrixMonthFilter("all");
                  setMatrixCategoryFilter("all");
                  setMatrixAsmFilter("all");
                }}
                className="btn btn-secondary btn-sm"
                style={{ height: "38px" }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Matrix Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {filteredMonthCategoryMatrix.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <MessageSquare size={36} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <h4>No order data or remarks found for this filter</h4>
                <p style={{ fontSize: "0.85rem" }}>Try clearing filters or check back after sales orders are recorded.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "1050px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "24%" }}>Party Name & City</th>
                    <th style={{ width: "14%" }}>Category</th>
                    <th style={{ width: "10%" }}>Month</th>
                    <th style={{ width: "12%", textAlign: "right" }}>Order Qty</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total Amount (₹)</th>
                    <th style={{ width: "26%" }}>ASM / TSM Remarks & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthCategoryMatrix.map(row => {
                    const remarks = (crmPartyRemarks || []).filter(r => (r.partyId === row.partyId || r.partyName === row.partyName) && r.category === row.category && r.month === row.month);
                    const latestRemark = remarks[0];

                    return (
                      <tr key={row.key}>
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.92rem" }}>
                            {row.partyName}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                            ID: {row.partyId}
                          </div>
                        </td>

                        <td>
                          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700, fontSize: "0.8rem", padding: "4px 8px" }}>
                            {row.category}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
                            {row.month}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 800, fontSize: "1rem", color: row.totalOrderQty > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                            {row.totalOrderQty.toLocaleString()} Pcs
                          </span>
                          {row.orderCount > 0 && (
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {row.orderCount} {row.orderCount === 1 ? "order" : "orders"}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: "var(--success)", fontSize: "0.95rem" }}>
                            {formatInr(row.totalRevenue)}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {latestRemark ? (
                              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "6px 10px", fontSize: "0.82rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                                  <span style={{ fontWeight: 700, color: latestRemark.authorRole === "asm" ? "#34d399" : latestRemark.authorRole === "tsm" ? "#fbbf24" : "#818cf8", fontSize: "0.75rem" }}>
                                    {latestRemark.authorName} ({latestRemark.authorRole.toUpperCase()})
                                  </span>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                    {latestRemark.createdAt ? new Date(latestRemark.createdAt).toLocaleDateString("en-IN") : ""}
                                  </span>
                                </div>
                                <div style={{ color: "var(--text-main)", fontStyle: "italic", lineHeight: 1.3 }}>
                                  "{latestRemark.remark}"
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                No remarks recorded yet
                              </span>
                            )}

                            <div>
                              <button
                                onClick={() => setActiveRemarkPartyCategory({
                                  partyId: row.partyId,
                                  partyName: row.partyName,
                                  category: row.category,
                                  month: row.month,
                                  totalOrderQty: row.totalOrderQty,
                                  totalRevenue: row.totalRevenue
                                })}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.76rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <MessageSquare size={12} /> {remarks.length > 0 ? `Remarks (${remarks.length})` : "+ Add Remark"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 3: ITEM-WISE SALE REPORT ==================== */}
      {activeTab === "salesreport" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart2 size={20} /> Item-Wise Sales Performance Report
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Aggregated sales volume, pricing realizations, revenue (₹), and customer distribution per item.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={salesReportStartDate}
                endDate={salesReportEndDate}
                onStartDateChange={setSalesReportStartDate}
                onEndDateChange={setSalesReportEndDate}
                onClear={() => {
                  setSalesReportStartDate("");
                  setSalesReportEndDate("");
                }}
                align="right"
              />

              <select
                value={salesReportCategory}
                onChange={e => setSalesReportCategory(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "36px", fontSize: "0.85rem" }}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button
                onClick={handleExportItemSalesCsv}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Export Report (CSV)
              </button>
            </div>
          </div>

          {/* Item-Wise Sales Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {itemWiseSalesData.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Package size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No sales records logged yet</h4>
                <p style={{ fontSize: "0.85rem" }}>Log party orders in the "Sales Bookings" tab to populate this item report.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th>Item Model / Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Total Qty Ordered</th>
                    <th style={{ textAlign: "right" }}>Avg Unit Price</th>
                    <th style={{ textAlign: "right" }}>Total Revenue (₹)</th>
                    <th style={{ textAlign: "right" }}>Dispatched / Pending</th>
                    <th style={{ textAlign: "center" }}>Fulfillment %</th>
                    <th>Key Buying Parties</th>
                  </tr>
                </thead>
                <tbody>
                  {itemWiseSalesData
                    .filter(i => salesReportCategory === "all" || i.category === salesReportCategory)
                    .map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.92rem" }}>
                            {item.itemModel}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{item.category}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {item.totalQty.toLocaleString()} Pcs
                        </td>
                        <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                          ₹{Number(item.avgPrice).toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: "0.95rem" }}>
                          {formatInr(item.totalRevenue)}
                        </td>
                        <td style={{ textAlign: "right", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--success)", fontWeight: 600 }}>{item.dispatchedQty}</span> / <span style={{ color: item.pendingQty > 0 ? "var(--danger)" : "var(--text-muted)" }}>{item.pendingQty}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                            <div style={{ width: "50px", height: "6px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                              <div style={{ width: `${item.ratePercent}%`, height: "100%", background: item.ratePercent >= 80 ? "var(--success)" : item.ratePercent >= 40 ? "#f59e0b" : "var(--danger)" }}></div>
                            </div>
                            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.ratePercent}%</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {item.partyList || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 4: DISPATCHED QUANTITY REPORT ==================== */}
      {activeTab === "dispatchreport" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Truck size={20} /> Dispatched Quantity & Logistics Report
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Real-time tracking of dispatched shipments, courier/transport details, LR docket numbers, and delivery status.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={dispatchStartDate}
                endDate={dispatchEndDate}
                onStartDateChange={setDispatchStartDate}
                onEndDateChange={setDispatchEndDate}
                onClear={() => {
                  setDispatchStartDate("");
                  setDispatchEndDate("");
                }}
                align="right"
              />

              <select
                value={dispatchStatusFilter}
                onChange={e => setDispatchStatusFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", minHeight: "38px", height: "38px", fontSize: "0.85rem", padding: "6px 36px 6px 12px", display: "inline-flex", alignItems: "center" }}
              >
                <option value="all">All Dispatch Statuses</option>
                <option value="Delivered">Delivered</option>
                <option value="In Transit">In Transit</option>
                <option value="Pending">Pending</option>
              </select>

              <button
                onClick={handleExportDispatchesCsv}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Export Dispatches (CSV)
              </button>
            </div>
          </div>

          {/* Dispatches Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {currentDispatches.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Truck size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No dispatch logs found</h4>
                <p style={{ fontSize: "0.85rem" }}>Record dispatches against sales orders to view shipment logs.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "950px" }}>
                <thead>
                  <tr>
                    <th>Dispatch Date</th>
                    <th>Invoice No</th>
                    <th>Party Name</th>
                    <th>Item Model</th>
                    <th style={{ textAlign: "right" }}>Dispatched Qty</th>
                    <th>Transporter & Docket LR</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDispatches
                    .filter(d => {
                      if (dispatchStatusFilter !== "all" && d.status !== dispatchStatusFilter) return false;
                      if (dispatchStartDate || dispatchEndDate) {
                        if (!isDateInBetween(d.dispatchDate, dispatchStartDate, dispatchEndDate)) return false;
                      }
                      return true;
                    })
                    .map(dsp => (
                      <tr key={dsp.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 600 }}>
                            <Calendar size={13} style={{ color: "var(--primary)" }} /> {dsp.dispatchDate}
                          </div>
                        </td>

                        <td>
                          <code style={{ fontSize: "0.82rem", fontWeight: 700 }}>{dsp.invoiceNo || "INV-PENDING"}</code>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{dsp.partyName}</span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: "var(--primary)" }}>{dsp.itemModel}</span>
                        </td>

                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: "0.95rem" }}>
                          {dsp.dispatchedQty?.toLocaleString()} Pcs
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", fontSize: "0.82rem" }}>
                            <span style={{ fontWeight: 600 }}>{dsp.transporterName}</span>
                            <span style={{ color: "var(--text-muted)" }}>LR: {dsp.docketNo || "N/A"}</span>
                          </div>
                        </td>

                        <td>
                          <span className={`badge ${dsp.status === "Delivered" ? "badge-success" : dsp.status === "In Transit" ? "badge-primary" : "badge-secondary"}`}>
                            {dsp.status}
                          </span>
                        </td>

                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this dispatch record?")) {
                                onDeleteDispatch(dsp.id);
                              }
                            }}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 5: SALES BOOKINGS & ORDERS ==================== */}
      {activeTab === "orders" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={20} /> Sales Orders & Booking Ledger
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Log new dealer orders, update fulfillment dispatches, and track pending shipment balances.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={ordersStartDate}
                endDate={ordersEndDate}
                onStartDateChange={setOrdersStartDate}
                onEndDateChange={setOrdersEndDate}
                onClear={() => {
                  setOrdersStartDate("");
                  setOrdersEndDate("");
                }}
                align="right"
              />

              <button
                onClick={() => setShowAddOrderModal(true)}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
              >
                <Plus size={16} /> New Sales Order
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {currentSalesOrders.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <FileText size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No sales orders logged yet</h4>
                <p style={{ fontSize: "0.85rem" }}>Click "New Sales Order" to create order entries for your assigned parties.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "1000px" }}>
                <thead>
                  <tr>
                    <th>Order No & Date</th>
                    <th>Party Name</th>
                    <th>Item Model & Category</th>
                    <th style={{ textAlign: "right" }}>Ordered Qty</th>
                    <th style={{ textAlign: "right" }}>Unit Price & Total</th>
                    <th style={{ textAlign: "right" }}>Dispatched / Pending</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSalesOrders
                    .filter(order => {
                      if (ordersStartDate || ordersEndDate) {
                        if (!isDateInBetween(order.orderDate, ordersStartDate, ordersEndDate)) return false;
                      }
                      return true;
                    })
                    .map(order => (
                      <tr key={order.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <code style={{ fontWeight: 700, fontSize: "0.85rem" }}>{order.orderNo}</code>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{order.orderDate}</span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{order.partyName}</span>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{order.itemModel}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{order.category}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {order.orderQty?.toLocaleString()} Pcs
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 800, color: "var(--success)" }}>{formatInr(order.totalInr)}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>@ ₹{order.unitPriceInr}/unit</span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--success)", fontWeight: 700 }}>{order.dispatchedQty || 0}</span> / <span style={{ color: (order.pendingQty || 0) > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: 700 }}>{order.pendingQty || 0}</span>
                      </td>

                      <td>
                        <span className={`badge ${order.status === "Dispatched" ? "badge-success" : order.status === "Partially Dispatched" ? "badge-primary" : "badge-secondary"}`}>
                          {order.status}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          {(order.pendingQty || 0) > 0 && (
                            <button
                              onClick={() => {
                                setSelectedOrderForDispatch(order);
                                setShowRecordDispatchModal(true);
                              }}
                              className="btn btn-success btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              title="Record Dispatch Shipment"
                            >
                              <Truck size={12} /> Dispatch
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this order?")) {
                                onDeleteSalesOrder(order.id);
                              }
                            }}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT PARTY ==================== */}
      {(showAddPartyModal || editingParty) && (
        <PartyModal
          party={editingParty}
          crmExecutives={crmExecutives}
          asmList={asmList}
          tsmList={tsmList}
          currentExecutive={activeExecutive || currentUser}
          currentUser={currentUser}
          onSave={async (partyData) => {
            try {
              if (editingParty) {
                await onUpdateParty(partyData);
                showSuccessToast(`✅ Saved successfully! Updated party "${partyData.name}".`);
                setEditingParty(null);
              } else {
                await onAddParty(partyData);
                showSuccessToast(`✅ Saved successfully! Added new party "${partyData.name}".`);
                setShowAddPartyModal(false);
              }
            } catch (err) {
              showErrorToast(err.message || "Failed to save party.");
            }
          }}
          onClose={() => {
            setShowAddPartyModal(false);
            setEditingParty(null);
          }}
        />
      )}

      {/* ==================== MODAL: PARTY 360° PROFILE ==================== */}
      {selectedPartyFor360 && (
        <Party360Modal
          party={selectedPartyFor360}
          salesOrders={currentSalesOrders.filter(o => o.partyId === selectedPartyFor360.id)}
          dispatches={currentDispatches.filter(d => d.partyId === selectedPartyFor360.id)}
          onClose={() => setSelectedPartyFor360(null)}
        />
      )}

      {/* ==================== MODAL: ADD / EDIT SALES TEAM MEMBER (ASM / TSM) ==================== */}
      {(showAddTeamModal || editingTeamMember) && (
        <TeamMemberModal
          member={editingTeamMember}
          currentExecutive={activeExecutive || currentUser}
          onSave={async (memberData) => {
            try {
              if (editingTeamMember) {
                await onUpdateUser(editingTeamMember.id, memberData);
                showSuccessToast(`✅ Saved successfully! Updated user ${memberData.name}.`);
                setEditingTeamMember(null);
              } else {
                await onAddUser(memberData.name, memberData.email, memberData.password, memberData.designation, memberData.role);
                showSuccessToast(`✅ Saved successfully! Created team member ${memberData.name}.`);
                setShowAddTeamModal(false);
              }
            } catch (err) {
              showErrorToast(err.message || "Failed to save user account.");
            }
          }}
          onClose={() => {
            setShowAddTeamModal(false);
            setEditingTeamMember(null);
          }}
        />
      )}

      {/* ==================== MODAL: ASSIGN PARTIES TO ASM / TSM ==================== */}
      {assigningTeamMember && (
        <AssignPartiesModal
          teamMember={assigningTeamMember}
          allParties={crmParties}
          onAssign={async (partyIds) => {
            try {
              const isAsm = assigningTeamMember.role === "asm";
              await onBatchAssignParties(
                partyIds, 
                isAsm ? assigningTeamMember.id : undefined, 
                !isAsm ? assigningTeamMember.id : undefined
              );
              showSuccessToast(`✅ Assigned ${partyIds.length} parties to ${assigningTeamMember.name}!`);
              setAssigningTeamMember(null);
            } catch (err) {
              showErrorToast("Failed to assign parties: " + err.message);
            }
          }}
          onClose={() => setAssigningTeamMember(null)}
        />
      )}

      {/* ==================== MODAL: TRACK ASM SALES & PURCHASED ITEMS ==================== */}
      {trackingAsmMember && (
        <AsmSalesDetailModal
          member={trackingAsmMember}
          allParties={crmParties}
          allSalesOrders={crmSalesOrders}
          allDispatches={crmDispatches}
          crmPartyRemarks={crmPartyRemarks}
          items={items}
          currentUser={currentUser}
          onSavePartyRemark={onSavePartyRemark}
          onDeletePartyRemark={onDeletePartyRemark}
          formatInr={formatInr}
          onClose={() => setTrackingAsmMember(null)}
        />
      )}

      {/* ==================== MODAL: PARTY & CATEGORY MONTHLY REMARKS ==================== */}
      {activeRemarkPartyCategory && (
        <PartyCategoryRemarkModal
          target={activeRemarkPartyCategory}
          remarks={(crmPartyRemarks || []).filter(r => (r.partyId === activeRemarkPartyCategory.partyId || r.partyName === activeRemarkPartyCategory.partyName) && r.category === activeRemarkPartyCategory.category && r.month === activeRemarkPartyCategory.month)}
          currentUser={currentUser}
          formatInr={formatInr}
          onSave={async (remarkText) => {
            try {
              await onSavePartyRemark({
                partyId: activeRemarkPartyCategory.partyId,
                partyName: activeRemarkPartyCategory.partyName,
                category: activeRemarkPartyCategory.category,
                month: activeRemarkPartyCategory.month,
                remark: remarkText,
                authorId: currentUser?.id || "",
                authorName: currentUser?.name || "Team Member",
                authorRole: currentUser?.role || "asm"
              });
              showSuccessToast("✅ Remark saved successfully!");
            } catch (err) {
              showErrorToast("Failed to save remark: " + err.message);
            }
          }}
          onDelete={async (remarkId) => {
            if (window.confirm("Are you sure you want to delete this remark?")) {
              await onDeletePartyRemark(remarkId);
              showSuccessToast("Remark deleted.");
            }
          }}
          onClose={() => setActiveRemarkPartyCategory(null)}
        />
      )}

      {/* ==================== MODAL: ADD SALES ORDER ==================== */}
      {showAddOrderModal && (
        <SalesOrderModal
          parties={currentParties}
          items={items}
          currentExecutive={activeExecutive || currentUser}
          onSave={async (orderData) => {
            try {
              await onAddSalesOrder(orderData);
              showSuccessToast("✅ Submitted successfully! New Sales Order created.");
              setShowAddOrderModal(false);
            } catch (err) {
              showErrorToast(err.message || "Failed to create sales order.");
            }
          }}
          onClose={() => setShowAddOrderModal(false)}
        />
      )}

      {/* ==================== MODAL: RECORD DISPATCH SHIPMENT ==================== */}
      {showRecordDispatchModal && selectedOrderForDispatch && (
        <DispatchModal
          order={selectedOrderForDispatch}
          onSave={async (dispatchData) => {
            try {
              await onAddDispatch(dispatchData);
              showSuccessToast("✅ Submitted successfully! Dispatch shipment recorded.");
              setShowRecordDispatchModal(false);
              setSelectedOrderForDispatch(null);
            } catch (err) {
              showErrorToast(err.message || "Failed to record dispatch.");
            }
          }}
          onClose={() => {
            setShowRecordDispatchModal(false);
            setSelectedOrderForDispatch(null);
          }}
        />
      )}

    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY ADD/EDIT MODAL ====================
function PartyModal({ party, crmExecutives, asmList, tsmList, currentExecutive, currentUser, onSave, onClose }) {
  const isCrmRole = currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm";
  const [name, setName] = useState(party?.name || "");
  const [contactPerson, setContactPerson] = useState(party?.contactPerson || "");
  const [phone, setPhone] = useState(party?.phone || "");
  const [email, setEmail] = useState(party?.email || "");
  const [city, setCity] = useState(party?.city || "");
  const [state, setState] = useState(party?.state || "Rajasthan");
  const [gstin, setGstin] = useState(party?.gstin || "");
  const [assignedCrmId, setAssignedCrmId] = useState(party?.assignedCrmId || currentExecutive?.id || "u-ankita");
  const [assignedAsmId, setAssignedAsmId] = useState(party?.assignedAsmId || "");
  const [assignedTsmId, setAssignedTsmId] = useState(party?.assignedTsmId || "");
  const [status, setStatus] = useState(party?.status || "Active");

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalPartyName = (isCrmRole && party) ? party.name : name.trim();
    if (!finalPartyName) return;

    const crmObj = crmExecutives.find(c => c.id === assignedCrmId);
    const asmObj = asmList.find(a => a.id === assignedAsmId);
    const tsmObj = tsmList.find(t => t.id === assignedTsmId);

    onSave({
      ...(party || {}),
      name: finalPartyName,
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      state: state.trim(),
      gstin: gstin.trim(),
      assignedCrmId,
      assignedCrmName: crmObj?.name || "Ankita",
      assignedAsmId,
      assignedAsmName: asmObj?.name || "",
      assignedTsmId,
      assignedTsmName: tsmObj?.name || "",
      status
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 size={20} /> {party ? "Edit Party Account" : "Add New Customer / Dealer Party"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label className="form-label" style={{ margin: 0 }}>Party / Firm Name *</label>
              {isCrmRole && !!party && (
                <span style={{ fontSize: "0.76rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                  <Lock size={12} /> Locked (CRM cannot change party name)
                </span>
              )}
            </div>
            <input 
              type="text" 
              required 
              placeholder="e.g. Shree Ganesh Electronics" 
              value={name} 
              onChange={e => {
                if (!isCrmRole || !party) setName(e.target.value);
              }} 
              readOnly={isCrmRole && !!party}
              disabled={isCrmRole && !!party}
              className="form-control" 
              style={{
                background: (isCrmRole && !!party) ? "rgba(255, 255, 255, 0.04)" : "",
                cursor: (isCrmRole && !!party) ? "not-allowed" : "text",
                color: (isCrmRole && !!party) ? "var(--text-muted)" : "var(--text-main)",
                border: (isCrmRole && !!party) ? "1px solid rgba(245, 158, 11, 0.3)" : ""
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contact Person</label>
              <input type="text" placeholder="Key contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mobile Phone</label>
              <input type="text" placeholder="+91 98290 12345" value={phone} onChange={e => setPhone(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">City</label>
              <input type="text" placeholder="e.g. Jaipur" value={city} onChange={e => setCity(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">State</label>
              <input type="text" placeholder="e.g. Rajasthan" value={state} onChange={e => setState(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">GSTIN / Tax ID</label>
            <input type="text" placeholder="e.g. 08AABCS1429B1Z2" value={gstin} onChange={e => setGstin(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned CRM</label>
              <select value={assignedCrmId} onChange={e => setAssignedCrmId(e.target.value)} className="form-control">
                {crmExecutives.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned ASM</label>
              <select value={assignedAsmId} onChange={e => setAssignedAsmId(e.target.value)} className="form-control">
                <option value="">(None)</option>
                {asmList.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned TSM</label>
              <select value={assignedTsmId} onChange={e => setAssignedTsmId(e.target.value)} className="form-control">
                <option value="">(None)</option>
                {tsmList.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              {party ? "Save Changes" : "Create Party"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY 360° PROFILE MODAL ====================
function Party360Modal({ party, salesOrders, dispatches, onClose }) {
  const totalSpend = salesOrders.reduce((a, b) => a + (parseFloat(b.totalInr) || 0), 0);
  const totalUnits = salesOrders.reduce((a, b) => a + (parseInt(b.orderQty) || 0), 0);
  const totalDelivered = dispatches.reduce((a, b) => a + (parseInt(b.dispatchedQty) || 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "750px", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <span className="badge badge-primary" style={{ marginBottom: "6px" }}>Party 360° Profile</span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>{party.name}</h2>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              {party.city}, {party.state} • Contact: {party.contactPerson} ({party.phone})
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={22} /></button>
        </div>

        {/* Overview Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Business</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--success)" }}>₹{totalSpend.toLocaleString()}</div>
          </div>
          <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Ordered</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{totalUnits.toLocaleString()} Pcs</div>
          </div>
          <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Dispatched</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f59e0b" }}>{totalDelivered.toLocaleString()} Pcs</div>
          </div>
        </div>

        {/* Order History Table */}
        <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-main)" }}>Order History & Dispatches</h4>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order No</th>
                <th>Item Model</th>
                <th>Qty</th>
                <th>Total (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.map(o => (
                <tr key={o.id}>
                  <td>{o.orderDate}</td>
                  <td><code>{o.orderNo}</code></td>
                  <td style={{ fontWeight: 600 }}>{o.itemModel}</td>
                  <td>{o.orderQty}</td>
                  <td style={{ fontWeight: 700, color: "var(--success)" }}>₹{(o.totalInr || 0).toLocaleString()}</td>
                  <td><span className={`badge ${o.status === "Dispatched" ? "badge-success" : "badge-secondary"}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: ASM / TSM TEAM CREATION MODAL ====================
function TeamMemberModal({ member, currentExecutive, onSave, onClose }) {
  const [name, setName] = useState(member?.name || "");
  const [email, setEmail] = useState(member?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(member?.role || "asm");
  const [phone, setPhone] = useState(member?.phone || "");
  const [territory, setTerritory] = useState(member?.territory || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onSave({
      ...(member || {}),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim() || (member ? member.password : "MakPower#Sales2026!"),
      role,
      designation: role === "asm" ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)",
      phone: phone.trim(),
      territory: territory.trim(),
      parentCrmId: currentExecutive?.id || "u-ankita"
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <UserPlus size={20} /> {member ? "Edit Sales Team Account" : "Create ASM / TSM Sales Member"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name *</label>
            <input type="text" required placeholder="e.g. Vikram Sharma" value={name} onChange={e => setName(e.target.value)} className="form-control" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address *</label>
            <input type="email" required placeholder="e.g. vikram.asm@makpowerindia.com" value={email} onChange={e => setEmail(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="form-control" style={{ fontWeight: 700, color: "var(--primary)" }}>
                <option value="asm">🟢 ASM (Area Sales Manager)</option>
                <option value="tsm">🟡 TSM (Territory Sales Manager)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone Number</label>
              <input type="text" placeholder="+91 98765 11001" value={phone} onChange={e => setPhone(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Assigned Territory / Region</label>
            <input type="text" placeholder="e.g. Rajasthan & Punjab" value={territory} onChange={e => setTerritory(e.target.value)} className="form-control" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{member ? "New Password (optional)" : "Account Password"}</label>
            <input type="text" placeholder={member ? "Leave blank to keep current" : "Default: MakPower#Sales2026!"} value={password} onChange={e => setPassword(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              {member ? "Save Changes" : "Create Sales Member"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: SALES ORDER MODAL ====================
function SalesOrderModal({ parties, items, currentExecutive, onSave, onClose }) {
  const [partyId, setPartyId] = useState(parties[0]?.id || "");
  const [itemModel, setItemModel] = useState(items[0]?.name || "");
  const [category, setCategory] = useState(items[0]?.category || "General");
  const [orderQty, setOrderQty] = useState(100);
  const [unitPriceInr, setUnitPriceInr] = useState(0);
  const [notes, setNotes] = useState("");

  const handleItemSelect = (selectedName) => {
    setItemModel(selectedName);
    const found = items.find(it => it.name === selectedName);
    if (found?.category) {
      setCategory(found.category);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const party = parties.find(p => p.id === partyId);
    if (!party) return;

    onSave({
      partyId,
      partyName: party.name,
      itemModel,
      category,
      orderQty: parseInt(orderQty) || 0,
      unitPriceInr: parseFloat(unitPriceInr) || 0,
      totalInr: (parseInt(orderQty) || 0) * (parseFloat(unitPriceInr) || 0),
      dispatchedQty: 0,
      pendingQty: parseInt(orderQty) || 0,
      status: "Pending Dispatch",
      assignedCrmId: party.assignedCrmId || currentExecutive?.id || "u-ankita",
      assignedAsmId: party.assignedAsmId || "",
      assignedTsmId: party.assignedTsmId || "",
      notes
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "550px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={20} /> Log New Party Sales Order
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Customer / Party *</label>
            <select value={partyId} onChange={e => setPartyId(e.target.value)} className="form-control" required>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item / Model *</label>
              {items && items.length > 0 ? (
                <select 
                  value={itemModel} 
                  onChange={e => handleItemSelect(e.target.value)} 
                  className="form-control" 
                  required
                >
                  <option value="">-- Select Item Model --</option>
                  {items.map(it => (
                    <option key={it.id || it.name} value={it.name}>{it.name} ({it.category || "General"})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  required 
                  value={itemModel} 
                  onChange={e => setItemModel(e.target.value)} 
                  className="form-control" 
                  placeholder="Enter item model name" 
                />
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="form-control" placeholder="e.g. Chargers" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity (Pcs) *</label>
              <input type="number" required min="1" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unit Sale Price (₹) *</label>
              <input type="number" required min="1" value={unitPriceInr} onChange={e => setUnitPriceInr(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Order Value:</span>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--success)" }}>
              ₹{((parseInt(orderQty) || 0) * (parseFloat(unitPriceInr) || 0)).toLocaleString()}
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Order Notes / Delivery Terms</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="form-control" placeholder="Optional notes" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              Save Sales Order
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: DISPATCH RECORD MODAL ====================
function DispatchModal({ order, onSave, onClose }) {
  const [dispatchedQty, setDispatchedQty] = useState(order.pendingQty || order.orderQty || 50);
  const [transporterName, setTransporterName] = useState("V-Trans India Ltd");
  const [docketNo, setDocketNo] = useState(`LR-${Math.floor(100000 + Math.random() * 900000)}`);
  const [invoiceNo, setInvoiceNo] = useState(`INV-MP-26-${Math.floor(1000 + Math.random() * 9000)}`);
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      orderId: order.id,
      orderNo: order.orderNo,
      partyId: order.partyId,
      partyName: order.partyName,
      itemModel: order.itemModel,
      dispatchedQty: parseInt(dispatchedQty) || 0,
      transporterName: transporterName.trim(),
      docketNo: docketNo.trim(),
      invoiceNo: invoiceNo.trim(),
      dispatchDate,
      status: "In Transit",
      assignedCrmId: order.assignedCrmId,
      assignedAsmId: order.assignedAsmId,
      assignedTsmId: order.assignedTsmId
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Truck size={20} /> Record Dispatch for {order.orderNo}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "0.85rem" }}>
            <div><strong>Party:</strong> {order.partyName}</div>
            <div><strong>Item:</strong> {order.itemModel} (Pending: {order.pendingQty} Pcs)</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dispatched Qty *</label>
              <input type="number" required min="1" max={order.pendingQty || order.orderQty} value={dispatchedQty} onChange={e => setDispatchedQty(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dispatch Date *</label>
              <input type="date" required value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transporter Name *</label>
              <input type="text" required placeholder="e.g. VRL Logistics" value={transporterName} onChange={e => setTransporterName(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Docket / LR Number</label>
              <input type="text" placeholder="LR number" value={docketNo} onChange={e => setDocketNo(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Invoice Number</label>
            <input type="text" placeholder="INV-MP-26-0000" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-success" style={{ flex: 1, padding: "10px", fontWeight: 700 }}>
              Confirm Dispatch Shipment
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: ASSIGN PARTIES MODAL ====================
function AssignPartiesModal({ teamMember, allParties = [], onAssign, onClose }) {
  const isAsm = teamMember.role === "asm";
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => {
    return allParties
      .filter(p => isAsm ? p.assignedAsmId === teamMember.id : p.assignedTsmId === teamMember.id)
      .map(p => p.id);
  });

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(allParties.map(p => p.state).filter(Boolean))).sort();
  }, [allParties]);

  const filtered = useMemo(() => {
    return allParties.filter(p => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (p.name || "").toLowerCase().includes(q) ||
                      (p.city || "").toLowerCase().includes(q) ||
                      (p.phone || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      return true;
    });
  }, [allParties, search, stateFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.includes(p.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filtered.some(p => p.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filtered.map(p => p.id)])));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "750px", padding: "24px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={20} /> Assign Parties to {teamMember.name}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "4px 0 0 0" }}>
              Role: <strong>{isAsm ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)"}</strong> | Selected: <strong style={{ color: "var(--primary)" }}>{selectedIds.length}</strong> parties
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Search & State Filter */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search party by name, city, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: "32px", height: "36px" }}
            />
          </div>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="form-control"
            style={{ width: "auto", minHeight: "36px", height: "36px", fontSize: "0.82rem" }}
          >
            <option value="all">All States</option>
            {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* Quick Select Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "6px 10px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", fontSize: "0.82rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleToggleSelectAll}
              className="checkbox-input"
            />
            Select All Matching ({filtered.length} parties)
          </label>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
          >
            Clear All
          </button>
        </div>

        {/* Parties Checklist */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No parties found matching criteria.
            </div>
          ) : (
            filtered.map(p => {
              const isChecked = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggleRow(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: isChecked ? "rgba(56, 189, 248, 0.1)" : "transparent",
                    border: isChecked ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="checkbox-input"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {p.name}
                      <span className="badge badge-secondary" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{p.city || "—"}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      State: {p.state || "—"} | Phone: {p.phone || "—"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={() => onAssign(selectedIds)}
            className="btn btn-primary"
            style={{ flex: 1, padding: "10px", fontWeight: 700 }}
          >
            Save Party Assignments ({selectedIds.length})
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: TRACK ASM SALES & PURCHASES MODAL ====================
function AsmSalesDetailModal({ 
  member, 
  allParties = [], 
  allSalesOrders = [], 
  allDispatches = [], 
  crmPartyRemarks = [],
  items = [],
  currentUser,
  onSavePartyRemark,
  onDeletePartyRemark,
  formatInr, 
  onClose 
}) {
  const isAsm = member.role === "asm";
  const [subTab, setSubTab] = useState("items"); // "items" | "parties" | "matrix" | "leaderboard"
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeRemarkModalTarget, setActiveRemarkModalTarget] = useState(null);

  // Find all assigned parties
  const assignedParties = useMemo(() => {
    return allParties.filter(p => isAsm ? p.assignedAsmId === member.id : p.assignedTsmId === member.id);
  }, [allParties, member, isAsm]);

  const assignedPartyIdSet = useMemo(() => {
    return new Set(assignedParties.map(p => p.id));
  }, [assignedParties]);

  // Find all sales orders from these assigned parties
  const memberOrders = useMemo(() => {
    return allSalesOrders.filter(o => {
      const matchParty = assignedPartyIdSet.has(o.partyId) || o.assignedAsmId === member.id || o.assignedTsmId === member.id;
      if (!matchParty) return false;
      if (startDate || endDate) {
        if (!isDateInBetween(o.orderDate, startDate, endDate)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (o.partyName || "").toLowerCase().includes(q) ||
                      (o.itemModel || "").toLowerCase().includes(q) ||
                      (o.orderNo || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allSalesOrders, assignedPartyIdSet, member, startDate, endDate, search]);

  // Month & Category Matrix for this specific ASM/TSM
  const memberMonthCategoryMatrix = useMemo(() => {
    const map = new Map();

    memberOrders.forEach(o => {
      const orderMonth = (o.orderDate || "").slice(0, 7) || "2026-08";
      let cat = o.category;
      if (!cat || cat === "General" || cat === "Unspecified") {
        const foundItem = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        cat = foundItem?.category || "General";
      }

      const pId = o.partyId || "unknown";
      const pName = o.partyName || "Unknown Party";

      const key = `${pId}___${cat}___${orderMonth}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: pId,
          partyName: pName,
          category: cat,
          month: orderMonth,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0
        });
      }
      const cur = map.get(key);
      cur.totalOrderQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });

    // Also include assigned parties with remarks
    (crmPartyRemarks || []).forEach(r => {
      if (assignedPartyIdSet.has(r.partyId)) {
        const key = `${r.partyId}___${r.category}___${r.month}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            partyId: r.partyId,
            partyName: r.partyName,
            category: r.category,
            month: r.month,
            totalOrderQty: 0,
            totalRevenue: 0,
            orderCount: 0
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month) || a.partyName.localeCompare(b.partyName));
  }, [memberOrders, assignedPartyIdSet, crmPartyRemarks, items]);

  // Summary KPIs
  const totalRevenue = useMemo(() => {
    return memberOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);
  }, [memberOrders]);

  const totalOrderedUnits = useMemo(() => {
    return memberOrders.reduce((acc, o) => acc + (parseInt(o.orderQty) || 0), 0);
  }, [memberOrders]);

  const totalDispatchedUnits = useMemo(() => {
    return memberOrders.reduce((acc, o) => acc + (parseInt(o.dispatchedQty) || 0), 0);
  }, [memberOrders]);

  // Top Selling Items Leaderboard for this ASM
  const topItems = useMemo(() => {
    const map = new Map();
    memberOrders.forEach(o => {
      const key = o.itemModel || "Unspecified";
      if (!map.has(key)) {
        map.set(key, { itemModel: key, totalQty: 0, totalRevenue: 0, orderCount: 0 });
      }
      const cur = map.get(key);
      cur.totalQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [memberOrders]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "1050px", padding: "26px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: isAsm ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                {member.name ? member.name.slice(0, 2).toUpperCase() : "SM"}
              </div>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  {member.name} — Sales & Performance Studio
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {isAsm ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)"} | Territory: {member.territory || "General"} | Phone: {member.phone || "—"}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* 4 Summary KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Sales Revenue</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--success)" }}>{formatInr(totalRevenue)}</div>
          </div>

          <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Units Sold</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>{totalOrderedUnits.toLocaleString()} Pcs</div>
          </div>

          <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Dispatches</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fbbf24" }}>{totalDispatchedUnits.toLocaleString()} Pcs</div>
          </div>

          <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Assigned Parties</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#c084fc" }}>{assignedParties.length} Parties</div>
          </div>
        </div>

        {/* Sub-tabs & Filter Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              onClick={() => setSubTab("items")}
              className={`tab-btn ${subTab === "items" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Purchased Items ({memberOrders.length})
            </button>
            <button
              onClick={() => setSubTab("matrix")}
              className={`tab-btn ${subTab === "matrix" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: subTab === "matrix" ? 700 : 500 }}
            >
              <MessageSquare size={13} /> Month & Category Matrix + Remarks ({memberMonthCategoryMatrix.length})
            </button>
            <button
              onClick={() => setSubTab("parties")}
              className={`tab-btn ${subTab === "parties" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Assigned Parties ({assignedParties.length})
            </button>
            <button
              onClick={() => setSubTab("leaderboard")}
              className={`tab-btn ${subTab === "leaderboard" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Top Items Leaderboard
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search items or parties..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-control"
              style={{ width: "180px", height: "34px", fontSize: "0.82rem" }}
            />
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => { setStartDate(""); setEndDate(""); }}
              placeholder="Filter Order Dates"
            />
          </div>
        </div>

        {/* Tab Content Display */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px" }}>
          {subTab === "items" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Order Date</th>
                  <th>Party Name</th>
                  <th>Item Model</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Unit Price</th>
                  <th style={{ textAlign: "right" }}>Total (₹)</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {memberOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No purchase orders recorded from assigned parties.
                    </td>
                  </tr>
                ) : (
                  memberOrders.map(order => (
                    <tr key={order.id}>
                      <td><code style={{ fontSize: "0.78rem" }}>{order.orderDate}</code></td>
                      <td>
                        <strong style={{ color: "var(--text-main)" }}>{order.partyName}</strong>
                        {order.city && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{order.city}</div>}
                      </td>
                      <td>
                        <strong style={{ color: "var(--primary)" }}>{order.itemModel}</strong>
                        {order.category && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "6px" }}>({order.category})</span>}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{order.orderQty?.toLocaleString()} Pcs</td>
                      <td style={{ textAlign: "right" }}>₹{order.unitPriceInr}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(order.totalInr)}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${order.status === "Dispatched" ? "badge-success" : order.status === "Partially Dispatched" ? "badge-primary" : "badge-secondary"}`} style={{ fontSize: "0.7rem" }}>
                          {order.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {subTab === "matrix" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Party Name</th>
                  <th style={{ width: "16%" }}>Category</th>
                  <th style={{ width: "12%" }}>Month</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Order Qty</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Total (₹)</th>
                  <th style={{ width: "18%", textAlign: "center" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {memberMonthCategoryMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No month-wise category orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  memberMonthCategoryMatrix.map(row => {
                    const rowRemarks = (crmPartyRemarks || []).filter(r => (r.partyId === row.partyId || r.partyName === row.partyName) && r.category === row.category && r.month === row.month);
                    const latest = rowRemarks[0];

                    return (
                      <tr key={row.key}>
                        <td><strong style={{ color: "var(--text-main)" }}>{row.partyName}</strong></td>
                        <td>
                          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 700 }}>
                            {row.category}
                          </span>
                        </td>
                        <td><strong>{row.month}</strong></td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: row.totalOrderQty > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                          {row.totalOrderQty.toLocaleString()} Pcs
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>
                          {formatInr(row.totalRevenue)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setActiveRemarkModalTarget({
                              partyId: row.partyId,
                              partyName: row.partyName,
                              category: row.category,
                              month: row.month,
                              totalOrderQty: row.totalOrderQty,
                              totalRevenue: row.totalRevenue
                            })}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.74rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <MessageSquare size={12} /> {rowRemarks.length > 0 ? `Remarks (${rowRemarks.length})` : "+ Put Remark"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {subTab === "parties" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Party / Dealer Name</th>
                  <th>Location / State</th>
                  <th>Contact Person & Phone</th>
                  <th style={{ textAlign: "right" }}>Total Orders</th>
                  <th style={{ textAlign: "right" }}>Total Revenue</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignedParties.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No parties assigned to this sales manager yet. Click "Assign Parties" on the team card to link accounts.
                    </td>
                  </tr>
                ) : (
                  assignedParties.map(p => {
                    const pOrders = memberOrders.filter(o => o.partyId === p.id);
                    const pRevenue = pOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);

                    return (
                      <tr key={p.id}>
                        <td><strong style={{ color: "var(--text-main)" }}>{p.name}</strong></td>
                        <td>{p.city || "—"} {p.state ? `(${p.state})` : ""}</td>
                        <td>{p.contactPerson || "—"} • {p.phone || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{pOrders.length} Orders</td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(pRevenue)}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${p.status === "Active" ? "badge-success" : "badge-secondary"}`}>
                            {p.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {subTab === "leaderboard" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Item Model</th>
                  <th style={{ textAlign: "right" }}>Total Units Sold</th>
                  <th style={{ textAlign: "right" }}>Orders Count</th>
                  <th style={{ textAlign: "right" }}>Total Revenue (₹)</th>
                </tr>
              </thead>
              <tbody>
                {topItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No sales recorded for this sales manager yet.
                    </td>
                  </tr>
                ) : (
                  topItems.map((item, idx) => (
                    <tr key={item.itemModel}>
                      <td style={{ fontWeight: 800, color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "var(--text-muted)" }}>
                        #{idx + 1}
                      </td>
                      <td><strong style={{ color: "var(--primary)" }}>{item.itemModel}</strong></td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{item.totalQty.toLocaleString()} Pcs</td>
                      <td style={{ textAlign: "right" }}>{item.orderCount}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(item.totalRevenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Sub-modal for Remarks inside ASM Sales modal */}
        {activeRemarkModalTarget && (
          <PartyCategoryRemarkModal
            target={activeRemarkModalTarget}
            remarks={(crmPartyRemarks || []).filter(r => (r.partyId === activeRemarkModalTarget.partyId || r.partyName === activeRemarkModalTarget.partyName) && r.category === activeRemarkModalTarget.category && r.month === activeRemarkModalTarget.month)}
            currentUser={currentUser}
            formatInr={formatInr}
            onSave={async (text) => {
              if (onSavePartyRemark) {
                await onSavePartyRemark({
                  partyId: activeRemarkModalTarget.partyId,
                  partyName: activeRemarkModalTarget.partyName,
                  category: activeRemarkModalTarget.category,
                  month: activeRemarkModalTarget.month,
                  remark: text,
                  authorId: currentUser?.id || member.id,
                  authorName: currentUser?.name || member.name,
                  authorRole: currentUser?.role || member.role || "asm"
                });
              }
            }}
            onDelete={async (id) => {
              if (onDeletePartyRemark) await onDeletePartyRemark(id);
            }}
            onClose={() => setActiveRemarkModalTarget(null)}
          />
        )}

        <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY & CATEGORY MONTHLY REMARK MODAL ====================
function PartyCategoryRemarkModal({ target, remarks = [], currentUser, formatInr, onSave, onDelete, onClose }) {
  const [remarkText, setRemarkText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarkText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(remarkText.trim());
      setRemarkText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "650px", padding: "26px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 800 }}>
                {target.category}
              </span>
              <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                📅 {target.month}
              </span>
            </div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              {target.partyName}
            </h3>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Current Month Volume: <strong style={{ color: "var(--primary)" }}>{(target.totalOrderQty || 0).toLocaleString()} Pcs</strong> {target.totalRevenue ? `• ${formatInr(target.totalRevenue)}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Existing Remarks Thread */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(0,0,0,0.15)", marginBottom: "16px", minHeight: "160px", maxHeight: "300px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Remarks History ({remarks.length})
          </div>

          {remarks.length === 0 ? (
            <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem" }}>
              No remarks recorded for this party & category in <strong>{target.month}</strong> yet.<br />
              <span style={{ fontSize: "0.78rem" }}>ASMs, TSMs, and CRMs can log observations, dealer commitments, or demand trends below.</span>
            </div>
          ) : (
            remarks.map(r => {
              const isAuthor = currentUser?.id === r.authorId || currentUser?.name === r.authorName;
              const canDelete = isAuthor || currentUser?.role === "superadmin" || currentUser?.role === "crm" || currentUser?.role === "owner";

              return (
                <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge" style={{ 
                        background: r.authorRole === "asm" ? "rgba(16, 185, 129, 0.15)" : r.authorRole === "tsm" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: r.authorRole === "asm" ? "#34d399" : r.authorRole === "tsm" ? "#fbbf24" : "#818cf8",
                        fontWeight: 800,
                        fontSize: "0.72rem"
                      }}>
                        {r.authorRole ? r.authorRole.toUpperCase() : "TEAM"}
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>{r.authorName}</strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      {canDelete && (
                        <button
                          onClick={() => onDelete(r.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--danger)", padding: "2px 6px" }}
                          title="Delete remark"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                    {r.remark}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Remark Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.82rem", margin: 0 }}>
              Add New Remark for {target.partyName} ({target.category} • {target.month})
            </label>
            <textarea
              rows={3}
              required
              placeholder={`Write observation or update for ${target.partyName} in ${target.category}... (e.g. Dealer requested 500 pcs next month with special terms)`}
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              className="form-control"
              style={{ fontSize: "0.86rem" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !remarkText.trim()}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              {isSubmitting ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
              Post Remark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}