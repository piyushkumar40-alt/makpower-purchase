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

      {/* Purchase Report Module */}
      <CapitalPipelineStudio 
        requests={requests}
        cargos={cargos}
        vendors={vendors}
        users={users}
        settings={settings}
      />
    </div>
  );
}
