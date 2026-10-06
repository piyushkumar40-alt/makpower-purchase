import React, { useState, useMemo, useEffect } from "react";
import { 
  LogOut, 
  Filter, 
  CheckSquare, 
  Square, 
  CheckCircle, 
  PackageOpen, 
  Download, 
  RotateCcw,
  Eye,
  Ship,
  Layers,
  Search,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  ArrowRight,
  DollarSign,
  RefreshCw,
  X,
  ShoppingCart,
  Package,
  Building2,
  User,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import ItemMasterView from "./ItemMasterView";
import BundledUpcomingShipments, { OrderInspectionModal } from "./BundledUpcomingShipments";
import MasterOrderTracker, { getOrderStage } from "./MasterOrderTracker";
import RequesterForm from "./RequesterForm";
import CustomSelect from "./CustomSelect";
import { useSortableData } from "../utils/useSortableData";
import { getPurchaserDisplayName, downloadOrOpenBlob } from "../utils/formatters";

export default function RahulDashboard({ 
  currentUser = {}, 
  requests = [], 
  vendors = [], 
  cargos = [], 
  cargoCompanies = [],
  purchasers = [], 
  users = [],
  items = [],
  onBatchUpdateRequests, 
  onLogout 
}) {
  const getPurchaserName = (r) => getPurchaserDisplayName(r, purchasers);

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("makpower_rahul_tab") || "pending";
  });

  useEffect(() => {
    localStorage.setItem("makpower_rahul_tab", activeTab);
  }, [activeTab]);

  // Inspection modal state
  const [inspectedOrder, setInspectedOrder] = useState(null);

  // Multi-Level Filtration States
  const [quickStatus, setQuickStatus] = useState("all"); // "all" | "coming" | "pipeline" | "delivered" | "pending_mark" | "marked"
  const [filterStage, setFilterStage] = useState("all");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterPurchaser, setFilterPurchaser] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCargo, setFilterCargo] = useState("");
  const [filterTransport, setFilterTransport] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "Import" | "Local"
  const [searchQuery, setSearchQuery] = useState("");
  const [dateField, setDateField] = useState("orderDate");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Selection check for marking purchases
  const [checkedIds, setCheckedIds] = useState([]);

  // Active non-cancelled requests
  const activeRequests = useMemo(() => requests.filter(r => r.status !== "Cancelled"), [requests]);

  // Financial & Operational Accounts Executive Metrics
  const kpiStats = useMemo(() => {
    let totalPcs = 0;
    let totalRmbValue = 0;
    let comingCount = 0;
    let comingRmbValue = 0;
    let deliveredCount = 0;
    let deliveredRmbValue = 0;
    let inTransitCount = 0;
    let readyVendorCount = 0;

    activeRequests.forEach(r => {
      const qty = parseInt(r.orderQuantity, 10) || 0;
      const price = parseFloat(r.priceRmb) || 0;
      const val = qty * price;

      totalPcs += qty;
      if (price > 0) totalRmbValue += val;

      const cargo = cargos.find(c => c.id === r.cargoId);
      const isDelivered = r.isMaterialRec === "Yes";
      const isInTransit = !isDelivered && Boolean(r.cargoPickupDate || cargo?.cargoShippingDate);
      const isReadyVendor = !isDelivered && !isInTransit && Boolean(r.vendorEdd);

      if (isDelivered) {
        deliveredCount++;
        deliveredRmbValue += val;
      } else if (isInTransit || isReadyVendor) {
        comingCount++;
        comingRmbValue += val;
        if (isInTransit) inTransitCount++;
        else readyVendorCount++;
      }
    });

    // Eligible for purchase update: priced and assigned vendor
    const eligiblePriced = activeRequests.filter(r => r.priceRmb && r.vendorId);
    const pendingMarkCount = eligiblePriced.filter(r => r.purchaseUpdated !== "Yes").length;
    const markedCount = eligiblePriced.filter(r => r.purchaseUpdated === "Yes").length;

    // Upcoming bundled shipments count
    const upcomingShipmentsCount = cargos.filter(c => c.status !== "Delivered" && c.isDelivered !== "Yes").length;

    return {
      totalOrders: activeRequests.length,
      totalPcs,
      totalRmbValue,
      comingCount,
      comingRmbValue,
      inTransitCount,
      readyVendorCount,
      deliveredCount,
      deliveredRmbValue,
      pendingMarkCount,
      markedCount,
      upcomingShipmentsCount
    };
  }, [activeRequests, cargos]);

  // Filter requests: priced, vendor assigned (all items, not just Import)
  const eligibleRequests = useMemo(() => requests.filter(r => r.priceRmb && r.vendorId), [requests]);

  // Partitioned requests for Mark Purchases
  const pendingRequests = useMemo(() => eligibleRequests.filter(r => r.purchaseUpdated !== "Yes" && r.status !== "Cancelled"), [eligibleRequests]);
  const submittedRequests = useMemo(() => eligibleRequests.filter(r => r.purchaseUpdated === "Yes" && r.status !== "Cancelled"), [eligibleRequests]);

  // Active requests for the current tab
  const currentTabRequests = activeTab === "pending" ? pendingRequests : submittedRequests;

  // Multi-Level Filtered Requests
  const filteredRequests = useMemo(() => {
    return currentTabRequests.filter(r => {
      const cargo = cargos.find(c => c.id === r.cargoId);
      const stage = getOrderStage(r, cargo);

      // 1. Quick Status Chip Filter
      if (quickStatus === "coming") {
        const isComing = stage.key === "pickedup" || stage.key === "vendorready";
        if (!isComing) return false;
      } else if (quickStatus === "pipeline") {
        const inPipeline = r.isMaterialRec !== "Yes" && r.status !== "Cancelled";
        if (!inPipeline) return false;
      } else if (quickStatus === "delivered") {
        if (r.isMaterialRec !== "Yes") return false;
      } else if (quickStatus === "pending_mark") {
        if (r.purchaseUpdated === "Yes") return false;
      } else if (quickStatus === "marked") {
        if (r.purchaseUpdated !== "Yes") return false;
      }

      // 2. Stage Filter ("Where Item Is Now")
      if (filterStage !== "all" && stage.key !== filterStage) {
        return false;
      }

      // 3. Vendor Filter
      if (filterVendor && r.vendorId !== filterVendor) {
        return false;
      }

      // 4. Purchaser Filter
      if (filterPurchaser) {
        const pName = getPurchaserName(r).toLowerCase();
        const fLower = filterPurchaser.toLowerCase();
        const pId = String(r.purchaserId || "").toLowerCase();
        const isMatch = pName.includes(fLower) || r.purchaserId === filterPurchaser ||
          (fLower.includes("rahul") && (pId === "u-rahul" || pId === "u-rahul-kumar" || pId === "rahul" || pName.includes("rahul")));
        if (!isMatch) {
          return false;
        }
      }

      // 5. Cargo Filter
      if (filterCargo && r.cargoId !== filterCargo) {
        return false;
      }

      // 6. Transport Mode Filter
      if (filterTransport && cargo?.modeOfTransport !== filterTransport) {
        return false;
      }

      // 7. Category Filter
      if (filterCategory && (!r.category || !r.category.toLowerCase().includes(filterCategory.toLowerCase()))) {
        return false;
      }

      // 8. Purchase Type Filter
      if (filterType !== "all" && r.type !== filterType) {
        return false;
      }

      // 9. Date Range Filter
      if (fromDate || toDate) {
        let targetDate = "";
        if (dateField === "orderDate") targetDate = r.orderDate;
        else if (dateField === "vendorEdd") targetDate = r.vendorEdd;
        else if (dateField === "cargoShippingDate") targetDate = cargo?.cargoShippingDate;
        else if (dateField === "receivedDate") targetDate = r.receivedDate || cargo?.receivedDate;

        if (targetDate) {
          if (fromDate && targetDate < fromDate) return false;
          if (toDate && targetDate > toDate) return false;
        } else if (fromDate || toDate) {
          return false;
        }
      }

      // 10. Global Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const v = vendors.find(v => v.id === r.vendorId)?.name || "";
        const p = getPurchaserName(r);
        const cCode = cargo?.cargoDetail || r.cargoId || "";
        const match = (
          (r.model && r.model.toLowerCase().includes(q)) ||
          (r.id && String(r.id).toLowerCase().includes(q)) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          v.toLowerCase().includes(q) ||
          p.toLowerCase().includes(q) ||
          cCode.toLowerCase().includes(q) ||
          (cargo?.modeOfTransport && cargo.modeOfTransport.toLowerCase().includes(q)) ||
          (r.entryBy && r.entryBy.toLowerCase().includes(q)) ||
          (r.requestedBy && r.requestedBy.toLowerCase().includes(q))
        );
        if (!match) return false;
      }

      return true;
    });
  }, [currentTabRequests, quickStatus, filterStage, filterVendor, filterPurchaser, filterCargo, filterTransport, filterCategory, filterType, dateField, fromDate, toDate, searchQuery, cargos, vendors, purchasers]);

  const { items: sortedDisplayRequests, RenderSortHeader } = useSortableData(filteredRequests);

  // Extract filter options dynamically
  const uniqueVendors = useMemo(() => {
    return Array.from(new Set(eligibleRequests.map(r => r.vendorId)))
      .map(id => vendors.find(v => v.id === id))
      .filter(Boolean);
  }, [eligibleRequests, vendors]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(eligibleRequests.map(r => r.category).filter(Boolean)));
  }, [eligibleRequests]);

  const uniqueCargos = useMemo(() => {
    return Array.from(new Set(eligibleRequests.map(r => r.cargoId).filter(Boolean)));
  }, [eligibleRequests]);

  const uniquePurchasers = useMemo(() => {
    return purchasers && purchasers.length > 0 
      ? purchasers 
      : Array.from(new Set(eligibleRequests.map(r => getPurchaserName(r)).filter(Boolean))).map(name => ({ id: name, name }));
  }, [purchasers, eligibleRequests]);

  const stageOptions = [
    { value: "all", label: "All Stages" },
    { value: "step1", label: "Step 1: Starting (Unpriced)" },
    { value: "priced", label: "Step 2: Priced / In Production" },
    { value: "consolidated", label: "Step 3: Cargo Consolidated" },
    { value: "pickedup", label: "Step 4: In Freight Transit" },
    { value: "received", label: "Step 5: Warehouse Received" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const vendorOptions = useMemo(() => [
    { value: "", label: "All Vendors" },
    ...uniqueVendors.map(v => ({ value: v.id, label: v.name }))
  ], [uniqueVendors]);

  const purchaserOptions = useMemo(() => [
    { value: "", label: "All Purchasers" },
    ...uniquePurchasers.map(p => ({ value: p.name, label: p.name }))
  ], [uniquePurchasers]);

  const categoryOptions = useMemo(() => [
    { value: "", label: "All Categories" },
    ...uniqueCategories.map(cat => ({ value: cat, label: cat }))
  ], [uniqueCategories]);

  const cargoOptions = useMemo(() => [
    { value: "", label: "All Cargo Batches" },
    ...uniqueCargos.map(cid => {
      const cObj = cargos.find(c => c.id === cid);
      return { value: cid, label: cObj?.cargoDetail || cid };
    })
  ], [uniqueCargos, cargos]);

  const transportOptions = [
    { value: "", label: "All Modes" },
    { value: "Sea Freight", label: "Sea Freight" },
    { value: "Air Express", label: "Air Express" },
    { value: "Road Freight", label: "Road Freight" },
    { value: "Courier", label: "Courier" }
  ];

  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "Import", label: "Import" },
    { value: "Local", label: "Local" }
  ];

  const dateFieldOptions = [
    { value: "orderDate", label: "Order Date" },
    { value: "vendorEdd", label: "Vendor EDD" },
    { value: "cargoShippingDate", label: "Cargo Ship Date" },
    { value: "receivedDate", label: "Received Date" }
  ];

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

  const handleUnsubmitUpdate = () => {
    if (checkedIds.length === 0) return;
    const updated = submittedRequests.filter(r => checkedIds.includes(r.id)).map(r => ({
      ...r,
      purchaseUpdated: "No"
    }));
    onBatchUpdateRequests(updated);
    setCheckedIds([]);
  };

  const resetFilters = () => {
    setQuickStatus("all");
    setFilterStage("all");
    setFilterVendor("");
    setFilterPurchaser("");
    setFilterCategory("");
    setFilterCargo("");
    setFilterTransport("");
    setFilterType("all");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
  };

  const hasActiveFilters = quickStatus !== "all" || filterStage !== "all" || filterVendor || filterPurchaser || filterCategory || filterCargo || filterTransport || filterType !== "all" || searchQuery || fromDate || toDate;

  return (
    <div style={{ padding: "24px", maxWidth: "1680px", margin: "0 auto", width: "100%" }}>
      
      {/* ==================== TOP HEADER PANEL ==================== */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.65rem", color: "var(--primary)", textShadow: "0 0 10px var(--primary-glow)", margin: 0 }}>
              Accounts & Purchase Marking Panel
            </h2>
            <span className="user-badge" style={{ padding: "5px 12px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "var(--success)", fontWeight: 700, fontSize: "0.82rem" }}>
              Mr. Rahul Mann (Accounts)
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "4px", marginBottom: 0 }}>
            360° Order Visibility, Bundled Upcoming Shipments, Financial Audit & Ledger Marking Confirmation
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", fontSize: "0.78rem", color: "#38bdf8" }}>
            <Eye size={14} /> Master Orders: View Only
          </div>
          <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ padding: "8px 14px" }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ==================== ACCOUNTS EXECUTIVE KPI BAR ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        
        {/* KPI 1: What's Coming (In Transit & Ready) */}
        <div 
          onClick={() => { setActiveTab("shipments"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: activeTab === "shipments" ? "1px solid #38bdf8" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>🚚 What's Coming</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ship size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#38bdf8" }}>
            {kpiStats.comingCount} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>Items</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", justifyContent: "space-between" }}>
            <span>In Transit: <strong>{kpiStats.inTransitCount}</strong></span>
            <span>Ready: <strong>{kpiStats.readyVendorCount}</strong></span>
          </div>
        </div>

        {/* KPI 2: Total Order Value RMB */}
        <div 
          onClick={() => { setActiveTab("masterorder"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: activeTab === "masterorder" ? "1px solid #f59e0b" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>💰 Total RMB Committed</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#f59e0b" }}>
            ¥{Math.round(kpiStats.totalRmbValue).toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Across {kpiStats.totalOrders} Requisitions ({kpiStats.totalPcs.toLocaleString()} Pcs)
          </div>
        </div>

        {/* KPI 3: Where Items Are Now (Active Pipeline) */}
        <div 
          onClick={() => { setActiveTab("masterorder"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📍 Where Item Is Now</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#818cf8" }}>
            {kpiStats.totalOrders - kpiStats.deliveredCount} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>In Pipeline</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            ¥{Math.round(kpiStats.comingRmbValue).toLocaleString()} committed on the way
          </div>
        </div>

        {/* KPI 4: Delivered (Warehouse Receipts) */}
        <div 
          onClick={() => { setActiveTab("masterorder"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>✅ What is Delivered</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#10b981" }}>
            {kpiStats.deliveredCount} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>Orders</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Delivered Value: ¥{Math.round(kpiStats.deliveredRmbValue).toLocaleString()}
          </div>
        </div>

        {/* KPI 5: Pending Ledger Mark Purchases (His Primary Duty) */}
        <div 
          onClick={() => { setActiveTab("pending"); setCheckedIds([]); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: activeTab === "pending" ? "1px solid #ec4899" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📝 Pending Mark Purchases</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(236, 72, 153, 0.15)", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#ec4899" }}>
            {kpiStats.pendingMarkCount} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>To Confirm</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Marked in Ledger: <strong>{kpiStats.markedCount}</strong>
          </div>
        </div>

      </div>

      {/* ==================== MAIN TAB BAR ==================== */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px", flexWrap: "wrap" }}>
        
        {/* Core Duty 1: Pending Purchases */}
        <button 
          onClick={() => { setActiveTab("pending"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Clock size={15} /> Pending Mark Purchases ({pendingRequests.length})
        </button>

        {/* Core Duty 2: Submitted Purchases Archive */}
        <button 
          onClick={() => { setActiveTab("submitted"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "submitted" ? "active" : ""}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <CheckCircle size={15} /> Marked in Ledger Archive ({submittedRequests.length})
        </button>

        {/* Feature 1: Bundled Upcoming Shipments (Step 5) */}
        <button 
          onClick={() => { setActiveTab("shipments"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "shipments" ? "active" : ""}`}
          style={{ color: "#38bdf8", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Ship size={15} /> Step 5: Transit Tracking ({cargos.length})
        </button>

        {/* Feature 2: Master Order Tracker */}
        <button 
          onClick={() => { setActiveTab("masterorder"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "masterorder" ? "active" : ""}`}
          style={{ color: "#f59e0b", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Layers size={15} /> Master Order Tracker (All Stages)
        </button>

        {/* Feature 3: Create Master Order (View-Only) */}
        <button 
          onClick={() => { setActiveTab("create_order"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "create_order" ? "active" : ""}`}
          style={{ color: "#818cf8", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ShoppingCart size={15} /> Master Requisitions (View-Only)
        </button>

        {/* Feature 4: Item Catalog & Stock */}
        <button 
          onClick={() => { setActiveTab("itemmaster"); setCheckedIds([]); }} 
          className={`tab-btn ${activeTab === "itemmaster" ? "active" : ""}`}
          style={{ color: "#a855f7", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Package size={15} /> Item Catalog & Stock
        </button>
      </div>

      {/* ==================== TAB CONTENT: BUNDLED UPCOMING SHIPMENTS ==================== */}
      {activeTab === "shipments" && (
        <div className="card-fade-in">
          <BundledUpcomingShipments 
            cargos={cargos}
            requests={requests}
            vendors={vendors}
            cargoCompanies={cargoCompanies}
            purchasers={purchasers}
            currentUser={currentUser}
            isViewOnly={true}
          />
        </div>
      )}

      {/* ==================== TAB CONTENT: MASTER ORDER TRACKER ==================== */}
      {activeTab === "masterorder" && (
        <div className="card-fade-in">
          <div style={{ marginBottom: "14px", padding: "10px 16px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", gap: "10px" }}>
            <Eye size={18} style={{ color: "#f59e0b" }} />
            <div style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
              <strong>Accounts Read-Only Master Tracker:</strong> You have 360° visibility over every order in the company across all 6 stages. Deletion and editing are locked.
            </div>
          </div>
          <MasterOrderTracker 
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            cargoCompanies={cargoCompanies}
            purchasers={purchasers}
            currentUser={currentUser}
            isViewOnly={true}
          />
        </div>
      )}

      {/* ==================== TAB CONTENT: CREATE MASTER ORDER (VIEW ONLY) ==================== */}
      {activeTab === "create_order" && (
        <div className="card-fade-in">
          <RequesterForm 
            onAddRequests={() => {}} 
            purchasers={purchasers} 
            vendors={vendors} 
            requests={requests}
            cargos={cargos}
            cargoCompanies={cargoCompanies}
            currentUser={currentUser}
            items={items}
            onAddItem={() => {}}
            onAddPurchaser={() => {}}
            isViewOnly={true}
          />
        </div>
      )}

      {/* ==================== TAB CONTENT: ITEM CATALOG & STOCK ==================== */}
      {activeTab === "itemmaster" && (
        <div className="card-fade-in">
          <ItemMasterView requests={requests} vendors={vendors} cargos={cargos} cargoCompanies={cargoCompanies} purchasers={purchasers} />
        </div>
      )}

      {/* ==================== TAB CONTENT: MARK PURCHASES WORKBOARD (PENDING / SUBMITTED) ==================== */}
      {(activeTab === "pending" || activeTab === "submitted") && (
        <>
          {/* ==================== MULTI-LEVEL FILTRATION PANEL ==================== */}
          <div className="glass-panel" style={{ padding: "18px 22px", marginBottom: "20px" }}>
            
            {/* Header with Quick Presets */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.95rem", fontWeight: 700, color: "var(--primary)" }}>
                <Filter size={18} /> Accounts Multi-Level Filtration System
              </div>

              {hasActiveFilters && (
                <button 
                  onClick={resetFilters} 
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.76rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <RotateCcw size={12} /> Reset All Filters
                </button>
              )}
            </div>

            {/* Level 1: Quick Status Filter Chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button 
                onClick={() => setQuickStatus("all")}
                className={`btn btn-sm ${quickStatus === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              >
                All Items ({currentTabRequests.length})
              </button>
              
              <button 
                onClick={() => setQuickStatus("coming")}
                className={`btn btn-sm ${quickStatus === "coming" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "coming" ? "#fff" : "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
              >
                🚚 What's Coming (In Transit & Ready)
              </button>

              <button 
                onClick={() => setQuickStatus("pipeline")}
                className={`btn btn-sm ${quickStatus === "pipeline" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "pipeline" ? "#fff" : "#818cf8", borderColor: "rgba(129, 140, 248, 0.4)" }}
              >
                📍 Where Item Is Now (Active Pipeline)
              </button>

              <button 
                onClick={() => setQuickStatus("delivered")}
                className={`btn btn-sm ${quickStatus === "delivered" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "delivered" ? "#fff" : "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}
              >
                ✅ Delivered (Warehouse Received)
              </button>

              <button 
                onClick={() => setQuickStatus("pending_mark")}
                className={`btn btn-sm ${quickStatus === "pending_mark" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "pending_mark" ? "#fff" : "#ec4899", borderColor: "rgba(236, 72, 153, 0.4)" }}
              >
                ⏳ Pending Mark in Ledger
              </button>

              <button 
                onClick={() => setQuickStatus("marked")}
                className={`btn btn-sm ${quickStatus === "marked" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "marked" ? "#fff" : "#a855f7", borderColor: "rgba(168, 85, 247, 0.4)" }}
              >
                ✓ Marked in Ledger
              </button>
            </div>

            {/* Level 2 & 3: Filter Dropdowns Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              
              {/* Stage Filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Stage (Where Item Is Now)</label>
                <CustomSelect 
                  value={filterStage}
                  onChange={val => setFilterStage(val)}
                  options={stageOptions}
                  placeholder="All Stages"
                  clearable={true}
                />
              </div>

              {/* Vendor filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Vendor</label>
                <CustomSelect 
                  value={filterVendor}
                  onChange={val => setFilterVendor(val)}
                  options={vendorOptions}
                  placeholder="Select Vendor..."
                  searchable={true}
                  clearable={true}
                />
              </div>

              {/* Purchaser Filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Purchaser</label>
                <CustomSelect 
                  value={filterPurchaser}
                  onChange={val => setFilterPurchaser(val)}
                  options={purchaserOptions}
                  placeholder="All Purchasers"
                  searchable={true}
                  clearable={true}
                />
              </div>

              {/* Category filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Category</label>
                <CustomSelect 
                  value={filterCategory}
                  onChange={val => setFilterCategory(val)}
                  options={categoryOptions}
                  placeholder="Select Category..."
                  searchable={true}
                  clearable={true}
                />
              </div>

              {/* Cargo filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Cargo Code</label>
                <CustomSelect 
                  value={filterCargo}
                  onChange={val => setFilterCargo(val)}
                  options={cargoOptions}
                  placeholder="Select Cargo..."
                  searchable={true}
                  clearable={true}
                />
              </div>

              {/* Transport Mode filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Transport Mode</label>
                <CustomSelect 
                  value={filterTransport}
                  onChange={val => setFilterTransport(val)}
                  options={transportOptions}
                  placeholder="All Modes"
                  clearable={true}
                />
              </div>

              {/* Type filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Order Type</label>
                <CustomSelect 
                  value={filterType}
                  onChange={val => setFilterType(val)}
                  options={typeOptions}
                  placeholder="All Types"
                  clearable={true}
                />
              </div>

            </div>

            {/* Level 4: Search & Date Range Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", alignItems: "flex-end" }}>
              
              {/* Keyword Search */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Search Keyword</label>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ fontSize: "0.82rem", padding: "6px 10px 6px 30px" }}
                    placeholder="Search Model, ID, Vendor, Cargo..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <X size={14} onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--text-muted)" }} />
                  )}
                </div>
              </div>

              {/* Date Field Selector */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Filter by Date Field</label>
                <CustomSelect 
                  value={dateField}
                  onChange={val => setDateField(val)}
                  options={dateFieldOptions}
                  placeholder="Select Date Field"
                />
              </div>

              {/* From Date */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>From Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>To Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>

            </div>

          </div>

          {/* ==================== ACTION ROW FOR MARKING PURCHASES ==================== */}
          {activeTab === "pending" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                  Selected: <strong style={{ color: "var(--primary)" }}>{checkedIds.length}</strong> of {filteredRequests.length} pending items
                </span>
                {checkedIds.length > 0 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    (Total RMB: ¥{Math.round(pendingRequests.filter(r => checkedIds.includes(r.id)).reduce((sum, r) => sum + ((r.orderQuantity || 0) * (r.priceRmb || 0)), 0)).toLocaleString()})
                  </span>
                )}
              </div>
              <button 
                onClick={handleSubmitUpdate}
                disabled={checkedIds.length === 0}
                className="btn btn-primary"
                style={{ padding: "10px 22px", display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
              >
                <CheckCircle size={17} /> Confirm & Mark {checkedIds.length || ""} Purchases as Updated
              </button>
            </div>
          )}

          {activeTab === "submitted" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                Selected: <strong style={{ color: "#38bdf8" }}>{checkedIds.length}</strong> of {filteredRequests.length} marked items
              </span>
              <button 
                onClick={handleUnsubmitUpdate}
                disabled={checkedIds.length === 0}
                className="btn btn-secondary"
                style={{ 
                  padding: "10px 20px", 
                  color: "#ef4444", 
                  borderColor: "rgba(239, 68, 68, 0.4)", 
                  background: "rgba(239, 68, 68, 0.1)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <RotateCcw size={16} /> Mark {checkedIds.length || ""} Selected as Unsubmitted (Bulk Undo)
              </button>
            </div>
          )}

          {/* ==================== WORKBOARD TABLE ==================== */}
          {filteredRequests.length === 0 ? (
            <div className="glass-panel" style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <PackageOpen size={42} style={{ color: "var(--primary)", marginBottom: "14px", display: "inline" }} />
              <h4 style={{ fontSize: "1.1rem", color: "var(--text-main)", marginBottom: "6px" }}>No Requisitions Match Filters</h4>
              <p style={{ fontSize: "0.85rem", maxWidth: "460px", margin: "0 auto 16px" }}>
                Try adjusting your search query, status chip, or clearing specific dropdown filters.
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: "4px" }}>
              <div className="table-container" style={{ maxHeight: "680px", overflowY: "auto" }}>
                <table className="custom-table" style={{ fontSize: "0.84rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "42px", textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          className="checkbox-input"
                          checked={checkedIds.length > 0 && checkedIds.length === filteredRequests.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th style={{ width: "65px", textAlign: "center" }}>Inspect</th>
                      <RenderSortHeader colKey="stage" title="Where Item Is Now" getValue={r => getOrderStage(r, cargos.find(c => c.id === r.cargoId)).label} />
                      <RenderSortHeader colKey="purchaser" title="Purchaser" getValue={r => getPurchaserName(r)} />
                      <RenderSortHeader colKey="entryBy" title="Required By" getValue={r => r.entryBy || r.requestedBy || "Requester"} />
                      <RenderSortHeader colKey="vendor" title="Vendor" getValue={r => vendors.find(v => v.id === r.vendorId)?.name || ""} />
                      <RenderSortHeader colKey="orderDate" title="Order Date" />
                      <RenderSortHeader colKey="type" title="Type" />
                      <RenderSortHeader colKey="model" title="Model / Item" />
                      <RenderSortHeader colKey="orderQuantity" title="Qty" />
                      <RenderSortHeader colKey="priceRmb" title="Price (¥)" getValue={r => parseFloat(r.priceRmb) || 0} />
                      <RenderSortHeader colKey="totalRmb" title="Total RMB (¥)" getValue={r => (parseInt(r.orderQuantity, 10) || 0) * (parseFloat(r.priceRmb) || 0)} />
                      <RenderSortHeader colKey="vendorEdd" title="EDD" />
                      <RenderSortHeader colKey="cargoDate" title="Cargo Date" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoOrderDate || ""} />
                      <RenderSortHeader colKey="cargoDetail" title="Cargo Detail / Code" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoDetail || ""} />
                      <RenderSortHeader colKey="modeOfTransport" title="Transport" getValue={r => cargos.find(c => c.id === r.cargoId)?.modeOfTransport || ""} />
                      <RenderSortHeader colKey="cargoShippingDate" title="Ship Date" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoShippingDate || ""} />
                      <RenderSortHeader colKey="cargoEta" title="ETA" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoEta || ""} />
                      <RenderSortHeader colKey="purchaseUpdated" title="Purchase Updated" />
                      <RenderSortHeader colKey="isMaterialRec" title="Material Rec" />
                      <th>Cargo Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDisplayRequests.map(r => {
                      const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                      const cargo = cargos.find(c => c.id === r.cargoId);
                      const isChecked = checkedIds.includes(r.id);
                      const stage = getOrderStage(r, cargo);
                      const qty = parseInt(r.orderQuantity, 10) || 0;
                      const price = parseFloat(r.priceRmb) || 0;
                      const totalRmb = qty * price;

                      return (
                        <tr key={r.id} className={isChecked ? "planner-row-selected" : ""}>
                          {/* Checkbox */}
                          <td style={{ textAlign: "center" }}>
                            <input 
                              type="checkbox" 
                              className="checkbox-input"
                              checked={isChecked}
                              onChange={() => handleToggleSelect(r.id)}
                            />
                          </td>

                          {/* Inspection Action */}
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => setInspectedOrder(r)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "3px 7px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                              title="Inspect full order, financials & cargo documents"
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>

                          {/* Stage Badge ("Where Item Is Now") */}
                          <td>
                            <span 
                              style={{ 
                                padding: "3px 8px", 
                                borderRadius: "6px", 
                                fontSize: "0.72rem", 
                                fontWeight: 700, 
                                background: stage.bgColor, 
                                color: stage.badgeColor, 
                                border: `1px solid ${stage.borderColor}`,
                                whiteSpace: "nowrap",
                                display: "inline-block"
                              }}
                            >
                              {stage.label}
                            </span>
                          </td>

                          {/* Purchaser */}
                          <td style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                            {getPurchaserName(r)}
                          </td>

                          {/* Required By */}
                          <td style={{ fontSize: "0.82rem", color: "#c084fc", fontWeight: 600 }}>
                            {r.entryBy || r.requestedBy || "Requester"}
                          </td>

                          {/* Vendor */}
                          <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{vName}</td>

                          {/* Order Date */}
                          <td style={{ whiteSpace: "nowrap" }}>{r.orderDate}</td>

                          {/* Type */}
                          <td>
                            <span className="badge badge-cargo" style={{ fontSize: "0.74rem" }}>{r.type}</span>
                          </td>

                          {/* Model */}
                          <td style={{ fontWeight: 700, color: "var(--text-main)", maxWidth: "220px" }}>
                            <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={r.model}>
                              {r.model}
                            </div>
                            {r.category && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{r.category}</div>
                            )}
                          </td>

                          {/* Qty */}
                          <td style={{ fontWeight: 700 }}>{qty.toLocaleString()}</td>

                          {/* Price RMB */}
                          <td style={{ fontWeight: 600, color: "#f59e0b" }}>
                            {price > 0 ? `¥${price.toFixed(2)}` : "—"}
                          </td>

                          {/* Total RMB */}
                          <td style={{ fontWeight: 800, color: "#f59e0b" }}>
                            {totalRmb > 0 ? `¥${Math.round(totalRmb).toLocaleString()}` : "—"}
                          </td>

                          {/* Vendor EDD */}
                          <td style={{ whiteSpace: "nowrap" }}>{r.vendorEdd || "—"}</td>
                          
                          {/* Cargo Columns */}
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {cargo?.cargoOrderDate || "—"}
                          </td>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cargo?.cargoDetail}>
                            {cargo?.cargoDetail || r.cargoId || "—"}
                          </td>
                          <td>
                            {cargo?.modeOfTransport ? (
                              <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--primary)" }}>{cargo.modeOfTransport}</span>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{cargo?.cargoShippingDate || "—"}</td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{cargo?.cargoEta || "—"}</td>
                          
                          {/* Purchase Updated badge */}
                          <td>
                            <span className={`badge ${r.purchaseUpdated === "Yes" ? "badge-received" : "badge-pending"}`} style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                              {r.purchaseUpdated === "Yes" ? "Yes" : "No"}
                            </span>
                          </td>

                          {/* Material Rec */}
                          <td>
                            <span style={{ fontWeight: 700, fontSize: "0.78rem", color: r.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>
                              {r.isMaterialRec}
                            </span>
                          </td>

                          {/* Cargo Documents */}
                          <td>
                            {cargo && (cargo.packingListFile || cargo.invoiceFile || cargo.cargoReceiptFile) ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                {cargo.packingListFile && (
                                  <button
                                    type="button"
                                    onClick={() => downloadOrOpenBlob(cargo.packingListData, cargo.packingListFile)}
                                    className="doc-link"
                                    style={{ background: "none", border: "none", padding: 0, cursor: cargo.packingListData ? "pointer" : "default", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--primary)", textDecoration: cargo.packingListData ? "underline" : "none" }}
                                    title={cargo.packingListData ? `Open ${cargo.packingListFile}` : cargo.packingListFile}
                                  >
                                    📄 PL: {cargo.packingListFile.length > 11 ? `${cargo.packingListFile.substring(0, 9)}...` : cargo.packingListFile}
                                  </button>
                                )}
                                {cargo.invoiceFile && (
                                  <button
                                    type="button"
                                    onClick={() => downloadOrOpenBlob(cargo.invoiceData, cargo.invoiceFile)}
                                    className="doc-link"
                                    style={{ background: "none", border: "none", padding: 0, cursor: cargo.invoiceData ? "pointer" : "default", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--primary)", textDecoration: cargo.invoiceData ? "underline" : "none" }}
                                    title={cargo.invoiceData ? `Open ${cargo.invoiceFile}` : cargo.invoiceFile}
                                  >
                                    📄 INV: {cargo.invoiceFile.length > 11 ? `${cargo.invoiceFile.substring(0, 9)}...` : cargo.invoiceFile}
                                  </button>
                                )}
                                {cargo.cargoReceiptFile && (
                                  <button
                                    type="button"
                                    onClick={() => downloadOrOpenBlob(cargo.cargoReceiptData, cargo.cargoReceiptFile)}
                                    className="doc-link"
                                    style={{ background: "none", border: "none", padding: 0, cursor: cargo.cargoReceiptData ? "pointer" : "default", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--primary)", textDecoration: cargo.cargoReceiptData ? "underline" : "none" }}
                                    title={cargo.cargoReceiptData ? `Open ${cargo.cargoReceiptFile}` : cargo.cargoReceiptFile}
                                  >
                                    📄 CR: {cargo.cargoReceiptFile.length > 11 ? `${cargo.cargoReceiptFile.substring(0, 9)}...` : cargo.cargoReceiptFile}
                                  </button>
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
        </>
      )}

      {/* ==================== GLOBAL ORDER INSPECTION MODAL ==================== */}
      {inspectedOrder && (
        <OrderInspectionModal
          order={inspectedOrder}
          cargos={cargos}
          vendors={vendors}
          purchasers={purchasers}
          cargoCompanies={cargoCompanies}
          onClose={() => setInspectedOrder(null)}
        />
      )}

    </div>
  );
}
