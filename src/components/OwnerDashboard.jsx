import React, { useState } from "react";
import { 
  Building2, TrendingUp, DollarSign, Package, Truck, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Search, Filter, ShieldCheck, 
  Users, Award, ArrowUpRight, BarChart3, BarChart2, Clock, PieChart, RefreshCw,
  Globe, Coins, Save, Check, Warehouse
} from "lucide-react";

import CapitalPipelineStudio from "./CapitalPipelineStudio";
import { useSortableData } from "../utils/useSortableData";
import { formatIndianCurrency, normalizeCategoryName } from "../utils/formatters";

export default function OwnerDashboard({
  currentUser = {},
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  items = [],
  cargoCompanies = [],
  settings = {},
  onUpdateSettings,
  onLogout
}) {
  // Mode selection: "multicurrency" (original breakdown) or "inr_consolidated" (INR report with rate manager)
  const [viewMode, setViewMode] = useState("multicurrency");
  
  const [selectedPurchaser, setSelectedPurchaser] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Exchange Rates State (editable with database persistence)
  const [rmbRateInput, setRmbRateInput] = useState(() => settings.rmbToInrRate ? String(settings.rmbToInrRate) : "12.0");
  const [usdRateInput, setUsdRateInput] = useState(() => settings.usdToInrRate ? String(settings.usdToInrRate) : "86.5");
  const [rateSaveSuccessMsg, setRateSaveSuccessMsg] = useState("");
  const [isSavingRates, setIsSavingRates] = useState(false);

  const rmbToInrRate = parseFloat(rmbRateInput) || 12.0;
  const usdToInrRate = parseFloat(usdRateInput) || 86.5;

  const handleSaveRates = async () => {
    setIsSavingRates(true);
    setRateSaveSuccessMsg("");
    try {
      if (onUpdateSettings) {
        await onUpdateSettings({
          rmbToInrRate: rmbToInrRate,
          usdToInrRate: usdToInrRate
        });
      }
      setRateSaveSuccessMsg("✅ Exchange rates saved to database successfully!");
      setTimeout(() => setRateSaveSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to save rates:", err);
    } finally {
      setIsSavingRates(false);
    }
  };

  // Helper: Convert any amount + currency into INR
  const convertToInr = (amount, currency) => {
    const num = parseFloat(amount || 0);
    const cur = (currency || "RMB").toUpperCase();
    if (cur === "USD") return num * usdToInrRate;
    if (cur === "INR") return num;
    return num * rmbToInrRate; // Default RMB
  };

  // Helper: Format Currency Symbol
  const getSymbol = (cur) => {
    const c = (cur || "RMB").toUpperCase();
    if (c === "USD") return "$";
    if (c === "INR") return "₹";
    return "¥";
  };

  // 1. Calculate High-Level Metrics
  const activeRequests = (requests || []).filter(r => r.status !== "Cancelled");
  
  // Filter requests based on user filters
  const filteredRequests = activeRequests.filter(r => {
    const matchesPurchaser = selectedPurchaser === "all" || r.purchaserId === selectedPurchaser || r.entryBy === selectedPurchaser;
    const matchesCategory = categoryFilter === "all" || (r.category && r.category.toLowerCase() === categoryFilter.toLowerCase());
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (r.id && r.id.toLowerCase().includes(q)) || 
      (r.model && r.model.toLowerCase().includes(q)) || 
      (r.category && r.category.toLowerCase().includes(q));
    return matchesPurchaser && matchesCategory && matchesSearch;
  });

  // 2. Compute Overall Spend Totals (RMB / USD / INR)
  let rmbTotalSpend = 0, usdTotalSpend = 0, inrTotalSpend = 0;
  let rmbAdvance = 0, usdAdvance = 0, inrAdvance = 0;
  let rmbBalance = 0, usdBalance = 0, inrBalance = 0;

  activeRequests.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const tot = parseFloat(r.totalRmb || 0);
    const adv = parseFloat(r.advancePayment || 0);
    const bal = parseFloat(r.balancePayment || 0);

    if (cur === "USD") {
      usdTotalSpend += tot;
      usdAdvance += adv;
      usdBalance += bal;
    } else if (cur === "INR") {
      inrTotalSpend += tot;
      inrAdvance += adv;
      inrBalance += bal;
    } else {
      rmbTotalSpend += tot;
      rmbAdvance += adv;
      rmbBalance += bal;
    }
  });

  // 3. COMPUTATIONS FOR "MONEY AT VENDOR" VS "MONEY IN-TRANSIT"
  // A. Money at Vendor (Orders currently at vendor factory / pending receipt / pending cargo)
  const vendorPendingOrders = activeRequests.filter(r => r.isMaterialRec !== "Yes" && !r.cargoId);
  let vendorRmbTotal = 0, vendorUsdTotal = 0, vendorInrTotal = 0;
  let vendorRmbAdv = 0, vendorUsdAdv = 0, vendorInrAdv = 0;

  vendorPendingOrders.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const tot = parseFloat(r.totalRmb || 0);
    const adv = parseFloat(r.advancePayment || 0);
    if (cur === "USD") { vendorUsdTotal += tot; vendorUsdAdv += adv; }
    else if (cur === "INR") { vendorInrTotal += tot; vendorInrAdv += adv; }
    else { vendorRmbTotal += tot; vendorRmbAdv += adv; }
  });

  const vendorInrTotalSpend = vendorPendingOrders.reduce((sum, r) => sum + convertToInr(r.totalRmb, r.currency), 0);
  const vendorInrTotalAdv = vendorPendingOrders.reduce((sum, r) => sum + convertToInr(r.advancePayment, r.currency), 0);
  const vendorInrTotalBal = vendorPendingOrders.reduce((sum, r) => sum + convertToInr(r.balancePayment, r.currency), 0);

  // B. Money In-Transit (Goods assigned to cargos currently in-transit + cargo freight costs)
  const inTransitOrders = activeRequests.filter(r => r.cargoId && r.isMaterialRec !== "Yes");
  let transitGoodsRmb = 0, transitGoodsUsd = 0, transitGoodsInr = 0;
  inTransitOrders.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const tot = parseFloat(r.totalRmb || 0);
    if (cur === "USD") transitGoodsUsd += tot;
    else if (cur === "INR") transitGoodsInr += tot;
    else transitGoodsRmb += tot;
  });

  const transitGoodsInrTotal = inTransitOrders.reduce((sum, r) => sum + convertToInr(r.totalRmb, r.currency), 0);

  const safeCargos = cargos || [];
  const inTransitCargos = safeCargos.filter(c => c.isMaterialRec !== "Yes");
  let transitFreightRmb = 0, transitFreightUsd = 0, transitFreightInr = 0;
  inTransitCargos.forEach(c => {
    const cur = (c.currency || "RMB").toUpperCase();
    const price = parseFloat(c.totalCargoPrice || 0);
    if (cur === "USD") transitFreightUsd += price;
    else if (cur === "INR") transitFreightInr += price;
    else transitFreightRmb += price;
  });

  const transitFreightInrTotal = inTransitCargos.reduce((sum, c) => sum + convertToInr(c.totalCargoPrice, c.currency), 0);
  const transitCombinedInrTotal = transitGoodsInrTotal + transitFreightInrTotal;

  // C. Money Received (Goods received at Warehouse)
  const receivedOrders = activeRequests.filter(r => r.isMaterialRec === "Yes");
  const receivedInrTotal = receivedOrders.reduce((sum, r) => sum + convertToInr(r.totalRmb, r.currency), 0);

  // Consolidated Net Total Spend in INR
  const totalInrConsolidatedSpend = activeRequests.reduce((sum, r) => sum + convertToInr(r.totalRmb, r.currency), 0);
  const totalInrAdvancePaid = activeRequests.reduce((sum, r) => sum + convertToInr(r.advancePayment, r.currency), 0);
  const totalInrBalanceDue = activeRequests.reduce((sum, r) => sum + convertToInr(r.balancePayment, r.currency), 0);

  const completedOrders = activeRequests.filter(r => r.isMaterialRec === "Yes");
  const pendingOrders = activeRequests.filter(r => r.isMaterialRec !== "Yes");

  // Category Spend Distribution
  const categoryMultiSpendMap = {};
  const categoryInrSpendMap = {};

  activeRequests.forEach(r => {
    const cat = normalizeCategoryName(r.category);
    const cur = (r.currency || "RMB").toUpperCase();
    const amt = parseFloat(r.totalRmb || 0);
    const inrAmt = convertToInr(amt, cur);

    if (!categoryMultiSpendMap[cat]) {
      categoryMultiSpendMap[cat] = { RMB: 0, USD: 0, INR: 0 };
    }
    categoryMultiSpendMap[cat][cur] = (categoryMultiSpendMap[cat][cur] || 0) + amt;

    categoryInrSpendMap[cat] = (categoryInrSpendMap[cat] || 0) + inrAmt;
  });

  const categoryMultiSpendList = Object.entries(categoryMultiSpendMap)
    .map(([cat, obj]) => ({ category: cat, ...obj }))
    .sort((a, b) => (b.RMB + b.USD * usdToInrRate + b.INR) - (a.RMB + a.USD * usdToInrRate + a.INR));

  const categoryInrSpendList = Object.entries(categoryInrSpendMap)
    .map(([cat, amount]) => ({ category: cat, amount }))
    .sort((a, b) => b.amount - a.amount);

  // FG vs RM Item Type Ratio
  let fgMulti = { RMB: 0, USD: 0, INR: 0 };
  let rmMulti = { RMB: 0, USD: 0, INR: 0 };
  let fgInr = 0;
  let rmInr = 0;

  activeRequests.forEach(r => {
    const cur = (r.currency || "RMB").toUpperCase();
    const amt = parseFloat(r.totalRmb || 0);
    const inrAmt = convertToInr(amt, cur);
    const isFG = r.type === "FG" || (r.type && r.type.includes("FG"));

    if (isFG) {
      fgMulti[cur] = (fgMulti[cur] || 0) + amt;
      fgInr += inrAmt;
    } else {
      rmMulti[cur] = (rmMulti[cur] || 0) + amt;
      rmInr += inrAmt;
    }
  });

  // Vendor Performance Table Data
  const vendorPerformance = (vendors || []).map(v => {
    const vRequests = activeRequests.filter(r => r.vendorId === v.id);
    let vRmb = 0, vUsd = 0, vInr = 0, vTotalInr = 0;

    vRequests.forEach(r => {
      const cur = (r.currency || "RMB").toUpperCase();
      const amt = parseFloat(r.totalRmb || 0);
      if (cur === "USD") vUsd += amt;
      else if (cur === "INR") vInr += amt;
      else vRmb += amt;
      vTotalInr += convertToInr(amt, cur);
    });

    const vCompleted = vRequests.filter(r => r.isMaterialRec === "Yes").length;
    const fulfillmentRate = vRequests.length > 0 ? Math.round((vCompleted / vRequests.length) * 100) : 100;
    return {
      id: v.id,
      name: v.name,
      spendRmb: vRmb,
      spendUsd: vUsd,
      spendInr: vInr,
      totalInr: vTotalInr,
      totalOrders: vRequests.length,
      completedOrders: vCompleted,
      fulfillmentRate
    };
  }).sort((a, b) => b.totalInr - a.totalInr);

  const { items: sortedVendorPerf, RenderSortHeader: RenderVendorSortHeader } = useSortableData(vendorPerformance);
  const { items: sortedRequests, RenderSortHeader: RenderReqSortHeader } = useSortableData(filteredRequests);

  // Critical Risk & Delay Alerts
  const today = new Date().toISOString().slice(0, 10);
  const delayedCargos = safeCargos.filter(c => c.isMaterialRec !== "Yes" && c.cargoEta && c.cargoEta < today);
  const highValuePendingOrders = activeRequests.filter(r => r.isMaterialRec !== "Yes" && convertToInr(r.totalRmb, r.currency) > 200000);

  // Export Executive Summary Report CSV with Vendor vs In-Transit Breakdown
  const handleExportExecutiveReport = () => {
    const headers = [
      "PO Number", "Order Date", "Category", "Item Model", "Item Type", 
      "Quantity", "Current Stage / Location", "Original Currency", "Original Price", "Original Total", 
      "Converted Total (INR)", "Advance Paid", "Balance Due", 
      "Vendor Name", "Delivery Status"
    ];

    const rows = activeRequests.map(r => {
      const vendorObj = vendors.find(v => v.id === r.vendorId);
      const inrValue = convertToInr(r.totalRmb, r.currency);
      let stage = "At Vendor Factory";
      if (r.isMaterialRec === "Yes") stage = "Received at Warehouse";
      else if (r.cargoId) stage = "In-Transit Cargo Shipment";

      return [
        `"${r.id}"`,
        `"${r.orderDate || ""}"`,
        `"${r.category || "General"}"`,
        `"${(r.model || "").replace(/"/g, '""')}"`,
        `"${r.type || "RM"}"`,
        r.orderQuantity || 0,
        `"${stage}"`,
        `"${r.currency || "RMB"}"`,
        r.priceRmb || 0,
        r.totalRmb || 0,
        inrValue.toFixed(2),
        r.advancePayment || 0,
        r.balancePayment || 0,
        `"${(vendorObj ? vendorObj.name : r.vendorId || "").replace(/"/g, '""')}"`,
        r.isMaterialRec === "Yes" ? "Received" : "Pending / In-Transit"
      ].join(",");
    });

    const summaryRows = [
      `"=== EXECUTIVE ASSET ALLOCATION SUMMARY ==="`,
      `"Total Money at Vendor Factories (INR)","","","","","","₹ ${vendorInrTotalSpend.toFixed(2)}"`,
      `"Total Advance Deposited with Vendors (INR)","","","","","","₹ ${vendorInrTotalAdv.toFixed(2)}"`,
      `"Total Goods Value In-Transit (INR)","","","","","","₹ ${transitGoodsInrTotal.toFixed(2)}"`,
      `"Total Shipping Freight In-Transit (INR)","","","","","","₹ ${transitFreightInrTotal.toFixed(2)}"`,
      `"Total Combined Money In-Transit (INR)","","","","","","₹ ${transitCombinedInrTotal.toFixed(2)}"`,
      `"Total Warehouse Received Stock (INR)","","","","","","₹ ${receivedInrTotal.toFixed(2)}"`,
      `"==========================================="`,
      ""
    ];

    const csvContent = [...summaryRows, headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Makpower_Owner_Executive_Summary_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card-fade-in" style={{ paddingBottom: "40px" }}>
      
      {/* Top Welcome & Navigation Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px" }}>
              <Building2 size={32} style={{ color: "#38bdf8" }} /> Executive Owner Dashboard
            </h1>
            <span className="badge" style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#fff", padding: "4px 12px", fontSize: "0.8rem", borderRadius: "12px", fontWeight: 700 }}>
              <ShieldCheck size={14} style={{ display: "inline", marginRight: "4px" }} /> Executive Owner Mode
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time multi-currency procurement analytics, live exchange rate conversions, vendor performance, and supply chain intelligence.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button 
            onClick={handleExportExecutiveReport}
            className="btn btn-secondary"
            style={{ borderColor: "#38bdf8", color: "#7dd3fc", fontWeight: 600 }}
          >
            <Download size={16} /> Export Executive Report (.csv)
          </button>

          {onLogout && (
            <button onClick={onLogout} className="btn btn-danger btn-sm">
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="glass-panel" style={{ padding: "8px", marginBottom: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button 
          onClick={() => setViewMode("multicurrency")} 
          className={`btn ${viewMode === "multicurrency" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: "1 1 200px", padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <Globe size={18} /> 🌐 Multi-Currency Original Breakdown (RMB / USD / INR)
        </button>

        <button 
          onClick={() => setViewMode("inr_consolidated")} 
          className={`btn ${viewMode === "inr_consolidated" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: "1 1 200px", padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: viewMode === "inr_consolidated" ? "linear-gradient(135deg, #059669, #10b981)" : "var(--bg-card)", borderColor: "#10b981" }}
        >
          <Coins size={18} /> 🇮🇳 Consolidated INR Report & Currency Rate Manager
        </button>

        <button 
          onClick={() => setViewMode("studiopipeline")} 
          className={`btn ${viewMode === "studiopipeline" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: "1 1 200px", padding: "10px 16px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: viewMode === "studiopipeline" ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "var(--bg-card)", borderColor: "#a855f7" }}
        >
          <BarChart2 size={18} /> 📊 Money Flow & Capital Allocation
        </button>
      </div>

      {viewMode === "studiopipeline" && (
        <CapitalPipelineStudio 
          requests={requests}
          cargos={cargos}
          vendors={vendors}
          users={users}
          settings={settings}
        />
      )}

      {viewMode !== "studiopipeline" && (
        <>
          {/* Exchange Rate Controller Bar (Visible in INR Consolidated Mode) */}
      {viewMode === "inr_consolidated" && (
        <div className="glass-panel" style={{ padding: "20px", marginBottom: "28px", border: "1px solid rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#a7f3d0", display: "flex", alignItems: "center", gap: "8px" }}>
                <Coins size={20} /> Live Currency Exchange Rate Manager
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.83rem", marginTop: "2px" }}>
                Adjust conversion rates below to instantly recalculate all procurement orders, vendor totals, and logistics costs into Indian Rupees (INR ₹).
              </p>
            </div>

            <button 
              onClick={handleSaveRates} 
              className="btn btn-success"
              disabled={isSavingRates}
              style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              <Save size={15} /> {isSavingRates ? "Saving..." : "Save Exchange Rates to Database"}
            </button>
          </div>

          {rateSaveSuccessMsg && (
            <div className="alert-strip alert-success" style={{ marginBottom: "16px" }}>
              {rateSaveSuccessMsg}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--secondary)", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                Chinese Yuan (RMB ¥) → Indian Rupee (INR ₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#38bdf8" }}>1 RMB = ₹</span>
                <input 
                  type="number" 
                  className="form-control" 
                  step="0.01"
                  min="0.1"
                  value={rmbRateInput}
                  onChange={e => setRmbRateInput(e.target.value)}
                  style={{ fontWeight: 700, fontSize: "1.05rem" }}
                />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--secondary)", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                US Dollar (USD $) → Indian Rupee (INR ₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fbbf24" }}>1 USD = ₹</span>
                <input 
                  type="number" 
                  className="form-control" 
                  step="0.01"
                  min="1"
                  value={usdRateInput}
                  onChange={e => setUsdRateInput(e.target.value)}
                  style={{ fontWeight: 700, fontSize: "1.05rem" }}
                />
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-glass)", opacity: 0.85 }}>
              <label style={{ fontSize: "0.8rem", color: "var(--secondary)", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                Indian Rupee (INR ₹) → Indian Rupee (INR ₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#34d399" }}>1 INR = ₹</span>
                <input 
                  type="text" 
                  className="form-control" 
                  value="1.0"
                  disabled
                  style={{ fontWeight: 700, fontSize: "1.05rem" }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Financial Executive KPI Cards Section */}
      {viewMode === "multicurrency" ? (
        /* MULTI-CURRENCY ORIGINAL BREAKDOWN CARDS */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          
          {/* Total Purchase Spend (Multi-Currency) */}
          <div className="stat-card" style={{ borderTop: "4px solid #38bdf8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span className="stat-label">Total Purchase Spend (3 Currencies)</span>
              <div className="stat-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <DollarSign size={20} />
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>
                ¥ {rmbTotalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>RMB</span>
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fbbf24" }}>
                $ {usdTotalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>USD</span>
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#34d399" }}>
                ₹ {inrTotalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>INR</span>
              </div>
            </div>

            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "10px", borderTop: "1px dashed var(--border-glass)", paddingTop: "8px" }}>
              <strong>Advance Paid:</strong> ¥{rmbAdvance.toLocaleString()} | ${usdAdvance.toLocaleString()} | ₹{inrAdvance.toLocaleString()}
            </div>
          </div>

          {/* CARD 1: MONEY AT VENDOR FACTORIES */}
          <div className="stat-card" style={{ borderTop: "4px solid #c084fc", background: "rgba(192, 132, 252, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span className="stat-label" style={{ color: "#e9d5ff", fontWeight: 700 }}>Money at Vendor (Factory Deposits)</span>
              <div className="stat-icon" style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc" }}>
                <Building2 size={20} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#38bdf8" }}>
                ¥ {vendorRmbTotal.toLocaleString()} RMB <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 400 }}>(Adv: ¥{vendorRmbAdv.toLocaleString()})</span>
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fbbf24" }}>
                $ {vendorUsdTotal.toLocaleString()} USD <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 400 }}>(Adv: ${vendorUsdAdv.toLocaleString()})</span>
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#34d399" }}>
                ₹ {vendorInrTotal.toLocaleString()} INR <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 400 }}>(Adv: ₹{vendorInrAdv.toLocaleString()})</span>
              </div>
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "8px", borderTop: "1px dashed var(--border-glass)", paddingTop: "6px" }}>
              Total PO value in production / pending at vendor hands.
            </div>
          </div>

          {/* CARD 2: MONEY IN-TRANSIT (SHIPMENTS & FREIGHT) */}
          <div className="stat-card" style={{ borderTop: "4px solid #f59e0b", background: "rgba(245, 158, 11, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span className="stat-label" style={{ color: "#fef3c7", fontWeight: 700 }}>Money In-Transit (Goods & Freight)</span>
              <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                <Truck size={20} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-main)", fontWeight: 700 }}>
                Goods Value: <span style={{ color: "#38bdf8" }}>¥{transitGoodsRmb.toLocaleString()}</span> | <span style={{ color: "#fbbf24" }}>${transitGoodsUsd.toLocaleString()}</span> | <span style={{ color: "#34d399" }}>₹{transitGoodsInr.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-main)", fontWeight: 700 }}>
                Freight Spend: <span style={{ color: "#38bdf8" }}>¥{transitFreightRmb.toLocaleString()}</span> | <span style={{ color: "#fbbf24" }}>${transitFreightUsd.toLocaleString()}</span> | <span style={{ color: "#34d399" }}>₹{transitFreightInr.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "8px", borderTop: "1px dashed var(--border-glass)", paddingTop: "6px" }}>
              Across <strong>{inTransitCargos.length}</strong> active cargo shipments currently on the move.
            </div>
          </div>

          {/* Active Orders */}
          <div className="stat-card" style={{ borderTop: "4px solid #818cf8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">Active Purchase Orders</span>
              <div className="stat-icon" style={{ background: "rgba(129, 140, 248, 0.15)", color: "#818cf8" }}>
                <Package size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: "#818cf8", margin: "12px 0" }}>
              {activeRequests.length} <span style={{ fontSize: "1rem", fontWeight: 500 }}>POs</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Received: <strong style={{ color: "#34d399" }}>{completedOrders.length}</strong> | Pending: <strong style={{ color: "#fbbf24" }}>{pendingOrders.length}</strong>
            </div>
          </div>

        </div>
      ) : (
        /* CONSOLIDATED INR REPORT CARDS */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          
          {/* Total Consolidated Net Spend (INR) */}
          <div className="stat-card" style={{ borderTop: "4px solid #10b981", background: "rgba(16, 185, 129, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">Total Net Spend (CONSOLIDATED INR)</span>
              <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <Coins size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: "#a7f3d0", fontSize: "1.7rem", margin: "10px 0" }}>
              {formatIndianCurrency(totalInrConsolidatedSpend)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Advance Paid: <strong>{formatIndianCurrency(totalInrAdvancePaid)}</strong> | Bal: <strong>{formatIndianCurrency(totalInrBalanceDue)}</strong>
            </div>
          </div>

          {/* CARD 1: CONSOLIDATED MONEY AT VENDOR (INR) */}
          <div className="stat-card" style={{ borderTop: "4px solid #c084fc", background: "rgba(192, 132, 252, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label" style={{ color: "#e9d5ff", fontWeight: 700 }}>Money at Vendor Factories (INR)</span>
              <div className="stat-icon" style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc" }}>
                <Building2 size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: "#e9d5ff", fontSize: "1.6rem", margin: "10px 0" }}>
              {formatIndianCurrency(vendorInrTotalSpend)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Advance Deposited: <strong style={{ color: "#34d399" }}>{formatIndianCurrency(vendorInrTotalAdv)}</strong> | Bal: <strong>{formatIndianCurrency(vendorInrTotalBal)}</strong>
            </div>
          </div>

          {/* CARD 2: CONSOLIDATED MONEY IN-TRANSIT (INR) */}
          <div className="stat-card" style={{ borderTop: "4px solid #f59e0b", background: "rgba(245, 158, 11, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label" style={{ color: "#fef3c7", fontWeight: 700 }}>Total Money In-Transit (INR)</span>
              <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                <Truck size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: "#fcd34d", fontSize: "1.6rem", margin: "10px 0" }}>
              {formatIndianCurrency(transitCombinedInrTotal)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Goods Value: <strong>{formatIndianCurrency(transitGoodsInrTotal)}</strong> | Freight: <strong>{formatIndianCurrency(transitFreightInrTotal)}</strong>
            </div>
          </div>

          {/* Received Stock (INR) */}
          <div className="stat-card" style={{ borderTop: "4px solid #34d399" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="stat-label">Warehouse Received Stock (INR)</span>
              <div className="stat-icon" style={{ background: "rgba(52, 211, 153, 0.15)", color: "#34d399" }}>
                <Warehouse size={20} />
              </div>
            </div>
            <div className="stat-value" style={{ color: "#34d399", fontSize: "1.6rem", margin: "10px 0" }}>
              {formatIndianCurrency(receivedInrTotal)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Across {completedOrders.length} Received Purchase Orders
            </div>
          </div>

        </div>
      )}

      {/* FINANCIAL ASSET ALLOCATION WIDGET: AT VENDOR VS IN-TRANSIT VS WAREHOUSE RECEIVED */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <TrendingUp size={20} style={{ color: "#38bdf8" }} /> Capital Allocation Summary: Money at Vendor vs In-Transit vs Warehouse
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          
          {/* Stage 1: Money at Vendor */}
          <div style={{ background: "rgba(192, 132, 252, 0.08)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(192, 132, 252, 0.3)" }}>
            <div style={{ fontSize: "0.82rem", color: "#c084fc", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              STAGE 1: MONEY AT VENDOR FACTORIES
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e9d5ff", margin: "8px 0" }}>
              ₹ {vendorInrTotalSpend.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "3px" }}>
              <div>Advance Deposited: <strong style={{ color: "#34d399" }}>₹ {vendorInrTotalAdv.toLocaleString()}</strong></div>
              <div>Balance Remaining: <strong>₹ {vendorInrTotalBal.toLocaleString()}</strong></div>
              <div>Pending PO Count: <strong>{vendorPendingOrders.length} POs</strong></div>
            </div>
          </div>

          {/* Stage 2: Money In-Transit */}
          <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <div style={{ fontSize: "0.82rem", color: "#f59e0b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              STAGE 2: MONEY IN-TRANSIT (SHIPMENTS & FREIGHT)
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fcd34d", margin: "8px 0" }}>
              ₹ {transitCombinedInrTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "3px" }}>
              <div>In-Transit Goods Value: <strong>₹ {transitGoodsInrTotal.toLocaleString()}</strong></div>
              <div>In-Transit Freight Cost: <strong>₹ {transitFreightInrTotal.toLocaleString()}</strong></div>
              <div>Active Shipments: <strong>{inTransitCargos.length} Cargos</strong> ({inTransitOrders.length} POs)</div>
            </div>
          </div>

          {/* Stage 3: Warehouse Received */}
          <div style={{ background: "rgba(52, 211, 153, 0.08)", padding: "16px", borderRadius: "10px", border: "1px solid rgba(52, 211, 153, 0.3)" }}>
            <div style={{ fontSize: "0.82rem", color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              STAGE 3: WAREHOUSE RECEIVED INVENTORY
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#a7f3d0", margin: "8px 0" }}>
              ₹ {receivedInrTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "3px" }}>
              <div>Completed Orders: <strong>{completedOrders.length} POs</strong></div>
              <div>Safety Stock Asset Value: <strong>Fully Fulfilled</strong></div>
              <div>Risk Level: <strong style={{ color: "#34d399" }}>Zero Risk (In-Hand)</strong></div>
            </div>
          </div>

        </div>
      </div>

      {/* Critical Executive Risk Alerts Strip */}
      {(delayedCargos.length > 0 || highValuePendingOrders.length > 0) && (
        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "#f87171", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <AlertTriangle size={20} /> Executive Supply Chain Risk Alerts
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            
            {delayedCargos.length > 0 && (
              <div className="alert-strip alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>🚨 {delayedCargos.length} Cargo Shipment(s) Delayed Beyond ETA:</strong>
                  <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                    Shipments ({delayedCargos.map(c => c.id).join(", ")}) passed expected arrival date.
                  </div>
                </div>
              </div>
            )}

            {highValuePendingOrders.length > 0 && (
              <div className="alert-strip alert-warning" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>⚠️ {highValuePendingOrders.length} High-Value Pending Order(s) &gt; ₹2,00,000 INR:</strong>
                  <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                    High-budget orders requiring owner monitoring before completion.
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Analytics Grid: Category Spend & Item Type Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px", marginBottom: "28px" }}>
        
        {/* Category Spend Distribution */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <PieChart size={18} style={{ color: "#38bdf8" }} /> Spend Distribution by Category {viewMode === "inr_consolidated" ? "(in INR ₹)" : "(Multi-Currency)"}
          </h3>

          {viewMode === "multicurrency" ? (
            categoryMultiSpendList.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No active order spend data available.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {categoryMultiSpendList.map(item => (
                  <div key={item.category} style={{ background: "rgba(15, 23, 42, 0.4)", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)", marginBottom: "4px" }}>
                      {item.category}
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem" }}>
                      {item.RMB > 0 && <span style={{ color: "#38bdf8", fontWeight: 700 }}>¥ {item.RMB.toLocaleString()} RMB</span>}
                      {item.USD > 0 && <span style={{ color: "#fbbf24", fontWeight: 700 }}>$ {item.USD.toLocaleString()} USD</span>}
                      {item.INR > 0 && <span style={{ color: "#34d399", fontWeight: 700 }}>₹ {item.INR.toLocaleString()} INR</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            categoryInrSpendList.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No active order spend data available.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {categoryInrSpendList.map(item => {
                  const percentage = totalInrConsolidatedSpend > 0 ? Math.round((item.amount / totalInrConsolidatedSpend) * 100) : 0;
                  return (
                    <div key={item.category}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600 }}>{item.category}</span>
                        <span><strong>₹ {item.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> ({percentage}%)</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${percentage}%`, height: "100%", background: "linear-gradient(90deg, #10b981, #38bdf8)", borderRadius: "4px" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Finished Goods (FG) vs Raw Materials (RM) Breakdown */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "1.05rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <BarChart3 size={18} style={{ color: "#34d399" }} /> Item Type Spend Ratio (FG vs RM)
          </h3>

          {viewMode === "multicurrency" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 700 }}>FINISHED GOODS (FG)</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8" }}>¥ {fgMulti.RMB.toLocaleString()} RMB</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fbbf24" }}>$ {fgMulti.USD.toLocaleString()} USD</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399" }}>₹ {fgMulti.INR.toLocaleString()} INR</div>
                </div>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(129, 140, 248, 0.08)", border: "1px solid rgba(129, 140, 248, 0.2)" }}>
                <span style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 700 }}>RAW MATERIALS (RM)</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8" }}>¥ {rmMulti.RMB.toLocaleString()} RMB</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fbbf24" }}>$ {rmMulti.USD.toLocaleString()} USD</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399" }}>₹ {rmMulti.INR.toLocaleString()} INR</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 700 }}>FINISHED GOODS (FG)</span>
                <h4 style={{ fontSize: "1.3rem", marginTop: "6px", color: "var(--text-main)" }}>
                  ₹ {fgInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {totalInrConsolidatedSpend > 0 ? Math.round((fgInr / totalInrConsolidatedSpend) * 100) : 0}% of total spend
                </span>
              </div>

              <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(129, 140, 248, 0.08)", border: "1px solid rgba(129, 140, 248, 0.2)" }}>
                <span style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 700 }}>RAW MATERIALS (RM)</span>
                <h4 style={{ fontSize: "1.3rem", marginTop: "6px", color: "var(--text-main)" }}>
                  ₹ {rmInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {totalInrConsolidatedSpend > 0 ? Math.round((rmInr / totalInrConsolidatedSpend) * 100) : 0}% of total spend
                </span>
              </div>
            </div>
          )}

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Award size={16} style={{ color: "#fbbf24" }} /> Total Catalog Item Master Count: <strong>{items.length} items</strong>
          </div>
        </div>

      </div>

      {/* Top Vendors Spend Table */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Building2 size={20} style={{ color: "var(--primary)" }} /> Vendor Spend Scorecards {viewMode === "inr_consolidated" ? "(Converted in INR ₹)" : "(Multi-Currency)"}
        </h3>
        <div className="table-container" style={{ maxHeight: "320px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.85rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <RenderVendorSortHeader colKey="name" title="Vendor Name" />
                <RenderVendorSortHeader colKey="totalInr" title={viewMode === "inr_consolidated" ? "Consolidated Spend (INR ₹)" : "Multi-Currency Spend Breakdown"} />
                <RenderVendorSortHeader colKey="totalOrders" title="Total POs" />
                <RenderVendorSortHeader colKey="completedOrders" title="Completed Orders" />
                <RenderVendorSortHeader colKey="fulfillmentRate" title="Fulfillment Score" />
                <RenderVendorSortHeader colKey="status" title="Status" />
              </tr>
            </thead>
            <tbody>
              {sortedVendorPerf.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                    No vendor performance data available.
                  </td>
                </tr>
              ) : (
                sortedVendorPerf.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, color: "var(--text-main)" }}>{v.name}</td>
                    
                    {viewMode === "inr_consolidated" ? (
                      <td style={{ fontWeight: 800, color: "#10b981" }}>
                        ₹ {v.totalInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    ) : (
                      <td>
                        <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem" }}>
                          {v.spendRmb > 0 && <span style={{ color: "#38bdf8", fontWeight: 700 }}>¥ {v.spendRmb.toLocaleString()} RMB</span>}
                          {v.spendUsd > 0 && <span style={{ color: "#fbbf24", fontWeight: 700 }}>$ {v.spendUsd.toLocaleString()} USD</span>}
                          {v.spendInr > 0 && <span style={{ color: "#34d399", fontWeight: 700 }}>₹ {v.spendInr.toLocaleString()} INR</span>}
                          {v.spendRmb === 0 && v.spendUsd === 0 && v.spendInr === 0 && <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </div>
                      </td>
                    )}

                    <td>{v.totalOrders}</td>
                    <td>{v.completedOrders}</td>
                    <td>
                      <span className={`badge ${v.fulfillmentRate >= 80 ? "badge-success" : v.fulfillmentRate >= 50 ? "badge-warning" : "badge-danger"}`}>
                        {v.fulfillmentRate}%
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-approved">Active Partner</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Executive Purchase Orders Audit Table */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <FileSpreadsheet size={20} style={{ color: "#38bdf8" }} /> Executive Purchase Orders Audit Trail
          </h3>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search PO #, Item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "30px", fontSize: "0.82rem", width: "180px" }}
              />
            </div>
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: "420px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.83rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <RenderReqSortHeader colKey="id" title="PO Number" />
                <RenderReqSortHeader colKey="orderDate" title="Order Date" />
                <RenderReqSortHeader colKey="category" title="Category" />
                <RenderReqSortHeader colKey="model" title="Item Model / Name" />
                <RenderReqSortHeader colKey="isMaterialRec" title="Stage / Location" />
                <RenderReqSortHeader colKey="orderQuantity" title="Qty" />
                <RenderReqSortHeader colKey="currency" title={viewMode === "inr_consolidated" ? "Original Price" : "Currency"} />
                <RenderReqSortHeader colKey="totalRmb" title={viewMode === "inr_consolidated" ? "Converted Total (INR ₹)" : "Total Spend"} />
                <RenderReqSortHeader colKey="advancePayment" title="Advance Paid" />
                <RenderReqSortHeader colKey="status" title="Status" />
              </tr>
            </thead>
            <tbody>
              {sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No purchase orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                sortedRequests.map(r => {
                  const sym = getSymbol(r.currency);
                  const tot = parseFloat(r.totalRmb || 0);
                  const adv = parseFloat(r.advancePayment || 0);
                  const inrTot = convertToInr(tot, r.currency);
                  const inrAdv = convertToInr(adv, r.currency);

                  let stageBadge = <span className="badge" style={{ background: "rgba(192, 132, 252, 0.15)", color: "#c084fc", border: "1px solid rgba(192, 132, 252, 0.3)" }}>At Vendor Factory</span>;
                  if (r.isMaterialRec === "Yes") {
                    stageBadge = <span className="badge badge-success">Received Stock</span>;
                  } else if (r.cargoId) {
                    stageBadge = <span className="badge badge-cargo">Cargo In-Transit</span>;
                  }

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 800, color: "var(--primary)" }}>{r.id}</td>
                      <td>{r.orderDate || "-"}</td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: "0.72rem" }}>
                          {r.category || "General"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.model}</td>
                      <td>{stageBadge}</td>
                      <td>{r.orderQuantity}</td>
                      
                      {viewMode === "inr_consolidated" ? (
                        <>
                          <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            {sym} {tot.toLocaleString()} ({r.currency || "RMB"})
                          </td>
                          <td style={{ fontWeight: 800, color: "#10b981" }}>
                            ₹ {inrTot.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td>
                            ₹ {inrAdv.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                              {r.currency || "RMB"}
                            </span>
                          </td>
                          <td style={{ fontWeight: 800, color: r.currency === "USD" ? "#fbbf24" : r.currency === "INR" ? "#34d399" : "#38bdf8" }}>
                            {sym} {tot.toLocaleString()}
                          </td>
                          <td>
                            {sym} {adv.toLocaleString()}
                          </td>
                        </>
                      )}

                      <td>
                        <span className={`badge ${r.isMaterialRec === "Yes" ? "badge-success" : "badge-warning"}`}>
                          {r.isMaterialRec === "Yes" ? "Received" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

    </div>
  );
}
