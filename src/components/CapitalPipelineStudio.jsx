import React, { useState, useMemo } from "react";
import { 
  PieChart, DollarSign, Building2, Truck, Package, Search, Filter, 
  Download, ArrowUpRight, CheckCircle2, AlertCircle, Layers, Coins, Globe, RefreshCw, BarChart2, Warehouse
} from "lucide-react";
import { formatIndianCurrency } from "../utils/formatters";

// Helper: Custom SVG Donut / Circle Chart Component
function CategoryDonutChart({ title, dataMap, colorPalette, totalAmount, currencySymbol = "₹" }) {
  const entries = Object.entries(dataMap).filter(([_, val]) => val > 0);
  const total = entries.reduce((sum, [_, val]) => sum + val, 0);

  if (total === 0 || entries.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
        <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
          <PieChart size={16} style={{ color: "#38bdf8" }} /> {title}
        </h4>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "180px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          No monetary data recorded for this stage.
        </div>
      </div>
    );
  }

  // Calculate SVG arc paths
  let cumulativeAngle = 0;
  const radius = 65;
  const strokeWidth = 24;
  const center = 90;
  const circumference = 2 * Math.PI * radius;

  const slices = entries.map(([category, amount], idx) => {
    const percentage = amount / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeAngle * circumference;
    cumulativeAngle += percentage;
    const color = colorPalette[idx % colorPalette.length];
    return { category, amount, percentage, strokeDasharray, strokeDashoffset, color };
  });

  return (
    <div className="glass-panel card-fade-in" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", border: "1px solid var(--border-glass)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
          <PieChart size={16} style={{ color: "#38bdf8" }} /> {title}
        </h4>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8" }}>
          {formatIndianCurrency(total, currencySymbol)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", flexWrap: "wrap", margin: "10px 0" }}>
        {/* SVG Circular Donut Chart */}
        <div style={{ position: "relative", width: "180px", height: "180px" }}>
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
            />
            {slices.map((slice, i) => (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                style={{ transition: "all 0.5s ease" }}
              />
            ))}
          </svg>
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none"
          }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Category</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff" }}>
              {formatIndianCurrency(total, currencySymbol)}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 120px", minWidth: "120px" }}>
          {slices.map((slice, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.76rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: slice.color, display: "inline-block" }}></span>
                <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{slice.category}</span>
              </div>
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                {Math.round(slice.percentage * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CapitalPipelineStudio({
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  settings = {}
}) {
  const [viewCurrency, setViewCurrency] = useState("inr"); // "inr" | "original"
  const [rmbRateInput, setRmbRateInput] = useState(() => settings.rmbToInrRate ? String(settings.rmbToInrRate) : "12.0");
  const [usdRateInput, setUsdRateInput] = useState(() => settings.usdToInrRate ? String(settings.usdToInrRate) : "86.5");

  const rmbRate = parseFloat(rmbRateInput) || 12.0;
  const usdRate = parseFloat(usdRateInput) || 86.5;

  // Filter States for bottom Table
  const [stageFilter, setStageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Helper: Convert to INR
  const convertToInr = (amount, currency) => {
    const num = parseFloat(amount || 0);
    const cur = (currency || "RMB").toUpperCase();
    if (cur === "USD") return num * usdRate;
    if (cur === "INR") return num;
    return num * rmbRate;
  };

  const getSymbol = (cur) => {
    const c = (cur || "RMB").toUpperCase();
    if (c === "USD") return "$";
    if (c === "INR") return "₹";
    return "¥";
  };

  // 1. Process Requests & Classify Into Pipeline Stages
  const activeRequests = (requests || []).filter(r => r.status !== "Cancelled");
  const safeCargos = cargos || [];

  // STAGE 1: MONEY AT ORDERED ITEMS (New unassigned & unpriced requisitions)
  const orderedRequests = activeRequests.filter(r => 
    r.isMaterialRec !== "Yes" && 
    !r.cargoId && 
    !r.vendorId && 
    (!r.priceRmb || parseFloat(r.priceRmb || 0) === 0)
  );
  
  // STAGE 2: MONEY AT VENDOR (Vendor assigned or priced, in production at factory, not yet shipped)
  const vendorRequests = activeRequests.filter(r => 
    r.isMaterialRec !== "Yes" && 
    !r.cargoId && 
    (r.vendorId || (r.priceRmb && parseFloat(r.priceRmb || 0) > 0))
  );

  // STAGE 3: MONEY AT TRANSIT (Bundled in cargo shipment currently on the move)
  const transitRequests = activeRequests.filter(r => r.cargoId && r.isMaterialRec !== "Yes");
  const inTransitCargos = safeCargos.filter(c => c.isMaterialRec !== "Yes");

  // STAGE 4: WAREHOUSE RECEIVED (Material delivered and received at warehouse)
  const receivedRequests = activeRequests.filter(r => r.isMaterialRec === "Yes");

  // 2. Compute Top 3 Money Cards Values
  // Card 1: Money at Ordered Items
  const orderedMoneyInr = orderedRequests.reduce((sum, r) => sum + convertToInr(r.totalRmb || 0, r.currency), 0);
  let orderedRmb = 0, orderedUsd = 0, orderedInrVal = 0;
  orderedRequests.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const val = parseFloat(r.totalRmb || 0);
    if (cur === "USD") orderedUsd += val;
    else if (cur === "INR") orderedInrVal += val;
    else orderedRmb += val;
  });

  // Card 2: Money at Vendor
  const vendorMoneyInr = vendorRequests.reduce((sum, r) => sum + convertToInr(r.totalRmb || 0, r.currency), 0);
  const vendorAdvInr = vendorRequests.reduce((sum, r) => sum + convertToInr(r.advancePayment || 0, r.currency), 0);
  const vendorBalInr = vendorRequests.reduce((sum, r) => sum + convertToInr(r.balancePayment || 0, r.currency), 0);

  let vendorRmb = 0, vendorUsd = 0, vendorInrVal = 0;
  vendorRequests.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const val = parseFloat(r.totalRmb || 0);
    if (cur === "USD") vendorUsd += val;
    else if (cur === "INR") vendorInrVal += val;
    else vendorRmb += val;
  });

  // Card 3: Money at Transit (Goods Value + Freight Shipping Costs)
  const transitGoodsInr = transitRequests.reduce((sum, r) => sum + convertToInr(r.totalRmb || 0, r.currency), 0);
  const transitFreightInr = inTransitCargos.reduce((sum, c) => sum + convertToInr(c.totalCargoPrice || 0, c.currency), 0);
  const transitMoneyInrTotal = transitGoodsInr + transitFreightInr;

  let transitGoodsRmb = 0, transitGoodsUsd = 0, transitGoodsInrVal = 0;
  transitRequests.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const val = parseFloat(r.totalRmb || 0);
    if (cur === "USD") transitGoodsUsd += val;
    else if (cur === "INR") transitGoodsInrVal += val;
    else transitGoodsRmb += val;
  });

  let transitFreightRmb = 0, transitFreightUsd = 0, transitFreightInrVal = 0;
  inTransitCargos.forEach(c => {
    const cur = (c.currency || "RMB").toUpperCase();
    const val = parseFloat(c.totalCargoPrice || 0);
    if (cur === "USD") transitFreightUsd += val;
    else if (cur === "INR") transitFreightInrVal += val;
    else transitFreightRmb += val;
  });

  // 3. Category Data Maps for 3 Circle Charts
  const buildCategoryMap = (reqList, isTransit = false) => {
    const map = {};
    reqList.forEach(r => {
      const cat = r.category || "General";
      const val = convertToInr(r.totalRmb || 0, r.currency);
      map[cat] = (map[cat] || 0) + val;
    });
    if (isTransit && transitFreightInr > 0) {
      map["Freight & Logistics"] = (map["Freight & Logistics"] || 0) + transitFreightInr;
    }
    return map;
  };

  const orderedCategoryMap = useMemo(() => buildCategoryMap(orderedRequests), [orderedRequests, rmbRate, usdRate]);
  const vendorCategoryMap = useMemo(() => buildCategoryMap(vendorRequests), [vendorRequests, rmbRate, usdRate]);
  const transitCategoryMap = useMemo(() => buildCategoryMap(transitRequests, true), [transitRequests, transitFreightInr, rmbRate, usdRate]);

  // Color palettes for donut charts
  const palette1 = ["#a855f7", "#ec4899", "#8b5cf6", "#d946ef", "#c084fc"];
  const palette2 = ["#f59e0b", "#fbbf24", "#d97706", "#fef08a", "#fb7185"];
  const palette3 = ["#38bdf8", "#0284c7", "#06b6d4", "#34d399", "#818cf8"];

  // 4. Granular Item-Wise Table Rows Construction
  // Each order item is tagged with its precise pipeline stage!
  const itemRows = useMemo(() => {
    return activeRequests.map(r => {
      let stageKey = "ordered";
      let stageName = "1. Money at Ordered Items (Unprocessed)";
      let stageColor = "#c084fc";
      let stageBg = "rgba(192, 132, 252, 0.15)";
      let stageBorder = "rgba(192, 132, 252, 0.3)";

      if (r.isMaterialRec === "Yes") {
        stageKey = "received";
        stageName = "4. Warehouse Received";
        stageColor = "#34d399";
        stageBg = "rgba(52, 211, 153, 0.15)";
        stageBorder = "rgba(52, 211, 153, 0.3)";
      } else if (r.cargoId) {
        stageKey = "transit";
        stageName = "3. Money at Transit";
        stageColor = "#38bdf8";
        stageBg = "rgba(56, 189, 248, 0.15)";
        stageBorder = "rgba(56, 189, 248, 0.3)";
      } else if (r.vendorId || (r.priceRmb && parseFloat(r.priceRmb || 0) > 0)) {
        stageKey = "vendor";
        stageName = "2. Money at Vendor";
        stageColor = "#fbbf24";
        stageBg = "rgba(251, 191, 36, 0.15)";
        stageBorder = "rgba(251, 191, 36, 0.3)";
      }

      const totalValOriginal = parseFloat(r.totalRmb || 0);
      const totalValInr = convertToInr(totalValOriginal, r.currency);
      const vendorObj = vendors.find(v => v.id === r.vendorId);
      const cargoObj = cargos.find(c => c.id === r.cargoId);

      return {
        ...r,
        stageKey,
        stageName,
        stageColor,
        stageBg,
        stageBorder,
        totalValOriginal,
        totalValInr,
        vendorName: vendorObj ? vendorObj.name : r.vendorId || "Pending Vendor",
        cargoCode: cargoObj ? cargoObj.id : "Not Bundled"
      };
    });
  }, [activeRequests, vendors, cargos, rmbRate, usdRate]);

  // Filter Table Rows
  const filteredTableRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return itemRows.filter(row => {
      if (stageFilter !== "all" && row.stageKey !== stageFilter) return false;
      if (categoryFilter !== "all" && (row.category || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (vendorFilter !== "all" && row.vendorId !== vendorFilter) return false;
      if (q) {
        const matchModel = (row.model || "").toLowerCase().includes(q);
        const matchPo = (row.id || "").toLowerCase().includes(q);
        const matchVendor = (row.vendorName || "").toLowerCase().includes(q);
        const matchCat = (row.category || "").toLowerCase().includes(q);
        if (!matchModel && !matchPo && !matchVendor && !matchCat) return false;
      }
      return true;
    });
  }, [itemRows, stageFilter, categoryFilter, vendorFilter, searchQuery]);

  // Export Data Studio Table to CSV
  const handleExportCsv = () => {
    const headers = [
      "PO Number", "Item Model / Description", "Pipeline Stage Location", "Category", 
      "Quantity", "Original Currency", "Original Total", "Converted Total (INR)", 
      "Advance Paid", "Balance Remaining", "Vendor Name", "Cargo Code"
    ];

    const rows = filteredTableRows.map(r => [
      `"${r.id}"`,
      `"${(r.model || "").replace(/"/g, '""')}"`,
      `"${r.stageName}"`,
      `"${r.category || "General"}"`,
      r.orderQuantity || 0,
      `"${r.currency || "RMB"}"`,
      r.totalValOriginal,
      r.totalValInr.toFixed(2),
      r.advancePayment || 0,
      r.balancePayment || 0,
      `"${(r.vendorName || "").replace(/"/g, '""')}"`,
      `"${r.cargoCode}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Makpower_Money_Flow_Pipeline_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      
      {/* Google Data Studio Style Top Header */}
      <div className="glass-panel" style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))", border: "1px solid var(--border-glass)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <BarChart2 size={24} />
              </span>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                Money Flow & Capital Allocation Studio
              </h2>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)", fontSize: "0.75rem" }}>
                Looker Data Studio Mode
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              Track monetary capital allocation step-by-step: 1st Ordered Items → 2nd Money at Vendor → 3rd Money in Transit (including Freight).
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Currency Mode Toggle */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-glass)" }}>
              <button 
                onClick={() => setViewCurrency("inr")} 
                style={{ 
                  padding: "6px 14px", 
                  borderRadius: "7px", 
                  fontSize: "0.8rem", 
                  fontWeight: 700, 
                  border: "none", 
                  cursor: "pointer", 
                  background: viewCurrency === "inr" ? "var(--primary)" : "transparent", 
                  color: viewCurrency === "inr" ? "#fff" : "var(--text-muted)" 
                }}
              >
                🇮🇳 INR Converted (₹)
              </button>
              <button 
                onClick={() => setViewCurrency("original")} 
                style={{ 
                  padding: "6px 14px", 
                  borderRadius: "7px", 
                  fontSize: "0.8rem", 
                  fontWeight: 700, 
                  border: "none", 
                  cursor: "pointer", 
                  background: viewCurrency === "original" ? "var(--primary)" : "transparent", 
                  color: viewCurrency === "original" ? "#fff" : "var(--text-muted)" 
                }}
              >
                🌐 Multi-Currency
              </button>
            </div>

            <button onClick={handleExportCsv} className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Download size={14} /> Export Studio Data (CSV)
            </button>
          </div>
        </div>

        {/* Live Conversion Rate Inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed var(--border-glass)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--secondary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
            <Coins size={14} /> Live Conversion Rates:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>1 RMB = ₹</span>
            <input 
              type="number" 
              className="form-control" 
              value={rmbRateInput} 
              onChange={e => setRmbRateInput(e.target.value)}
              style={{ width: "70px", padding: "3px 6px", fontSize: "0.8rem" }} 
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}>
            <span style={{ color: "#fbbf24", fontWeight: 600 }}>1 USD = ₹</span>
            <input 
              type="number" 
              className="form-control" 
              value={usdRateInput} 
              onChange={e => setUsdRateInput(e.target.value)}
              style={{ width: "70px", padding: "3px 6px", fontSize: "0.8rem" }} 
            />
          </div>
        </div>
      </div>

      {/* TOP SECTION: 3 MONEY KPI BREAKDOWN CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        
        {/* CARD 1: 1ST - MONEY AT ORDERED ITEMS */}
        <div className="glass-panel card-fade-in" style={{ padding: "20px", borderTop: "4px solid #c084fc", background: "rgba(192, 132, 252, 0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                1ST STAGE: ORDERED ITEMS
              </span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "2px 0 0 0" }}>
                Money at Ordered Items
              </h3>
            </div>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(192, 132, 252, 0.15)", color: "#c084fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
          </div>

          {viewCurrency === "inr" ? (
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#e9d5ff", margin: "10px 0" }}>
              {formatIndianCurrency(orderedMoneyInr)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "10px 0" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#38bdf8" }}>¥ {orderedRmb.toLocaleString()} RMB</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fbbf24" }}>$ {orderedUsd.toLocaleString()} USD</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#34d399" }}>{formatIndianCurrency(orderedInrVal)} INR</div>
            </div>
          )}

          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px dashed var(--border-glass)", paddingTop: "8px", marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
            <span>Requisition PO Count:</span>
            <strong style={{ color: "#c084fc" }}>{orderedRequests.length} Orders</strong>
          </div>
        </div>

        {/* CARD 2: 2ND - MONEY AT VENDOR */}
        <div className="glass-panel card-fade-in" style={{ padding: "20px", borderTop: "4px solid #fbbf24", background: "rgba(251, 191, 36, 0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                2ND STAGE: VENDOR FACTORY
              </span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "2px 0 0 0" }}>
                Money at Vendor
              </h3>
            </div>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} />
            </div>
          </div>

          {viewCurrency === "inr" ? (
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#fef08a", margin: "10px 0" }}>
              {formatIndianCurrency(vendorMoneyInr)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "10px 0" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#38bdf8" }}>¥ {vendorRmb.toLocaleString()} RMB</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fbbf24" }}>$ {vendorUsd.toLocaleString()} USD</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#34d399" }}>{formatIndianCurrency(vendorInrVal)} INR</div>
            </div>
          )}

          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px dashed var(--border-glass)", paddingTop: "8px", marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
            <span>Advance Deposited:</span>
            <strong style={{ color: "#34d399" }}>{formatIndianCurrency(vendorAdvInr)}</strong>
          </div>
        </div>

        {/* CARD 3: 3RD - MONEY AT TRANSIT (INCLUDING FREIGHT CHARGE) */}
        <div className="glass-panel card-fade-in" style={{ padding: "20px", borderTop: "4px solid #38bdf8", background: "rgba(56, 189, 248, 0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                3RD STAGE: TRANSIT & LOGISTICS
              </span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "2px 0 0 0" }}>
                Money at Transit (incl. Freight)
              </h3>
            </div>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Truck size={20} />
            </div>
          </div>

          {viewCurrency === "inr" ? (
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#7dd3fc", margin: "10px 0" }}>
              {formatIndianCurrency(transitMoneyInrTotal)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "10px 0" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>
                Goods Value: <span style={{ color: "#38bdf8" }}>¥{transitGoodsRmb.toLocaleString()}</span> | <span style={{ color: "#fbbf24" }}>${transitGoodsUsd.toLocaleString()}</span> | <span style={{ color: "#34d399" }}>{formatIndianCurrency(transitGoodsInrVal)}</span>
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>
                Freight Cost: <span style={{ color: "#38bdf8" }}>¥{transitFreightRmb.toLocaleString()}</span> | <span style={{ color: "#fbbf24" }}>${transitFreightUsd.toLocaleString()}</span> | <span style={{ color: "#34d399" }}>{formatIndianCurrency(transitFreightInrVal)}</span>
              </div>
            </div>
          )}

          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px dashed var(--border-glass)", paddingTop: "8px", marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
            <span>In-Transit Cargo Freight:</span>
            <strong style={{ color: "#38bdf8" }}>{formatIndianCurrency(transitFreightInr)}</strong>
          </div>
        </div>

      </div>

      {/* MIDDLE SECTION: 3 CIRCULAR CATEGORY CHARTS (LOOKER STUDIO STYLE) */}
      <div>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <PieChart size={20} style={{ color: "#38bdf8" }} /> Category-Wise Money Allocation Across Pipeline Stages
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "20px" }}>
          
          {/* Donut Chart 1: Money at Ordered Items */}
          <CategoryDonutChart
            title="1. Money at Ordered Items (Category Share)"
            dataMap={orderedCategoryMap}
            colorPalette={palette1}
            totalAmount={orderedMoneyInr}
            currencySymbol={viewCurrency === "inr" ? "₹" : "₹"}
          />

          {/* Donut Chart 2: Money at Vendor */}
          <CategoryDonutChart
            title="2. Money at Vendor (Category Share)"
            dataMap={vendorCategoryMap}
            colorPalette={palette2}
            totalAmount={vendorMoneyInr}
            currencySymbol={viewCurrency === "inr" ? "₹" : "₹"}
          />

          {/* Donut Chart 3: Money at Transit (incl. Freight) */}
          <CategoryDonutChart
            title="3. Money at Transit (Category Share)"
            dataMap={transitCategoryMap}
            colorPalette={palette3}
            totalAmount={transitMoneyInrTotal}
            currencySymbol={viewCurrency === "inr" ? "₹" : "₹"}
          />

        </div>
      </div>

      {/* BOTTOM SECTION: GRANULAR ITEM-WISE FINANCIAL TRACKING TABLE */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={20} style={{ color: "#38bdf8" }} /> Granular Item-Wise Financial Tracking & Stage Location
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "2px" }}>
              If the same item model exists in multiple stages (e.g. Ordered vs Vendor), it displays as distinct stage entries below. Use filters to drill down.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Stage Filter */}
            <select 
              className="form-control" 
              value={stageFilter} 
              onChange={e => setStageFilter(e.target.value)}
              style={{ fontSize: "0.82rem", minWidth: "160px" }}
            >
              <option value="all" style={{ background: "#0f172a" }}>All Pipeline Stages ({filteredTableRows.length})</option>
              <option value="ordered" style={{ background: "#0f172a" }}>1. Money at Ordered Items</option>
              <option value="vendor" style={{ background: "#0f172a" }}>2. Money at Vendor</option>
              <option value="transit" style={{ background: "#0f172a" }}>3. Money at Transit</option>
              <option value="received" style={{ background: "#0f172a" }}>4. Warehouse Received</option>
            </select>

            {/* Vendor Filter */}
            <select 
              className="form-control" 
              value={vendorFilter} 
              onChange={e => setVendorFilter(e.target.value)}
              style={{ fontSize: "0.82rem", minWidth: "140px" }}
            >
              <option value="all" style={{ background: "#0f172a" }}>All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id} style={{ background: "#0f172a" }}>{v.name}</option>
              ))}
            </select>

            {/* Search Input */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search Item, PO #..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "30px", fontSize: "0.82rem", width: "170px" }}
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="table-container" style={{ maxHeight: "500px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.83rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <th>PO Number</th>
                <th>Item Model / Description</th>
                <th style={{ width: "180px" }}>Current Stage / Location</th>
                <th>Category</th>
                <th>Qty</th>
                <th>{viewCurrency === "inr" ? "Total Value (INR ₹)" : "Original Currency & Total"}</th>
                <th>Advance Deposit</th>
                <th>Vendor</th>
                <th>Cargo Tracking</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                    No item entries match your active studio filter settings.
                  </td>
                </tr>
              ) : (
                filteredTableRows.map(row => (
                  <tr key={`${row.id}_${row.stageKey}`}>
                    <td style={{ fontWeight: 800, color: "var(--primary)" }}>{row.id}</td>
                    
                    <td>
                      <strong style={{ color: "var(--text-main)", fontSize: "0.86rem" }}>{row.model}</strong>
                      {row.type && (
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>
                          Type: {row.type}
                        </span>
                      )}
                    </td>

                    {/* Dedicated Stage Location Badge */}
                    <td>
                      <span 
                        className="badge" 
                        style={{ 
                          background: row.stageBg, 
                          color: row.stageColor, 
                          border: `1px solid ${row.stageBorder}`,
                          fontWeight: 700,
                          fontSize: "0.76rem"
                        }}
                      >
                        {row.stageName}
                      </span>
                    </td>

                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: "0.72rem" }}>
                        {row.category || "General"}
                      </span>
                    </td>

                    <td style={{ fontWeight: 700 }}>
                      <div>{row.cargoPickedQty || row.vendorOrderQuantity || row.orderQuantity} Pcs</div>
                      {row.vendorOrderQuantity && row.vendorOrderQuantity !== row.orderQuantity && (
                        <div style={{ fontSize: "0.7rem", color: "#38bdf8" }}>Vendor: {row.vendorOrderQuantity} (Req: {row.orderQuantity})</div>
                      )}
                      {row.shortageQty ? (
                        <div style={{ fontSize: "0.7rem", color: "#f87171" }}>Short: {row.shortageQty} Pcs</div>
                      ) : null}
                    </td>

                    <td style={{ fontWeight: 800, color: row.stageColor }}>
                      {viewCurrency === "inr" ? (
                        <>₹ {row.totalValInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}</>
                      ) : (
                        <>{getSymbol(row.currency)} {row.totalValOriginal.toLocaleString()} ({row.currency || "RMB"})</>
                      )}
                    </td>

                    <td>
                      {viewCurrency === "inr" ? (
                        <>₹ {convertToInr(row.advancePayment || 0, row.currency).toLocaleString()}</>
                      ) : (
                        <>{getSymbol(row.currency)} {parseFloat(row.advancePayment || 0).toLocaleString()}</>
                      )}
                    </td>

                    <td style={{ fontWeight: 600 }}>{row.vendorName}</td>

                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {row.cargoCode !== "Not Bundled" ? (
                        <span style={{ color: "#38bdf8", fontWeight: 600 }}>{row.cargoCode}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
