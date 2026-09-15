import React, { useState, useMemo } from "react";
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
  FileSpreadsheet
} from "lucide-react";

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
  onEditRequest,
  onNavigateStep
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [purchaserFilter, setPurchaserFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [sortField, setSortField] = useState("orderDate");
  const [sortDirection, setSortDirection] = useState("desc");

  const accessibleRequests = useMemo(() => {
    if (isSearchAdmin || isPurchaseManager) {
      return requests || [];
    }
    return (requests || []).filter(r => r.purchaserId === currentUser?.id);
  }, [requests, isSearchAdmin, isPurchaseManager, currentUser]);

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
      const purchaser = r.purchaserId ? purchaserMap[r.purchaserId] : null;
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

  const stageCounts = useMemo(() => {
    const counts = {
      total: enrichedRequests.length,
      totalPcs: 0,
      step1: 0,
      priced: 0,
      vendorready: 0,
      cargo: 0,
      pickedup: 0,
      received: 0,
      cancelled: 0
    };

    enrichedRequests.forEach(r => {
      counts.totalPcs += r._effectiveQty;
      if (counts[r._stage.key] !== undefined) {
        counts[r._stage.key]++;
      }
    });

    return counts;
  }, [enrichedRequests]);

  const filteredRequests = useMemo(() => {
    return enrichedRequests.filter(r => {
      if ((isPurchaseManager || isSearchAdmin) && purchaserFilter !== "all") {
        if (r.purchaserId !== purchaserFilter) return false;
      }

      if (stageFilter !== "all") {
        if (stageFilter === "in_progress") {
          if (r._stage.key === "received" || r._stage.key === "cancelled") return false;
        } else if (r._stage.key !== stageFilter) {
          return false;
        }
      }

      if (vendorFilter && r.vendorId !== vendorFilter) {
        return false;
      }

      if (cargoFilter) {
        if (cargoFilter === "no_cargo") {
          if (r.cargoId) return false;
        } else if (r.cargoId !== cargoFilter) {
          return false;
        }
      }

      if (fromDate) {
        if (!r._effectiveOrderDate || r._effectiveOrderDate < fromDate) return false;
      }
      if (toDate) {
        if (!r._effectiveOrderDate || r._effectiveOrderDate > toDate) return false;
      }

      if (searchQuery.trim()) {
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
    });
  }, [enrichedRequests, isPurchaseManager, isSearchAdmin, purchaserFilter, stageFilter, vendorFilter, cargoFilter, fromDate, toDate, searchQuery]);

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
              <option value="all">🌐 All Stages ({enrichedRequests.length})</option>
              <option value="in_progress">⏳ All Active / In Progress</option>
              <option value="step1">📝 Step 1: Starting (Unpriced)</option>
              <option value="priced">💰 Priced (Production Pending)</option>
              <option value="vendorready">🏭 Step 2: Ready at Vendor</option>
              <option value="cargo">📦 Step 3: Cargo Consolidated</option>
              <option value="pickedup">🚚 Step 4: Picked Up / In Transit</option>
              <option value="received">✅ Step 5: Received in Warehouse</option>
              <option value="cancelled">🚫 Cancelled Orders</option>
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
              <option value="">All Vendors ({vendors.length})</option>
              {vendors
                .filter(v => String(v.status || "Active").trim().toLowerCase() !== "inactive")
                .map(v => {
                  const count = enrichedRequests.filter(r => r.vendorId === v.id).length;
                  return (
                    <option key={v.id} value={v.id}>
                      {v.name} ({count} items)
                    </option>
                  );
                })}
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
              <option value="">All Cargo Batches ({cargos.length})</option>
              <option value="no_cargo">⚠️ Orders Not Yet in Any Cargo</option>
              {cargos.map(c => {
                const count = enrichedRequests.filter(r => r.cargoId === c.id).length;
                const vName = vendorMap[c.vendorId]?.name || "Vendor";
                return (
                  <option key={c.id} value={c.id}>
                    📦 {c.id} ({vName}, {count} items)
                  </option>
                );
              })}
            </select>
          </div>

          {(isPurchaseManager || isSearchAdmin) && (
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
                <option value="all">👥 All Purchasers</option>
                <option value={currentUser?.id}>👤 My Orders Only ({currentUser?.name})</option>
                {purchasers.filter(p => p.id !== currentUser?.id).map(p => (
                  <option key={p.id} value={p.id}>👤 {p.name}</option>
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
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
            Showing <span style={{ color: "#38bdf8" }}>{sortedRequests.length}</span> of {enrichedRequests.length} Orders
            {hasActiveFilters && (
              <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>
                (Filtered)
              </span>
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

                  return (
                    <tr key={r.id}>
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
                          <div><span style={{ color: "var(--text-muted)" }}>Vendor EDD:</span> <strong>{r.vendorEdd}</strong></div>
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
                              background: r.purchaserId === currentUser?.id ? "rgba(34, 197, 94, 0.12)" : "rgba(56, 189, 248, 0.12)", 
                              color: r.purchaserId === currentUser?.id ? "var(--success)" : "var(--primary)" 
                            }}
                          >
                            👤 {pName}
                          </span>
                        </td>
                      )}

                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => onEditRequest && onEditRequest(r)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="Open order edit modal"
                        >
                          <Eye size={12} /> View
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
    </div>
  );
}
