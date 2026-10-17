import React, { useState, useMemo, useEffect } from "react";
import { 
  Ship, 
  Plane, 
  Truck, 
  Calendar, 
  DollarSign, 
  Package, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Search, 
  Filter, 
  Layers, 
  Building2, 
  User, 
  ExternalLink, 
  Eye, 
  RefreshCw,
  X,
  AlertTriangle,
  Check,
  Edit3,
  Upload,
  CheckSquare,
  RotateCcw
} from "lucide-react";
import { downloadOrOpenBlob, getPurchaserDisplayName, getCurrencySymbol, calculateTotalCargoPrice, calculateBillSlaStatus } from "../utils/formatters";
import { uploadToCloudinary } from "../utils/upload";
import CustomSelect from "./CustomSelect";
import CargoDocumentModal from "./CargoDocumentModal";

export default function BundledUpcomingShipments({
  cargos = [],
  requests = [],
  vendors = [],
  cargoCompanies = [],
  purchasers = [],
  currentUser = {},
  isViewOnly = false,
  onBatchUpdateRequests,
  onUpdateCargo,
  initialStatusFilter = "upcoming"
}) {
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "upcoming"); // "upcoming" | "delivered" | "all" | "pending_bill_verification" | "missing_bill"

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const [vendorFilter, setVendorFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [purchaserFilter, setPurchaserFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Order Details Modal
  const [inspectedOrder, setInspectedOrder] = useState(null);
  // ETA Revision History Modal
  const [selectedEtaHistory, setSelectedEtaHistory] = useState(null);
  // Cargo Document Viewer & Attachment Modal
  const [viewingCargoDoc, setViewingCargoDoc] = useState(null);

  const handleOpenDocument = (cargo, docType, fileName, fileData, field, dataField) => {
    if (!fileName) return;

    let effectiveData = fileData;
    // Check if any bundled item has packing list data as fallback
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

  // Vendor & Carrier lookup maps
  const vendorMap = useMemo(() => {
    const map = {};
    (vendors || []).forEach(v => { map[v.id] = v; });
    return map;
  }, [vendors]);

  const carrierMap = useMemo(() => {
    const map = {};
    (cargoCompanies || []).forEach(cc => { map[cc.id] = cc; });
    return map;
  }, [cargoCompanies]);

  // Group requests by cargoId - ONLY TRANSIT GOODS (Exclude received items)
  const cargoItemsMap = useMemo(() => {
    const map = {};
    (requests || []).forEach(r => {
      if (r.cargoId && r.status !== "Cancelled" && r.isMaterialRec !== "Yes") {
        if (!map[r.cargoId]) map[r.cargoId] = [];
        map[r.cargoId].push(r);
      }
    });
    return map;
  }, [requests]);

  // Enriched Cargos - In-Transit Goods Only
  const enrichedCargos = useMemo(() => {
    return (cargos || [])
      .filter(cargo => {
        const isDelivered = cargo.isMaterialRec === "Yes" || cargo.status === "Delivered" || cargo.status === "Received";
        if (isDelivered) return false;
        const allItems = (requests || []).filter(r => r.cargoId === cargo.id && r.status !== "Cancelled");
        if (allItems.length > 0 && allItems.every(it => it.isMaterialRec === "Yes")) {
          return false;
        }
        return true;
      })
      .map(cargo => {
        const items = cargoItemsMap[cargo.id] || [];
        const totalUnits = items.reduce((sum, it) => sum + (Number(it.orderQuantity) || 0), 0);
        const totalValueRmb = items.reduce((sum, it) => {
          const qty = Number(it.orderQuantity) || 0;
          const price = Number(it.priceRmb) || 0;
          return sum + (Number(it.totalRmb) || (qty * price));
        }, 0);
        const vendorName = vendorMap[cargo.vendorId]?.name || "Multiple / Unspecified Vendors";
        const carrierName = carrierMap[cargo.cargoCompanyId]?.name || "Direct Logistics Carrier";

        return {
          ...cargo,
          items,
          totalUnits,
          totalValueRmb,
          vendorName,
          carrierName
        };
      });
  }, [cargos, requests, cargoItemsMap, vendorMap, carrierMap]);

  // Metrics Bar - In-Transit Goods Only
  const stats = useMemo(() => {
    const totalUnits = enrichedCargos.reduce((sum, c) => sum + c.totalUnits, 0);
    const totalValue = enrichedCargos.reduce((sum, c) => sum + c.totalValueRmb, 0);
    const totalFreight = enrichedCargos.reduce((sum, c) => sum + (calculateTotalCargoPrice(c) || 0), 0);
    const totalCbm = enrichedCargos.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);
    const pendingBillCount = enrichedCargos.filter(c => Boolean(c.invoiceFile && c.invoiceData) && c.billStatus !== "verified" && !c.billVerifiedAt).length;

    return {
      totalCargos: enrichedCargos.length,
      totalUnits,
      totalValue,
      totalFreight,
      totalCbm,
      pendingBillCount
    };
  }, [enrichedCargos]);

  // Filtered Cargos
  const filteredCargos = useMemo(() => {
    return enrichedCargos.filter(cargo => {
      // 1. Status Filter
      if (statusFilter === "pending_bill_verification" && (!cargo.invoiceFile || !cargo.invoiceData || cargo.billStatus === "verified" || cargo.billVerifiedAt)) return false;

      // 2. Vendor Filter
      if (vendorFilter && cargo.vendorId !== vendorFilter) return false;

      // 3. Carrier Filter
      if (carrierFilter && cargo.cargoCompanyId !== carrierFilter) return false;

      // 4. Purchaser Filter
      if (purchaserFilter) {
        const hasPurchaser = cargo.items.some(it => {
          const pName = getPurchaserDisplayName(it, purchasers).toLowerCase();
          const pId = String(it.purchaserId || "").toLowerCase();
          const fLower = purchaserFilter.toLowerCase();
          return pName.includes(fLower) || pId === fLower || (fLower.includes("rahul") && (pId === "u-rahul" || pId === "u-rahul-kumar" || pId === "rahul" || pName.includes("rahul")));
        });
        if (!hasPurchaser) return false;
      }

      // 5. Mode Filter
      if (modeFilter && (cargo.modeOfTransport || "").toLowerCase() !== modeFilter.toLowerCase()) return false;

      // 6. Date Range (Shipping Date or ETA)
      const targetDate = cargo.cargoEta || cargo.cargoShippingDate || cargo.cargoOrderDate || "";
      if (fromDate && targetDate && targetDate < fromDate) return false;
      if (toDate && targetDate && targetDate > toDate) return false;

      // 7. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const codeMatch = String(cargo.id || "").toLowerCase().includes(q);
        const detailMatch = String(cargo.cargoDetail || "").toLowerCase().includes(q);
        const vendorMatch = cargo.vendorName.toLowerCase().includes(q);
        const carrierMatch = cargo.carrierName.toLowerCase().includes(q);
        const itemMatch = cargo.items.some(it => 
          String(it.model || "").toLowerCase().includes(q) ||
          String(it.category || "").toLowerCase().includes(q)
        );
        if (!codeMatch && !detailMatch && !vendorMatch && !carrierMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedCargos, statusFilter, vendorFilter, carrierFilter, purchaserFilter, modeFilter, fromDate, toDate, searchQuery, purchasers]);

  const hasActiveFilters = Boolean(
    vendorFilter || carrierFilter || purchaserFilter || modeFilter || fromDate || toDate || searchQuery.trim() || statusFilter !== "upcoming"
  );

  const resetFilters = () => {
    setStatusFilter("upcoming");
    setVendorFilter("");
    setCarrierFilter("");
    setPurchaserFilter("");
    setModeFilter("");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
  };

  // Action: Mark purchase for all items in a cargo lot
  const handleMarkAllInCargo = async (cargoObj, status = "Yes") => {
    if (!onBatchUpdateRequests) return;
    const targetItems = status === "Yes"
      ? (cargoObj.items || []).filter(it => it.purchaseUpdated !== "Yes")
      : (cargoObj.items || []).filter(it => it.purchaseUpdated === "Yes");
    if (targetItems.length === 0) return;
    const updated = targetItems.map(it => ({
      ...it,
      purchaseUpdated: status
    }));
    await onBatchUpdateRequests(updated);
  };

  // Action: Toggle mark purchase for a single item (item-wise)
  const handleToggleItemPurchase = async (itemObj, status = "Yes") => {
    if (!onBatchUpdateRequests) return;
    const updated = {
      ...itemObj,
      purchaseUpdated: status
    };
    await onBatchUpdateRequests([updated]);
  };

  // Action: Rahul Accounts marks bill as verified / unverified
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

  // Action: Purchaser / Admin uploads or replaces packing list for cargo
  const handlePackingUpload = async (cargoObj, file) => {
    if (!file || !onUpdateCargo) return;
    const url = await uploadToCloudinary(file, "makpower_docs");
    const updatedCargo = {
      ...cargoObj,
      packingListFile: file.name,
      packingListData: url
    };
    await onUpdateCargo(updatedCargo);
  };

  // Action: Purchaser / Admin uploads or replaces vendor bill for cargo
  const handleBillUpload = async (cargoObj, file) => {
    if (!file || !onUpdateCargo) return;
    const url = await uploadToCloudinary(file, "makpower_docs");
    const now = new Date().toISOString();
    const updatedCargo = {
      ...cargoObj,
      invoiceFile: file.name,
      invoiceData: url,
      billUploadedAt: now,
      billUploadedBy: currentUser?.name || currentUser?.id || "Purchaser",
      billStatus: "pending_verification",
      billVerifiedAt: "",
      billVerifiedBy: ""
    };
    await onUpdateCargo(updatedCargo);
  };

  const vendorOptions = useMemo(() => [
    { value: "", label: "All Vendors" },
    ...vendors.map(v => ({ value: v.id, label: v.name }))
  ], [vendors]);

  const carrierOptions = useMemo(() => [
    { value: "", label: "All Carriers" },
    ...cargoCompanies.map(cc => ({ value: cc.id, label: cc.name }))
  ], [cargoCompanies]);

  const purchaserOptions = useMemo(() => [
    { value: "", label: "All Purchasers" },
    ...(purchasers || []).map(p => ({ value: p.id, label: p.name }))
  ], [purchasers]);

  const modeOptions = [
    { value: "", label: "All Modes" },
    { value: "Air", label: "Air" },
    { value: "Sea", label: "Sea" },
    { value: "Land", label: "Land" },
    { value: "Courier", label: "Courier" }
  ];

  return (
    <div className="card-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Ship size={24} style={{ color: "#38bdf8" }} /> Step 5: Transit Tracking & Warehouse Receipting
            <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "4px 8px" }}>
              🔒 View Only (Accounts Audit)
            </span>
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "4px", marginBottom: 0 }}>
            Inspect consolidated in-transit freight shipments, bundled purchase items, arrival schedules, and commercial values.
          </p>
        </div>

        {hasActiveFilters && (
          <button onClick={resetFilters} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={14} /> Clear Filters
          </button>
        )}
      </div>

      {/* KPI Accounts Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", marginBottom: "22px" }}>
        <div 
          onClick={() => setStatusFilter("upcoming")}
          className="glass-panel" 
          style={{ 
            padding: "16px", 
            cursor: "pointer", 
            border: (statusFilter === "upcoming" || statusFilter === "all") ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
            background: (statusFilter === "upcoming" || statusFilter === "all") ? "rgba(56, 189, 248, 0.08)" : undefined 
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#38bdf8" }}>In-Transit Cargos</span>
            <Ship size={18} style={{ color: "#38bdf8" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "var(--text-main)" }}>
            {stats.totalCargos} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>Cargos</span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {stats.totalUnits.toLocaleString()} Pcs bundled ({stats.totalCbm.toFixed(1)} CBM)
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#10b981" }}>In-Transit Goods Value</span>
            <DollarSign size={18} style={{ color: "#10b981" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "#10b981" }}>
            ¥{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Goods value currently on water / air freight
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#f59e0b" }}>Freight Cost Committed</span>
            <Truck size={18} style={{ color: "#f59e0b" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "#f59e0b" }}>
            ¥{stats.totalFreight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Carrier logistics freight expense
          </div>
        </div>

        {stats.pendingBillCount > 0 && (
          <div 
            onClick={() => setStatusFilter("pending_bill_verification")}
            className="glass-panel" 
            style={{ 
              padding: "16px", 
              cursor: "pointer", 
              border: statusFilter === "pending_bill_verification" ? "2px solid #f59e0b" : "1px solid rgba(245, 158, 11, 0.35)",
              background: "rgba(245, 158, 11, 0.08)" 
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#f59e0b" }}>Step 2: Bills to Verify</span>
              <FileText size={18} style={{ color: "#f59e0b" }} />
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "#f59e0b" }}>
              {stats.pendingBillCount} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>Pending</span>
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Uploaded by purchaser • 4-day SLA
            </div>
          </div>
        )}
      </div>

      {/* Multi-Level Filtration Panel */}
      <div className="glass-panel" style={{ padding: "18px 20px", marginBottom: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "0.88rem", color: "var(--primary)" }}>
            <Filter size={16} /> Multi-Level Shipment Filters
          </div>

          {/* Quick Status Chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setStatusFilter("upcoming")}
              className={`btn btn-sm ${(statusFilter === "upcoming" || statusFilter === "all") ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.74rem", padding: "3px 10px" }}
            >
              🚢 In Freight Transit ({stats.totalCargos})
            </button>
            {stats.pendingBillCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("pending_bill_verification")}
                className={`btn btn-sm ${statusFilter === "pending_bill_verification" ? "btn-warning" : "btn-secondary"}`}
                style={{ fontSize: "0.74rem", padding: "3px 10px", fontWeight: 700 }}
              >
                📋 Step 2: Pending Bill Verification ({stats.pendingBillCount})
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "flex-end" }}>
          {/* Search Query */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Search Cargo / Model</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Cargo code, item, detail..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: "0.82rem", paddingLeft: "30px", height: "34px" }}
              />
              <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Vendor Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Vendor</label>
            <CustomSelect
              value={vendorFilter}
              onChange={val => setVendorFilter(val)}
              options={vendorOptions}
              placeholder="All Vendors"
              searchable={true}
              clearable={true}
            />
          </div>

          {/* Purchaser Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Purchaser</label>
            <CustomSelect
              value={purchaserFilter}
              onChange={val => setPurchaserFilter(val)}
              options={purchaserOptions}
              placeholder="All Purchasers"
              searchable={true}
              clearable={true}
            />
          </div>

          {/* Cargo Carrier Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Logistics Carrier</label>
            <CustomSelect
              value={carrierFilter}
              onChange={val => setCarrierFilter(val)}
              options={carrierOptions}
              placeholder="All Carriers"
              searchable={true}
              clearable={true}
            />
          </div>

          {/* Transport Mode */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Transport Mode</label>
            <CustomSelect
              value={modeFilter}
              onChange={val => setModeFilter(val)}
              options={modeOptions}
              placeholder="All Modes"
              clearable={true}
            />
          </div>

          {/* From Date */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Date From</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ fontSize: "0.82rem", height: "34px" }}
            />
          </div>

          {/* To Date */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Date To</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              style={{ fontSize: "0.82rem", height: "34px" }}
            />
          </div>
        </div>
      </div>

      {/* Shipment Results Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ fontSize: "0.86rem", color: "var(--text-muted)" }}>
          Showing <strong>{filteredCargos.length}</strong> of {enrichedCargos.length} cargo shipments
        </span>
      </div>

      {/* Shipments List */}
      {filteredCargos.length === 0 ? (
        <div className="glass-panel" style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)" }}>
          <Ship size={36} style={{ color: "var(--primary)", marginBottom: "12px", display: "inline" }} /><br />
          No cargo shipments match the selected filters.
          {hasActiveFilters && (
            <div style={{ marginTop: "12px" }}>
              <button onClick={resetFilters} className="btn btn-secondary btn-sm">Reset Filters</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filteredCargos.map(cargo => {
            const isDelivered = cargo.isDelivered;
            const carrierObj = cargoCompanies.find(cc => cc.id === cargo.cargoCompanyId);

            return (
              <div 
                key={cargo.id} 
                className="glass-panel" 
                style={{ 
                  padding: "24px", 
                  marginBottom: "20px"
                }}
              >
                {/* Cargo Header Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                        Cargo Code: {cargo.id} {cargo.cargoDetail && cargo.cargoDetail !== cargo.id ? <span style={{ color: "var(--primary)", fontSize: "1rem", fontWeight: 700 }}>({cargo.cargoDetail})</span> : null}
                      </h4>
                      <span className={`badge ${isDelivered ? "badge-received" : "badge-cargo"}`} style={{ fontSize: "0.75rem", padding: "3px 10px", fontWeight: 700 }}>
                        {isDelivered ? "Received" : "In Transit"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      Vendor: <strong>{cargo.vendorName}</strong> | Transport Mode: <strong>{cargo.modeOfTransport || "—"}</strong>
                      {cargo.carrierName && cargo.carrierName !== "—" && (
                        <> | Cargo Company: <strong>{cargo.carrierName}</strong></>
                      )}
                    </div>
                  </div>

                  {/* Quick actions for cargo */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Mark All Purchase at top of lot (works for all items, even received) */}
                    {cargo.items && cargo.items.length > 0 && (() => {
                      const unmarkedItems = cargo.items.filter(it => it.purchaseUpdated !== "Yes");
                      const allMarked = unmarkedItems.length === 0;

                      if (!allMarked) {
                        return (
                          <button 
                            type="button"
                            onClick={() => handleMarkAllInCargo(cargo, "Yes")}
                            className="btn btn-primary btn-sm"
                            style={{ 
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontWeight: 600,
                              boxShadow: "0 2px 6px rgba(56, 189, 248, 0.25)"
                            }}
                            title={`Mark all ${unmarkedItems.length} items in this cargo as Purchase Confirmed`}
                          >
                            <CheckSquare size={14} /> Mark Purchase (All {unmarkedItems.length} items)
                          </button>
                        );
                      } else {
                        return (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span 
                              className="badge" 
                              style={{ 
                                background: "rgba(16, 185, 129, 0.15)", 
                                color: "#10b981", 
                                border: "1px solid rgba(16, 185, 129, 0.3)", 
                                padding: "4px 10px", 
                                fontSize: "0.78rem", 
                                fontWeight: 700, 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "5px" 
                              }}
                            >
                              <CheckCircle2 size={13} /> All {cargo.items.length} Items Purchase Marked
                            </span>
                            <button 
                              type="button"
                              onClick={() => handleMarkAllInCargo(cargo, "No")}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "3px 8px", fontSize: "0.73rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              title="Undo Mark Purchase for all items in this cargo"
                            >
                              <RotateCcw size={11} /> Unmark All
                            </button>
                          </div>
                        );
                      }
                    })()}

                    <button 
                      type="button"
                      disabled={isViewOnly}
                      className="btn btn-secondary btn-sm"
                      style={{ 
                        opacity: isViewOnly ? 0.8 : 1, 
                        cursor: isViewOnly ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                      title={isViewOnly ? "Accounts View-Only: Cannot edit shipping details" : undefined}
                    >
                      <Edit3 size={14} /> Edit Shipping Details
                    </button>
                  </div>
                </div>

                {/* Cargo Detail grids */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "16px", fontSize: "0.85rem" }}>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Cargo Detail:</div>
                    <div style={{ fontWeight: 500 }}>{cargo.cargoDetail || "na"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Shipping / ETA Dates:</div>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span>{cargo.cargoShippingDate || "—"} <ArrowRight size={12} style={{ verticalAlign: "middle" }} /> {cargo.cargoEta || "—"}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEtaHistory(cargo)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "1px 6px", height: "22px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        title="View Cargo ETA Revision History"
                      >
                        <Clock size={11} /> +ETA
                        {(() => {
                          const hist = Array.isArray(cargo.cargoEtaHistory) ? cargo.cargoEtaHistory : (typeof cargo.cargoEtaHistory === "string" ? JSON.parse(cargo.cargoEtaHistory || "[]") : []);
                          return hist.length > 0 ? (
                            <span style={{ fontSize: "0.68rem", color: "#f87171", fontWeight: "bold" }}>({hist.length})</span>
                          ) : null;
                        })()}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>
                      {cargo.cargoPriceUom === "per Pc" ? "Total Pieces:" : cargo.cargoPriceUom === "per KG" ? "Weight (KG):" : "Volume (CBM):"}
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      {cargo.cbmPackingList 
                        ? `${cargo.cbmPackingList} ${cargo.cargoPriceUom === "per Pc" ? "Pcs" : cargo.cargoPriceUom === "per KG" ? "KG" : "CBM"}` 
                        : `${cargo.totalUnits.toLocaleString()} Pcs`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Cargo Cost:</div>
                    <div style={{ fontWeight: 500 }}>
                      {cargo.cargoPrice ? `${getCurrencySymbol(cargo.currency)}${cargo.cargoPrice} (${cargo.cargoPriceUom || "Total"})` : "—"}
                      {calculateTotalCargoPrice(cargo) ? ` | Total: ${getCurrencySymbol(cargo.currency)}${Number(calculateTotalCargoPrice(cargo)).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Cargo Company Contact:</div>
                    <div style={{ fontWeight: 500 }}>
                      {carrierObj ? `${carrierObj.name} ${carrierObj.phone ? `(${carrierObj.phone})` : ""}` : "—"}
                    </div>
                  </div>
                </div>

                {/* Associated Files / Documents */}
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "0.85rem", background: "rgba(0,0,0,0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-glass)", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontWeight: 600, color: "var(--primary)" }}>Documents:</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span>Packing List:</span>
                    {(cargo.packingListFile && cargo.packingListData) ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(cargo, "Cargo Packing List", cargo.packingListFile, cargo.packingListData, "packingListFile", "packingListData")}
                          title={`Click to open or inspect ${cargo.packingListFile}`}
                          className="doc-link-btn"
                          style={{
                            background: "rgba(56, 189, 248, 0.12)",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "var(--primary, #38bdf8)",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "0.83rem"
                          }}
                        >
                          📄 {cargo.packingListFile}
                          <ExternalLink size={12} style={{ opacity: 0.85 }} />
                        </button>
                        <label 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: "2px 7px", fontSize: "0.72rem", cursor: "pointer", margin: 0, height: "24px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title="Replace or re-upload Packing List"
                        >
                          <Upload size={11} /> Replace
                          <input 
                            type="file" 
                            accept=".xlsx,.xls,.csv,.pdf,image/*" 
                            onChange={e => handlePackingUpload(cargo, e.target.files[0])} 
                            style={{ display: "none" }} 
                          />
                        </label>
                      </div>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--text-muted)" }}>Missing</span>
                        <label 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: "2px 7px", fontSize: "0.72rem", cursor: "pointer", margin: 0, height: "24px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title="Upload Packing List"
                        >
                          <Upload size={11} /> Upload
                          <input 
                            type="file" 
                            accept=".xlsx,.xls,.csv,.pdf,image/*" 
                            onChange={e => handlePackingUpload(cargo, e.target.files[0])} 
                            style={{ display: "none" }} 
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Vendor Bill: {(cargo.invoiceFile && cargo.invoiceData) ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDocument(cargo, "Vendor Bill (Invoice)", cargo.invoiceFile, cargo.invoiceData, "invoiceFile", "invoiceData")}
                          title={`Click to open or inspect ${cargo.invoiceFile}`}
                          className="doc-link-btn"
                          style={{
                            background: "rgba(56, 189, 248, 0.12)",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "var(--primary, #38bdf8)",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "0.83rem"
                          }}
                        >
                          📄 {cargo.invoiceFile}
                          <ExternalLink size={12} style={{ opacity: 0.85 }} />
                        </button>
                        <label 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: "2px 7px", fontSize: "0.72rem", cursor: "pointer", margin: 0, height: "24px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title="Replace or upload a new bill file"
                        >
                          <Upload size={11} /> Replace
                          <input 
                            type="file" 
                            accept=".pdf,.xlsx,.xls,.csv,image/*" 
                            onChange={e => handleBillUpload(cargo, e.target.files[0])} 
                            style={{ display: "none" }} 
                          />
                        </label>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Not uploaded yet</span>
                    )}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Cargo Receipt: {(cargo.cargoReceiptFile && cargo.cargoReceiptData) ? (
                      <button
                        type="button"
                        onClick={() => handleOpenDocument(cargo, "Cargo Delivery Receipt", cargo.cargoReceiptFile, cargo.cargoReceiptData, "cargoReceiptFile", "cargoReceiptData")}
                        title={`Click to open or inspect ${cargo.cargoReceiptFile}`}
                        className="doc-link-btn"
                        style={{
                          background: "rgba(56, 189, 248, 0.12)",
                          border: "1px solid rgba(56, 189, 248, 0.35)",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "var(--primary, #38bdf8)",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.83rem"
                        }}
                      >
                        📄 {cargo.cargoReceiptFile}
                        <ExternalLink size={12} style={{ opacity: 0.85 }} />
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Missing</span>
                    )}
                  </div>
                </div>

                {/* ==================== STEP 2: VENDOR BILL VERIFICATION (ONLY SHOWN WHEN BILL IS UPLOADED) ==================== */}
                {/* ==================== STEP 2: VENDOR BILL VERIFICATION (ONLY SHOWN WHEN BILL IS UPLOADED) ==================== */}
                {(() => {
                  const sla = calculateBillSlaStatus(cargo);
                  if (!sla.shouldShow) return null;

                  const isVerified = sla.isVerified;
                  const isOverdue = sla.isOverdue;
                  const isDueToday = sla.isDueToday;
                  const isAwaitingMaterial = !sla.isMaterialReceived;

                  return (
                    <div style={{
                      marginBottom: "16px",
                      background: isVerified 
                        ? "rgba(16, 185, 129, 0.08)" 
                        : isOverdue 
                        ? "rgba(239, 68, 68, 0.09)" 
                        : isAwaitingMaterial
                        ? "rgba(56, 189, 248, 0.08)"
                        : "rgba(245, 158, 11, 0.09)",
                      border: isVerified 
                        ? "1px solid rgba(16, 185, 129, 0.25)" 
                        : isOverdue 
                        ? "1px solid rgba(239, 68, 68, 0.35)" 
                        : isAwaitingMaterial
                        ? "1px solid rgba(56, 189, 248, 0.28)"
                        : "1px solid rgba(245, 158, 11, 0.35)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      fontSize: "0.84rem"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ 
                          width: "30px", 
                          height: "30px", 
                          borderRadius: "6px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          background: isVerified ? "rgba(16, 185, 129, 0.2)" : isOverdue ? "rgba(239, 68, 68, 0.2)" : isAwaitingMaterial ? "rgba(56, 189, 248, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: isVerified ? "#10b981" : isOverdue ? "#ef4444" : isAwaitingMaterial ? "#38bdf8" : "#f59e0b"
                        }}>
                          {isVerified ? <CheckCircle2 size={16} /> : isAwaitingMaterial ? <Ship size={16} /> : <FileText size={16} />}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ color: "var(--text-main)" }}>Step 2: Vendor Bill Verification:</strong>
                            {isVerified ? (
                              <span style={{ color: "#10b981", fontWeight: 700 }}>
                                ✅ Verified by {cargo.billVerifiedBy || "Rahul Accounts"} on {new Date(cargo.billVerifiedAt).toLocaleDateString()}
                              </span>
                            ) : isAwaitingMaterial ? (
                              <span style={{ 
                                padding: "2px 8px", 
                                borderRadius: "4px", 
                                fontSize: "0.75rem", 
                                fontWeight: 700,
                                background: "rgba(56, 189, 248, 0.15)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56, 189, 248, 0.3)"
                              }}>
                                📦 Bill Uploaded • Waiting for Warehouse Material Receipt (SLA starts on receipt)
                              </span>
                            ) : (
                              <span style={{ 
                                padding: "2px 8px", 
                                borderRadius: "4px", 
                                fontSize: "0.75rem", 
                                fontWeight: 700,
                                background: isOverdue ? "rgba(239, 68, 68, 0.18)" : isDueToday ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)",
                                color: isOverdue ? "#ef4444" : isDueToday ? "#f59e0b" : "#f59e0b",
                                border: isOverdue ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)"
                              }}>
                                {isOverdue 
                                  ? `🚨 PENDING ALERT: OVERDUE by ${Math.abs(sla.daysRemaining)} working day${Math.abs(sla.daysRemaining) > 1 ? "s" : ""}! (3-Day SLA Excl. Sunday Exceeded)` 
                                  : isDueToday 
                                  ? "⚠️ PENDING ALERT: Due Today (3 Working Days SLA Excl. Sunday)" 
                                  : `⏱️ PENDING ALERT: ${sla.daysRemaining} working day${sla.daysRemaining > 1 ? "s" : ""} left to verify (Due: ${sla.deadlineFormatted})`}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {sla.description}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons for Rahul Accounts */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {!isVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyBill(cargo, "verified")}
                            className="btn btn-success btn-sm"
                            style={{ 
                              padding: "4px 14px", 
                              fontSize: "0.82rem", 
                              fontWeight: 700, 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "5px",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)"
                            }}
                            title="Verify and confirm this vendor bill (Step 2 Duty)"
                          >
                            <CheckCircle2 size={14} /> Verify Bill & Mark Entry
                          </button>
                        )}
                        {isVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyBill(cargo, "pending_verification")}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "3px 8px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Undo bill verification"
                          >
                            <RotateCcw size={11} /> Undo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Combined Items List with Show Bundled Items Accordion */}
                <div style={{ marginTop: "16px" }}>
                  <details open>
                    <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", userSelect: "none", fontWeight: 600 }}>
                      Show Bundled Items ({cargo.items.length})
                    </summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {cargo.items.map(item => {
                        const itemQty = Number(item.vendorOrderQuantity || item.orderQuantity) || 0;
                        const unitCost = Number(item.priceRmb) || 0;
                        const totalCost = Number(item.totalRmb) || (itemQty * unitCost);
                        const isPurchaseMarked = item.purchaseUpdated === "Yes";
                        const isReceived = item.isMaterialRec === "Yes";

                        return (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--border-glass)", padding: "10px 14px", borderRadius: "6px", fontSize: "0.85rem", flexWrap: "wrap", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <button 
                                type="button"
                                onClick={() => setInspectedOrder(item)}
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
                                title="Click to view full order details"
                              >
                                {item.model}
                              </button> — Quantity: <strong>{itemQty} units</strong>
                              <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                📅 Order Date: <strong style={{ color: "var(--text-main)" }}>{item.orderDate || "—"}</strong>
                              </span>
                              <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(56, 189, 248, 0.12)", color: "var(--primary)" }}>
                                Purchaser: {getPurchaserDisplayName(item, purchasers)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectedOrder(item)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "2px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                title="View Order Details"
                              >
                                <Eye size={12} /> Order Details
                              </button>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                              {/* Item Cost & Total Cost */}
                              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "1px" }}>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                  Item Cost: <strong style={{ color: "var(--text-main)" }}>¥{unitCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
                                </div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>
                                  Total Cost: ¥{totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </div>
                              </div>

                              {/* Stage Badge: Received or In Transit */}
                              <span style={{ 
                                padding: "2px 8px", 
                                borderRadius: "4px", 
                                fontSize: "0.72rem", 
                                fontWeight: 700, 
                                background: "rgba(99, 102, 241, 0.15)",
                                color: "#818cf8",
                                border: "1px solid rgba(99, 102, 241, 0.3)"
                              }}>
                                In Freight Transit
                              </span>

                              {/* Item-wise Mark Purchase */}
                              {isPurchaseMarked ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <span style={{ 
                                    padding: "3px 8px", 
                                    borderRadius: "4px", 
                                    fontSize: "0.72rem", 
                                    fontWeight: 700, 
                                    background: "rgba(16, 185, 129, 0.15)", 
                                    color: "#10b981",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}>
                                    <CheckCircle2 size={12} /> Purchase Marked
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={() => handleToggleItemPurchase(item, "No")}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: "2px 6px", fontSize: "0.72rem", height: "24px" }}
                                    title="Undo Purchase Marked"
                                  >
                                    <RotateCcw size={11} /> Unmark
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={() => handleToggleItemPurchase(item, "Yes")}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: "3px 10px", fontSize: "0.76rem", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}
                                  title="Mark this item as Purchase Confirmed"
                                >
                                  <CheckSquare size={13} /> Mark Purchase
                                </button>
                              )}
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

      {/* Inspected Order Modal */}
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

      {/* ETA Revision History Modal */}
      {selectedEtaHistory && (
        <EtaHistoryModal
          cargo={selectedEtaHistory}
          onClose={() => setSelectedEtaHistory(null)}
        />
      )}

      {/* Cargo Document Modal (View / Download / Attach Missing) */}
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

// Read-only ETA Revision History Modal
export function EtaHistoryModal({ cargo, onClose }) {
  if (!cargo) return null;
  const history = Array.isArray(cargo.cargoEtaHistory) 
    ? cargo.cargoEtaHistory 
    : (typeof cargo.cargoEtaHistory === "string" ? JSON.parse(cargo.cargoEtaHistory || "[]") : []);

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "520px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={18} style={{ color: "#38bdf8" }} /> Cargo ETA Revision History
          </h3>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: "16px", fontSize: "0.85rem", background: "rgba(0,0,0,0.15)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-muted)" }}>Cargo Code:</span>
            <strong>{cargo.id}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-muted)" }}>Shipping Date:</span>
            <strong>{cargo.cargoShippingDate || "—"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Current ETA:</span>
            <strong style={{ color: "#38bdf8" }}>{cargo.cargoEta || "—"}</strong>
          </div>
        </div>

        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>
          Revisions Recorded ({history.length}):
        </div>

        {history.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No previous ETA changes recorded for this cargo shipment.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "260px", overflowY: "auto" }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-glass)", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, color: "#f87171" }}>Revision #{i + 1}: {h.date || h.eta}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{h.timestamp || h.updatedAt || ""}</span>
                </div>
                {h.reason && <div style={{ color: "var(--text-main)", fontSize: "0.8rem" }}>Reason: {h.reason}</div>}
                {h.updatedBy && <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Updated by: {h.updatedBy}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "6px 16px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Read-only Order Inspection Modal
export function OrderInspectionModal({ order, cargos = [], vendors = [], purchasers = [], cargoCompanies = [], onClose, onUpdateCargo, requests = [] }) {
  if (!order) return null;

  const [viewingDoc, setViewingDoc] = useState(null);

  const vendor = vendors.find(v => v.id === order.vendorId);
  const cargo = cargos.find(c => c.id === order.cargoId || String(c.id) === String(order.cargoId) || (order.cargoId && c.cargoDetail === order.cargoId));
  const cargoDetail = cargo?.cargoDetail || order.cargoDetail || "";
  const carrierObj = cargoCompanies.find(cc => cc.id === cargo?.cargoCompanyId);
  const carrierName = carrierObj?.name || (cargo?.carrierName && cargo.carrierName !== "Direct Logistics Carrier" ? cargo.carrierName : "") || "";
  const carrierDisplay = carrierName 
    ? (cargoDetail && cargoDetail !== carrierName ? `${cargoDetail} (${carrierName})` : carrierName) 
    : (cargoDetail || "—");
  const purchaserName = getPurchaserDisplayName(order, purchasers);

  const unitPrice = Number(order.priceRmb) || 0;
  const qty = Number(order.orderQuantity) || 0;
  const totalVal = Number(order.totalRmb) || (unitPrice * qty);

  const handleInspectDoc = (docType, fileName, fileData, field, dataField) => {
    if (!fileName) return;
    let effectiveData = fileData;
    if (!effectiveData && docType?.toLowerCase().includes("packing")) {
      const match = (requests || []).find(r => r.cargoId === cargo?.id && r.itemPackingListData);
      if (match) {
        effectiveData = match.itemPackingListData;
      }
    }
    setViewingDoc({
      cargo,
      docType,
      fileName,
      fileData: effectiveData || "",
      field,
      dataField,
      isMissing: !effectiveData
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div 
        className="glass-panel card-fade-in" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "720px", width: "95%", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                {order.model}
              </h3>
              <span className="badge badge-primary" style={{ fontSize: "0.72rem" }}>
                Order #{order.id}
              </span>
              <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                🔒 View Only (Audit)
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Category: <strong>{order.category || "General"}</strong> | Type: <strong>{order.type || "Import"}</strong> | Nature: <strong>{order.itemNature || "Non Consumables"}</strong>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>
            <X size={16} />
          </button>
        </div>

        {/* Commercial Section (Crucial for Accounts) */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <DollarSign size={16} /> Financial & Commercial Ledger Details
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", padding: "14px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Order Quantity</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "2px" }}>{qty.toLocaleString()} Pcs</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Unit Price (RMB)</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>{unitPrice ? `¥${unitPrice}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Total Price (RMB)</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>{totalVal ? `¥${totalVal.toLocaleString()}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Advance Payment</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "2px" }}>{order.advancePayment ? `¥${order.advancePayment}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Balance Payment</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "2px" }}>{order.balancePayment ? `¥${order.balancePayment}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Cargo Freight Cost</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#10b981", marginTop: "2px" }}>
                {calculateTotalCargoPrice(cargo, order) > 0
                  ? `${getCurrencySymbol(cargo?.currency || order.currency)}${Number(calculateTotalCargoPrice(cargo, order)).toLocaleString()}` 
                  : ((cargo?.cargoPrice || order.cargoPrice) ? `${getCurrencySymbol(cargo?.currency || order.currency)}${cargo?.cargoPrice || order.cargoPrice}` : "—")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Purchase Updated?</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "2px" }}>
                <span className={`badge ${order.purchaseUpdated === "Yes" ? "badge-received" : "badge-pending"}`}>
                  {order.purchaseUpdated === "Yes" ? "Yes (Marked)" : "No (Pending)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor & Logistics Section */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Building2 size={16} /> Vendor & Supply Chain
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", padding: "14px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Vendor Name</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>{vendor?.name || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Vendor EDD</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{order.vendorEdd || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Vendor Ready Date</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{order.vendorReadyDate || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Assigned Purchaser</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)", marginTop: "2px" }}>{purchaserName}</div>
            </div>
          </div>
        </div>

        {/* Shipment & Freight Details */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ fontSize: "0.95rem", color: "var(--primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Ship size={16} /> Freight Transit & Receiving
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", padding: "14px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Cargo Code</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>{order.cargoId || "Not Consolidated"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Cargo Detail (Cargo Name)</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)", marginTop: "2px" }}>{cargoDetail || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Mode of Transport</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{cargo?.modeOfTransport || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Logistics Carrier</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{carrierDisplay}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Shipping Date</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{cargo?.cargoShippingDate || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Cargo ETA</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#38bdf8", marginTop: "2px" }}>{cargo?.cargoEta || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Cargo Freight Rate</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "2px" }}>
                {(cargo?.cargoPrice || order.cargoPrice) ? `${getCurrencySymbol(cargo?.currency || order.currency)}${cargo?.cargoPrice || order.cargoPrice} (${cargo?.cargoPriceUom || order.cargoPriceUom || "Total"})` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {(cargo?.cargoPriceUom || order.cargoPriceUom) === "per Pc" ? "Cargo Measurement" : (cargo?.cargoPriceUom || order.cargoPriceUom) === "per KG" ? "Cargo Weight" : "Cargo Volume"}
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>
                {(cargo?.cbmPackingList || order.cbmPackingList) 
                  ? `${cargo?.cbmPackingList || order.cbmPackingList} ${(cargo?.cargoPriceUom || order.cargoPriceUom) === "per Pc" ? "Pcs" : (cargo?.cargoPriceUom || order.cargoPriceUom) === "per KG" ? "KG" : "CBM"}` 
                  : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Total Cargo Freight Price</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#10b981", marginTop: "2px" }}>
                {calculateTotalCargoPrice(cargo, order) > 0 
                  ? `${getCurrencySymbol(cargo?.currency || order.currency)}${Number(calculateTotalCargoPrice(cargo, order)).toLocaleString()}` 
                  : ((cargo?.cargoPrice || order.cargoPrice) ? `${getCurrencySymbol(cargo?.currency || order.currency)}${cargo?.cargoPrice || order.cargoPrice}` : "—")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Material Received?</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: order.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)", marginTop: "2px" }}>
                {order.isMaterialRec === "Yes" ? `Yes (${order.receivedDate || cargo?.receivedDate || "Received"})` : "No (In Freight Transit)"}
              </div>
            </div>
          </div>

          {/* Cargo Associated Documents if available */}
          {cargo && ((cargo.packingListFile && cargo.packingListData) || (cargo.invoiceFile && cargo.invoiceData) || (cargo.cargoReceiptFile && cargo.cargoReceiptData)) && (
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px dashed var(--border-glass)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>Cargo Documents:</div>
              {cargo.packingListFile && cargo.packingListData && (
                <button
                  type="button"
                  onClick={() => handleInspectDoc("Cargo Packing List", cargo.packingListFile, cargo.packingListData, "packingListFile", "packingListData")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  title={`Open or inspect ${cargo.packingListFile}`}
                >
                  <FileText size={12} /> PL: {cargo.packingListFile}
                </button>
              )}
              {cargo.invoiceFile && cargo.invoiceData && (
                <button
                  type="button"
                  onClick={() => handleInspectDoc("Vendor Bill (Invoice)", cargo.invoiceFile, cargo.invoiceData, "invoiceFile", "invoiceData")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  title={`Open or inspect ${cargo.invoiceFile}`}
                >
                  <FileText size={12} /> INV: {cargo.invoiceFile}
                </button>
              )}
              {cargo.cargoReceiptFile && cargo.cargoReceiptData && (
                <button
                  type="button"
                  onClick={() => handleInspectDoc("Cargo Delivery Receipt", cargo.cargoReceiptFile, cargo.cargoReceiptData, "cargoReceiptFile", "cargoReceiptData")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.72rem", padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  title={`Open or inspect ${cargo.cargoReceiptFile}`}
                >
                  <FileText size={12} /> CR: {cargo.cargoReceiptFile}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Remarks */}
        {order.remarks && (
          <div style={{ marginBottom: "20px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-glass)", fontSize: "0.84rem" }}>
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Remarks: </span>
            <span>{order.remarks}</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: "8px 20px" }}>
            Close Inspection
          </button>
        </div>

        {/* Document Modal inside Inspection */}
        {viewingDoc && (
          <CargoDocumentModal
            docInfo={viewingDoc}
            onClose={() => setViewingDoc(null)}
            onUpdateCargo={onUpdateCargo}
            bundledRequests={requests.filter(r => r.cargoId === cargo?.id)}
          />
        )}
      </div>
    </div>
  );
}
