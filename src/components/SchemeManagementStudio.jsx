import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { 
  Award, Gift, Target, Calendar, Plus, Edit2, Trash2, Search, Filter, 
  Download, Upload, CheckCircle2, ChevronRight, X, Layers, AlertCircle, 
  ArrowUpDown, Check, Building2, User, Users, Sparkles, FileSpreadsheet,
  Info, ExternalLink, RefreshCw, BarChart2, Shield, TrendingUp, Package
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
  onDeleteSchemeItem
}) {
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();

  const isSuperAdmin = currentUser?.role === "superadmin" || currentUser?.role === "owner" || isAdmin;
  const isCrmUser = currentUser?.role === "crm";
  const isAsmUser = currentUser?.role === "asm";
  const isTsmUser = currentUser?.role === "tsm";
  const isRsmUser = currentUser?.role === "rsm";

  // Selected Active Scheme ID (default to Goa Scheme or first active scheme)
  const [selectedSchemeId, setSelectedSchemeId] = useState(() => {
    const goa = (schemes || []).find(s => s.id === "scheme-goa" || s.name.toLowerCase().includes("goa"));
    if (goa) return goa.id;
    return schemes[0]?.id || "scheme-goa";
  });

  // Ensure selectedSchemeId stays valid if schemes change
  useEffect(() => {
    if (schemes.length > 0 && !schemes.some(s => s.id === selectedSchemeId)) {
      setSelectedSchemeId(schemes[0].id);
    }
  }, [schemes, selectedSchemeId]);

  const activeScheme = useMemo(() => {
    return (schemes || []).find(s => s.id === selectedSchemeId) || schemes[0] || null;
  }, [schemes, selectedSchemeId]);

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

  // Handle Delete Scheme
  const handleDeleteSchemeClick = async (scheme) => {
    if (!window.confirm(`Are you sure you want to delete scheme "${scheme.name}"?`)) return;
    try {
      if (onDeleteScheme) {
        await onDeleteScheme(scheme.id);
        showSuccessToast(`Scheme "${scheme.name}" deleted.`);
      }
    } catch (err) {
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

  // Commit Bulk Items to Active Scheme
  const handleCommitBulkItems = async () => {
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

    startLoading("Adding Scheme Items...", `Adding ${itemsToCommit.length} products to ${activeScheme.name}...`, 50);
    try {
      if (onBulkAddSchemeItems) {
        await onBulkAddSchemeItems(activeScheme.id, itemsToCommit, false);
      }
      finishLoading(`🎉 Added ${itemsToCommit.length} items to ${activeScheme.name}!`);
      showSuccessToast(`🎉 ${itemsToCommit.length} items added to ${activeScheme.name}!`);
      setShowBulkItemModal(false);
      setBulkRawText("");
      setBulkParsedItems([]);
      setSelectedCatalogItems([]);
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to add items: " + err.message);
    }
  };

  // Remove single item from scheme
  const handleRemoveSchemeItem = async (itemName) => {
    if (!activeScheme) return;
    try {
      if (onDeleteSchemeItem) {
        await onDeleteSchemeItem(activeScheme.id, itemName);
        showSuccessToast(`Removed ${itemName} from ${activeScheme.name}.`);
      }
    } catch (err) {
      showErrorToast("Failed to remove item: " + err.message);
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
            {schemes.map(s => {
              const isSelected = s.id === selectedSchemeId;
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
                    border: isSelected ? "1px solid rgba(56, 189, 248, 0.6)" : "1px solid var(--border-glass)"
                  }}
                >
                  {isGoa ? "🏖️" : isNeckband ? "🎧" : is2Percent ? "📈" : "🎯"}
                  <span>{s.name}</span>
                  {s.status === "active" && (
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Action Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <>
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

              <button
                onClick={handleOpenCreateScheme}
                className="btn btn-primary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
              >
                <Plus size={15} /> New Scheme
              </button>
            </>
          )}

          <button
            onClick={handleExportSchemeCsv}
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ==================== 2. ACTIVE SCHEME INFO CARD & TOP MONTHLY TOTALS BANNER (IMAGE 2 FORMAT) ==================== */}
      {activeScheme && (
        <div className="glass-panel" style={{ padding: "20px 24px", borderRadius: "16px", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "18px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0, color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Gift size={24} /> {activeScheme.title || activeScheme.name}
                </h2>
                <span className="badge badge-success" style={{ textTransform: "uppercase", fontSize: "0.75rem", padding: "4px 10px" }}>
                  {activeScheme.status}
                </span>
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
          <div style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid var(--border-glass)", borderRadius: "12px", padding: "14px 20px", overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", minWidth: "750px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8" }}>{activeScheme.name}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>• Dispatched Volume (Pcs)</span>
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
                    {totals.grandTotal.toLocaleString()} <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Pcs</span>
                  </div>
                </div>

                <div style={{ borderLeft: "2px solid rgba(255,255,255,0.15)", paddingLeft: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>Qualifying Parties</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f59e0b" }}>
                    {totals.qualifyingParties} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>/ {totals.activePartyCount}</span>
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

      {/* ==================== 7. DRAWER: SCHEME ITEMS LIST & MANAGEMENT ==================== */}
      {showSchemeItemsDrawer && activeScheme && (
        <div className="modal-backdrop" onClick={() => setShowSchemeItemsDrawer(false)}>
          <div className="modal-dialog glass-panel card-fade-in" style={{ maxWidth: "650px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid var(--border-glass)" }}>
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

            <div className="modal-body" style={{ padding: "18px 24px", overflowY: "auto" }}>
              {(!activeScheme.items || activeScheme.items.length === 0) ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Package size={36} style={{ marginBottom: "10px", opacity: 0.5 }} />
                  <h4>No items added to this scheme yet</h4>
                  <p style={{ fontSize: "0.85rem" }}>Click "Add Products (Bulk)" to add items from Excel or Catalog.</p>
                </div>
              ) : (
                <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                      <th>SNO</th>
                      <th>Item Name</th>
                      <th>Valid From</th>
                      <th>Valid Till</th>
                      <th style={{ width: "40px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScheme.items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{it.itemName}</td>
                        <td>{it.startDate || activeScheme.startDate}</td>
                        <td>{it.endDate || activeScheme.endDate}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleRemoveSchemeItem(it.itemName)}
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "4px" }}
                            title="Remove item from scheme"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid var(--border-glass)" }}>
              <button
                onClick={() => {
                  setShowSchemeItemsDrawer(false);
                  setShowBulkItemModal(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
              >
                <Plus size={14} /> Add More Items
              </button>

              <button className="btn btn-secondary btn-sm" onClick={() => setShowSchemeItemsDrawer(false)}>
                Close
              </button>
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
