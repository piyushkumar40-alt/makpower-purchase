import React, { useState, useMemo } from "react";
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
  Edit3
} from "lucide-react";
import { downloadOrOpenBlob, getPurchaserDisplayName } from "../utils/formatters";

export default function BundledUpcomingShipments({
  cargos = [],
  requests = [],
  vendors = [],
  cargoCompanies = [],
  purchasers = [],
  currentUser = {},
  isViewOnly = true
}) {
  const [statusFilter, setStatusFilter] = useState("upcoming"); // "upcoming" | "delivered" | "all"
  const [vendorFilter, setVendorFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Order Details Modal
  const [inspectedOrder, setInspectedOrder] = useState(null);
  // ETA Revision History Modal
  const [selectedEtaHistory, setSelectedEtaHistory] = useState(null);

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

  // Group requests by cargoId
  const cargoItemsMap = useMemo(() => {
    const map = {};
    (requests || []).forEach(r => {
      if (r.cargoId && r.status !== "Cancelled") {
        if (!map[r.cargoId]) map[r.cargoId] = [];
        map[r.cargoId].push(r);
      }
    });
    return map;
  }, [requests]);

  // Enriched Cargos
  const enrichedCargos = useMemo(() => {
    return (cargos || []).map(cargo => {
      const items = cargoItemsMap[cargo.id] || [];
      const totalUnits = items.reduce((sum, it) => sum + (Number(it.orderQuantity) || 0), 0);
      const totalValueRmb = items.reduce((sum, it) => {
        const qty = Number(it.orderQuantity) || 0;
        const price = Number(it.priceRmb) || 0;
        return sum + (Number(it.totalRmb) || (qty * price));
      }, 0);
      const vendorName = vendorMap[cargo.vendorId]?.name || "Multiple / Unspecified Vendors";
      const carrierName = carrierMap[cargo.cargoCompanyId]?.name || "Direct Logistics Carrier";
      const isDelivered = cargo.isMaterialRec === "Yes";

      return {
        ...cargo,
        items,
        totalUnits,
        totalValueRmb,
        vendorName,
        carrierName,
        isDelivered
      };
    });
  }, [cargos, cargoItemsMap, vendorMap, carrierMap]);

  // Metrics Bar
  const stats = useMemo(() => {
    const upcoming = enrichedCargos.filter(c => !c.isDelivered);
    const delivered = enrichedCargos.filter(c => c.isDelivered);

    const upcomingUnits = upcoming.reduce((sum, c) => sum + c.totalUnits, 0);
    const upcomingValue = upcoming.reduce((sum, c) => sum + c.totalValueRmb, 0);
    const upcomingFreight = upcoming.reduce((sum, c) => sum + (Number(c.cargoPrice) || 0), 0);
    const upcomingCbm = upcoming.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);

    return {
      totalCargos: enrichedCargos.length,
      upcomingCount: upcoming.length,
      upcomingUnits,
      upcomingValue,
      upcomingFreight,
      upcomingCbm,
      deliveredCount: delivered.length,
      deliveredValue: delivered.reduce((sum, c) => sum + c.totalValueRmb, 0)
    };
  }, [enrichedCargos]);

  // Filtered Cargos
  const filteredCargos = useMemo(() => {
    return enrichedCargos.filter(cargo => {
      // 1. Status Filter
      if (statusFilter === "upcoming" && cargo.isDelivered) return false;
      if (statusFilter === "delivered" && !cargo.isDelivered) return false;

      // 2. Vendor Filter
      if (vendorFilter && cargo.vendorId !== vendorFilter) return false;

      // 3. Carrier Filter
      if (carrierFilter && cargo.cargoCompanyId !== carrierFilter) return false;

      // 4. Mode Filter
      if (modeFilter && (cargo.modeOfTransport || "").toLowerCase() !== modeFilter.toLowerCase()) return false;

      // 5. Date Range (Shipping Date or ETA)
      const targetDate = cargo.cargoEta || cargo.cargoShippingDate || cargo.cargoOrderDate || "";
      if (fromDate && targetDate && targetDate < fromDate) return false;
      if (toDate && targetDate && targetDate > toDate) return false;

      // 6. Search Query
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
  }, [enrichedCargos, statusFilter, vendorFilter, carrierFilter, modeFilter, fromDate, toDate, searchQuery]);

  const hasActiveFilters = Boolean(
    vendorFilter || carrierFilter || modeFilter || fromDate || toDate || searchQuery.trim() || statusFilter !== "upcoming"
  );

  const resetFilters = () => {
    setStatusFilter("upcoming");
    setVendorFilter("");
    setCarrierFilter("");
    setModeFilter("");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
  };

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
            border: statusFilter === "upcoming" ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
            background: statusFilter === "upcoming" ? "rgba(56, 189, 248, 0.08)" : undefined 
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#38bdf8" }}>Upcoming In-Transit</span>
            <Ship size={18} style={{ color: "#38bdf8" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "var(--text-main)" }}>
            {stats.upcomingCount} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>Cargos</span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            {stats.upcomingUnits.toLocaleString()} Pcs bundled ({stats.upcomingCbm.toFixed(1)} CBM)
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#10b981" }}>In-Transit Goods Value</span>
            <DollarSign size={18} style={{ color: "#10b981" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "#10b981" }}>
            ¥{stats.upcomingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
            ¥{stats.upcomingFreight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Carrier logistics freight expense
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter("delivered")}
          className="glass-panel" 
          style={{ 
            padding: "16px", 
            cursor: "pointer", 
            border: statusFilter === "delivered" ? "2px solid #22c55e" : "1px solid var(--border-glass)",
            background: statusFilter === "delivered" ? "rgba(34, 197, 94, 0.08)" : undefined 
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#22c55e" }}>Delivered & Cleared</span>
            <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px", color: "#22c55e" }}>
            {stats.deliveredCount} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>Cargos</span>
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
            ¥{stats.deliveredValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} received
          </div>
        </div>
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
              className={`btn btn-sm ${statusFilter === "upcoming" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.74rem", padding: "3px 10px" }}
            >
              🚢 In Freight Transit ({stats.upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("delivered")}
              className={`btn btn-sm ${statusFilter === "delivered" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.74rem", padding: "3px 10px" }}
            >
              ✅ Delivered ({stats.deliveredCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`btn btn-sm ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.74rem", padding: "3px 10px" }}
            >
              🌟 All Cargos ({stats.totalCargos})
            </button>
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
            <select
              className="form-control"
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              style={{ fontSize: "0.82rem", height: "34px", fontWeight: 600 }}
            >
              <option value="">🏢 All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Cargo Carrier Filter */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Logistics Carrier</label>
            <select
              className="form-control"
              value={carrierFilter}
              onChange={e => setCarrierFilter(e.target.value)}
              style={{ fontSize: "0.82rem", height: "34px", fontWeight: 600 }}
            >
              <option value="">🚚 All Carriers</option>
              {cargoCompanies.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>

          {/* Transport Mode */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Transport Mode</label>
            <select
              className="form-control"
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              style={{ fontSize: "0.82rem", height: "34px", fontWeight: 600 }}
            >
              <option value="">All Modes</option>
              <option value="Air">✈️ Air</option>
              <option value="Sea">🚢 Sea</option>
              <option value="Land">🚚 Land</option>
              <option value="Courier">📦 Courier</option>
            </select>
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
                        Cargo Code: {cargo.id}
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

                  {/* Quick actions for cargo (matching screenshot layout with safe view-only state for Accounts) */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    {!isDelivered && (
                      <button 
                        type="button"
                        disabled={isViewOnly}
                        className="btn btn-success btn-sm"
                        style={{ 
                          opacity: isViewOnly ? 0.8 : 1, 
                          cursor: isViewOnly ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                        title={isViewOnly ? "Accounts View-Only: Cannot receive cargo" : undefined}
                      >
                        <Check size={14} /> Bulk Receive ({cargo.items.length} items)
                      </button>
                    )}
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
                      ₹{cargo.cargoPrice || "10"} ({cargo.cargoPriceUom || "per Pc"})
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
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "0.85rem", background: "rgba(0,0,0,0.1)", padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border-glass)", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ fontWeight: 600, color: "var(--primary)" }}>Documents:</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Packing List: {cargo.packingListFile ? (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.packingListData, cargo.packingListFile)}
                        title={`Click to open ${cargo.packingListFile}`}
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
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Missing</span>
                    )}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Invoice: {cargo.invoiceFile ? (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.invoiceData, cargo.invoiceFile)}
                        title={`Click to open ${cargo.invoiceFile}`}
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
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Missing</span>
                    )}
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    Cargo Receipt: {cargo.cargoReceiptFile ? (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.cargoReceiptData, cargo.cargoReceiptFile)}
                        title={`Click to open ${cargo.cargoReceiptFile}`}
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

                {/* Combined Items List with Show Bundled Items Accordion */}
                <div style={{ marginTop: "16px" }}>
                  <details>
                    <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", userSelect: "none", fontWeight: 600 }}>
                      Show Bundled Items ({cargo.items.length})
                    </summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {cargo.items.map(item => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--border-glass)", padding: "10px 14px", borderRadius: "6px", fontSize: "0.85rem", flexWrap: "wrap", gap: "8px" }}>
                          <div>
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
                            </button> — Quantity: <strong>{item.vendorOrderQuantity || item.orderQuantity} units</strong>
                            <span style={{ marginLeft: "10px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                              📅 Order Date: <strong style={{ color: "var(--text-main)" }}>{item.orderDate || "—"}</strong>
                            </span>
                            <span className="badge" style={{ marginLeft: "8px", fontSize: "0.72rem", background: "rgba(56, 189, 248, 0.12)", color: "var(--primary)" }}>
                              Purchaser: {getPurchaserDisplayName(item, purchasers)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setInspectedOrder(item)}
                              className="btn btn-secondary btn-sm"
                              style={{ marginLeft: "8px", padding: "2px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              title="View Order Details"
                            >
                              <Eye size={12} /> Order Details
                            </button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                              Price: ¥{Number(item.totalRmb || ((item.orderQuantity || 0) * (item.priceRmb || 0))).toLocaleString()}
                            </span>
                            <span style={{ 
                              padding: "2px 8px", 
                              borderRadius: "4px", 
                              fontSize: "0.72rem", 
                              fontWeight: 700, 
                              background: item.isMaterialRec === "Yes" ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
                              color: item.isMaterialRec === "Yes" ? "#10b981" : "#818cf8"
                            }}>
                              {item.isMaterialRec === "Yes" ? "Received" : "In Transit"}
                            </span>
                          </div>
                        </div>
                      ))}
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
export function OrderInspectionModal({ order, cargos = [], vendors = [], purchasers = [], cargoCompanies = [], onClose }) {
  if (!order) return null;

  const vendor = vendors.find(v => v.id === order.vendorId);
  const cargo = cargos.find(c => c.id === order.cargoId);
  const carrier = cargoCompanies.find(cc => cc.id === cargo?.cargoCompanyId);
  const purchaserName = getPurchaserDisplayName(order, purchasers);

  const unitPrice = Number(order.priceRmb) || 0;
  const qty = Number(order.orderQuantity) || 0;
  const totalVal = Number(order.totalRmb) || (unitPrice * qty);

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
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Mode of Transport</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{cargo?.modeOfTransport || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Logistics Carrier</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: "2px" }}>{carrier?.name || "—"}</div>
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
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Material Received?</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: order.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)", marginTop: "2px" }}>
                {order.isMaterialRec === "Yes" ? `Yes (${order.receivedDate || cargo?.receivedDate || "Received"})` : "No (In Freight Transit)"}
              </div>
            </div>
          </div>
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
      </div>
    </div>
  );
}
