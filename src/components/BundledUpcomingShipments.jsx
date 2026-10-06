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
  AlertTriangle
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
          <h3 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Ship size={24} style={{ color: "#38bdf8" }} /> Bundled Upcoming Shipments
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
            const isAir = (cargo.modeOfTransport || "").toLowerCase().includes("air");

            return (
              <div 
                key={cargo.id} 
                className="glass-panel" 
                style={{ 
                  padding: "22px 24px", 
                  borderLeft: isDelivered ? "4px solid #22c55e" : "4px solid #38bdf8",
                  background: isDelivered ? "rgba(34, 197, 94, 0.02)" : "rgba(56, 189, 248, 0.02)" 
                }}
              >
                {/* Cargo Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", marginBottom: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h4 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                        Cargo Code: {cargo.id}
                      </h4>
                      <span className={`badge ${isDelivered ? "badge-received" : "badge-cargo"}`} style={{ fontSize: "0.75rem", padding: "3px 10px", fontWeight: 700 }}>
                        {isDelivered ? "✅ Material Received" : "🚢 In Freight Transit"}
                      </span>
                      <span className="badge" style={{ fontSize: "0.75rem", padding: "3px 10px", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {isAir ? <Plane size={13} /> : <Ship size={13} />} {cargo.modeOfTransport || "Freight"}
                      </span>
                      <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                        🔒 View Only
                      </span>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "6px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                      <span>🏢 Vendor: <strong style={{ color: "var(--text-main)" }}>{cargo.vendorName}</strong></span>
                      <span>🚚 Carrier: <strong style={{ color: "var(--text-main)" }}>{cargo.carrierName}</strong></span>
                      {cargo.cargoDetail && <span>📦 Ref: <strong>{cargo.cargoDetail}</strong></span>}
                    </div>
                  </div>

                  {/* Documents & Slips */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {cargo.packingListFile && (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.packingListData, cargo.packingListFile)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "0.74rem", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        title="Download / View Packing List"
                      >
                        <FileText size={13} style={{ color: "#38bdf8" }} /> Packing List
                      </button>
                    )}
                    {cargo.invoiceFile && (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.invoiceData, cargo.invoiceFile)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "0.74rem", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        title="Download / View Commercial Invoice"
                      >
                        <FileText size={13} style={{ color: "#10b981" }} /> Invoice
                      </button>
                    )}
                    {cargo.cargoReceiptFile && (
                      <button
                        type="button"
                        onClick={() => downloadOrOpenBlob(cargo.cargoReceiptData, cargo.cargoReceiptFile)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "0.74rem", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                        title="Download / View Cargo Receipt"
                      >
                        <FileText size={13} style={{ color: "#f59e0b" }} /> Cargo Slip
                      </button>
                    )}
                  </div>
                </div>

                {/* Cargo Logistics & Commercial Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "18px", padding: "12px 16px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Shipping Date</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px" }}>{cargo.cargoShippingDate || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Expected ETA</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px", color: isDelivered ? "#22c55e" : "#38bdf8" }}>
                      {cargo.cargoEta || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Bundled Items</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px" }}>
                      {cargo.items.length} SKUs <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>({cargo.totalUnits.toLocaleString()} Pcs)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Cargo Value</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px", color: "#10b981" }}>
                      ¥{cargo.totalValueRmb.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Freight Cost</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px", color: "#f59e0b" }}>
                      {cargo.cargoPrice ? `¥${cargo.cargoPrice} ${cargo.cargoPriceUom || ""}` : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Volume (CBM)</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "2px" }}>{cargo.cbm ? `${cargo.cbm} CBM` : "—"}</div>
                  </div>
                </div>

                {/* Bundled Items Breakdown Table */}
                <div style={{ marginTop: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>
                      📦 Bundled Purchase Orders Inside Shipment ({cargo.items.length} items)
                    </span>
                  </div>

                  {cargo.items.length === 0 ? (
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "12px", textAlign: "center" }}>
                      No active purchase requisitions bundled in this cargo.
                    </div>
                  ) : (
                    <div className="table-container" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      <table className="custom-table" style={{ fontSize: "0.82rem" }}>
                        <thead>
                          <tr>
                            <th>Item / Model</th>
                            <th>Category</th>
                            <th>Qty (Pcs)</th>
                            <th>Price (¥)</th>
                            <th>Total (¥)</th>
                            <th>Purchaser</th>
                            <th>Vendor EDD</th>
                            <th>Purchase Updated</th>
                            <th>Material Rec</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cargo.items.map(it => {
                            const pName = getPurchaserDisplayName(it, purchasers);
                            const unitPrice = Number(it.priceRmb) || 0;
                            const qty = Number(it.orderQuantity) || 0;
                            const totalVal = Number(it.totalRmb) || (unitPrice * qty);

                            return (
                              <tr key={it.id}>
                                <td style={{ fontWeight: 700 }}>
                                  <button
                                    type="button"
                                    onClick={() => setInspectedOrder(it)}
                                    style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: 700, textDecoration: "underline", padding: 0, fontSize: "inherit", textAlign: "left" }}
                                    title="Inspect Order Details"
                                  >
                                    {it.model}
                                  </button>
                                </td>
                                <td style={{ color: "var(--text-muted)" }}>{it.category || "—"}</td>
                                <td style={{ fontWeight: 700 }}>{qty.toLocaleString()}</td>
                                <td style={{ color: "#10b981", fontWeight: 600 }}>{unitPrice ? `¥${unitPrice}` : "—"}</td>
                                <td style={{ color: "#10b981", fontWeight: 700 }}>{totalVal ? `¥${totalVal.toLocaleString()}` : "—"}</td>
                                <td style={{ fontSize: "0.78rem", color: "var(--primary)" }}>{pName}</td>
                                <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{it.vendorEdd || "—"}</td>
                                <td>
                                  <span className={`badge ${it.purchaseUpdated === "Yes" ? "badge-received" : "badge-pending"}`} style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                                    {it.purchaseUpdated === "Yes" ? "Yes" : "No"}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, fontSize: "0.75rem", color: it.isMaterialRec === "Yes" ? "var(--success)" : "var(--danger)" }}>
                                    {it.isMaterialRec === "Yes" ? "Received" : "In Transit"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => setInspectedOrder(it)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: "2px 6px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                  >
                                    <Eye size={11} /> View
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
