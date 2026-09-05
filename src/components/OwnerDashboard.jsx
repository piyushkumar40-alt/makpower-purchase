import React, { useState, useMemo, useEffect } from "react";
import { 
  Building2, ShieldCheck, DollarSign, Package, TrendingUp, TrendingDown, 
  Layers, Warehouse, Globe, ArrowUpRight, CheckCircle2, AlertTriangle, 
  Search, Filter, PieChart, BarChart2, ChevronRight, Eye, RefreshCw,
  Sparkles, Award, ShieldAlert, Clock, ArrowDownRight, Truck, Info, ChevronDown, X
} from "lucide-react";
import CapitalPipelineStudio from "./CapitalPipelineStudio";
import { parseDateTimestamp } from "./DateRangeFilter";

// Helper: Format large numbers into Indian Crores (₹ Cr) or Lakhs (₹ L)
export function formatCr(val) {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2)} L`;
  }
  return `₹ ${Math.round(num).toLocaleString("en-IN")}`;
}

// Helper: Format amount into Cr number only without mentioning 'Cr' (e.g. ₹ 0.01 or ₹ 1.17)
export function formatCrAmountOnly(val) {
  const num = parseFloat(val) || 0;
  const inCr = num / 10000000;
  if (inCr === 0) return "₹ 0.00";
  if (inCr < 0.01 && inCr > 0) return "₹ 0.01";
  return `₹ ${inCr.toFixed(2)}`;
}

export function formatIndianQty(val) {
  const num = parseInt(val) || 0;
  return num.toLocaleString("en-IN");
}

// Category normalizer for consistent grouping
export function normalizeCategory(cat) {
  if (!cat) return "Other";
  const clean = String(cat).trim();
  const lower = clean.toLowerCase();
  if (lower.includes("polymer") || lower.includes("li-poly") || lower.includes("lithium poly") || lower.includes("pouch battery")) {
    return "Polymer Battery";
  }
  if (lower.includes("neckband") || lower.includes("neck band")) {
    return "Neckband";
  }
  if (lower.includes("charger") || lower.includes("adaptor") || lower.includes("adapter")) {
    return "Chargers";
  }
  if (lower.includes("cable") || lower.includes("data wire") || lower.includes("usb")) {
    return "Data Cables";
  }
  if (lower.includes("earphone") || lower.includes("headphone") || lower.includes("tws") || lower.includes("airpod") || lower.includes("earbuds")) {
    return "Earphones & TWS";
  }
  if (lower.includes("touch") || lower.includes("display") || lower.includes("combo") || lower.includes("folder")) {
    return "Touch & Display";
  }
  if (lower.includes("speaker") || lower.includes("soundbar")) {
    return "Speakers";
  }
  if (lower.includes("power bank") || lower.includes("powerbank")) {
    return "Power Banks";
  }
  if (clean === "General" || clean === "Unspecified") return "Other";
  return clean;
}

export default function OwnerDashboard({
  currentUser = {},
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  items = [],
  itemPrices = [],
  imsTransactions = [],
  imsSummary = null,
  imsPeriodSummary = null,
  imsItemStocks = [],
  crmSalesOrders = [],
  crmDispatches = [],
  crmParties = [],
  partyCategoryMonthlySales = [],
  partyCategoryMonths = [],
  cargoCompanies = [],
  settings = {},
  onUpdateSettings,
  onLogout,
  onPullModuleData,
  loadingModules = {},
  recordSectionVisit,
  currentUserId
}) {
  const [activeTab, setActiveTab] = useState("category_studio"); // "category_studio" | "stock_valuation" | "capital_pipeline"
  const [categorySearch, setCategorySearch] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all"); // "all" | "star" | "steady" | "overstocked" | "reorder"
  const [sortBy, setSortBy] = useState("capital"); // "capital" | "sales" | "inventory" | "china" | "turnover"
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState(null);

  // Live Exchange Rate State for Owner Customization
  const defaultRmb = parseFloat(settings?.exchangeRate) || parseFloat(settings?.rmbToInrRate) || 12.5;
  const defaultUsd = parseFloat(settings?.usdRate) || parseFloat(settings?.usdToInrRate) || 86.5;

  const [rmbRateInput, setRmbRateInput] = useState(String(defaultRmb));
  const [usdRateInput, setUsdRateInput] = useState(String(defaultUsd));
  const [isRateSaved, setIsRateSaved] = useState(false);

  useEffect(() => {
    if (settings?.exchangeRate || settings?.rmbToInrRate) {
      const val = parseFloat(settings?.exchangeRate) || parseFloat(settings?.rmbToInrRate) || 12.5;
      setRmbRateInput(String(val));
    }
    if (settings?.usdRate || settings?.usdToInrRate) {
      const val = parseFloat(settings?.usdRate) || parseFloat(settings?.usdToInrRate) || 86.5;
      setUsdRateInput(String(val));
    }
  }, [settings?.exchangeRate, settings?.rmbToInrRate, settings?.usdRate, settings?.usdToInrRate]);

  const activeRmbRate = parseFloat(rmbRateInput) || defaultRmb;
  const activeUsdRate = parseFloat(usdRateInput) || defaultUsd;

  const handleSaveRates = async () => {
    if (onUpdateSettings) {
      await onUpdateSettings({
        exchangeRate: activeRmbRate,
        rmbToInrRate: activeRmbRate,
        usdRate: activeUsdRate,
        usdToInrRate: activeUsdRate
      });
      setIsRateSaved(true);
      setTimeout(() => setIsRateSaved(false), 2500);
    }
  };

  // Automatically fetch modules if needed
  useEffect(() => {
    if (onPullModuleData) {
      onPullModuleData("items");
      onPullModuleData("itemPrices");
      onPullModuleData("requests");
      onPullModuleData("crmSalesOrders");
      onPullModuleData("crmDispatches");
      onPullModuleData("partyCategoryMonthlySales");
      onPullModuleData("imsTransactions");
    }
  }, []);

  // 1. Build Item Price Lookup Map (Active Purchase Price `pp` in INR)
  const itemPriceMap = useMemo(() => {
    const map = new Map();
    const now = new Date().setHours(0, 0, 0, 0);

    const isPriceActive = (from, to) => {
      if (!from && !to) return true;
      const fromTs = from ? parseDateTimestamp(from) : null;
      const toTs = to ? parseDateTimestamp(to) : null;
      if (fromTs && now < fromTs) return false;
      if (toTs) {
        const toEndDay = new Date(toTs).setHours(23, 59, 59, 999);
        if (now > toEndDay) return false;
      }
      return true;
    };

    const sorted = [...(itemPrices || [])].sort((a, b) => {
      const aActive = isPriceActive(a.from, a.to) ? 1 : 0;
      const bActive = isPriceActive(b.from, b.to) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const tsA = parseDateTimestamp(a.from) || 0;
      const tsB = parseDateTimestamp(b.from) || 0;
      return tsB - tsA;
    });

    sorted.forEach(p => {
      const price = parseFloat(p.pp) || 0;
      if (price > 0) {
        const idKey = p.itemId ? String(p.itemId).trim().toLowerCase() : null;
        const nameKey = p.itemName ? String(p.itemName).trim().toLowerCase() : null;
        if (idKey && !map.has(idKey)) map.set(idKey, price);
        if (nameKey && !map.has(nameKey)) map.set(nameKey, price);
      }
    });
    return map;
  }, [itemPrices]);

  // 2. Build Warehouse-wise Live Stock Lookup Map (Delhi vs Mumbai)
  const warehouseStockMap = useMemo(() => {
    const map = new Map(); // itemId / itemName -> { delhi: 0, mumbai: 0, total: 0 }

    // First initialize from items catalog
    (items || []).forEach(it => {
      const key = String(it.id || it.name).toLowerCase();
      map.set(key, {
        delhi: 0,
        mumbai: 0,
        total: parseInt(it.currentStock) || 0
      });
    });

    // If imsItemStocks exists with location data
    if (Array.isArray(imsItemStocks) && imsItemStocks.length > 0) {
      imsItemStocks.forEach(st => {
        const key = String(st.itemId || st.itemName || st.id || "").toLowerCase();
        if (key) {
          const delhi = parseInt(st.delhiStock || st.delhi || 0) || 0;
          const mumbai = parseInt(st.mumbaiStock || st.mumbai || 0) || 0;
          const tot = parseInt(st.currentStock || st.total || (delhi + mumbai)) || 0;
          map.set(key, { delhi, mumbai, total: tot });
        }
      });
    } else if (Array.isArray(imsTransactions) && imsTransactions.length > 0) {
      // Calculate from live IMS transactions
      const locMap = new Map();
      imsTransactions.forEach(tx => {
        const idKey = String(tx.itemId || tx.itemModel || "").toLowerCase();
        if (!idKey) return;
        if (!locMap.has(idKey)) locMap.set(idKey, { delhi: 0, mumbai: 0, total: 0 });
        const obj = locMap.get(idKey);
        const qty = parseInt(tx.stockQty || tx.qty) || 0;
        const loc = String(tx.location || tx.warehouse || "").toLowerCase();
        if (loc.includes("mumbai")) {
          obj.mumbai += qty;
        } else {
          obj.delhi += qty;
        }
        obj.total += qty;
      });
      locMap.forEach((val, key) => {
        map.set(key, val);
      });
    }

    return map;
  }, [items, imsItemStocks, imsTransactions]);

  // 3. Compute 4-Month Period Labels (Current Month M0, M1, M2, M3)
  const monthLabels = useMemo(() => {
    if (Array.isArray(partyCategoryMonths) && partyCategoryMonths.length >= 4) {
      const last4 = partyCategoryMonths.slice(-4).reverse();
      return last4.map((m, idx) => ({
        key: m.key || m.fullMonth,
        label: m.label || m.key,
        isCurrent: idx === 0
      }));
    }

    const months = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const shortName = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      months.push({
        key: `${y}-${m}`,
        label: shortName,
        isCurrent: i === 0
      });
    }
    return months;
  }, [partyCategoryMonths]);

  // 4. Comprehensive 360° Category Intelligence Matrix
  const categoryMatrix = useMemo(() => {
    const map = new Map();

    const getOrCreateCategory = (rawCat) => {
      const cat = normalizeCategory(rawCat);
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          delhiQty: 0,
          mumbaiQty: 0,
          totalLiveQty: 0,
          delhiCost: 0,
          mumbaiCost: 0,
          totalLiveCost: 0,
          chinaPendingQty: 0,
          chinaCommittedCost: 0,
          totalCapitalInvested: 0,
          m0SalesQty: 0,
          m0SalesRev: 0,
          m1SalesQty: 0,
          m1SalesRev: 0,
          m2SalesQty: 0,
          m2SalesRev: 0,
          m3SalesQty: 0,
          m3SalesRev: 0,
          total4MoSalesQty: 0,
          total4MoSalesRev: 0,
          itemCount: 0,
          itemsList: []
        });
      }
      return map.get(cat);
    };

    // A. Aggregate Live Inventory & Cost from Item Master
    (items || []).forEach(it => {
      const catObj = getOrCreateCategory(it.category);
      const key = String(it.id || it.name).toLowerCase();
      const st = warehouseStockMap.get(key) || { delhi: 0, mumbai: 0, total: parseInt(it.currentStock) || 0 };
      
      const unitPrice = itemPriceMap.get(String(it.id).toLowerCase()) || 
                        itemPriceMap.get(String(it.name).toLowerCase()) || 
                        parseFloat(it.purchasePrice) || 
                        parseFloat(it.pp) || 
                        0;

      const totalStock = Math.max(0, st.total);
      const dStock = Math.max(0, st.delhi || Math.round(totalStock * 0.7)); // Sensible estimate if not split
      const mStock = Math.max(0, st.mumbai || Math.max(0, totalStock - dStock));

      const totalCost = totalStock * unitPrice;
      const dCost = dStock * unitPrice;
      const mCost = mStock * unitPrice;

      catObj.delhiQty += dStock;
      catObj.mumbaiQty += mStock;
      catObj.totalLiveQty += totalStock;
      catObj.delhiCost += dCost;
      catObj.mumbaiCost += mCost;
      catObj.totalLiveCost += totalCost;
      catObj.itemCount += 1;
      
      catObj.itemsList.push({
        id: it.id,
        name: it.name,
        category: catObj.category,
        delhiQty: dStock,
        mumbaiQty: mStock,
        totalQty: totalStock,
        unitPrice,
        totalCost
      });
    });

    // B. Aggregate China Procurement Pipeline (Pending Orders in `requests`)
    (requests || []).forEach(r => {
      const isReceived = r.isMaterialRec === "Yes" || r.status === "Received" || r.status === "Cancelled";
      if (isReceived) return;

      const modelName = r.model || r.itemModel || r.type || "";
      const catObj = getOrCreateCategory(r.category || modelName);
      const orderedQty = parseInt(r.vendorOrderQuantity || r.orderQuantity || r.quantity || 0) || 0;
      if (orderedQty <= 0) return;

      let orderInr = 0;
      const rawTotal = parseFloat(r.totalRmb);
      const rawPrice = parseFloat(r.priceRmb || r.price);
      const cur = (r.currency || "RMB").toUpperCase();

      if (!isNaN(rawTotal) && rawTotal > 0) {
        if (cur === "USD") orderInr = rawTotal * activeUsdRate;
        else if (cur === "INR") orderInr = rawTotal;
        else orderInr = rawTotal * activeRmbRate;
      } else if (!isNaN(rawPrice) && rawPrice > 0) {
        let priceInr = rawPrice;
        if (cur === "USD") priceInr = rawPrice * activeUsdRate;
        else if (cur === "RMB" || cur === "CNY") priceInr = rawPrice * activeRmbRate;
        orderInr = orderedQty * priceInr;
      } else {
        const unitPriceInr = itemPriceMap.get(String(r.itemId || "").toLowerCase()) || 
                             itemPriceMap.get(String(modelName).toLowerCase()) || 
                             0;
        if (unitPriceInr > 0) {
          orderInr = orderedQty * unitPriceInr;
        } else {
          const avgUnitCost = catObj.totalLiveQty > 0 ? (catObj.totalLiveCost / catObj.totalLiveQty) : 0;
          orderInr = orderedQty * (avgUnitCost || 120);
        }
      }

      catObj.chinaPendingQty += orderedQty;
      catObj.chinaCommittedCost += orderInr;
    });

    // C. Aggregate 4-Month Sales Performance
    const m0Key = monthLabels[0]?.key;
    const m1Key = monthLabels[1]?.key;
    const m2Key = monthLabels[2]?.key;
    const m3Key = monthLabels[3]?.key;

    // 1. From Server Aggregated Monthly Sales (`partyCategoryMonthlySales`)
    if (Array.isArray(partyCategoryMonthlySales) && partyCategoryMonthlySales.length > 0) {
      partyCategoryMonthlySales.forEach(row => {
        const catName = row.category || row.cat || "";
        if (!catName) return;
        const catObj = getOrCreateCategory(catName);
        const mKey = row.month;
        const qty = Number(row.salesQty || row.qty || 0);
        const rev = Number(row.salesRevenue || row.revenue || row.totalInr || 0);

        if (mKey === m0Key) {
          catObj.m0SalesQty += qty;
          catObj.m0SalesRev += rev;
        } else if (mKey === m1Key) {
          catObj.m1SalesQty += qty;
          catObj.m1SalesRev += rev;
        } else if (mKey === m2Key) {
          catObj.m2SalesQty += qty;
          catObj.m2SalesRev += rev;
        } else if (mKey === m3Key) {
          catObj.m3SalesQty += qty;
          catObj.m3SalesRev += rev;
        }
      });
    }

    // 2. From CRM Sales Orders (`crmSalesOrders`)
    (crmSalesOrders || []).forEach(o => {
      const orderDate = (o.orderDate || "").slice(0, 7);
      const catObj = getOrCreateCategory(o.category || o.itemModel);
      const qty = parseInt(o.orderQty) || 0;
      const rev = parseFloat(o.totalInr) || 0;

      if (orderDate === m0Key) {
        catObj.m0SalesQty += qty;
        catObj.m0SalesRev += rev;
      } else if (orderDate === m1Key) {
        catObj.m1SalesQty += qty;
        catObj.m1SalesRev += rev;
      } else if (orderDate === m2Key) {
        catObj.m2SalesQty += qty;
        catObj.m2SalesRev += rev;
      } else if (orderDate === m3Key) {
        catObj.m3SalesQty += qty;
        catObj.m3SalesRev += rev;
      }
    });

    // 3. From CRM Dispatches (`crmDispatches`)
    (crmDispatches || []).forEach(d => {
      const dispatchDate = (d.dispatchDate || "").slice(0, 7);
      const catObj = getOrCreateCategory(d.category || d.itemModel);
      const qty = parseInt(d.dispatchedQty || d.totalPcs) || 0;
      const rev = parseFloat(d.totalInr) || 0;

      if (dispatchDate === m0Key) {
        catObj.m0SalesQty += qty;
        catObj.m0SalesRev += rev;
      } else if (dispatchDate === m1Key) {
        catObj.m1SalesQty += qty;
        catObj.m1SalesRev += rev;
      } else if (dispatchDate === m2Key) {
        catObj.m2SalesQty += qty;
        catObj.m2SalesRev += rev;
      } else if (dispatchDate === m3Key) {
        catObj.m3SalesQty += qty;
        catObj.m3SalesRev += rev;
      }
    });

    // 4. From IMS Outward Transactions to Customer Parties
    (imsTransactions || []).forEach(tx => {
      const q = parseInt(tx.stockQty) || 0;
      if (q >= 0) return; // Only outward movements
      const party = (tx.partyName || "").trim();
      if (!party || party === "—") return;

      const dateStr = String(tx.date || "");
      let month = "";
      if (dateStr.includes("-") || dateStr.includes("/")) {
        const parts = dateStr.split(/[-\/\.]/);
        if (parts[0].length === 4) month = `${parts[0]}-${parts[1].padStart(2, "0")}`;
        else if (parts[2] && parts[2].length === 4) month = `${parts[2]}-${parts[1].padStart(2, "0")}`;
      }
      if (!month) return;

      const rawItemId = String(tx.itemId || "").toLowerCase();
      const rawName = String(tx.itemName || "").toLowerCase();
      const matchedItem = (items || []).find(i => String(i.id).toLowerCase() === rawItemId || String(i.name).toLowerCase() === rawName);
      const catObj = getOrCreateCategory(matchedItem?.category || tx.category || tx.itemName);

      const qty = Math.abs(q);
      const unitPrice = itemPriceMap.get(rawItemId) || itemPriceMap.get(rawName) || parseFloat(matchedItem?.purchasePrice) || 0;
      const rev = qty * unitPrice;

      if (month === m0Key) {
        catObj.m0SalesQty += qty;
        catObj.m0SalesRev += rev;
      } else if (month === m1Key) {
        catObj.m1SalesQty += qty;
        catObj.m1SalesRev += rev;
      } else if (month === m2Key) {
        catObj.m2SalesQty += qty;
        catObj.m2SalesRev += rev;
      } else if (month === m3Key) {
        catObj.m3SalesQty += qty;
        catObj.m3SalesRev += rev;
      }
    });

    // D. Final Calculations & Performance Rating Score
    const list = Array.from(map.values()).map(row => {
      const avgUnitPrice = row.totalLiveQty > 0 ? (row.totalLiveCost / row.totalLiveQty) : 100;
      if (row.m0SalesRev === 0 && row.m0SalesQty > 0) row.m0SalesRev = row.m0SalesQty * avgUnitPrice;
      if (row.m1SalesRev === 0 && row.m1SalesQty > 0) row.m1SalesRev = row.m1SalesQty * avgUnitPrice;
      if (row.m2SalesRev === 0 && row.m2SalesQty > 0) row.m2SalesRev = row.m2SalesQty * avgUnitPrice;
      if (row.m3SalesRev === 0 && row.m3SalesQty > 0) row.m3SalesRev = row.m3SalesQty * avgUnitPrice;

      row.totalCapitalInvested = row.totalLiveCost + row.chinaCommittedCost;
      row.total4MoSalesQty = row.m0SalesQty + row.m1SalesQty + row.m2SalesQty + row.m3SalesQty;
      row.total4MoSalesRev = row.m0SalesRev + row.m1SalesRev + row.m2SalesRev + row.m3SalesRev;

      const turnoverRatio = row.totalCapitalInvested > 0 ? (row.total4MoSalesRev / row.totalCapitalInvested) : 0;
      
      let performanceTag = "steady";
      let performanceLabel = "🟢 Steady Performer";
      let performanceScore = 70;

      if (row.total4MoSalesQty > 20000 || row.total4MoSalesRev > 2000000) {
        performanceTag = "star";
        performanceLabel = "🌟 Star Performer";
        performanceScore = 95;
      } else if (row.totalCapitalInvested > 1500000 && row.total4MoSalesQty < 3000) {
        performanceTag = "overstocked";
        performanceLabel = "⚠️ Capital Tied Up";
        performanceScore = 40;
      } else if (row.total4MoSalesQty > 5000 && row.totalLiveQty < 2000 && row.chinaPendingQty === 0) {
        performanceTag = "reorder";
        performanceLabel = "🚨 Reorder Urgently";
        performanceScore = 60;
      }

      return {
        ...row,
        turnoverRatio,
        performanceTag,
        performanceLabel,
        performanceScore
      };
    });

    return list;
  }, [items, itemPriceMap, warehouseStockMap, requests, crmSalesOrders, crmDispatches, imsTransactions, partyCategoryMonthlySales, monthLabels, settings]);

  // Overall Company Grand Totals
  const companyTotals = useMemo(() => {
    let totalStockValuation = 0;
    let totalStockUnits = 0;
    let delhiStockVal = 0;
    let delhiStockUnits = 0;
    let mumbaiStockVal = 0;
    let mumbaiStockUnits = 0;
    let chinaPipelineVal = 0;
    let chinaPipelineUnits = 0;
    let total4MoSalesRevenue = 0;
    let total4MoSalesUnits = 0;

    categoryMatrix.forEach(c => {
      totalStockValuation += c.totalLiveCost;
      totalStockUnits += c.totalLiveQty;
      delhiStockVal += c.delhiCost;
      delhiStockUnits += c.delhiQty;
      mumbaiStockVal += c.mumbaiCost;
      mumbaiStockUnits += c.mumbaiQty;
      chinaPipelineVal += c.chinaCommittedCost;
      chinaPipelineUnits += c.chinaPendingQty;
      total4MoSalesRevenue += c.total4MoSalesRev;
      total4MoSalesUnits += c.total4MoSalesQty;
    });

    const totalEnterpriseCapital = totalStockValuation + chinaPipelineVal;

    return {
      totalStockValuation,
      totalStockUnits,
      delhiStockVal,
      delhiStockUnits,
      mumbaiStockVal,
      mumbaiStockUnits,
      chinaPipelineVal,
      chinaPipelineUnits,
      totalEnterpriseCapital,
      total4MoSalesRevenue,
      total4MoSalesUnits
    };
  }, [categoryMatrix]);

  // Filtered & Sorted Category Rows
  const filteredCategoryRows = useMemo(() => {
    return categoryMatrix
      .filter(row => {
        if (categorySearch.trim()) {
          const q = categorySearch.toLowerCase();
          if (!row.category.toLowerCase().includes(q)) return false;
        }
        if (performanceFilter !== "all" && row.performanceTag !== performanceFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "capital") return b.totalCapitalInvested - a.totalCapitalInvested;
        if (sortBy === "sales") return b.total4MoSalesRev - a.total4MoSalesRev || b.total4MoSalesQty - a.total4MoSalesQty;
        if (sortBy === "inventory") return b.totalLiveCost - a.totalLiveCost;
        if (sortBy === "china") return b.chinaCommittedCost - a.chinaCommittedCost;
        if (sortBy === "turnover") return b.turnoverRatio - a.turnoverRatio;
        return b.performanceScore - a.performanceScore;
      });
  }, [categoryMatrix, categorySearch, performanceFilter, sortBy]);

  // Top 10 High Value Items
  const topHighValueItems = useMemo(() => {
    const list = [];
    categoryMatrix.forEach(cat => {
      cat.itemsList.forEach(it => {
        if (it.totalCost > 0) list.push(it);
      });
    });
    return list.sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
  }, [categoryMatrix]);

  return (
    <div className="card-fade-in" style={{ paddingBottom: "50px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
              <Building2 size={32} style={{ color: "#38bdf8" }} /> Executive Owner Intelligence Studio
            </h1>
            <span className="badge" style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#fff", padding: "4px 14px", fontSize: "0.82rem", borderRadius: "12px", fontWeight: 700 }}>
              <ShieldCheck size={14} style={{ display: "inline", marginRight: "5px" }} /> Executive Mode
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Live enterprise inventory valuation, 360° category capital intelligence, warehouse distribution, and China procurement pipeline tracking.
          </p>
        </div>

        {onLogout && (
          <button onClick={onLogout} className="btn btn-danger btn-sm" style={{ padding: "6px 14px" }}>
            Logout
          </button>
        )}
      </div>

      {/* Top Currency Conversion Control Bar */}
      <div className="glass-panel" style={{ padding: "12px 18px", borderRadius: "12px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", border: "1px solid rgba(56, 189, 248, 0.25)", background: "rgba(15, 23, 42, 0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
            <Globe size={18} style={{ color: "#38bdf8" }} />
            <span>Currency Conversion & Rates:</span>
          </div>

          {/* RMB Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 10px", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#f59e0b" }}>🇨🇳 1 RMB (¥) = ₹</span>
            <input
              type="number"
              step="0.05"
              min="1"
              max="50"
              value={rmbRateInput}
              onChange={e => setRmbRateInput(e.target.value)}
              style={{ width: "65px", padding: "3px 6px", fontSize: "0.88rem", fontWeight: 800, textAlign: "center", background: "#0f172a", border: "1px solid #f59e0b", borderRadius: "6px", color: "#f59e0b" }}
            />
          </div>

          {/* USD Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "4px 10px", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#38bdf8" }}>🇺🇸 1 USD ($) = ₹</span>
            <input
              type="number"
              step="0.1"
              min="50"
              max="150"
              value={usdRateInput}
              onChange={e => setUsdRateInput(e.target.value)}
              style={{ width: "70px", padding: "3px 6px", fontSize: "0.88rem", fontWeight: 800, textAlign: "center", background: "#0f172a", border: "1px solid #38bdf8", borderRadius: "6px", color: "#38bdf8" }}
            />
          </div>

          {/* Save Button */}
          {onUpdateSettings && (
            <button
              onClick={handleSaveRates}
              className="btn btn-sm btn-primary"
              style={{ fontSize: "0.78rem", padding: "5px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              {isRateSaved ? <><CheckCircle2 size={14} style={{ color: "#34d399" }} /> Rates Saved!</> : <><RefreshCw size={13} /> Save Default</>}
            </button>
          )}
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 6px #10b981" }}></span>
          Live calculations update instantly on rate change
        </div>
      </div>

      {/* Primary Executive Navigation Tabs */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("category_studio")}
          className={`btn ${activeTab === "category_studio" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700, padding: "8px 18px", fontSize: "0.9rem" }}
        >
          <Sparkles size={16} /> 360° Category Capital & Performance Studio
        </button>
        <button
          onClick={() => setActiveTab("stock_valuation")}
          className={`btn ${activeTab === "stock_valuation" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700, padding: "8px 18px", fontSize: "0.9rem" }}
        >
          <Layers size={16} /> Live Stock Valuation (₹ Cr) & Warehouse Hubs
        </button>
        <button
          onClick={() => setActiveTab("capital_pipeline")}
          className={`btn ${activeTab === "capital_pipeline" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700, padding: "8px 18px", fontSize: "0.9rem" }}
        >
          <Truck size={16} /> China Procurement & International Cargo
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 360° CATEGORY CAPITAL & PERFORMANCE STUDIO                         */}
      {/* ========================================================================= */}
      {activeTab === "category_studio" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Top High-Level KPI Summary Banner */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            <div className="glass-panel" style={{ padding: "18px 20px", borderRadius: "12px", borderLeft: "4px solid #38bdf8" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Total Enterprise Capital</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#38bdf8", marginTop: "4px" }}>{formatCr(companyTotals.totalEnterpriseCapital)}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>Live Stock + China Committed</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px 20px", borderRadius: "12px", borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Live Warehouse Stock</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>{formatCr(companyTotals.totalStockValuation)}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{formatIndianQty(companyTotals.totalStockUnits)} Pcs (Delhi + Mumbai)</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px 20px", borderRadius: "12px", borderLeft: "4px solid #f59e0b" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>China Open Pipeline</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f59e0b", marginTop: "4px" }}>{formatCr(companyTotals.chinaPipelineVal)}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{formatIndianQty(companyTotals.chinaPipelineUnits)} Pcs in Production / Transit</div>
            </div>

            <div className="glass-panel" style={{ padding: "18px 20px", borderRadius: "12px", borderLeft: "4px solid #8b5cf6" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>4-Month Sales Track</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#8b5cf6", marginTop: "4px" }}>{formatCr(companyTotals.total4MoSalesRevenue)}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{formatIndianQty(companyTotals.total4MoSalesUnits)} Pcs Sold Across All Lines</div>
            </div>
          </div>

          {/* Search, Filter & Sort Toolstrip */}
          <div className="glass-panel" style={{ padding: "14px 18px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: "1 1 320px" }}>
              <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
                <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search Category (e.g. Neckband, Polymer, Charger)..."
                  className="form-control"
                  style={{ paddingLeft: "32px", fontSize: "0.85rem", height: "36px" }}
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                />
              </div>

              {/* Performance Filter Pills */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  onClick={() => setPerformanceFilter("all")}
                  className={`btn btn-sm ${performanceFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.76rem" }}
                >
                  All ({categoryMatrix.length})
                </button>
                <button
                  onClick={() => setPerformanceFilter("star")}
                  className={`btn btn-sm ${performanceFilter === "star" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.76rem" }}
                >
                  🌟 Stars ({categoryMatrix.filter(c => c.performanceTag === "star").length})
                </button>
                <button
                  onClick={() => setPerformanceFilter("overstocked")}
                  className={`btn btn-sm ${performanceFilter === "overstocked" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.76rem" }}
                >
                  ⚠️ Overstocked ({categoryMatrix.filter(c => c.performanceTag === "overstocked").length})
                </button>
                <button
                  onClick={() => setPerformanceFilter("reorder")}
                  className={`btn btn-sm ${performanceFilter === "reorder" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.76rem" }}
                >
                  🚨 Low Stock ({categoryMatrix.filter(c => c.performanceTag === "reorder").length})
                </button>
              </div>
            </div>

            {/* Sort Control */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Sort By:</span>
              <select
                className="form-control"
                style={{ fontSize: "0.82rem", height: "36px", padding: "4px 8px", width: "auto" }}
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="capital">Highest Capital Involved (₹)</option>
                <option value="sales">Top 4-Month Sales Revenue</option>
                <option value="inventory">Largest Live Stock Value</option>
                <option value="china">Highest China Pipeline</option>
                <option value="turnover">Fastest Inventory Turnover</option>
              </select>
            </div>
          </div>

          {/* Master 360° Category Financial & Operational Table */}
          <div className="glass-panel" style={{ padding: "0", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-glass)" }}>
            <div className="desktop-table-view" style={{ overflowX: "auto" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                    <th style={{ width: "16%" }}>Product Category</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total Capital Invested</th>
                    <th style={{ width: "20%", textAlign: "center" }}>Warehouse Stock (Units & Cost)</th>
                    <th style={{ width: "14%", textAlign: "center" }}>China Pipeline</th>
                    <th style={{ width: "22%", textAlign: "center" }}>4-Month Sales Performance</th>
                    <th style={{ width: "14%", textAlign: "center" }}>Performance Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No categories found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCategoryRows.map(row => (
                      <tr 
                        key={row.category} 
                        className="table-row-hover"
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedCategoryDetail(row)}
                      >
                        {/* Category Name & SKU Breadth */}
                        <td>
                          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--primary)" }}>{row.category}</div>
                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {row.itemCount} Master SKUs cataloged
                          </div>
                        </td>

                        {/* Total Capital Invested in this Category */}
                        <td style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#38bdf8" }}>
                            {formatCr(row.totalCapitalInvested)}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            Stock: {formatCr(row.totalLiveCost)} | China: {formatCr(row.chinaCommittedCost)}
                          </div>
                        </td>

                        {/* Delhi vs Mumbai Live Inventory Breakdown */}
                        <td>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "0.76rem" }}>
                            <div style={{ background: "rgba(56, 189, 248, 0.08)", padding: "4px 6px", borderRadius: "6px", textAlign: "center" }}>
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>DELHI</span>
                              <strong style={{ color: "#38bdf8" }}>{formatIndianQty(row.delhiQty)} Pcs</strong>
                              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{formatCr(row.delhiCost)}</div>
                            </div>
                            <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "4px 6px", borderRadius: "6px", textAlign: "center" }}>
                              <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>MUMBAI</span>
                              <strong style={{ color: "#10b981" }}>{formatIndianQty(row.mumbaiQty)} Pcs</strong>
                              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{formatCr(row.mumbaiCost)}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Total Live: <strong>{formatIndianQty(row.totalLiveQty)} Pcs</strong> ({formatCr(row.totalLiveCost)})
                          </div>
                        </td>

                        {/* China Open Orders Committed */}
                        <td style={{ textAlign: "center" }}>
                          <div style={{ fontWeight: 700, color: row.chinaPendingQty > 0 ? "#f59e0b" : "var(--text-muted)", fontSize: "0.92rem" }}>
                            {row.chinaPendingQty > 0 ? `${formatIndianQty(row.chinaPendingQty)} Pcs` : "No Orders Pending"}
                          </div>
                          {row.chinaPendingQty > 0 && (
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
                              Value: <strong>{formatCr(row.chinaCommittedCost)}</strong>
                            </div>
                          )}
                        </td>

                        {/* 4-Month Sales Track */}
                        <td>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", textAlign: "center", fontSize: "0.72rem" }}>
                            {monthLabels.map((m, idx) => {
                              const qty = idx === 0 ? row.m0SalesQty : idx === 1 ? row.m1SalesQty : idx === 2 ? row.m2SalesQty : row.m3SalesQty;
                              const rev = idx === 0 ? row.m0SalesRev : idx === 1 ? row.m1SalesRev : idx === 2 ? row.m2SalesRev : row.m3SalesRev;
                              const amtCr = formatCrAmountOnly(rev);

                              return (
                                <div key={m.key} style={{ background: m.isCurrent ? "rgba(56, 189, 248, 0.12)" : "rgba(255,255,255,0.03)", padding: "4px 2px", borderRadius: "5px", display: "flex", flexDirection: "column", gap: "1px" }}>
                                  <div style={{ color: "var(--text-muted)", fontSize: "0.65rem", fontWeight: m.isCurrent ? 700 : 500 }}>{m.label}</div>
                                  <div style={{ fontWeight: 700, color: qty > 0 ? "var(--text-main)" : "var(--text-muted)", fontSize: "0.78rem" }}>{formatIndianQty(qty)}</div>
                                  <div style={{ fontSize: "0.66rem", color: rev > 0 ? "var(--success)" : "var(--text-muted)", fontWeight: 600 }}>({amtCr})</div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ textAlign: "center", marginTop: "4px", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            4-Mo Total: <strong style={{ color: "var(--primary)" }}>{formatIndianQty(row.total4MoSalesQty)} Pcs</strong> ({formatCr(row.total4MoSalesRev)})
                          </div>
                        </td>

                        {/* Health & Growth Rating Badge */}
                        <td style={{ textAlign: "center" }}>
                          <span className="badge" style={{
                            padding: "6px 10px",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            borderRadius: "8px",
                            background: row.performanceTag === "star" ? "rgba(245, 158, 11, 0.15)" : row.performanceTag === "overstocked" ? "rgba(239, 68, 68, 0.15)" : row.performanceTag === "reorder" ? "rgba(236, 72, 153, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: row.performanceTag === "star" ? "#f59e0b" : row.performanceTag === "overstocked" ? "#ef4444" : row.performanceTag === "reorder" ? "#ec4899" : "#10b981",
                            border: `1px solid ${row.performanceTag === "star" ? "rgba(245, 158, 11, 0.3)" : row.performanceTag === "overstocked" ? "rgba(239, 68, 68, 0.3)" : row.performanceTag === "reorder" ? "rgba(236, 72, 153, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                          }}>
                            {row.performanceLabel}
                          </span>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Turnover: {(row.turnoverRatio * 100).toFixed(0)}% return
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for 360° Studio */}
            <div className="mobile-card-view" style={{ padding: "12px", display: "none", flexDirection: "column", gap: "12px" }}>
              {filteredCategoryRows.map(row => (
                <div 
                  key={row.category} 
                  className="glass-panel" 
                  style={{ padding: "14px", borderRadius: "10px", cursor: "pointer" }}
                  onClick={() => setSelectedCategoryDetail(row)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>{row.category}</h3>
                      <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{row.itemCount} SKUs</span>
                    </div>
                    <span className="badge" style={{ fontSize: "0.7rem" }}>{row.performanceLabel}</span>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.15)", padding: "8px", borderRadius: "8px", marginBottom: "10px" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>TOTAL CAPITAL INVESTED</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>{formatCr(row.totalCapitalInvested)}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Live Stock: {formatCr(row.totalLiveCost)} | China: {formatCr(row.chinaCommittedCost)}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px", fontSize: "0.76rem" }}>
                    <div style={{ background: "rgba(56, 189, 248, 0.08)", padding: "6px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>DELHI STOCK</span>
                      <div style={{ fontWeight: 700, color: "#38bdf8" }}>{formatIndianQty(row.delhiQty)} Pcs</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{formatCr(row.delhiCost)}</div>
                    </div>
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "6px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>MUMBAI STOCK</span>
                      <div style={{ fontWeight: 700, color: "#10b981" }}>{formatIndianQty(row.mumbaiQty)} Pcs</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{formatCr(row.mumbaiCost)}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderTop: "1px solid var(--border-glass)", paddingTop: "8px" }}>
                    <span>China Orders: <strong style={{ color: "#f59e0b" }}>{formatIndianQty(row.chinaPendingQty)} Pcs</strong></span>
                    <span>4-Mo Sales: <strong style={{ color: "var(--primary)" }}>{formatIndianQty(row.total4MoSalesQty)} Pcs</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LIVE STOCK VALUATION (₹ CR) & WAREHOUSE HUBS                       */}
      {/* ========================================================================= */}
      {activeTab === "stock_valuation" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Executive Valuation Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px", borderLeft: "5px solid #10b981" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Total Company Stock Valuation</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#10b981", marginTop: "6px" }}>{formatCr(companyTotals.totalStockValuation)}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "4px" }}>
                <strong>{formatIndianQty(companyTotals.totalStockUnits)} Total Pieces</strong> across {items.length} SKUs
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px", borderLeft: "5px solid #38bdf8" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Delhi Warehouse Hub</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#38bdf8", marginTop: "6px" }}>{formatCr(companyTotals.delhiStockVal)}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "4px" }}>
                <strong>{formatIndianQty(companyTotals.delhiStockUnits)} Pieces</strong> ({((companyTotals.delhiStockVal / (companyTotals.totalStockValuation || 1)) * 100).toFixed(1)}% of total inventory)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: "20px", borderRadius: "14px", borderLeft: "5px solid #f59e0b" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Mumbai Warehouse Hub</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f59e0b", marginTop: "6px" }}>{formatCr(companyTotals.mumbaiStockVal)}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "4px" }}>
                <strong>{formatIndianQty(companyTotals.mumbaiStockUnits)} Pieces</strong> ({((companyTotals.mumbaiStockVal / (companyTotals.totalStockValuation || 1)) * 100).toFixed(1)}% of total inventory)
              </div>
            </div>
          </div>

          {/* Visual Stock Breakdown: Category Distribution Progress Bars */}
          <div className="glass-panel" style={{ padding: "22px", borderRadius: "14px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "16px", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
              <PieChart size={20} style={{ color: "var(--primary)" }} /> Category Stock Valuation Share
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {categoryMatrix.map(cat => {
                const percent = companyTotals.totalStockValuation > 0 
                  ? ((cat.totalLiveCost / companyTotals.totalStockValuation) * 100) 
                  : 0;

                return (
                  <div key={cat.category} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{cat.category} ({formatIndianQty(cat.totalLiveQty)} Pcs)</span>
                      <span><strong style={{ color: "var(--primary)" }}>{formatCr(cat.totalLiveCost)}</strong> <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>({percent.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${percent}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #818cf8)", borderRadius: "4px" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 10 High-Value Stock Leaderboard */}
          <div className="glass-panel" style={{ padding: "22px", borderRadius: "14px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "16px", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Award size={20} style={{ color: "#f59e0b" }} /> Top 10 High-Value Inventory Assets (Capital Concentration)
            </h3>

            <div className="desktop-table-view">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                    <th style={{ width: "8%" }}>Rank</th>
                    <th style={{ width: "32%" }}>Item Name</th>
                    <th style={{ width: "18%" }}>Category</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total Units</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Unit Purchase Cost</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topHighValueItems.map((item, idx) => (
                    <tr key={item.id || item.name} className="table-row-hover">
                      <td style={{ fontWeight: 800, color: idx < 3 ? "#f59e0b" : "var(--text-muted)" }}>
                        #{idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>{item.name}</td>
                      <td><span className="badge badge-secondary">{item.category}</span></td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatIndianQty(item.totalQty)} Pcs</td>
                      <td style={{ textAlign: "right" }}>₹ {item.unitPrice.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>{formatCr(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CAPITAL & PROCUREMENT PIPELINE (EXISTING MODULE)                    */}
      {/* ========================================================================= */}
      {activeTab === "capital_pipeline" && (
        <CapitalPipelineStudio 
          requests={requests}
          cargos={cargos}
          vendors={vendors}
          users={users}
          settings={{
            ...settings,
            exchangeRate: activeRmbRate,
            rmbToInrRate: activeRmbRate,
            usdRate: activeUsdRate,
            usdToInrRate: activeUsdRate
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* CATEGORY DRILLDOWN MODAL                                                  */}
      {/* ========================================================================= */}
      {selectedCategoryDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedCategoryDetail(null)} style={{ zIndex: 1100, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
          <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "880px", width: "95%", maxHeight: "90vh", overflowY: "auto", padding: "24px", position: "relative" }}>
            
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <div>
                <span className="badge badge-primary" style={{ fontSize: "0.75rem", marginBottom: "6px" }}>360° Category Deep Dive</span>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>{selectedCategoryDetail.category}</h2>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  {selectedCategoryDetail.itemsList.length} SKUs in this product line
                </div>
              </div>
              <button onClick={() => setSelectedCategoryDetail(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                <X size={22} />
              </button>
            </div>

            {/* Top Stat Matrix */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "18px" }}>
              <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Total Capital Invested</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>{formatCr(selectedCategoryDetail.totalCapitalInvested)}</div>
              </div>
              <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Live Stock Units</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981" }}>{formatIndianQty(selectedCategoryDetail.totalLiveQty)} Pcs</div>
              </div>
              <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>China Ordered Units</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>{formatIndianQty(selectedCategoryDetail.chinaPendingQty)} Pcs</div>
              </div>
              <div className="glass-panel" style={{ padding: "10px", textAlign: "center", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>4-Month Sales</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#8b5cf6" }}>{formatIndianQty(selectedCategoryDetail.total4MoSalesQty)} Pcs</div>
              </div>
            </div>

            {/* Month-by-Month Sales Trend Strip */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)" }}>4-Month Sales Trend:</span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {monthLabels.map((m, idx) => {
                  const q = idx === 0 ? selectedCategoryDetail.m0SalesQty : idx === 1 ? selectedCategoryDetail.m1SalesQty : idx === 2 ? selectedCategoryDetail.m2SalesQty : selectedCategoryDetail.m3SalesQty;
                  const r = idx === 0 ? selectedCategoryDetail.m0SalesRev : idx === 1 ? selectedCategoryDetail.m1SalesRev : idx === 2 ? selectedCategoryDetail.m2SalesRev : selectedCategoryDetail.m3SalesRev;
                  return (
                    <div key={m.key} style={{ background: m.isCurrent ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: "6px", textAlign: "center", border: m.isCurrent ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid var(--border-glass)" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>{m.label}</span>
                      <strong style={{ fontSize: "0.82rem", color: q > 0 ? "var(--text-main)" : "var(--text-muted)" }}>{formatIndianQty(q)} Pcs</strong>
                      <span style={{ fontSize: "0.72rem", color: r > 0 ? "var(--success)" : "var(--text-muted)", display: "block", fontWeight: 600 }}>({formatCrAmountOnly(r)})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SKU Breakdown Table */}
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-main)" }}>Item SKUs Inventory & Valuation</h4>
            <div style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "8px" }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                    <th>Item Model</th>
                    <th style={{ textAlign: "right" }}>Delhi Pcs</th>
                    <th style={{ textAlign: "right" }}>Mumbai Pcs</th>
                    <th style={{ textAlign: "right" }}>Total Stock</th>
                    <th style={{ textAlign: "right" }}>Unit Cost (₹)</th>
                    <th style={{ textAlign: "right" }}>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCategoryDetail.itemsList.map(item => (
                    <tr key={item.id || item.name} className="table-row-hover">
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ textAlign: "right", color: "#38bdf8" }}>{formatIndianQty(item.delhiQty)}</td>
                      <td style={{ textAlign: "right", color: "#10b981" }}>{formatIndianQty(item.mumbaiQty)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatIndianQty(item.totalQty)}</td>
                      <td style={{ textAlign: "right" }}>₹ {item.unitPrice.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>{formatCr(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
