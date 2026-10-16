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
import CargoDocumentModal from "./CargoDocumentModal";
import { useSortableData } from "../utils/useSortableData";
import { getPurchaserDisplayName, downloadOrOpenBlob, getCurrencySymbol, calculateTotalCargoPrice, calculateBillSlaStatus } from "../utils/formatters";

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
  onUpdateCargo,
  onLogout 
}) {
  const getPurchaserName = (r) => getPurchaserDisplayName(r, purchasers);

  const [workflowStep, setWorkflowStep] = useState(() => {
    return localStorage.getItem("makpower_rahul_step") || "step1";
  });

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("makpower_rahul_tab") || "pending";
  });

  const [transitStatusFilter, setTransitStatusFilter] = useState("all");
  const [step2Filter, setStep2Filter] = useState("pending"); // "pending" | "overdue" | "due_today" | "awaiting_material" | "verified" | "all"
  const [step2Search, setStep2Search] = useState("");

  useEffect(() => {
    localStorage.setItem("makpower_rahul_step", workflowStep);
  }, [workflowStep]);

  useEffect(() => {
    localStorage.setItem("makpower_rahul_tab", activeTab);
  }, [activeTab]);

  // Inspection modal state
  const [inspectedOrder, setInspectedOrder] = useState(null);
  // Cargo Document Modal state
  const [viewingCargoDoc, setViewingCargoDoc] = useState(null);

  const handleOpenDocument = (cargo, docType, fileName, fileData, field, dataField) => {
    if (!fileName) return;
    let effectiveData = fileData;
    if (!effectiveData && docType?.toLowerCase().includes("packing")) {
      const match = (requests || []).find(r => r.cargoId === cargo?.id && r.itemPackingListData);
      if (match) {
        effectiveData = match.itemPackingListData;
      }
    }
    setViewingCargoDoc({
      cargo,
      docType,
      fileName,
      fileData: effectiveData || "",
      field,
      dataField,
      isMissing: !effectiveData
    });
  };

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
    const pendingPriced = eligiblePriced.filter(r => r.purchaseUpdated !== "Yes");
    const pendingMarkCount = pendingPriced.length;
    const markedCount = eligiblePriced.filter(r => r.purchaseUpdated === "Yes").length;

    // Calculate total cargo freight committed for pending mark purchases
    const pendingCargoSeen = new Set();
    let pendingCargoPriceTotal = 0;
    pendingPriced.forEach(r => {
      const c = cargos.find(x => x.id === r.cargoId || (r.cargoId && x.cargoDetail === r.cargoId));
      if (c && !pendingCargoSeen.has(c.id)) {
        pendingCargoSeen.add(c.id);
        pendingCargoPriceTotal += calculateTotalCargoPrice(c);
      } else if (!c && (r.totalCargoPrice || r.cargoPrice)) {
        pendingCargoPriceTotal += calculateTotalCargoPrice(r);
      }
    });

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
      pendingCargoPriceTotal,
      upcomingShipmentsCount
    };
  }, [activeRequests, cargos]);

  // In-transit cargos strictly (excluding delivered/received cargos and completed cargos)
  const inTransitCargos = useMemo(() => {
    return (cargos || []).filter(c => {
      const isDelivered = c.isMaterialRec === "Yes" || c.status === "Delivered" || c.status === "Received";
      if (isDelivered) return false;
      const cargoItems = (requests || []).filter(r => r.cargoId === c.id && r.status !== "Cancelled");
      if (cargoItems.length > 0 && cargoItems.every(it => it.isMaterialRec === "Yes")) {
        return false;
      }
      return true;
    });
  }, [cargos, requests]);

  // All cargos where vendor bill is uploaded by purchaser (Step 2 Scope)
  const billCargos = useMemo(() => {
    return (cargos || []).filter(c => Boolean(c.invoiceFile));
  }, [cargos]);

  // SLA stats calculated with Sunday exclusion and 2 scenarios across all uploaded bills
  const billVerificationStats = useMemo(() => {
    let pendingCount = 0;
    let overdueCount = 0;
    let dueTodayCount = 0;
    let awaitingMaterialCount = 0;
    let verifiedCount = 0;

    billCargos.forEach(c => {
      const sla = calculateBillSlaStatus(c);
      if (sla.isVerified) {
        verifiedCount++;
      } else if (!sla.isMaterialReceived) {
        awaitingMaterialCount++;
      } else {
        pendingCount++;
        if (sla.isOverdue) overdueCount++;
        if (sla.isDueToday) dueTodayCount++;
      }
    });

    return {
      totalWithBills: billCargos.length,
      pendingCount,
      overdueCount,
      dueTodayCount,
      awaitingMaterialCount,
      verifiedCount
    };
  }, [billCargos]);

  // Handle Verify Bill action for Step 2
  const handleVerifyBill = async (cargoObj, newStatus = "verified") => {
    if (!onUpdateCargo) return;
    const isVerifying = newStatus === "verified";
    const now = new Date().toISOString();
    const updatedCargo = {
      ...cargoObj,
      billStatus: isVerifying ? "verified" : "pending_verification",
      billVerifiedAt: isVerifying ? now : "",
      billVerifiedBy: isVerifying ? (currentUser?.name || "Rahul Accounts") : ""
    };
    await onUpdateCargo(updatedCargo);
  };

  // Filtered cargos for Step 2 Bill Verification Board
  const filteredStep2Cargos = useMemo(() => {
    return billCargos.filter(c => {
      const sla = calculateBillSlaStatus(c);
      
      // Step 2 status filter
      if (step2Filter === "pending") {
        if (sla.isVerified || !sla.isMaterialReceived) return false;
      } else if (step2Filter === "overdue") {
        if (sla.isVerified || !sla.isOverdue) return false;
      } else if (step2Filter === "due_today") {
        if (sla.isVerified || !sla.isDueToday) return false;
      } else if (step2Filter === "awaiting_material") {
        if (sla.isVerified || sla.isMaterialReceived) return false;
      } else if (step2Filter === "verified") {
        if (!sla.isVerified) return false;
      }

      // Search filter
      if (step2Search.trim()) {
        const q = step2Search.toLowerCase();
        const vendor = vendors.find(v => v.id === c.vendorId);
        const matchCargoId = String(c.id || "").toLowerCase().includes(q);
        const matchVendor = String(vendor?.name || "").toLowerCase().includes(q);
        const matchBill = String(c.invoiceFile || "").toLowerCase().includes(q);
        const matchPL = String(c.packingListFile || "").toLowerCase().includes(q);
        const matchCarrier = String(c.cargoDetail || "").toLowerCase().includes(q);
        if (!matchCargoId && !matchVendor && !matchBill && !matchPL && !matchCarrier) return false;
      }

      return true;
    });
  }, [billCargos, step2Filter, step2Search, vendors]);

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
      const nameStr = cObj?.cargoDetail && cObj.cargoDetail !== cid ? ` [${cObj.cargoDetail}]` : "";
      return { value: cid, label: `${cid}${nameStr}` };
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
          onClick={() => { setWorkflowStep("transit"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: workflowStep === "transit" ? "1px solid #38bdf8" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
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
          onClick={() => { setWorkflowStep("masterorder"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: workflowStep === "masterorder" ? "1px solid #f59e0b" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
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
          onClick={() => { setWorkflowStep("masterorder"); }}
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
          onClick={() => { setWorkflowStep("masterorder"); }}
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

        {/* KPI 5: Step 1 Pending Ledger Mark Purchases */}
        <div 
          onClick={() => { setWorkflowStep("step1"); setActiveTab("pending"); setCheckedIds([]); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: workflowStep === "step1" ? "1px solid #ec4899" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📝 Step 1: Mark Purchases</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(236, 72, 153, 0.15)", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#ec4899" }}>
            {kpiStats.pendingMarkCount} <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>To Confirm</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
            <span>Marked: <strong>{kpiStats.markedCount}</strong></span>
            {kpiStats.pendingCargoPriceTotal > 0 && (
              <span style={{ color: "#10b981", fontWeight: 700 }} title="Total Cargo Freight Cost for Pending Mark Purchases">
                Cargo: ¥{Math.round(kpiStats.pendingCargoPriceTotal).toLocaleString()}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ==================== WORKFLOW STEP DROPDOWN SELECTOR ==================== */}
      <div className="glass-panel" style={{ padding: "14px 20px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Workflow Step:
          </div>
          <div style={{ minWidth: "360px", maxWidth: "480px" }}>
            <select
              value={workflowStep}
              onChange={e => {
                setWorkflowStep(e.target.value);
                if (e.target.value === "step1") setActiveTab("pending");
                setCheckedIds([]);
              }}
              className="form-control"
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(15, 23, 42, 0.9)",
                color: workflowStep === "step1" ? "#ec4899" : workflowStep === "step2" ? "#f59e0b" : "#38bdf8",
                border: `2px solid ${workflowStep === "step1" ? "rgba(236, 72, 153, 0.6)" : workflowStep === "step2" ? "rgba(245, 158, 11, 0.6)" : "rgba(56, 189, 248, 0.5)"}`,
                cursor: "pointer"
              }}
            >
              <option value="step1">Step 1: Mark Purchases (Ledger Entry) — ({pendingRequests.length} Pending)</option>
              <option value="step2">Step 2: Vendor Bill Verification &amp; Entry — ({billVerificationStats.pendingCount} Pending{billVerificationStats.overdueCount > 0 ? ` • ${billVerificationStats.overdueCount} OVERDUE!` : ""})</option>
              <option value="transit">In-Transit Cargo Tracking — ({inTransitCargos.length} Shipments)</option>
              <option value="masterorder">Master Order Tracker — (All 6 Stages)</option>
              <option value="create_order">Master Requisitions (View-Only)</option>
              <option value="itemmaster">Item Catalog &amp; Stock</option>
            </select>
          </div>
        </div>

        {/* Step Quick Switcher Tabs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => { setWorkflowStep("step1"); setActiveTab("pending"); setCheckedIds([]); }}
            className={`btn btn-sm ${workflowStep === "step1" ? "btn-primary" : "btn-secondary"}`}
            style={{ fontWeight: 700, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <Clock size={14} /> Step 1: Mark Purchases ({pendingRequests.length})
          </button>
          
          <button
            type="button"
            onClick={() => { setWorkflowStep("step2"); setCheckedIds([]); }}
            className={`btn btn-sm ${workflowStep === "step2" ? "btn-warning" : "btn-secondary"}`}
            style={{ 
              fontWeight: 700, 
              fontSize: "0.82rem", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "5px",
              color: workflowStep === "step2" ? "#000" : (billVerificationStats.overdueCount > 0 ? "#ef4444" : "#f59e0b"),
              borderColor: billVerificationStats.overdueCount > 0 ? "rgba(239, 68, 68, 0.5)" : "rgba(245, 158, 11, 0.4)"
            }}
          >
            <FileText size={14} /> Step 2: Verify Bills ({billVerificationStats.pendingCount})
            {billVerificationStats.overdueCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 800 }}>
                {billVerificationStats.overdueCount} OVERDUE
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setWorkflowStep("transit"); setCheckedIds([]); }}
            className={`btn btn-sm ${workflowStep === "transit" ? "btn-primary" : "btn-secondary"}`}
            style={{ fontWeight: 600, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "5px", color: workflowStep === "transit" ? "#fff" : "#38bdf8" }}
          >
            <Ship size={14} /> In-Transit ({inTransitCargos.length})
          </button>

          <button
            type="button"
            onClick={() => { setWorkflowStep("masterorder"); setCheckedIds([]); }}
            className={`btn btn-sm ${workflowStep === "masterorder" ? "btn-primary" : "btn-secondary"}`}
            style={{ fontWeight: 600, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "5px", color: workflowStep === "masterorder" ? "#fff" : "#f59e0b" }}
          >
            <Layers size={14} /> Master Tracker
          </button>
        </div>
      </div>

      {/* ==================== WORKFLOW: STEP 2 VENDOR BILL VERIFICATION WORKBOARD ==================== */}
      {workflowStep === "step2" && (
        <div className="card-fade-in">
          {/* Step 2 Header & Explanation Banner */}
          <div className="glass-panel" style={{ padding: "18px 22px", marginBottom: "18px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileText size={22} /> Step 2: Cargo Vendor Bill Verification &amp; Entry
                </h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "var(--text-muted)", lineHeight: 1.5, maxWidth: "880px" }}>
                  After cargo leaves from vendor, purchaser uploads the vendor bill. Rahul Accounts must verify and mark bill entry within <strong>3 working days (excluding Sunday)</strong> once material is received at the warehouse.
                </p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "10px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }}></span>
                    <strong>Scenario 1:</strong> Bill uploaded earlier $\rightarrow$ 3 working days from Material Receipt date (excl. Sunday)
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span>
                    <strong>Scenario 2:</strong> Material received earlier $\rightarrow$ 3 working days from Bill Upload date (excl. Sunday)
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#a855f7" }}></span>
                    <strong>In Transit:</strong> SLA timer paused until warehouse receives material
                  </span>
                </div>
              </div>

              {billVerificationStats.overdueCount > 0 && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", color: "#ef4444", fontWeight: 700, fontSize: "0.88rem" }}>
                  <AlertTriangle size={18} /> {billVerificationStats.overdueCount} Bill{billVerificationStats.overdueCount > 1 ? "s" : ""} Exceeded 3-Day SLA!
                </div>
              )}
            </div>
          </div>

          {/* Step 2 KPI Counters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <div 
              onClick={() => setStep2Filter("pending")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "pending" ? "1px solid #f59e0b" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>⏳ Pending Entry</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f59e0b", marginTop: "2px" }}>
                {billVerificationStats.pendingCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Material rec'd &amp; bill uploaded</div>
            </div>

            <div 
              onClick={() => setStep2Filter("overdue")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "overdue" ? "1px solid #ef4444" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>🚨 Overdue Alerts</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ef4444", marginTop: "2px" }}>
                {billVerificationStats.overdueCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>&gt; 3 days (excl. Sunday)</div>
            </div>

            <div 
              onClick={() => setStep2Filter("due_today")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "due_today" ? "1px solid #eab308" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>⚠️ Due Today</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#eab308", marginTop: "2px" }}>
                {billVerificationStats.dueTodayCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Expires end of today</div>
            </div>

            <div 
              onClick={() => setStep2Filter("awaiting_material")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "awaiting_material" ? "1px solid #38bdf8" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📦 Awaiting Material</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8", marginTop: "2px" }}>
                {billVerificationStats.awaitingMaterialCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>In transit (SLA paused)</div>
            </div>

            <div 
              onClick={() => setStep2Filter("verified")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "verified" ? "1px solid #10b981" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>✅ Verified Archive</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>
                {billVerificationStats.verifiedCount}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Entry completed</div>
            </div>

            <div 
              onClick={() => setStep2Filter("all")}
              className="glass-panel" 
              style={{ padding: "12px 16px", cursor: "pointer", border: step2Filter === "all" ? "1px solid var(--primary)" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>📑 All Uploaded Bills</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
                {billVerificationStats.totalWithBills}
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Total cargos with bill</div>
            </div>
          </div>

          {/* Step 2 Filter & Search Bar */}
          <div className="glass-panel" style={{ padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button 
                onClick={() => setStep2Filter("pending")}
                className={`btn btn-sm ${step2Filter === "pending" ? "btn-warning" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                Pending Entry ({billVerificationStats.pendingCount})
              </button>
              <button 
                onClick={() => setStep2Filter("overdue")}
                className={`btn btn-sm ${step2Filter === "overdue" ? "btn-danger" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                🚨 Overdue ({billVerificationStats.overdueCount})
              </button>
              <button 
                onClick={() => setStep2Filter("due_today")}
                className={`btn btn-sm ${step2Filter === "due_today" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                ⚠️ Due Today ({billVerificationStats.dueTodayCount})
              </button>
              <button 
                onClick={() => setStep2Filter("awaiting_material")}
                className={`btn btn-sm ${step2Filter === "awaiting_material" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                📦 In Transit / Awaiting Material ({billVerificationStats.awaitingMaterialCount})
              </button>
              <button 
                onClick={() => setStep2Filter("verified")}
                className={`btn btn-sm ${step2Filter === "verified" ? "btn-success" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                ✅ Verified ({billVerificationStats.verifiedCount})
              </button>
              <button 
                onClick={() => setStep2Filter("all")}
                className={`btn btn-sm ${step2Filter === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem" }}
              >
                Show All ({billVerificationStats.totalWithBills})
              </button>
            </div>

            <div style={{ position: "relative", minWidth: "240px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search cargo, vendor, or bill..."
                value={step2Search}
                onChange={e => setStep2Search(e.target.value)}
                className="form-control form-control-sm"
                style={{ paddingLeft: "30px", fontSize: "0.8rem", height: "32px" }}
              />
            </div>
          </div>

          {/* Cargo Cards with Bills */}
          {filteredStep2Cargos.length === 0 ? (
            <div className="glass-panel" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <FileText size={36} style={{ marginBottom: "10px", opacity: 0.5, color: "#f59e0b" }} />
              <h4 style={{ color: "var(--text-main)", marginBottom: "6px" }}>No Cargo Bills Found</h4>
              <p style={{ fontSize: "0.85rem", maxWidth: "500px", margin: "0 auto" }}>
                {step2Filter === "pending" 
                  ? "Great job! There are currently no pending vendor bills awaiting verification for received material."
                  : `No vendor bills match the current filter (${step2Filter}).`}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredStep2Cargos.map(cargo => {
                const sla = calculateBillSlaStatus(cargo);
                const vendor = vendors.find(v => v.id === cargo.vendorId);
                const carrierObj = cargoCompanies.find(cc => cc.id === cargo.cargoCompanyId);
                const carrierDisplay = carrierObj?.name || cargo.cargoDetail || "—";
                const cargoItems = requests.filter(r => r.cargoId === cargo.id && r.status !== "Cancelled");
                const totalCargoRmb = cargoItems.reduce((sum, it) => sum + (Number(it.totalRmb) || (Number(it.priceRmb || 0) * Number(it.orderQuantity || 0))), 0);
                const isVerified = sla.isVerified;

                return (
                  <div 
                    key={cargo.id} 
                    className="glass-panel card-fade-in" 
                    style={{ 
                      padding: "18px 20px", 
                      border: isVerified 
                        ? "1px solid rgba(16, 185, 129, 0.3)" 
                        : sla.isOverdue 
                        ? "1px solid rgba(239, 68, 68, 0.45)" 
                        : sla.isDueToday 
                        ? "1px solid rgba(245, 158, 11, 0.45)" 
                        : "1px solid var(--border-glass)",
                      boxShadow: sla.isOverdue ? "0 4px 14px rgba(239, 68, 68, 0.12)" : "none"
                    }}
                  >
                    {/* Cargo Header Info */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "14px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)" }}>
                            Cargo #{cargo.id}
                          </span>
                          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontSize: "0.75rem" }}>
                            {cargo.modeOfTransport || "Sea"} Transport
                          </span>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            Carrier: <strong style={{ color: "var(--text-main)" }}>{carrierDisplay}</strong>
                          </span>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                            Vendor: <strong style={{ color: "var(--text-main)" }}>{vendor?.name || cargo.vendorId || "—"}</strong>
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "6px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          <span>📅 Shipping Date: <strong style={{ color: "var(--text-main)" }}>{cargo.cargoShippingDate || "—"}</strong></span>
                          <span>🎯 ETA: <strong style={{ color: "#38bdf8" }}>{cargo.cargoEta || "—"}</strong></span>
                          <span>
                            🏢 Warehouse Receipt: {cargo.isMaterialRec === "Yes" ? (
                              <strong style={{ color: "#10b981" }}>✓ Received ({cargo.receivedDate || "Warehouse"})</strong>
                            ) : (
                              <strong style={{ color: "#38bdf8" }}>📦 In Freight Transit</strong>
                            )}
                          </span>
                          <span>📦 Bundled Items: <strong>{cargoItems.length} items</strong> (¥{Math.round(totalCargoRmb).toLocaleString()} RMB)</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {!isVerified ? (
                          <button
                            type="button"
                            onClick={() => handleVerifyBill(cargo, "verified")}
                            className="btn btn-success"
                            style={{ 
                              padding: "6px 16px", 
                              fontWeight: 700, 
                              fontSize: "0.85rem", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "6px",
                              boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)"
                            }}
                            title="Verify vendor bill and mark accounts entry"
                          >
                            <CheckCircle2 size={16} /> Verify Bill &amp; Mark Entry
                          </button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: "#10b981", fontWeight: 700, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={16} /> Verified by {cargo.billVerifiedBy || "Rahul Accounts"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleVerifyBill(cargo, "pending_verification")}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                              title="Undo verification"
                            >
                              <RotateCcw size={12} /> Undo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attached Documents Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                      
                      {/* Vendor Bill Card */}
                      <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: "6px" }}>
                          📄 Step 2 Attached Vendor Bill:
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDocument(cargo, "Vendor Bill (Invoice)", cargo.invoiceFile, cargo.invoiceData, "invoiceFile", "invoiceData")}
                            className="doc-link-btn"
                            style={{ 
                              background: "rgba(245, 158, 11, 0.15)", 
                              border: "1px solid rgba(245, 158, 11, 0.4)", 
                              padding: "4px 10px", 
                              borderRadius: "6px", 
                              cursor: "pointer", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "6px", 
                              color: "#f59e0b", 
                              fontSize: "0.85rem", 
                              fontWeight: 600 
                            }}
                            title={`Inspect bill ${cargo.invoiceFile}`}
                          >
                            <FileText size={15} /> {cargo.invoiceFile} <ExternalLink size={12} />
                          </button>

                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            By <strong>{cargo.billUploadedBy || "Purchaser"}</strong> {cargo.billUploadedAt ? `on ${new Date(cargo.billUploadedAt).toLocaleDateString()}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Packing List Card */}
                      <div style={{ padding: "12px 14px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: "6px" }}>
                          📊 Attached Packing List:
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                          {cargo.packingListFile ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(cargo, "Cargo Packing List", cargo.packingListFile, cargo.packingListData, "packingListFile", "packingListData")}
                              className="doc-link-btn"
                              style={{ 
                                background: "rgba(56, 189, 248, 0.15)", 
                                border: "1px solid rgba(56, 189, 248, 0.4)", 
                                padding: "4px 10px", 
                                borderRadius: "6px", 
                                cursor: "pointer", 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "6px", 
                                color: "#38bdf8", 
                                fontSize: "0.85rem", 
                                fontWeight: 600 
                              }}
                              title={`Inspect packing list ${cargo.packingListFile}`}
                            >
                              <FileSpreadsheet size={15} /> {cargo.packingListFile} <ExternalLink size={12} />
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>No packing list attached</span>
                          )}

                          {cargo.cargoReceiptFile && (
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(cargo, "Cargo Delivery Receipt", cargo.cargoReceiptFile, cargo.cargoReceiptData, "cargoReceiptFile", "cargoReceiptData")}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                            >
                              CR: {cargo.cargoReceiptFile}
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* SLA Status Box */}
                    <div style={{ 
                      padding: "10px 14px", 
                      borderRadius: "8px", 
                      background: isVerified 
                        ? "rgba(16, 185, 129, 0.08)" 
                        : sla.isOverdue 
                        ? "rgba(239, 68, 68, 0.1)" 
                        : !sla.isMaterialReceived 
                        ? "rgba(56, 189, 248, 0.08)" 
                        : "rgba(245, 158, 11, 0.08)",
                      border: isVerified 
                        ? "1px solid rgba(16, 185, 129, 0.25)" 
                        : sla.isOverdue 
                        ? "1px solid rgba(239, 68, 68, 0.35)" 
                        : !sla.isMaterialReceived 
                        ? "1px solid rgba(56, 189, 248, 0.28)" 
                        : "1px solid rgba(245, 158, 11, 0.35)",
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      flexWrap: "wrap", 
                      gap: "10px", 
                      fontSize: "0.84rem" 
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ 
                          padding: "3px 9px", 
                          borderRadius: "4px", 
                          fontSize: "0.76rem", 
                          fontWeight: 700,
                          background: isVerified 
                            ? "rgba(16, 185, 129, 0.2)" 
                            : sla.isOverdue 
                            ? "rgba(239, 68, 68, 0.22)" 
                            : !sla.isMaterialReceived 
                            ? "rgba(56, 189, 248, 0.18)" 
                            : "rgba(245, 158, 11, 0.2)",
                          color: isVerified ? "#10b981" : sla.isOverdue ? "#ef4444" : !sla.isMaterialReceived ? "#38bdf8" : "#f59e0b"
                        }}>
                          {isVerified 
                            ? `✅ Verified on ${new Date(cargo.billVerifiedAt).toLocaleDateString()}` 
                            : !sla.isMaterialReceived 
                            ? "📦 Waiting for Warehouse Material Receipt" 
                            : sla.isOverdue 
                            ? `🚨 OVERDUE by ${Math.abs(sla.daysRemaining)} working day${Math.abs(sla.daysRemaining) > 1 ? "s" : ""}! (Excl. Sunday)` 
                            : sla.isDueToday 
                            ? "⚠️ Due Today (3 Working Days Excl. Sunday)" 
                            : `⏱️ ${sla.daysRemaining} working day${sla.daysRemaining > 1 ? "s" : ""} left (Due: ${sla.deadlineFormatted}, Excl. Sunday)`}
                        </span>

                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          {sla.description}
                        </span>
                      </div>

                      {sla.scenario && (
                        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", background: "rgba(0,0,0,0.2)", padding: "2px 8px", borderRadius: "4px" }}>
                          {sla.scenarioLabel}
                        </span>
                      )}
                    </div>

                    {/* Bundled Items Accordion */}
                    <div style={{ marginTop: "12px" }}>
                      <details>
                        <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600, userSelect: "none" }}>
                          View Bundled Items in This Cargo ({cargoItems.length})
                        </summary>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                          {cargoItems.map(item => {
                            const unitPrice = Number(item.priceRmb) || 0;
                            const qty = Number(item.vendorOrderQuantity || item.orderQuantity) || 0;
                            const totalVal = Number(item.totalRmb) || (unitPrice * qty);

                            return (
                              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)", fontSize: "0.82rem", flexWrap: "wrap", gap: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => setInspectedOrder(item)}
                                    style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: 700, padding: 0, textDecoration: "underline" }}
                                  >
                                    {item.model}
                                  </button>
                                  <span style={{ color: "var(--text-muted)" }}>• Qty: <strong>{qty} pcs</strong></span>
                                  <span style={{ color: "var(--text-muted)" }}>• Order Date: <strong>{item.orderDate || "—"}</strong></span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <span style={{ color: "var(--text-muted)" }}>Unit: <strong style={{ color: "var(--text-main)" }}>¥{unitPrice}</strong></span>
                                  <span style={{ color: "#10b981", fontWeight: 700 }}>Total: ¥{totalVal.toLocaleString()}</span>
                                  <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "4px", background: item.purchaseUpdated === "Yes" ? "rgba(16, 185, 129, 0.15)" : "rgba(236, 72, 153, 0.15)", color: item.purchaseUpdated === "Yes" ? "#10b981" : "#ec4899" }}>
                                    {item.purchaseUpdated === "Yes" ? "✓ Purchase Marked" : "⏳ Pending Purchase"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== WORKFLOW: IN-TRANSIT CARGO TRACKING ==================== */}
      {workflowStep === "transit" && (
        <div className="card-fade-in">
          <BundledUpcomingShipments 
            cargos={inTransitCargos}
            requests={requests.filter(r => r.isMaterialRec !== "Yes" && r.status !== "Cancelled")}
            vendors={vendors}
            cargoCompanies={cargoCompanies}
            purchasers={purchasers}
            currentUser={currentUser}
            isViewOnly={false}
            onBatchUpdateRequests={onBatchUpdateRequests}
            onUpdateCargo={onUpdateCargo}
            initialStatusFilter={transitStatusFilter}
          />
        </div>
      )}

      {/* ==================== WORKFLOW: MASTER ORDER TRACKER ==================== */}
      {workflowStep === "masterorder" && (
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

      {/* ==================== WORKFLOW: CREATE MASTER REQUISITION (VIEW ONLY) ==================== */}
      {workflowStep === "create_order" && (
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

      {/* ==================== WORKFLOW: ITEM CATALOG & STOCK ==================== */}
      {workflowStep === "itemmaster" && (
        <div className="card-fade-in">
          <ItemMasterView requests={requests} vendors={vendors} cargos={cargos} cargoCompanies={cargoCompanies} purchasers={purchasers} />
        </div>
      )}

      {/* ==================== WORKFLOW: STEP 1 MARK PURCHASES (ONLY STEP 1 RELATED WORK) ==================== */}
      {workflowStep === "step1" && (
        <div className="card-fade-in">
          {/* Step 1 Sub-Tab Switcher (Pending Confirmation vs Archive) */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px", flexWrap: "wrap" }}>
            <button 
              onClick={() => { setActiveTab("pending"); setCheckedIds([]); }} 
              className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Clock size={15} /> Pending Mark Purchases ({pendingRequests.length})
            </button>

            <button 
              onClick={() => { setActiveTab("submitted"); setCheckedIds([]); }} 
              className={`tab-btn ${activeTab === "submitted" ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <CheckCircle size={15} /> Marked in Ledger Archive ({submittedRequests.length})
            </button>
          </div>
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
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Cargo Batch / Name</label>
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
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span>(Total Goods: <strong style={{ color: "#f59e0b" }}>¥{Math.round(pendingRequests.filter(r => checkedIds.includes(r.id)).reduce((sum, r) => sum + ((r.orderQuantity || 0) * (r.priceRmb || 0)), 0)).toLocaleString()}</strong></span>
                    {(() => {
                      const selectedReqs = pendingRequests.filter(r => checkedIds.includes(r.id));
                      const seenCargoIds = new Set();
                      let cargoSum = 0;
                      selectedReqs.forEach(r => {
                        const c = cargos.find(x => x.id === r.cargoId || (r.cargoId && x.cargoDetail === r.cargoId));
                        if (c && !seenCargoIds.has(c.id)) {
                          seenCargoIds.add(c.id);
                          cargoSum += calculateTotalCargoPrice(c);
                        } else if (!c && (r.totalCargoPrice || r.cargoPrice)) {
                          cargoSum += calculateTotalCargoPrice(r);
                        }
                      });
                      return cargoSum > 0 ? (
                        <span>| Cargo Price: <strong style={{ color: "#10b981" }}>¥{Math.round(cargoSum).toLocaleString()}</strong></span>
                      ) : null;
                    })()}
                    <span>)</span>
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
                      <RenderSortHeader colKey="cargoDetail" title="Cargo Name / Code" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoDetail || r.cargoId || ""} />
                      <RenderSortHeader colKey="modeOfTransport" title="Transport" getValue={r => cargos.find(c => c.id === r.cargoId)?.modeOfTransport || ""} />
                      <RenderSortHeader colKey="cargoShippingDate" title="Ship Date" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoShippingDate || ""} />
                      <RenderSortHeader colKey="cargoEta" title="ETA" getValue={r => cargos.find(c => c.id === r.cargoId)?.cargoEta || ""} />
                      <RenderSortHeader 
                        colKey="cargoFreightPrice" 
                        title="Cargo Price" 
                        getValue={r => { 
                          const c = cargos.find(x => x.id === r.cargoId || (r.cargoId && x.cargoDetail === r.cargoId)); 
                          return calculateTotalCargoPrice(c, r); 
                        }} 
                      />
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
                          <td style={{ fontSize: "0.78rem", maxWidth: "160px" }} title={`Cargo Name: ${cargo?.cargoDetail || "—"} | Code: ${r.cargoId || "—"}`}>
                            {cargo?.cargoDetail ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--primary)" }}>{cargo.cargoDetail}</div>
                                {r.cargoId && r.cargoId !== cargo.cargoDetail && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "1px" }}>#{r.cargoId}</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>{r.cargoId || "—"}</span>
                            )}
                          </td>
                          <td>
                            {cargo?.modeOfTransport ? (
                              <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--primary)" }}>{cargo.modeOfTransport}</span>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{cargo?.cargoShippingDate || "—"}</td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{cargo?.cargoEta || "—"}</td>
                          
                          {/* Cargo Freight Price */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            {(() => {
                              const c = cargo || cargos.find(x => r.cargoId && x.cargoDetail === r.cargoId);
                              const total = calculateTotalCargoPrice(c, r);
                              const rate = c?.cargoPrice || r.cargoPrice;
                              const cur = c?.currency || r.currency || "RMB";
                              const uom = c?.cargoPriceUom || r.cargoPriceUom;
                              
                              if (total > 0 || rate) {
                                return (
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.82rem" }}>
                                      {total > 0 
                                        ? `${getCurrencySymbol(cur)}${Number(total).toLocaleString()}` 
                                        : `${getCurrencySymbol(cur)}${rate}`}
                                    </div>
                                    {rate && (
                                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                        Rate: {getCurrencySymbol(cur)}{rate} {uom ? `(${uom})` : ""}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>;
                            })()}
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
                                    onClick={() => handleOpenDocument(cargo, "Cargo Packing List", cargo.packingListFile, cargo.packingListData, "packingListFile", "packingListData")}
                                    className="doc-link"
                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--primary)", textDecoration: "underline" }}
                                    title={`Click to open or inspect ${cargo.packingListFile}`}
                                  >
                                    📄 PL: {cargo.packingListFile.length > 11 ? `${cargo.packingListFile.substring(0, 9)}...` : cargo.packingListFile}
                                  </button>
                                )}
                                {cargo.invoiceFile && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocument(cargo, "Vendor Bill (Invoice)", cargo.invoiceFile, cargo.invoiceData, "invoiceFile", "invoiceData")}
                                    className="doc-link"
                                    style={{ 
                                      background: "none", 
                                      border: "none", 
                                      padding: 0, 
                                      cursor: "pointer", 
                                      fontSize: "0.7rem", 
                                      display: "inline-flex", 
                                      alignItems: "center", 
                                      gap: "2px", 
                                      color: (cargo.billStatus === "verified" || cargo.billVerifiedAt) ? "#10b981" : "#f59e0b", 
                                      textDecoration: "underline" 
                                    }}
                                    title={`Click to open or inspect ${cargo.invoiceFile} • ${(cargo.billStatus === "verified" || cargo.billVerifiedAt) ? "Step 2 Verified" : "Pending Step 2 Verification"}`}
                                  >
                                    📄 INV: {cargo.invoiceFile.length > 11 ? `${cargo.invoiceFile.substring(0, 9)}...` : cargo.invoiceFile}
                                    {(cargo.billStatus === "verified" || cargo.billVerifiedAt) ? " ✓" : " ⏳"}
                                  </button>
                                )}
                                {cargo.cargoReceiptFile && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocument(cargo, "Cargo Delivery Receipt", cargo.cargoReceiptFile, cargo.cargoReceiptData, "cargoReceiptFile", "cargoReceiptData")}
                                    className="doc-link"
                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px", color: "var(--primary)", textDecoration: "underline" }}
                                    title={`Click to open or inspect ${cargo.cargoReceiptFile}`}
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
      </div>
    )}

      {/* ==================== GLOBAL ORDER INSPECTION MODAL ==================== */}
      {inspectedOrder && (
        <OrderInspectionModal
          order={inspectedOrder}
          cargos={cargos}
          vendors={vendors}
          purchasers={purchasers}
          cargoCompanies={cargoCompanies}
          requests={requests}
          onUpdateCargo={onUpdateCargo}
          onClose={() => setInspectedOrder(null)}
        />
      )}

      {/* ==================== CARGO DOCUMENT MODAL ==================== */}
      {viewingCargoDoc && (
        <CargoDocumentModal
          docInfo={viewingCargoDoc}
          onClose={() => setViewingCargoDoc(null)}
          onUpdateCargo={onUpdateCargo}
          bundledRequests={requests.filter(r => r.cargoId === viewingCargoDoc?.cargo?.id)}
        />
      )}

    </div>
  );
}
