import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { 
  Award, Gift, Target, Calendar, Plus, Edit2, Trash2, Search, Filter, 
  Download, Upload, CheckCircle2, ChevronRight, X, Layers, AlertCircle, 
  ArrowUpDown, Check, Building2, User, Users, Sparkles, FileSpreadsheet,
  Info, ExternalLink, RefreshCw, BarChart2, Shield, TrendingUp, Package,
  Play, Pause, Eye, EyeOff
} from "lucide-react";
import Pagination from "./Pagination";
import { useLoading } from "../context/LoadingContext";
import { downloadCsv } from "../utils/formatters";
import { matchParty, normParty } from "./CrmDashboard";

// Helper to normalize item names for matching
export const normItem = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Helper to parse diverse date formats into standard YYYY-MM-DD
export function parseFlexibleDate(dateStr, defaultYear = 2026) {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (!s) return "";

  // 1. Standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // 2. M/D/YYYY or M/D/YY (American format like in user screenshot: 6/1/2026)
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const parts = s.split("/").map(Number);
    let m = parts[0];
    let d = parts[1];
    let y = parts[2];
    if (y < 100) y += 2000;
    // If month > 12 and day <= 12, might be DD/MM/YYYY
    if (m > 12 && d <= 12) {
      const tmp = m; m = d; d = tmp;
    }
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // 3. D-M-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[-.]\d{1,2}[-.]\d{2,4}$/.test(s)) {
    const parts = s.split(/[-.]/).map(Number);
    let d = parts[0];
    let m = parts[1];
    let y = parts[2];
    if (y < 100) y += 2000;
    if (m > 12 && d <= 12) {
      const tmp = m; m = d; d = tmp;
    }
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // 4. Try native Date parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return s;
}

// Generate Month range between two dates (e.g. 2026-06 to 2026-09 -> ['June', 'July', 'Aug', 'Sept'])
export function getSchemeMonths(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date("2026-06-01");
  const end = endDate ? new Date(endDate) : new Date("2026-09-30");

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [
      { key: "2026-06", label: "June", year: 2026, monthIndex: 5 },
      { key: "2026-07", label: "July", year: 2026, monthIndex: 6 },
      { key: "2026-08", label: "Aug", year: 2026, monthIndex: 7 },
      { key: "2026-09", label: "Sept", year: 2026, monthIndex: 8 }
    ];
  }

  const months = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= last) {
    const y = curr.getFullYear();
    const mIdx = curr.getMonth();
    const mKey = `${y}-${String(mIdx + 1).padStart(2, "0")}`;
    months.push({
      key: mKey,
      label: monthNames[mIdx],
      year: y,
      monthIndex: mIdx
    });
    curr.setMonth(curr.getMonth() + 1);
  }

  return months.length > 0 ? months : [
    { key: "2026-06", label: "June", year: 2026, monthIndex: 5 },
    { key: "2026-07", label: "July", year: 2026, monthIndex: 6 },
    { key: "2026-08", label: "Aug", year: 2026, monthIndex: 7 },
    { key: "2026-09", label: "Sept", year: 2026, monthIndex: 8 }
  ];
}

export default function SchemeManagementStudio({
  schemes = [],
  crmParties = [],
  crmDispatches = [],
  imsTransactions = [],
  users = [],
  items = [],
  currentUser,
  isAdmin = false,
  onAddScheme,
  onUpdateScheme,
  onDeleteScheme,
  onBulkAddSchemeItems,
  onDeleteSchemeItem,
  onBulkDeleteSchemeItems
}) {
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();

  const isSuperAdmin = currentUser?.role === "superadmin" || currentUser?.role === "owner" || isAdmin;
  const isCrmUser = currentUser?.role === "crm";
  const isAsmUser = currentUser?.role === "asm";
  const isTsmUser = currentUser?.role === "tsm";
  const isRsmUser = currentUser?.role === "rsm";

  // Helper to test if a scheme is currently live/active
  const isSchemeLive = useCallback((s) => {
    if (!s) return false;
    const st = String(s.status || "active").toLowerCase().trim();
    return st === "active" || st === "live";
  }, []);

  // Visible schemes: Admin sees all schemes (Live & Paused); Non-admin portals only see Live schemes
  const visibleSchemes = useMemo(() => {
    if (isSuperAdmin) return schemes || [];
    return (schemes || []).filter(isSchemeLive);
  }, [schemes, isSuperAdmin, isSchemeLive]);

  // Selected Active Scheme ID (default to Goa Scheme or first visible scheme)
  const [selectedSchemeId, setSelectedSchemeId] = useState(() => {
    const list = isSuperAdmin ? (schemes || []) : (schemes || []).filter(s => {
      const st = String(s.status || "active").toLowerCase().trim();
      return st === "active" || st === "live";
    });
    const goa = list.find(s => s.id === "scheme-goa" || (s.name && s.name.toLowerCase().includes("goa")));
    if (goa) return goa.id;
    return list[0]?.id || "";
  });

  // Ensure selectedSchemeId stays valid if visible schemes change
  useEffect(() => {
    if (visibleSchemes.length > 0 && !visibleSchemes.some(s => s.id === selectedSchemeId)) {
      setSelectedSchemeId(visibleSchemes[0].id);
    }
  }, [visibleSchemes, selectedSchemeId]);

  const activeScheme = useMemo(() => {
    return visibleSchemes.find(s => s.id === selectedSchemeId) || visibleSchemes[0] || null;
  }, [visibleSchemes, selectedSchemeId]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCrmFilter, setSelectedCrmFilter] = useState("all");
  const [selectedAsmFilter, setSelectedAsmFilter] = useState("all");
  const [selectedTsmFilter, setSelectedTsmFilter] = useState("all");
  const [targetStatusFilter, setTargetStatusFilter] = useState("all"); // "all" | "achieved" | "in_progress" | "zero"
  const [sortField, setSortField] = useState("totalDispatched"); // "totalDispatched" | "partyName" | "sno"
  const [sortOrder, setSortOrder] = useState("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modals State
  const [showSchemeConfigModal, setShowSchemeConfigModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [showBulkItemModal, setShowBulkItemModal] = useState(false);
  const [showSchemeItemsDrawer, setShowSchemeItemsDrawer] = useState(false);
  const [selectedPartyDrilldown, setSelectedPartyDrilldown] = useState(null);

  // Multi-select for deleting items from scheme
  const [selectedItemsForDelete, setSelectedItemsForDelete] = useState(new Set());

  // Form State for Scheme Config Modal
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formSchemeType, setFormSchemeType] = useState("qty_dispatch");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("2026-06-01");
  const [formEndDate, setFormEndDate] = useState("2026-09-30");
  const [formTargetQty, setFormTargetQty] = useState(10000);
  const [formGiftReward, setFormGiftReward] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formTiers, setFormTiers] = useState([]);

  // Form State for Bulk Item Import Modal (Matching Image 1: Item Name | Start Date | End Date)
  const [bulkRawText, setBulkRawText] = useState("");
  const [bulkDefaultStartDate, setBulkDefaultStartDate] = useState("2026-06-01");
  const [bulkDefaultEndDate, setBulkDefaultEndDate] = useState("2026-09-30");
  const [bulkParsedItems, setBulkParsedItems] = useState([]);
  const [bulkImportMode, setBulkImportMode] = useState("paste"); // "paste" | "select"
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogItems, setSelectedCatalogItems] = useState([]);

  // Unified Outward Dispatches
  const unifiedDispatches = useMemo(() => {
    const list = (crmDispatches || []).map(d => ({
      id: d.id,
      partyId: d.partyId || "",
      partyName: (d.partyName || "").trim(),
      itemModel: (d.itemModel || d.itemName || "").trim(),
      dispatchedQty: Math.abs(parseInt(d.dispatchedQty) || 0),
      dispatchDate: d.dispatchDate || ""
    }));

    const existingIds = new Set(list.map(d => d.id));

    (imsTransactions || []).forEach(tx => {
      if (!tx || !tx.partyName || !tx.partyName.trim()) return;
      const pLower = (tx.partyName || "").toLowerCase();
      const rLower = (tx.remarks || tx.narration || "").toLowerCase();
      if (pLower.includes("opening stock") || rLower.includes("opening stock") || tx.source === "opening_stock" || tx.movementType === "OPENING") return;

      const numQty = parseInt(tx.stockQty) || 0;
      const isOutward = (tx.movementType || "").toUpperCase() === "OUT" || numQty < 0 || (!tx.movementType && numQty !== 0);
      if (isOutward && !existingIds.has(tx.id)) {
        list.push({
          id: tx.id,
          partyId: tx.partyId || "",
          partyName: tx.partyName.trim(),
          itemModel: (tx.itemName || "Item").trim(),
          dispatchedQty: Math.abs(numQty),
          dispatchDate: tx.date || ""
        });
      }
    });

    return list;
  }, [crmDispatches, imsTransactions]);

  // Month Columns for the active scheme
  const schemeMonths = useMemo(() => {
    if (!activeScheme) return [];
    return getSchemeMonths(activeScheme.startDate, activeScheme.endDate);
  }, [activeScheme]);

  // Item Lookup Map for active scheme (matches case/spaces/dashes)
  const schemeItemRules = useMemo(() => {
    if (!activeScheme || !Array.isArray(activeScheme.items) || activeScheme.items.length === 0) {
      return new Map();
    }
    const map = new Map();
    activeScheme.items.forEach(it => {
      if (!it || !it.itemName) return;
      const raw = String(it.itemName).trim();
      const norm = normItem(raw);
      const rule = {
        itemName: raw,
        startDate: it.startDate || activeScheme.startDate || "2026-06-01",
        endDate: it.endDate || activeScheme.endDate || "2026-09-30",
        targetQty: parseInt(it.targetQty) || 0
      };
      map.set(raw.toLowerCase(), rule);
      map.set(norm, rule);
    });
    return map;
  }, [activeScheme]);

  // Check if a dispatch item matches the active scheme and validity dates
  const matchSchemeDispatch = useCallback((dispatch) => {
    if (!activeScheme) return null;
    if (activeScheme.schemeType === "percentage" && (!activeScheme.items || activeScheme.items.length === 0)) {
      // General turnover scheme applies to all items in date window
      const dDate = dispatch.dispatchDate || "";
      if (dDate >= activeScheme.startDate && dDate <= activeScheme.endDate) {
        return { itemName: dispatch.itemModel, startDate: activeScheme.startDate, endDate: activeScheme.endDate };
      }
      return null;
    }

    if (schemeItemRules.size === 0) return null;

    const rawModel = (dispatch.itemModel || "").trim();
    const normModel = normItem(rawModel);

    // Direct lookup
    const rule = schemeItemRules.get(rawModel.toLowerCase()) || schemeItemRules.get(normModel);
    if (rule) {
      const dDate = dispatch.dispatchDate || "";
      if (!dDate || (dDate >= rule.startDate && dDate <= rule.endDate)) {
        return rule;
      }
      return null;
    }

    // Fuzzy contains lookup (e.g. "BT220 Black" matches "BT220")
    for (const [key, r] of schemeItemRules.entries()) {
      if (key.length >= 3 && (normModel.includes(key) || key.includes(normModel))) {
        const dDate = dispatch.dispatchDate || "";
        if (!dDate || (dDate >= r.startDate && dDate <= r.endDate)) {
          return r;
        }
      }
    }

    return null;
  }, [activeScheme, schemeItemRules]);

  // Aggregate Scheme Performance Data Per Party
  const partyPerformanceRows = useMemo(() => {
    if (!activeScheme) return [];

    // 1. Build dispatch bucket per party: partyKey -> { monthKey -> qty, totalQty, vouchers }
    const partyDispatchMap = new Map();

    unifiedDispatches.forEach(d => {
      const pName = (d.partyName || "").trim();
      if (!pName) return;
      const matchedRule = matchSchemeDispatch(d);
      if (!matchedRule) return; // Not part of this scheme or out of date window!

      const normP = normParty(pName);
      if (!partyDispatchMap.has(normP)) {
        partyDispatchMap.set(normP, {
          partyName: pName,
          partyId: d.partyId || "",
          monthMap: {},
          totalDispatched: 0,
          dispatches: []
        });
      }

      const entry = partyDispatchMap.get(normP);
      // Extract Year-Month
      let mKey = "";
      if (d.dispatchDate && /^\d{4}-\d{2}/.test(d.dispatchDate)) {
        mKey = d.dispatchDate.slice(0, 7);
      } else if (d.dispatchDate) {
        const parsed = parseFlexibleDate(d.dispatchDate);
        if (parsed) mKey = parsed.slice(0, 7);
      }

      if (mKey) {
        entry.monthMap[mKey] = (entry.monthMap[mKey] || 0) + d.dispatchedQty;
      }
      entry.totalDispatched += d.dispatchedQty;
      entry.dispatches.push({
        ...d,
        matchedItem: matchedRule.itemName
      });
    });

    // 2. Align with CRM Parties directory
    const rows = [];
    const processedPartyKeys = new Set();

    (crmParties || []).forEach(party => {
      if (!party || !party.name) return;
      const cleanName = party.name.trim();
      const normP = normParty(cleanName);
      processedPartyKeys.add(normP);

      const dispatchInfo = partyDispatchMap.get(normP) || {
        partyName: cleanName,
        partyId: party.id || "",
        monthMap: {},
        totalDispatched: 0,
        dispatches: []
      };

      // Month columns values
      const monthValues = {};
      schemeMonths.forEach(m => {
        monthValues[m.key] = dispatchInfo.monthMap[m.key] || 0;
      });

      // Target Achievement calculation
      const targetThreshold = activeScheme.targetQty || 10000;
      const isTargetAchieved = targetThreshold > 0 && dispatchInfo.totalDispatched >= targetThreshold;
      const progressPct = targetThreshold > 0 ? Math.min(100, Math.round((dispatchInfo.totalDispatched / targetThreshold) * 100)) : 100;

      // Match highest qualifying reward tier
      let earnedGift = isTargetAchieved ? activeScheme.giftReward : "";
      if (Array.isArray(activeScheme.tiers) && activeScheme.tiers.length > 0) {
        const sortedTiers = [...activeScheme.tiers].sort((a, b) => (b.targetQty || 0) - (a.targetQty || 0));
        const matchedTier = sortedTiers.find(t => dispatchInfo.totalDispatched >= (t.targetQty || 0));
        if (matchedTier) {
          earnedGift = matchedTier.giftTitle;
        }
      }

      rows.push({
        partyId: party.id || cleanName,
        partyName: cleanName,
        contactPerson: party.contactPerson || "",
        phone: party.phone || "",
        city: party.city || "",
        state: party.state || "",
        crmName: party.assignedCrmName || "—",
        crmId: party.assignedCrmId || "",
        asmName: party.assignedAsmName || "—",
        asmId: party.assignedAsmId || "",
        tsmName: party.assignedTsmName || "—",
        tsmId: party.assignedTsmId || "",
        rsmName: party.assignedRsmName || "—",
        rsmId: party.assignedRsmId || "",
        monthValues,
        totalDispatched: dispatchInfo.totalDispatched,
        targetThreshold,
        isTargetAchieved,
        progressPct,
        earnedGift,
        dispatches: dispatchInfo.dispatches
      });
    });

    // 3. Include any parties with dispatches that might not be formally in crmParties
    for (const [normP, dispatchInfo] of partyDispatchMap.entries()) {
      if (!processedPartyKeys.has(normP) && dispatchInfo.totalDispatched > 0) {
        const monthValues = {};
        schemeMonths.forEach(m => {
          monthValues[m.key] = dispatchInfo.monthMap[m.key] || 0;
        });
        const targetThreshold = activeScheme.targetQty || 10000;
        const isTargetAchieved = targetThreshold > 0 && dispatchInfo.totalDispatched >= targetThreshold;
        const progressPct = targetThreshold > 0 ? Math.min(100, Math.round((dispatchInfo.totalDispatched / targetThreshold) * 100)) : 100;

        let earnedGift = isTargetAchieved ? activeScheme.giftReward : "";
        if (Array.isArray(activeScheme.tiers) && activeScheme.tiers.length > 0) {
          const sortedTiers = [...activeScheme.tiers].sort((a, b) => (b.targetQty || 0) - (a.targetQty || 0));
          const matchedTier = sortedTiers.find(t => dispatchInfo.totalDispatched >= (t.targetQty || 0));
          if (matchedTier) earnedGift = matchedTier.giftTitle;
        }

        rows.push({
          partyId: dispatchInfo.partyId || dispatchInfo.partyName,
          partyName: dispatchInfo.partyName,
          contactPerson: "",
          phone: "",
          city: "",
          state: "",
          crmName: "—",
          crmId: "",
          asmName: "—",
          asmId: "",
          tsmName: "—",
          tsmId: "",
          rsmName: "—",
          rsmId: "",
          monthValues,
          totalDispatched: dispatchInfo.totalDispatched,
          targetThreshold,
          isTargetAchieved,
          progressPct,
          earnedGift,
          dispatches: dispatchInfo.dispatches
        });
      }
    }

    return rows;
  }, [activeScheme, unifiedDispatches, crmParties, schemeMonths, matchSchemeDispatch]);

  // Role Scoping & User Filtering
  const roleScopedRows = useMemo(() => {
    let list = partyPerformanceRows;

    if (isAsmUser) {
      const myName = (currentUser?.name || "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      list = list.filter(r => {
        const matchId = myId && r.asmId === myId;
        const rAsm = (r.asmName || "").trim().toLowerCase();
        const matchName = myName && rAsm && (rAsm.includes(myName) || myName.includes(rAsm));
        return matchId || matchName;
      });
    } else if (isTsmUser) {
      const myName = (currentUser?.name || "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      list = list.filter(r => {
        const matchId = myId && r.tsmId === myId;
        const rTsm = (r.tsmName || "").trim().toLowerCase();
        const matchName = myName && rTsm && (rTsm.includes(myName) || myName.includes(rTsm));
        return matchId || matchName;
      });
    } else if (isRsmUser) {
      const myName = (currentUser?.name || "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      list = list.filter(r => {
        const matchId = myId && r.rsmId === myId;
        const rRsm = (r.rsmName || "").trim().toLowerCase();
        const matchName = myName && rRsm && (rRsm.includes(myName) || myName.includes(rRsm));
        return matchId || matchName;
      });
    } else if (isCrmUser) {
      const myName = (currentUser?.name || "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      list = list.filter(r => {
        const matchId = myId && r.crmId === myId;
        const rCrm = (r.crmName || "").trim().toLowerCase();
        const matchName = myName && rCrm && (rCrm.includes(myName) || myName.includes(rCrm));
        return matchId || matchName;
      });
    }

    return list;
  }, [partyPerformanceRows, isAsmUser, isTsmUser, isRsmUser, isCrmUser, currentUser]);

  // Filter Dropdown Options
  const crmList = useMemo(() => {
    return users.filter(u => u.role === "crm" && u.status === "active");
  }, [users]);

  const asmList = useMemo(() => {
    return users.filter(u => u.role === "asm" && u.status === "active");
  }, [users]);

  const tsmList = useMemo(() => {
    return users.filter(u => u.role === "tsm" && u.status === "active");
  }, [users]);

  // Filtered Rows based on Search and Selected Dropdowns
  const filteredRows = useMemo(() => {
    return roleScopedRows.filter(row => {
      // 1. Search Query (Party Name, City, Phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.partyName.toLowerCase().includes(q);
        const matchCity = row.city.toLowerCase().includes(q);
        const matchState = row.state.toLowerCase().includes(q);
        const matchContact = row.contactPerson.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchState && !matchContact) return false;
      }

      // 2. CRM Filter
      if (selectedCrmFilter !== "all") {
        if (row.crmId !== selectedCrmFilter && !row.crmName.toLowerCase().includes(selectedCrmFilter.toLowerCase())) {
          return false;
        }
      }

      // 3. ASM Filter
      if (selectedAsmFilter !== "all") {
        if (row.asmId !== selectedAsmFilter && !row.asmName.toLowerCase().includes(selectedAsmFilter.toLowerCase())) {
          return false;
        }
      }

      // 4. TSM Filter
      if (selectedTsmFilter !== "all") {
        if (row.tsmId !== selectedTsmFilter && !row.tsmName.toLowerCase().includes(selectedTsmFilter.toLowerCase())) {
          return false;
        }
      }

      // 5. Target Status Filter
      if (targetStatusFilter === "achieved" && !row.isTargetAchieved) return false;
      if (targetStatusFilter === "in_progress" && (row.isTargetAchieved || row.totalDispatched === 0)) return false;
      if (targetStatusFilter === "zero" && row.totalDispatched > 0) return false;

      return true;
    });
  }, [roleScopedRows, searchQuery, selectedCrmFilter, selectedAsmFilter, selectedTsmFilter, targetStatusFilter]);

  // Sorted Rows
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let res = 0;
      if (sortField === "totalDispatched") {
        res = a.totalDispatched - b.totalDispatched;
      } else if (sortField === "partyName") {
        res = a.partyName.localeCompare(b.partyName);
      } else if (sortField === "crmName") {
        res = a.crmName.localeCompare(b.crmName);
      } else if (sortField === "asmName") {
        res = a.asmName.localeCompare(b.asmName);
      } else {
        res = a.partyName.localeCompare(b.partyName);
      }
      return sortOrder === "desc" ? -res : res;
    });
    return list;
  }, [filteredRows, sortField, sortOrder]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Grand Totals across filtered rows (Month-wise and Grand Total)
  const totals = useMemo(() => {
    const monthTotals = {};
    schemeMonths.forEach(m => {
      monthTotals[m.key] = 0;
    });
    let grandTotal = 0;
    let qualifyingParties = 0;

    filteredRows.forEach(r => {
      schemeMonths.forEach(m => {
        monthTotals[m.key] += (r.monthValues[m.key] || 0);
      });
      grandTotal += r.totalDispatched;
      if (r.isTargetAchieved) qualifyingParties++;
    });

    return {
      monthTotals,
      grandTotal,
      qualifyingParties,
      activePartyCount: filteredRows.filter(r => r.totalDispatched > 0).length,
      totalParties: filteredRows.length
    };
  }, [filteredRows, schemeMonths]);

  // Handle Open Create Scheme Modal
  const handleOpenCreateScheme = () => {
    setEditingScheme(null);
    setFormName("");
    setFormTitle("");
    setFormSchemeType("qty_dispatch");
    setFormDescription("");
    setFormStartDate("2026-06-01");
    setFormEndDate("2026-09-30");
    setFormTargetQty(10000);
    setFormGiftReward("Goa Trip (3N/4D All Expenses Paid)");
    setFormStatus("active");
    setFormTiers([
      { targetQty: 7500, giftTitle: "Single Person Package", description: "3N/4D Deluxe Stay" },
      { targetQty: 15000, giftTitle: "Couple Premium Package", description: "3N/4D 5-Star + Flights for 2" }
    ]);
    setShowSchemeConfigModal(true);
  };

  // Handle Open Edit Scheme Modal
  const handleOpenEditScheme = (scheme) => {
    setEditingScheme(scheme);
    setFormName(scheme.name || "");
    setFormTitle(scheme.title || scheme.name || "");
    setFormSchemeType(scheme.schemeType || "qty_dispatch");
    setFormDescription(scheme.description || "");
    setFormStartDate(scheme.startDate || "2026-06-01");
    setFormEndDate(scheme.endDate || "2026-09-30");
    setFormTargetQty(scheme.targetQty || 0);
    setFormGiftReward(scheme.giftReward || "");
    setFormStatus(scheme.status || "active");
    setFormTiers(Array.isArray(scheme.tiers) ? scheme.tiers : []);
    setShowSchemeConfigModal(true);
  };

  // Save Scheme Submit
  const handleSaveSchemeSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      showErrorToast("Please enter a Scheme Name.");
      return;
    }

    startLoading("Saving Scheme...", "Updating scheme configuration...", 40);
    try {
      const schemePayload = {
        id: editingScheme ? editingScheme.id : `scheme-${Date.now()}`,
        name: formName.trim(),
        title: formTitle.trim() || formName.trim(),
        schemeType: formSchemeType,
        description: formDescription.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        targetQty: parseInt(formTargetQty) || 0,
        giftReward: formGiftReward.trim(),
        status: formStatus,
        items: editingScheme ? (editingScheme.items || []) : [],
        tiers: formTiers
      };

      if (editingScheme && onUpdateScheme) {
        await onUpdateScheme(schemePayload);
        showSuccessToast(`🎉 Scheme "${formName}" updated successfully!`);
      } else if (onAddScheme) {
        await onAddScheme(schemePayload);
        showSuccessToast(`🎉 Scheme "${formName}" created successfully!`);
        setSelectedSchemeId(schemePayload.id);
      }
      finishLoading("Scheme saved successfully!");
      setShowSchemeConfigModal(false);
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to save scheme: " + err.message);
    }
  };

  // Handle Toggle Scheme Status (Live / Pause)
  const handleToggleSchemeStatus = async (scheme, targetStatus) => {
    if (!scheme) return;
    const currentIsLive = isSchemeLive(scheme);
    const newStatus = targetStatus || (currentIsLive ? "paused" : "active");
    const willBeLive = newStatus === "active" || newStatus === "live";

    startLoading(willBeLive ? "Activating Scheme..." : "Pausing Scheme...", `Setting "${scheme.name}" to ${willBeLive ? "LIVE" : "PAUSED"}...`, 40);
    try {
      const updatedScheme = {
        ...scheme,
        status: willBeLive ? "active" : "paused"
      };
      if (onUpdateScheme) {
        await onUpdateScheme(updatedScheme);
      }
      finishLoading(`Scheme is now ${willBeLive ? "LIVE" : "PAUSED"}!`);
      showSuccessToast(
        willBeLive
          ? `🟢 Scheme "${scheme.name}" is now LIVE! Visible across all sales & CRM portals.`
          : `⏸️ Scheme "${scheme.name}" is now PAUSED. Hidden from non-admin portals.`
      );
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to change scheme status: " + err.message);
    }
  };

  // Handle Delete Scheme
  const handleDeleteSchemeClick = async (scheme) => {
    if (!scheme) return;
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete scheme "${scheme.name}"?\nThis action cannot be undone.`)) return;
    
    startLoading("Deleting Scheme...", `Removing "${scheme.name}"...`, 50);
    try {
      if (onDeleteScheme) {
        await onDeleteScheme(scheme.id);
      }
      finishLoading("Scheme deleted!");
      showSuccessToast(`🗑️ Scheme "${scheme.name}" deleted successfully.`);
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to delete scheme: " + err.message);
    }
  };

  // Parse Bulk Items Text (Excel / TSV / CSV format from Image 1)
  const handleParseBulkItems = () => {
    if (!bulkRawText.trim()) {
      setBulkParsedItems([]);
      return;
    }

    const lines = bulkRawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];
    const seen = new Set();

    lines.forEach(line => {
      // Split by tab, comma, semicolon, or 2+ spaces
      let parts = line.split(/\t|,|;/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 1 && line.includes("  ")) {
        parts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
      }

      if (parts.length === 0) return;

      const rawItem = parts[0];
      // Skip header lines
      if (rawItem.toLowerCase() === "item name" || rawItem.toLowerCase() === "item" || rawItem.toLowerCase() === "model") {
        return;
      }

      const cleanItem = rawItem.replace(/["']/g, "").trim();
      if (!cleanItem) return;

      let start = parts[1] ? parseFlexibleDate(parts[1]) : bulkDefaultStartDate;
      let end = parts[2] ? parseFlexibleDate(parts[2]) : bulkDefaultEndDate;

      if (!start) start = bulkDefaultStartDate;
      if (!end) end = bulkDefaultEndDate;

      const normKey = cleanItem.toLowerCase();
      if (!seen.has(normKey)) {
        seen.add(normKey);
        parsed.push({
          itemName: cleanItem,
          startDate: start,
          endDate: end,
          targetQty: 0
        });
      }
    });

    setBulkParsedItems(parsed);
  };

  // Auto-parse when raw text or default dates change
  useEffect(() => {
    if (bulkImportMode === "paste" && bulkRawText.trim()) {
      handleParseBulkItems();
    }
  }, [bulkRawText, bulkDefaultStartDate, bulkDefaultEndDate, bulkImportMode]);

  // Commit Bulk Items to Active Scheme (Supports Append or Replace)
  const handleCommitBulkItems = async (replaceAll = false) => {
    if (!activeScheme) return;
    let itemsToCommit = [];

    if (bulkImportMode === "paste") {
      if (bulkParsedItems.length === 0) {
        showErrorToast("No valid items detected. Please paste item names with dates.");
        return;
      }
      itemsToCommit = bulkParsedItems;
    } else {
      if (selectedCatalogItems.length === 0) {
        showErrorToast("Please select at least one item from catalog.");
        return;
      }
      itemsToCommit = selectedCatalogItems.map(name => ({
        itemName: name,
        startDate: bulkDefaultStartDate,
        endDate: bulkDefaultEndDate,
        targetQty: 0
      }));
    }

    startLoading("Saving Scheme Items...", `${replaceAll ? "Replacing with" : "Adding"} ${itemsToCommit.length} products in ${activeScheme.name}...`, 50);
    try {
      if (onBulkAddSchemeItems) {
        await onBulkAddSchemeItems(activeScheme.id, itemsToCommit, replaceAll);
      } else if (onUpdateScheme) {
        let finalItems = replaceAll ? itemsToCommit : [...(activeScheme.items || [])];
        if (!replaceAll) {
          itemsToCommit.forEach(it => {
            const eIdx = finalItems.findIndex(x => (x.itemName || "").trim().toLowerCase() === it.itemName.toLowerCase());
            if (eIdx >= 0) finalItems[eIdx] = it;
            else finalItems.push(it);
          });
        }
        await onUpdateScheme({ ...activeScheme, items: finalItems });
      }
      finishLoading(`🎉 ${replaceAll ? "Replaced list with" : "Added"} ${itemsToCommit.length} items in ${activeScheme.name}!`);
      showSuccessToast(`🎉 ${itemsToCommit.length} items saved to ${activeScheme.name}!`);
      setShowBulkItemModal(false);
      setShowSchemeItemsDrawer(true);
      setBulkRawText("");
      setBulkParsedItems([]);
      setSelectedCatalogItems([]);
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to save items: " + err.message);
    }
  };

  // Remove single item from scheme
  const handleRemoveSchemeItem = async (itemName) => {
    if (!activeScheme) return;
    const cleanName = String(itemName).trim();
    if (!window.confirm(`Remove "${cleanName}" from scheme "${activeScheme.name}"?`)) return;

    try {
      if (onDeleteSchemeItem) {
        await onDeleteSchemeItem(activeScheme.id, cleanName);
      } else if (onUpdateScheme) {
        const remaining = (activeScheme.items || []).filter(i => (i.itemName || "").trim().toLowerCase() !== cleanName.toLowerCase());
        await onUpdateScheme({ ...activeScheme, items: remaining });
      }
      setSelectedItemsForDelete(prev => {
        const next = new Set(prev);
        next.delete(cleanName.toLowerCase());
        return next;
      });
      showSuccessToast(`Removed "${cleanName}" from ${activeScheme.name}.`);
    } catch (err) {
      showErrorToast("Failed to remove item: " + err.message);
    }
  };

  // Bulk remove multiple selected items from scheme
  const handleBulkRemoveSelectedItems = async () => {
    if (!activeScheme || selectedItemsForDelete.size === 0) return;
    const count = selectedItemsForDelete.size;
    if (!window.confirm(`Are you sure you want to remove ${count} selected product(s) from "${activeScheme.name}"?`)) return;

    const namesToRemove = Array.from(selectedItemsForDelete);
    const targetSet = new Set(namesToRemove.map(n => n.toLowerCase()));
    const remaining = (activeScheme.items || []).filter(i => !targetSet.has((i.itemName || "").trim().toLowerCase()));

    try {
      if (onBulkDeleteSchemeItems) {
        await onBulkDeleteSchemeItems(activeScheme.id, namesToRemove);
      } else if (onUpdateScheme) {
        await onUpdateScheme({ ...activeScheme, items: remaining });
      } else if (onDeleteSchemeItem) {
        for (const name of namesToRemove) {
          await onDeleteSchemeItem(activeScheme.id, name);
        }
      }
      setSelectedItemsForDelete(new Set());
      showSuccessToast(`Removed ${count} products from ${activeScheme.name}.`);
    } catch (err) {
      showErrorToast("Failed to remove items: " + err.message);
    }
  };

  // Export CSV Report (Matching Image 2 Format)
  const handleExportSchemeCsv = () => {
    if (!activeScheme || filteredRows.length === 0) return;

    const headers = ["SNO.", "CRM Name", "ASM", "TSM", "PARTY NAME", ...schemeMonths.map(m => m.label), "TOTAL DISPATCHED", "TARGET", "STATUS", "QUALIFYING GIFT"];
    const rows = filteredRows.map((r, idx) => [
      idx + 1,
      r.crmName,
      r.asmName,
      r.tsmName,
      r.partyName,
      ...schemeMonths.map(m => r.monthValues[m.key] || 0),
      r.totalDispatched,
      r.targetThreshold || 0,
      r.isTargetAchieved ? "QUALIFIED" : "IN PROGRESS",
      r.earnedGift || "—"
    ]);

    // Grand total row
    rows.push([
      "TOTAL",
      "—",
      "—",
      "—",
      `ALL PARTIES (${filteredRows.length})`,
      ...schemeMonths.map(m => totals.monthTotals[m.key] || 0),
      totals.grandTotal,
      "—",
      `${totals.qualifyingParties} Qualified`,
      "—"
    ]);

    const filename = `${activeScheme.name.toLowerCase().replace(/\s+/g, "_")}_dispatch_report_${new Date().toISOString().split("T")[0]}`;
    downloadCsv(headers, rows, filename);
    showSuccessToast(`Exported ${filteredRows.length} rows to ${filename}.csv!`);
  };

  return (
    <div className="scheme-studio-container card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* ==================== 1. TOP SCHEME SELECTOR TABS & ACTION BUTTONS ==================== */}
      <div className="glass-panel" style={{ padding: "18px 22px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        
        {/* Scheme Switcher Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "6px" }}>
            <Award size={22} style={{ color: "#f59e0b" }} />
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)", letterSpacing: "0.2px" }}>
              Sales Schemes:
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {visibleSchemes.length === 0 ? (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", padding: "6px 12px" }}>
                {isSuperAdmin ? "No schemes configured." : "No active sales schemes at this moment."}
              </span>
            ) : (
              visibleSchemes.map(s => {
                const isSelected = s.id === selectedSchemeId;
                const isLive = isSchemeLive(s);
                const isGoa = s.id === "scheme-goa" || s.name.toLowerCase().includes("goa");
                const isNeckband = s.id === "scheme-neckband" || s.name.toLowerCase().includes("neckband");
                const is2Percent = s.id === "scheme-2percent" || s.name.toLowerCase().includes("2%");

                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSchemeId(s.id)}
                    className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      boxShadow: isSelected ? "0 4px 14px rgba(56, 189, 248, 0.25)" : "none",
                      border: isSelected ? "1px solid rgba(56, 189, 248, 0.6)" : "1px solid var(--border-glass)",
                      opacity: !isLive ? 0.75 : 1
                    }}
                  >
                    {isGoa ? "🏖️" : isNeckband ? "🎧" : is2Percent ? "📈" : "🎯"}
                    <span>{s.name}</span>
                    {isSuperAdmin && (
                      <span 
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: isLive ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)",
                          color: isLive ? "#10b981" : "#f59e0b",
                          border: isLive ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                          letterSpacing: "0.3px",
                          marginLeft: "2px"
                        }}
                      >
                        {isLive ? "LIVE" : "PAUSED"}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {isSuperAdmin && activeScheme && (
            <>
              {/* Quick Make Live / Pause Scheme Toggle */}
              {isSchemeLive(activeScheme) ? (
                <button
                  onClick={() => handleToggleSchemeStatus(activeScheme, "paused")}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.08)" }}
                  title="Pause this scheme (hidden from non-admin & CRM portals)"
                >
                  <Pause size={14} /> Pause Scheme
                </button>
              ) : (
                <button
                  onClick={() => handleToggleSchemeStatus(activeScheme, "active")}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#10b981", borderColor: "rgba(16, 185, 129, 0.5)", background: "rgba(16, 185, 129, 0.12)" }}
                  title="Make this scheme LIVE (visible everywhere)"
                >
                  <Play size={14} /> Make Live
                </button>
              )}

              {/* Quick Delete Scheme */}
              <button
                onClick={() => handleDeleteSchemeClick(activeScheme)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#f87171", borderColor: "rgba(248, 113, 113, 0.35)", background: "rgba(239, 68, 68, 0.06)" }}
                title="Permanently delete this scheme"
              >
                <Trash2 size={14} /> Delete
              </button>

              <button
                onClick={() => setShowBulkItemModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}
                title="Add multiple products at once with start and end dates"
              >
                <Plus size={15} /> Add Products (Bulk)
              </button>

              <button
                onClick={() => setShowSchemeItemsDrawer(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
              >
                <Package size={15} /> Scheme Items ({activeScheme?.items?.length || 0})
              </button>

              <button
                onClick={() => activeScheme && handleOpenEditScheme(activeScheme)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Edit2 size={14} /> Edit Scheme
              </button>
            </>
          )}

          {isSuperAdmin && (
            <button
              onClick={handleOpenCreateScheme}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              <Plus size={15} /> New Scheme
            </button>
          )}

          {activeScheme && (
            <button
              onClick={handleExportSchemeCsv}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ==================== 2. ACTIVE SCHEME INFO CARD & TOP MONTHLY TOTALS BANNER (IMAGE 2 FORMAT) ==================== */}
      {activeScheme ? (
        <div className="glass-panel" style={{ padding: "20px 24px", borderRadius: "16px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "18px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0, color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Gift size={24} /> {activeScheme.title || activeScheme.name}
                </h2>
                
                {/* Live / Paused Badge */}
                {isSchemeLive(activeScheme) ? (
                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.18)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.4)", textTransform: "uppercase", fontSize: "0.75rem", padding: "4px 10px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                    LIVE & ACTIVE
                  </span>
                ) : (
                  <span className="badge" style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.4)", textTransform: "uppercase", fontSize: "0.75rem", padding: "4px 10px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Pause size={12} /> PAUSED (Admin Only)
                  </span>
                )}

                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={13} /> {activeScheme.startDate} to {activeScheme.endDate}
                </span>
              </div>

              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "6px 0 0 0", maxWidth: "800px" }}>
                {activeScheme.description || "Incentive scheme configured for qualifying dealer network dispatches."}
              </p>
            </div>

            {/* Scheme Reward / Gift Badge */}
            {activeScheme.giftReward && (
              <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "10px 18px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                <Award size={28} style={{ color: "#f59e0b" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: 700, textTransform: "uppercase" }}>Primary Reward / Gift</div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>{activeScheme.giftReward}</div>
                  {activeScheme.targetQty > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Target: {activeScheme.targetQty.toLocaleString()} Pcs Dispatched</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==================== SPREADSHEET HEADER MONTH TOTALS BANNER (IMAGE 2 HEADER ROW) ==================== */}
          <div style={{ background: "rgba(15, 23, 42, 0.92)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", padding: "14px 20px", overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", minWidth: "750px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.2px" }}>{activeScheme.name}</span>
                <span style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600, letterSpacing: "0.2px" }}>• Dispatched Volume (Pcs)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                {schemeMonths.map(m => (
                  <div key={m.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{m.label}</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>
                      {(totals.monthTotals[m.key] || 0).toLocaleString()}
                    </div>
                  </div>
                ))}

                <div style={{ borderLeft: "2px solid rgba(255,255,255,0.15)", paddingLeft: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#10b981", textTransform: "uppercase" }}>TOTAL DISPATCHED</div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#10b981" }}>
                    {totals.grandTotal.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8" }}>Pcs</span>
                  </div>
                </div>

                <div style={{ borderLeft: "2px solid rgba(255,255,255,0.15)", paddingLeft: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>Qualifying Parties</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f59e0b" }}>
                    {totals.qualifyingParties} <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>/ {totals.activePartyCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ==================== 3. SEARCH & TERRITORY FILTERS ==================== */}
      <div className="glass-panel" style={{ padding: "16px 20px", borderRadius: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search by party name, city, contact person..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="form-control"
              style={{ paddingLeft: "40px", height: "38px", fontSize: "0.88rem" }}
            />
          </div>

          {/* CRM Filter */}
          {!isCrmUser && (
            <select
              value={selectedCrmFilter}
              onChange={e => { setSelectedCrmFilter(e.target.value); setCurrentPage(1); }}
              className="form-control"
              style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
            >
              <option value="all">All CRM Executives</option>
              {crmList.map(c => (
                <option key={c.id} value={c.id}>{c.name} (CRM)</option>
              ))}
            </select>
          )}

          {/* ASM Filter */}
          {!isAsmUser && (
            <select
              value={selectedAsmFilter}
              onChange={e => { setSelectedAsmFilter(e.target.value); setCurrentPage(1); }}
              className="form-control"
              style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
            >
              <option value="all">All ASMs</option>
              {asmList.map(a => (
                <option key={a.id} value={a.id}>{a.name} (ASM)</option>
              ))}
            </select>
          )}

          {/* TSM Filter */}
          {!isTsmUser && (
            <select
              value={selectedTsmFilter}
              onChange={e => { setSelectedTsmFilter(e.target.value); setCurrentPage(1); }}
              className="form-control"
              style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
            >
              <option value="all">All TSMs</option>
              {tsmList.map(t => (
                <option key={t.id} value={t.id}>{t.name} (TSM)</option>
              ))}
            </select>
          )}

          {/* Target Status Filter */}
          <select
            value={targetStatusFilter}
            onChange={e => { setTargetStatusFilter(e.target.value); setCurrentPage(1); }}
            className="form-control"
            style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
          >
            <option value="all">All Statuses ({roleScopedRows.length})</option>
            <option value="achieved">🏆 Target Achieved ({roleScopedRows.filter(r => r.isTargetAchieved).length})</option>
            <option value="in_progress">⏳ In Progress ({roleScopedRows.filter(r => !r.isTargetAchieved && r.totalDispatched > 0).length})</option>
            <option value="zero">Zero Dispatches ({roleScopedRows.filter(r => r.totalDispatched === 0).length})</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Showing <strong>{filteredRows.length}</strong> Parties
          </span>
        </div>
      </div>

      {/* ==================== 4. MAIN MONTH-WISE SCHEME REPORT TABLE (IMAGE 2 FORMAT) ==================== */}
      <div className="glass-panel" style={{ padding: "0", borderRadius: "16px", overflow: "hidden" }}>
        
        {sortedRows.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <Award size={42} style={{ marginBottom: "12px", opacity: 0.5, color: "#f59e0b" }} />
            <h3 style={{ fontSize: "1.2rem", color: "var(--text-main)", marginBottom: "6px" }}>No Party Dispatches Found for this Scheme</h3>
            <p style={{ fontSize: "0.88rem", maxWidth: "520px", margin: "0 auto" }}>
              No dispatches matching the scheme items and date ranges were found with the current filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: "1000px", margin: 0 }}>
              <thead>
                <tr style={{ background: "rgba(245, 158, 11, 0.15)", borderBottom: "2px solid rgba(245, 158, 11, 0.4)" }}>
                  <th style={{ width: "50px", textAlign: "center", fontWeight: 800, color: "#f59e0b" }}>SNO.</th>
                  <th style={{ width: "120px", fontWeight: 800, color: "#f59e0b" }}>CRM Name</th>
                  <th style={{ width: "130px", fontWeight: 800, color: "#f59e0b" }}>ASM</th>
                  <th style={{ width: "140px", fontWeight: 800, color: "#f59e0b" }}>TSM</th>
                  <th style={{ minWidth: "220px", fontWeight: 800, color: "#f59e0b" }}>PARTY NAME</th>
                  
                  {/* Dynamic Month Columns */}
                  {schemeMonths.map(m => (
                    <th key={m.key} style={{ width: "100px", textAlign: "right", fontWeight: 800, color: "#f59e0b" }}>
                      {m.label}
                    </th>
                  ))}

                  <th style={{ width: "150px", textAlign: "right", fontWeight: 900, color: "#10b981", background: "rgba(16, 185, 129, 0.12)" }}>
                    TOTAL DISPATCHED
                  </th>
                  <th style={{ width: "180px", textAlign: "center", fontWeight: 800, color: "#f59e0b" }}>
                    Target & Reward Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedRows.map((row, idx) => {
                  const absoluteSno = (currentPage - 1) * pageSize + idx + 1;
                  const hasDispatches = row.totalDispatched > 0;

                  return (
                    <tr 
                      key={row.partyId}
                      style={{ 
                        background: row.isTargetAchieved ? "rgba(16, 185, 129, 0.05)" : undefined,
                        cursor: hasDispatches ? "pointer" : "default"
                      }}
                      onClick={() => hasDispatches && setSelectedPartyDrilldown(row)}
                      title={hasDispatches ? "Click to inspect item-by-item dispatch vouchers" : ""}
                    >
                      {/* 1. SNO */}
                      <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {absoluteSno}
                      </td>

                      {/* 2. CRM Name */}
                      <td style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.88rem" }}>
                        {row.crmName || "—"}
                      </td>

                      {/* 3. ASM */}
                      <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                        {row.asmName || "—"}
                      </td>

                      {/* 4. TSM */}
                      <td style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.85rem", textTransform: "uppercase" }}>
                        {row.tsmName || "—"}
                      </td>

                      {/* 5. PARTY NAME */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700, color: row.isTargetAchieved ? "#10b981" : "var(--primary)", fontSize: "0.92rem" }}>
                            {row.partyName}
                          </span>
                          {(row.city || row.state) && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {[row.city, row.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Dynamic Month Columns */}
                      {schemeMonths.map(m => {
                        const val = row.monthValues[m.key] || 0;
                        return (
                          <td key={m.key} style={{ textAlign: "right", fontWeight: val > 0 ? 700 : 400, color: val > 0 ? "var(--text-main)" : "var(--text-muted)", fontSize: "0.9rem" }}>
                            {val > 0 ? val.toLocaleString() : "0"}
                          </td>
                        );
                      })}

                      {/* 7. TOTAL DISPATCHED */}
                      <td style={{ textAlign: "right", fontWeight: 800, fontSize: "0.95rem", color: row.totalDispatched > 0 ? "#10b981" : "var(--text-muted)", background: "rgba(16, 185, 129, 0.04)" }}>
                        {row.totalDispatched.toLocaleString()}
                      </td>

                      {/* 8. Target & Gift Status */}
                      <td style={{ textAlign: "center" }}>
                        {row.isTargetAchieved ? (
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", padding: "4px 8px" }}>
                              <CheckCircle2 size={12} /> {row.earnedGift || "Target Qualified"}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 700 }}>
                              {row.progressPct}% ({row.totalDispatched.toLocaleString()} / {row.targetThreshold.toLocaleString()})
                            </span>
                          </div>
                        ) : row.totalDispatched > 0 && row.targetThreshold > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: "100%", maxWidth: "140px", margin: "0 auto" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              <span>{row.progressPct}%</span>
                              <span>{row.totalDispatched.toLocaleString()} / {row.targetThreshold.toLocaleString()}</span>
                            </div>
                            <div style={{ width: "100%", height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "99px", overflow: "hidden" }}>
                              <div style={{ width: `${row.progressPct}%`, height: "100%", background: "#38bdf8", borderRadius: "99px" }}></div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* GRAND TOTAL SUMMARY ROW (IMAGE 2 BOTTOM TOTAL) */}
                <tr style={{ background: "rgba(15, 23, 42, 0.95)", borderTop: "2px solid rgba(245, 158, 11, 0.5)", fontWeight: 900 }}>
                  <td colSpan={5} style={{ textAlign: "right", color: "#f59e0b", fontSize: "0.95rem", padding: "14px 18px", letterSpacing: "0.5px" }}>
                    TOTAL DISPATCHED VOLUME ({filteredRows.length} Parties):
                  </td>
                  {schemeMonths.map(m => (
                    <td key={m.key} style={{ textAlign: "right", color: "#38bdf8", fontSize: "1.05rem", fontWeight: 900 }}>
                      {(totals.monthTotals[m.key] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td style={{ textAlign: "right", color: "#10b981", fontSize: "1.15rem", fontWeight: 900, background: "rgba(16, 185, 129, 0.15)" }}>
                    {totals.grandTotal.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center", color: "#f59e0b", fontSize: "0.85rem", fontWeight: 800 }}>
                    {totals.qualifyingParties} Qualified
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {sortedRows.length > pageSize && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-glass)" }}>
            <Pagination
              currentPage={currentPage}
              totalItems={sortedRows.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ==================== 5. MODAL: BULK ADD SCHEME ITEMS (IMAGE 1 SPECIFICATION) ==================== */}
      {showBulkItemModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkItemModal(false)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "750px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileSpreadsheet size={22} /> Bulk Add Items to {activeScheme?.name}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Paste rows directly from Excel / Google Sheets with <strong>Item Name | Start Date | End Date</strong> format.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkItemModal(false)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Mode Switcher */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setBulkImportMode("paste")}
                  className={`btn btn-sm ${bulkImportMode === "paste" ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                >
                  📋 Paste Spreadsheet Data
                </button>
                <button
                  onClick={() => setBulkImportMode("select")}
                  className={`btn btn-sm ${bulkImportMode === "select" ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                >
                  📦 Pick from Catalog ({items.length})
                </button>
              </div>

              {/* Default Dates Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", background: "rgba(255,255,255,0.02)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border-glass)" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Default Start Date</label>
                  <input
                    type="date"
                    value={bulkDefaultStartDate}
                    onChange={e => setBulkDefaultStartDate(e.target.value)}
                    className="form-control"
                    style={{ height: "36px", fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Default End Date</label>
                  <input
                    type="date"
                    value={bulkDefaultEndDate}
                    onChange={e => setBulkDefaultEndDate(e.target.value)}
                    className="form-control"
                    style={{ height: "36px", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {/* PASTE MODE (IMAGE 1 SPEC) */}
              {bulkImportMode === "paste" ? (
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px", display: "block" }}>
                    Paste Items & Dates (Copy columns from Excel):
                  </label>
                  <textarea
                    rows={6}
                    value={bulkRawText}
                    onChange={e => setBulkRawText(e.target.value)}
                    placeholder={`DC24\t6/1/2026\t9/30/2026\nDC25\t6/1/2026\t9/30/2026\nCH65\t7/1/2026\t9/30/2026\nBT220\t7/1/2026\t9/30/2026`}
                    className="form-control"
                    style={{ fontFamily: "monospace", fontSize: "0.85rem", padding: "12px", width: "100%" }}
                  />

                  {/* Sample Copy Button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkRawText(`DC24\t6/1/2026\t9/30/2026\nDC25\t6/1/2026\t9/30/2026\nDC26\t6/1/2026\t9/30/2026\nDC27\t6/1/2026\t9/30/2026\nDC28\t6/1/2026\t9/30/2026\nDC29\t6/1/2026\t9/30/2026\nCH65\t7/1/2026\t9/30/2026\nCH53\t7/1/2026\t9/30/2026\nCH60\t7/1/2026\t9/30/2026\nCH106\t7/1/2026\t9/30/2026\nBT220\t7/1/2026\t9/30/2026\nBT311\t7/1/2026\t9/30/2026\nBT405\t7/1/2026\t9/30/2026\nBT320\t7/1/2026\t9/30/2026\nBT300\t7/1/2026\t9/30/2026`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Load Sample Goa Scheme Items (From Screenshot)
                    </button>

                    <span style={{ fontSize: "0.82rem", color: bulkParsedItems.length > 0 ? "#10b981" : "var(--text-muted)", fontWeight: 700 }}>
                      {bulkParsedItems.length} Products Parsed
                    </span>
                  </div>

                  {/* Parsed Preview Table */}
                  {bulkParsedItems.length > 0 && (
                    <div style={{ marginTop: "14px", maxHeight: "220px", overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px" }}>
                      <table className="table" style={{ width: "100%", margin: 0, fontSize: "0.83rem" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                            <th>Item Name</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th style={{ width: "40px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkParsedItems.map((it, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, color: "#38bdf8" }}>{it.itemName}</td>
                              <td>{it.startDate}</td>
                              <td>{it.endDate}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => setBulkParsedItems(prev => prev.filter((_, i) => i !== idx))}
                                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "2px" }}
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* CATALOG MULTI-SELECT MODE */
                <div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input
                      type="text"
                      placeholder="Search item catalog..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="form-control"
                      style={{ height: "36px", fontSize: "0.85rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const allNames = items.map(i => i.name).filter(Boolean);
                        setSelectedCatalogItems(allNames);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogItems([])}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Clear
                    </button>
                  </div>

                  <div style={{ maxHeight: "250px", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", border: "1px solid var(--border-glass)", padding: "12px", borderRadius: "10px" }}>
                    {items.filter(i => !catalogSearch || (i.name || "").toLowerCase().includes(catalogSearch.toLowerCase())).map(item => {
                      const isChecked = selectedCatalogItems.includes(item.name);
                      return (
                        <label 
                          key={item.id} 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "8px", 
                            padding: "6px 10px", 
                            borderRadius: "6px", 
                            background: isChecked ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.02)",
                            cursor: "pointer",
                            fontSize: "0.82rem",
                            border: isChecked ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedCatalogItems(prev => 
                                isChecked ? prev.filter(x => x !== item.name) : [...prev, item.name]
                              );
                            }}
                          />
                          <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? "#38bdf8" : "var(--text-main)" }}>
                            {item.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px", borderTop: "1px solid var(--border-glass)" }}>
              <button className="btn btn-secondary" onClick={() => setShowBulkItemModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCommitBulkItems}
                disabled={bulkImportMode === "paste" ? bulkParsedItems.length === 0 : selectedCatalogItems.length === 0}
                style={{ fontWeight: 700 }}
              >
                Add Items to {activeScheme?.name} ({bulkImportMode === "paste" ? bulkParsedItems.length : selectedCatalogItems.length})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== 6. MODAL: SCHEME DESIGNER & CREATOR ==================== */}
      {showSchemeConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowSchemeConfigModal(false)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "680px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
              <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                <Award size={22} /> {editingScheme ? `Edit "${editingScheme.name}"` : "Create New Sales Scheme"}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSchemeConfigModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveSchemeSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
              <div className="modal-body" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Scheme Short Name * (e.g. Goa Scheme)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Goa Scheme, Neckband Scheme"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Full Display Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Goa Trip Incentive Scheme"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Scheme Type
                    </label>
                    <select
                      value={formSchemeType}
                      onChange={e => setFormSchemeType(e.target.value)}
                      className="form-control"
                      style={{ height: "38px", fontSize: "0.85rem" }}
                    >
                      <option value="qty_dispatch">Dispatched Quantity (Pcs)</option>
                      <option value="percentage">Percentage Turnover (%)</option>
                      <option value="target_gift">Target & Gift Reward</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={e => setFormEndDate(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Target Dispatch Quantity (Pcs)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 10000"
                      value={formTargetQty}
                      onChange={e => setFormTargetQty(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                      Gift / Reward in Return
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Goa Trip (3N/4D All Expenses Paid)"
                      value={formGiftReward}
                      onChange={e => setFormGiftReward(e.target.value)}
                      className="form-control"
                      style={{ height: "38px" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                    Scheme Description & Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe eligibility, dispatch terms, and reward rules..."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="form-control"
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>

                {/* Status / Visibility Selection */}
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px", display: "block" }}>
                    Scheme Status & Visibility *
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <label style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                      borderRadius: "10px", border: (formStatus === "active" || formStatus === "live") ? "1.5px solid #10b981" : "1px solid var(--border-glass)",
                      background: (formStatus === "active" || formStatus === "live") ? "rgba(16, 185, 129, 0.12)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer"
                    }}>
                      <input
                        type="radio"
                        name="modalSchemeStatus"
                        value="active"
                        checked={formStatus === "active" || formStatus === "live"}
                        onChange={() => setFormStatus("active")}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.86rem", display: "flex", alignItems: "center", gap: "5px" }}>
                          🟢 LIVE (Active)
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Visible everywhere in CRM & sales portals
                        </div>
                      </div>
                    </label>

                    <label style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                      borderRadius: "10px", border: (formStatus === "paused" || formStatus === "inactive") ? "1.5px solid #f59e0b" : "1px solid var(--border-glass)",
                      background: (formStatus === "paused" || formStatus === "inactive") ? "rgba(245, 158, 11, 0.12)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer"
                    }}>
                      <input
                        type="radio"
                        name="modalSchemeStatus"
                        value="paused"
                        checked={formStatus === "paused" || formStatus === "inactive"}
                        onChange={() => setFormStatus("paused")}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: "0.86rem", display: "flex", alignItems: "center", gap: "5px" }}>
                          ⏸️ PAUSED
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Hidden from non-admin & CRM portals
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Milestone Gift Tiers */}
                <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                      Milestone Gift Tiers (Optional):
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormTiers(prev => [...prev, { targetQty: 5000, giftTitle: "New Gift Reward", description: "" }])}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Plus size={12} /> Add Tier
                    </button>
                  </div>

                  {formTiers.map((tier, tIdx) => (
                    <div key={tIdx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      <input
                        type="number"
                        placeholder="Target Qty"
                        value={tier.targetQty}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setFormTiers(prev => prev.map((t, i) => i === tIdx ? { ...t, targetQty: val } : t));
                        }}
                        className="form-control"
                        style={{ width: "130px", height: "34px", fontSize: "0.82rem" }}
                      />
                      <input
                        type="text"
                        placeholder="Gift Title (e.g. 5-Star Couple Package)"
                        value={tier.giftTitle}
                        onChange={e => {
                          const val = e.target.value;
                          setFormTiers(prev => prev.map((t, i) => i === tIdx ? { ...t, giftTitle: val } : t));
                        }}
                        className="form-control"
                        style={{ flex: 1, height: "34px", fontSize: "0.82rem" }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormTiers(prev => prev.filter((_, i) => i !== tIdx))}
                        className="btn btn-secondary btn-sm"
                        style={{ color: "#f87171", padding: "6px 10px" }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderTop: "1px solid var(--border-glass)" }}>
                {editingScheme && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSchemeConfigModal(false);
                      handleDeleteSchemeClick(editingScheme);
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Trash2 size={14} /> Delete Scheme
                  </button>
                )}

                <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSchemeConfigModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                    {editingScheme ? "Save Changes" : "Create Scheme"}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ==================== 7. DRAWER / MODAL: SCHEME ITEMS LIST & MANAGEMENT ==================== */}
      {showSchemeItemsDrawer && activeScheme && (
        <div className="modal-backdrop" onClick={() => setShowSchemeItemsDrawer(false)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "720px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Package size={20} /> Eligible Products in {activeScheme.name} ({activeScheme.items?.length || 0})
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Only dispatches of these items within their valid dates are counted toward scheme targets.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSchemeItemsDrawer(false)}><X size={18} /></button>
            </div>

            {/* Quick Multi-select Action Bar */}
            {activeScheme.items && activeScheme.items.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 24px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border-glass)", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "0.82rem", color: selectedItemsForDelete.size > 0 ? "#38bdf8" : "var(--text-muted)", fontWeight: selectedItemsForDelete.size > 0 ? 700 : 500 }}>
                    {selectedItemsForDelete.size > 0 ? `Selected ${selectedItemsForDelete.size} of ${activeScheme.items.length} items` : `${activeScheme.items.length} Products Configured`}
                  </span>
                  {selectedItemsForDelete.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedItemsForDelete(new Set())}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                    >
                      Deselect All
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {selectedItemsForDelete.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkRemoveSelectedItems}
                      className="btn btn-danger btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 700, padding: "4px 12px" }}
                    >
                      <Trash2 size={13} /> Delete Selected ({selectedItemsForDelete.size})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSchemeItemsDrawer(false);
                      setShowBulkItemModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.78rem", fontWeight: 700, padding: "4px 12px" }}
                  >
                    <Plus size={13} /> Paste / Add Products
                  </button>
                </div>
              </div>
            )}

            <div className="modal-body" style={{ padding: "16px 24px", overflowY: "auto" }}>
              {(!activeScheme.items || activeScheme.items.length === 0) ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Package size={42} style={{ marginBottom: "12px", opacity: 0.4, color: "#38bdf8" }} />
                  <h4 style={{ color: "var(--text-main)", marginBottom: "6px" }}>No items added to this scheme yet</h4>
                  <p style={{ fontSize: "0.85rem", marginBottom: "16px" }}>Paste product names directly from Excel or pick from your Item Catalog.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSchemeItemsDrawer(false);
                      setShowBulkItemModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                  >
                    <Plus size={14} /> Paste Products from Excel
                  </button>
                </div>
              ) : (
                <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                      <th style={{ width: "38px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={activeScheme.items.length > 0 && selectedItemsForDelete.size === activeScheme.items.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemsForDelete(new Set(activeScheme.items.map(i => (i.itemName || "").toLowerCase())));
                            } else {
                              setSelectedItemsForDelete(new Set());
                            }
                          }}
                          style={{ cursor: "pointer", width: "15px", height: "15px" }}
                          title="Select / Deselect All Items"
                        />
                      </th>
                      <th style={{ width: "45px" }}>SNO</th>
                      <th>Item Name</th>
                      <th>Valid From</th>
                      <th>Valid Till</th>
                      <th style={{ width: "50px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScheme.items.map((it, idx) => {
                      const isSelected = selectedItemsForDelete.has((it.itemName || "").toLowerCase());
                      return (
                        <tr key={idx} style={{ background: isSelected ? "rgba(56, 189, 248, 0.08)" : undefined }}>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const key = (it.itemName || "").toLowerCase();
                                setSelectedItemsForDelete(prev => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                              style={{ cursor: "pointer", width: "15px", height: "15px" }}
                            />
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                          <td style={{ fontWeight: 700, color: "#38bdf8" }}>{it.itemName}</td>
                          <td style={{ color: "var(--text-main)" }}>{it.startDate || activeScheme.startDate}</td>
                          <td style={{ color: "var(--text-main)" }}>{it.endDate || activeScheme.endDate}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveSchemeItem(it.itemName)}
                              style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", cursor: "pointer", padding: "4px 7px", borderRadius: "6px" }}
                              title={`Remove "${it.itemName}" from scheme`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid var(--border-glass)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowSchemeItemsDrawer(false);
                  setShowBulkItemModal(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
              >
                <Plus size={14} /> + Add More Items (Paste)
              </button>

              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSchemeItemsDrawer(false)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== 7b. MODAL: DIRECT EXCEL PASTE / ADD PRODUCTS (NO FILE UPLOAD NEEDED) ==================== */}
      {showBulkItemModal && activeScheme && (
        <div className="modal-backdrop" onClick={() => setShowBulkItemModal(false)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "760px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="badge badge-primary" style={{ fontWeight: 800 }}>
                    Direct Excel Paste Wizard
                  </span>
                  <span className="badge badge-secondary">{activeScheme.name}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={20} style={{ color: "var(--primary)" }} /> Add Products to {activeScheme.name}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Paste product names directly from Excel or Google Sheets (Ctrl+V) without needing a file.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkItemModal(false)}><X size={18} /></button>
            </div>

            {/* Mode Switcher: Direct Paste vs Item Catalog Picker */}
            <div style={{ display: "flex", padding: "0 24px", borderBottom: "1px solid var(--border-glass)", background: "rgba(255,255,255,0.02)" }}>
              <button
                type="button"
                onClick={() => setBulkImportMode("paste")}
                style={{
                  padding: "10px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: bulkImportMode === "paste" ? "2px solid #38bdf8" : "2px solid transparent",
                  color: bulkImportMode === "paste" ? "#38bdf8" : "var(--text-muted)",
                  fontWeight: bulkImportMode === "paste" ? 800 : 600,
                  fontSize: "0.86rem",
                  cursor: "pointer"
                }}
              >
                📋 Paste from Excel / Google Sheets
              </button>
              <button
                type="button"
                onClick={() => setBulkImportMode("select")}
                style={{
                  padding: "10px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: bulkImportMode === "select" ? "2px solid #38bdf8" : "2px solid transparent",
                  color: bulkImportMode === "select" ? "#38bdf8" : "var(--text-muted)",
                  fontWeight: bulkImportMode === "select" ? 800 : 600,
                  fontSize: "0.86rem",
                  cursor: "pointer"
                }}
              >
                🔍 Pick from Item Catalog (FG)
              </button>
            </div>

            <div className="modal-body" style={{ padding: "18px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Default Scheme Dates Config */}
              <div style={{ background: "rgba(56, 189, 248, 0.06)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "10px", padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                    Default Valid From Date
                  </label>
                  <input
                    type="date"
                    value={bulkDefaultStartDate}
                    onChange={e => setBulkDefaultStartDate(e.target.value)}
                    className="form-control"
                    style={{ height: "34px", fontSize: "0.84rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px", display: "block" }}>
                    Default Valid Till Date
                  </label>
                  <input
                    type="date"
                    value={bulkDefaultEndDate}
                    onChange={e => setBulkDefaultEndDate(e.target.value)}
                    className="form-control"
                    style={{ height: "34px", fontSize: "0.84rem" }}
                  />
                </div>
              </div>

              {bulkImportMode === "paste" ? (
                <>
                  <div>
                    <label style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Paste Excel Cells or Text (Ctrl+V):</span>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Supports Item Names or 3-column table</span>
                    </label>
                    <textarea
                      rows={6}
                      placeholder={`Paste items directly from Excel or Sheets...\nExamples:\nDC25\nDC26\nDC27\nCH65\t2026-07-01\t2026-09-30\nBT220\t2026-07-01\t2026-09-30`}
                      value={bulkRawText}
                      onChange={e => setBulkRawText(e.target.value)}
                      className="form-control"
                      style={{ fontSize: "0.84rem", fontFamily: "monospace", lineHeight: 1.4, width: "100%" }}
                    />
                  </div>

                  {/* Parsed Preview Table */}
                  {bulkParsedItems.length > 0 && (
                    <div style={{ border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "12px 14px", background: "rgba(16, 185, 129, 0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10b981" }}>
                          ✅ Detected {bulkParsedItems.length} Products to Import:
                        </span>
                        <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          Duplicates auto-merged
                        </span>
                      </div>

                      <div style={{ maxHeight: "180px", overflowY: "auto", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                        <table className="table" style={{ width: "100%", fontSize: "0.8rem", margin: 0 }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                              <th style={{ width: "40px" }}>#</th>
                              <th>Item Name</th>
                              <th>Valid From</th>
                              <th>Valid Till</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkParsedItems.map((p, pIdx) => (
                              <tr key={pIdx}>
                                <td style={{ color: "var(--text-muted)" }}>{pIdx + 1}</td>
                                <td style={{ fontWeight: 700, color: "#38bdf8" }}>{p.itemName}</td>
                                <td>{p.startDate}</td>
                                <td>{p.endDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Mode: Pick from FG Catalog */
                <div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        placeholder="Search Finished Goods (FG) catalog..."
                        value={catalogSearch}
                        onChange={e => setCatalogSearch(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: "36px", height: "36px", fontSize: "0.84rem" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const fgItems = (items || []).filter(i => {
                          const t = (i.itemType || i.type || "").toUpperCase();
                          return t === "FG" || t.includes("FG") || t.includes("FINISHED");
                        }).map(i => i.name || i.model).filter(Boolean);
                        setSelectedCatalogItems(fgItems);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.76rem", whiteSpace: "nowrap" }}
                    >
                      Select All FG
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogItems([])}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.76rem", whiteSpace: "nowrap" }}
                    >
                      Clear
                    </button>
                  </div>

                  <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "10px" }}>
                    {(() => {
                      const filtered = (items || []).filter(i => {
                        const t = (i.itemType || i.type || "").toUpperCase();
                        const isFg = t === "FG" || t.includes("FG") || t.includes("FINISHED") || !t;
                        if (!isFg) return false;
                        const q = catalogSearch.toLowerCase().trim();
                        if (!q) return true;
                        return (i.name || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q) || (i.id || "").toLowerCase().includes(q);
                      });

                      if (filtered.length === 0) {
                        return <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No matching catalog items found.</div>;
                      }

                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px" }}>
                          {filtered.map((it, idx) => {
                            const name = it.name || it.model || it.id;
                            const isChecked = selectedCatalogItems.includes(name);
                            return (
                              <label key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: isChecked ? "rgba(56, 189, 248, 0.12)" : "rgba(255,255,255,0.03)", borderRadius: "6px", border: isChecked ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid var(--border-glass)", cursor: "pointer", fontSize: "0.82rem" }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedCatalogItems(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
                                  }}
                                />
                                <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? "#38bdf8" : "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "6px" }}>
                    Selected {selectedCatalogItems.length} products from catalog
                  </div>
                </div>
              )}

            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid var(--border-glass)", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowBulkItemModal(false);
                  setShowSchemeItemsDrawer(true);
                }}
              >
                Back to Item List
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => handleCommitBulkItems(false)}
                  disabled={bulkImportMode === "paste" ? bulkParsedItems.length === 0 : selectedCatalogItems.length === 0}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <Plus size={14} /> + Add / Append ({bulkImportMode === "paste" ? bulkParsedItems.length : selectedCatalogItems.length}) Items
                </button>

                {bulkImportMode === "paste" && bulkParsedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Replace all existing items in "${activeScheme.name}" with these ${bulkParsedItems.length} newly pasted products?`)) {
                        handleCommitBulkItems(true);
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 700, borderColor: "rgba(245, 158, 11, 0.4)", color: "#f59e0b" }}
                    title="Replace current product list with newly pasted items"
                  >
                    🔄 Replace Entire List ({bulkParsedItems.length})
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== 8. MODAL: PARTY DRILLDOWN DISPATCH DETAILS ==================== */}
      {selectedPartyDrilldown && (
        <div className="modal-backdrop" onClick={() => setSelectedPartyDrilldown(null)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "750px", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building2 size={20} /> {selectedPartyDrilldown.partyName}
                </h3>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  CRM: {selectedPartyDrilldown.crmName} • ASM: {selectedPartyDrilldown.asmName} • TSM: {selectedPartyDrilldown.tsmName}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPartyDrilldown(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: "18px 24px", overflowY: "auto" }}>
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "10px", padding: "12px 18px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>Total Scheme Dispatches</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#10b981" }}>
                    {selectedPartyDrilldown.totalDispatched.toLocaleString()} Pcs
                  </div>
                </div>
                {selectedPartyDrilldown.isTargetAchieved && (
                  <div className="badge badge-success" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                    🏆 {selectedPartyDrilldown.earnedGift || "Target Qualified"}
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-main)" }}>
                Item-Wise Scheme Dispatches ({selectedPartyDrilldown.dispatches?.length || 0} Records):
              </h4>

              <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                    <th>Date</th>
                    <th>Product Model</th>
                    <th style={{ textAlign: "right" }}>Dispatched Qty (Pcs)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPartyDrilldown.dispatches.map((d, dIdx) => (
                    <tr key={dIdx}>
                      <td style={{ color: "var(--text-muted)" }}>{d.dispatchDate || "—"}</td>
                      <td style={{ fontWeight: 700, color: "#38bdf8" }}>{d.itemModel}</td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#10b981" }}>
                        {d.dispatchedQty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ padding: "12px 24px", borderTop: "1px solid var(--border-glass)", textAlign: "right" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPartyDrilldown(null)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
