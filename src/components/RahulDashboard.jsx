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
  ChevronRight,
  ChevronDown,
  Maximize2,
  FileSpreadsheet,
  Zap,
  Edit3,
  Plane
} from "lucide-react";
import ItemMasterView from "./ItemMasterView";
import BundledUpcomingShipments, { OrderInspectionModal } from "./BundledUpcomingShipments";
import MasterOrderTracker, { getOrderStage } from "./MasterOrderTracker";
import RequesterForm from "./RequesterForm";
import CustomSelect from "./CustomSelect";
import CargoDocumentModal from "./CargoDocumentModal";
import GroupedOrderModal from "./GroupedOrderModal";
import { EditCargoModal } from "./PurchaserDashboard";
import CargoRatesBreakdown from "./CargoRatesBreakdown";
import RahulDashboardLoading from "./RahulDashboardLoading";
import { useSortableData } from "../utils/useSortableData";
import { getPurchaserDisplayName, downloadOrOpenBlob, getCurrencySymbol, calculateTotalCargoPrice, calculateBillSlaStatus, calculateCargoTotalCartons, calculateItemCartons, formatPunchDateTime, isCargoMatch, resolveCargoVendorName } from "../utils/formatters";

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
  onDeleteCargo = null,
  onPurgeEmptyCargos = null,
  onCancelRequests,
  onReactivateRequests,
  onLogout,
  onOpenProfile = null,
  onRefreshData,
  onDirectPull,
  loading = false,
  initialLoadComplete = true,
  isMasterDataSilentlyLoading = false,
  initialTargetCargoId = null,
  dashboardMode = "rahul"
}) {
  const isNitin = dashboardMode === "nitin" || currentUser?.role === "nitin" || currentUser?.id === "u-nitin" || String(currentUser?.name || "").toLowerCase().includes("nitin");
  const storagePrefix = isNitin ? "makpower_nitin_" : "makpower_rahul_";
  const navEventName = isNitin ? "makpower_nitin_navigate" : "makpower_rahul_navigate";

  const getPurchaserName = (r) => getPurchaserDisplayName(r, purchasers);

  const [workflowStep, setWorkflowStep] = useState(() => {
    return localStorage.getItem(`${storagePrefix}step`) || "step1";
  });

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(`${storagePrefix}tab`) || "pending";
  });

  const [transitStatusFilter, setTransitStatusFilter] = useState("all");
  const [targetCargoId, setTargetCargoId] = useState(initialTargetCargoId || null);

  useEffect(() => {
    if (initialTargetCargoId) {
      setTargetCargoId(initialTargetCargoId);
      setTransitStatusFilter("all");
      setWorkflowStep("transit");
    }
  }, [initialTargetCargoId]);

  const handleNavigateToCargo = (stepKey, cargoId) => {
    setTargetCargoId(cargoId || null);
    setTransitStatusFilter("all");
    setWorkflowStep("transit");
  };

  const [step2Filter, setStep2Filter] = useState("pending"); // "pending" | "overdue" | "due_today" | "awaiting_material" | "verified" | "all"
  const [step2Search, setStep2Search] = useState("");

  useEffect(() => {
    localStorage.setItem(`${storagePrefix}step`, workflowStep);
  }, [workflowStep, storagePrefix]);

  useEffect(() => {
    localStorage.setItem(`${storagePrefix}tab`, activeTab);
  }, [activeTab, storagePrefix]);

  // Handle direct navigation events from notifications (e.g. Cancelled orders)
  useEffect(() => {
    try { localStorage.removeItem(`${storagePrefix}stage_filter`); } catch(e) {}
    const handleNav = (e) => {
      if (e.detail?.stage) setFilterStage(e.detail.stage);
      if (e.detail?.quickStatus) setQuickStatus(e.detail.quickStatus);
      if (e.detail?.step) setWorkflowStep(e.detail.step);
      if (e.detail?.stage === "cancelled" || e.detail?.quickStatus === "cancelled") {
        setFilterVendor("");
        setFilterPurchaser("");
        setFilterCategory("");
        setFilterCargo("");
        setFilterTransport("");
        setSearchQuery("");
        setFromDate("");
        setToDate("");
      }
    };
    window.addEventListener(navEventName, handleNav);
    if (!isNitin) window.addEventListener("makpower_rahul_navigate", handleNav);
    return () => {
      window.removeEventListener(navEventName, handleNav);
      if (!isNitin) window.removeEventListener("makpower_rahul_navigate", handleNav);
    };
  }, [navEventName, isNitin, storagePrefix]);

  // Inspection modal state
  const [inspectedOrder, setInspectedOrder] = useState(null);
  // Cargo Document Modal state
  const [viewingCargoDoc, setViewingCargoDoc] = useState(null);

  // Grouped Orders vs Flat Items View Mode (Default is "grouped" for clean readability)
  const [workboardViewMode, setWorkboardViewMode] = useState(() => {
    return localStorage.getItem(`${storagePrefix}view_mode`) || "grouped";
  });
  useEffect(() => {
    localStorage.setItem(`${storagePrefix}view_mode`, workboardViewMode);
  }, [workboardViewMode, storagePrefix]);

  // Collapsed by default - tracks which group rows are expanded inline
  const [expandedGroupKeys, setExpandedGroupKeys] = useState({});

  // Grouped Order Modal popup state - opens full order in dedicated window on click
  const [selectedOrderGroup, setSelectedOrderGroup] = useState(null);

  const handleOpenDocument = (cargo, docType, fileName, fileData, field, dataField) => {
    let effectiveFileName = fileName;
    if (!effectiveFileName) {
      if (docType?.toLowerCase().includes("receipt") || field?.toLowerCase().includes("receipt")) {
        effectiveFileName = "CargoReceipt.pdf";
      } else if (docType?.toLowerCase().includes("invoice") || docType?.toLowerCase().includes("bill") || field?.toLowerCase().includes("invoice")) {
        effectiveFileName = "Invoice.pdf";
      } else if (docType?.toLowerCase().includes("packing") || field?.toLowerCase().includes("packing")) {
        effectiveFileName = "PackingList.xlsx";
      } else {
        effectiveFileName = "Document.pdf";
      }
    }
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
      fileName: effectiveFileName,
      fileData: effectiveData || "",
      field,
      dataField,
      isMissing: !effectiveData
    });
  };

  // Multi-Level Filtration States
  const [quickStatus, setQuickStatus] = useState("all"); // "all" | "coming" | "pipeline" | "delivered" | "pending_mark" | "marked" | "cancelled"
  const [filterStage, setFilterStage] = useState(() => {
    return localStorage.getItem(`${storagePrefix}stage_filter`) || "all";
  });
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

  // Adaptive Stage-Aware Grouping: In-Transit / Cargo Shipments vs Vendor Order Lots
  const isTransitStage = useMemo(() => {
    return (
      filterStage === "pickedup" ||
      filterStage === "cargo" ||
      filterStage === "consolidated" ||
      filterStage === "received" ||
      quickStatus === "coming" ||
      quickStatus === "delivered" ||
      Boolean(filterCargo) ||
      Boolean(filterTransport)
    );
  }, [filterStage, quickStatus, filterCargo, filterTransport]);

  const [groupingTypeOverride, setGroupingTypeOverride] = useState(null); // null (auto-detect from stage) | "cargo" | "vendor"
  const activeGroupingMode = groupingTypeOverride || (isTransitStage ? "cargo" : "vendor");
  const [editingCargo, setEditingCargo] = useState(null);

  // Selection check for marking purchases
  const [checkedIds, setCheckedIds] = useState([]);

  const isRequestCancelled = (r) => {
    if (!r) return false;
    const st = String(r.status || "").trim().toLowerCase();
    return st === "cancelled" || Boolean(r.cancelledAt) || (Boolean(r.cancellationReason) && st !== "active");
  };

  const cancelledRequestsCount = useMemo(() => {
    return (requests || []).filter(isRequestCancelled).length;
  }, [requests]);

  // Active non-cancelled requests
  const activeRequests = useMemo(() => (requests || []).filter(r => !isRequestCancelled(r)), [requests]);

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

      const cargo = cargos.find(c => isCargoMatch(r.cargoId, c));
      const isDelivered = r.isMaterialRec === "Yes" || cargo?.isMaterialRec === "Yes" || Boolean(cargo?.receivedDate) || cargo?.status === "Received" || cargo?.status === "Delivered";
      const isInTransit = !isDelivered && Boolean(r.cargoPickupDate || cargo?.cargoShippingDate || r.cargoId);
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

    // Eligible for marking: priced and assigned vendor for Rahul, or all active non-cancelled for Nitin
    const eligibleForMarking = isNitin 
      ? activeRequests 
      : activeRequests.filter(r => r.priceRmb && r.vendorId);
    const pendingForMarking = eligibleForMarking.filter(r => isNitin ? (r.packingOrderedByNitin !== "Yes") : (r.purchaseUpdated !== "Yes"));
    const pendingMarkCount = pendingForMarking.length;
    const markedCount = eligibleForMarking.filter(r => isNitin ? (r.packingOrderedByNitin === "Yes") : (r.purchaseUpdated === "Yes")).length;

    // Calculate total cargo freight committed for pending mark purchases
    const pendingCargoSeen = new Set();
    let pendingCargoPriceTotal = 0;
    pendingForMarking.forEach(r => {
      const c = cargos.find(x => x.id === r.cargoId || (r.cargoId && x.cargoDetail === r.cargoId));
      if (c && !pendingCargoSeen.has(c.id)) {
        pendingCargoSeen.add(c.id);
        pendingCargoPriceTotal += calculateTotalCargoPrice(c);
      } else if (!c && (r.totalCargoPrice || r.cargoPrice)) {
        pendingCargoPriceTotal += calculateTotalCargoPrice(r);
      }
    });

    // Upcoming bundled shipments count (strictly excluding empty ghost cargos with 0 items)
    const upcomingShipmentsCount = cargos.filter(c => {
      if (c.status === "Delivered" || c.isMaterialRec === "Yes" || c.isDelivered === "Yes") return false;
      const cargoItems = (requests || []).filter(r => (r.cargoId === c.id || (r.cargoId && c.cargoDetail === r.cargoId)) && r.status !== "Cancelled");
      return cargoItems.length > 0;
    }).length;

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
  }, [activeRequests, cargos, requests, isNitin]);

  // In-transit cargos strictly (excluding delivered/received cargos and empty ghost cargos with 0 items)
  const inTransitCargos = useMemo(() => {
    return (cargos || []).filter(c => {
      const isDelivered = c.isMaterialRec === "Yes" || c.status === "Delivered" || c.status === "Received";
      if (isDelivered) return false;
      const cargoItems = (requests || []).filter(r => (r.cargoId === c.id || (r.cargoId && c.cargoDetail === r.cargoId)) && r.status !== "Cancelled");
      if (cargoItems.length === 0) return false; // Filter out empty ghost cargos with 0 items
      if (cargoItems.every(it => it.isMaterialRec === "Yes")) {
        return false;
      }
      return true;
    });
  }, [cargos, requests]);

  // All cargos where vendor bill is uploaded by purchaser (Step 2 Scope - strictly with items)
  const billCargos = useMemo(() => {
    return (cargos || []).filter(c => {
      const cargoItems = (requests || []).filter(r => (r.cargoId === c.id || (r.cargoId && c.cargoDetail === r.cargoId)) && r.status !== "Cancelled");
      if (cargoItems.length === 0) return false; // Empty cargos with 0 items should not appear on bill board
      return Boolean(c.invoiceFile && c.invoiceData);
    });
  }, [cargos, requests]);

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

  const isLookingForCancelled = filterStage === "cancelled" || quickStatus === "cancelled";

  // Filter requests: all active requests across the pipeline (or cancelled items when specifically filtering for cancelled)
  const eligibleRequests = useMemo(() => {
    return (requests || []).filter(r => {
      if (!r) return false;
      if (isLookingForCancelled) return isRequestCancelled(r);
      return !isRequestCancelled(r);
    });
  }, [requests, isLookingForCancelled]);

  const isItemMarked = (r) => isNitin ? (r.packingOrderedByNitin === "Yes") : (r.purchaseUpdated === "Yes");

  // Partitioned requests for Mark Purchases / Packing Purchased
  const pendingRequests = useMemo(() => eligibleRequests.filter(r => !isItemMarked(r)), [eligibleRequests, isNitin]);
  const submittedRequests = useMemo(() => eligibleRequests.filter(r => isItemMarked(r)), [eligibleRequests, isNitin]);

  // Active requests for the current tab:
  // When looking for cancelled orders, look across eligible requests.
  // When on "pending" tab, base is pendingRequests.
  // When on "submitted" tab, base is submittedRequests.
  const currentTabRequests = useMemo(() => {
    if (isLookingForCancelled) return eligibleRequests;
    if (quickStatus === "pending_mark") return pendingRequests;
    if (quickStatus === "marked") return submittedRequests;
    return activeTab === "pending" ? pendingRequests : submittedRequests;
  }, [isLookingForCancelled, eligibleRequests, quickStatus, activeTab, pendingRequests, submittedRequests]);

  // Multi-Level Filtered Requests
  const filteredRequests = useMemo(() => {
    return currentTabRequests.filter(r => {
      const cargo = cargos.find(c => isCargoMatch(r.cargoId, c));
      const stage = getOrderStage(r, cargo);
      const isDelivered = stage.key === "received" || r.isMaterialRec === "Yes" || cargo?.isMaterialRec === "Yes" || Boolean(cargo?.receivedDate);

      // 1. Quick Status Chip Filter
      if (quickStatus === "coming") {
        const isComing = stage.key === "pickedup" || stage.key === "cargo" || stage.key === "consolidated" || stage.key === "vendorready";
        if (!isComing) return false;
      } else if (quickStatus === "pipeline") {
        const inPipeline = !isDelivered && !isRequestCancelled(r);
        if (!inPipeline) return false;
      } else if (quickStatus === "delivered") {
        if (!isDelivered) return false;
      } else if (quickStatus === "pending_mark") {
        if (isItemMarked(r)) return false;
      } else if (quickStatus === "marked") {
        if (!isItemMarked(r)) return false;
      } else if (quickStatus === "cancelled") {
        if (!isRequestCancelled(r)) return false;
      }

      // 2. Stage Filter ("Where Item Is Now")
      if (filterStage !== "all") {
        const matchesStage = stage.key === filterStage || 
          (filterStage === "consolidated" && stage.key === "cargo") ||
          (filterStage === "cargo" && stage.key === "consolidated");
        if (!matchesStage) return false;
      }

      // 3. Vendor Filter
      if (filterVendor) {
        const selectedVendorObj = allVendorsWithCounts.find(v => v.value === filterVendor || v.rawName === filterVendor);
        const targetId = selectedVendorObj?.value || filterVendor;
        const targetName = (selectedVendorObj?.rawName || filterVendor).trim().toLowerCase();
        const rVId = r.vendorId || "";
        const rVName = (r.vendorName || "").trim().toLowerCase();

        const match = rVId === targetId || (targetName && rVName === targetName) || (targetId && rVName === targetId.trim().toLowerCase());
        if (!match) {
          return false;
        }
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
      if (filterCargo) {
        const cObj = cargos.find(c => isCargoMatch(r.cargoId, c));
        const rCargoDetail = (cObj?.cargoDetail || "").toLowerCase().trim();
        const rCarrier = (cObj?.carrierName || "").toLowerCase().trim();
        const filterLower = filterCargo.toLowerCase().trim();

        const matches = r.cargoId === filterCargo ||
                        (rCargoDetail && rCargoDetail === filterLower) ||
                        (rCarrier && rCarrier === filterLower) ||
                        (r.vendorName && `${r.vendorName.toLowerCase().trim()} cargo` === filterLower);
        if (!matches) {
          return false;
        }
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
  }, [currentTabRequests, quickStatus, filterStage, filterVendor, filterPurchaser, filterCargo, filterTransport, filterCategory, filterType, dateField, fromDate, toDate, searchQuery, cargos, vendors, purchasers, isNitin, allVendorsWithCounts]);

  const { items: sortedDisplayRequests, RenderSortHeader } = useSortableData(filteredRequests);

  // Group filtered requests by Cargo Shipment (In-Transit stages) OR Vendor Order Lot (Production stages)
  const groupedOrders = useMemo(() => {
    const map = new Map();

    if (activeGroupingMode === "cargo") {
      filteredRequests.forEach(r => {
        const cId = r.cargoId || "unassigned_cargo";
        const groupKey = cId;

        if (!map.has(groupKey)) {
          const isUnassigned = cId === "unassigned_cargo";
          const cargoObj = isUnassigned ? null : (cargos.find(c => isCargoMatch(cId, c)) || cargos.find(c => c.id === cId || (cId && c.cargoDetail === cId)));
          const companyObj = cargoCompanies.find(cc => cc.id === cargoObj?.cargoCompanyId);
          let cargoDetail = isUnassigned ? "Pending Cargo Consolidation (Unassigned)" : "";
          if (!isUnassigned) {
            if (cargoObj?.cargoDetail && !cargoObj.cargoDetail.startsWith("cargo-")) {
              cargoDetail = cargoObj.cargoDetail;
            } else if (companyObj?.name) {
              cargoDetail = companyObj.name;
            } else if (cargoObj?.carrierName && cargoObj.carrierName !== "—") {
              cargoDetail = cargoObj.carrierName;
            } else if (cId && !cId.startsWith("cargo-")) {
              cargoDetail = cId;
            } else if (r.vendorName) {
              cargoDetail = `${r.vendorName} Cargo`;
            } else {
              cargoDetail = `Cargo #${cId.slice(-6)}`;
            }
          }
          const carrierName = isUnassigned
            ? "—"
            : (companyObj?.name || cargoObj?.carrierName || "Direct Logistics Carrier");
          const modeOfTransport = isUnassigned
            ? "—"
            : (cargoObj?.modeOfTransport || r.modeOfTransport || "Sea Freight");
          const cargoShippingDate = cargoObj?.cargoShippingDate || r.cargoShippingDate || "—";
          const cargoEta = cargoObj?.cargoEta || r.cargoEta || "—";
          const cargoOrderDate = cargoObj?.cargoOrderDate || "—";

          map.set(groupKey, {
            groupKey,
            groupType: "cargo",
            cargoId: isUnassigned ? "" : cId,
            isUnassigned,
            cargoObj,
            cargoDetail,
            carrierName,
            modeOfTransport,
            cargoShippingDate,
            cargoEta,
            cargoOrderDate,
            items: [],
            totalQty: 0,
            totalGoodsRmb: 0,
            calcCartons: 0,
            vendorIds: new Set(),
            purchaserNames: new Set(),
            categories: new Set(),
            models: [],
            stageCounts: {}
          });
        }

        const grp = map.get(groupKey);
        grp.items.push(r);

        const qty = parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0;
        const price = parseFloat(r.priceRmb) || 0;
        grp.totalQty += qty;
        grp.totalGoodsRmb += qty * price;

        const ipc = parseInt(r.itemsPerCarton, 10);
        const ctns = r.totalCartons || (ipc > 0 ? Math.ceil(qty / ipc) : 0);
        grp.calcCartons += ctns;

        if (r.vendorId) grp.vendorIds.add(r.vendorId);
        const pName = getPurchaserName(r);
        if (pName) grp.purchaserNames.add(pName);
        if (r.category) grp.categories.add(r.category);
        if (r.model && !grp.models.includes(r.model)) grp.models.push(r.model);

        const cargo = grp.cargoObj || cargos.find(c => isCargoMatch(r.cargoId, c));
        const stage = getOrderStage(r, cargo);
        grp.stageCounts[stage.label] = (grp.stageCounts[stage.label] || 0) + 1;
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return Array.from(map.values()).map(grp => {
        const markedCount = grp.items.filter(isItemMarked).length;
        const pendingCount = grp.items.length - markedCount;
        const isAllMarked = grp.items.length > 0 && markedCount === grp.items.length;
        const isPartiallyMarked = markedCount > 0 && markedCount < grp.items.length;
        const isNoneMarked = markedCount === 0;

        // Total Cartons (prefer cargo object's totalCartons if available)
        const totalCartons = grp.cargoObj?.totalCartons != null && grp.cargoObj.totalCartons !== "" 
          ? parseInt(grp.cargoObj.totalCartons, 10) 
          : grp.calcCartons;

        // Cargo Freight Price & Rate per Piece
        let cargoFreightPrice = 0;
        if (grp.cargoObj) {
          cargoFreightPrice = calculateTotalCargoPrice(grp.cargoObj);
        } else {
          const matchItem = grp.items.find(it => it.totalCargoPrice || it.cargoPrice);
          if (matchItem) cargoFreightPrice = calculateTotalCargoPrice(matchItem);
        }
        const grandTotalRmb = grp.totalGoodsRmb + cargoFreightPrice;

        const cId = grp.cargoId;
        const allActiveCargoItems = (requests || []).filter(req => 
          (cId && (req.cargoId === cId || (grp.cargoObj?.cargoDetail && req.cargoId === grp.cargoObj.cargoDetail))) && 
          !isRequestCancelled(req)
        );
        const totalCargoAllPcs = allActiveCargoItems.reduce((sum, it) => sum + (parseInt(it.vendorOrderQuantity || it.orderQuantity, 10) || 0), 0);
        const allCargoMarkedCount = allActiveCargoItems.filter(isItemMarked).length;
        const allCargoPendingCount = allActiveCargoItems.length - allCargoMarkedCount;

        const cargoPricePerPc = totalCargoAllPcs > 0 && cargoFreightPrice > 0
          ? (cargoFreightPrice / totalCargoAllPcs)
          : (grp.totalQty > 0 && cargoFreightPrice > 0 ? (cargoFreightPrice / grp.totalQty) : 0);

        // Arrival Status & Countdown Badge
        let arrivalStatus = {
          label: grp.isUnassigned ? "Awaiting Cargo" : "In Transit",
          badgeColor: "#38bdf8",
          bgColor: "rgba(56, 189, 248, 0.12)",
          borderColor: "rgba(56, 189, 248, 0.3)",
          diffDays: null
        };

        const isDelivered = Boolean(grp.cargoObj?.actualReceivedDate || grp.cargoObj?.receivedDate || grp.cargoObj?.isMaterialRec === "Yes" || grp.items.every(it => it.isMaterialRec === "Yes" || grp.cargoObj?.isMaterialRec === "Yes" || Boolean(grp.cargoObj?.receivedDate)));
        if (isDelivered) {
          arrivalStatus = {
            label: "✅ Delivered",
            badgeColor: "#10b981",
            bgColor: "rgba(16, 185, 129, 0.15)",
            borderColor: "rgba(16, 185, 129, 0.35)",
            diffDays: 0
          };
        } else if (grp.cargoEta && grp.cargoEta !== "—") {
          const etaDate = new Date(grp.cargoEta);
          if (!isNaN(etaDate.getTime())) {
            const diffDays = Math.ceil((etaDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
              arrivalStatus = {
                label: `Overdue by ${Math.abs(diffDays)}d`,
                badgeColor: "#ef4444",
                bgColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.35)",
                diffDays
              };
            } else if (diffDays === 0) {
              arrivalStatus = {
                label: "Arriving Today!",
                badgeColor: "#f59e0b",
                bgColor: "rgba(245, 158, 11, 0.15)",
                borderColor: "rgba(245, 158, 11, 0.35)",
                diffDays: 0
              };
            } else if (diffDays === 1) {
              arrivalStatus = {
                label: "Arriving Tomorrow (1d)",
                badgeColor: "#f59e0b",
                bgColor: "rgba(245, 158, 11, 0.15)",
                borderColor: "rgba(245, 158, 11, 0.35)",
                diffDays: 1
              };
            } else {
              arrivalStatus = {
                label: `In Transit (${diffDays}d)`,
                badgeColor: "#10b981",
                bgColor: "rgba(16, 185, 129, 0.12)",
                borderColor: "rgba(16, 185, 129, 0.3)",
                diffDays
              };
            }
          }
        }

        // Distinct Vendors Summary
        let distinctVendorNames = Array.from(grp.vendorIds).map(id => {
          return vendors.find(v => v.id === id)?.name || id;
        }).filter(Boolean);
        if (distinctVendorNames.length === 0 && grp.cargoObj) {
          const resolved = resolveCargoVendorName(grp.cargoObj, vendors, requests);
          if (resolved && resolved !== "Unknown Vendor") {
            distinctVendorNames = [resolved];
          }
        }
        const vendorSummary = distinctVendorNames.length === 0
          ? "—"
          : (distinctVendorNames.length <= 2 ? distinctVendorNames.join(", ") : `${distinctVendorNames.slice(0, 2).join(", ")} +${distinctVendorNames.length - 2} more`);

        // Distinct Purchasers Summary
        const distinctPurchaserNames = Array.from(grp.purchaserNames).filter(Boolean);
        const purchaserSummary = distinctPurchaserNames.length === 0
          ? "—"
          : (distinctPurchaserNames.length <= 2 ? distinctPurchaserNames.join(", ") : `${distinctPurchaserNames.slice(0, 2).join(", ")} +${distinctPurchaserNames.length - 2} more`);

        const modelsSummary = grp.models.length > 0
          ? (grp.models.length <= 2 ? grp.models.join(", ") : `${grp.models.slice(0, 2).join(", ")} +${grp.models.length - 2} more`)
          : "—";

        const dominantStage = Object.entries(grp.stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

        // Cargo Documents
        const hasPackingList = Boolean(grp.cargoObj?.packingListFile || grp.cargoObj?.packingListFileName || grp.cargoObj?.packingList || grp.cargoObj?.packingListData || grp.items.some(it => it.itemPackingListData));
        const hasVendorBill = Boolean(grp.cargoObj?.invoiceFile || grp.cargoObj?.vendorBillFileName || grp.cargoObj?.vendorBill || grp.cargoObj?.invoiceData);
        const hasCargoReceipt = Boolean(grp.cargoObj?.cargoReceiptFile || grp.cargoObj?.cargoReceiptFileName || grp.cargoObj?.cargoReceipt || grp.cargoObj?.cargoReceiptData);

        return {
          ...grp,
          markedCount,
          pendingCount,
          isAllMarked,
          isPartiallyMarked,
          isNoneMarked,
          totalCartons,
          cargoFreightPrice,
          cargoPricePerPc,
          allCargoTotalItems: allActiveCargoItems.length || grp.items.length,
          allCargoMarkedCount,
          allCargoPendingCount,
          grandTotalRmb,
          arrivalStatus,
          arrivalDiffDays: arrivalStatus.diffDays ?? 9999,
          vendorSummary,
          distinctVendorNames,
          purchaserSummary,
          distinctPurchaserNames,
          modelsSummary,
          dominantStage,
          hasPackingList,
          hasVendorBill,
          hasCargoReceipt
        };
      });
    }

    // Otherwise: Group by Vendor + Order Date + Purchaser
    filteredRequests.forEach(r => {
      const vId = r.vendorId || "unassigned";
      const oDate = r.orderDate || "No Date";
      const pName = getPurchaserName(r) || "Unassigned Purchaser";
      const groupKey = `${vId}__${oDate}__${pName}`;

      if (!map.has(groupKey)) {
        const vendorObj = vendors.find(v => v.id === vId);
        const vendorName = vendorObj ? vendorObj.name : (r.vendorName || (vId === "unassigned" ? "Unassigned Vendor" : vId));
        
        map.set(groupKey, {
          groupKey,
          groupType: "vendor",
          vendorId: vId,
          vendorName,
          orderDate: oDate,
          purchaserName: pName,
          purchaserId: r.purchaserId || r.assignedPurchaser || "",
          items: [],
          totalQty: 0,
          totalRmb: 0,
          totalGoodsRmb: 0,
          grandTotalRmb: 0,
          totalCartons: 0,
          vendorEdds: new Set(),
          cargoIds: new Set(),
          categories: new Set(),
          models: [],
          stageCounts: {}
        });
      }

      const grp = map.get(groupKey);
      grp.items.push(r);

      const qty = parseInt(r.vendorOrderQuantity || r.orderQuantity, 10) || 0;
      const price = parseFloat(r.priceRmb) || 0;
      grp.totalQty += qty;
      grp.totalRmb += qty * price;
      grp.totalGoodsRmb += qty * price;
      grp.grandTotalRmb += qty * price;

      const ipc = parseInt(r.itemsPerCarton, 10);
      const ctns = r.totalCartons || (ipc > 0 ? Math.ceil(qty / ipc) : 0);
      grp.totalCartons += ctns;

      if (r.vendorEdd) grp.vendorEdds.add(r.vendorEdd);
      if (r.cargoId) grp.cargoIds.add(r.cargoId);
      if (r.category) grp.categories.add(r.category);
      if (r.model && !grp.models.includes(r.model)) grp.models.push(r.model);

      const cargo = cargos.find(c => isCargoMatch(r.cargoId, c));
      const stage = getOrderStage(r, cargo);
      grp.stageCounts[stage.label] = (grp.stageCounts[stage.label] || 0) + 1;
    });

    return Array.from(map.values()).map(grp => {
      const markedCount = grp.items.filter(isItemMarked).length;
      const pendingCount = grp.items.length - markedCount;
      const isAllMarked = grp.items.length > 0 && markedCount === grp.items.length;
      const isPartiallyMarked = markedCount > 0 && markedCount < grp.items.length;
      const isNoneMarked = markedCount === 0;

      const allActiveLotItems = (requests || []).filter(req => 
        req.vendorId === grp.vendorId && 
        req.orderDate === grp.orderDate && 
        !isRequestCancelled(req) &&
        (grp.purchaserId ? (req.purchaserId === grp.purchaserId || req.entryBy === grp.purchaserName) : true)
      );
      const allCargoMarkedCount = allActiveLotItems.filter(isItemMarked).length;
      const allCargoPendingCount = allActiveLotItems.length - allCargoMarkedCount;

      const eddArr = Array.from(grp.vendorEdds).filter(Boolean).sort();
      let eddDisplay = "—";
      if (eddArr.length === 1) {
        eddDisplay = eddArr[0];
      } else if (eddArr.length > 1) {
        eddDisplay = `${eddArr[0]} ~ ${eddArr[eddArr.length - 1]}`;
      }

      const modelsSummary = grp.models.length > 0
        ? (grp.models.length <= 2 ? grp.models.join(", ") : `${grp.models.slice(0, 2).join(", ")} +${grp.models.length - 2} more`)
        : "—";

      // Dominant stage
      const dominantStage = Object.entries(grp.stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      return {
        ...grp,
        markedCount,
        pendingCount,
        isAllMarked,
        isPartiallyMarked,
        isNoneMarked,
        allCargoTotalItems: allActiveLotItems.length || grp.items.length,
        allCargoMarkedCount,
        allCargoPendingCount,
        eddDisplay,
        modelsSummary,
        dominantStage
      };
    });
  }, [filteredRequests, activeGroupingMode, vendors, cargos, purchasers, cargoCompanies]);

  const { items: sortedGroupedOrders, RenderSortHeader: RenderGroupSortHeader } = useSortableData(groupedOrders);

  // Extract all vendors with active order quantities for Rahul Accounts
  const allVendorsWithCounts = useMemo(() => {
    const vMap = new Map();

    // 1. Add all vendors from master vendors table
    (vendors || []).forEach(v => {
      if (v && v.id) {
        vMap.set(v.id, { id: v.id, name: v.name || v.id });
      }
    });

    // 2. Also include any vendors present in requests
    (requests || []).forEach(r => {
      if (r.vendorId && !vMap.has(r.vendorId)) {
        vMap.set(r.vendorId, { id: r.vendorId, name: r.vendorName || r.vendorId });
      }
    });

    // 3. Also include any vendors present in cargos
    (cargos || []).forEach(c => {
      if (c.vendorId && !vMap.has(c.vendorId)) {
        vMap.set(c.vendorId, { id: c.vendorId, name: c.vendorName || c.vendorId });
      }
    });

    // Guarantee Livi is present in Rahul Accounts vendor list
    const hasLivi = Array.from(vMap.values()).some(v => v.name && v.name.trim().toLowerCase() === "livi");
    if (!hasLivi) {
      vMap.set("vend-livi", { id: "vend-livi", name: "Livi" });
    }

    const list = Array.from(vMap.values());
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return list.map(v => {
      const vNameLower = (v.name || "").trim().toLowerCase();
      // Count active (non-cancelled) orders for this vendor
      const activeCount = (requests || []).filter(r => {
        if (isRequestCancelled(r)) return false;
        const rVId = r.vendorId || "";
        const rVName = (r.vendorName || "").trim().toLowerCase();
        return rVId === v.id || (vNameLower && rVName === vNameLower) || (v.id && rVName === v.id.trim().toLowerCase());
      }).length;

      return {
        value: v.id,
        label: `${v.name} (${activeCount})`,
        rawName: v.name,
        count: activeCount,
        sublabel: activeCount === 1 ? "1 active order" : `${activeCount} active orders`
      };
    });
  }, [vendors, requests, cargos]);

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
    { value: "vendorready", label: "Ready at Vendor" },
    { value: "cargo", label: "Step 3: Cargo Consolidated" },
    { value: "pickedup", label: "Step 4: In Freight Transit" },
    { value: "received", label: "Step 5: Warehouse Received" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const vendorOptions = useMemo(() => {
    const totalActiveCount = (requests || []).filter(r => !isRequestCancelled(r)).length;
    return [
      { 
        value: "", 
        label: `All Vendors (${allVendorsWithCounts.length})`, 
        count: totalActiveCount, 
        sublabel: `${totalActiveCount} total active orders across all vendors` 
      },
      ...allVendorsWithCounts
    ];
  }, [allVendorsWithCounts, requests]);

  const purchaserOptions = useMemo(() => [
    { value: "", label: "All Purchasers" },
    ...uniquePurchasers.map(p => ({ value: p.name, label: p.name }))
  ], [uniquePurchasers]);

  const categoryOptions = useMemo(() => [
    { value: "", label: "All Categories" },
    ...uniqueCategories.map(cat => ({ value: cat, label: cat }))
  ], [uniqueCategories]);

  const cargoOptions = useMemo(() => {
    const nameMap = new Map();

    uniqueCargos.forEach(cid => {
      const cObj = cargos.find(c => isCargoMatch(cid, c)) || cargos.find(c => c.id === cid || c.cargoDetail === cid);
      let name = "";
      if (cObj?.cargoDetail && !cObj.cargoDetail.startsWith("cargo-")) {
        name = cObj.cargoDetail.trim();
      } else if (cargoCompanies.find(cc => cc.id === cObj?.cargoCompanyId)?.name) {
        name = cargoCompanies.find(cc => cc.id === cObj?.cargoCompanyId).name.trim();
      } else if (cObj?.carrierName && cObj.carrierName !== "—") {
        name = cObj.carrierName.trim();
      } else if (cid && !cid.startsWith("cargo-")) {
        name = cid.trim();
      } else if (cObj?.vendorName) {
        name = `${cObj.vendorName.trim()} Cargo`;
      } else {
        name = `Cargo #${cid.slice(-6)}`;
      }

      if (!nameMap.has(name)) {
        nameMap.set(name, { value: name, label: name });
      }
    });

    const sortedNames = Array.from(nameMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    return [
      { value: "", label: "All Cargo Names" },
      ...sortedNames
    ];
  }, [uniqueCargos, cargos, cargoCompanies]);

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
    const now = new Date().toISOString();
    const punchByName = currentUser?.name || (isNitin ? "Mr. Nitin (Packing)" : "Mr. Rahul Mann");
    const punchById = currentUser?.id || (isNitin ? "u-nitin" : "u-rahul");
    const targetPool = (requests && requests.length > 0) ? requests : pendingRequests;

    if (isNitin) {
      const updated = targetPool.filter(r => checkedIds.includes(r.id)).map(r => ({
        ...r,
        packingOrderedByNitin: "Yes",
        packingOrderedAt: now,
        packingOrderedBy: punchByName,
        packingOrderedById: punchById
      }));
      const modelsList = updated.map(r => r.model).filter(Boolean).join(", ");
      onBatchUpdateRequests(
        updated,
        "PACKING_ORDERED",
        `Nitin confirmed outer packing order for ${updated.length} item(s)${modelsList ? `: ${modelsList}` : ""}`
      );
    } else {
      const updated = targetPool.filter(r => checkedIds.includes(r.id)).map(r => ({
        ...r,
        purchaseUpdated: "Yes",
        purchaseUpdatedAt: now,
        purchaseUpdatedBy: punchByName,
        purchaseUpdatedById: punchById
      }));
      onBatchUpdateRequests(updated);
    }
    setCheckedIds([]);
  };

  const handleUnsubmitUpdate = () => {
    if (checkedIds.length === 0) return;
    const now = new Date().toISOString();
    const punchByName = currentUser?.name || (isNitin ? "Mr. Nitin (Packing)" : "Mr. Rahul Mann");
    const punchById = currentUser?.id || (isNitin ? "u-nitin" : "u-rahul");
    const targetPool = (requests && requests.length > 0) ? requests : submittedRequests;

    if (isNitin) {
      const updated = targetPool.filter(r => checkedIds.includes(r.id)).map(r => ({
        ...r,
        packingOrderedByNitin: "No",
        packingOrderedAt: "",
        packingOrderedBy: "",
        packingOrderedById: ""
      }));
      const modelsList = updated.map(r => r.model).filter(Boolean).join(", ");
      onBatchUpdateRequests(
        updated,
        "PACKING_UNORDERED",
        `Nitin reverted packing order for ${updated.length} item(s)${modelsList ? `: ${modelsList}` : ""}`
      );
    } else {
      const updated = targetPool.filter(r => checkedIds.includes(r.id)).map(r => ({
        ...r,
        purchaseUpdated: "No",
        purchaseUpdatedAt: "",
        purchaseUpdatedBy: "",
        purchaseUpdatedById: ""
      }));
      onBatchUpdateRequests(updated);
    }
    setCheckedIds([]);
  };

  // Group-wise and individual marking helper
  const handleMarkGroup = (groupOrItems, isMarked = true) => {
    const list = Array.isArray(groupOrItems) ? groupOrItems : (groupOrItems.items || []);
    if (list.length === 0) return;
    const now = new Date().toISOString();
    const punchByName = currentUser?.name || (isNitin ? "Mr. Nitin (Packing)" : "Mr. Rahul Mann");
    const punchById = currentUser?.id || (isNitin ? "u-nitin" : "u-rahul");

    if (isNitin) {
      const targets = isMarked ? list.filter(r => !isItemMarked(r)) : list.filter(isItemMarked);
      if (targets.length === 0) return;
      const updated = targets.map(r => ({
        ...r,
        packingOrderedByNitin: isMarked ? "Yes" : "No",
        packingOrderedAt: isMarked ? now : "",
        packingOrderedBy: isMarked ? punchByName : "",
        packingOrderedById: isMarked ? punchById : ""
      }));
      const modelsList = updated.map(r => r.model).filter(Boolean).join(", ");
      onBatchUpdateRequests(
        updated,
        isMarked ? "PACKING_ORDERED" : "PACKING_UNORDERED",
        `Nitin ${isMarked ? "confirmed" : "reverted"} outer packing order for ${updated.length} item(s)${modelsList ? `: ${modelsList}` : ""}`
      );
    } else {
      const targets = isMarked ? list.filter(r => !isItemMarked(r)) : list.filter(isItemMarked);
      if (targets.length === 0) return;
      const updated = targets.map(r => ({
        ...r,
        purchaseUpdated: isMarked ? "Yes" : "No",
        purchaseUpdatedAt: isMarked ? now : "",
        purchaseUpdatedBy: isMarked ? punchByName : "",
        purchaseUpdatedById: isMarked ? punchById : ""
      }));
      onBatchUpdateRequests(updated);
    }
  };

  // Toggle selection for an entire group
  const handleToggleGroupSelect = (groupItems) => {
    const ids = groupItems.map(it => it.id);
    const allSelected = ids.length > 0 && ids.every(id => checkedIds.includes(id));
    if (allSelected) {
      setCheckedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setCheckedIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Toggle inline expand for a group row
  const toggleExpandGroup = (groupKey, e) => {
    if (e) e.stopPropagation();
    setExpandedGroupKeys(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const resetFilters = () => {
    setQuickStatus("all");
    setFilterStage("all");
    setGroupingTypeOverride(null);
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

  // When data is not pulled yet, show the full-page, dedicated loading screen
  const isDataNotPulledYet = loading && !initialLoadComplete && (!requests || requests.length === 0);
  if (isDataNotPulledYet) {
    return (
      <RahulDashboardLoading 
        currentUser={currentUser}
        onDirectPull={onDirectPull}
        onLogout={onLogout}
        panelTitle={isNitin ? "Nitin's Packing & Operations Panel" : "Accounts & Purchase Marking Panel"}
        userName={currentUser?.name || (isNitin ? "Mr. Nitin (Packing)" : "Mr. Rahul Mann")}
      />
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1680px", margin: "0 auto", width: "100%" }}>
      
      {/* ==================== TOP HEADER PANEL ==================== */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.65rem", color: "var(--primary)", textShadow: "0 0 10px var(--primary-glow)", margin: 0 }}>
              {isNitin ? "Nitin's Packing & Operations Panel" : "Accounts & Purchase Marking Panel"}
            </h2>
            <span 
              className="user-badge" 
              style={{ 
                padding: "5px 12px", 
                background: isNitin ? "rgba(236,72,153,0.12)" : "rgba(16,185,129,0.12)", 
                border: isNitin ? "1px solid rgba(236,72,153,0.3)" : "1px solid rgba(16,185,129,0.3)", 
                color: isNitin ? "#ec4899" : "var(--success)", 
                fontWeight: 700, 
                fontSize: "0.82rem" 
              }}
            >
              {isNitin ? (currentUser?.name ? `${currentUser.name} (Packing)` : "Mr. Nitin (Packing)") : (currentUser?.name ? `${currentUser.name} (Accts)` : "Mr. Rahul Mann (Accts)")}
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "4px", marginBottom: 0 }}>
            {isNitin 
              ? "360° Order Visibility, Bundled Upcoming Shipments, Cargo Tracking & Packing Purchase Confirmation"
              : "360° Order Visibility, Bundled Upcoming Shipments, Financial Audit & Ledger Marking Confirmation"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Instant Browser Cache & Live Sync Status Indicator */}
          {isMasterDataSilentlyLoading || loading ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", fontSize: "0.78rem", color: "#38bdf8" }}>
              <RefreshCw size={13} className="spin-animation" /> Syncing live updates...
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", fontSize: "0.78rem", color: "#10b981" }}>
              <Zap size={13} /> Instant Cache Active
            </div>
          )}

          {onRefreshData && (
            <button 
              onClick={onRefreshData} 
              disabled={isMasterDataSilentlyLoading || loading}
              className="btn btn-secondary btn-sm" 
              title="Pull freshest data from server"
              style={{ padding: "7px 12px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} className={isMasterDataSilentlyLoading || loading ? "spin-animation" : ""} /> Sync Now
            </button>
          )}

          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", fontSize: "0.78rem", color: "#38bdf8" }}>
            <Eye size={14} /> Master Orders: View Only
          </div>
          {onOpenProfile && (
            <button 
              type="button"
              onClick={onOpenProfile} 
              className="btn btn-secondary btn-sm" 
              style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="View & Edit your profile and phone number"
            >
              <User size={14} style={{ color: "var(--primary)" }} /> Profile
            </button>
          )}
          <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ padding: "8px 14px" }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ==================== ACCOUNTS EXECUTIVE KPI BAR ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        
        {/* KPI 1: What's Coming (In Transit & Ready) */}
        <div 
          onClick={() => { setQuickStatus("coming"); setFilterStage("all"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: quickStatus === "coming" ? "1px solid #38bdf8" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
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
          onClick={() => { setQuickStatus("all"); setFilterStage("all"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: quickStatus === "all" && filterStage === "all" ? "1px solid #f59e0b" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>💰 Total RMB Committed</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--warning, #b45309)" }}>
            ¥{Math.round(kpiStats.totalRmbValue).toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Across {kpiStats.totalOrders} Requisitions ({kpiStats.totalPcs.toLocaleString()} Pcs)
          </div>
        </div>

        {/* KPI 3: Where Items Are Now (Active Pipeline) */}
        <div 
          onClick={() => { setQuickStatus("pipeline"); setFilterStage("all"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: quickStatus === "pipeline" ? "1px solid #818cf8" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
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
          onClick={() => { setQuickStatus("delivered"); setFilterStage("all"); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: quickStatus === "delivered" ? "1px solid #10b981" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
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
          onClick={() => { setQuickStatus("pending_mark"); setActiveTab("pending"); setCheckedIds([]); }}
          className="glass-panel card-fade-in" 
          style={{ padding: "16px 18px", cursor: "pointer", border: quickStatus === "pending_mark" ? "1px solid #ec4899" : "1px solid var(--border-glass)", transition: "all 0.2s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
              {isNitin ? "📦 Step 1: Mark Packing Purchased" : "📝 Step 1: Mark Purchases"}
            </span>
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
                            Vendor: <strong style={{ color: "var(--text-main)" }}>{resolveCargoVendorName(cargo, vendors, requests)}</strong>
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
                          {(cargo.packingListFile && cargo.packingListData) ? (
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
                                  <span 
                                    style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "4px", background: item.purchaseUpdated === "Yes" ? "rgba(16, 185, 129, 0.15)" : "rgba(236, 72, 153, 0.15)", color: item.purchaseUpdated === "Yes" ? "#10b981" : "#ec4899" }}
                                    title={item.purchaseUpdated === "Yes" ? `Punched by ${item.purchaseUpdatedBy || "Mr. Rahul Mann"}${item.purchaseUpdatedAt ? ` on ${formatPunchDateTime(item.purchaseUpdatedAt)}` : ""}` : "Pending mark purchase in ledger"}
                                  >
                                    {item.purchaseUpdated === "Yes" ? `✓ Purchase Marked${item.purchaseUpdatedAt ? ` (${formatPunchDateTime(item.purchaseUpdatedAt)})` : ""}` : "⏳ Pending Purchase"}
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
            cargos={cargos}
            requests={requests.filter(r => r.status !== "Cancelled")}
            vendors={vendors}
            cargoCompanies={cargoCompanies}
            purchasers={purchasers}
            currentUser={currentUser}
            isViewOnly={false}
            onBatchUpdateRequests={onBatchUpdateRequests}
            onUpdateCargo={onUpdateCargo}
            onDeleteCargo={onDeleteCargo}
            onPurgeEmptyCargos={onPurgeEmptyCargos}
            initialStatusFilter={targetCargoId ? "all" : transitStatusFilter}
            targetCargoId={targetCargoId}
            onClearTargetCargo={() => setTargetCargoId(null)}
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
            onNavigateStep={(stepKey, targetCargo) => handleNavigateToCargo(stepKey, targetCargo)}
            loading={loading}
            initialLoadComplete={initialLoadComplete}
            isMasterDataSilentlyLoading={isMasterDataSilentlyLoading}
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
              onClick={() => { 
                setActiveTab("pending"); 
                if (quickStatus === "marked") setQuickStatus("all"); 
                setCheckedIds([]); 
              }} 
              className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Clock size={15} /> {isNitin ? "Pending Packing Orders" : "Pending Mark Purchases"} ({pendingRequests.length})
            </button>

            <button 
              onClick={() => { 
                setActiveTab("submitted"); 
                if (quickStatus === "pending_mark") setQuickStatus("all"); 
                setCheckedIds([]); 
              }} 
              className={`tab-btn ${activeTab === "submitted" ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <CheckCircle size={15} /> {isNitin ? "Packing Purchased Archive" : "Marked in Ledger Archive"} ({submittedRequests.length})
            </button>
          </div>
        <>
          {/* ==================== MULTI-LEVEL FILTRATION PANEL ==================== */}
          <div className="glass-panel" style={{ padding: "18px 22px", marginBottom: "20px" }}>
            
            {/* Header with Quick Presets */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.95rem", fontWeight: 700, color: "var(--primary)" }}>
                <Filter size={18} /> {isNitin ? "Packing Operations Multi-Level Filtration System" : "Accounts Multi-Level Filtration System"}
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
                onClick={() => { setQuickStatus("all"); setGroupingTypeOverride(null); }}
                className={`btn btn-sm ${quickStatus === "all" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              >
                All Items ({currentTabRequests.length})
              </button>
              
              <button 
                onClick={() => { setQuickStatus("coming"); setGroupingTypeOverride(null); }}
                className={`btn btn-sm ${quickStatus === "coming" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "coming" ? "#fff" : "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
              >
                🚚 What's Coming (In Transit & Ready)
              </button>

              <button 
                onClick={() => { setQuickStatus("pipeline"); setGroupingTypeOverride(null); }}
                className={`btn btn-sm ${quickStatus === "pipeline" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "pipeline" ? "#fff" : "#818cf8", borderColor: "rgba(129, 140, 248, 0.4)" }}
              >
                📍 Where Item Is Now (Active Pipeline)
              </button>

              <button 
                onClick={() => { setQuickStatus("delivered"); setGroupingTypeOverride(null); }}
                className={`btn btn-sm ${quickStatus === "delivered" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "delivered" ? "#fff" : "#10b981", borderColor: "rgba(16px, 185, 129, 0.4)" }}
              >
                ✅ Delivered (Warehouse Received)
              </button>

              <button 
                onClick={() => { setActiveTab("pending"); setQuickStatus("pending_mark"); setGroupingTypeOverride(null); setCheckedIds([]); }}
                className={`btn btn-sm ${quickStatus === "pending_mark" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "pending_mark" ? "#fff" : "#ec4899", borderColor: "rgba(236, 72, 153, 0.4)" }}
              >
                {isNitin ? "⏳ Pending Packing Purchase" : "⏳ Pending Mark in Ledger"}
              </button>

              <button 
                onClick={() => { setActiveTab("submitted"); setQuickStatus("marked"); setGroupingTypeOverride(null); setCheckedIds([]); }}
                className={`btn btn-sm ${quickStatus === "marked" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.78rem", padding: "5px 12px", color: quickStatus === "marked" ? "#fff" : "#a855f7", borderColor: "rgba(168, 85, 247, 0.4)" }}
              >
                {isNitin ? "✓ Packing Purchased" : "✓ Marked in Ledger"}
              </button>

              <button 
                onClick={() => {
                  setGroupingTypeOverride(null);
                  if (quickStatus === "cancelled" || filterStage === "cancelled") {
                    setQuickStatus("all");
                    setFilterStage("all");
                  } else {
                    setQuickStatus("cancelled");
                    setFilterStage("cancelled");
                    setFilterVendor("");
                    setFilterPurchaser("");
                    setFilterCategory("");
                    setFilterCargo("");
                    setFilterTransport("");
                    setSearchQuery("");
                    setFromDate("");
                    setToDate("");
                  }
                }}
                className={`btn btn-sm ${(quickStatus === "cancelled" || filterStage === "cancelled") ? "btn-primary" : "btn-secondary"}`}
                style={{ 
                  fontSize: "0.78rem", 
                  padding: "5px 12px", 
                  color: (quickStatus === "cancelled" || filterStage === "cancelled") ? "#fff" : "#ef4444", 
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  background: (quickStatus === "cancelled" || filterStage === "cancelled") ? "rgba(239, 68, 68, 0.2)" : "transparent",
                  fontWeight: (quickStatus === "cancelled" || filterStage === "cancelled") ? 700 : 500
                }}
              >
                🚫 Cancelled Orders ({cancelledRequestsCount})
              </button>
            </div>



            {/* Level 2 & 3: Filter Dropdowns Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              
              {/* Stage Filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Stage (Where Item Is Now)</label>
                <CustomSelect 
                  value={filterStage}
                  onChange={val => {
                    setFilterStage(val);
                    setGroupingTypeOverride(null);
                  }}
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
                <label className="form-label" style={{ fontSize: "0.76rem" }}>Cargo Name</label>
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

          {/* ==================== VIEW MODE SWITCHER & ACTION ROW FOR MARKING PURCHASES ==================== */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            
            {/* View Mode Toggle Pill: Grouped Orders vs Flat Items */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-card, #ffffff)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <button
                  type="button"
                  onClick={() => setWorkboardViewMode("grouped")}
                  className={`btn btn-sm ${workboardViewMode === "grouped" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: workboardViewMode === "grouped" ? 700 : 500 }}
                >
                  <Package size={15} /> {activeGroupingMode === "cargo" ? "📦 Grouped by Cargo Shipments" : "🏢 Grouped by Vendor Orders"} ({groupedOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWorkboardViewMode("flat")}
                  className={`btn btn-sm ${workboardViewMode === "flat" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: workboardViewMode === "flat" ? 700 : 500 }}
                >
                  <Layers size={15} /> 📋 All Individual Items ({filteredRequests.length})
                </button>
              </div>

              {/* Sub-Grouping Mode Switcher (Active when Grouped View is selected) */}
              {workboardViewMode === "grouped" && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "var(--bg-card, #ffffff)", padding: "4px 8px", borderRadius: "10px", border: "1px solid var(--border-glass, #cbd5e1)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700, marginRight: "4px", textTransform: "uppercase" }}>Group:</span>
                  <button
                    type="button"
                    onClick={() => setGroupingTypeOverride("cargo")}
                    className={`btn btn-sm ${activeGroupingMode === "cargo" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.74rem", padding: "3px 10px", fontWeight: activeGroupingMode === "cargo" ? 700 : 500 }}
                    title="Group orders by In-Transit Cargo Shipments & Batches"
                  >
                    📦 Cargo Shipments
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupingTypeOverride("vendor")}
                    className={`btn btn-sm ${activeGroupingMode === "vendor" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.74rem", padding: "3px 10px", fontWeight: activeGroupingMode === "vendor" ? 700 : 500 }}
                    title="Group orders by Vendor Production Orders"
                  >
                    🏢 Vendor Orders
                  </button>
                </div>
              )}
            </div>

            {/* Selection Status & Batch Marking Controls */}
            {activeTab === "pending" && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Selected: <strong style={{ color: "var(--primary)" }}>{checkedIds.length}</strong> of {filteredRequests.length} pending items
                </span>
                {checkedIds.length > 0 && (
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span>(Total Goods: <strong style={{ color: "var(--warning, #b45309)" }}>¥{Math.round(pendingRequests.filter(r => checkedIds.includes(r.id)).reduce((sum, r) => sum + ((r.orderQuantity || 0) * (r.priceRmb || 0)), 0)).toLocaleString()}</strong></span>
                    {(() => {
                      const selectedReqs = pendingRequests.filter(r => checkedIds.includes(r.id));
                      const totalCartons = selectedReqs.reduce((sum, r) => sum + (r.totalCartons || (r.itemsPerCarton ? Math.ceil((r.orderQuantity || 0) / r.itemsPerCarton) : 0)), 0);
                      return totalCartons > 0 ? (
                        <span>| Cartons: <strong style={{ color: "#a855f7" }}>📦 {totalCartons.toLocaleString()} Ctns</strong></span>
                      ) : null;
                    })()}
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
                <button 
                  onClick={handleSubmitUpdate}
                  disabled={checkedIds.length === 0}
                  className="btn btn-primary"
                  style={{ padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
                >
                  <CheckCircle size={16} /> {isNitin ? `Confirm & Mark ${checkedIds.length || ""} Selected Packing Orders` : `Confirm & Mark ${checkedIds.length || ""} Purchases as Updated`}
                </button>
              </div>
            )}

            {activeTab === "submitted" && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Selected: <strong style={{ color: "#38bdf8" }}>{checkedIds.length}</strong> of {filteredRequests.length} marked items
                </span>
                <button 
                  onClick={handleUnsubmitUpdate}
                  disabled={checkedIds.length === 0}
                  className="btn btn-secondary"
                  style={{ 
                    padding: "8px 16px", 
                    color: "#ef4444", 
                    borderColor: "rgba(239, 68, 68, 0.4)", 
                    background: "rgba(239, 68, 68, 0.1)",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <RotateCcw size={15} /> {isNitin ? `Mark ${checkedIds.length || ""} Selected as Pending Packing (Bulk Undo)` : `Mark ${checkedIds.length || ""} Selected as Unsubmitted (Bulk Undo)`}
                </button>
              </div>
            )}
          </div>

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
          ) : workboardViewMode === "grouped" ? (
            /* ==================== GROUPED ORDERS WORKBOARD ==================== */
            <div className="glass-panel" style={{ padding: "4px" }}>
              <div className="table-container" style={{ maxHeight: "680px", overflowY: "auto" }}>
                <table className="custom-table" style={{ fontSize: "0.84rem" }}>
                  <thead>
                    {activeGroupingMode === "cargo" ? (
                      /* Cargo In-Transit Shipments Headers */
                      <tr>
                        <th style={{ width: "42px", textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            className="checkbox-input"
                            checked={filteredRequests.length > 0 && checkedIds.length === filteredRequests.length}
                            onChange={handleSelectAll}
                            title="Select / deselect all items across all cargo shipments"
                          />
                        </th>
                        <th style={{ width: "42px", textAlign: "center" }}>Expand</th>
                        <th style={{ width: "65px", textAlign: "center" }}>Inspect</th>
                        <RenderGroupSortHeader colKey="cargoDetail" title="Cargo Company" />
                        <RenderGroupSortHeader colKey="vendorSummary" title="Vendor Name" />
                        <RenderGroupSortHeader colKey="cargoShippingDate" title="Dispatched Date" />
                        <RenderGroupSortHeader colKey="cargoEta" title="Upcoming Cargo ETA" />
                        <RenderGroupSortHeader colKey="arrivalDiffDays" title="Arrival Status" getValue={g => g.arrivalStatus?.diffDays ?? 9999} />
                        <RenderGroupSortHeader colKey="totalQty" title="Items & Cartons" />
                        <RenderGroupSortHeader colKey="totalGoodsRmb" title="Item Value (¥)" getValue={g => g.totalGoodsRmb} />
                        <RenderGroupSortHeader colKey="cargoFreightPrice" title="Cargo Value (¥)" getValue={g => g.cargoFreightPrice} />
                        <RenderGroupSortHeader colKey="grandTotalRmb" title="Grand Total (¥)" getValue={g => g.grandTotalRmb} />
                        <th style={{ textAlign: "center" }}>Documents</th>
                        <RenderGroupSortHeader colKey="dominantStage" title="Where Cargo Is Now" />
                        <RenderGroupSortHeader colKey="markedStatus" title="Ledger Status" getValue={g => (g.isAllMarked ? 2 : (g.markedCount > 0 ? 1 : 0))} />
                        <th style={{ textAlign: "center", minWidth: "140px" }}>Actions</th>
                      </tr>
                    ) : (
                      /* Vendor Production Order Lots Headers */
                      <tr>
                        <th style={{ width: "42px", textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            className="checkbox-input"
                            checked={filteredRequests.length > 0 && checkedIds.length === filteredRequests.length}
                            onChange={handleSelectAll}
                            title="Select / deselect all items across all orders"
                          />
                        </th>
                        <th style={{ width: "42px", textAlign: "center" }}>Expand</th>
                        <th style={{ width: "75px", textAlign: "center" }}>Inspect</th>
                        <RenderGroupSortHeader colKey="vendorName" title="Vendor Name" />
                        <RenderGroupSortHeader colKey="orderDate" title="Order Date" />
                        <RenderGroupSortHeader colKey="purchaserName" title="Purchaser" />
                        <RenderGroupSortHeader colKey="eddDisplay" title="Vendor EDD" />
                        <RenderGroupSortHeader colKey="itemsCount" title="Items & Models" getValue={g => g.items.length} />
                        <RenderGroupSortHeader colKey="totalQty" title="Total Qty" />
                        <RenderGroupSortHeader colKey="totalRmb" title="Total RMB (¥)" />
                        <RenderGroupSortHeader colKey="dominantStage" title="Where Items Are Now" />
                        <RenderGroupSortHeader colKey="markedStatus" title="Ledger Status" getValue={g => (g.isAllMarked ? 2 : (g.markedCount > 0 ? 1 : 0))} />
                        <th style={{ textAlign: "center", minWidth: "130px" }}>Group Action</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {sortedGroupedOrders.map(group => {
                      const isAllChecked = group.items.length > 0 && group.items.every(it => checkedIds.includes(it.id));
                      const isSomeChecked = !isAllChecked && group.items.some(it => checkedIds.includes(it.id));
                      const isExpanded = !!expandedGroupKeys[group.groupKey];

                      if (group.groupType === "cargo") {
                        /* ==================== CARGO SHIPMENT ROW ==================== */
                        return (
                          <React.Fragment key={group.groupKey}>
                            <tr 
                              className={isAllChecked ? "planner-row-selected" : ""}
                              style={{ 
                                cursor: "pointer", 
                                transition: "background 0.15s ease",
                                background: isAllChecked ? "rgba(56, 189, 248, 0.1)" : (isExpanded ? "rgba(255, 255, 255, 0.03)" : undefined) 
                              }}
                              onClick={() => setSelectedOrderGroup(group)}
                              title="Click to open full cargo shipment popup window"
                            >
                              {/* Cargo Checkbox */}
                              <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  className="checkbox-input"
                                  checked={isAllChecked}
                                  ref={el => { if (el) el.indeterminate = isSomeChecked; }}
                                  onChange={() => handleToggleGroupSelect(group.items)}
                                  title={`Select all ${group.items.length} items in this cargo shipment`}
                                />
                              </td>

                              {/* Inline Expand Toggle Arrow */}
                              <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpandGroup(group.groupKey, e)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "3px 6px", fontSize: "0.72rem", border: "none", background: "transparent", color: isExpanded ? "var(--primary)" : "var(--text-muted)" }}
                                  title={isExpanded ? "Collapse items inline" : "Expand items inline"}
                                >
                                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </button>
                              </td>

                              {/* Inspect Button */}
                              <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderGroup(group)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "3px 8px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                  title="Open full cargo popup window"
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>

                              {/* Cargo Company / Detail */}
                              <td style={{ fontWeight: 700 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Package size={15} style={{ color: "var(--primary)", flexShrink: 0 }} />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (group.cargoObj) setEditingCargo(group.cargoObj);
                                      else setSelectedOrderGroup(group);
                                    }}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      padding: 0,
                                      font: "inherit",
                                      fontWeight: 800,
                                      color: "var(--primary, #38bdf8)",
                                      cursor: "pointer",
                                      textAlign: "left",
                                      textDecoration: "underline",
                                      textUnderlineOffset: "3px"
                                    }}
                                    title="Click to view & edit cargo shipping details in popup"
                                  >
                                    {group.cargoDetail}
                                  </button>
                                  {group.modeOfTransport && group.modeOfTransport !== "—" && (
                                    <span className="badge badge-cargo" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                                      {group.modeOfTransport}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                  {group.carrierName !== "—" ? `${group.carrierName} • ` : ""}Code: <code>{group.cargoId || "—"}</code>
                                </div>
                              </td>

                              {/* Vendor Name */}
                              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Building2 size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                  <span style={{ color: "var(--text-main)" }} title={group.distinctVendorNames?.join(", ")}>
                                    {group.vendorSummary}
                                  </span>
                                </div>
                                {group.purchaserSummary && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--primary)", marginTop: "1px" }}>
                                    {group.purchaserSummary}
                                  </div>
                                )}
                              </td>

                              {/* Dispatched Date */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                {group.cargoShippingDate && group.cargoShippingDate !== "—" ? (
                                  <span className="badge badge-cargo" style={{ fontSize: "0.74rem" }}>
                                    {group.cargoShippingDate}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>

                              {/* Upcoming Cargo ETA */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                {group.cargoEta && group.cargoEta !== "—" ? (
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700, color: "#38bdf8" }}>
                                    <span>{group.cargoEta}</span>
                                    <span style={{ fontSize: "0.68rem", opacity: 0.85, background: "rgba(56, 189, 248, 0.15)", padding: "1px 4px", borderRadius: "4px" }}>⏱️ ETA</span>
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>

                              {/* Arrival Status */}
                              <td>
                                <span 
                                  style={{ 
                                    padding: "3px 8px", 
                                    borderRadius: "6px", 
                                    fontSize: "0.72rem", 
                                    fontWeight: 700, 
                                    background: group.arrivalStatus.bgColor, 
                                    color: group.arrivalStatus.badgeColor, 
                                    border: `1px solid ${group.arrivalStatus.borderColor}`,
                                    whiteSpace: "nowrap",
                                    display: "inline-block"
                                  }}
                                >
                                  {group.arrivalStatus.label}
                                </span>
                              </td>

                              {/* Items & Cartons */}
                              <td style={{ fontWeight: 700 }}>
                                <div>{group.totalQty.toLocaleString()} Pcs</div>
                                {group.totalCartons > 0 && (
                                  <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 600, marginTop: "1px" }}>
                                    📦 {group.totalCartons.toLocaleString()} Cartons
                                  </div>
                                )}
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                  {group.items.length} line{group.items.length !== 1 ? "s" : ""}
                                </div>
                              </td>

                              {/* Item Value (Goods Total) */}
                              <td style={{ fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 800, color: "var(--warning, #b45309)" }}>
                                  ¥{Math.round(group.totalGoodsRmb).toLocaleString()}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                  Goods ({group.totalQty.toLocaleString()} pcs)
                                </div>
                              </td>

                              {/* Cargo Value (Freight) */}
                              <td style={{ fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                                {group.cargoFreightPrice > 0 ? (
                                  <div>
                                    <div style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 700 }}>
                                      ¥{Math.round(group.cargoFreightPrice).toLocaleString()}
                                    </div>
                                    {group.cargoObj && (
                                      <CargoRatesBreakdown cargo={group.cargoObj} compact={true} />
                                    )}
                                    {group.cargoPricePerPc > 0 && (
                                      <div style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 600 }}>
                                        (¥{group.cargoPricePerPc.toFixed(2)}/pc)
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                                )}
                              </td>

                              {/* Grand Total */}
                              <td style={{ fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 800, color: "var(--text-main)" }}>
                                  ¥{Math.round(group.grandTotalRmb).toLocaleString()}
                                </div>
                              </td>

                              {/* Documents */}
                              <td style={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                  {group.hasPackingList ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fName = group.cargoObj?.packingListFile || group.cargoObj?.packingListFileName || "PackingList.xlsx";
                                        const fData = group.cargoObj?.packingListData || group.cargoObj?.packingList;
                                        handleOpenDocument(group.cargoObj, "Cargo Packing List", fName, fData, "packingListFile", "packingListData");
                                      }}
                                      className="badge badge-received"
                                      style={{ cursor: "pointer", border: "1px solid rgba(16, 185, 129, 0.4)", fontSize: "0.68rem", padding: "2px 5px" }}
                                      title="Open Packing List"
                                    >
                                      📄 PL
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: "0.68rem", opacity: 0.35, color: "var(--text-muted)" }}>—</span>
                                  )}
                                  {group.hasVendorBill ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fName = group.cargoObj?.invoiceFile || group.cargoObj?.vendorBillFileName || "Invoice.pdf";
                                        const fData = group.cargoObj?.invoiceData || group.cargoObj?.vendorBill;
                                        handleOpenDocument(group.cargoObj, "Vendor Bill (Invoice)", fName, fData, "invoiceFile", "invoiceData");
                                      }}
                                      className="badge badge-warning"
                                      style={{ cursor: "pointer", border: "1px solid rgba(245, 158, 11, 0.4)", fontSize: "0.68rem", padding: "2px 5px" }}
                                      title="Open Vendor Bill"
                                    >
                                      📄 INV
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: "0.68rem", opacity: 0.35, color: "var(--text-muted)" }}>—</span>
                                  )}
                                  {group.hasCargoReceipt ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fName = group.cargoObj?.cargoReceiptFile || group.cargoObj?.cargoReceiptFileName || "Receipt.pdf";
                                        const fData = group.cargoObj?.cargoReceiptData || group.cargoObj?.cargoReceipt;
                                        handleOpenDocument(group.cargoObj, "Cargo Delivery Receipt", fName, fData, "cargoReceiptFile", "cargoReceiptData");
                                      }}
                                      className="badge badge-cargo"
                                      style={{ cursor: "pointer", border: "1px solid rgba(56, 189, 248, 0.4)", fontSize: "0.68rem", padding: "2px 5px" }}
                                      title="Open Cargo Receipt / Slip"
                                    >
                                      📄 CR
                                    </button>
                                  ) : (
                                    group.cargoObj ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDocument(group.cargoObj, "Cargo Delivery Receipt", "CargoReceipt.pdf", "", "cargoReceiptFile", "cargoReceiptData")}
                                        className="badge"
                                        style={{ cursor: "pointer", border: "1px dashed rgba(56, 189, 248, 0.5)", background: "rgba(56, 189, 248, 0.08)", color: "#38bdf8", fontSize: "0.68rem", padding: "2px 5px" }}
                                        title="Upload Missing Cargo Slip"
                                      >
                                        +CR
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: "0.68rem", opacity: 0.35, color: "var(--text-muted)" }}>—</span>
                                    )
                                  )}
                                </div>
                              </td>

                              {/* Where Cargo Is Now */}
                              <td>
                                <span 
                                  style={{ 
                                    padding: "3px 8px", 
                                    borderRadius: "6px", 
                                    fontSize: "0.72rem", 
                                    fontWeight: 700, 
                                    background: "rgba(56, 189, 248, 0.12)", 
                                    color: "#38bdf8", 
                                    border: "1px solid rgba(56, 189, 248, 0.3)",
                                    whiteSpace: "nowrap",
                                    display: "inline-block"
                                  }}
                                >
                                  {group.dominantStage}
                                </span>
                              </td>

                              {/* Ledger / Packing Status */}
                              <td>
                                {activeTab === "pending" ? (
                                  group.allCargoMarkedCount > 0 ? (
                                    <span 
                                      style={{ 
                                        padding: "3px 8px", 
                                        borderRadius: "6px", 
                                        fontSize: "0.72rem", 
                                        fontWeight: 700, 
                                        background: "rgba(56, 189, 248, 0.15)", 
                                        color: "#38bdf8", 
                                        border: "1px solid rgba(56, 189, 248, 0.35)",
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px"
                                      }}
                                    >
                                      ⚡ {group.allCargoMarkedCount}/{group.allCargoTotalItems || group.items.length} {isNitin ? "Packing Purchased" : "Marked"} ({group.items.length} Pending)
                                    </span>
                                  ) : (
                                    <span 
                                      style={{ 
                                        padding: "3px 8px", 
                                        borderRadius: "6px", 
                                        fontSize: "0.72rem", 
                                        fontWeight: 700, 
                                        background: "rgba(245, 158, 11, 0.15)", 
                                        color: "#f59e0b", 
                                        border: "1px solid rgba(245, 158, 11, 0.35)",
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px"
                                      }}
                                    >
                                      ⏳ Pending {isNitin ? "Packing" : "Mark"} ({group.items.length})
                                    </span>
                                  )
                                ) : (
                                  group.allCargoPendingCount === 0 ? (
                                    <span 
                                      style={{ 
                                        padding: "3px 8px", 
                                        borderRadius: "6px", 
                                        fontSize: "0.72rem", 
                                        fontWeight: 700, 
                                        background: "rgba(16, 185, 129, 0.15)", 
                                        color: "#10b981", 
                                        border: "1px solid rgba(16, 185, 129, 0.35)",
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px"
                                      }}
                                    >
                                      ✓ {isNitin ? "Packing Purchased" : "Marked in Ledger"} ({group.items.length})
                                    </span>
                                  ) : (
                                    <span 
                                      style={{ 
                                        padding: "3px 8px", 
                                        borderRadius: "6px", 
                                        fontSize: "0.72rem", 
                                        fontWeight: 700, 
                                        background: "rgba(56, 189, 248, 0.15)", 
                                        color: "#38bdf8", 
                                        border: "1px solid rgba(56, 189, 248, 0.35)",
                                        whiteSpace: "nowrap",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px"
                                      }}
                                    >
                                      ⚡ {group.allCargoMarkedCount}/{group.allCargoTotalItems || group.items.length} {isNitin ? "Packing Purchased" : "Marked"} ({group.allCargoPendingCount} Pending)
                                    </span>
                                  )
                                )}
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: "center", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                  {activeTab === "pending" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkGroup(group.items, true)}
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: "4px 8px", fontSize: "0.72rem", fontWeight: 700, background: isNitin ? "#ec4899" : "#10b981", borderColor: isNitin ? "#ec4899" : "#10b981" }}
                                      title={isNitin ? `Mark all ${group.items.length} pending items in this cargo shipment as packing purchased` : `Mark all ${group.items.length} pending items in this cargo shipment as purchased`}
                                    >
                                      ✓ {isNitin ? "Mark Cargo Packing" : "Mark Cargo"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkGroup(group.items, false)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: "3px 7px", fontSize: "0.7rem", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)" }}
                                      title={isNitin ? "Revert all items in this cargo shipment to pending packing" : "Revert all items in this cargo shipment to unsubmitted / pending"}
                                    >
                                      <RotateCcw size={11} style={{ marginRight: "3px" }} /> Undo
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (group.cargoObj) setEditingCargo(group.cargoObj);
                                      else setSelectedOrderGroup(group);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: "3px 7px", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "2px" }}
                                    title="Edit Cargo Shipping Details"
                                  >
                                    <Edit3 size={11} /> Edit
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Inline Expanded Items Sub-Table for Cargo */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={16} style={{ padding: "12px 20px", background: "var(--bg-main, #f8fafc)", borderBottom: "2px solid var(--primary, #38bdf8)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>
                                      📦 Bundled Cargo Items: {group.cargoDetail} ({group.items.length} items)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrderGroup(group)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: "0.72rem", padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                    >
                                      <Maximize2 size={12} /> Open in Dedicated Window
                                    </button>
                                  </div>
                                  {group.cargoObj && (
                                    <CargoRatesBreakdown cargo={group.cargoObj} collapsible={true} defaultExpanded={false} />
                                  )}
                                  <table className="custom-table" style={{ fontSize: "0.79rem", margin: 0, background: "var(--bg-card, #ffffff)" }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: "32px", textAlign: "center" }}>✓</th>
                                        <th>Model / Item</th>
                                        <th>Vendor</th>
                                        <th>Category</th>
                                        <th>Qty</th>
                                        <th>Price (¥)</th>
                                        <th>Cargo / Pc</th>
                                        <th>Total Goods (¥)</th>
                                        <th>Total Cargo (¥)</th>
                                        <th>Grand Total (¥)</th>
                                        <th>Stage</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: "center", width: "110px" }}>Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.items.map(it => {
                                        const isItChecked = checkedIds.includes(it.id);
                                        const itQty = parseInt(it.vendorOrderQuantity || it.orderQuantity, 10) || 0;
                                        const itPrice = parseFloat(it.priceRmb) || 0;
                                        const itGoodsRmb = itQty * itPrice;
                                        const itCargoPerPc = group.cargoPricePerPc || 0;
                                        const itCargoRmb = itQty * itCargoPerPc;
                                        const itGrandTotal = itGoodsRmb + itCargoRmb;
                                        const itMarked = isItemMarked(it);
                                        const itCargo = cargos.find(c => isCargoMatch(it.cargoId, c));
                                        const itStage = getOrderStage(it, itCargo);
                                        const vName = vendors.find(v => v.id === it.vendorId)?.name || it.vendorName || "—";

                                        return (
                                          <tr key={it.id}>
                                            <td style={{ textAlign: "center" }}>
                                              <input 
                                                type="checkbox"
                                                className="checkbox-input"
                                                checked={isItChecked}
                                                onChange={() => handleToggleSelect(it.id)}
                                              />
                                            </td>
                                            <td style={{ fontWeight: 700 }}>
                                              <div>{it.model}</div>
                                              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>#{it.id}</div>
                                            </td>
                                            <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{vName}</td>
                                            <td>{it.category || "—"}</td>
                                            <td style={{ fontWeight: 600 }}>{itQty.toLocaleString()} Pcs</td>
                                            <td style={{ color: "var(--warning, #b45309)", fontWeight: 600 }}>{itPrice > 0 ? `¥${itPrice.toFixed(2)}` : "—"}</td>
                                            <td style={{ color: "#10b981", fontWeight: 600 }}>{itCargoPerPc > 0 ? `¥${itCargoPerPc.toFixed(2)}` : "—"}</td>
                                            <td style={{ fontWeight: 700, color: "var(--warning, #b45309)" }}>{itGoodsRmb > 0 ? `¥${Math.round(itGoodsRmb).toLocaleString()}` : "—"}</td>
                                            <td style={{ fontWeight: 700, color: "#10b981" }}>{itCargoRmb > 0 ? `¥${Math.round(itCargoRmb).toLocaleString()}` : "—"}</td>
                                            <td style={{ fontWeight: 800, color: "var(--text-main)" }}>{itGrandTotal > 0 ? `¥${Math.round(itGrandTotal).toLocaleString()}` : "—"}</td>
                                            <td>
                                              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700, background: itStage.bgColor, color: itStage.badgeColor }}>
                                                {itStage.label}
                                              </span>
                                            </td>
                                            <td>
                                              {itMarked ? (
                                                <span style={{ color: "#10b981", fontWeight: 700 }}>✓ {isNitin ? "Packing Purchased" : "Marked"}</span>
                                              ) : (
                                                <span style={{ color: "#f59e0b", fontWeight: 700 }}>⏳ Pending {isNitin ? "Packing" : ""}</span>
                                              )}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                              {itMarked ? (
                                                <button
                                                  type="button"
                                                  onClick={() => handleMarkGroup([it], false)}
                                                  className="btn btn-secondary btn-sm"
                                                  style={{ padding: "2px 7px", fontSize: "0.7rem", color: "#ef4444" }}
                                                  title={isNitin ? "Undo packing purchased status" : "Undo marked purchase status"}
                                                >
                                                  Undo
                                                </button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => handleMarkGroup([it], true)}
                                                  className="btn btn-primary btn-sm"
                                                  style={{ padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700, background: isNitin ? "#ec4899" : "#10b981", borderColor: isNitin ? "#ec4899" : "#10b981" }}
                                                  title={isNitin ? "Mark this individual item as packing purchased" : "Mark this individual item as purchased"}
                                                >
                                                  {isNitin ? "Mark Packing" : "Mark"}
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }

                      /* ==================== VENDOR ORDER LOT ROW ==================== */
                      return (
                        <React.Fragment key={group.groupKey}>
                          <tr 
                            className={isAllChecked ? "planner-row-selected" : ""}
                            style={{ 
                              cursor: "pointer", 
                              transition: "background 0.15s ease",
                              background: isAllChecked ? "rgba(56, 189, 248, 0.1)" : (isExpanded ? "rgba(255, 255, 255, 0.03)" : undefined) 
                            }}
                            onClick={() => setSelectedOrderGroup(group)}
                            title="Click to open full order popup window"
                          >
                            {/* Group Checkbox */}
                            <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                className="checkbox-input"
                                checked={isAllChecked}
                                ref={el => { if (el) el.indeterminate = isSomeChecked; }}
                                onChange={() => handleToggleGroupSelect(group.items)}
                                title={`Select all ${group.items.length} items in this order`}
                              />
                            </td>

                            {/* Inline Expand Toggle Arrow */}
                            <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => toggleExpandGroup(group.groupKey, e)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "3px 6px", fontSize: "0.72rem", border: "none", background: "transparent", color: isExpanded ? "var(--primary)" : "var(--text-muted)" }}
                                title={isExpanded ? "Collapse items inline" : "Expand items inline"}
                              >
                                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </button>
                            </td>

                            {/* Inspect Order Popup Button */}
                            <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderGroup(group)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "3px 8px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                title="Open full order popup window"
                              >
                                <Eye size={12} /> View
                              </button>
                            </td>

                            {/* Vendor Name */}
                            <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Building2 size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                                <span style={{ color: "var(--text-main)" }}>{group.vendorName}</span>
                                <span 
                                  className="badge" 
                                  style={{ 
                                    fontSize: "0.72rem", 
                                    padding: "1px 7px", 
                                    borderRadius: "99px",
                                    background: "rgba(56, 189, 248, 0.12)", 
                                    color: "#38bdf8", 
                                    border: "1px solid rgba(56, 189, 248, 0.25)", 
                                    fontWeight: 600
                                  }}
                                  title={`${group.items.length} order items in this lot`}
                                >
                                  {group.items.length} order{group.items.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </td>

                            {/* Order Date */}
                            <td style={{ whiteSpace: "nowrap" }}>
                              <span className="badge badge-cargo" style={{ fontSize: "0.74rem" }}>
                                {group.orderDate}
                              </span>
                            </td>

                            {/* Purchaser */}
                            <td style={{ fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap" }}>
                              {group.purchaserName}
                            </td>

                            {/* Vendor EDD */}
                            <td style={{ whiteSpace: "nowrap", color: "#38bdf8", fontWeight: 600 }}>
                              {group.eddDisplay}
                            </td>

                            {/* Items & Models */}
                            <td style={{ maxWidth: "220px" }}>
                              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                                {group.items.length} Line{group.items.length !== 1 ? "s" : ""} • {group.models.length} Model{group.models.length !== 1 ? "s" : ""}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={group.models.join(", ")}>
                                {group.modelsSummary}
                              </div>
                            </td>

                            {/* Total Qty */}
                            <td style={{ fontWeight: 700 }}>
                              <div>{group.totalQty.toLocaleString()} Pcs</div>
                              {group.totalCartons > 0 && (
                                <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 600, marginTop: "1px" }}>
                                  📦 {group.totalCartons.toLocaleString()} Ctns
                                </div>
                              )}
                            </td>

                            {/* Total RMB */}
                            <td style={{ fontWeight: 800, color: "var(--warning, #b45309)", fontSize: "0.88rem" }}>
                              {group.totalRmb > 0 ? `¥${Math.round(group.totalRmb).toLocaleString()}` : "—"}
                            </td>

                            {/* Dominant Stage */}
                            <td>
                              <span 
                                style={{ 
                                  padding: "3px 8px", 
                                  borderRadius: "6px", 
                                  fontSize: "0.72rem", 
                                  fontWeight: 700, 
                                  background: "rgba(56, 189, 248, 0.12)", 
                                  color: "#38bdf8", 
                                  border: "1px solid rgba(56, 189, 248, 0.3)",
                                  whiteSpace: "nowrap",
                                  display: "inline-block"
                                }}
                              >
                                {group.dominantStage}
                              </span>
                            </td>

                            {/* Ledger Status */}
                            <td>
                              {activeTab === "pending" ? (
                                group.allCargoMarkedCount > 0 ? (
                                  <span 
                                    style={{ 
                                      padding: "3px 8px", 
                                      borderRadius: "6px", 
                                      fontSize: "0.72rem", 
                                      fontWeight: 700, 
                                      background: "rgba(56, 189, 248, 0.15)", 
                                      color: "#38bdf8", 
                                      border: "1px solid rgba(56, 189, 248, 0.35)",
                                      whiteSpace: "nowrap",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    ⚡ {group.allCargoMarkedCount}/{group.allCargoTotalItems || group.items.length} {isNitin ? "Packing Purchased" : "Marked"} ({group.items.length} Pending)
                                  </span>
                                ) : (
                                  <span 
                                    style={{ 
                                      padding: "3px 8px", 
                                      borderRadius: "6px", 
                                      fontSize: "0.72rem", 
                                      fontWeight: 700, 
                                      background: "rgba(245, 158, 11, 0.15)", 
                                      color: "#f59e0b", 
                                      border: "1px solid rgba(245, 158, 11, 0.35)",
                                      whiteSpace: "nowrap",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    ⏳ Pending {isNitin ? "Packing" : "Mark"} ({group.items.length})
                                  </span>
                                )
                              ) : (
                                group.allCargoPendingCount === 0 ? (
                                  <span 
                                    style={{ 
                                      padding: "3px 8px", 
                                      borderRadius: "6px", 
                                      fontSize: "0.72rem", 
                                      fontWeight: 700, 
                                      background: "rgba(16, 185, 129, 0.15)", 
                                      color: "#10b981", 
                                      border: "1px solid rgba(16, 185, 129, 0.35)",
                                      whiteSpace: "nowrap",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    ✓ {isNitin ? "Packing Purchased" : "Marked in Ledger"} ({group.items.length})
                                  </span>
                                ) : (
                                  <span 
                                    style={{ 
                                      padding: "3px 8px", 
                                      borderRadius: "6px", 
                                      fontSize: "0.72rem", 
                                      fontWeight: 700, 
                                      background: "rgba(56, 189, 248, 0.15)", 
                                      color: "#38bdf8", 
                                      border: "1px solid rgba(56, 189, 248, 0.35)",
                                      whiteSpace: "nowrap",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    ⚡ {group.allCargoMarkedCount}/{group.allCargoTotalItems || group.items.length} {isNitin ? "Packing Purchased" : "Marked"} ({group.allCargoPendingCount} Pending)
                                  </span>
                                )
                              )}
                            </td>

                            {/* Group Action Button */}
                            <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                              {activeTab === "pending" ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkGroup(group.items, true)}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: "4px 10px", fontSize: "0.74rem", fontWeight: 700, background: isNitin ? "#ec4899" : "#10b981", borderColor: isNitin ? "#ec4899" : "#10b981" }}
                                  title={isNitin ? `Mark all ${group.items.length} pending items in this order as packing purchased` : `Mark all ${group.items.length} pending items in this order as purchased`}
                                >
                                  ✓ {isNitin ? "Mark Order Packing" : "Mark Order"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMarkGroup(group.items, false)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "3px 8px", fontSize: "0.72rem", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)" }}
                                  title={isNitin ? "Revert all items in this order to pending packing" : "Revert all items in this order to unsubmitted / pending"}
                                >
                                  <RotateCcw size={12} style={{ marginRight: "3px" }} /> Undo Order
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Inline Expanded Items Sub-Table */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={13} style={{ padding: "12px 20px", background: "var(--bg-main, #f8fafc)", borderBottom: "2px solid var(--primary, #38bdf8)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>
                                    📦 Order Items: {group.vendorName} ({group.orderDate})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrderGroup(group)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: "0.72rem", padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  >
                                    <Maximize2 size={12} /> Open in Dedicated Window
                                  </button>
                                </div>
                                <table className="custom-table" style={{ fontSize: "0.79rem", margin: 0, background: "var(--bg-card, #ffffff)" }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: "32px", textAlign: "center" }}>✓</th>
                                      <th>Model / Item</th>
                                      <th>Category</th>
                                      <th>Qty</th>
                                      <th>Price (¥)</th>
                                      <th>Total RMB</th>
                                      <th>Stage</th>
                                      <th>Vendor EDD</th>
                                      <th>Status</th>
                                      <th style={{ textAlign: "center", width: "110px" }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.items.map(it => {
                                      const isItChecked = checkedIds.includes(it.id);
                                      const itQty = parseInt(it.vendorOrderQuantity || it.orderQuantity, 10) || 0;
                                      const itPrice = parseFloat(it.priceRmb) || 0;
                                      const itTotalRmb = itQty * itPrice;
                                      const itMarked = isItemMarked(it);
                                      const itCargo = cargos.find(c => isCargoMatch(it.cargoId, c));
                                      const itStage = getOrderStage(it, itCargo);

                                      return (
                                        <tr key={it.id}>
                                          <td style={{ textAlign: "center" }}>
                                            <input 
                                              type="checkbox"
                                              className="checkbox-input"
                                              checked={isItChecked}
                                              onChange={() => handleToggleSelect(it.id)}
                                            />
                                          </td>
                                          <td style={{ fontWeight: 700 }}>
                                            <div>{it.model}</div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>#{it.id}</div>
                                          </td>
                                          <td>{it.category || "—"}</td>
                                          <td style={{ fontWeight: 600 }}>{itQty.toLocaleString()} Pcs</td>
                                          <td style={{ color: "var(--warning, #b45309)", fontWeight: 600 }}>{itPrice > 0 ? `¥${itPrice.toFixed(2)}` : "—"}</td>
                                          <td style={{ fontWeight: 700, color: "var(--warning, #b45309)" }}>{itTotalRmb > 0 ? `¥${Math.round(itTotalRmb).toLocaleString()}` : "—"}</td>
                                          <td>
                                            <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700, background: itStage.bgColor, color: itStage.badgeColor }}>
                                              {itStage.label}
                                            </span>
                                          </td>
                                          <td>{it.vendorEdd || "—"}</td>
                                          <td>
                                            {itMarked ? (
                                              <span style={{ color: "#10b981", fontWeight: 700 }}>✓ {isNitin ? "Packing Purchased" : "Marked"}</span>
                                            ) : (
                                              <span style={{ color: "#f59e0b", fontWeight: 700 }}>⏳ Pending {isNitin ? "Packing" : ""}</span>
                                            )}
                                          </td>
                                          <td style={{ textAlign: "center" }}>
                                            {itMarked ? (
                                              <button
                                                type="button"
                                                onClick={() => handleMarkGroup([it], false)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ padding: "2px 7px", fontSize: "0.7rem", color: "#ef4444" }}
                                                title={isNitin ? "Undo packing purchased status" : "Undo marked purchase status"}
                                              >
                                                Undo
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleMarkGroup([it], true)}
                                                className="btn btn-primary btn-sm"
                                                style={{ padding: "2px 9px", fontSize: "0.7rem", fontWeight: 700, background: isNitin ? "#ec4899" : "#10b981", borderColor: isNitin ? "#ec4899" : "#10b981" }}
                                                title={isNitin ? "Mark this individual item as packing purchased" : "Mark this individual item as purchased"}
                                              >
                                                {isNitin ? "Mark Packing" : "Mark"}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ==================== FLAT INDIVIDUAL ITEMS TABLE ==================== */
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
                      <RenderSortHeader colKey="stage" title="Where Item Is Now" getValue={r => getOrderStage(r, cargos.find(c => isCargoMatch(r.cargoId, c))).label} />
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
                      <RenderSortHeader colKey="cargoDate" title="Cargo Date" getValue={r => cargos.find(c => isCargoMatch(r.cargoId, c))?.cargoOrderDate || ""} />
                      <RenderSortHeader colKey="cargoDetail" title="Cargo Name / Code" getValue={r => cargos.find(c => isCargoMatch(r.cargoId, c))?.cargoDetail || r.cargoId || ""} />
                      <RenderSortHeader colKey="modeOfTransport" title="Transport" getValue={r => cargos.find(c => isCargoMatch(r.cargoId, c))?.modeOfTransport || ""} />
                      <RenderSortHeader colKey="cargoShippingDate" title="Ship Date" getValue={r => cargos.find(c => isCargoMatch(r.cargoId, c))?.cargoShippingDate || ""} />
                      <RenderSortHeader colKey="cargoEta" title="ETA" getValue={r => cargos.find(c => isCargoMatch(r.cargoId, c))?.cargoEta || ""} />
                      <RenderSortHeader 
                        colKey="cargoFreightPrice" 
                        title="Cargo Price" 
                        getValue={r => { 
                          const c = cargos.find(x => isCargoMatch(r.cargoId, x)); 
                          return calculateTotalCargoPrice(c, r); 
                        }} 
                      />
                      <RenderSortHeader colKey="isMaterialRec" title="Material Rec" getValue={r => {
                        const c = cargos.find(x => isCargoMatch(r.cargoId, x));
                        return (r.isMaterialRec === "Yes" || c?.isMaterialRec === "Yes" || Boolean(c?.receivedDate)) ? "Yes" : (r.isMaterialRec || "No");
                      }} />
                      <RenderSortHeader colKey="packingOrderedByNitin" title={isNitin ? "Packing Purchased?" : "Packing Ordered?"} />
                      <th>Cargo Documents</th>
                      {activeTab === "submitted" && (
                        <>
                          <RenderSortHeader colKey={isNitin ? "packingOrderedAt" : "purchaseUpdatedAt"} title={isNitin ? "Confirmed At" : "Punched Timestamp"} getValue={r => (isNitin ? (r.packingOrderedAt || "") : (r.purchaseUpdatedAt || ""))} />
                          <RenderSortHeader colKey={isNitin ? "packingOrderedBy" : "purchaseUpdatedBy"} title={isNitin ? "Confirmed By" : "Punch By"} getValue={r => (isNitin ? (r.packingOrderedBy || "Mr. Nitin (Packing)") : (r.purchaseUpdatedBy || "Mr. Rahul Mann"))} />
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDisplayRequests.map(r => {
                      const vName = vendors.find(v => v.id === r.vendorId)?.name || "—";
                      const cargo = cargos.find(c => isCargoMatch(r.cargoId, c));
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
                              title={r.cancellationReason ? `Reason: ${r.cancellationReason}` : stage.desc}
                            >
                              {stage.label}
                            </span>
                            {r.status === "Cancelled" && (
                              <div style={{ fontSize: "0.68rem", color: "#f87171", marginTop: "2px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.cancellationReason || "Cancelled"}>
                                {r.cancellationReason || "Cancelled"}
                              </div>
                            )}
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
                          <td style={{ fontWeight: 700 }}>
                            <div>{qty.toLocaleString()} Pcs</div>
                            {(() => {
                              const ipc = parseInt(r.itemsPerCarton, 10);
                              const ctns = r.totalCartons || (ipc > 0 ? Math.ceil(qty / ipc) : 0);
                              if (ipc > 0 || ctns > 0) {
                                return (
                                  <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 600, marginTop: "2px" }}>
                                    {ipc > 0 ? `${ipc}/ctn • ` : ""}📦 {ctns} ctn{ctns !== 1 ? "s" : ""}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>

                          {/* Price RMB */}
                          <td style={{ fontWeight: 600, color: "var(--warning, #b45309)" }}>
                            {price > 0 ? `¥${price.toFixed(2)}` : "—"}
                          </td>

                          {/* Total RMB */}
                          <td style={{ fontWeight: 800, color: "var(--warning, #b45309)" }}>
                            {totalRmb > 0 ? `¥${Math.round(totalRmb).toLocaleString()}` : "—"}
                          </td>

                          {/* Vendor EDD */}
                          <td style={{ whiteSpace: "nowrap" }}>{r.vendorEdd || "—"}</td>
                          
                          {/* Cargo Columns */}
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {cargo?.cargoOrderDate || "—"}
                          </td>
                          <td 
                            style={{ fontSize: "0.78rem", maxWidth: "160px", cursor: r.cargoId ? "pointer" : "default" }} 
                            title={r.cargoId ? `Click to open Cargo #${r.cargoId} directly` : "—"}
                            onClick={() => r.cargoId && handleNavigateToCargo("transit", r.cargoId)}
                          >
                            {cargo?.cargoDetail ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "underline" }}>
                                  📦 {cargo.cargoDetail}
                                </div>
                                {r.cargoId && r.cargoId !== cargo.cargoDetail && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "1px" }}>#{r.cargoId}</div>
                                )}
                                {calculateCargoTotalCartons(cargo, requests) > 0 && (
                                  <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 700, marginTop: "2px" }}>
                                    📦 {calculateCargoTotalCartons(cargo, requests)} Cartons
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span style={{ color: r.cargoId ? "var(--primary)" : "var(--text-muted)", textDecoration: r.cargoId ? "underline" : "none", fontWeight: r.cargoId ? 700 : 400 }}>
                                  {r.cargoId ? `📦 #${r.cargoId}` : "—"}
                                </span>
                                {cargo && calculateCargoTotalCartons(cargo, requests) > 0 && (
                                  <div style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 700, marginTop: "2px" }}>
                                    📦 {calculateCargoTotalCartons(cargo, requests)} Cartons
                                  </div>
                                )}
                              </div>
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

                              const allCargoItems = c ? (requests || []).filter(x => (x.cargoId === c.id || (c.cargoDetail && x.cargoId === c.cargoDetail)) && x.status !== "Cancelled") : [r];
                              const cTotalPcs = allCargoItems.reduce((sum, it) => sum + (parseInt(it.vendorOrderQuantity || it.orderQuantity, 10) || 0), 0);
                              const perPcRate = cTotalPcs > 0 && total > 0 ? (total / cTotalPcs) : (uom === "per Pc" ? parseFloat(rate || 0) : 0);
                              
                              if (total > 0 || rate) {
                                return (
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.82rem" }}>
                                      {total > 0 
                                        ? `${getCurrencySymbol(cur)}${Number(total).toLocaleString()}` 
                                        : `${getCurrencySymbol(cur)}${rate}`}
                                    </div>
                                    {c && <CargoRatesBreakdown cargo={c} compact={true} />}
                                    {perPcRate > 0 && (
                                      <div style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 600 }}>
                                        {getCurrencySymbol(cur)}{perPcRate.toFixed(2)}/pc
                                      </div>
                                    )}
                                    {rate && uom && uom !== "per Pc" && (
                                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                        Rate: {getCurrencySymbol(cur)}{rate} ({uom})
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
                            {(() => {
                              const isRec = r.isMaterialRec === "Yes" || cargo?.isMaterialRec === "Yes" || Boolean(cargo?.receivedDate);
                              return (
                                <span style={{ fontWeight: 700, fontSize: "0.78rem", color: isRec ? "var(--success)" : "var(--danger)" }}>
                                  {isRec ? "Yes" : (r.isMaterialRec || "No")}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Packing Purchased Status */}
                          <td>
                            {r.packingOrderedByNitin === "Yes" ? (
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "3px", 
                                padding: "2px 7px", 
                                borderRadius: "6px", 
                                fontSize: "0.74rem", 
                                fontWeight: 700, 
                                background: "rgba(236, 72, 153, 0.12)", 
                                color: "#ec4899", 
                                border: "1px solid rgba(236, 72, 153, 0.3)" 
                              }}>
                                📦 {isNitin ? "Purchased" : "Yes"}
                              </span>
                            ) : (
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "3px", 
                                padding: "2px 7px", 
                                borderRadius: "6px", 
                                fontSize: "0.74rem", 
                                fontWeight: 600, 
                                background: "rgba(245, 158, 11, 0.1)", 
                                color: "#f59e0b", 
                                border: "1px solid rgba(245, 158, 11, 0.25)" 
                              }}>
                                ⏳ Pending
                              </span>
                            )}
                          </td>

                          {/* Cargo Documents */}
                          <td>
                            {cargo && ((cargo.packingListFile && cargo.packingListData) || (cargo.invoiceFile && cargo.invoiceData) || (cargo.cargoReceiptFile && cargo.cargoReceiptData)) ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                {cargo.packingListFile && cargo.packingListData && (
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
                                {cargo.invoiceFile && cargo.invoiceData && (
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
                                {cargo.cargoReceiptFile && cargo.cargoReceiptData && (
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

                          {activeTab === "submitted" && (
                            <>
                              <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap", color: "var(--text-main)" }}>
                                {isNitin 
                                  ? (r.packingOrderedAt ? formatPunchDateTime(r.packingOrderedAt) : "—")
                                  : (r.purchaseUpdatedAt ? formatPunchDateTime(r.purchaseUpdatedAt) : "—")}
                              </td>
                              <td style={{ fontSize: "0.82rem", fontWeight: 700, color: isNitin ? "#ec4899" : "#10b981", whiteSpace: "nowrap" }}>
                                👤 {isNitin 
                                  ? (r.packingOrderedBy || (r.packingOrderedAt ? "Mr. Nitin (Packing)" : "Nitin (Packing)"))
                                  : (r.purchaseUpdatedBy || (r.purchaseUpdatedAt ? "Mr. Rahul Mann" : "Rahul Accounts"))}
                              </td>
                            </>
                          )}
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

      {/* ==================== GROUPED ORDER INSPECTION & BATCH MODAL ==================== */}
      {selectedOrderGroup && (
        <GroupedOrderModal
          orderGroup={selectedOrderGroup}
          requests={requests}
          cargos={cargos}
          vendors={vendors}
          cargoCompanies={cargoCompanies}
          purchasers={purchasers}
          currentUser={currentUser}
          onClose={() => setSelectedOrderGroup(null)}
          onBatchUpdateRequests={onBatchUpdateRequests}
          onInspectSingleOrder={(singleOrder) => setInspectedOrder(singleOrder)}
          onOpenDocument={handleOpenDocument}
          onEditCargo={(cargoToEdit) => setEditingCargo(cargoToEdit)}
          markingMode={isNitin ? "packing" : "accounts"}
        />
      )}

      {/* ==================== EDIT CARGO MODAL ==================== */}
      {editingCargo && (
        <EditCargoModal
          cargo={editingCargo}
          cargos={cargos}
          requests={requests}
          cargoCompanies={cargoCompanies}
          purchasers={purchasers}
          vendors={vendors}
          onClose={() => setEditingCargo(null)}
          onSave={(updatedCargo) => {
            if (onUpdateCargo) onUpdateCargo(updatedCargo);
            setEditingCargo(null);
          }}
        />
      )}

    </div>
  );
}
