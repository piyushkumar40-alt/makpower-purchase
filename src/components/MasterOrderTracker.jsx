import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Calendar, 
  Layers, 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpDown, 
  ArrowRight, 
  Download, 
  X, 
  RefreshCw, 
  Clock, 
  Building2, 
  User, 
  Eye, 
  Ban,
  FileSpreadsheet,
  Trash2,
  CheckSquare
} from "lucide-react";
import { AdminDeleteConfirmModal } from "./AdminDeleteConfirmModal";
import { isRequestForUser, getPurchaserDisplayName } from "../utils/formatters";

export function getOrderStage(r, cargo) {
  if (r.status === "Cancelled") {
    return {
      key: "cancelled",
      step: 0,
      label: "Cancelled",
      badgeColor: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(239, 68, 68, 0.3)",
      stepTarget: "cancelled",
      desc: "Order has been cancelled"
    };
  }
  if (r.isMaterialRec === "Yes") {
    return {
      key: "received",
      step: 5,
      label: "Received in Warehouse",
      badgeColor: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      stepTarget: "all",
      desc: r.receivedDate || cargo?.receivedDate ? `Received on ${r.receivedDate || cargo?.receivedDate}` : "Material Received"
    };
  }
  if (r.cargoPickupDate || (cargo && cargo.cargoShippingDate)) {
    return {
      key: "pickedup",
      step: 4,
      label: "In Freight Transit",
      badgeColor: "#6366f1",
      bgColor: "rgba(99, 102, 241, 0.12)",
      borderColor: "rgba(99, 102, 241, 0.3)",
      stepTarget: "shipments",
      desc: r.cargoPickupDate ? `Picked up: ${r.cargoPickupDate}` : (cargo?.cargoShippingDate ? `Shipped: ${cargo.cargoShippingDate}` : "In Transit")
    };
  }
  if (r.cargoId) {
    return {
      key: "cargo",
      step: 3,
      label: "Cargo Consolidated",
      badgeColor: "#06b6d4",
      bgColor: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      stepTarget: "cargopickup",
      desc: `In Cargo: ${r.cargoId}`
    };
  }
  if (r.vendorReadyDate) {
    return {
      key: "vendorready",
      step: 2,
      label: "Ready at Vendor",
      badgeColor: "#22c55e",
      bgColor: "rgba(34, 197, 94, 0.12)",
      borderColor: "rgba(34, 197, 94, 0.3)",
      stepTarget: "planner",
      desc: `Ready Date: ${r.vendorReadyDate}`
    };
  }
  if (r.priceRmb) {
    return {
      key: "priced",
      step: 1.5,
      label: "Priced (Production Pending)",
      badgeColor: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      stepTarget: "vendorready",
      desc: `Price: ¥${r.priceRmb} | EDD: ${r.vendorEdd || "Pending"}`
    };
  }
  return {
    key: "step1",
    step: 1,
    label: "Step 1: Starting (Unpriced)",
    badgeColor: "#94a3b8",
    bgColor: "rgba(148, 163, 184, 0.12)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    stepTarget: "pending",
    desc: `Awaiting Pricing (Req: ${r.requiredByDate || r.orderDate || "—"})`
  };
}

export default function MasterOrderTracker({
  requests = [],
  vendors = [],
  cargos = [],
  cargoCompanies = [],
  purchasers = [],
  currentUser,
  isPurchaseManager = false,
  isSearchAdmin = false,
  isAdmin: propIsAdmin,
  onEditRequest,
  onNavigateStep,
  onDeleteRequests
}) {
  const isAdmin = Boolean(
    propIsAdmin ||
    isSearchAdmin ||
    currentUser?.role === "superadmin" ||
    currentUser?.role === "owner" ||
    currentUser?.role === "admin"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [purchaserFilter, setPurchaserFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [sortField, setSortField] = useState("orderDate");
  const [sortDirection, setSortDirection] = useState("desc");

  // Selection & Admin Delete state
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [adminDeleteConfirm, setAdminDeleteConfirm] = useState(null);

  const accessibleRequests = useMemo(() => {
    if (isAdmin || isPurchaseManager) {
      return requests || [];
    }
    return (requests || []).filter(r => isRequestForUser(r, currentUser, purchasers));
  }, [requests, isAdmin, isPurchaseManager, currentUser, purchasers]);

  const vendorMap = useMemo(() => {
    const map = {};
    (vendors || []).forEach(v => { map[v.id] = v; });
    return map;
  }, [vendors]);

  const cargoMap = useMemo(() => {
    const map = {};
    (cargos || []).forEach(c => { map[c.id] = c; });
    return map;
  }, [cargos]);

  const purchaserMap = useMemo(() => {
    const map = {};
    (purchasers || []).forEach(p => { map[p.id] = p; });
    return map;
  }, [purchasers]);

  const enrichedRequests = useMemo(() => {
    return accessibleRequests.map(r => {
      const cargo = r.cargoId ? cargoMap[r.cargoId] : null;
      const vendor = r.vendorId ? vendorMap[r.vendorId] : null;
      const purchaser = (r.purchaserId && purchaserMap[r.purchaserId]) ? purchaserMap[r.purchaserId] : { id: r.purchaserId || "u-himanshi", name: getPurchaserDisplayName(r, purchasers) };
      const stage = getOrderStage(r, cargo);
      const effectiveOrderDate = r.orderDate || (r.createdAt ? r.createdAt.split("T")[0] : "") || r.requiredByDate || "";
      const effectiveQty = parseInt(r.vendorOrderQuantity || r.orderQuantity || 0, 10);
      const unitPrice = parseFloat(r.priceRmb || 0);
      const totalRmb = parseFloat(r.totalRmb || (unitPrice > 0 ? unitPrice * effectiveQty : 0));

      return {
        ...r,
        _cargo: cargo,
        _vendor: vendor,
        _purchaser: purchaser,
        _stage: stage,
        _effectiveOrderDate: effectiveOrderDate,
        _effectiveQty: effectiveQty,
        _unitPrice: unitPrice,
        _totalRmb: totalRmb
      };
    });
  }, [accessibleRequests, cargoMap, vendorMap, purchaserMap]);

  // Helper to test if a request matches current filters (allowing one filter key to be excluded for calculating facet options)
  const matchesFilter = (r, excludeKey = "") => {
    // 1. Purchaser Filter
    if (excludeKey !== "purchaser" && (isAdmin || isPurchaseManager) && purchaserFilter !== "all") {
      const targetPurchaser = (purchasers || []).find(p => p.id === purchaserFilter) || { id: purchaserFilter };
      if (!isRequestForUser(r, targetPurchaser, purchasers)) return false;
    }

    // 2. Stage Filter
    if (excludeKey !== "stage" && stageFilter !== "all") {
      if (stageFilter === "in_progress") {
        if (r._stage.key === "received" || r._stage.key === "cancelled") return false;
      } else if (r._stage.key !== stageFilter) {
        return false;
      }
    }

    // 3. Vendor Filter
    if (excludeKey !== "vendor" && vendorFilter && r.vendorId !== vendorFilter) {
      return false;
    }

    // 4. Cargo Filter
    if (excludeKey !== "cargo" && cargoFilter) {
      if (cargoFilter === "no_cargo") {
        if (r.cargoId) return false;
      } else if (r.cargoId !== cargoFilter) {
        return false;
      }
    }

    // 5. Date Filters
    if (excludeKey !== "date") {
      if (fromDate && (!r._effectiveOrderDate || r._effectiveOrderDate < fromDate)) return false;
      if (toDate && (!r._effectiveOrderDate || r._effectiveOrderDate > toDate)) return false;
    }

    // 6. Search Query
    if (excludeKey !== "search" && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const modelMatch = (r.model || "").toLowerCase().includes(q);
      const idMatch = (r.id || "").toLowerCase().includes(q);
      const vendorMatch = (r._vendor?.name || "").toLowerCase().includes(q);
      const cargoMatch = (r.cargoId || "").toLowerCase().includes(q);
      const purchaserMatch = (r._purchaser?.name || "").toLowerCase().includes(q);
      const remarksMatch = (r.remarks || "").toLowerCase().includes(q);

      if (!modelMatch && !idMatch && !vendorMatch && !cargoMatch && !purchaserMatch && !remarksMatch) {
        return false;
      }
    }

    return true;
  };

  // 1. Stage facet candidate requests & counts (interlocked with vendor, cargo, purchaser, dates, search)
  const candidateForStage = useMemo(() => {
    return enrichedRequests.filter(r => matchesFilter(r, "stage"));
  }, [enrichedRequests, vendorFilter, cargoFilter, purchaserFilter, fromDate, toDate, searchQuery, isAdmin, isPurchaseManager]);

  const stageCounts = useMemo(() => {
    const counts = {
      total: candidateForStage.length,
      totalPcs: 0,
      step1: 0,
      priced: 0,
      vendorready: 0,
      cargo: 0,
      pickedup: 0,
      received: 0,
      cancelled: 0
    };

    candidateForStage.forEach(r => {
      counts.totalPcs += r._effectiveQty;
      if (counts[r._stage.key] !== undefined) {
        counts[r._stage.key]++;
      }
    });

    return counts;
  }, [candidateForStage]);

  // 2. Vendor facet candidate requests & relevant vendors (interlocked with stage, cargo, purchaser, dates, search)
  const candidateForVendor = useMemo(() => {
    return enrichedRequests.filter(r => matchesFilter(r, "vendor"));
  }, [enrichedRequests, stageFilter, cargoFilter, purchaserFilter, fromDate, toDate, searchQuery, isAdmin, isPurchaseManager]);

  const relevantVendors = useMemo(() => {
    const vendorCountMap = {};
    candidateForVendor.forEach(r => {
      if (r.vendorId) {
        vendorCountMap[r.vendorId] = (vendorCountMap[r.vendorId] || 0) + 1;
      }
    });

    const list = (vendors || [])
      .filter(v => {
        if (String(v.status || "Active").trim().toLowerCase() === "inactive") return false;
        return (vendorCountMap[v.id] || 0) > 0;
      })
      .map(v => ({
        ...v,
        count: vendorCountMap[v.id] || 0
      }));

    // Fallback if vendor not in `vendors` list
    Object.keys(vendorCountMap).forEach(vid => {
      if (!list.some(v => v.id === vid)) {
        const found = vendorMap[vid];
        list.push({
          id: vid,
          name: found?.name || `Vendor #${vid}`,
          count: vendorCountMap[vid]
        });
      }
    });

    return list.sort((a, b) => b.count - a.count || (a.name || "").localeCompare(b.name || ""));
  }, [vendors, candidateForVendor, vendorMap]);

  // 3. Cargo facet candidate requests & relevant cargos (interlocked with stage, vendor, purchaser, dates, search)
  const candidateForCargo = useMemo(() => {
    return enrichedRequests.filter(r => matchesFilter(r, "cargo"));
  }, [enrichedRequests, stageFilter, vendorFilter, purchaserFilter, fromDate, toDate, searchQuery, isAdmin, isPurchaseManager]);

  const noCargoCount = useMemo(() => {
    return candidateForCargo.filter(r => !r.cargoId).length;
  }, [candidateForCargo]);

  const relevantCargos = useMemo(() => {
    const cargoCountMap = {};
    candidateForCargo.forEach(r => {
      if (r.cargoId) {
        cargoCountMap[r.cargoId] = (cargoCountMap[r.cargoId] || 0) + 1;
      }
    });

    const list = (cargos || [])
      .filter(c => (cargoCountMap[c.id] || 0) > 0)
      .map(c => ({
        ...c,
        count: cargoCountMap[c.id] || 0
      }));

    // Fallback if cargo not in `cargos` list
    Object.keys(cargoCountMap).forEach(cid => {
      if (!list.some(c => c.id === cid)) {
        const found = cargoMap[cid];
        list.push({
          id: cid,
          vendorId: found?.vendorId,
          cargoOrderDate: found?.cargoOrderDate,
          count: cargoCountMap[cid]
        });
      }
    });

    return list.sort((a, b) => (b.cargoOrderDate || b.id || "").localeCompare(a.cargoOrderDate || a.id || ""));
  }, [cargos, candidateForCargo, cargoMap]);

  // 4. Purchaser facet candidate requests & relevant purchasers (interlocked with stage, vendor, cargo, dates, search)
  const candidateForPurchaser = useMemo(() => {
    return enrichedRequests.filter(r => matchesFilter(r, "purchaser"));
  }, [enrichedRequests, stageFilter, vendorFilter, cargoFilter, fromDate, toDate, searchQuery, isAdmin, isPurchaseManager]);

  const relevantPurchasers = useMemo(() => {
    const purchaserCountMap = {};
    candidateForPurchaser.forEach(r => {
      if (r.purchaserId) {
        purchaserCountMap[r.purchaserId] = (purchaserCountMap[r.purchaserId] || 0) + 1;
      }
    });

    const list = (purchasers || [])
      .filter(p => (purchaserCountMap[p.id] || 0) > 0)
      .map(p => ({
        ...p,
        count: purchaserCountMap[p.id] || 0
      }));

    Object.keys(purchaserCountMap).forEach(pid => {
      if (!list.some(p => p.id === pid)) {
        const found = purchaserMap[pid];
        list.push({
          id: pid,
          name: found?.name || `Purchaser #${pid}`,
          count: purchaserCountMap[pid]
        });
      }
    });

    return list.sort((a, b) => b.count - a.count || (a.name || "").localeCompare(b.name || ""));
  }, [purchasers, candidateForPurchaser, purchaserMap]);

  // Auto-reset purchaser filter if previously selected purchaser has no matching orders under new filters
  useEffect(() => {
    if (purchaserFilter !== "all") {
      const exists = relevantPurchasers.some(p => p.id === purchaserFilter);
      if (!exists) {
        setPurchaserFilter("all");
      }
    }
  }, [relevantPurchasers, purchaserFilter]);

  // Auto-reset cargo filter if previously selected cargo has no matching orders under new filters
  useEffect(() => {
    if (cargoFilter) {
      if (cargoFilter === "no_cargo") {
        if (noCargoCount === 0) setCargoFilter("");
      } else {
        const exists = relevantCargos.some(c => c.id === cargoFilter);
        if (!exists) {
          setCargoFilter("");
        }
      }
    }
  }, [relevantCargos, cargoFilter, noCargoCount]);

  // Auto-reset vendor filter if previously selected vendor has no matching orders under new filters
  useEffect(() => {
    if (vendorFilter) {
      const exists = relevantVendors.some(v => v.id === vendorFilter);
      if (!exists) {
        setVendorFilter("");
      }
    }
  }, [relevantVendors, vendorFilter]);

  // 5. Final filtered requests (all active filters applied)
  const filteredRequests = useMemo(() => {
    return enrichedRequests.filter(r => matchesFilter(r));
  }, [enrichedRequests, stageFilter, vendorFilter, cargoFilter, purchaserFilter, fromDate, toDate, searchQuery, isAdmin, isPurchaseManager]);

  const sortedRequests = useMemo(() => {
    const list = [...filteredRequests];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "orderDate") {
        valA = a._effectiveOrderDate || "";
        valB = b._effectiveOrderDate || "";
      } else if (sortField === "stage") {
        valA = a._stage.step;
        valB = b._stage.step;
      } else if (sortField === "vendor") {
        valA = a._vendor?.name || "";
        valB = b._vendor?.name || "";
      } else if (sortField === "qty") {
        valA = a._effectiveQty;
        valB = b._effectiveQty;
      } else if (sortField === "price") {
        valA = a._unitPrice;
        valB = b._unitPrice;
      } else if (sortField === "cargo") {
        valA = a.cargoId || "";
        valB = b.cargoId || "";
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRequests, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCsv = () => {
    if (sortedRequests.length === 0) return;

    const headers = [
      "Order Date",
      "Model / Item",
      "Order Qty (Pcs)",
      "Current Stage",
      "Stage Milestone",
      "Vendor",
      "Cargo ID",
      "Vendor Ready Date",
      "Cargo Pickup Date",
      "Received Date",
      "Unit Price (RMB)",
      "Total Amount (RMB)",
      "Purchaser",
      "Status"
    ];

    const rows = sortedRequests.map(r => [
      `"${r._effectiveOrderDate || ""}"`,
      `"${(r.model || "").replace(/"/g, '""')}"`,
      r._effectiveQty,
      `"${r._stage.label}"`,
      `"${r._stage.desc.replace(/"/g, '""')}"`,
      `"${(r._vendor?.name || "").replace(/"/g, '""')}"`,
      `"${r.cargoId || ""}"`,
      `"${r.vendorReadyDate || ""}"`,
      `"${r.cargoPickupDate || ""}"`,
      `"${r.receivedDate || r._cargo?.receivedDate || ""}"`,
      r._unitPrice || "",
      r._totalRmb || "",
      `"${(r._purchaser?.name || "").replace(/"/g, '""')}"`,
      `"${r.status || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `master_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStageFilter("all");
    setVendorFilter("");
    setCargoFilter("");
    setPurchaserFilter("all");
    setFromDate("");
    setToDate("");
  };

  const hasActiveFilters = searchQuery || stageFilter !== "all" || vendorFilter || cargoFilter || purchaserFilter !== "all" || fromDate || toDate;

  // Selected orders metrics
  const selectedRequests = useMemo(() => {
    if (selectedOrderIds.length === 0) return [];
    const idSet = new Set(selectedOrderIds);
    return enrichedRequests.filter(r => idSet.has(r.id));
  }, [enrichedRequests, selectedOrderIds]);

  const totalSelectedQty = useMemo(() => {
    return selectedRequests.reduce((sum, r) => sum + r._effectiveQty, 0);
  }, [selectedRequests]);

  const totalSelectedRmb = useMemo(() => {
    return selectedRequests.reduce((sum, r) => sum + r._totalRmb, 0);
  }, [selectedRequests]);

  // Selection actions
  const toggleSelectRow = (id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (sortedRequests.length === 0) return;
    const allFilteredSelected = sortedRequests.every(r => selectedOrderIds.includes(r.id));
    if (allFilteredSelected) {
      const sortedIds = new Set(sortedRequests.map(r => r.id));
      setSelectedOrderIds(prev => prev.filter(id => !sortedIds.has(id)));
    } else {
      const currentSet = new Set(selectedOrderIds);
      sortedRequests.forEach(r => currentSet.add(r.id));
      setSelectedOrderIds(Array.from(currentSet));
    }
  };

  const handleSelectAllFiltered = () => {
    const currentSet = new Set(selectedOrderIds);
    sortedRequests.forEach(r => currentSet.add(r.id));
    setSelectedOrderIds(Array.from(currentSet));
  };

  const handleClearSelection = () => {
    setSelectedOrderIds([]);
  };

  const handleTriggerBatchDelete = () => {
    if (selectedOrderIds.length === 0) return;
    setAdminDeleteConfirm({
      title: `Delete Selected Orders (${selectedOrderIds.length})`,
      description: `Permanently delete ${selectedOrderIds.length} selected order(s) across all stages from the Master Tracker. This action is irreversible.`,
      requestIds: selectedOrderIds,
      targets: selectedRequests
    });
  };

  const handleConfirmDelete = async (reason) => {
    if (!adminDeleteConfirm || !onDeleteRequests) return;
    try {
      const { requestIds } = adminDeleteConfirm;
      await onDeleteRequests(requestIds, reason || `Admin deleted ${requestIds.length} order(s) from Master Order Tracker`);
      const deletedSet = new Set(requestIds);
      setSelectedOrderIds(prev => prev.filter(id => !deletedSet.has(id)));
      setAdminDeleteConfirm(null);
    } catch (err) {
      console.error("Batch delete failed:", err);
      alert("Failed to delete orders: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="card-fade-in" style={{ paddingBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers size={24} style={{ color: "#38bdf8" }} /> Master Order Tracker
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "4px", marginBottom: 0 }}>
            Track every purchase order item-wise from initial placement, vendor readiness, cargo consolidation, to warehouse receipt.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <RefreshCw size={14} /> Clear Filters
            </button>
          )}
          <button onClick={exportToCsv} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}>
            <FileSpreadsheet size={15} /> Export CSV ({sortedRequests.length})
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div 
          onClick={() => setStageFilter("all")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "all" ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
            background: stageFilter === "all" ? "rgba(56, 189, 248, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>Total Orders</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "var(--text-main)" }}>
            {stageCounts.total} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>({stageCounts.totalPcs.toLocaleString()} Pcs)</span>
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("step1")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "step1" ? "2px solid #94a3b8" : "1px solid var(--border-glass)",
            background: stageFilter === "step1" ? "rgba(148, 163, 184, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8" }}>Step 1: Unpriced</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#94a3b8" }}>
            {stageCounts.step1}
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("priced")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "priced" ? "2px solid #f59e0b" : "1px solid var(--border-glass)",
            background: stageFilter === "priced" ? "rgba(245, 158, 11, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#f59e0b" }}>Priced (In Prod)</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#f59e0b" }}>
            {stageCounts.priced}
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("vendorready")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "vendorready" ? "2px solid #22c55e" : "1px solid var(--border-glass)",
            background: stageFilter === "vendorready" ? "rgba(34, 197, 94, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#22c55e" }}>Step 2: Ready at Vendor</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#22c55e" }}>
            {stageCounts.vendorready}
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("cargo")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "cargo" ? "2px solid #06b6d4" : "1px solid var(--border-glass)",
            background: stageFilter === "cargo" ? "rgba(6, 182, 212, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#06b6d4" }}>Step 3: In Cargo Batch</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#06b6d4" }}>
            {stageCounts.cargo}
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("pickedup")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "pickedup" ? "2px solid #6366f1" : "1px solid var(--border-glass)",
            background: stageFilter === "pickedup" ? "rgba(99, 102, 241, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#6366f1" }}>Step 4: Picked Up</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#6366f1" }}>
            {stageCounts.pickedup}
          </div>
        </div>

        <div 
          onClick={() => setStageFilter("received")}
          className="glass-panel" 
          style={{ 
            padding: "14px 16px", 
            cursor: "pointer", 
            border: stageFilter === "received" ? "2px solid #10b981" : "1px solid var(--border-glass)",
            background: stageFilter === "received" ? "rgba(16, 185, 129, 0.08)" : undefined
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#10b981" }}>Step 5: Received</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "4px", color: "#10b981" }}>
            {stageCounts.received}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "18px 20px", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", alignItems: "flex-end" }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Search size={14} /> Search Model / Order
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search model, remarks, order ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: searchQuery ? "28px" : undefined }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "2px"
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Stage</label>
            <select
              className="form-control"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              style={{ fontWeight: 600, borderColor: stageFilter !== "all" ? "var(--primary)" : undefined }}
            >
              <option value="all">🌐 All Stages ({stageCounts.total})</option>
              <option value="in_progress">⏳ All Active / In Progress ({stageCounts.total - stageCounts.received - stageCounts.cancelled})</option>
              <option value="step1">📝 Step 1: Starting (Unpriced) ({stageCounts.step1})</option>
              <option value="priced">💰 Priced (Production Pending) ({stageCounts.priced})</option>
              <option value="vendorready">🏭 Step 2: Ready at Vendor ({stageCounts.vendorready})</option>
              <option value="cargo">📦 Step 3: Cargo Consolidated ({stageCounts.cargo})</option>
              <option value="pickedup">🚚 Step 4: Picked Up / In Transit ({stageCounts.pickedup})</option>
              <option value="received">✅ Step 5: Received in Warehouse ({stageCounts.received})</option>
              <option value="cancelled">🚫 Cancelled Orders ({stageCounts.cancelled})</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={14} /> Filter by Vendor
            </label>
            <select
              className="form-control"
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              style={{ fontWeight: 500, borderColor: vendorFilter ? "var(--primary)" : undefined }}
            >
              <option value="">All Vendors ({relevantVendors.length})</option>
              {relevantVendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.count} items)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Package size={14} /> Filter by Cargo Batch
            </label>
            <select
              className="form-control"
              value={cargoFilter}
              onChange={e => setCargoFilter(e.target.value)}
              style={{ fontWeight: 500, borderColor: cargoFilter ? "var(--primary)" : undefined }}
            >
              <option value="">All Cargo Batches ({relevantCargos.length})</option>
              {noCargoCount > 0 && (
                <option value="no_cargo">⚠️ Orders Not Yet in Any Cargo ({noCargoCount} items)</option>
              )}
              {relevantCargos.map(c => {
                const vName = vendorMap[c.vendorId]?.name || "Vendor";
                return (
                  <option key={c.id} value={c.id}>
                    📦 {c.id} ({vName}, {c.count} items)
                  </option>
                );
              })}
            </select>
          </div>

          {(isAdmin || isPurchaseManager) && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <User size={14} /> Filter by Purchaser
              </label>
              <select
                className="form-control"
                value={purchaserFilter}
                onChange={e => setPurchaserFilter(e.target.value)}
                style={{ fontWeight: 600, borderColor: purchaserFilter !== "all" ? "var(--primary)" : undefined }}
              >
                <option value="all">👥 All Purchasers ({candidateForPurchaser.length} items)</option>
                {relevantPurchasers.map(p => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name} ({p.count} items)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={14} /> Order Date From
            </label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={14} /> Order Date To
            </label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>

        </div>
      </div>

      <div className="glass-panel" style={{ padding: "6px" }}>
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
              Showing <span style={{ color: "#38bdf8" }}>{sortedRequests.length}</span> of {enrichedRequests.length} Orders
              {hasActiveFilters && (
                <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>
                  (Filtered)
                </span>
              )}
            </div>

            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {selectedOrderIds.length > 0 ? (
                  <>
                    <span
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      📌 {selectedOrderIds.length} Selected ({totalSelectedQty.toLocaleString()} Pcs)
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                      title="Clear selection"
                    >
                      ✕ Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerBatchDelete}
                      className="btn btn-danger btn-sm"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        padding: "5px 12px",
                        background: "#ef4444",
                        color: "#ffffff",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(239, 68, 68, 0.35)",
                        cursor: "pointer"
                      }}
                      title={`Permanently delete ${selectedOrderIds.length} selected orders`}
                    >
                      <Trash2 size={13} /> Delete Selected ({selectedOrderIds.length})
                    </button>
                  </>
                ) : (
                  sortedRequests.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.76rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      title="Select all orders currently shown"
                    >
                      <CheckSquare size={12} /> Select All Filtered ({sortedRequests.length})
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            💡 Click on any <strong>Item / Model</strong> to edit details, or click a <strong>Stage Badge</strong> to jump to that workflow step.
          </div>
        </div>

        {sortedRequests.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle2 size={40} style={{ color: "#38bdf8", marginBottom: "12px", display: "inline" }} /><br />
            No orders match the selected filters.
            <div style={{ marginTop: "12px" }}>
              <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                Reset All Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: "0.88rem" }}>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: "42px", textAlign: "center", padding: "8px 6px" }}>
                      <input
                        type="checkbox"
                        checked={sortedRequests.length > 0 && sortedRequests.every(r => selectedOrderIds.includes(r.id))}
                        ref={el => {
                          if (el) {
                            const isSome = sortedRequests.some(r => selectedOrderIds.includes(r.id));
                            const isAll = sortedRequests.length > 0 && sortedRequests.every(r => selectedOrderIds.includes(r.id));
                            el.indeterminate = isSome && !isAll;
                          }
                        }}
                        onChange={toggleSelectAll}
                        style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#ef4444" }}
                        title={
                          sortedRequests.length > 0 && sortedRequests.every(r => selectedOrderIds.includes(r.id))
                            ? "Deselect all filtered orders"
                            : `Select all ${sortedRequests.length} filtered orders`
                        }
                      />
                    </th>
                  )}
                  <th onClick={() => handleSort("orderDate")} style={{ cursor: "pointer", minWidth: "105px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Order Date <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort("model")} style={{ cursor: "pointer", minWidth: "160px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Item / Model <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort("qty")} style={{ cursor: "pointer", minWidth: "90px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Qty <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort("stage")} style={{ cursor: "pointer", minWidth: "180px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Current Stage & Where It Is <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort("vendor")} style={{ cursor: "pointer", minWidth: "130px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Vendor <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => handleSort("cargo")} style={{ cursor: "pointer", minWidth: "140px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Cargo Batch <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ minWidth: "170px" }}>Milestone Dates</th>
                  <th onClick={() => handleSort("price")} style={{ cursor: "pointer", minWidth: "110px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      Commercials <ArrowUpDown size={12} />
                    </div>
                  </th>
                  {(isPurchaseManager || isSearchAdmin) && (
                    <th style={{ minWidth: "110px" }}>Purchaser</th>
                  )}
                  <th style={{ minWidth: "80px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map(r => {
                  const stage = r._stage;
                  const vName = r._vendor?.name || (r.vendorId ? "Unknown Vendor" : "Not Assigned");
                  const pName = r._purchaser?.name || "Purchaser";
                  const isSelected = selectedOrderIds.includes(r.id);

                  return (
                    <tr 
                      key={r.id}
                      style={{
                        background: isSelected ? "rgba(239, 68, 68, 0.08)" : undefined,
                        transition: "background 0.15s ease"
                      }}
                    >
                      {isAdmin && (
                        <td style={{ textAlign: "center", padding: "8px 6px" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(r.id)}
                            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#ef4444" }}
                            title={`Select order #${r.id} (${r.model})`}
                          />
                        </td>
                      )}
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        {r._effectiveOrderDate || "—"}
                      </td>

                      <td style={{ fontWeight: 600 }}>
                        <button
                          type="button"
                          onClick={() => onEditRequest && onEditRequest(r)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#38bdf8",
                            cursor: "pointer",
                            fontWeight: 700,
                            textAlign: "left",
                            padding: 0,
                            textDecoration: "underline",
                            fontSize: "inherit"
                          }}
                          title="Click to view/edit full order details"
                        >
                          {r.model}
                        </button>
                        {r.remarks && (
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.remarks}>
                            💬 {r.remarks}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 700 }}>
                          {r._effectiveQty.toLocaleString()} Pcs
                        </div>
                        {r.vendorOrderQuantity && r.vendorOrderQuantity !== r.orderQuantity && (
                          <div style={{ fontSize: "0.72rem", color: "#38bdf8" }}>
                            Req: {r.orderQuantity} Pcs
                          </div>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => onNavigateStep && onNavigateStep(stage.stepTarget)}
                          style={{
                            background: stage.bgColor,
                            color: stage.badgeColor,
                            border: `1px solid ${stage.borderColor}`,
                            borderRadius: "6px",
                            padding: "4px 10px",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            textAlign: "left",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                          }}
                          title={`Click to jump to ${stage.label}`}
                        >
                          {stage.label}
                          <ArrowRight size={11} />
                        </button>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                          {stage.desc}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 500, color: r.vendorId ? "var(--text-main)" : "#94a3b8" }}>
                          {vName}
                        </div>
                      </td>

                      <td>
                        {r.cargoId ? (
                          <div>
                            <span 
                              onClick={() => onNavigateStep && onNavigateStep("shipments")}
                              style={{ 
                                fontWeight: 700, 
                                color: "#06b6d4", 
                                cursor: "pointer",
                                fontSize: "0.82rem",
                                textDecoration: "underline"
                              }}
                              title="Click to view in Step 5: Transit Tracking"
                            >
                              📦 {r.cargoId}
                            </span>
                            {r._cargo?.modeOfTransport && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Mode: {r._cargo.modeOfTransport} {r._cargo.cargoEta ? `| ETA: ${r._cargo.cargoEta}` : ""}
                                {(() => {
                                  const cHist = Array.isArray(r._cargo?.cargoEtaHistory) ? r._cargo.cargoEtaHistory : (typeof r._cargo?.cargoEtaHistory === "string" ? JSON.parse(r._cargo?.cargoEtaHistory || "[]") : []);
                                  return cHist.length > 0 ? (
                                    <span style={{ marginLeft: "4px", color: "#f87171", fontWeight: 700 }} title={`${cHist.length} ETA reschedule(s) logged`}>({cHist.length} revs)</span>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            — Not in Cargo —
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: "0.76rem" }}>
                        {r.vendorEdd && (
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Vendor EDD:</span> <strong>{r.vendorEdd}</strong>
                            {(() => {
                              const hist = Array.isArray(r.vendorEddHistory) ? r.vendorEddHistory : (typeof r.vendorEddHistory === "string" ? JSON.parse(r.vendorEddHistory || "[]") : []);
                              return hist.length > 0 ? (
                                <span style={{ marginLeft: "4px", color: "#f87171", fontWeight: 700 }} title={`${hist.length} EDD reschedule(s) logged`}>({hist.length} revs)</span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {r.vendorReadyDate && (
                          <div style={{ color: "var(--success)" }}>
                            <span>Ready:</span> <strong>{r.vendorReadyDate}</strong>
                          </div>
                        )}
                        {r.cargoPickupDate && (
                          <div style={{ color: "#6366f1" }}>
                            <span>Picked Up:</span> <strong>{r.cargoPickupDate}</strong>
                          </div>
                        )}
                        {(r.receivedDate || r._cargo?.receivedDate) && (
                          <div style={{ color: "var(--success)" }}>
                            <span>Received:</span> <strong>{r.receivedDate || r._cargo?.receivedDate}</strong>
                          </div>
                        )}
                        {!r.vendorEdd && !r.vendorReadyDate && !r.cargoPickupDate && !r.receivedDate && (
                          <span style={{ color: "var(--text-muted)" }}>Dates Pending</span>
                        )}
                      </td>

                      <td>
                        {r._unitPrice > 0 ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>¥{r._unitPrice}</div>
                            {r._totalRmb > 0 && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Total: ¥{r._totalRmb.toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>Unpriced</span>
                        )}
                      </td>

                      {(isPurchaseManager || isSearchAdmin) && (
                        <td>
                          <span 
                            className="badge" 
                            style={{ 
                              fontSize: "0.72rem", 
                              background: isRequestForUser(r, currentUser, purchasers) ? "rgba(34, 197, 94, 0.12)" : "rgba(56, 189, 248, 0.12)", 
                              color: isRequestForUser(r, currentUser, purchasers) ? "var(--success)" : "var(--primary)" 
                            }}
                          >
                            👤 {pName}
                          </span>
                        </td>
                      )}

                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <button
                            type="button"
                            onClick={() => onEditRequest && onEditRequest(r)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Open order edit modal"
                          >
                            <Eye size={12} /> View
                          </button>
                          {onDeleteRequests && isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminDeleteConfirm({
                                  title: `Delete Order #${r.id} (${r.model})`,
                                  description: `Permanently delete complete order #${r.id} (${r.model}, ${r._effectiveQty.toLocaleString()} Pcs, Order Date: ${r._effectiveOrderDate || "—"}). This action is irreversible.`,
                                  requestIds: [r.id],
                                  targets: [r]
                                });
                              }}
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 6px", display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.18)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                              title="Permanently Delete Complete Order (Admin only)"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adminDeleteConfirm && (
        <AdminDeleteConfirmModal
          confirmData={adminDeleteConfirm}
          onClose={() => setAdminDeleteConfirm(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
