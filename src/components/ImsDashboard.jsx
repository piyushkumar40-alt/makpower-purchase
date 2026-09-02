import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Package, TrendingUp, TrendingDown, Layers, Search, Filter, Download, 
  Plus, UploadCloud, AlertTriangle, CheckCircle2, RefreshCw, X, Edit2, 
  Trash2, FileText, ArrowUpDown, Calendar, Building2, Tag, ShieldAlert,
  ChevronRight, Database, Check, Eye
} from "lucide-react";
import Pagination, { SmartSelectionBar } from "./Pagination";
import { useLoading } from "../context/LoadingContext";
import { initialImsTransactions } from "../mockData";
import DateRangeFilter, { isDateInBetween, parseDateTimestamp, formatDisplayDate } from "./DateRangeFilter";

export default function ImsDashboard({
  currentUser,
  items = [],
  imsTransactions = [],
  imsSummary = null,
  imsPeriodSummary = null,
  imsItemStocks = [],
  imsRange = "3days",
  onFetchFullHistory,
  onRefreshImsSummary,
  crmParties = [],
  vendors = [],
  loading = false,
  initialLoadComplete = false,
  onAddTransaction,
  onBatchUploadTransactions,
  onDeleteTransaction,
  onDeleteRange,
  onResolveMissingId,
  onAddItem,
  onNavigateView,
  onPullModuleData,
  loadingModules = {},
  recordSectionVisit,
  currentUserId
}) {
  const effectiveTransactions = useMemo(() => {
    return Array.isArray(imsTransactions) ? imsTransactions : [];
  }, [imsTransactions]);

  const [hasReceivedData, setHasReceivedData] = useState(() => (Array.isArray(imsTransactions) && imsTransactions.length > 0));

  useEffect(() => {
    if (initialLoadComplete || (Array.isArray(imsTransactions) && imsTransactions.length > 0)) {
      setHasReceivedData(true);
    }
  }, [initialLoadComplete, imsTransactions]);

  const isDataLoading = Boolean(loading) || !initialLoadComplete || Boolean(loadingModules?.imsTransactions) || Boolean(loadingModules?.ims_transactions) || (!hasReceivedData && effectiveTransactions.length === 0);

  // Date Range Defaults to Last 3 Days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => (new Date()).toISOString().split("T")[0]);

  useEffect(() => {
    if (onPullModuleData) {
      onPullModuleData("imsTransactions", { startDate, endDate });
    }
    if (onRefreshImsSummary) {
      onRefreshImsSummary();
    }
    const uId = currentUserId || currentUser?.id;
    if (recordSectionVisit && uId) {
      recordSectionVisit(uId, "imsTransactions");
    }
  }, []);

  // Active Tab: "ledger" | "matrix" | "bulk" | "missingids"
  const [activeTab, setActiveTab] = useState("ledger");

  // Filter States for Ledger - Multi-Search with Field Target Scope (Party, Category, Item, Location, ID, All)
  const [searchFilters, setSearchFilters] = useState([{ query: "", scope: "all" }]);
  const [activeSearchDropdownIndex, setActiveSearchDropdownIndex] = useState(null);

  const handleAddSearchQuery = () => {
    setSearchFilters(prev => [...prev, { query: "", scope: "all" }]);
  };

  const handleUpdateSearchQuery = (index, val) => {
    setSearchFilters(prev => {
      const next = [...prev];
      next[index] = { ...next[index], query: val };
      return next;
    });
    if (val && val.trim()) {
      setActiveSearchDropdownIndex(index);
    } else {
      setActiveSearchDropdownIndex(null);
    }
  };

  const handleSetSearchScope = (index, scope) => {
    setSearchFilters(prev => {
      const next = [...prev];
      next[index] = { ...next[index], scope };
      return next;
    });
    setActiveSearchDropdownIndex(null);
  };

  const handleRemoveSearchQuery = (index) => {
    setSearchFilters(prev => {
      if (prev.length <= 1) return [{ query: "", scope: "all" }];
      return prev.filter((_, i) => i !== index);
    });
    setActiveSearchDropdownIndex(null);
  };

  const activeSearchItems = useMemo(() => {
    const list = [];
    searchFilters.forEach(sf => {
      const q = (sf.query || "").trim().toLowerCase();
      if (!q) return;
      if (q.includes(",")) {
        q.split(",").forEach(part => {
          const trimmed = part.trim();
          if (trimmed) list.push({ query: trimmed, scope: sf.scope || "all" });
        });
      } else {
        list.push({ query: q, scope: sf.scope || "all" });
      }
    });
    return list;
  }, [searchFilters]);

  // Distinct Parties found across all transactions for quick dropdown filter
  const distinctParties = useMemo(() => {
    const set = new Set();
    effectiveTransactions.forEach(tx => {
      const p = (tx.partyName || tx.party || "").trim();
      if (p && p !== "—") set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [effectiveTransactions]);

  // Distinct Categories found in item catalog for dropdown filter
  const distinctCategories = useMemo(() => {
    const set = new Set();
    (items || []).forEach(it => {
      const c = (it.category || "").trim();
      if (c && c !== "General" && c !== "Unspecified") set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const [selectedPartyFilter, setSelectedPartyFilter] = useState("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all"); // "all" | "IN" | "OUT"
  const [missingIdFilter, setMissingIdFilter] = useState("all"); // "all" | "missing" | "linked"
  const [locationFilter, setLocationFilter] = useState("all"); // "all" | "Delhi" | "Mumbai"
  const [selectedItemFilter, setSelectedItemFilter] = useState("all");

  // Dynamic backend fetch whenever user changes date range in DateRangeFilter
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (onPullModuleData) {
      onPullModuleData("imsTransactions", { startDate, endDate });
    }
  }, [startDate, endDate]);

  // Pagination States (Default 50 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPerPage, setMatrixPerPage] = useState(50);

  const [missingPage, setMissingPage] = useState(1);
  const [missingPerPage, setMissingPerPage] = useState(50);

  // Reset current page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilters, selectedPartyFilter, selectedCategoryFilter, startDate, endDate, movementFilter, missingIdFilter, locationFilter, selectedItemFilter]);

  // Multi-row Checkbox Selection
  const [selectedTxIds, setSelectedTxIds] = useState([]);

  // Date Range Purge / Bulk Delete Modal State
  const [showDeleteRangeModal, setShowDeleteRangeModal] = useState(false);
  const [delRangeStart, setDelRangeStart] = useState("");
  const [delRangeEnd, setDelRangeEnd] = useState("");
  const [delRangeLocation, setDelRangeLocation] = useState("all");
  const [isDeletingRange, setIsDeletingRange] = useState(false);

  // Single Transaction Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Missing ID Quick Resolution Modal
  const [resolvingMissingItemName, setResolvingMissingItemName] = useState(null);
  const [createMasterCategory, setCreateMasterCategory] = useState("Chargers");
  const [createMasterType, setCreateMasterType] = useState("FG");
  const [createMasterUnit, setCreateMasterUnit] = useState("Pcs");
  const [createMasterDesc, setCreateMasterDesc] = useState("");
  const [mapExistingItemId, setMapExistingItemId] = useState("");

  // Bulk Ingestion State
  const [bulkRawText, setBulkRawText] = useState("");
  const [bulkParsedRows, setBulkParsedRows] = useState([]);
  const [bulkUploadMsg, setBulkUploadMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  // ==================== METRICS CALCULATIONS ====================
  const {
    totalNetStock,
    totalInwardUnits,
    totalOutwardUnits,
    delhiStock,
    mumbaiStock,
    missingIdsCount,
    distinctMissingItems
  } = useMemo(() => {
    // If backend provided precalculated summary for full stock across all 1.6+ lakh rows, use it!
    if (imsSummary) {
      return {
        totalNetStock: imsSummary.totalNetStock ?? 0,
        totalInwardUnits: imsSummary.totalInwardUnits ?? 0,
        totalOutwardUnits: imsSummary.totalOutwardUnits ?? 0,
        delhiStock: imsSummary.delhiStock ?? 0,
        mumbaiStock: imsSummary.mumbaiStock ?? 0,
        missingIdsCount: imsSummary.missingIdsCount ?? 0,
        distinctMissingItems: Array.isArray(imsSummary.distinctMissingItems) ? imsSummary.distinctMissingItems : []
      };
    }

    let net = 0;
    let inUnits = 0;
    let outUnits = 0;
    let delhiNet = 0;
    let mumbaiNet = 0;
    let missingCount = 0;
    const missingSet = new Map(); // itemName -> { count, totalQty }

    effectiveTransactions.forEach(tx => {
      const q = parseInt(tx.stockQty) || 0;
      const loc = (tx.location || "Delhi").trim();
      net += q;
      if (q > 0) inUnits += q;
      else outUnits += Math.abs(q);

      if (loc.toLowerCase() === "mumbai") {
        mumbaiNet += q;
      } else {
        delhiNet += q;
      }

      if (tx.isMissingId || !tx.itemId) {
        missingCount++;
        const itemKey = (tx.itemName || "Unknown Item").trim();
        if (!missingSet.has(itemKey)) {
          missingSet.set(itemKey, { name: itemKey, count: 0, totalQty: 0, sampleDate: tx.date, sampleParty: tx.partyName });
        }
        const entry = missingSet.get(itemKey);
        entry.count++;
        entry.totalQty += q;
      }
    });

    return {
      totalNetStock: net,
      totalInwardUnits: inUnits,
      totalOutwardUnits: outUnits,
      delhiStock: delhiNet,
      mumbaiStock: mumbaiNet,
      missingIdsCount: missingCount,
      distinctMissingItems: Array.from(missingSet.values())
    };
  }, [effectiveTransactions, imsSummary]);

  // ==================== FILTERED TRANSACTIONS ====================
  const filteredTransactions = useMemo(() => {
    return effectiveTransactions.filter(tx => {
      // Category resolution for search & filtering
      const rawId = String(tx.itemId || "").trim().toLowerCase();
      const cleanId = rawId.replace(/^#+/, "");
      const foundItem = itemCatalogMap.get(rawId) || itemCatalogMap.get(cleanId) || itemCatalogMap.get('#' + cleanId) || itemCatalogMap.get((tx.itemName || "").trim().toLowerCase());
      const cat = (tx.category || foundItem?.category || "").trim().toLowerCase();

      // Field-Scoped Search Matching
      if (activeSearchItems.length > 0) {
        const party = (tx.partyName || tx.party || tx.customer || tx.vendorName || tx.vendor || "").toLowerCase();
        const item = (tx.itemName || tx.item || tx.name || "").toLowerCase();
        const id = (tx.itemId || tx.id || "").toLowerCase();
        const remarks = (tx.remarks || tx.narration || "").toLowerCase();
        const loc = (tx.location || tx.godown || tx.warehouse || "").toLowerCase();
        const date = tx.date || "";

        const matchesAll = activeSearchItems.every(search => {
          const term = search.query;
          const scope = search.scope || "all";
          const words = term.split(/\s+/).filter(Boolean);

          if (scope === "category") {
            return words.length > 1 ? words.every(w => cat.includes(w)) : cat.includes(term);
          }
          if (scope === "party") {
            return words.length > 1 ? words.every(w => party.includes(w)) : party.includes(term);
          }
          if (scope === "item") {
            return words.length > 1 ? words.every(w => item.includes(w)) : item.includes(term);
          }
          if (scope === "location") {
            return words.length > 1 ? words.every(w => loc.includes(w)) : loc.includes(term);
          }
          if (scope === "id") {
            return words.length > 1 ? words.every(w => id.includes(w)) : id.includes(term);
          }

          // scope === "all"
          if (words.length > 1) {
            return words.every(w => party.includes(w) || item.includes(w) || id.includes(w) || cat.includes(w) || remarks.includes(w) || loc.includes(w) || date.includes(w));
          }
          return party.includes(term) || item.includes(term) || id.includes(term) || cat.includes(term) || remarks.includes(term) || loc.includes(term) || date.includes(term);
        });

        if (!matchesAll) return false;
      }

      // Category Quick Filter
      if (selectedCategoryFilter !== "all") {
        if (cat !== selectedCategoryFilter.trim().toLowerCase()) return false;
      }

      // Party Name Quick Filter
      if (selectedPartyFilter !== "all") {
        const partyVal = (tx.partyName || tx.party || "").trim().toLowerCase();
        if (partyVal !== selectedPartyFilter.trim().toLowerCase()) return false;
      }

      // Warehouse Location Filter
      if (locationFilter !== "all") {
        const txLoc = (tx.location || "Delhi").trim().toLowerCase();
        if (txLoc !== locationFilter.toLowerCase()) return false;
      }

      // Date range filter
      if (startDate || endDate) {
        if (!isDateInBetween(tx.date, startDate, endDate)) return false;
      }

      // Movement Type
      if (movementFilter === "IN" && (parseInt(tx.stockQty) || 0) <= 0) return false;
      if (movementFilter === "OUT" && (parseInt(tx.stockQty) || 0) >= 0) return false;

      // Missing ID
      if (missingIdFilter === "missing" && !tx.isMissingId && tx.itemId) return false;
      if (missingIdFilter === "linked" && (tx.isMissingId || !tx.itemId)) return false;

      // Item Filter
      if (selectedItemFilter !== "all") {
        if (tx.itemId !== selectedItemFilter && tx.itemName !== selectedItemFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      if (sortField === "date") {
        valA = parseDateTimestamp(a.date) || 0;
        valB = parseDateTimestamp(b.date) || 0;
      } else if (sortField === "stockQty") {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [effectiveTransactions, itemCatalogMap, activeSearchItems, selectedCategoryFilter, selectedPartyFilter, locationFilter, startDate, endDate, movementFilter, missingIdFilter, selectedItemFilter, sortField, sortAsc]);

  // Dynamic metrics calculated from filtered transactions
  const {
    filteredNetStock,
    filteredInwardUnits,
    filteredOutwardUnits,
    filteredDelhiStock,
    filteredMumbaiStock
  } = useMemo(() => {
    let net = 0;
    let inUnits = 0;
    let outUnits = 0;
    let delhiNet = 0;
    let mumbaiNet = 0;

    filteredTransactions.forEach(tx => {
      const q = parseInt(tx.stockQty) || 0;
      const loc = (tx.location || "Delhi").trim().toLowerCase();
      net += q;
      if (q > 0) inUnits += q;
      else outUnits += Math.abs(q);

      if (loc === "mumbai") {
        mumbaiNet += q;
      } else {
        delhiNet += q;
      }
    });

    return {
      filteredNetStock: net,
      filteredInwardUnits: inUnits,
      filteredOutwardUnits: outUnits,
      filteredDelhiStock: delhiNet,
      filteredMumbaiStock: mumbaiNet
    };
  }, [filteredTransactions]);

  const hasActiveFilters = Boolean(
    activeSearchItems.length > 0 ||
    selectedPartyFilter !== "all" ||
    selectedCategoryFilter !== "all" ||
    locationFilter !== "all" ||
    movementFilter !== "all" ||
    missingIdFilter !== "all" ||
    selectedItemFilter !== "all"
  );

  // Dynamic Item-Aware KPI Metrics (Accurately resolves item true stock for DC55 or any model)
  const kpiMetrics = useMemo(() => {
    let matchingStocks = [];
    if (selectedItemFilter !== "all") {
      matchingStocks = (imsItemStocks || []).filter(is => is.itemId === selectedItemFilter || is.itemName === selectedItemFilter);
    } else if (activeSearchItems.length > 0 && Array.isArray(imsItemStocks) && imsItemStocks.length > 0) {
      matchingStocks = (imsItemStocks || []).filter(is => {
        const item = (is.itemName || "").toLowerCase();
        const id = (is.itemId || "").toLowerCase();
        return activeSearchItems.some(search => {
          const term = search.query;
          const words = term.split(/\s+/).filter(Boolean);
          if (words.length > 1) {
            return words.every(w => item.includes(w) || id.includes(w));
          }
          return item.includes(term) || id.includes(term);
        });
      });
    }

    if (matchingStocks.length > 0) {
      // User searched / filtered for specific item model(s) (e.g. DC55)
      const itemTotalStock = matchingStocks.reduce((sum, s) => sum + (s.currentStock || 0), 0);
      const itemDelhiStock = matchingStocks.reduce((sum, s) => sum + (s.delhiStock || 0), 0);
      const itemMumbaiStock = matchingStocks.reduce((sum, s) => sum + (s.mumbaiStock || 0), 0);
      const itemLabel = matchingStocks.length === 1 ? matchingStocks[0].itemName : `${matchingStocks.length} Selected Models`;

      return {
        onHandStock: locationFilter === "Mumbai" ? itemMumbaiStock : locationFilter === "Delhi" ? itemDelhiStock : itemTotalStock,
        delhiStock: itemDelhiStock,
        mumbaiStock: itemMumbaiStock,
        inwardUnits: filteredInwardUnits,
        outwardUnits: filteredOutwardUnits,
        onHandSubtitle: locationFilter !== "all" ? `${locationFilter} On-Hand (${itemLabel})` : `Physical Stock (${itemLabel})`,
        delhiSubtitle: `Delhi Balance (${itemLabel})`,
        mumbaiSubtitle: `Mumbai Balance (${itemLabel})`,
        inwardSubtitle: `Period Inflows (${itemLabel})`,
        outwardSubtitle: `Period Outflows (${itemLabel})`
      };
    }

    // Global / Warehouse / Party View
    return {
      onHandStock: locationFilter === "Mumbai" ? mumbaiStock : locationFilter === "Delhi" ? delhiStock : totalNetStock,
      delhiStock: delhiStock,
      mumbaiStock: mumbaiStock,
      inwardUnits: hasActiveFilters ? filteredInwardUnits : (imsPeriodSummary ? imsPeriodSummary.periodInward : filteredInwardUnits),
      outwardUnits: hasActiveFilters ? filteredOutwardUnits : (imsPeriodSummary ? imsPeriodSummary.periodOutward : filteredOutwardUnits),
      onHandSubtitle: locationFilter !== "all" ? `${locationFilter} Physical Stock` : (hasActiveFilters ? "Total Physical Stock (Combined)" : "Combined Physical Stock"),
      delhiSubtitle: "Delhi Warehouse Balance",
      mumbaiSubtitle: "Mumbai Warehouse Balance",
      inwardSubtitle: hasActiveFilters ? "Filtered Period Inflows" : (startDate || endDate ? "Period Inflows" : "Factory & Vendor Inflows"),
      outwardSubtitle: hasActiveFilters ? "Filtered Period Outflows" : (startDate || endDate ? "Period Outflows" : "Party & Dealer Outflows")
    };
  }, [
    activeSearchItems,
    selectedItemFilter,
    imsItemStocks,
    locationFilter,
    mumbaiStock,
    delhiStock,
    totalNetStock,
    filteredInwardUnits,
    filteredOutwardUnits,
    hasActiveFilters,
    imsPeriodSummary,
    startDate,
    endDate
  ]);

  // Paginated Transactions Slice (100 rows per page)
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Multi-page Selection Flags
  const isAllFilteredSelected = filteredTransactions.length > 0 && selectedTxIds.length === filteredTransactions.length;
  const isPageSelected = paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedTxIds.includes(t.id));

  // ==================== ITEM STOCK MATRIX SUMMARY ====================
  const itemStockMatrix = useMemo(() => {
    const map = new Map();

    // First seed with catalog items
    items.forEach(it => {
      map.set(it.id, {
        id: it.id,
        name: it.name,
        category: it.category || "General",
        inward: 0,
        outward: 0,
        delhiStock: 0,
        mumbaiStock: 0,
        currentStock: 0,
        txCount: 0,
        lastDate: ""
      });
    });

    // Populate with authoritative server-precalculated lifetime item balances
    if (Array.isArray(imsItemStocks) && imsItemStocks.length > 0) {
      imsItemStocks.forEach(is => {
        let key = is.itemId;
        if (!key || !map.has(key)) {
          key = is.itemId || `unlinked_${is.itemName}`;
          if (!map.has(key)) {
            map.set(key, {
              id: is.itemId || "(Unlinked)",
              name: is.itemName,
              category: is.itemId ? "General" : "Uncategorized (Missing ID)",
              inward: 0,
              outward: 0,
              delhiStock: 0,
              mumbaiStock: 0,
              currentStock: 0,
              txCount: 0,
              lastDate: "",
              isUnlinked: !is.itemId
            });
          }
        }
        const rec = map.get(key);
        rec.inward = is.inward || 0;
        rec.outward = is.outward || 0;
        rec.delhiStock = is.delhiStock || 0;
        rec.mumbaiStock = is.mumbaiStock || 0;
        rec.currentStock = is.currentStock || 0;
        rec.txCount = is.txCount || 0;
        rec.lastDate = is.lastDate || "";
      });
    } else {
      // Fallback: aggregate effectiveTransactions
      effectiveTransactions.forEach(tx => {
        const q = parseInt(tx.stockQty) || 0;
        const loc = (tx.location || "Delhi").trim();
        let key = tx.itemId;
        if (!key || !map.has(key)) {
          key = `unlinked_${tx.itemName}`;
          if (!map.has(key)) {
            map.set(key, {
              id: tx.itemId || "(Unlinked)",
              name: tx.itemName,
              category: "Uncategorized (Missing ID)",
              inward: 0,
              outward: 0,
              delhiStock: 0,
              mumbaiStock: 0,
              currentStock: 0,
              txCount: 0,
              lastDate: "",
              isUnlinked: true
            });
          }
        }

        const rec = map.get(key);
        if (q > 0) rec.inward += q;
        else rec.outward += Math.abs(q);

        if (loc.toLowerCase() === "mumbai") {
          rec.mumbaiStock = (rec.mumbaiStock || 0) + q;
        } else {
          rec.delhiStock = (rec.delhiStock || 0) + q;
        }

        rec.currentStock += q;
        rec.txCount++;
        if (!rec.lastDate || (tx.date && tx.date > rec.lastDate)) {
          rec.lastDate = tx.date;
        }
      });
    }

    return Array.from(map.values());
  }, [items, imsItemStocks, effectiveTransactions]);

  // Fast Item Catalog Map for category & item metadata lookups
  const itemCatalogMap = useMemo(() => {
    const map = new Map();
    (items || []).forEach(it => {
      if (it.id) {
        const rawId = String(it.id).trim().toLowerCase();
        const cleanId = rawId.replace(/^#+/, "");
        map.set(rawId, it);
        map.set(cleanId, it);
        map.set('#' + cleanId, it);
      }
      if (it.name) {
        map.set(it.name.trim().toLowerCase(), it);
      }
    });
    return map;
  }, [items]);

  // Paginated Matrix Slice (100 rows per page)
  const paginatedMatrix = useMemo(() => {
    const start = (matrixPage - 1) * matrixPerPage;
    return itemStockMatrix.slice(start, start + matrixPerPage);
  }, [itemStockMatrix, matrixPage, matrixPerPage]);

  // Paginated Missing IDs Slice (100 rows per page)
  const paginatedMissing = useMemo(() => {
    const start = (missingPage - 1) * missingPerPage;
    return distinctMissingItems.slice(start, start + missingPerPage);
  }, [distinctMissingItems, missingPage, missingPerPage]);

  // ==================== ADVANCED BULK UPLOAD PARSER ====================
  // Helper to parse standard and complex CSV / TSV text with quotes & multi-column inference
  function tokenizeDelimitedText(text) {
    if (!text || !text.trim()) return [];
    const rows = [];
    let currentRow = [];
    let currentVal = "";
    let insideQuotes = false;

    // Detect primary delimiter: Tab (\t) vs Comma (,) vs Semicolon (;)
    const firstLine = text.split(/\r?\n/)[0] || "";
    let delimiter = ",";
    if (firstLine.includes("\t")) {
      delimiter = "\t";
    } else if (firstLine.includes(";") && !firstLine.includes(",")) {
      delimiter = ";";
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped double quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++; // Skip \n in CRLF
        currentRow.push(currentVal.trim());
        currentVal = "";
        if (currentRow.some(c => c && c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentVal += char;
      }
    }

    if (currentVal.length > 0 || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c && c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  function parseQuantityValue(val) {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    const isNeg = str.includes("-") || str.toLowerCase().includes("out") || /^\(.*\)$/.test(str);
    const cleanNum = str.replace(/,/g, "").replace(/[^\d.]/g, "");
    const num = parseInt(cleanNum, 10);
    if (isNaN(num)) return 0;
    return isNeg ? -Math.abs(num) : Math.abs(num);
  }

  const handleParseBulkText = (text) => {
    setBulkRawText(text);
    if (!text.trim()) {
      setBulkParsedRows([]);
      return;
    }

    const rawRows = tokenizeDelimitedText(text);
    if (rawRows.length === 0) {
      setBulkParsedRows([]);
      return;
    }

    const parsed = [];

    // Create item maps for fast matching
    const itemsMapById = new Map(items.map(i => [String(i.id).trim().toLowerCase(), i]));
    const itemsMapByName = new Map(items.map(i => [String(i.name).trim().toLowerCase(), i]));

    // Check if first row is a header row
    const firstRowLower = rawRows[0].map(c => (c || "").toLowerCase().trim());
    let hasHeader = false;
    let headerMap = {
      dateIdx: -1,
      itemIdx: -1,
      itemIdIdx: -1,
      stockQtyIdx: -1,
      inQtyIdx: -1,
      outQtyIdx: -1,
      partyIdx: -1,
      locationIdx: -1,
      remarksIdx: -1
    };

    firstRowLower.forEach((col, idx) => {
      if (col.includes("date") || col === "dt" || col.includes("vch")) {
        headerMap.dateIdx = idx;
        hasHeader = true;
      } else if (col.includes("item id") || col.includes("item_id") || col === "id" || col.includes("code")) {
        headerMap.itemIdIdx = idx;
        hasHeader = true;
      } else if (col.includes("item") || col.includes("model") || col.includes("product") || col.includes("description") || col.includes("sku") || col.includes("particular")) {
        headerMap.itemIdx = idx;
        hasHeader = true;
      } else if (col === "in" || col.includes("inward") || col.includes("receipt") || col.includes("dr") || col.includes("stock in") || col.includes("in qty")) {
        headerMap.inQtyIdx = idx;
        hasHeader = true;
      } else if (col === "out" || col.includes("outward") || col.includes("issue") || col.includes("cr") || col.includes("stock out") || col.includes("out qty") || col.includes("dispatch")) {
        headerMap.outQtyIdx = idx;
        hasHeader = true;
      } else if (col === "qty" || col.includes("quantity") || col.includes("stock") || col.includes("units") || col.includes("movement") || col === "pcs") {
        headerMap.stockQtyIdx = idx;
        hasHeader = true;
      } else if (col.includes("party") || col.includes("customer") || col.includes("dealer") || col.includes("vendor") || col.includes("client") || col.includes("account")) {
        headerMap.partyIdx = idx;
        hasHeader = true;
      } else if (col.includes("location") || col.includes("godown") || col.includes("warehouse") || col.includes("depot") || col.includes("branch") || col.includes("city")) {
        headerMap.locationIdx = idx;
        hasHeader = true;
      } else if (col.includes("remark") || col.includes("narration") || col.includes("note") || col.includes("details") || col.includes("vch no") || col.includes("invoice") || col.includes("bill")) {
        headerMap.remarksIdx = idx;
        hasHeader = true;
      }
    });

    const startIdx = hasHeader ? 1 : 0;

    // Detect overall fallback item name from text context if BT315 or single item
    let detectedContextItemName = "";
    const lowerFullText = text.toLowerCase();
    if (lowerFullText.includes("bt315") || lowerFullText.includes("bt-315") || lowerFullText.includes("bt 315")) {
      detectedContextItemName = "BT315";
    }

    for (let i = startIdx; i < rawRows.length; i++) {
      const cols = rawRows[i];
      if (!cols || cols.every(c => !c || c.trim() === "")) continue;

      // Skip repeated header rows (e.g. from copy-pasting multiple pages)
      const isRepeatedHeader = cols.some(c => (c || "").toLowerCase().includes("date") && cols.some(c2 => (c2 || "").toLowerCase().includes("stock") || (c2 || "").toLowerCase().includes("qty")));
      if (isRepeatedHeader && i !== 0) continue;

      let rawDate = "";
      let rawItemName = "";
      let rawItemId = "";
      let rawStock = 0;
      let rawParty = "";
      let rawRemarks = "";
      let rawLocation = "";

      if (hasHeader) {
        if (headerMap.dateIdx !== -1 && cols[headerMap.dateIdx] !== undefined) rawDate = cols[headerMap.dateIdx].trim();
        if (headerMap.itemIdx !== -1 && cols[headerMap.itemIdx] !== undefined) rawItemName = cols[headerMap.itemIdx].trim();
        if (headerMap.itemIdIdx !== -1 && cols[headerMap.itemIdIdx] !== undefined) rawItemId = cols[headerMap.itemIdIdx].trim();
        if (headerMap.partyIdx !== -1 && cols[headerMap.partyIdx] !== undefined) rawParty = cols[headerMap.partyIdx].trim();
        if (headerMap.locationIdx !== -1 && cols[headerMap.locationIdx] !== undefined) rawLocation = cols[headerMap.locationIdx].trim();
        if (headerMap.remarksIdx !== -1 && cols[headerMap.remarksIdx] !== undefined) rawRemarks = cols[headerMap.remarksIdx].trim();

        // Stock quantity determination
        if (headerMap.inQtyIdx !== -1 || headerMap.outQtyIdx !== -1) {
          const inVal = headerMap.inQtyIdx !== -1 ? parseQuantityValue(cols[headerMap.inQtyIdx]) : 0;
          const outVal = headerMap.outQtyIdx !== -1 ? parseQuantityValue(cols[headerMap.outQtyIdx]) : 0;
          if (inVal > 0) rawStock = inVal;
          else if (outVal > 0) rawStock = -outVal;
          else if (headerMap.stockQtyIdx !== -1) rawStock = parseQuantityValue(cols[headerMap.stockQtyIdx]);
        } else if (headerMap.stockQtyIdx !== -1 && cols[headerMap.stockQtyIdx] !== undefined) {
          rawStock = parseQuantityValue(cols[headerMap.stockQtyIdx]);
        }
      } else {
        // Standard positional layout:
        // Col 0: Date
        // Col 1: Item Name
        // Col 2: Stock
        // Col 3: Remarks
        // Col 4: Party Name
        // Col 5: Item ID
        // Col 6: Location
        if (cols[0] !== undefined) rawDate = cols[0].trim();
        if (cols[1] !== undefined) rawItemName = cols[1].trim();
        if (cols[2] !== undefined) rawStock = parseQuantityValue(cols[2]);
        if (cols[3] !== undefined) rawRemarks = cols[3].trim();
        if (cols[4] !== undefined) rawParty = cols[4].trim();
        if (cols[5] !== undefined) rawItemId = cols[5].trim();
        if (cols[6] !== undefined) rawLocation = cols[6].trim();
      }

      // Date Fallback
      if (!rawDate) {
        for (const c of cols) {
          if (c && /(\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}|\d{1,2}-[a-zA-Z]{3}-\d{2,4})/.test(c)) {
            rawDate = c.trim();
            break;
          }
        }
        if (!rawDate) rawDate = cols[0] || new Date().toISOString().split("T")[0];
      }

      // Stock Fallback
      if (!rawStock && !hasHeader) {
        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
          const c = cols[cIdx];
          if (c && cIdx !== 0 && /^[+-]?\s*[\d,]+(\.\d+)?\s*(pcs|qty|\(out\))?$/i.test(c.trim())) {
            rawStock = parseQuantityValue(c);
            break;
          }
        }
      }

      // Location strictly from mapped location column (Default to Delhi)
      if (!rawLocation) {
        if (cols.length >= 7 && cols[6]) {
          rawLocation = cols[6].trim();
        } else {
          rawLocation = "Delhi";
        }
      }

      // Capitalize/normalize explicit location (Delhi or Mumbai)
      const locClean = rawLocation.trim().toLowerCase();
      if (locClean === "mumbai" || locClean.startsWith("mum")) {
        rawLocation = "Mumbai";
      } else if (locClean === "delhi" || locClean.startsWith("del") || !rawLocation) {
        rawLocation = "Delhi";
      } else {
        rawLocation = rawLocation.trim();
      }

      // Smart Item Name & Party Name extraction
      if (!rawItemName) {
        if (cols[1] && !/^\d+$/.test(cols[1])) {
          rawItemName = cols[1].trim();
        } else if (detectedContextItemName) {
          rawItemName = detectedContextItemName;
        } else {
          rawItemName = "BT315";
        }
      }

      if (!rawParty && cols.length >= 5) {
        if (cols[4] && cols[4] !== rawItemName && cols[4] !== rawRemarks) {
          rawParty = cols[4].trim();
        } else if (cols[3] && cols[3] !== rawItemName && isNaN(parseInt(cols[3]))) {
          rawParty = cols[3].trim();
        }
      }

      if (!rawRemarks && cols.length >= 4) {
        if (cols[3] && cols[3] !== rawParty && cols[3] !== rawItemName) {
          rawRemarks = cols[3].trim();
        }
      }

      // Auto-match Item ID if found in catalog
      let isMatched = false;
      if (rawItemId && itemsMapById.has(rawItemId.toLowerCase())) {
        isMatched = true;
        if (!rawItemName || rawItemName === "BT315") {
          rawItemName = itemsMapById.get(rawItemId.toLowerCase()).name;
        }
      } else if (rawItemName && itemsMapByName.has(rawItemName.toLowerCase())) {
        rawItemId = itemsMapByName.get(rawItemName.toLowerCase()).id;
        isMatched = true;
      } else if (detectedContextItemName && itemsMapByName.has(detectedContextItemName.toLowerCase())) {
        rawItemId = itemsMapByName.get(detectedContextItemName.toLowerCase()).id;
        isMatched = true;
      }

      parsed.push({
        id: `ims-upload-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        date: formatDateForInput(rawDate),
        itemName: rawItemName || detectedContextItemName || "BT315",
        stockQty: rawStock,
        movementType: rawStock >= 0 ? "IN" : "OUT",
        remarks: rawRemarks,
        partyName: rawParty,
        itemId: rawItemId,
        location: rawLocation,
        isMissingId: !isMatched,
        source: "bulk_upload"
      });
    }

    setBulkParsedRows(parsed);
  };

  const { startLoading, finishLoading } = useLoading();

  const handleExecuteBulkUpload = async () => {
    if (bulkParsedRows.length === 0) return;
    setIsUploading(true);
    setBulkUploadMsg("");
    startLoading("Uploading Inventory Batch...", `Uploading ${bulkParsedRows.length} transactions to server...`, 1);

    try {
      const res = await onBatchUploadTransactions(bulkParsedRows);
      if (res && (res.success || res.count)) {
        setBulkUploadMsg(`✅ Successfully uploaded ${res.count || bulkParsedRows.length} transactions into IMS! (${res.missingIdCount || 0} missing item IDs flagged for review)`);
        setBulkParsedRows([]);
        setBulkRawText("");
        finishLoading(`Uploaded ${res.count || bulkParsedRows.length} inventory records!`);
        setTimeout(() => setActiveTab("ledger"), 2000);
      } else {
        finishLoading();
        setBulkUploadMsg(`❌ Upload failed: ${res?.error || "Unknown server error"}`);
      }
    } catch (err) {
      finishLoading();
      setBulkUploadMsg(`❌ Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper date formatter (Robust for M/D/YYYY, D/M/YYYY, DD-MMM-YYYY, YYYY-MM-DD)
  function formatDateForInput(dStr) {
    if (!dStr) return new Date().toISOString().split("T")[0];
    const clean = String(dStr).trim();

    // 1. Check if YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, "0");
      const day = ymdMatch[3].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // 2. Check if DD-MMM-YYYY or DD-MMM-YY (e.g. 15-May-2026 or 15-May-26)
    const monthMap = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mmmMatch = clean.match(/^(\d{1,2})[-\/\s]([a-zA-Z]{3})[-\/\s](\d{2,4})/);
    if (mmmMatch) {
      const day = mmmMatch[1].padStart(2, "0");
      const mStr = mmmMatch[2].toLowerCase();
      const month = monthMap[mStr] || "01";
      let year = mmmMatch[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }

    // 3. Check M/D/YYYY vs D/M/YYYY (e.g. 8/31/2025, 9/1/2025, 31/8/2025)
    const slashMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (slashMatch) {
      const n1 = parseInt(slashMatch[1], 10);
      const n2 = parseInt(slashMatch[2], 10);
      let year = slashMatch[3];
      if (year.length === 2) year = `20${year}`;

      let month, day;
      if (n1 > 12) {
        // n1 > 12 must be day (e.g. 31/8/2025)
        day = String(n1).padStart(2, "0");
        month = String(Math.min(12, Math.max(1, n2))).padStart(2, "0");
      } else if (n2 > 12) {
        // n2 > 12 must be day (e.g. 8/31/2025, 9/15/2025)
        month = String(Math.min(12, Math.max(1, n1))).padStart(2, "0");
        day = String(n2).padStart(2, "0");
      } else {
        // Ambiguous (e.g. 9/1/2025 or 1/2/2026): Excel standard M/D/YYYY
        month = String(Math.min(12, Math.max(1, n1))).padStart(2, "0");
        day = String(n2).padStart(2, "0");
      }

      return `${year}-${month}-${day}`;
    }

    return clean;
  }

  // CSV Export for Ledger
  const handleExportCsv = () => {
    const headers = ["Date", "Item Name", "Item ID", "Warehouse Location", "Stock Movement Qty", "Movement Type", "Party Name", "Remarks", "ID Status", "Source"];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.itemName,
      t.itemId || "UNLINKED",
      t.location || "Delhi",
      t.stockQty,
      t.stockQty >= 0 ? "IN" : "OUT",
      t.partyName,
      t.remarks,
      t.isMissingId ? "Missing Item ID" : "Linked",
      t.source
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IMS_Stock_Ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    const sampleRows = [
      ["Date", "Item Name", "Stock", "Remarks", "Party Name", "Item ID", "Location"],
      ["2026-01-05", "MP-CH-65W Gan Fast Charger", "500", "Initial 2026 Opening Factory Shipment Received", "Shenzhen TopPower Electronics", "it-1", "Delhi"],
      ["2026-01-12", "MP-CH-65W Gan Fast Charger", "-50", "Dispatched against SO-2026-001 (LR #VRL-882194)", "Shree Ganesh Electronics", "it-1", "Mumbai"],
      ["2026-02-02", "MP-PB-20000 Ultra Power Bank", "800", "Cargo lot #CRG-902 received at warehouse", "Dongguan Battery Tech Co", "it-2", "Delhi"],
      ["2026-02-18", "MP-PB-20000 Ultra Power Bank", "-120", "Order fulfillment #SO-2026-004", "Mahalaxmi Power Hub", "it-2", "Mumbai"],
      ["2026-03-01", "MP-CB-Braided Type-C to Lightning 2M", "1000", "Imported legacy batch from Feb shipment", "Guangzhou Cable Master Co.", "", "Delhi"],
      ["2026-03-10", "MP-CB-Braided Type-C to Lightning 2M", "-200", "Dealer sample shipment", "Marwar Mobile Accessories", "", "Mumbai"],
      ["2026-04-15", "MP-AD-Car Charger Dual Port 45W", "450", "New model trial run 2026", "Ningbo Auto Power Ltd", "", "Delhi"]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      sampleRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "IMS_Sample_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Matched transactions within the deletion range modal
  const rangeMatchedTransactions = useMemo(() => {
    if (!delRangeStart || !delRangeEnd) return [];
    return effectiveTransactions.filter(tx => {
      const inDate = isDateInBetween(tx.date, delRangeStart, delRangeEnd);
      const inLoc = delRangeLocation && delRangeLocation !== "all" ? (tx.location || "Delhi").trim().toLowerCase() === delRangeLocation.trim().toLowerCase() : true;
      return inDate && inLoc;
    });
  }, [effectiveTransactions, delRangeStart, delRangeEnd, delRangeLocation]);

  const rangeMatchedNetQty = useMemo(() => {
    return rangeMatchedTransactions.reduce((sum, tx) => sum + (parseInt(tx.stockQty) || 0), 0);
  }, [rangeMatchedTransactions]);

  // Execute Range Deletion
  const handleExecuteDeleteRange = async () => {
    if (!delRangeStart || !delRangeEnd) return;
    if (rangeMatchedTransactions.length === 0) {
      alert("No transactions found between the selected dates and warehouse.");
      return;
    }
    const confirmMsg = `⚠️ Are you sure you want to PERMANENTLY DELETE ALL ${rangeMatchedTransactions.length} inventory transactions between ${delRangeStart} and ${delRangeEnd}${delRangeLocation !== "all" ? ` for ${delRangeLocation} Warehouse` : "" }?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingRange(true);
    const matchedIds = rangeMatchedTransactions.map(t => t.id);
    startLoading("Purging Date Range...", `Deleting ${rangeMatchedTransactions.length} transactions between ${delRangeStart} and ${delRangeEnd}...`, 1);
    try {
      if (onDeleteRange) {
        await onDeleteRange(delRangeStart, delRangeEnd, matchedIds, delRangeLocation !== "all" ? delRangeLocation : null);
      }
      setSelectedTxIds(prev => prev.filter(id => !matchedIds.includes(id)));
      setShowDeleteRangeModal(false);
      setDelRangeStart("");
      setDelRangeEnd("");
      finishLoading("Transactions deleted successfully!");
    } catch (err) {
      finishLoading();
      alert("Failed to delete range: " + err.message);
    } finally {
      setIsDeletingRange(false);
    }
  };

  // Execute All Filtered Transactions Deletion (e.g. Delete all Mumbai items)
  const handleExecuteDeleteAllFiltered = async () => {
    if (filteredTransactions.length === 0) return;
    const filterDesc = locationFilter !== "all" ? `${locationFilter} Warehouse` : "current filter";
    const confirmMsg = `⚠️ Are you sure you want to PERMANENTLY DELETE ALL ${filteredTransactions.length} transaction(s) matching ${filterDesc}?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    const filteredIds = filteredTransactions.map(t => t.id);
    startLoading("Deleting Filtered Records...", `Deleting ${filteredIds.length} inventory transactions...`, 1);
    try {
      if (onDeleteRange) {
        await onDeleteRange(null, null, filteredIds, locationFilter !== "all" ? locationFilter : null);
      } else if (onDeleteTransaction) {
        for (const id of filteredIds) {
          await onDeleteTransaction(id);
        }
      }
      setSelectedTxIds([]);
      finishLoading(`Deleted ${filteredIds.length} transactions!`);
    } catch (err) {
      finishLoading();
      alert("Failed to delete filtered rows: " + err.message);
    }
  };

  // Execute Selected Rows Deletion
  const handleExecuteDeleteSelected = async () => {
    if (selectedTxIds.length === 0) return;
    const confirmMsg = `⚠️ Are you sure you want to permanently delete the ${selectedTxIds.length} selected transaction(s)?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    startLoading("Deleting Selected Records...", `Deleting ${selectedTxIds.length} inventory transactions...`, 1);
    try {
      if (onDeleteRange) {
        await onDeleteRange(null, null, selectedTxIds);
      } else if (onDeleteTransaction) {
        for (const id of selectedTxIds) {
          await onDeleteTransaction(id);
        }
      }
      setSelectedTxIds([]);
      finishLoading(`Deleted ${selectedTxIds.length} transactions!`);
    } catch (err) {
      finishLoading();
      alert("Failed to delete selected rows: " + err.message);
    }
  };

  const handleToggleSelectAll = () => {
    if (isPageSelected || isAllFilteredSelected) {
      // Deselect rows on the current page
      setSelectedTxIds(prev => prev.filter(id => !paginatedTransactions.some(t => t.id === id)));
    } else {
      // Select all rows on the current page
      setSelectedTxIds(prev => Array.from(new Set([...prev, ...paginatedTransactions.map(t => t.id)])));
    }
  };

  const handleToggleSelectRow = (txId) => {
    setSelectedTxIds(prev => 
      prev.includes(txId) ? prev.filter(id => id !== txId) : [...prev, txId]
    );
  };

  // Quick Resolve Missing ID - 1-Click Create Master Item
  const handleCreateAndResolveMasterItem = async (e) => {
    e.preventDefault();
    if (!resolvingMissingItemName) return;

    // 1. Create item in master catalog
    const nextIdNum = items.reduce((max, it) => {
      const n = parseInt(String(it.id).replace(/\D/g, ""), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 100) + 1;
    const newItemId = `it-${nextIdNum}`;

    const resItem = await onAddItem({
      id: newItemId,
      name: resolvingMissingItemName.trim(),
      category: createMasterCategory,
      itemType: createMasterType,
      unit: createMasterUnit,
      description: createMasterDesc || `Created from IMS missing ID resolution`,
      currentStock: 0
    });

    // 2. Resolve all historical IMS transactions with this new item ID
    await onResolveMissingId(resolvingMissingItemName.trim(), newItemId, resolvingMissingItemName.trim());

    setResolvingMissingItemName(null);
    setCreateMasterDesc("");
  };

  // Map to Existing Item
  const handleMapToExistingItem = async (e) => {
    e.preventDefault();
    if (!resolvingMissingItemName || !mapExistingItemId) return;

    const targetItem = items.find(i => i.id === mapExistingItemId);
    if (!targetItem) return;

    await onResolveMissingId(resolvingMissingItemName.trim(), targetItem.id, targetItem.name);
    setResolvingMissingItemName(null);
    setMapExistingItemId("");
  };

  return (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "22px", padding: "20px 24px", maxWidth: "1500px", margin: "0 auto", width: "100%" }}>
      
      {/* ==================== IMS TOP HEADER BAR ==================== */}
      <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "8px", borderRadius: "10px", background: "linear-gradient(135deg, #0284c7, #6366f1)", color: "#fff" }}>
            <Layers size={22} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
            IMS Stock Movement & Inventory Ledger
          </h1>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button 
            onClick={async () => {
              if (onPullModuleData) onPullModuleData("imsTransactions", true);
              if (onRefreshImsSummary) onRefreshImsSummary();
            }}
            disabled={isDataLoading}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            title="Refetch IMS stock entries and server-calculated full summary"
          >
            <RefreshCw size={16} className={isDataLoading ? "spin" : ""} />
            {isDataLoading ? "Syncing..." : "Refresh IMS Data"}
          </button>

          <button 
            onClick={() => setActiveTab("bulk")} 
            className={`btn ${activeTab === "bulk" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
          >
            <UploadCloud size={16} /> Bulk Excel/CSV Upload
          </button>

          <button 
            onClick={() => { setEditingTransaction(null); setShowAddModal(true); }} 
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <Plus size={16} /> Log Stock Movement
          </button>
        </div>
      </div>

      {/* ==================== MISSING ITEM IDS BANNER ALERT ==================== */}
      {missingIdsCount > 0 && (
        <div 
          className="glass-panel card-fade-in" 
          style={{ 
            padding: "16px 20px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            flexWrap: "wrap", 
            gap: "12px",
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#f59e0b" }}>
                {missingIdsCount} Historical IMS Stock Entries Have Missing / Unlinked Item IDs
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Found {distinctMissingItems.length} distinct unmatched item models. You can create them in Master Item Catalog in 1 click or map them to existing items.
              </div>
            </div>
          </div>

          <button 
            onClick={() => setActiveTab("missingids")}
            className="btn btn-primary btn-sm"
            style={{ background: "#f59e0b", color: "#000", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ShieldAlert size={14} /> Open Missing IDs Studio ({distinctMissingItems.length})
          </button>
        </div>
      )}

      {/* ==================== NAVIGATION TABS ==================== */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px", overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`nav-tab-item ${activeTab === "ledger" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <FileText size={16} /> <span>Stock Movement Ledger {isDataLoading ? "(...)" : `(${filteredTransactions.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`nav-tab-item ${activeTab === "matrix" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Package size={16} /> <span>Item Stock Matrix {isDataLoading ? "(...)" : `(${itemStockMatrix.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab("bulk")}
          className={`nav-tab-item ${activeTab === "bulk" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <UploadCloud size={16} /> <span>Bulk Excel / CSV Ingestion</span>
        </button>

        <button
          onClick={() => setActiveTab("missingids")}
          className={`nav-tab-item ${activeTab === "missingids" ? "active" : ""}`}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px", 
            padding: "10px 18px", 
            borderRadius: "10px", 
            fontSize: "0.92rem", 
            fontWeight: 600,
            color: distinctMissingItems.length > 0 ? "#f59e0b" : ""
          }}
        >
          <ShieldAlert size={16} /> <span>Missing Item IDs Studio {isDataLoading ? "(...)" : `(${distinctMissingItems.length})`}</span>
        </button>
      </div>

      {/* ==================== TAB 1: STOCK MOVEMENT LEDGER ==================== */}
      {activeTab === "ledger" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Action & Filter Bar (Clean 2-Row Structured Layout) */}
          <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            
            {/* Row 1: Search Inputs Group (Left) & Actions (Right) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              
              {/* Multi-Search Inputs Group with Scope Target Selector & Popup */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 400px", minWidth: "300px", flexWrap: "wrap" }}>
                {searchFilters.map((sf, idx) => (
                  <div key={idx} style={{ position: "relative", display: "flex", alignItems: "center", minWidth: "260px", flex: 1 }}>
                    
                    {/* Inline Scope Selector */}
                    <select
                      value={sf.scope || "all"}
                      onChange={e => handleSetSearchScope(idx, e.target.value)}
                      className="form-control"
                      style={{
                        width: "auto",
                        height: "38px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        borderRadius: "8px 0 0 8px",
                        borderRight: "none",
                        background: "rgba(15, 23, 42, 0.6)",
                        color: sf.scope === "category" ? "#38bdf8" : sf.scope === "party" ? "#c084fc" : sf.scope === "item" ? "#34d399" : sf.scope === "location" ? "#fbbf24" : sf.scope === "id" ? "#f43f5e" : "var(--text-main)",
                        padding: "0 8px",
                        cursor: "pointer"
                      }}
                      title="Select where to search (All, Category, Party, Item, Location, ID)"
                    >
                      <option value="all">🌐 All</option>
                      <option value="category">🏷️ Category</option>
                      <option value="party">👤 Party</option>
                      <option value="item">📦 Item</option>
                      <option value="location">🏢 Location</option>
                      <option value="id">🆔 ID</option>
                    </select>

                    <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1 }}>
                      <input
                        type="text"
                        placeholder={
                          sf.scope === "category" ? "Search Category (e.g. Neckband, Charger)..." :
                          sf.scope === "party" ? "Search Party Name (e.g. Azam)..." :
                          sf.scope === "item" ? "Search Item Name / Model..." :
                          sf.scope === "location" ? "Search Warehouse Location..." :
                          sf.scope === "id" ? "Search Item ID..." :
                          "Search anywhere (item, party, category, ID)..."
                        }
                        value={sf.query}
                        onChange={e => handleUpdateSearchQuery(idx, e.target.value)}
                        onFocus={() => { if (sf.query && sf.query.trim()) setActiveSearchDropdownIndex(idx); }}
                        className="form-control"
                        style={{ 
                          borderRadius: "0 8px 8px 0",
                          paddingLeft: "12px", 
                          paddingRight: searchFilters.length > 1 || sf.query ? "28px" : "12px", 
                          height: "38px", 
                          fontSize: "0.85rem" 
                        }}
                      />
                      {(sf.query || searchFilters.length > 1) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSearchQuery(idx)}
                          style={{
                            position: "absolute",
                            right: "8px",
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center"
                          }}
                          title={searchFilters.length > 1 ? "Remove this search box" : "Clear search"}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Interactive "Where to search" suggestion popover */}
                    {activeSearchDropdownIndex === idx && sf.query && sf.query.trim() && (
                      <div 
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          zIndex: 100,
                          background: "#0f172a",
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
                          padding: "6px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          minWidth: "260px"
                        }}
                      >
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "4px 8px", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "3px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>Where to search for "{sf.query}"?</span>
                          <button 
                            type="button" 
                            onClick={() => setActiveSearchDropdownIndex(null)}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.7rem" }}
                          >
                            ✕
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "all")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "all" ? "rgba(56, 189, 248, 0.15)" : "transparent", color: sf.scope === "all" ? "#38bdf8" : "inherit" }}
                        >
                          🌐 <span>Search in <strong>All Fields</strong> (Global Match)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "category")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "category" ? "rgba(56, 189, 248, 0.15)" : "transparent", color: sf.scope === "category" ? "#38bdf8" : "#38bdf8" }}
                        >
                          🏷️ <span>Search in <strong>Category Only</strong></span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "party")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "party" ? "rgba(192, 132, 252, 0.15)" : "transparent", color: sf.scope === "party" ? "#c084fc" : "#c084fc" }}
                        >
                          👤 <span>Search in <strong>Party Name Only</strong></span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "item")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "item" ? "rgba(52, 211, 153, 0.15)" : "transparent", color: sf.scope === "item" ? "#34d399" : "#34d399" }}
                        >
                          📦 <span>Search in <strong>Item Name & Model Only</strong></span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "location")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "location" ? "rgba(251, 191, 36, 0.15)" : "transparent", color: sf.scope === "location" ? "#fbbf24" : "#fbbf24" }}
                        >
                          🏢 <span>Search in <strong>Location / Warehouse</strong></span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetSearchScope(idx, "id")}
                          className="btn btn-ghost btn-sm"
                          style={{ justifyContent: "flex-start", fontSize: "0.8rem", textAlign: "left", padding: "6px 8px", background: sf.scope === "id" ? "rgba(244, 63, 94, 0.15)" : "transparent", color: sf.scope === "id" ? "#f43f5e" : "#f43f5e" }}
                        >
                          🆔 <span>Search in <strong>Item ID Only</strong></span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* [+] Add more search button */}
                <button
                  type="button"
                  onClick={handleAddSearchQuery}
                  className="btn btn-secondary btn-sm"
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    borderColor: "rgba(56, 189, 248, 0.4)",
                    color: "#38bdf8"
                  }}
                  title="Add another search condition (search 2 or more items simultaneously)"
                >
                  <Plus size={15} /> Add
                </button>
              </div>

              {/* Action Buttons Aligned on Right */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                {hasActiveFilters && filteredTransactions.length > 0 && (
                  <button 
                    onClick={handleExecuteDeleteAllFiltered}
                    className="btn btn-danger btn-sm"
                    style={{ height: "38px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 700 }}
                    title={`Delete all ${filteredTransactions.length} transactions matching the current filters`}
                  >
                    <Trash2 size={14} /> Delete All Filtered ({filteredTransactions.length})
                  </button>
                )}

                <button 
                  onClick={() => {
                    setDelRangeStart(startDate || "2026-01-01");
                    setDelRangeEnd(endDate || new Date().toISOString().split("T")[0]);
                    setDelRangeLocation(locationFilter !== "all" ? locationFilter : "all");
                    setShowDeleteRangeModal(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ height: "38px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                  title="Select date range & warehouse to delete transactions at once"
                >
                  <Trash2 size={14} /> Delete by Date Range
                </button>

                <button 
                  onClick={handleExportCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ height: "38px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Row 2: Neatly Grouped Filter Controls & Date Range */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", paddingTop: "10px", borderTop: "1px solid var(--border-glass)" }}>
              
              {/* Category Dropdown Filter */}
              {distinctCategories.length > 0 && (
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="form-control"
                  style={{ width: "auto", maxWidth: "200px", height: "36px", fontSize: "0.82rem", fontWeight: 600 }}
                  title="Filter directly by Product Category"
                >
                  <option value="all">🏷️ All Categories ({distinctCategories.length})</option>
                  {distinctCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}

              {/* Warehouse Location Filter */}
              <select
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "36px", fontSize: "0.82rem", fontWeight: 600 }}
              >
                <option value="all">🏢 All Warehouses</option>
                <option value="Delhi">📍 Delhi Warehouse</option>
                <option value="Mumbai">📍 Mumbai Warehouse</option>
              </select>

              {/* Movement Type Filter */}
              <select
                value={movementFilter}
                onChange={e => setMovementFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "36px", fontSize: "0.82rem" }}
              >
                <option value="all">All Movements (In & Out)</option>
                <option value="IN">🟢 Stock IN (+ Inward only)</option>
                <option value="OUT">🔴 Stock OUT (- Outward only)</option>
              </select>

              {/* Missing ID Filter */}
              <select
                value={missingIdFilter}
                onChange={e => setMissingIdFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "36px", fontSize: "0.82rem" }}
              >
                <option value="all">All Item IDs</option>
                <option value="missing">⚠️ Missing / Unlinked ID Only</option>
                <option value="linked">✓ Verified Linked ID</option>
              </select>

              {/* Party Name Dropdown Filter */}
              {distinctParties.length > 0 && (
                <select
                  value={selectedPartyFilter}
                  onChange={e => setSelectedPartyFilter(e.target.value)}
                  className="form-control"
                  style={{ width: "auto", maxWidth: "200px", height: "36px", fontSize: "0.82rem", fontWeight: 600 }}
                  title="Filter directly by Party Name"
                >
                  <option value="all">👥 All Parties ({distinctParties.length})</option>
                  {distinctParties.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}

              {/* Date Range Filter with Presets */}
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              />

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearchQueries([""]);
                    setSelectedPartyFilter("all");
                    setStartDate("");
                    setEndDate("");
                    setLocationFilter("all");
                    setMovementFilter("all");
                    setMissingIdFilter("all");
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ height: "36px", fontSize: "0.78rem" }}
                >
                  Clear Filters
                </button>
              )}

              {/* Range Indicator / Load All Toggle */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {imsRange !== "all" && (
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>Showing <strong>{startDate && endDate ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}` : "latest transactions"}</strong> ({effectiveTransactions.length.toLocaleString()} rows)</span>
                    <button
                      onClick={() => {
                        if (onFetchFullHistory) onFetchFullHistory();
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ height: "28px", padding: "0 8px", fontSize: "0.74rem", fontWeight: 700, borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                      title="Load all historical database transactions"
                    >
                      Load All History
                    </button>
                  </span>
                )}
                {imsRange === "all" && (
                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.75rem", fontWeight: 700 }}>
                    ✓ All Database Records Loaded ({effectiveTransactions.length.toLocaleString()})
                  </span>
                )}
              </div>

            </div>
          </div>

          {/* ==================== 5 DYNAMIC KPI SUMMARY CARDS (Item-Aware True Stock & Period In/Out) ==================== */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            
            {/* Card 1: Total Physical Stock */}
            <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total All On-Hand</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: kpiMetrics.onHandStock >= 0 ? "var(--text-main)" : "var(--danger)" }}>
                  {isDataLoading ? (
                    <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={14} className="spin" /> Loading...
                    </span>
                  ) : (
                    <>{kpiMetrics.onHandStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span></>
                  )}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#38bdf8", marginTop: "1px" }}>
                  {kpiMetrics.onHandSubtitle}
                </div>
              </div>
            </div>

            {/* Card 2: Delhi Warehouse Stock */}
            <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid rgba(56, 189, 248, 0.3)", background: "rgba(56, 189, 248, 0.04)" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.18)", color: "#38bdf8" }}>
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 700 }}>🏢 Delhi Warehouse</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: kpiMetrics.delhiStock >= 0 ? "#38bdf8" : "var(--danger)" }}>
                  {isDataLoading ? (
                    <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={14} className="spin" /> Loading...
                    </span>
                  ) : (
                    <>{kpiMetrics.delhiStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span></>
                  )}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                  {kpiMetrics.delhiSubtitle}
                </div>
              </div>
            </div>

            {/* Card 3: Mumbai Warehouse Stock */}
            <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid rgba(168, 85, 247, 0.3)", background: "rgba(168, 85, 247, 0.04)" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.18)", color: "#c084fc" }}>
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "#c084fc", fontWeight: 700 }}>🏢 Mumbai Warehouse</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: kpiMetrics.mumbaiStock >= 0 ? "#c084fc" : "var(--danger)" }}>
                  {isDataLoading ? (
                    <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={14} className="spin" /> Loading...
                    </span>
                  ) : (
                    <>{kpiMetrics.mumbaiStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span></>
                  )}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                  {kpiMetrics.mumbaiSubtitle}
                </div>
              </div>
            </div>

            {/* Card 4: Total Inward Movement */}
            <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Inward (+)</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--success)" }}>
                  {isDataLoading ? (
                    <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={14} className="spin" /> Loading...
                    </span>
                  ) : (
                    <>+{kpiMetrics.inwardUnits.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span></>
                  )}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                  {kpiMetrics.inwardSubtitle}
                </div>
              </div>
            </div>

            {/* Card 5: Total Outward Movement */}
            <div className="glass-panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" }}>
                <TrendingDown size={22} />
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Dispatched (-)</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--danger)" }}>
                  {isDataLoading ? (
                    <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <RefreshCw size={14} className="spin" /> Loading...
                    </span>
                  ) : (
                    <>-{kpiMetrics.outwardUnits.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span></>
                  )}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                  {kpiMetrics.outwardSubtitle}
                </div>
              </div>
            </div>

          </div>

          {/* Smart Selection Bar (Gmail-style current page vs all filtered selector) */}
          <SmartSelectionBar
            selectedCount={selectedTxIds.length}
            currentPageCount={paginatedTransactions.length}
            totalFilteredCount={filteredTransactions.length}
            isAllFilteredSelected={isAllFilteredSelected}
            onSelectAllCurrentPage={() => setSelectedTxIds(paginatedTransactions.map(t => t.id))}
            onSelectAllFiltered={() => setSelectedTxIds(filteredTransactions.map(t => t.id))}
            onClearSelection={() => setSelectedTxIds([])}
            entityName="transactions"
            actions={
              <button
                onClick={handleExecuteDeleteSelected}
                className="btn btn-danger btn-sm"
                style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Trash2 size={14} /> Delete Selected ({selectedTxIds.length})
              </button>
            }
          />

          {/* Ledger Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {isDataLoading ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                <RefreshCw size={38} className="spin" style={{ color: "var(--primary)" }} />
                <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Loading Stock Movement Ledger...</h4>
                <p style={{ fontSize: "0.85rem", margin: 0, opacity: 0.8 }}>Syncing real-time stock movements and warehouse balances from PostgreSQL database...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Layers size={36} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <h4>No stock movement entries found</h4>
                <p style={{ fontSize: "0.85rem" }}>Click "Log Stock Movement" or "Bulk Excel/CSV Upload" to record inventory transactions.</p>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "1040px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "4%", textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        checked={paginatedTransactions.length > 0 && (isPageSelected || isAllFilteredSelected)}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: "pointer" }}
                        title={isAllFilteredSelected ? "Deselect all rows" : isPageSelected ? "Deselect this page" : "Select all 100 rows on this page"}
                      />
                    </th>
                    <th style={{ width: "10%", cursor: "pointer" }} onClick={() => { setSortField("date"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Date <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "20%", cursor: "pointer" }} onClick={() => { setSortField("itemName"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Item Name & Model <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "12%", cursor: "pointer" }} onClick={() => { setSortField("category"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Category <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "12%", cursor: "pointer" }} onClick={() => { setSortField("location"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Location <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "14%", textAlign: "center", cursor: "pointer" }} onClick={() => { setSortField("stockQty"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        Stock Movement <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "14%", cursor: "pointer" }} onClick={() => { setSortField("partyName"); setSortAsc(!sortAsc); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Party Name <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ width: "10%" }}>Remarks</th>
                    <th style={{ width: "6%", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map(tx => {
                    const isPositive = (parseInt(tx.stockQty) || 0) > 0;
                    const isZero = (parseInt(tx.stockQty) || 0) === 0;
                    const isRowSelected = selectedTxIds.includes(tx.id);
                    const txLoc = (tx.location || "Delhi").trim();
                    const isMumbai = txLoc.toLowerCase() === "mumbai";

                    return (
                      <tr key={tx.id} style={{ background: isRowSelected ? "rgba(99, 102, 241, 0.12)" : tx.isMissingId ? "rgba(245, 158, 11, 0.03)" : "" }}>
                        
                        {/* 0. Row Checkbox */}
                        <td style={{ textAlign: "center" }}>
                          <input 
                            type="checkbox" 
                            checked={isRowSelected}
                            onChange={() => handleToggleSelectRow(tx.id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>

                        {/* 1. Date */}
                        <td style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--text-main)" }}>
                          {tx.date}
                        </td>

                        {/* 2. Item Name */}
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.9rem" }}>
                            {tx.itemName}
                          </div>
                          {tx.isMissingId && (
                            <span 
                              onClick={() => setResolvingMissingItemName(tx.itemName)}
                              className="badge" 
                              style={{ 
                                fontSize: "0.66rem", 
                                background: "rgba(245, 158, 11, 0.15)", 
                                color: "#f59e0b", 
                                border: "1px solid rgba(245, 158, 11, 0.3)", 
                                cursor: "pointer",
                                marginTop: "2px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                              title="Click to resolve this missing Item ID in master catalog"
                            >
                              <AlertTriangle size={10} /> Missing Item ID (Click to Fix)
                            </span>
                          )}
                        </td>

                        {/* 3. Category */}
                        <td>
                          {(() => {
                            const rawId = String(tx.itemId || "").trim().toLowerCase();
                            const cleanId = rawId.replace(/^#+/, "");
                            const foundItem = itemCatalogMap.get(rawId) || itemCatalogMap.get(cleanId) || itemCatalogMap.get('#' + cleanId) || itemCatalogMap.get((tx.itemName || "").trim().toLowerCase());
                            const cat = tx.category || foundItem?.category || "General";
                            return (
                              <span className="badge badge-secondary" style={{ 
                                fontWeight: 700, 
                                fontSize: "0.78rem", 
                                color: "#38bdf8",
                                background: "rgba(56, 189, 248, 0.12)",
                                border: "1px solid rgba(56, 189, 248, 0.25)",
                                whiteSpace: "nowrap"
                              }}>
                                {cat}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 4. Warehouse Location */}
                        <td>
                          {isMumbai ? (
                            <span className="badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)", fontWeight: 700, fontSize: "0.75rem" }}>
                              🏢 Mumbai
                            </span>
                          ) : (
                            <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700, fontSize: "0.75rem" }}>
                              🏢 Delhi
                            </span>
                          )}
                        </td>

                        {/* 5. Stock Movement Column (+2 for In, -2 for Out) */}
                        <td style={{ textAlign: "center" }}>
                          {isPositive ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--success)", fontWeight: 800, fontSize: "0.92rem" }}>
                              <TrendingUp size={14} /> +{tx.stockQty} <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>(IN)</span>
                            </div>
                          ) : isZero ? (
                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>0</span>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--danger)", fontWeight: 800, fontSize: "0.92rem" }}>
                              <TrendingDown size={14} /> {tx.stockQty} <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>(OUT)</span>
                            </div>
                          )}
                        </td>

                        {/* 6. Party Name */}
                        <td style={{ fontSize: "0.85rem", color: tx.partyName ? "var(--text-main)" : "var(--text-muted)" }}>
                          {tx.partyName || "—"}
                        </td>

                        {/* 7. Remarks */}
                        <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {tx.remarks || "—"}
                        </td>

                        {/* 8. Actions */}
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              onClick={() => {
                                setEditingTransaction(tx);
                                setShowAddModal(true);
                              }}
                              className="btn btn-secondary btn-sm"
                              title="Edit Entry"
                              style={{ padding: "4px 7px" }}
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm(`Delete this IMS stock movement entry (${tx.itemName}, ${tx.stockQty})?`)) {
                                  onDeleteTransaction(tx.id);
                                }
                              }}
                              className="btn btn-danger btn-sm"
                              title="Delete Entry"
                              style={{ padding: "4px 7px" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Universal Pagination (100 rows per page) */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => {
                setItemsPerPage(n);
                setCurrentPage(1);
              }}
              perPageOptions={[50, 100, 200, 500]}
            />
          </div>

        </div>
      )}

      {/* ==================== TAB 2: ITEM STOCK MATRIX ==================== */}
      {activeTab === "matrix" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div className="glass-panel" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", margin: 0 }}>
                Item Model-Wise Stock Summary Matrix
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px", margin: 0 }}>
                Aggregated physical balance per catalog SKU derived directly from all historical 2026+ movements.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                onClick={() => {
                  const headers = ["Item ID", "Item Name", "Category", "Delhi Warehouse Stock", "Mumbai Warehouse Stock", "Total Inward (+)", "Total Outward (-)", "Current Physical Balance", "Status", "Last Movement Date"];
                  const rows = itemStockMatrix.map(m => [
                    m.id, m.name, m.category, m.delhiStock || 0, m.mumbaiStock || 0, m.inward, m.outward, m.currentStock,
                    m.currentStock > 100 ? "In Stock" : m.currentStock > 0 ? "Low Stock" : "Out of Stock",
                    m.lastDate || "—"
                  ]);
                  const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(v => `"${v}"`).join(","))].join("\n");
                  const link = document.createElement("a");
                  link.href = encodeURI(csv);
                  link.download = `IMS_Item_Stock_Matrix_${new Date().toISOString().split("T")[0]}.csv`;
                  link.click();
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Export Summary CSV
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {isDataLoading ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                <RefreshCw size={38} className="spin" style={{ color: "var(--primary)" }} />
                <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Calculating Item Stock Matrix...</h4>
                <p style={{ fontSize: "0.85rem", margin: 0, opacity: 0.8 }}>Aggregating physical SKU balances across Delhi & Mumbai warehouses...</p>
              </div>
            ) : paginatedMatrix.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Package size={36} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <h4>No items found in stock matrix</h4>
              </div>
            ) : (
              <table className="table" style={{ width: "100%", minWidth: "980px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "10%" }}>Item ID</th>
                    <th style={{ width: "24%" }}>Item Model / Name</th>
                    <th style={{ width: "13%" }}>Category</th>
                    <th style={{ width: "13%", textAlign: "right", color: "#38bdf8" }}>🏢 Delhi Stock</th>
                    <th style={{ width: "13%", textAlign: "right", color: "#c084fc" }}>🏢 Mumbai Stock</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Total Net Balance</th>
                    <th style={{ width: "12%", textAlign: "center" }}>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMatrix.map(item => (
                  <tr key={item.id} style={{ background: item.isUnlinked ? "rgba(245, 158, 11, 0.03)" : "" }}>
                    <td>
                      {item.isUnlinked ? (
                        <button
                          onClick={() => setResolvingMissingItemName(item.name)}
                          className="badge"
                          style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.4)", cursor: "pointer", fontSize: "0.72rem" }}
                        >
                          + Link ID
                        </button>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8" }}>
                          #{item.id}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                      {item.name}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {item.category}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: (item.delhiStock || 0) >= 0 ? "#38bdf8" : "var(--danger)" }}>
                      {(item.delhiStock || 0).toLocaleString()} Pcs
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: (item.mumbaiStock || 0) >= 0 ? "#c084fc" : "var(--danger)" }}>
                      {(item.mumbaiStock || 0).toLocaleString()} Pcs
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, fontSize: "0.95rem", color: item.currentStock >= 0 ? "var(--text-main)" : "var(--danger)" }}>
                      {item.currentStock.toLocaleString()} Pcs
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {item.currentStock > 100 ? (
                        <span className="badge badge-success">In Stock</span>
                      ) : item.currentStock > 0 ? (
                        <span className="badge badge-warning">Low Stock</span>
                      ) : (
                        <span className="badge badge-danger">Out of Stock</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}

            {/* Matrix Pagination */}
            <Pagination
              currentPage={matrixPage}
              totalItems={itemStockMatrix.length}
              itemsPerPage={matrixPerPage}
              onPageChange={setMatrixPage}
              onItemsPerPageChange={(n) => {
                setMatrixPerPage(n);
                setMatrixPage(1);
              }}
              perPageOptions={[50, 100, 200, 500]}
            />
          </div>

        </div>
      )}

      {/* ==================== TAB 3: BULK HISTORICAL EXCEL / CSV UPLOADER ==================== */}
      {activeTab === "bulk" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Uploader Card */}
          <div className="glass-panel" style={{ padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <UploadCloud size={22} /> Bulk Upload IMS Transactions (2026 to Present)
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px", margin: 0 }}>
                  Paste rows directly from Excel or upload a CSV file with columns: <code>Date, Item Name, Stock, Remarks, Party Name, Item ID, Location</code>
                </p>
              </div>

              {/* Template helper pill & Download Sample Button */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                <button
                  onClick={handleDownloadSampleCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", fontWeight: 700 }}
                >
                  <Download size={14} /> Download Sample CSV Template
                </button>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "6px 12px", fontSize: "0.76rem" }}>
                  <span style={{ fontWeight: 700, color: "#38bdf8" }}>Columns Order:</span> <code>Date | Item Name | Stock (+/-) | Remarks | Party Name | Item ID | Location</code>
                </div>
              </div>
            </div>

            {bulkUploadMsg && (
              <div className={`alert-strip ${bulkUploadMsg.includes("✅") ? "alert-success" : "alert-danger"}`} style={{ marginBottom: "16px" }}>
                {bulkUploadMsg}
              </div>
            )}

            {/* Paste Area */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Paste Excel Cells or CSV Content</label>
              <textarea
                rows={6}
                value={bulkRawText}
                onChange={e => handleParseBulkText(e.target.value)}
                placeholder={"2026-01-05\tMP-CH-65W Gan Fast Charger\t500\tOpening Stock\tShenzhen Tech\tit-1\tDelhi\n2026-01-12\tMP-CH-65W Gan Fast Charger\t-50\tDispatched SO-01\tShree Ganesh\tit-1\tMumbai\n2026-02-01\tMP-CB-Braided Fast Cable\t1000\tNew Batch\tGuangzhou Co\t\tDelhi"}
                className="form-control"
                style={{ fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.4 }}
              />
            </div>

            {/* File upload alternative */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <FileText size={14} /> Choose CSV / Text File
                  <input 
                    type="file" 
                    accept=".csv,.txt,.tsv" 
                    style={{ display: "none" }} 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => handleParseBulkText(evt.target?.result || "");
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}
                  title="Download pre-formatted sample CSV file"
                >
                  <Download size={13} /> Sample CSV
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {bulkParsedRows.length > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 700 }}>
                    ✓ {bulkParsedRows.length} rows parsed ready to upload
                  </span>
                )}

                <button
                  onClick={handleExecuteBulkUpload}
                  disabled={bulkParsedRows.length === 0 || isUploading}
                  className="btn btn-primary"
                  style={{ padding: "8px 22px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  {isUploading ? <RefreshCw size={15} className="spin" /> : <UploadCloud size={16} />}
                  Commit & Save {bulkParsedRows.length} Rows to IMS
                </button>
              </div>
            </div>

          </div>

          {/* Live Preview Table */}
          {bulkParsedRows.length > 0 && (
            <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                  Parsed Validation Preview ({bulkParsedRows.length} Entries)
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {bulkParsedRows.filter(r => r.isMissingId).length} unlinked item IDs will be flagged for review
                </span>
              </div>

              <table className="table" style={{ width: "100%", fontSize: "0.84rem" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item Name</th>
                    <th>Item ID</th>
                    <th>Location</th>
                    <th style={{ textAlign: "center" }}>Stock (+/-)</th>
                    <th>Party Name</th>
                    <th>Remarks</th>
                    <th style={{ textAlign: "center" }}>Match Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkParsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} style={{ background: row.isMissingId ? "rgba(245, 158, 11, 0.04)" : "" }}>
                      <td>{row.date}</td>
                      <td style={{ fontWeight: 600 }}>{row.itemName}</td>
                      <td>
                        {row.itemId ? (
                          <span className="badge badge-secondary" style={{ fontFamily: "monospace" }}>#{row.itemId}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>(None)</span>
                        )}
                      </td>
                      <td>
                        {row.location === "Mumbai" ? (
                          <span className="badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)", fontWeight: 700, fontSize: "0.74rem" }}>
                            🏢 Mumbai
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700, fontSize: "0.74rem" }}>
                            🏢 Delhi
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: row.stockQty >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {row.stockQty >= 0 ? `+${row.stockQty}` : row.stockQty}
                      </td>
                      <td>{row.partyName || "—"}</td>
                      <td style={{ color: "var(--text-muted)" }}>{row.remarks || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        {row.isMissingId ? (
                          <span className="badge badge-warning" style={{ fontSize: "0.68rem" }}>⚠️ Unmatched ID</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: "0.68rem" }}>✓ Matched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bulkParsedRows.length > 50 && (
                <div style={{ textAlign: "center", padding: "10px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  Showing first 50 rows of {bulkParsedRows.length} total rows...
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ==================== TAB 4: MISSING ITEM IDS RESOLUTION STUDIO ==================== */}
      {activeTab === "missingids" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <ShieldAlert size={22} /> Missing Item IDs Resolution Studio
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px", margin: 0 }}>
                These item models were uploaded in IMS transactions without a matching Master Item ID. Create them in Master Catalog or map them to an existing SKU to resolve all corresponding historical entries automatically.
              </p>
            </div>
          </div>

          {distinctMissingItems.length === 0 ? (
            <div className="glass-panel" style={{ padding: "50px", textAlign: "center" }}>
              <CheckCircle2 size={44} style={{ color: "var(--success)", marginBottom: "12px" }} />
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--success)" }}>All Item IDs Linked & Clean!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                100% of all historical IMS transactions have a verified Master Item ID.
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", minWidth: "850px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>Unlinked Item Name in IMS</th>
                    <th style={{ width: "15%", textAlign: "center" }}>Historical Transactions</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Net Physical Qty</th>
                    <th style={{ width: "15%" }}>Sample Date / Party</th>
                    <th style={{ width: "20%", textAlign: "center" }}>Resolution Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMissing.map(item => (
                    <tr key={item.name}>
                      <td style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.92rem" }}>
                        {item.name}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-warning" style={{ fontWeight: 800 }}>
                          {item.count} Entries
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: item.totalQty >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {item.totalQty > 0 ? `+${item.totalQty}` : item.totalQty} Pcs
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {item.sampleDate || "2026"} • {item.sampleParty || "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => setResolvingMissingItemName(item.name)}
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem" }}
                        >
                          <Plus size={13} /> Create in Master / Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Missing IDs Pagination */}
              <Pagination
                currentPage={missingPage}
                totalItems={distinctMissingItems.length}
                itemsPerPage={missingPerPage}
                onPageChange={setMissingPage}
                onItemsPerPageChange={(n) => {
                  setMissingPerPage(n);
                  setMissingPage(1);
                }}
                perPageOptions={[50, 100, 200, 500]}
              />
            </div>
          )}

        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT SINGLE STOCK MOVEMENT ==================== */}
      {showAddModal && (
        <StockMovementModal
          transaction={editingTransaction}
          items={items}
          crmParties={crmParties}
          vendors={vendors}
          onSave={async (txData) => {
            await onAddTransaction(txData);
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
        />
      )}

      {/* ==================== MODAL: RESOLVE MISSING ITEM ID ==================== */}
      {resolvingMissingItemName && (
        <div className="modal-backdrop" onClick={() => setResolvingMissingItemName(null)}>
          <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", padding: "28px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <div>
                <span className="badge badge-warning" style={{ marginBottom: "4px" }}>Item ID Resolution Studio</span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                  Resolve Item ID for "{resolvingMissingItemName}"
                </h3>
              </div>
              <button onClick={() => setResolvingMissingItemName(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            {/* Option 1: 1-Click Create in Master Catalog */}
            <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "10px", padding: "18px", marginBottom: "18px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#818cf8", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> Option 1: Create as New SKU in Master Catalog
              </h4>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                This creates the item in the Master Item Catalog with a new unique Item ID and automatically backfills all historical IMS rows!
              </p>

              <form onSubmit={handleCreateAndResolveMasterItem} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>Category</label>
                    <select value={createMasterCategory} onChange={e => setCreateMasterCategory(e.target.value)} className="form-control" style={{ fontSize: "0.82rem" }}>
                      <option value="Chargers">Chargers</option>
                      <option value="Cables">Cables</option>
                      <option value="Power Banks">Power Banks</option>
                      <option value="Car Chargers">Car Chargers</option>
                      <option value="Audio / TWS">Audio / TWS</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>Type</label>
                    <select value={createMasterType} onChange={e => setCreateMasterType(e.target.value)} className="form-control" style={{ fontSize: "0.82rem" }}>
                      <option value="FG">Finished Goods (FG)</option>
                      <option value="RM">Raw Material (RM)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700, padding: "8px", marginTop: "6px" }}>
                  ✓ Create Master Item & Link All IMS Records
                </button>
              </form>
            </div>

            {/* Option 2: Link to Existing Master Item */}
            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "18px" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Check size={16} /> Option 2: Map to an Existing Master Item
              </h4>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                If this item is already in catalog under a slightly different spelling, select the matching master item:
              </p>

              <form onSubmit={handleMapToExistingItem} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select value={mapExistingItemId} onChange={e => setMapExistingItemId(e.target.value)} className="form-control" style={{ fontSize: "0.85rem" }} required>
                    <option value="">-- Choose Existing Master Item --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        #{it.id} - {it.name} ({it.category || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={!mapExistingItemId} className="btn btn-secondary btn-sm" style={{ fontWeight: 700, padding: "8px" }}>
                  Map & Update IMS Transactions
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL: DELETE BY DATE RANGE ==================== */}
      {showDeleteRangeModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteRangeModal(false)}>
          <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "540px", padding: "28px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" }}>
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--danger)", margin: 0 }}>
                    Delete Entries by Date Range
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Permanent bulk deletion tool</span>
                </div>
              </div>
              <button onClick={() => setShowDeleteRangeModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: "0.86rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Select a start and end date and warehouse. All stock movement records matching these criteria will be permanently removed.
            </p>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.82rem" }}>🏢 Target Warehouse</label>
              <select
                value={delRangeLocation}
                onChange={e => setDelRangeLocation(e.target.value)}
                className="form-control"
                style={{ fontSize: "0.88rem", fontWeight: 600 }}
              >
                <option value="all">🏢 All Warehouses (Delhi & Mumbai)</option>
                <option value="Delhi">📍 Delhi Warehouse Only</option>
                <option value="Mumbai">📍 Mumbai Warehouse Only</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.82rem" }}>From Date</label>
                <input
                  type="date"
                  value={delRangeStart}
                  onChange={e => setDelRangeStart(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.88rem" }}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: "0.82rem" }}>To Date</label>
                <input
                  type="date"
                  value={delRangeEnd}
                  onChange={e => setDelRangeEnd(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.88rem" }}
                  required
                />
              </div>
            </div>

            {/* Range Match Preview Pill */}
            {delRangeStart && delRangeEnd && (
              <div style={{ 
                padding: "14px 16px", 
                borderRadius: "10px", 
                background: rangeMatchedTransactions.length > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", 
                border: `1px solid ${rangeMatchedTransactions.length > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                marginBottom: "20px" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: rangeMatchedTransactions.length > 0 ? "#f87171" : "var(--success)" }}>
                    {rangeMatchedTransactions.length > 0 ? `⚠️ Found ${rangeMatchedTransactions.length} transaction(s)` : "✓ No transactions match this range"}
                  </span>
                  {rangeMatchedTransactions.length > 0 && (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Net Qty: <strong>{rangeMatchedNetQty > 0 ? `+${rangeMatchedNetQty}` : rangeMatchedNetQty} Pcs</strong>
                    </span>
                  )}
                </div>
                {rangeMatchedTransactions.length > 0 && (
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px", margin: 0 }}>
                    Date Range: <strong>{delRangeStart}</strong> to <strong>{delRangeEnd}</strong>
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button 
                type="button" 
                onClick={() => setShowDeleteRangeModal(false)} 
                className="btn btn-secondary"
                disabled={isDeletingRange}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleExecuteDeleteRange}
                disabled={!delRangeStart || !delRangeEnd || rangeMatchedTransactions.length === 0 || isDeletingRange}
                className="btn btn-danger"
                style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {isDeletingRange ? <RefreshCw size={15} className="spin" /> : <Trash2 size={15} />}
                Permanently Delete ({rangeMatchedTransactions.length}) Entries
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ==================== SUB-COMPONENT: STOCK MOVEMENT MODAL ====================
function StockMovementModal({ transaction, items, crmParties, vendors, onSave, onClose }) {
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split("T")[0]);
  const [itemName, setItemName] = useState(transaction?.itemName || "");
  const [itemId, setItemId] = useState(transaction?.itemId || "");
  const [stockQty, setStockQty] = useState(transaction ? Math.abs(parseInt(transaction.stockQty) || 0) : 100);
  const [movementType, setMovementType] = useState(transaction ? (parseInt(transaction.stockQty) >= 0 ? "IN" : "OUT") : "IN");
  const [location, setLocation] = useState(transaction?.location || "Delhi");
  const [partyName, setPartyName] = useState(transaction?.partyName || "");
  const [remarks, setRemarks] = useState(transaction?.remarks || "");

  // When picking item from dropdown, auto fill itemId and itemName
  const handleItemSelect = (selectedId) => {
    if (!selectedId) {
      setItemId("");
      return;
    }
    const it = items.find(i => i.id === selectedId);
    if (it) {
      setItemId(it.id);
      setItemName(it.name);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const finalQty = movementType === "OUT" ? -Math.abs(parseInt(stockQty) || 0) : Math.abs(parseInt(stockQty) || 0);

    onSave({
      id: transaction?.id || `ims-${Date.now()}`,
      date,
      itemName: itemName.trim(),
      itemId: itemId.trim(),
      stockQty: finalQty,
      movementType,
      partyName: partyName.trim(),
      remarks: remarks.trim(),
      location: (location || "Delhi").trim(),
      source: transaction?.source || "manual",
      isMissingId: !itemId.trim()
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "560px", padding: "26px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} /> {transaction ? "Edit IMS Stock Transaction" : "Log Stock Inflow / Outflow Movement"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* Movement Type Switcher (Stock IN vs Stock OUT) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setMovementType("IN")}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: movementType === "IN" ? "2px solid var(--success)" : "1px solid var(--border-glass)",
                background: movementType === "IN" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                color: movementType === "IN" ? "var(--success)" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer"
              }}
            >
              <TrendingUp size={16} /> Stock IN (+ Inward / Receipt)
            </button>

            <button
              type="button"
              onClick={() => setMovementType("OUT")}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: movementType === "OUT" ? "2px solid var(--danger)" : "1px solid var(--border-glass)",
                background: movementType === "OUT" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                color: movementType === "OUT" ? "var(--danger)" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer"
              }}
            >
              <TrendingDown size={16} /> Stock OUT (- Outward / Dispatch)
            </button>
          </div>

          {/* Warehouse Location Selector */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Warehouse Location *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setLocation("Delhi")}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: location === "Delhi" ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
                  background: location === "Delhi" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                  color: location === "Delhi" ? "#38bdf8" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer"
                }}
              >
                🏢 Delhi Warehouse
              </button>
              <button
                type="button"
                onClick={() => setLocation("Mumbai")}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: location === "Mumbai" ? "2px solid #c084fc" : "1px solid var(--border-glass)",
                  background: location === "Mumbai" ? "rgba(168, 85, 247, 0.15)" : "transparent",
                  color: location === "Mumbai" ? "#c084fc" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer"
                }}
              >
                🏢 Mumbai Warehouse
              </button>
            </div>
          </div>

          {/* Date & Quantity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transaction Date *</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity ({movementType === "IN" ? "+ Units" : "- Units"}) *</label>
              <input type="number" required min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} className="form-control" />
            </div>
          </div>

          {/* Item Selector / Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select from Catalog or Write Item Name *</label>
            <select
              value={itemId}
              onChange={e => handleItemSelect(e.target.value)}
              className="form-control"
              style={{ marginBottom: "6px", fontSize: "0.84rem" }}
            >
              <option value="">-- Choose Master Item (Auto-links ID) --</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  #{it.id} - {it.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Item Name / Model..."
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="form-control"
            />
          </div>

          {/* Party Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Party Name (Vendor, Supplier, or Customer)</label>
            <input
              type="text"
              placeholder="e.g. Shenzhen Tech, Shree Ganesh Electronics, Marwar Power..."
              value={partyName}
              onChange={e => setPartyName(e.target.value)}
              className="form-control"
            />
          </div>

          {/* Remarks */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Remarks / Narration</label>
            <input
              type="text"
              placeholder="e.g. Factory shipment receipt, order dispatch LR #8812, sample test..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="form-control"
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px", fontWeight: 700 }}>
              {transaction ? "Save Changes" : `Log Stock ${movementType}`}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
