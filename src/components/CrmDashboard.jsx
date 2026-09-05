import React, { useState, useMemo, useEffect } from "react";
import { 
  Users, Building2, TrendingUp, Truck, Package, Plus, Search, Filter, 
  Download, Eye, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, 
  Phone, Mail, MapPin, ChevronRight, ArrowUpDown, UserPlus, UserCheck, 
  Shield, Calendar, FileText, BarChart2, RefreshCw, Layers, DollarSign,
  X, Check, ExternalLink, Share2, Briefcase, User, Send, Lock, MessageSquare
} from "lucide-react";
import Pagination from "./Pagination";
import { useLoading } from "../context/LoadingContext";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";
import { downloadCsv } from "../utils/formatters";

// Helper to normalize and match party names across all formats and sub-components
export const normParty = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const matchParty = (p1, p2, id1, id2) => {
  if (id1 && id2 && id1 === id2) return true;
  if (!p1 || !p2) return false;
  const n1 = normParty(p1);
  const n2 = normParty(p2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
};

// Helper to normalize FG product categories consistently across CRM views and modals
export const normalizeCategory = (cat, itemDesc = "") => {
  const raw = `${cat || ""} ${itemDesc || ""}`.toLowerCase();
  if (raw.includes("polymer") || raw.includes("li-poly") || raw.includes("lithium poly") || raw.includes("pouch battery")) return "Polymer";
  if (raw.includes("fast charge") || raw.includes("adapter") || raw.includes("charger") || raw.includes("wall charge")) return "Fast Charger";
  if (raw.includes("cable") || raw.includes("usb") || raw.includes("type-c") || raw.includes("micro") || raw.includes("lightning")) return "Data Cable";
  if (raw.includes("neckband") || raw.includes("neck band") || raw.includes("nb-") || raw.includes("nb ")) return "Neckband";
  if (raw.includes("tws") || raw.includes("earbuds") || raw.includes("airpods") || raw.includes("ear buds") || raw.includes("buds")) return "TWS Earbuds";
  if (raw.includes("power bank") || raw.includes("powerbank") || raw.includes("pb-") || raw.includes("pb ")) return "Power Bank";
  if (raw.includes("earphone") || raw.includes("headphone") || raw.includes("handsfree") || raw.includes("ear phone")) return "Earphones";
  if (raw.includes("battery") || raw.includes("batteries") || raw.includes("cell") || raw.includes("bf3") || raw.includes("b-f3") || raw.includes("bm4") || raw.includes("bn4") || raw.includes("bl-") || raw.includes("blp") || raw.includes("li-ion")) return "Batteries";
  if (raw.includes("speaker") || raw.includes("soundbar") || raw.includes("audio")) return "Speaker";
  if (raw.includes("watch") || raw.includes("smartwatch") || raw.includes("smart watch") || raw.includes("band")) return "Smart Watch";
  if (raw.includes("car charge") || raw.includes("car")) return "Car Charger";
  if (cat && cat.trim() && cat !== "General" && cat !== "Unspecified" && !cat.toLowerCase().includes("raw")) return cat.trim();
  return "Mobile Accessories";
};

export default function CrmDashboard({
  currentUser,
  users = [],
  crmParties = [],
  crmSalesOrders = [],
  crmDispatches = [],
  crmPartyRemarks = [],
  partyCategoryMonthlySales = [],
  partyCategoryMonths = [],
  imsTransactions = [],
  items = [],
  itemPrices = [],
  loading = false,
  initialLoadComplete = true,
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onBulkDeleteParties,
  onBatchUploadParties,
  onBatchAssignParties,
  onSavePartyRemark,
  onDeletePartyRemark,
  onAddSalesOrder,
  onUpdateSalesOrder,
  onDeleteSalesOrder,
  onAddDispatch,
  onDeleteDispatch,
  onAddUser,
  onUpdateUser,
  onLogout,
  onPullModuleData,
  loadingModules = {},
  recordSectionVisit,
  currentUserId
}) {
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();
  // Determine if user is superadmin or owner
  const isElevated = currentUser?.role === "superadmin" || currentUser?.role === "owner" || currentUser?.designation?.toLowerCase() === "system admin" || currentUser?.designation?.toLowerCase() === "owner";
  const isAdminOrOwner = isElevated;

  // Available CRM Executives
  const crmExecutives = useMemo(() => {
    const list = users.filter(u => u.role === "crm" && u.status === "active");
    if (list.length === 0) {
      return [
        { id: "u-ankita", name: "Ankita", email: "ankita@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-ajit", name: "Ajit", email: "ajit@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-prince", name: "Prince", email: "prince@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-simran", name: "Simran", email: "simran@makpowerindia.com", role: "crm", designation: "CRM Executive" },
        { id: "u-harish", name: "Harish", email: "harish@makpowerindia.com", role: "crm", designation: "CRM Executive" }
      ];
    }
    return list;
  }, [users]);

  // Selected Executive (for Admin/Owner switching or defaults to current logged in CRM)
  const [selectedExecutiveId, setSelectedExecutiveId] = useState(() => {
    if (currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm") {
      return currentUser.id;
    }
    return "all"; // "all" | specific CRM id
  });

  const activeExecutive = useMemo(() => {
    if (selectedExecutiveId === "all") return null;
    return crmExecutives.find(c => c.id === selectedExecutiveId) || users.find(u => u.id === selectedExecutiveId) || currentUser;
  }, [selectedExecutiveId, crmExecutives, users, currentUser]);

  const canViewFinancials = currentUser?.role === "superadmin" || currentUser?.role === "owner";
  const isAsmUser = currentUser?.role === "asm";
  const isTsmUser = currentUser?.role === "tsm";
  const isAsmOrTsm = isAsmUser || isTsmUser;
  const isCrmUser = currentUser?.role === "crm";

  // Navigation Tabs: "parties" | "team" | "salesreport" | "dispatchreport" | "orders"
  const [activeTab, setActiveTab] = useState("parties");
  const [globalStartDate, setGlobalStartDate] = useState("");
  const [globalEndDate, setGlobalEndDate] = useState("");

  const handleCrmTabSwitch = (tab) => {
    setActiveTab(tab);
    let modKey = null;
    if (tab === "parties") modKey = "crmParties";
    else if (tab === "orders" || tab === "salesreport") modKey = "crmSalesOrders";
    else if (tab === "dispatchreport") modKey = "crmDispatches";

    if (modKey) {
      const uId = currentUserId || currentUser?.id;
      if (recordSectionVisit && uId) {
        recordSectionVisit(uId, modKey);
      }
      if (onPullModuleData) {
        onPullModuleData(modKey);
      }
    }
  };

  useEffect(() => {
    if (onPullModuleData && crmParties.length === 0) {
      onPullModuleData("crmParties");
    }
    const uId = currentUserId || currentUser?.id;
    if (recordSectionVisit && uId) {
      recordSectionVisit(uId, "crmParties");
    }
  }, []);

  // Unified Dispatches combining crmDispatches + IMS party stock movements
  const allUnifiedDispatches = useMemo(() => {
    const list = [...crmDispatches];
    const existingIds = new Set(crmDispatches.map(d => d.id));
    (imsTransactions || []).forEach(tx => {
      if (tx.partyName && tx.partyName.trim() && (tx.movementType === "OUT" || !tx.movementType)) {
        if (!existingIds.has(tx.id)) {
          list.push({
            id: tx.id,
            dispatchDate: tx.date || "",
            partyId: tx.partyId || "",
            partyName: tx.partyName.trim(),
            itemModel: tx.itemName || "Item",
            dispatchedQty: Math.abs(parseInt(tx.stockQty) || 0),
            transporterName: tx.location || tx.source || "Warehouse Dispatch",
            docketNo: tx.remarks || "",
            invoiceNo: `IMS-${tx.id.slice(0, 8)}`,
            status: "Delivered"
          });
        }
      }
    });
    return list;
  }, [crmDispatches, imsTransactions]);

  const allUnifiedSalesOrders = crmSalesOrders;

  // Filtered Parties based on selected executive (deduplicated: keep last party name)
  const currentParties = useMemo(() => {
    const seen = new Set();
    const cleanListReversed = [];
    const sourceParties = crmParties || [];
    for (let i = sourceParties.length - 1; i >= 0; i--) {
      const p = sourceParties[i];
      if (!p || !p.name) continue;
      const cleanName = (p.name || "").trim();
      const norm = cleanName.toLowerCase();
      if (!norm) continue;
      if (!seen.has(norm)) {
        seen.add(norm);
        cleanListReversed.push({
          ...p,
          id: cleanName,
          name: cleanName
        });
      }
    }
    const cleanParties = cleanListReversed.reverse();

    if (isAsmUser) {
      const myName = (currentUser?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      return cleanParties.filter(p => {
        const matchId = myId && (p.assignedAsmId === myId);
        const pAsm = (p.assignedAsmName || "").trim().toLowerCase();
        const matchName = myName && pAsm && (pAsm.includes(myName) || myName.includes(pAsm));
        return matchId || matchName;
      });
    }
    if (isTsmUser) {
      const myName = (currentUser?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      return cleanParties.filter(p => {
        const matchId = myId && (p.assignedTsmId === myId);
        const pTsm = (p.assignedTsmName || "").trim().toLowerCase();
        const matchName = myName && pTsm && (pTsm.includes(myName) || myName.includes(pTsm));
        return matchId || matchName;
      });
    }
    if (isCrmUser) {
      const myName = (currentUser?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      const myId = currentUser?.id || "";
      return cleanParties.filter(p => {
        const matchId = myId && (p.assignedCrmId === myId);
        const pCrm = (p.assignedCrmName || "").trim().toLowerCase();
        const matchName = myName && pCrm && (pCrm.includes(myName) || myName.includes(pCrm));
        return matchId || matchName;
      });
    }
    if (selectedExecutiveId === "all") return cleanParties;
    const execName = (activeExecutive?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
    return cleanParties.filter(p => {
      const matchId = p.assignedCrmId === selectedExecutiveId || p.assignedAsmId === selectedExecutiveId || p.assignedTsmId === selectedExecutiveId;
      const pCrm = (p.assignedCrmName || "").trim().toLowerCase();
      const pAsm = (p.assignedAsmName || "").trim().toLowerCase();
      const pTsm = (p.assignedTsmName || "").trim().toLowerCase();
      const matchName = execName && (
        (pCrm && (pCrm.includes(execName) || execName.includes(pCrm))) ||
        (pAsm && (pAsm.includes(execName) || execName.includes(pAsm))) ||
        (pTsm && (pTsm.includes(execName) || execName.includes(pTsm)))
      );
      return matchId || matchName;
    });
  }, [crmParties, selectedExecutiveId, activeExecutive, isAsmOrTsm, isCrmUser, currentUser]);

  // Filtered Sales Orders (matched by executive ID or party name/ID, and global dates)
  const currentSalesOrders = useMemo(() => {
    let list = allUnifiedSalesOrders;
    if (isCrmUser || isAsmOrTsm) {
      const partyIdSet = new Set(currentParties.map(p => p.id));
      const partyNameSet = new Set(currentParties.map(p => (p.name || "").trim().toLowerCase()));
      list = list.filter(so => partyIdSet.has(so.partyId) || partyNameSet.has((so.partyName || "").trim().toLowerCase()));
    } else if (selectedExecutiveId !== "all") {
      const execName = (activeExecutive?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      list = list.filter(so => {
        if (so.assignedCrmId === selectedExecutiveId || so.assignedAsmId === selectedExecutiveId || so.assignedTsmId === selectedExecutiveId) return true;
        if (currentParties.some(p => matchParty(p.name, so.partyName, p.id, so.partyId))) return true;
        const soAsm = (so.assignedAsmName || "").trim().toLowerCase();
        const soTsm = (so.assignedTsmName || "").trim().toLowerCase();
        if (execName && (soAsm.includes(execName) || soTsm.includes(execName))) return true;
        return false;
      });
    }
    if (globalStartDate || globalEndDate) {
      list = list.filter(so => isDateInBetween(so.orderDate, globalStartDate, globalEndDate));
    }
    return list;
  }, [allUnifiedSalesOrders, selectedExecutiveId, currentParties, globalStartDate, globalEndDate, isAsmOrTsm, isCrmUser, activeExecutive]);

  // Filtered Dispatches (matched by executive ID or party name/ID, and global dates)
  const currentDispatches = useMemo(() => {
    let list = allUnifiedDispatches;
    if (isCrmUser || isAsmOrTsm) {
      const partyIdSet = new Set(currentParties.map(p => p.id));
      const partyNameSet = new Set(currentParties.map(p => (p.name || "").trim().toLowerCase()));
      list = list.filter(d => partyIdSet.has(d.partyId) || partyNameSet.has((d.partyName || "").trim().toLowerCase()));
    } else if (selectedExecutiveId !== "all") {
      const execName = (activeExecutive?.name || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      list = list.filter(d => {
        if (d.assignedCrmId === selectedExecutiveId || d.assignedAsmId === selectedExecutiveId || d.assignedTsmId === selectedExecutiveId) return true;
        if (currentParties.some(p => matchParty(p.name, d.partyName, p.id, d.partyId))) return true;
        const dAsm = (d.assignedAsmName || "").trim().toLowerCase();
        const dTsm = (d.assignedTsmName || "").trim().toLowerCase();
        if (execName && (dAsm.includes(execName) || dTsm.includes(execName))) return true;
        return false;
      });
    }
    if (globalStartDate || globalEndDate) {
      list = list.filter(d => isDateInBetween(d.dispatchDate, globalStartDate, globalEndDate));
    }
    return list;
  }, [allUnifiedDispatches, selectedExecutiveId, currentParties, globalStartDate, globalEndDate, isAsmOrTsm, isCrmUser, activeExecutive]);

  // Resolve effective parent CRM ID for an ASM/TSM user (handles Ashutosh -> Ankita default)
  const getEffectiveParentCrmId = (u) => {
    if (!u) return "";
    if (u.parentCrmId) return u.parentCrmId;
    const n = (u.name || "").toLowerCase();
    const em = (u.email || "").toLowerCase();
    if (n.includes("ashutosh") || em.includes("ashutosh")) return "u-ankita";
    return "";
  };

  // ASMs and TSMs under this executive or all (only active and non-deleted accounts)
  const teamMembers = useMemo(() => {
    return users.filter(u => {
      if (u.role !== "asm" && u.role !== "tsm") return false;
      if (u.status === "inactive" || u.status === "deleted") return false;
      if (["u-asm-vikram", "u-asm-rohit", "u-tsm-manoj", "u-tsm-suresh"].includes(u.id)) return false;
      
      const parentId = getEffectiveParentCrmId(u);

      // If logged in as CRM user: strictly show ONLY ASMs/TSMs owned by this CRM!
      if (isCrmUser) {
        return parentId === currentUser?.id;
      }

      // If logged in as ASM or TSM: only see their own account
      if (isAsmOrTsm) {
        return u.id === currentUser?.id;
      }

      // If Admin or Owner:
      if (isAdminOrOwner) {
        if (selectedExecutiveId === "all") return true;
        return parentId === selectedExecutiveId || u.id === selectedExecutiveId;
      }

      if (selectedExecutiveId && selectedExecutiveId !== "all") {
        return parentId === selectedExecutiveId || u.id === selectedExecutiveId;
      }
      return false;
    });
  }, [users, selectedExecutiveId, isCrmUser, currentUser, isAdminOrOwner, isAsmOrTsm]);

  // ASM and TSM lists for party creation / assignment & filtering
  const asmList = useMemo(() => {
    return users.filter(u => {
      if (u.role !== "asm" || u.status !== "active") return false;
      if (["u-asm-vikram", "u-asm-rohit"].includes(u.id)) return false;
      const parentId = getEffectiveParentCrmId(u);

      if (isCrmUser) {
        return parentId === currentUser?.id;
      }
      if (isAsmOrTsm) {
        return u.id === currentUser?.id;
      }
      if (isAdminOrOwner && selectedExecutiveId !== "all") {
        return parentId === selectedExecutiveId;
      }
      return true;
    });
  }, [users, isCrmUser, currentUser, isAsmOrTsm, isAdminOrOwner, selectedExecutiveId]);

  const tsmList = useMemo(() => {
    return users.filter(u => {
      if (u.role !== "tsm" || u.status !== "active") return false;
      if (["u-tsm-manoj", "u-tsm-suresh"].includes(u.id)) return false;
      const parentId = getEffectiveParentCrmId(u);

      if (isCrmUser) {
        return parentId === currentUser?.id;
      }
      if (isAsmOrTsm) {
        return u.id === currentUser?.id;
      }
      if (isAdminOrOwner && selectedExecutiveId !== "all") {
        return parentId === selectedExecutiveId;
      }
      return true;
    });
  }, [users, isCrmUser, currentUser, isAsmOrTsm, isAdminOrOwner, selectedExecutiveId]);

  // Helpers to strictly resolve active ASM and TSM names (never show deleted/dummy staff)
  const getActiveAsmName = (party) => {
    if (!party) return null;
    const pId = party.assignedAsmId;
    const pName = (party.assignedAsmName || "").trim().toLowerCase();
    if (!pId && !pName) return null;
    if (["u-asm-vikram", "u-asm-rohit"].includes(pId) || pName.includes("vikram") || pName.includes("rohit")) return null;
    const match = users.find(u => 
      (u.id === pId || (pName && (u.name || "").trim().toLowerCase() === pName)) &&
      u.status !== "inactive" && u.status !== "deleted" &&
      !["u-asm-vikram", "u-asm-rohit"].includes(u.id)
    );
    return match ? (match.name || party.assignedAsmName) : null;
  };

  const getActiveTsmName = (party) => {
    if (!party) return null;
    const pId = party.assignedTsmId;
    const pName = (party.assignedTsmName || "").trim().toLowerCase();
    if (!pId && !pName) return null;
    if (["u-tsm-manoj", "u-tsm-suresh"].includes(pId) || pName.includes("manoj") || pName.includes("suresh")) return null;
    const match = users.find(u => 
      (u.id === pId || (pName && (u.name || "").trim().toLowerCase() === pName)) &&
      u.status !== "inactive" && u.status !== "deleted" &&
      !["u-tsm-manoj", "u-tsm-suresh"].includes(u.id)
    );
    return match ? (match.name || party.assignedTsmName) : null;
  };

  // KPI Metrics Calculation
  const totalPartiesCount = currentParties.length;
  const activePartiesCount = currentParties.filter(p => p.status === "Active").length;
  const totalSalesRevenue = currentSalesOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);
  const totalOrderedUnits = currentSalesOrders.reduce((acc, o) => acc + (parseInt(o.orderQty) || 0), 0);
  const totalDispatchedUnits = currentDispatches.reduce((acc, d) => acc + (parseInt(d.dispatchedQty) || 0), 0);
  const pendingDispatchUnits = Math.max(0, totalOrderedUnits - totalDispatchedUnits);
  const fulfillmentRate = totalOrderedUnits > 0 ? ((totalDispatchedUnits / totalOrderedUnits) * 100).toFixed(1) : 0;

  // Search & Filter State for Parties
  const [partySearch, setPartySearch] = useState("");
  const [partyStateFilter, setPartyStateFilter] = useState("all");
  const [partyAsmFilter, setPartyAsmFilter] = useState("all");
  const [partyTsmFilter, setPartyTsmFilter] = useState("all");

  // Party Modals State
  const [selectedPartyFor360, setSelectedPartyFor360] = useState(null);
  const [selectedPartyForCategoryStudio, setSelectedPartyForCategoryStudio] = useState(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  // Sales Team Modal State
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [assigningTeamMember, setAssigningTeamMember] = useState(null);
  const [trackingAsmMember, setTrackingAsmMember] = useState(null);
  const [transferringAsmMember, setTransferringAsmMember] = useState(null);

  // Order & Dispatch Modal State
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showRecordDispatchModal, setShowRecordDispatchModal] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null);

  // Report & Table Filters
  const [salesReportCategory, setSalesReportCategory] = useState("all");
  const [salesReportStartDate, setSalesReportStartDate] = useState("");
  const [salesReportEndDate, setSalesReportEndDate] = useState("");

  const [dispatchStatusFilter, setDispatchStatusFilter] = useState("all");
  const [dispatchStartDate, setDispatchStartDate] = useState("");
  const [dispatchEndDate, setDispatchEndDate] = useState("");

  // Dynamic Multi-Search Criteria for Dispatches Report
  const [dispatchSearchFilters, setDispatchSearchFilters] = useState([
    { id: "filter-1", field: "all", value: "" }
  ]);
  const [dispatchMatchMode, setDispatchMatchMode] = useState("all"); // "all" (AND) | "any" (OR)

  const handleAddDispatchSearchFilter = () => {
    setDispatchSearchFilters(prev => [
      ...prev,
      { id: `filter-${Date.now()}-${Math.floor(Math.random() * 1000)}`, field: "all", value: "" }
    ]);
  };

  const handleUpdateDispatchSearchFilter = (id, key, val) => {
    setDispatchSearchFilters(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const handleRemoveDispatchSearchFilter = (id) => {
    setDispatchSearchFilters(prev => {
      if (prev.length <= 1) {
        return [{ id: `filter-${Date.now()}`, field: "all", value: "" }];
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleResetDispatchSearchFilters = () => {
    setDispatchSearchFilters([{ id: `filter-${Date.now()}`, field: "all", value: "" }]);
    setDispatchStatusFilter("all");
    setDispatchStartDate("");
    setDispatchEndDate("");
  };

  // Filtered Dispatches for Logistics Report (incorporating Multi-Search Filters)
  const filteredDispatchesReport = useMemo(() => {
    const activeFilters = dispatchSearchFilters.filter(f => (f.value || "").trim() !== "");

    return currentDispatches.filter(d => {
      if (dispatchStatusFilter !== "all" && d.status !== dispatchStatusFilter) return false;
      if (dispatchStartDate || dispatchEndDate) {
        if (!isDateInBetween(d.dispatchDate, dispatchStartDate, dispatchEndDate)) return false;
      }

      if (activeFilters.length === 0) return true;

      const checkFilter = (f) => {
        const term = f.value.trim().toLowerCase();
        if (!term) return true;

        if (f.field === "party") {
          return (d.partyName || "").toLowerCase().includes(term);
        } else if (f.field === "item") {
          return (d.itemModel || "").toLowerCase().includes(term);
        } else if (f.field === "invoice") {
          return (d.invoiceNo || "").toLowerCase().includes(term);
        } else if (f.field === "transporter") {
          return (d.transporterName || "").toLowerCase().includes(term);
        } else if (f.field === "docket") {
          return (d.docketNo || "").toLowerCase().includes(term);
        } else {
          const combined = [
            d.partyName,
            d.itemModel,
            d.invoiceNo,
            d.transporterName,
            d.docketNo,
            d.orderNo,
            d.status,
            d.dispatchDate
          ].filter(Boolean).join(" ").toLowerCase();
          return combined.includes(term);
        }
      };

      if (dispatchMatchMode === "any") {
        return activeFilters.some(checkFilter);
      } else {
        return activeFilters.every(checkFilter);
      }
    });
  }, [currentDispatches, dispatchStatusFilter, dispatchStartDate, dispatchEndDate, dispatchSearchFilters, dispatchMatchMode]);

  const [ordersStartDate, setOrdersStartDate] = useState("");
  const [ordersEndDate, setOrdersEndDate] = useState("");

  // Format INR currency
  const formatInr = (val) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);
  };

  // Filtered Parties Table Data
  const filteredParties = useMemo(() => {
    return currentParties.filter(p => {
      const matchSearch = !partySearch || 
        p.name?.toLowerCase().includes(partySearch.toLowerCase()) || 
        p.city?.toLowerCase().includes(partySearch.toLowerCase()) || 
        p.phone?.toLowerCase().includes(partySearch.toLowerCase()) ||
        p.contactPerson?.toLowerCase().includes(partySearch.toLowerCase()) ||
        p.gstin?.toLowerCase().includes(partySearch.toLowerCase());

      const matchState = partyStateFilter === "all" || p.state === partyStateFilter;
      const matchAsm = isAsmOrTsm || partyAsmFilter === "all" || p.assignedAsmId === partyAsmFilter;
      const matchTsm = isAsmOrTsm || partyTsmFilter === "all" || p.assignedTsmId === partyTsmFilter;

      return matchSearch && matchState && matchAsm && matchTsm;
    });
  }, [currentParties, partySearch, partyStateFilter, partyAsmFilter, partyTsmFilter, isAsmOrTsm]);

  // Parties Pagination State (Default 100 rows per page)
  const [partiesPage, setPartiesPage] = useState(1);
  const [partiesPerPage, setPartiesPerPage] = useState(50);

  useEffect(() => {
    setPartiesPage(1);
  }, [partySearch, partyStateFilter, partyAsmFilter, partyTsmFilter, selectedExecutiveId]);

  const paginatedParties = useMemo(() => {
    const start = (partiesPage - 1) * partiesPerPage;
    return filteredParties.slice(start, start + partiesPerPage);
  }, [filteredParties, partiesPage, partiesPerPage]);

  // Aggregated Item-Wise Sales Data
  const itemWiseSalesData = useMemo(() => {
    const itemMap = new Map();

    currentSalesOrders
      .filter(o => !salesReportStartDate && !salesReportEndDate ? true : isDateInBetween(o.orderDate, salesReportStartDate, salesReportEndDate))
      .forEach(o => {
        const key = o.itemModel || "Unspecified Model";
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            itemModel: key,
            category: o.category || "General",
            totalOrders: 0,
            totalQty: 0,
            totalRevenue: 0,
            dispatchedQty: 0,
            pendingQty: 0,
            partySet: new Set(),
            unitPrices: []
          });
        }
        const entry = itemMap.get(key);
        entry.totalOrders += 1;
        entry.totalQty += parseInt(o.orderQty || 0);
        entry.totalRevenue += parseFloat(o.totalInr || 0);
        entry.dispatchedQty += parseInt(o.dispatchedQty || 0);
        entry.pendingQty += Math.max(0, parseInt(o.orderQty || 0) - parseInt(o.dispatchedQty || 0));
        if (o.partyName) entry.partySet.add(o.partyName);
        if (o.unitPriceInr) entry.unitPrices.push(parseFloat(o.unitPriceInr));
      });

    return Array.from(itemMap.values()).map(item => ({
      ...item,
      avgPrice: item.unitPrices.length > 0 ? (item.unitPrices.reduce((a, b) => a + b, 0) / item.unitPrices.length).toFixed(0) : 0,
      partyCount: item.partySet.size,
      partyList: Array.from(item.partySet).join(", "),
      ratePercent: item.totalQty > 0 ? ((item.dispatchedQty / item.totalQty) * 100).toFixed(0) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [currentSalesOrders, salesReportStartDate, salesReportEndDate]);

  // Unique list of states
  const uniqueStates = useMemo(() => {
    return Array.from(new Set(crmParties.map(p => p.state).filter(Boolean)));
  }, [crmParties]);

  // Unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(currentSalesOrders.map(o => o.category).filter(Boolean)));
  }, [currentSalesOrders]);

  // Finished Goods (FG) Category filter logic
  const fgCategoryList = useMemo(() => {
    const set = new Set();
    items.forEach(it => {
      const type = (it.itemType || "").trim().toUpperCase();
      if (type === "FG" || (!type && it.category)) {
        if (it.category && it.category.trim()) {
          set.add(it.category.trim());
        }
      }
    });

    // Standard Makpower Finished Goods (FG) categories
    const standardFg = [
      "Fast Charger", "Data Cable", "Neckband", "TWS Earbuds", 
      "Polymer", "Power Bank", "Earphones", "Batteries", "Speaker", 
      "Smart Watch", "Car Charger", "Mobile Accessories"
    ];
    standardFg.forEach(c => set.add(c));
    return set;
  }, [items]);

  const normalizeFgCategory = (cat) => {
    if (!cat) return "";
    const clean = cat.trim();
    const lower = clean.toLowerCase();
    if (lower.includes("polymer") || lower.includes("li-poly") || lower.includes("lithium poly") || lower.includes("pouch battery")) {
      return "Polymer";
    }
    if (clean === "General" || clean === "Unspecified") return "";
    if (lower.includes("raw") || lower.includes("material") || lower.includes("pcb") || lower.includes("ic ") || lower.includes("packing") || lower.includes("box") || lower.includes("carton") || lower.includes("wire") || lower.includes("hardware") || lower.includes("connector")) {
      return "";
    }
    return clean;
  };

  const isFgCategory = (cat) => {
    if (!cat) return false;
    return !!normalizeFgCategory(cat);
  };

  // ==================== MONTH & CATEGORY MATRIX DATA + REMARKS ====================
  const [activeRemarkPartyCategory, setActiveRemarkPartyCategory] = useState(null);
  const [matrixMonthFilter, setMatrixMonthFilter] = useState("all");
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState("all");
  const [matrixPartySearch, setMatrixPartySearch] = useState("");
  const [matrixAsmFilter, setMatrixAsmFilter] = useState("all");

  const monthCategoryMatrixData = useMemo(() => {
    const map = new Map();

    currentSalesOrders.forEach(o => {
      const orderMonth = (o.orderDate || "").slice(0, 7) || "2026-08";
      
      let rawCat = o.category;
      if (!rawCat || rawCat === "General" || rawCat === "Unspecified") {
        const foundItem = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        rawCat = foundItem?.category || "";
      }

      const cat = normalizeFgCategory(rawCat);
      if (!cat) return;

      const pId = o.partyId || "unknown";
      const pName = o.partyName || "Unknown Party";

      const key = `${pId}___${cat}___${orderMonth}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: pId,
          partyName: pName,
          category: cat,
          month: orderMonth,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0,
          assignedAsmId: o.assignedAsmId || "",
          assignedTsmId: o.assignedTsmId || ""
        });
      }
      const cur = map.get(key);
      cur.totalOrderQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });

    // Also ensure parties with remarks in an FG category/month are represented
    (crmPartyRemarks || []).forEach(r => {
      if (!r.category || !isFgCategory(r.category)) return;

      const key = `${r.partyId}___${r.category}___${r.month}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: r.partyId,
          partyName: r.partyName,
          category: r.category,
          month: r.month,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0,
          assignedAsmId: "",
          assignedTsmId: ""
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month) || a.partyName.localeCompare(b.partyName));
  }, [currentSalesOrders, items, crmPartyRemarks, fgCategoryList]);

  const availableMatrixMonths = useMemo(() => {
    const set = new Set();
    monthCategoryMatrixData.forEach(r => { if (r.month && r.month !== "Unspecified") set.add(r.month); });
    return Array.from(set).sort().reverse();
  }, [monthCategoryMatrixData]);

  const availableMatrixCategories = useMemo(() => {
    const set = new Set();
    monthCategoryMatrixData.forEach(r => { if (r.category && isFgCategory(r.category)) set.add(r.category); });
    fgCategoryList.forEach(c => { if (isFgCategory(c)) set.add(c); });
    return Array.from(set).sort();
  }, [monthCategoryMatrixData, fgCategoryList]);

  const filteredMonthCategoryMatrix = useMemo(() => {
    return monthCategoryMatrixData.filter(row => {
      if (matrixMonthFilter !== "all" && row.month !== matrixMonthFilter) return false;
      if (matrixCategoryFilter !== "all" && row.category !== matrixCategoryFilter) return false;
      if (matrixAsmFilter !== "all") {
        const party = currentParties.find(p => p.id === row.partyId);
        const matchAsm = row.assignedAsmId === matrixAsmFilter || row.assignedTsmId === matrixAsmFilter || (party && (party.assignedAsmId === matrixAsmFilter || party.assignedTsmId === matrixAsmFilter));
        if (!matchAsm) return false;
      }
      if (matrixPartySearch.trim()) {
        const q = matrixPartySearch.toLowerCase();
        const match = row.partyName.toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [monthCategoryMatrixData, matrixMonthFilter, matrixCategoryFilter, matrixAsmFilter, matrixPartySearch, currentParties]);

  // Export to CSV helper
  const exportCsv = (headers, rows, filename) => {
    const csvContent = "data:text/csv;charset=utf-8," + [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportItemSalesCsv = () => {
    const headers = ["Item Model", "Category", "Total Units Ordered", "Avg Unit Price (INR)", "Total Revenue (INR)", "Dispatched Units", "Pending Units", "Fulfillment Rate %", "Buying Parties"];
    const rows = itemWiseSalesData.map(i => [
      i.itemModel, i.category, i.totalQty, i.avgPrice, i.totalRevenue, i.dispatchedQty, i.pendingQty, `${i.ratePercent}%`, i.partyList
    ]);
    exportCsv(headers, rows, "makpower_itemwise_sales_report");
  };

  const handleExportDispatchesCsv = () => {
    const headers = ["Dispatch Date", "Invoice No", "Party Name", "Item Model", "Dispatched Qty", "Transporter", "Docket / LR No", "Status", "Assigned CRM"];
    const rows = filteredDispatchesReport.map(d => [
      d.dispatchDate, d.invoiceNo, d.partyName, d.itemModel, d.dispatchedQty, d.transporterName, d.docketNo, d.status, crmExecutives.find(c => c.id === d.assignedCrmId)?.name || d.assignedCrmId
    ]);
    exportCsv(headers, rows, "makpower_dispatch_qty_report");
  };

  const handleExportMonthlyCategoryCsv = () => {
    const headers = ["Party Name", "Category", "Month", "Total Ordered Qty", "Total Amount (INR)", "Order Bookings", "Remarks Count", "Latest Remark"];
    const rows = filteredMonthCategoryMatrix.map(row => {
      const remarks = (crmPartyRemarks || []).filter(r => r.partyId === row.partyId && r.category === row.category && r.month === row.month);
      const latest = remarks.length > 0 ? `[${remarks[0].authorName} (${remarks[0].authorRole})]: ${remarks[0].remark}` : "";
      return [
        row.partyName, row.category, row.month, row.totalOrderQty, row.totalRevenue, row.orderCount, remarks.length, latest
      ];
    });
    exportCsv(headers, rows, "makpower_monthly_category_remarks_report");
  };

  if ((!initialLoadComplete || loading) && crmParties.length === 0) {
    return (
      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "75vh", padding: "20px" }}>
        <div className="glass-panel card-fade-in" style={{ padding: "44px 36px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", maxWidth: "480px", width: "100%", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)", borderRadius: "20px", border: "1px solid var(--border-glass)" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", border: "4px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", animation: "spin 0.8s linear infinite" }}></div>
          <div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: "0 0 8px 0" }}>Loading data please wait!</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
              Connecting to database and synchronizing party portfolios, order bookings, and dispatches...
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "8px 16px", borderRadius: "20px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}></span>
            <span>Cloud Database Sync in progress...</span>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="crm-portal-container" style={{ flex: 1, padding: "24px", maxWidth: "1600px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* ==================== TOP CONTROLS & DATE FILTER ==================== */}
      <div style={{ display: "flex", justifyContent: isElevated ? "space-between" : "flex-end", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        {/* Executive Switcher Bar - Only Visible to Superadmin / Owner */}
        {isElevated && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-glass)" }}>
              <button
                onClick={() => setSelectedExecutiveId("all")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: selectedExecutiveId === "all" ? "linear-gradient(135deg, #0284c7, #38bdf8)" : "transparent",
                  color: selectedExecutiveId === "all" ? "#fff" : "var(--text-muted)",
                  fontWeight: selectedExecutiveId === "all" ? 700 : 500,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                🌐 All CRM (Company Overview)
              </button>
            </div>

            <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-glass)", flexWrap: "wrap" }}>
              {crmExecutives.map(exec => {
                const isSelected = selectedExecutiveId === exec.id;
                return (
                  <button
                    key={exec.id}
                    onClick={() => setSelectedExecutiveId(exec.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
                      color: isSelected ? "#fff" : "var(--text-muted)",
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: isSelected ? "0 2px 10px rgba(99, 102, 241, 0.4)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <User size={13} />
                    <span>{exec.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Global Date Filter */}
        <div className="crm-top-date-bar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginLeft: isElevated ? "0" : "auto" }}>
          <div className="date-filter-wrapper">
            <DateRangeFilter
              startDate={globalStartDate}
              endDate={globalEndDate}
              onStartDateChange={setGlobalStartDate}
              onEndDateChange={setGlobalEndDate}
              onClear={() => {
                setGlobalStartDate("");
                setGlobalEndDate("");
              }}
              placeholder="Filter by Date"
            />
          </div>
          <div className="date-btn-group" style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                setGlobalStartDate(firstDay);
                setGlobalEndDate(lastDay);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.78rem", padding: "6px 12px", fontWeight: 600 }}
            >
              This Month
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
                setGlobalStartDate(firstDay);
                setGlobalEndDate(lastDay);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.78rem", padding: "6px 12px", fontWeight: 600 }}
            >
              Last Month
            </button>
            {(globalStartDate || globalEndDate) && (
              <button
                onClick={() => {
                  setGlobalStartDate("");
                  setGlobalEndDate("");
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.78rem", padding: "6px 10px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================== TOP KPI SUMMARY CARDS ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
        
        {/* Card 1: Assigned Parties */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
            <Building2 size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Assigned Parties</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
              {totalPartiesCount} <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 600 }}>({activePartiesCount} Active)</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "2px" }}>Authorized Dealer Network</div>
          </div>
        </div>

        {/* Card 2: Sales Revenue (Admin/Owner only) or Total Orders (CRM) */}
        {canViewFinancials ? (
          <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
            <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
              <TrendingUp size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Sales Value</div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--success)" }}>
                {formatInr(totalSalesRevenue)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Across {currentSalesOrders.length} logged orders
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
            <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
              <FileText size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Orders Booked</div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--success)" }}>
                {currentSalesOrders.length} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Orders</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {totalOrderedUnits.toLocaleString()} Pcs total ordered
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Dispatched Qty & Fulfillment */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
            <Truck size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Dispatched Volume</div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
              {totalDispatchedUnits.toLocaleString()} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>/ {totalOrderedUnits.toLocaleString()} Pcs</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <div style={{ flex: 1, height: "6px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${fulfillmentRate}%`, height: "100%", background: "#f59e0b", borderRadius: "99px" }}></div>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b" }}>{fulfillmentRate}%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Sales Team Strength (Hidden for ASM / TSM) */}
        {!isAsmOrTsm && (
          <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", borderRadius: "14px" }}>
            <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.12)", color: "#a855f7" }}>
              <Users size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Field Sales Team</div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-main)" }}>
                {teamMembers.length} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Members</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#a855f7", marginTop: "2px" }}>
                {teamMembers.filter(t => t.role === "asm").length} ASMs • {teamMembers.filter(t => t.role === "tsm").length} TSMs
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ==================== TAB NAVIGATION BAR ==================== */}
      <div className="crm-tabs-bar" style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
        <button
          onClick={() => setActiveTab("parties")}
          className={`nav-tab-item ${activeTab === "parties" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Building2 size={16} /> <span>My Parties ({filteredParties.length})</span>
        </button>

        {!isAsmOrTsm && (
          <button
            onClick={() => setActiveTab("team")}
            className={`nav-tab-item ${activeTab === "team" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
          >
            <Users size={16} /> <span>Sales Team (ASM / TSM) ({teamMembers.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("monthly_category")}
          className={`nav-tab-item ${activeTab === "monthly_category" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 700, color: activeTab === "monthly_category" ? "#38bdf8" : undefined }}
        >
          <MessageSquare size={16} /> <span>Monthly Category & Remarks ({crmPartyRemarks.length})</span>
        </button>

        {canViewFinancials && (
          <button
            onClick={() => setActiveTab("salesreport")}
            className={`nav-tab-item ${activeTab === "salesreport" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
          >
            <BarChart2 size={16} /> <span>Item-Wise Sales Report</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("dispatchreport")}
          className={`nav-tab-item ${activeTab === "dispatchreport" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Truck size={16} /> <span>Dispatched Qty Report</span>
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`nav-tab-item ${activeTab === "orders" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <FileText size={16} /> <span>Orders & Bookings ({currentSalesOrders.length})</span>
        </button>
      </div>

      {/* ==================== TAB 1: MY PARTIES (DEALER NETWORK) ==================== */}
      {activeTab === "parties" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* Action & Filter Bar */}
          <div className="glass-panel" style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "300px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search party by name, city, phone, GSTIN..."
                  value={partySearch}
                  onChange={e => setPartySearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: "40px", height: "38px", fontSize: "0.88rem" }}
                />
              </div>

              {/* State Filter */}
              <select
                value={partyStateFilter}
                onChange={e => setPartyStateFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All States</option>
                {uniqueStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* ASM Filter */}
              <select
                value={partyAsmFilter}
                onChange={e => setPartyAsmFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All ASMs</option>
                {asmList.map(a => (
                  <option key={a.id} value={a.id}>{a.name} (ASM)</option>
                ))}
              </select>

              {/* TSM Filter */}
              <select
                value={partyTsmFilter}
                onChange={e => setPartyTsmFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "38px", fontSize: "0.85rem" }}
              >
                <option value="all">All TSMs</option>
                {tsmList.map(t => (
                  <option key={t.id} value={t.id}>{t.name} (TSM)</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {isAdminOrOwner && (
                <button 
                  onClick={() => {
                    const headers = ["Party Name", "Contact Person", "Phone", "Email", "City", "State", "GSTIN", "Assigned CRM", "Assigned ASM", "Assigned TSM", "Status"];
                    const rows = filteredParties.map(p => [
                      p.name, p.contactPerson, p.phone, p.email, p.city, p.state, p.gstin, p.assignedCrmName, p.assignedAsmName, p.assignedTsmName, p.status
                    ]);
                    exportCsv(headers, rows, "makpower_parties_list");
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={14} /> Export CSV
                </button>
              )}

              {isAdminOrOwner && (
                <button 
                  onClick={() => setShowAddPartyModal(true)} 
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <Plus size={14} /> Add New Party
                </button>
              )}
            </div>
          </div>

          {/* Parties Table & Mobile Cards */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            {filteredParties.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Building2 size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No parties found matching criteria</h4>
                <p style={{ fontSize: "0.85rem" }}>Click "Add New Party" to create and assign customer/dealer accounts.</p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-table-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                    <thead>
                      <tr>
                        <th>Party Name & Location</th>
                        <th>Contact Person</th>
                        <th>Assigned CRM / ASM / TSM</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedParties.map(party => {
                        return (
                          <tr key={party.id}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.95rem" }}>
                                  {party.name}
                                </span>
                                {([party.city, party.state].filter(Boolean).length > 0 || party.gstin) && (
                                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                                    {[party.city, party.state].filter(Boolean).length > 0 && (
                                      <>
                                        <MapPin size={12} /> {[party.city, party.state].filter(Boolean).join(", ")}
                                      </>
                                    )}
                                    {party.gstin && ` • GST: ${party.gstin}`}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <div style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
                                <span style={{ fontWeight: 600 }}>{party.contactPerson || "—"}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{party.phone || "—"}</span>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                <span className="badge" style={{ fontSize: "0.72rem", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "1px solid rgba(99, 102, 241, 0.3)", width: "fit-content" }}>
                                  CRM: {party.assignedCrmName || crmExecutives.find(c => c.id === party.assignedCrmId)?.name || "Unassigned"}
                                </span>
                                {getActiveAsmName(party) && (
                                  <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.12)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.3)", width: "fit-content" }}>
                                    ASM: {getActiveAsmName(party)}
                                  </span>
                                )}
                                {getActiveTsmName(party) && (
                                  <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(245, 158, 11, 0.12)", color: "#fcd34d", border: "1px solid rgba(245, 158, 11, 0.3)", width: "fit-content" }}>
                                    TSM: {getActiveTsmName(party)}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <span className={`badge ${party.status === "Active" ? "badge-success" : "badge-secondary"}`}>
                                {party.status || "Active"}
                              </span>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                <button
                                  onClick={() => setSelectedPartyFor360(party)}
                                  className="btn btn-secondary btn-sm"
                                  title="View 3-Month Sales & Category Remarks"
                                  style={{ padding: "4px 10px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}
                                >
                                  <Eye size={13} /> {isAsmOrTsm ? "View Sales & Remarks" : "360° Profile"}
                                </button>

                                {!isAsmOrTsm && (
                                  <button
                                    onClick={() => setEditingParty(party)}
                                    className="btn btn-secondary btn-sm"
                                    title="Edit Party Details"
                                    style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}

                                {isAdminOrOwner && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to delete party "${party.name}"?`)) {
                                        onDeleteParty(party.id);
                                      }
                                    }}
                                    className="btn btn-danger btn-sm"
                                    title="Delete Party"
                                    style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
                <div className="mobile-card-view">
                  {paginatedParties.map(party => (
                    <div 
                      key={party.id}
                      className="mobile-party-card glass-panel"
                      style={{
                        padding: "14px",
                        borderRadius: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        border: "1px solid var(--border-glass)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1.02rem" }}>
                            {party.name}
                          </div>
                          {([party.city, party.state].filter(Boolean).length > 0 || party.gstin) && (
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                              {[party.city, party.state].filter(Boolean).length > 0 && (
                                <span><MapPin size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {[party.city, party.state].filter(Boolean).join(", ")}</span>
                              )}
                              {party.gstin && <span>• GST: {party.gstin}</span>}
                            </div>
                          )}
                        </div>
                        <span className={`badge ${party.status === "Active" ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                          {party.status || "Active"}
                        </span>
                      </div>

                      {(party.contactPerson || party.phone) && (
                        <div style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card-hover, rgba(0,0,0,0.04))", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{party.contactPerson || "Contact"}</span>
                          {party.phone && (
                            <a href={`tel:${party.phone}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <Phone size={12} /> {party.phone}
                            </a>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                          CRM: {party.assignedCrmName || crmExecutives.find(c => c.id === party.assignedCrmId)?.name || "Unassigned"}
                        </span>
                        {getActiveAsmName(party) && (
                          <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                            ASM: {getActiveAsmName(party)}
                          </span>
                        )}
                        {getActiveTsmName(party) && (
                          <span className="badge" style={{ fontSize: "0.7rem", background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                            TSM: {getActiveTsmName(party)}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <button
                          onClick={() => setSelectedPartyFor360(party)}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Eye size={14} /> View Sales & Remarks
                        </button>
                        {!isAsmOrTsm && (
                          <button
                            onClick={() => setEditingParty(party)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "8px 12px" }}
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {isAdminOrOwner && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete party "${party.name}"?`)) {
                                onDeleteParty(party.id);
                              }
                            }}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "8px 12px" }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Parties Pagination (100 rows per page) */}
            <Pagination
              currentPage={partiesPage}
              totalItems={filteredParties.length}
              itemsPerPage={partiesPerPage}
              onPageChange={setPartiesPage}
              onItemsPerPageChange={(n) => {
                setPartiesPerPage(n);
                setPartiesPage(1);
              }}
              perPageOptions={[50, 100, 200, 500]}
            />
          </div>

        </div>
      )}

      {/* ==================== TAB 2: MY SALES TEAM (ASM & TSM) ==================== */}
      {activeTab === "team" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} /> Sales Team Hierarchy & Role Management
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Create and manage Area Sales Managers (ASM) and Territory Sales Managers (TSM), and assign party territories.
              </p>
            </div>

            <button
              onClick={() => setShowAddTeamModal(true)}
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              <UserPlus size={16} /> Create ASM / TSM User
            </button>
          </div>

          {/* Team Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
            {teamMembers.map(member => {
              const mId = member.id;
              const mName = (member.name || "").trim().toLowerCase();
              const assignedParties = crmParties.filter(p => {
                if (p.assignedAsmId === mId || p.assignedTsmId === mId) return true;
                if (p.assignedAsmName && p.assignedAsmName.trim().toLowerCase() === mName) return true;
                if (p.assignedTsmName && p.assignedTsmName.trim().toLowerCase() === mName) return true;
                return false;
              });
              const assignedPartyIds = new Set(assignedParties.map(p => p.id));
              const assignedPartyNames = new Set(assignedParties.map(p => (p.name || "").trim().toLowerCase()).filter(Boolean));

              const memberOrders = crmSalesOrders.filter(o => {
                if (o.assignedAsmId === mId || o.assignedTsmId === mId) return true;
                if (assignedPartyIds.has(o.partyId) || assignedPartyNames.has((o.partyName || "").trim().toLowerCase())) return true;
                return false;
              });
              const memberRevenue = memberOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);

              return (
                <div key={member.id} className="glass-panel sales-team-card" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px", borderRadius: "14px", border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "180px", flex: "1 1 auto" }}>
                      <div style={{ width: "42px", height: "42px", minWidth: "42px", borderRadius: "50%", background: member.role === "asm" ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem" }}>
                        {member.name ? member.name.slice(0, 2).toUpperCase() : "SM"}
                      </div>
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.98rem", color: "var(--text-main)", wordBreak: "break-word" }}>{member.name}</div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", wordBreak: "break-all" }}>{member.email}</div>
                      </div>
                    </div>

                    <span className="badge" style={{ 
                      background: member.role === "asm" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: member.role === "asm" ? "#34d399" : "#fbbf24",
                      border: member.role === "asm" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      fontWeight: 700,
                      fontSize: "0.74rem",
                      whiteSpace: "normal",
                      textAlign: "center",
                      padding: "4px 8px"
                    }}>
                      {member.role === "asm" ? "ASM (Area Manager)" : "TSM (Territory Manager)"}
                    </span>
                  </div>

                  {(() => {
                    const memberParentCrmId = getEffectiveParentCrmId(member);
                    const parentCrmObj = crmExecutives.find(c => c.id === memberParentCrmId) || users.find(u => u.id === memberParentCrmId);
                    const parentCrmName = parentCrmObj?.name || (memberParentCrmId === "u-ankita" ? "Ankita" : "Unassigned");

                    return (
                      <>
                        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.82rem" }}>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Assigned CRM:</span>
                            <div style={{ fontWeight: 700, color: "#38bdf8" }}>💼 {parentCrmName}</div>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Territory:</span>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{member.territory || "General"}</div>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Phone:</span>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{member.phone || "—"}</div>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Assigned Parties:</span>
                            <div style={{ fontWeight: 700, color: "#38bdf8" }}>{assignedParties.length} Parties</div>
                          </div>
                          {canViewFinancials ? (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <span style={{ color: "var(--text-muted)" }}>Total Sales:</span>
                              <div style={{ fontWeight: 700, color: "var(--success)" }}>{formatInr(memberRevenue)}</div>
                            </div>
                          ) : (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <span style={{ color: "var(--text-muted)" }}>Total Orders:</span>
                              <div style={{ fontWeight: 700, color: "var(--success)" }}>{memberOrders.length} Orders</div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto" }}>
                          <button
                            onClick={() => setAssigningTeamMember(member)}
                            className="btn btn-secondary btn-sm"
                            style={{ justifyContent: "center", fontSize: "0.8rem", color: "var(--primary)", borderColor: "var(--primary)", fontWeight: 700 }}
                          >
                            <UserCheck size={13} /> Assign Parties ({assignedParties.length})
                          </button>

                          <button
                            onClick={() => setTrackingAsmMember(member)}
                            className="btn btn-primary btn-sm"
                            style={{ justifyContent: "center", fontSize: "0.8rem", fontWeight: 700 }}
                          >
                            {canViewFinancials ? (
                              <><TrendingUp size={13} /> Track Sales ({formatInr(memberRevenue)})</>
                            ) : (
                              <><Truck size={13} /> View Dispatches & Performance</>
                            )}
                          </button>

                          <button
                            onClick={() => setEditingTeamMember(member)}
                            className="btn btn-secondary btn-sm"
                            style={{ justifyContent: "center", fontSize: "0.8rem" }}
                          >
                            <Edit2 size={13} /> Edit Account
                          </button>

                          <button
                            onClick={() => {
                              const newStatus = member.status === "active" ? "inactive" : "active";
                              onUpdateUser(member.id, { status: newStatus });
                            }}
                            className={`btn btn-sm ${member.status === "active" ? "btn-danger" : "btn-success"}`}
                            style={{ fontSize: "0.8rem", justifyContent: "center" }}
                          >
                            {member.status === "active" ? "Deactivate" : "Activate"}
                          </button>

                          {isAdminOrOwner && (
                            <button
                              onClick={() => setTransferringAsmMember(member)}
                              className="btn btn-sm"
                              style={{
                                gridColumn: "1 / -1",
                                justifyContent: "center",
                                fontSize: "0.8rem",
                                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.18))",
                                color: "#c084fc",
                                border: "1px solid rgba(192, 132, 252, 0.35)",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                              title="Transfer this ASM/TSM to another CRM executive"
                            >
                              <Share2 size={13} /> Transfer to Another CRM
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ==================== TAB: MONTH & CATEGORY WISE PERFORMANCE & REMARKS ==================== */}
      {activeTab === "monthly_category" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls Bar */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquare size={20} style={{ color: "#38bdf8" }} /> Monthly Category & Remarks Studio
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Select a party below to open its 4-month Finished Goods (FG) category breakdown, log new remarks, and view remarks history.
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {isAdminOrOwner && (
                <button
                  onClick={() => {
                    const headers = ["Party Name", "City", "State", "Assigned CRM", "Assigned ASM", "Assigned TSM", "Total Orders Count", "Total Remarks Count"];
                    const rows = filteredParties.map(p => {
                      const partyOrders = allUnifiedSalesOrders.filter(o => matchParty(o.partyName, p.name, o.partyId, p.id));
                      const partyRemarks = (crmPartyRemarks || []).filter(r => matchParty(r.partyName, p.name, r.partyId, p.id));
                      return [
                        p.name, p.city, p.state, p.assignedCrmName, p.assignedAsmName, p.assignedTsmName, partyOrders.length, partyRemarks.length
                      ];
                    });
                    exportCsv(headers, rows, "monthly_category_parties_list");
                  }}
                  className="btn btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.88rem" }}
                >
                  <Download size={15} /> Export Parties CSV
                </button>
              )}
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search Party */}
            <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search party by name, city, GSTIN..."
                value={matrixPartySearch}
                onChange={e => setMatrixPartySearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: "34px", height: "38px", fontSize: "0.86rem" }}
              />
            </div>

            {/* State Filter */}
            <div style={{ minWidth: "150px" }}>
              <select
                value={partyStateFilter}
                onChange={e => setPartyStateFilter(e.target.value)}
                className="form-control"
                style={{ height: "38px", fontSize: "0.86rem" }}
              >
                <option value="all">All States</option>
                {uniqueStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Sales Manager Filter */}
            {teamMembers.length > 0 && (
              <div style={{ minWidth: "160px" }}>
                <select
                  value={matrixAsmFilter}
                  onChange={e => setMatrixAsmFilter(e.target.value)}
                  className="form-control"
                  style={{ height: "38px", fontSize: "0.86rem" }}
                >
                  <option value="all">👤 All Sales Team</option>
                  {teamMembers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role.toUpperCase()})</option>
                  ))}
                </select>
              </div>
            )}

            {(matrixPartySearch || matrixAsmFilter !== "all" || partyStateFilter !== "all") && (
              <button
                onClick={() => {
                  setMatrixPartySearch("");
                  setMatrixAsmFilter("all");
                  setPartyStateFilter("all");
                }}
                className="btn btn-secondary btn-sm"
                style={{ height: "38px" }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Parties List Table & Remarks Launcher */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            {filteredParties.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <MessageSquare size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No parties found matching criteria</h4>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="desktop-table-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "850px" }}>
                    <thead>
                      <tr>
                        <th>Party Name & Location</th>
                        <th>Team Hierarchy</th>
                        <th style={{ textAlign: "right" }}>4-Month Sales Volume</th>
                        <th style={{ textAlign: "center" }}>Category Remarks</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParties
                        .filter(p => {
                          if (matrixPartySearch.trim()) {
                            const q = matrixPartySearch.toLowerCase();
                            const match = p.name?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q) || p.gstin?.toLowerCase().includes(q);
                            if (!match) return false;
                          }
                          if (matrixAsmFilter !== "all") {
                            const matchAsm = p.assignedAsmId === matrixAsmFilter || p.assignedTsmId === matrixAsmFilter;
                            if (!matchAsm) return false;
                          }
                          if (partyStateFilter !== "all" && p.state !== partyStateFilter) {
                            return false;
                          }
                          return true;
                        })
                        .map(party => {
                          const partyOrders = allUnifiedSalesOrders.filter(o => matchParty(o.partyName, party.name, o.partyId, party.id));
                          const partyRemarks = (crmPartyRemarks || []).filter(r => matchParty(r.partyName, party.name, r.partyId, party.id));
                          
                          const serverEntry = (partyCategoryMonthlySales || []).find(e => matchParty(e.partyName, party.name, e.partyId, party.id));
                          let effective4MoQty = 0;
                          let activeCatsCount = 0;

                          if (serverEntry && serverEntry.categories) {
                            Object.entries(serverEntry.categories).forEach(([cat, months]) => {
                              const catTotal = Object.values(months).reduce((sum, v) => sum + (parseFloat(v.qty) || 0), 0);
                              effective4MoQty += catTotal;
                              if (catTotal > 0) activeCatsCount++;
                            });
                          } else {
                            effective4MoQty = partyOrders.reduce((sum, o) => sum + (parseFloat(o.orderQty) || 0), 0);
                          }

                          return (
                            <tr 
                              key={party.id} 
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedPartyForCategoryStudio(party)}
                              className="table-row-hover"
                            >
                              <td>
                                <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.95rem" }}>
                                  {party.name}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                  {[party.city, party.state].filter(Boolean).join(", ") || "Location unassigned"}
                                </div>
                              </td>

                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.78rem" }}>
                                  <span style={{ color: "var(--text-muted)" }}>CRM: <strong style={{ color: "var(--text-main)" }}>{party.assignedCrmName || "—"}</strong></span>
                                  {getActiveAsmName(party) && <span style={{ color: "var(--text-muted)" }}>ASM: <strong style={{ color: "#34d399" }}>{getActiveAsmName(party)}</strong></span>}
                                  {getActiveTsmName(party) && <span style={{ color: "var(--text-muted)" }}>TSM: <strong style={{ color: "#fbbf24" }}>{getActiveTsmName(party)}</strong></span>}
                                </div>
                              </td>

                              <td style={{ textAlign: "right" }}>
                                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: effective4MoQty > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                                  {effective4MoQty > 0 ? `${effective4MoQty.toLocaleString()} Pcs` : "0 Pcs"}
                                </span>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                  {activeCatsCount > 0 ? `${activeCatsCount} active categories` : `${partyOrders.length} orders`}
                                </div>
                              </td>

                              <td style={{ textAlign: "center" }}>
                                <span className="badge" style={{
                                  background: partyRemarks.length > 0 ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.05)",
                                  color: partyRemarks.length > 0 ? "#38bdf8" : "var(--text-muted)",
                                  border: partyRemarks.length > 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid var(--border-glass)",
                                  fontWeight: 700
                                }}>
                                  {partyRemarks.length > 0 ? `${partyRemarks.length} Remarks` : "No Remarks"}
                                </span>
                              </td>

                              <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedPartyForCategoryStudio(party)}
                                  className="btn btn-primary btn-sm"
                                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 700, padding: "5px 12px" }}
                                >
                                  <MessageSquare size={13} /> Open Remarks Studio
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
                <div className="mobile-card-view" style={{ gap: "10px" }}>
                  {filteredParties
                    .filter(p => {
                      if (matrixPartySearch.trim()) {
                        const q = matrixPartySearch.toLowerCase();
                        const match = p.name?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q) || p.gstin?.toLowerCase().includes(q);
                        if (!match) return false;
                      }
                      if (matrixAsmFilter !== "all") {
                        const matchAsm = p.assignedAsmId === matrixAsmFilter || p.assignedTsmId === matrixAsmFilter;
                        if (!matchAsm) return false;
                      }
                      if (partyStateFilter !== "all" && p.state !== partyStateFilter) {
                        return false;
                      }
                      return true;
                    })
                    .map(party => {
                      const partyOrders = allUnifiedSalesOrders.filter(o => matchParty(o.partyName, party.name, o.partyId, party.id));
                      const partyRemarks = (crmPartyRemarks || []).filter(r => matchParty(r.partyName, party.name, r.partyId, party.id));
                      const serverEntry = (partyCategoryMonthlySales || []).find(e => matchParty(e.partyName, party.name, e.partyId, party.id));
                      let effective4MoQty = 0;
                      let activeCatsCount = 0;

                      if (serverEntry && serverEntry.categories) {
                        Object.entries(serverEntry.categories).forEach(([cat, months]) => {
                          const catTotal = Object.values(months).reduce((sum, v) => sum + (parseFloat(v.qty) || 0), 0);
                          effective4MoQty += catTotal;
                          if (catTotal > 0) activeCatsCount++;
                        });
                      } else {
                        effective4MoQty = partyOrders.reduce((sum, o) => sum + (parseFloat(o.orderQty) || 0), 0);
                      }

                      return (
                        <div 
                          key={party.id}
                          className="mobile-party-card glass-panel"
                          style={{ padding: "14px", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid var(--border-glass)" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1rem" }}>
                                {party.name}
                              </div>
                              {[party.city, party.state].filter(Boolean).length > 0 && (
                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                  <MapPin size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {[party.city, party.state].filter(Boolean).join(", ")}
                                </div>
                              )}
                            </div>
                            <span className="badge badge-primary" style={{ fontSize: "0.76rem", fontWeight: 800, flexShrink: 0 }}>
                              {effective4MoQty > 0 ? `${effective4MoQty.toLocaleString()} Pcs` : "0 Pcs"}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)", fontSize: "0.76rem" }}>
                            <span style={{ color: "var(--text-muted)" }}>
                              CRM: <strong style={{ color: "var(--text-main)" }}>{party.assignedCrmName || "—"}</strong>
                            </span>
                            <span className="badge" style={{ background: partyRemarks.length > 0 ? "rgba(56, 189, 248, 0.15)" : "transparent", color: partyRemarks.length > 0 ? "var(--primary)" : "var(--text-muted)", fontWeight: 700 }}>
                              {partyRemarks.length > 0 ? `${partyRemarks.length} Remarks` : "0 Remarks"}
                            </span>
                          </div>

                          <button
                            onClick={() => setSelectedPartyForCategoryStudio(party)}
                            className="btn btn-primary btn-sm"
                            style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          >
                            <MessageSquare size={14} /> Open Remarks Studio
                          </button>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 3: ITEM-WISE SALE REPORT ==================== */}
      {activeTab === "salesreport" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart2 size={20} /> Item-Wise Sales Performance Report
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Aggregated sales volume, pricing realizations, revenue (₹), and customer distribution per item.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={salesReportStartDate}
                endDate={salesReportEndDate}
                onStartDateChange={setSalesReportStartDate}
                onEndDateChange={setSalesReportEndDate}
                onClear={() => {
                  setSalesReportStartDate("");
                  setSalesReportEndDate("");
                }}
                align="right"
              />

              <select
                value={salesReportCategory}
                onChange={e => setSalesReportCategory(e.target.value)}
                className="form-control"
                style={{ width: "auto", height: "36px", fontSize: "0.85rem" }}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {isAdminOrOwner && (
                <button
                  onClick={handleExportItemSalesCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={14} /> Export Report (CSV)
                </button>
              )}
            </div>
          </div>

          {/* Item-Wise Sales Table */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            {itemWiseSalesData.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Package size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No sales records logged yet</h4>
                <p style={{ fontSize: "0.85rem" }}>Log party orders in the "Sales Bookings" tab to populate this item report.</p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-table-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                    <thead>
                      <tr>
                        <th>Item Model / Product</th>
                        <th>Category</th>
                        <th style={{ textAlign: "right" }}>Total Qty Ordered</th>
                        <th style={{ textAlign: "right" }}>Avg Unit Price</th>
                        <th style={{ textAlign: "right" }}>Total Revenue (₹)</th>
                        <th style={{ textAlign: "right" }}>Dispatched / Pending</th>
                        <th style={{ textAlign: "center" }}>Fulfillment %</th>
                        <th>Key Buying Parties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemWiseSalesData
                        .filter(i => salesReportCategory === "all" || i.category === salesReportCategory)
                        .map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.92rem" }}>
                                {item.itemModel}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-secondary">{item.category}</span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>
                              {item.totalQty.toLocaleString()} Pcs
                            </td>
                            <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                              ₹{Number(item.avgPrice).toLocaleString()}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: "0.95rem" }}>
                              {formatInr(item.totalRevenue)}
                            </td>
                            <td style={{ textAlign: "right", fontSize: "0.85rem" }}>
                              <span style={{ color: "var(--success)", fontWeight: 600 }}>{item.dispatchedQty}</span> / <span style={{ color: item.pendingQty > 0 ? "var(--danger)" : "var(--text-muted)" }}>{item.pendingQty}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                                <div style={{ width: "50px", height: "6px", borderRadius: "99px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                                  <div style={{ width: `${item.ratePercent}%`, height: "100%", background: item.ratePercent >= 80 ? "var(--success)" : item.ratePercent >= 40 ? "#f59e0b" : "var(--danger)" }}></div>
                                </div>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.ratePercent}%</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {item.partyList || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
                <div className="mobile-card-view" style={{ gap: "10px" }}>
                  {itemWiseSalesData
                    .filter(i => salesReportCategory === "all" || i.category === salesReportCategory)
                    .map((item, idx) => (
                      <div 
                        key={idx}
                        className="mobile-party-card glass-panel"
                        style={{ padding: "14px", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--border-glass)" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <div>
                            <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.98rem" }}>
                              {item.itemModel}
                            </div>
                            <span className="badge badge-secondary" style={{ fontSize: "0.7rem", marginTop: "3px" }}>
                              {item.category}
                            </span>
                          </div>
                          <span className="badge badge-success" style={{ fontSize: "0.8rem", fontWeight: 800 }}>
                            {item.totalQty.toLocaleString()} Pcs
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)", fontSize: "0.78rem" }}>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Dispatched / Pending:</span>
                            <div style={{ fontWeight: 700 }}>
                              <span style={{ color: "var(--success)" }}>{item.dispatchedQty}</span> / <span style={{ color: item.pendingQty > 0 ? "var(--danger)" : "var(--text-muted)" }}>{item.pendingQty}</span>
                            </div>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)" }}>Fulfillment:</span>
                            <div style={{ fontWeight: 700, color: item.ratePercent >= 80 ? "var(--success)" : "#f59e0b" }}>{item.ratePercent}%</div>
                          </div>
                          {canViewFinancials && (
                            <>
                              <div>
                                <span style={{ color: "var(--text-muted)" }}>Avg Price:</span>
                                <div style={{ fontWeight: 600 }}>₹{Number(item.avgPrice).toLocaleString()}</div>
                              </div>
                              <div>
                                <span style={{ color: "var(--text-muted)" }}>Revenue:</span>
                                <div style={{ fontWeight: 800, color: "var(--success)" }}>{formatInr(item.totalRevenue)}</div>
                              </div>
                            </>
                          )}
                        </div>

                        {item.partyList && (
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", background: "var(--bg-card-hover, rgba(0,0,0,0.02))", padding: "6px 8px", borderRadius: "6px" }}>
                            Buyers: <strong style={{ color: "var(--text-main)" }}>{item.partyList}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 4: DISPATCHED QUANTITY REPORT ==================== */}
      {activeTab === "dispatchreport" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Header & Controls */}
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Truck size={20} /> Dispatched Quantity & Logistics Report
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Real-time tracking of dispatched shipments, courier/transport details, LR docket numbers, and delivery status.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={dispatchStartDate}
                endDate={dispatchEndDate}
                onStartDateChange={setDispatchStartDate}
                onEndDateChange={setDispatchEndDate}
                onClear={() => {
                  setDispatchStartDate("");
                  setDispatchEndDate("");
                }}
                align="right"
              />

              <select
                value={dispatchStatusFilter}
                onChange={e => setDispatchStatusFilter(e.target.value)}
                className="form-control"
                style={{ width: "auto", minHeight: "38px", height: "38px", fontSize: "0.85rem", padding: "6px 36px 6px 12px", display: "inline-flex", alignItems: "center" }}
              >
                <option value="all">All Dispatch Statuses</option>
                <option value="Delivered">Delivered</option>
                <option value="In Transit">In Transit</option>
                <option value="Pending">Pending</option>
              </select>

              {isAdminOrOwner && (
                <button
                  onClick={handleExportDispatchesCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={14} /> Export Dispatches (CSV)
                </button>
              )}
            </div>
          </div>

          {/* Multi-Search Criteria Filter Panel */}
          <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(56, 189, 248, 0.2)", background: "rgba(15, 23, 42, 0.55)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
                  <Filter size={16} style={{ color: "#38bdf8" }} />
                  <span>Multi-Search Filters</span>
                </div>
                {dispatchSearchFilters.filter(f => (f.value || "").trim() !== "").length > 0 && (
                  <span style={{ fontSize: "0.75rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                    {dispatchSearchFilters.filter(f => (f.value || "").trim() !== "").length} active
                  </span>
                )}
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Showing <strong>{filteredDispatchesReport.length}</strong> of {currentDispatches.length} dispatches
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "2px", border: "1px solid var(--border-glass)" }}>
                  <button
                    onClick={() => setDispatchMatchMode("all")}
                    className={`btn btn-sm ${dispatchMatchMode === "all" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: "6px", height: "auto" }}
                  >
                    Match ALL (AND)
                  </button>
                  <button
                    onClick={() => setDispatchMatchMode("any")}
                    className={`btn btn-sm ${dispatchMatchMode === "any" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: "6px", height: "auto" }}
                  >
                    Match ANY (OR)
                  </button>
                </div>

                <button
                  onClick={handleAddDispatchSearchFilter}
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "6px 14px", fontWeight: 700 }}
                >
                  <Plus size={15} /> Add Search Filter (+)
                </button>

                <button
                  onClick={handleResetDispatchSearchFilters}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.82rem" }}
                  title="Reset all search filters"
                >
                  <RefreshCw size={13} /> Reset
                </button>
              </div>
            </div>

            {/* Dynamic Search Filter Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {dispatchSearchFilters.map((filter, index) => (
                <div key={filter.id} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "rgba(30, 41, 59, 0.45)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", minWidth: "22px" }}>
                    #{index + 1}
                  </span>

                  <select
                    value={filter.field}
                    onChange={e => handleUpdateDispatchSearchFilter(filter.id, "field", e.target.value)}
                    className="form-control"
                    style={{ width: "auto", minWidth: "165px", height: "34px", minHeight: "34px", fontSize: "0.82rem", padding: "4px 28px 4px 10px" }}
                  >
                    <option value="all">🔍 All Fields</option>
                    <option value="party">🏢 Party Name</option>
                    <option value="item">📦 Item Model / Product</option>
                  </select>

                  <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                    <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Search by ${filter.field === "all" ? "party name or item model..." : filter.field}...`}
                      value={filter.value}
                      onChange={e => handleUpdateDispatchSearchFilter(filter.id, "value", e.target.value)}
                      style={{ height: "34px", minHeight: "34px", paddingLeft: "32px", paddingRight: filter.value ? "30px" : "10px", fontSize: "0.85rem" }}
                    />
                    {filter.value && (
                      <button
                        onClick={() => handleUpdateDispatchSearchFilter(filter.id, "value", "")}
                        style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      onClick={handleAddDispatchSearchFilter}
                      className="btn btn-secondary btn-sm"
                      style={{ height: "34px", width: "34px", padding: 0, justifyContent: "center", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                      title="Add another search filter (+)"
                    >
                      <Plus size={15} />
                    </button>
                    {dispatchSearchFilters.length > 1 && (
                      <button
                        onClick={() => handleRemoveDispatchSearchFilter(filter.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ height: "34px", width: "34px", padding: 0, justifyContent: "center", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                        title="Remove this filter"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispatches Table */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            {filteredDispatchesReport.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Truck size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No matching dispatch logs found</h4>
                <p style={{ fontSize: "0.85rem" }}>
                  {currentDispatches.length === 0
                    ? "Record dispatches against sales orders to view shipment logs."
                    : "No dispatches matched your current search filters. Try adjusting or resetting your search criteria."}
                </p>
                {dispatchSearchFilters.some(f => (f.value || "").trim() !== "") && (
                  <button
                    onClick={handleResetDispatchSearchFilters}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <RefreshCw size={13} /> Reset All Search Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-table-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "750px" }}>
                    <thead>
                      <tr>
                        <th>Dispatch Date</th>
                        <th>Party Name</th>
                        <th>Item Model</th>
                        <th style={{ textAlign: "right" }}>Dispatched Qty</th>
                        <th style={{ textAlign: "center" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDispatchesReport.map(dsp => (
                        <tr key={dsp.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 600 }}>
                              <Calendar size={13} style={{ color: "var(--primary)" }} /> {dsp.dispatchDate}
                            </div>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{dsp.partyName}</span>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600, color: "var(--primary)" }}>{dsp.itemModel}</span>
                          </td>

                          <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: "0.95rem" }}>
                            {dsp.dispatchedQty?.toLocaleString()} Pcs
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <span className={`badge ${dsp.status === "Delivered" ? "badge-success" : dsp.status === "In Transit" ? "badge-primary" : "badge-secondary"}`}>
                              {dsp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
                <div className="mobile-card-view" style={{ gap: "10px" }}>
                  {filteredDispatchesReport.map(dsp => (
                    <div 
                      key={dsp.id}
                      className="mobile-party-card glass-panel"
                      style={{ padding: "14px", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--border-glass)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.98rem" }}>
                            {dsp.partyName}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: 700, marginTop: "2px" }}>
                            {dsp.itemModel}
                          </div>
                        </div>
                        <span className={`badge ${dsp.status === "Delivered" ? "badge-success" : dsp.status === "In Transit" ? "badge-primary" : "badge-secondary"}`} style={{ fontSize: "0.72rem" }}>
                          {dsp.status}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)", fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={12} /> {dsp.dispatchDate}
                        </span>
                        <strong style={{ color: "var(--success)", fontSize: "0.92rem", fontWeight: 800 }}>
                          {dsp.dispatchedQty?.toLocaleString()} Pcs
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ==================== TAB 5: SALES BOOKINGS & ORDERS ==================== */}
      {activeTab === "orders" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="glass-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={20} /> Sales Orders & Booking Ledger
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                Log new dealer orders, update fulfillment dispatches, and track pending shipment balances.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <DateRangeFilter
                startDate={ordersStartDate}
                endDate={ordersEndDate}
                onStartDateChange={setOrdersStartDate}
                onEndDateChange={setOrdersEndDate}
                onClear={() => {
                  setOrdersStartDate("");
                  setOrdersEndDate("");
                }}
                align="right"
              />

              <button
                onClick={() => setShowAddOrderModal(true)}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
              >
                <Plus size={16} /> New Sales Order
              </button>
            </div>
          </div>

          {/* Orders Table & Mobile Cards */}
          <div className="glass-panel" style={{ padding: "16px" }}>
            {currentSalesOrders.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <FileText size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <h4>No sales orders logged yet</h4>
                <p style={{ fontSize: "0.85rem" }}>Click "New Sales Order" to create order entries for your assigned parties.</p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="desktop-table-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "950px" }}>
                    <thead>
                      <tr>
                        <th>Order No & Date</th>
                        <th>Party Name</th>
                        <th>Item Model & Category</th>
                        <th style={{ textAlign: "right" }}>Ordered Qty</th>
                        {canViewFinancials && <th style={{ textAlign: "right" }}>Unit Price & Total</th>}
                        <th style={{ textAlign: "right" }}>Dispatched / Pending</th>
                        <th>Status</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSalesOrders
                        .filter(order => {
                          if (ordersStartDate || ordersEndDate) {
                            if (!isDateInBetween(order.orderDate, ordersStartDate, ordersEndDate)) return false;
                          }
                          return true;
                        })
                        .map(order => (
                          <tr key={order.id}>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <code style={{ fontWeight: 700, fontSize: "0.85rem" }}>{order.orderNo}</code>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{order.orderDate}</span>
                              </div>
                            </td>

                            <td>
                              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{order.partyName}</span>
                            </td>

                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{order.itemModel}</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{order.category}</span>
                              </div>
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 700 }}>
                              {order.orderQty?.toLocaleString()} Pcs
                            </td>

                            {canViewFinancials && (
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 800, color: "var(--success)" }}>{formatInr(order.totalInr)}</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>@ ₹{order.unitPriceInr}/unit</span>
                                </div>
                              </td>
                            )}

                            <td style={{ textAlign: "right", fontSize: "0.85rem" }}>
                              <span style={{ color: "var(--success)", fontWeight: 700 }}>{order.dispatchedQty || 0}</span> / <span style={{ color: (order.pendingQty || 0) > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: 700 }}>{order.pendingQty || 0}</span>
                            </td>

                            <td>
                              <span className={`badge ${order.status === "Dispatched" ? "badge-success" : order.status === "Partially Dispatched" ? "badge-primary" : "badge-secondary"}`}>
                                {order.status}
                              </span>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                {(order.pendingQty || 0) > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedOrderForDispatch(order);
                                      setShowRecordDispatchModal(true);
                                    }}
                                    className="btn btn-success btn-sm"
                                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                    title="Record Dispatch Shipment"
                                  >
                                    <Truck size={12} /> Dispatch
                                  </button>
                                )}

                                {isAdminOrOwner && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm("Are you sure you want to delete this order?")) {
                                        onDeleteSalesOrder(order.id);
                                      }
                                    }}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
                <div className="mobile-card-view" style={{ gap: "10px" }}>
                  {currentSalesOrders
                    .filter(order => {
                      if (ordersStartDate || ordersEndDate) {
                        if (!isDateInBetween(order.orderDate, ordersStartDate, ordersEndDate)) return false;
                      }
                      return true;
                    })
                    .map(order => (
                      <div 
                        key={order.id}
                        className="mobile-party-card glass-panel"
                        style={{ padding: "14px", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid var(--border-glass)" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <div>
                            <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.98rem" }}>
                              {order.partyName}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                              <code>{order.orderNo}</code> • <span>{order.orderDate}</span>
                            </div>
                          </div>
                          <span className={`badge ${order.status === "Dispatched" ? "badge-success" : order.status === "Partially Dispatched" ? "badge-primary" : "badge-secondary"}`} style={{ fontSize: "0.72rem" }}>
                            {order.status}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.92rem" }}>{order.itemModel}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{order.category}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{order.orderQty?.toLocaleString()} Pcs</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              Disp: <span style={{ color: "var(--success)", fontWeight: 700 }}>{order.dispatchedQty || 0}</span> | Pend: <span style={{ color: (order.pendingQty || 0) > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: 700 }}>{order.pendingQty || 0}</span>
                            </div>
                          </div>
                        </div>

                        {(order.pendingQty || 0) > 0 && (
                          <button
                            onClick={() => {
                              setSelectedOrderForDispatch(order);
                              setShowRecordDispatchModal(true);
                            }}
                            className="btn btn-success btn-sm"
                            style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          >
                            <Truck size={14} /> Record Dispatch Shipment ({order.pendingQty} pending)
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT PARTY ==================== */}
      {(showAddPartyModal || editingParty) && (
        <PartyModal
          party={editingParty}
          allParties={crmParties}
          crmExecutives={crmExecutives}
          asmList={asmList}
          tsmList={tsmList}
          currentExecutive={activeExecutive || currentUser}
          currentUser={currentUser}
          onSave={async (partyData) => {
            try {
              if (editingParty) {
                await onUpdateParty(partyData);
                showSuccessToast(`✅ Saved successfully! Updated party "${partyData.name}".`);
                setEditingParty(null);
              } else {
                await onAddParty(partyData);
                showSuccessToast(`✅ Saved successfully! Added new party "${partyData.name}".`);
                setShowAddPartyModal(false);
              }
            } catch (err) {
              showErrorToast(err.message || "Failed to save party.");
            }
          }}
          onClose={() => {
            setShowAddPartyModal(false);
            setEditingParty(null);
          }}
        />
      )}

      {/* ==================== MODAL: PARTY 360° PROFILE ==================== */}
      {selectedPartyFor360 && (
        <Party360Modal
          party={selectedPartyFor360}
          salesOrders={allUnifiedSalesOrders.filter(o => matchParty(o.partyName, selectedPartyFor360.name, o.partyId, selectedPartyFor360.id))}
          dispatches={allUnifiedDispatches.filter(d => matchParty(d.partyName, selectedPartyFor360.name, d.partyId, selectedPartyFor360.id))}
          crmPartyRemarks={crmPartyRemarks}
          partyCategoryMonthlySales={partyCategoryMonthlySales}
          partyCategoryMonths={partyCategoryMonths}
          items={items}
          currentUser={currentUser}
          onSavePartyRemark={onSavePartyRemark}
          onDeletePartyRemark={onDeletePartyRemark}
          canViewFinancials={canViewFinancials}
          onClose={() => setSelectedPartyFor360(null)}
        />
      )}

      {/* ==================== MODAL: 4-MONTH CATEGORY & REMARKS STUDIO ==================== */}
      {selectedPartyForCategoryStudio && (
        <PartyMonthlyCategoryStudioModal
          party={selectedPartyForCategoryStudio}
          salesOrders={allUnifiedSalesOrders.filter(o => matchParty(o.partyName, selectedPartyForCategoryStudio.name, o.partyId, selectedPartyForCategoryStudio.id))}
          dispatches={allUnifiedDispatches.filter(d => matchParty(d.partyName, selectedPartyForCategoryStudio.name, d.partyId, selectedPartyForCategoryStudio.id))}
          crmPartyRemarks={crmPartyRemarks}
          partyCategoryMonthlySales={partyCategoryMonthlySales}
          partyCategoryMonths={partyCategoryMonths}
          items={items}
          currentUser={currentUser}
          onSavePartyRemark={onSavePartyRemark}
          onDeletePartyRemark={onDeletePartyRemark}
          canViewFinancials={canViewFinancials}
          formatInr={formatInr}
          onClose={() => setSelectedPartyForCategoryStudio(null)}
        />
      )}

      {/* ==================== MODAL: ADD / EDIT SALES TEAM MEMBER (ASM / TSM) ==================== */}
      {(showAddTeamModal || editingTeamMember) && (
        <TeamMemberModal
          member={editingTeamMember}
          currentExecutive={activeExecutive || currentUser}
          crmExecutives={crmExecutives}
          isAdminOrOwner={isAdminOrOwner}
          currentUser={currentUser}
          onSave={async (memberData) => {
            try {
              if (editingTeamMember) {
                await onUpdateUser(editingTeamMember.id, memberData);
                showSuccessToast(`✅ Saved successfully! Updated user ${memberData.name}.`);
                setEditingTeamMember(null);
              } else {
                const parentId = memberData.parentCrmId || activeExecutive?.id || currentUser?.id || "u-ankita";
                const res = await onAddUser(
                  memberData.name, 
                  memberData.email, 
                  memberData.password, 
                  memberData.designation, 
                  memberData.role, 
                  memberData.phone, 
                  memberData.territory, 
                  parentId
                );
                if (res && res.success === false) {
                  showErrorToast(res.message || "Failed to create user account.");
                  return;
                }
                showSuccessToast(`✅ Saved successfully! Created team member ${memberData.name}.`);
                setShowAddTeamModal(false);
              }
            } catch (err) {
              showErrorToast(err.message || "Failed to save user account.");
            }
          }}
          onClose={() => {
            setShowAddTeamModal(false);
            setEditingTeamMember(null);
          }}
        />
      )}

      {/* ==================== MODAL: ASSIGN PARTIES TO ASM / TSM ==================== */}
      {assigningTeamMember && (
        <AssignPartiesModal
          teamMember={assigningTeamMember}
          allParties={isCrmUser ? currentParties : crmParties}
          onAssign={async (partyIds) => {
            try {
              const isAsm = assigningTeamMember.role === "asm";
              await onBatchAssignParties(
                partyIds, 
                isAsm ? assigningTeamMember.id : undefined, 
                !isAsm ? assigningTeamMember.id : undefined,
                isAsm ? assigningTeamMember.name : undefined,
                !isAsm ? assigningTeamMember.name : undefined
              );
              showSuccessToast(`✅ Assigned ${partyIds.length} parties to ${assigningTeamMember.name}!`);
              setAssigningTeamMember(null);
            } catch (err) {
              showErrorToast("Failed to assign parties: " + err.message);
            }
          }}
          onClose={() => setAssigningTeamMember(null)}
        />
      )}

      {/* ==================== MODAL: TRANSFER ASM / TSM TO ANOTHER CRM ==================== */}
      {transferringAsmMember && (
        <TransferAsmCrmModal
          member={transferringAsmMember}
          crmExecutives={crmExecutives}
          allParties={crmParties}
          onTransfer={async (member, targetCrmId, partiesToTransfer) => {
            try {
              const targetCrm = crmExecutives.find(c => c.id === targetCrmId);
              const targetName = targetCrm?.name || "CRM Executive";

              // 1. Update ASM/TSM parentCrmId
              await onUpdateUser(member.id, { parentCrmId: targetCrmId });

              // 2. Optionally update assigned parties to this new CRM
              if (partiesToTransfer && partiesToTransfer.length > 0) {
                for (const p of partiesToTransfer) {
                  await onUpdateParty({
                    ...p,
                    assignedCrmId: targetCrmId,
                    assignedCrmName: targetName
                  });
                }
              }

              showSuccessToast(`✅ Transferred ${member.name} (${member.role?.toUpperCase()}) to ${targetName} successfully!`);
              setTransferringAsmMember(null);
            } catch (err) {
              showErrorToast("Transfer failed: " + (err.message || "Unknown error"));
            }
          }}
          onClose={() => setTransferringAsmMember(null)}
        />
      )}

      {/* ==================== MODAL: TRACK ASM SALES & PURCHASED ITEMS ==================== */}
      {trackingAsmMember && (
        <AsmSalesDetailModal
          member={trackingAsmMember}
          allParties={crmParties}
          allSalesOrders={allUnifiedSalesOrders}
          allDispatches={allUnifiedDispatches}
          crmPartyRemarks={crmPartyRemarks}
          items={items}
          currentUser={currentUser}
          canViewFinancials={canViewFinancials}
          onSavePartyRemark={onSavePartyRemark}
          onDeletePartyRemark={onDeletePartyRemark}
          formatInr={formatInr}
          onClose={() => setTrackingAsmMember(null)}
        />
      )}

      {/* ==================== MODAL: PARTY & CATEGORY MONTHLY REMARKS ==================== */}
      {activeRemarkPartyCategory && (
        <PartyCategoryRemarkModal
          target={activeRemarkPartyCategory}
          remarks={(crmPartyRemarks || []).filter(r => (r.partyId === activeRemarkPartyCategory.partyId || r.partyName === activeRemarkPartyCategory.partyName) && r.category === activeRemarkPartyCategory.category && r.month === activeRemarkPartyCategory.month)}
          currentUser={currentUser}
          formatInr={formatInr}
          onSave={async (remarkText) => {
            try {
              await onSavePartyRemark({
                partyId: activeRemarkPartyCategory.partyId,
                partyName: activeRemarkPartyCategory.partyName,
                category: activeRemarkPartyCategory.category,
                month: activeRemarkPartyCategory.month,
                remark: remarkText,
                authorId: currentUser?.id || "",
                authorName: currentUser?.name || "Team Member",
                authorRole: currentUser?.role || "asm"
              });
              showSuccessToast("✅ Remark saved successfully!");
            } catch (err) {
              showErrorToast("Failed to save remark: " + err.message);
            }
          }}
          onDelete={async (remarkId) => {
            if (window.confirm("Are you sure you want to delete this remark?")) {
              await onDeletePartyRemark(remarkId);
              showSuccessToast("Remark deleted.");
            }
          }}
          onClose={() => setActiveRemarkPartyCategory(null)}
        />
      )}

      {/* ==================== MODAL: ADD SALES ORDER ==================== */}
      {showAddOrderModal && (
        <SalesOrderModal
          parties={currentParties}
          items={items}
          currentExecutive={activeExecutive || currentUser}
          onSave={async (orderData) => {
            try {
              await onAddSalesOrder(orderData);
              showSuccessToast("✅ Submitted successfully! New Sales Order created.");
              setShowAddOrderModal(false);
            } catch (err) {
              showErrorToast(err.message || "Failed to create sales order.");
            }
          }}
          onClose={() => setShowAddOrderModal(false)}
        />
      )}

      {/* ==================== MODAL: RECORD DISPATCH SHIPMENT ==================== */}
      {showRecordDispatchModal && selectedOrderForDispatch && (
        <DispatchModal
          order={selectedOrderForDispatch}
          onSave={async (dispatchData) => {
            try {
              await onAddDispatch(dispatchData);
              showSuccessToast("✅ Submitted successfully! Dispatch shipment recorded.");
              setShowRecordDispatchModal(false);
              setSelectedOrderForDispatch(null);
            } catch (err) {
              showErrorToast(err.message || "Failed to record dispatch.");
            }
          }}
          onClose={() => {
            setShowRecordDispatchModal(false);
            setSelectedOrderForDispatch(null);
          }}
        />
      )}

    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY ADD/EDIT MODAL ====================
function PartyModal({ party, allParties = [], crmExecutives, asmList, tsmList, currentExecutive, currentUser, onSave, onClose }) {
  const isCrmRole = currentUser?.role === "crm" || currentUser?.role === "asm" || currentUser?.role === "tsm";
  const [name, setName] = useState(party?.name || "");
  const [contactPerson, setContactPerson] = useState(party?.contactPerson || "");
  const [phone, setPhone] = useState(party?.phone || "");
  const [email, setEmail] = useState(party?.email || "");
  const [city, setCity] = useState(party?.city || "");
  const [state, setState] = useState(party?.state || "Rajasthan");
  const [gstin, setGstin] = useState(party?.gstin || "");
  const [assignedCrmId, setAssignedCrmId] = useState(party?.assignedCrmId || currentExecutive?.id || "u-ankita");
  const [assignedAsmId, setAssignedAsmId] = useState(party?.assignedAsmId || "");
  const [assignedTsmId, setAssignedTsmId] = useState(party?.assignedTsmId || "");
  const [status, setStatus] = useState(party?.status || "Active");

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalPartyName = (isCrmRole && party) ? party.name.trim() : name.trim();
    if (!finalPartyName) return;

    // Party name can't be duplicate: check if already exists when adding new party
    if (!party) {
      const exists = (allParties || []).some(p => (p.name || "").trim().toLowerCase() === finalPartyName.toLowerCase());
      if (exists) {
        alert(`Party "${finalPartyName}" already exists. Party name must be unique!`);
        return;
      }
    }

    const crmObj = crmExecutives.find(c => c.id === assignedCrmId);
    const asmObj = asmList.find(a => a.id === assignedAsmId);
    const tsmObj = tsmList.find(t => t.id === assignedTsmId);

    onSave({
      ...(party || {}),
      id: finalPartyName,
      name: finalPartyName,
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      city: city.trim(),
      state: state.trim(),
      gstin: gstin.trim(),
      assignedCrmId,
      assignedCrmName: crmObj?.name || "Ankita",
      assignedAsmId,
      assignedAsmName: asmObj?.name || "",
      assignedTsmId,
      assignedTsmName: tsmObj?.name || "",
      status
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 size={20} /> {party ? "Edit Party Account" : "Add New Customer / Dealer Party"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label className="form-label" style={{ margin: 0 }}>Party / Firm Name *</label>
              {!!party && (
                <span style={{ fontSize: "0.76rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                  <Lock size={12} /> Locked (Party Name cannot be changed)
                </span>
              )}
            </div>
            <input 
              type="text" 
              required 
              placeholder="e.g. Shree Ganesh Electronics" 
              value={name} 
              onChange={e => {
                if (!party) setName(e.target.value);
              }} 
              readOnly={Boolean(party)}
              disabled={Boolean(party)}
              className="form-control" 
              style={{
                background: Boolean(party) ? "rgba(255, 255, 255, 0.04)" : "",
                cursor: Boolean(party) ? "not-allowed" : "text",
                color: Boolean(party) ? "var(--text-muted)" : "var(--text-main)",
                border: Boolean(party) ? "1px solid rgba(245, 158, 11, 0.3)" : ""
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contact Person</label>
              <input type="text" placeholder="Key contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mobile Phone</label>
              <input type="text" placeholder="+91 98290 12345" value={phone} onChange={e => setPhone(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">City</label>
              <input type="text" placeholder="e.g. Jaipur" value={city} onChange={e => setCity(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">State</label>
              <input type="text" placeholder="e.g. Rajasthan" value={state} onChange={e => setState(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">GSTIN / Tax ID</label>
            <input type="text" placeholder="e.g. 08AABCS1429B1Z2" value={gstin} onChange={e => setGstin(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned CRM</label>
              <select value={assignedCrmId} onChange={e => setAssignedCrmId(e.target.value)} className="form-control">
                {crmExecutives.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned ASM</label>
              <select value={assignedAsmId} onChange={e => setAssignedAsmId(e.target.value)} className="form-control">
                <option value="">(None)</option>
                {asmList.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Assigned TSM</label>
              <select value={assignedTsmId} onChange={e => setAssignedTsmId(e.target.value)} className="form-control">
                <option value="">(None)</option>
                {tsmList.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              {party ? "Save Changes" : "Create Party"}
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

// ==================== SUB-COMPONENT: PARTY 360° PROFILE MODAL ====================
function Party360Modal({ 
  party, 
  salesOrders = [], 
  dispatches = [], 
  crmPartyRemarks = [],
  partyCategoryMonthlySales = [],
  partyCategoryMonths = [],
  items = [],
  currentUser,
  onSavePartyRemark,
  onDeletePartyRemark,
  canViewFinancials = false, 
  onClose 
}) {
  const [modalTab, setModalTab] = useState("category_matrix"); // "category_matrix" | "orders"
  const [activeRemarkModalTarget, setActiveRemarkModalTarget] = useState(null);

  // Dynamic Last 4 Months (including current month)
  const last4Months = useMemo(() => {
    if (partyCategoryMonths && partyCategoryMonths.length === 4) {
      return partyCategoryMonths;
    }
    const months = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${yr}-${mo}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      months.push({ key, label, fullMonth: key });
    }
    return months;
  }, [partyCategoryMonths]);

  const last4MonthKeys = useMemo(() => new Set(last4Months.map(m => m.key)), [last4Months]);

  // Helper to extract YYYY-MM from any date format
  const extractYearMonth = (dateVal) => {
    if (!dateVal) return "";
    const s = String(dateVal).trim();
    const yyyymm = s.match(/^(\d{4})[-/.](\d{1,2})/);
    if (yyyymm) return `${yyyymm[1]}-${yyyymm[2].padStart(2, "0")}`;
    const ddmmyyyy = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}`;
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      const mo = String(parsed.getMonth() + 1).padStart(2, "0");
      return `${yr}-${mo}`;
    }
    return "";
  };

  const last4MoOrders = useMemo(() => {
    return salesOrders.filter(o => {
      const m = extractYearMonth(o.orderDate);
      return last4MonthKeys.has(m);
    });
  }, [salesOrders, last4MonthKeys]);

  const last4MoOrderedQty = useMemo(() => {
    return last4MoOrders.reduce((a, b) => a + (parseInt(b.orderQty) || 0), 0);
  }, [last4MoOrders]);

  const last4MoDispatches = useMemo(() => {
    return dispatches.filter(d => {
      const m = extractYearMonth(d.dispatchDate);
      return last4MonthKeys.has(m);
    });
  }, [dispatches, last4MonthKeys]);

  const last4MoDispatchedQty = useMemo(() => {
    return last4MoDispatches.reduce((a, b) => a + (parseInt(b.dispatchedQty) || 0), 0);
  }, [last4MoDispatches]);

  const normalizeCategory = (cat, itemDesc = "") => {
    const rawCat = (cat || "").trim();
    const rawCatLower = rawCat.toLowerCase();
    const rawDescLower = (itemDesc || "").toLowerCase();
    const combined = `${rawCatLower} ${rawDescLower}`;

    // 1. Polymer Batteries: merge any polymer items (POLYMER ASUS BATTERY, S POLYMER BATTERY, Z POLYMER, etc.)
    if (combined.includes("polymer") || combined.includes("li-poly") || combined.includes("lithium poly")) {
      return "Polymer Batteries";
    }

    // 2. Eco Battery: must contain 'eco' word and NOT contain 'cell', 'body', etc.
    const hasEco = /\beco\b/i.test(combined) || combined.startsWith("eco-") || combined.startsWith("eco ") || combined.includes("eco battery");
    const isExcludedRawOrPart = combined.includes("cell") || combined.includes("body") || combined.includes("pcb") || combined.includes("bottom") || combined.includes("top") || combined.includes("inner") || combined.includes("housing") || combined.includes("raw");
    if (hasEco && !isExcludedRawOrPart) {
      return "Eco Battery";
    }

    // 3. Pouch Battery
    if (combined.includes("pouch")) {
      return "Pouch Battery";
    }

    if (rawCat && rawCat !== "General" && rawCat !== "Unspecified" && !rawCat.toLowerCase().includes("raw")) {
      if (rawCatLower.includes("cable") || rawCatLower.includes("aux")) return "Data Cable";
      if (rawCatLower.includes("neckband")) return "Neckband";
      if (rawCatLower.includes("tempered") || rawCatLower.includes("soldier") || rawCatLower.includes("glass")) return "TEMPERED SOLDIER";
      if (rawCatLower.includes("tws") || rawCatLower.includes("earbuds") || rawCatLower.includes("buds")) return "TWS Earbuds";
      if (rawCatLower.includes("power bank") || rawCatLower.includes("powerbank")) return "Power Bank";
      if (rawCatLower.includes("handsfree") || rawCatLower.includes("headphone") || rawCatLower.includes("earphone")) return "Earphones";
      if (rawCatLower.includes("charger") || rawCatLower.includes("adapter")) {
        if (rawCatLower.includes("car")) return "Car Charger";
        return "Fast Charger";
      }
      if (rawCatLower.includes("car")) return "Car Charger";
      if (rawCatLower.includes("speaker") || rawCatLower.includes("soundbar") || rawCatLower.includes("audio")) return "Speaker";
      if (rawCatLower.includes("watch")) return "Smart Watch";
      if (rawCatLower.includes("battery") || rawCatLower.includes("batteries")) return "Batteries";
      return rawCat;
    }

    if (combined.includes("fast charge") || combined.includes("adapter") || combined.includes("charger") || combined.includes("wall charge")) return "Fast Charger";
    if (combined.includes("cable") || combined.includes("usb") || combined.includes("type-c") || combined.includes("micro") || combined.includes("lightning")) return "Data Cable";
    if (combined.includes("neckband") || combined.includes("neck band")) return "Neckband";
    if (combined.includes("tempered") || combined.includes("soldier") || combined.includes("glass")) return "TEMPERED SOLDIER";
    if (combined.includes("tws") || combined.includes("earbuds") || combined.includes("airpods") || combined.includes("buds")) return "TWS Earbuds";
    if (combined.includes("power bank") || combined.includes("powerbank")) return "Power Bank";
    if (combined.includes("earphone") || combined.includes("headphone") || combined.includes("handsfree")) return "Earphones";
    if (combined.includes("battery") || combined.includes("batteries") || combined.includes("bf3")) return "Batteries";
    if (combined.includes("speaker") || combined.includes("soundbar") || combined.includes("audio")) return "Speaker";
    if (combined.includes("watch") || combined.includes("smartwatch") || combined.includes("smart watch") || combined.includes("band")) return "Smart Watch";
    if (combined.includes("car charge") || combined.includes("car")) return "Car Charger";
    return "Mobile Accessories";
  };

  // 4-Month Category-Wise aggregation for this party (FG only, Polymer Battery consolidated)
  const partyCategoryRows = useMemo(() => {
    const map = new Map();

    const standardFgCategories = [
      "Fast Charger", "Data Cable", "Neckband", "TEMPERED SOLDIER", "TWS Earbuds", 
      "Polymer Battery", "Eco Battery", "Pouch Battery", "Batteries", 
      "Power Bank", "Earphones", "Speaker", "Smart Watch", "Car Charger", "Mobile Accessories"
    ];

    standardFgCategories.forEach(cat => {
      map.set(cat, {
        category: cat,
        m0: 0,
        m1: 0,
        m2: 0,
        m3: 0,
        totalQty: 0,
        totalRevenue: 0
      });
    });

    // 1. Populate from server-precalculated partyCategoryMonthlySales
    const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const partyNorm = norm(party?.name);
    const relevantSales = (partyCategoryMonthlySales || []).filter(s => {
      const sNorm = norm(s.partyName);
      return (party?.id && s.partyId === party.id) || sNorm === partyNorm || (sNorm && partyNorm && (sNorm.includes(partyNorm) || partyNorm.includes(sNorm)));
    });

    relevantSales.forEach(s => {
      const cat = normalizeCategory(s.category);
      if (!cat) return;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const qty = parseInt(s.salesQty) || 0;
      if (s.month === last4Months[0].key) row.m0 += qty;
      else if (s.month === last4Months[1].key) row.m1 += qty;
      else if (s.month === last4Months[2].key) row.m2 += qty;
      else if (s.month === last4Months[3].key) row.m3 += qty;
      row.totalQty += qty;
      row.totalRevenue += parseFloat(s.salesRevenue) || 0;
    });

    // 2. Include client sales orders if not already populated
    (salesOrders || []).forEach(o => {
      let rawCat = o.category;
      if (!rawCat || rawCat === "General" || rawCat === "Unspecified") {
        const found = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        rawCat = found?.category || "";
      }
      const cat = normalizeCategory(rawCat, o.itemModel || "");
      if (!cat) return;

      const oMonth = extractYearMonth(o.orderDate) || last4Months[3].key;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const qty = parseInt(o.orderQty) || 0;
      if (row.totalQty === 0) {
        if (oMonth === last4Months[0].key) row.m0 += qty;
        else if (oMonth === last4Months[1].key) row.m1 += qty;
        else if (oMonth === last4Months[2].key) row.m2 += qty;
        else if (oMonth === last4Months[3].key) row.m3 += qty;
        row.totalQty += qty;
      }
      row.totalRevenue += parseFloat(o.totalInr) || 0;
    });

    // 3. Include client dispatches if not already populated
    (dispatches || []).forEach(d => {
      const found = items.find(it => it.name === d.itemModel || it.id === d.itemId || it.id === String(d.itemId).replace(/^#+/, ""));
      const cat = normalizeCategory(found?.category || "", d.itemModel || "");
      if (!cat) return;

      const dMonth = extractYearMonth(d.dispatchDate) || last4Months[3].key;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const qty = parseInt(d.dispatchedQty) || 0;
      if (row.totalQty === 0) {
        if (dMonth === last4Months[0].key) row.m0 += qty;
        else if (dMonth === last4Months[1].key) row.m1 += qty;
        else if (dMonth === last4Months[2].key) row.m2 += qty;
        else if (dMonth === last4Months[3].key) row.m3 += qty;
        row.totalQty += qty;
      }
    });

    // 4. Include categories from existing remarks
    (crmPartyRemarks || []).forEach(r => {
      const matchP = r.partyId === party.id || (r.partyName && r.partyName.trim().toLowerCase() === (party.name || "").trim().toLowerCase());
      if (matchP && r.category) {
        const cat = normalizeCategory(r.category);
        if (cat && !map.has(cat)) {
          map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty || a.category.localeCompare(b.category));
  }, [partyCategoryMonthlySales, salesOrders, crmPartyRemarks, items, party, last4Months]);

  const partyCategoryTotals = useMemo(() => {
    return partyCategoryRows.reduce((acc, r) => {
      acc.m0 += (r.m0 || 0);
      acc.m1 += (r.m1 || 0);
      acc.m2 += (r.m2 || 0);
      acc.m3 += (r.m3 || 0);
      acc.totalQty += (r.totalQty || 0);
      acc.totalRevenue += (r.totalRevenue || 0);
      return acc;
    }, { m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
  }, [partyCategoryRows]);

  const totalSpend = useMemo(() => {
    return partyCategoryRows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0) || last4MoOrders.reduce((a, b) => a + (parseFloat(b.totalInr) || 0), 0);
  }, [partyCategoryRows, last4MoOrders]);

  const totalCalculatedDispatchedQty = useMemo(() => {
    const fromRows = partyCategoryRows.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    return Math.max(fromRows, last4MoDispatchedQty);
  }, [partyCategoryRows, last4MoDispatchedQty]);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(6px)" }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "960px", width: "100%", maxHeight: "94vh", overflowY: "auto", margin: "auto", WebkitOverflowScrolling: "touch" }}>
        
        {/* Header (Center Aligned) */}
        <div style={{ position: "relative", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", textAlign: "center" }}>
          <div style={{ padding: "0 30px" }}>
            <span className="badge badge-primary" style={{ marginBottom: "6px", fontSize: "0.72rem", display: "inline-block" }}>Party Performance & Remarks Studio</span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--primary)", margin: 0, textAlign: "center" }}>{party.name}</h2>
            {([party.city, party.state].filter(Boolean).length > 0 || party.contactPerson || party.phone) && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "4px", textAlign: "center" }}>
                {[party.city, party.state].filter(Boolean).length > 0 && (
                  <span><MapPin size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} />{[party.city, party.state].filter(Boolean).join(", ")}</span>
                )}
                {(party.contactPerson || party.phone) && (
                  <span>{[party.city, party.state].filter(Boolean).length > 0 ? " • " : ""}Contact: {[party.contactPerson, party.phone ? `(${party.phone})` : ""].filter(Boolean).join(" ")}</span>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            style={{ position: "absolute", right: "0px", top: "0px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
            title="Close modal"
          >
            <X size={22} />
          </button>
        </div>

        {/* Overview Stats (Last 4 Months) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: "8px", marginBottom: "14px" }}>
          <div className="glass-panel" style={{ padding: "8px 6px", textAlign: "center", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Ordered (4-Mo)</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)" }}>{last4MoOrders.length} Orders</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{last4MoOrderedQty.toLocaleString()} Pcs</div>
          </div>
          <div className="glass-panel" style={{ padding: "8px 6px", textAlign: "center", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Dispatched</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f59e0b" }}>{totalCalculatedDispatchedQty.toLocaleString()} Pcs</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>4-Month Sales</div>
          </div>
          <div className="glass-panel" style={{ padding: "8px 6px", textAlign: "center", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Active Categories</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#a855f7" }}>{partyCategoryRows.filter(r => r.totalQty > 0).length} Cat.</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Portfolio Breadth</div>
          </div>
        </div>

        {/* Tab Switcher inside Party Modal (Center Aligned) */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <button
            onClick={() => setModalTab("category_matrix")}
            className={`tab-btn ${modalTab === "category_matrix" ? "active" : ""}`}
            style={{ fontSize: "0.82rem", padding: "8px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: 700, whiteSpace: "nowrap", flex: "1 1 180px" }}
          >
            <MessageSquare size={13} /> 4-Month Category Sales & Remarks
          </button>
          <button
            onClick={() => setModalTab("orders")}
            className={`tab-btn ${modalTab === "orders" ? "active" : ""}`}
            style={{ fontSize: "0.82rem", padding: "8px 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap", flex: "1 1 180px" }}
          >
            <FileText size={13} /> Order History ({salesOrders.length})
          </button>
        </div>

        {/* TAB 1: 4-Month Category-Wise Sales & Remarks Matrix */}
        {modalTab === "category_matrix" && (
          <div>
            {/* Desktop Spreadsheet Table View */}
            <div className="desktop-table-view">
              <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Track 4-month order & dispatch volumes and record category-wise field remarks.
                </span>
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", borderRadius: "10px", border: "1px solid var(--border-glass)" }}>
                <table className="table" style={{ width: "100%", minWidth: "580px", fontSize: "0.82rem", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>Category</th>
                      <th style={{ width: "11%", textAlign: "right" }}>{last4Months[0].label}</th>
                      <th style={{ width: "11%", textAlign: "right" }}>{last4Months[1].label}</th>
                      <th style={{ width: "11%", textAlign: "right" }}>{last4Months[2].label}</th>
                      <th style={{ width: "12%", textAlign: "right", color: "var(--primary)" }}>{last4Months[3].label} (Current)</th>
                      <th style={{ width: "12%", textAlign: "right" }}>4-Mo Total</th>
                      <th style={{ width: "23%", textAlign: "center" }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Grand Total Summary Row */}
                    <tr style={{ background: "rgba(56, 189, 248, 0.12)", borderBottom: "2px solid rgba(56, 189, 248, 0.35)", fontWeight: 800 }}>
                      <td style={{ padding: "10px 12px" }}>
                        <strong style={{ color: "#38bdf8", fontSize: "0.92rem", letterSpacing: "0.5px" }}>TOTAL</strong>
                      </td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 800 }}>
                        {partyCategoryTotals.m0 > 0 ? `${partyCategoryTotals.m0.toLocaleString()} Pcs` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 800 }}>
                        {partyCategoryTotals.m1 > 0 ? `${partyCategoryTotals.m1.toLocaleString()} Pcs` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 800 }}>
                        {partyCategoryTotals.m2 > 0 ? `${partyCategoryTotals.m2.toLocaleString()} Pcs` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 800 }}>
                        {partyCategoryTotals.m3 > 0 ? `${partyCategoryTotals.m3.toLocaleString()} Pcs` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "#38bdf8", fontWeight: 900, fontSize: "0.92rem" }}>
                        {partyCategoryTotals.totalQty > 0 ? `${partyCategoryTotals.totalQty.toLocaleString()} Pcs` : "0 Pcs"}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        —
                      </td>
                    </tr>

                    {partyCategoryRows.map(row => {
                      const categoryRemarks = (crmPartyRemarks || []).filter(r => 
                        matchParty(r.partyName, party.name, r.partyId, party.id) && 
                        (r.category === row.category || 
                         normalizeCategory(r.category) === row.category ||
                         (row.category === "Polymer Batteries" && (r.category || "").toLowerCase().includes("polymer")) ||
                         (row.category === "Eco Battery" && (r.category || "").toLowerCase().includes("eco")))
                      );
                      const latest = categoryRemarks[0];

                      return (
                        <tr key={row.category}>
                          <td>
                            <strong style={{ color: "var(--text-main)" }}>{row.category}</strong>
                          </td>
                          <td style={{ textAlign: "right", color: row.m0 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                            {row.m0 > 0 ? `${row.m0.toLocaleString()} Pcs` : "—"}
                          </td>
                          <td style={{ textAlign: "right", color: row.m1 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                            {row.m1 > 0 ? `${row.m1.toLocaleString()} Pcs` : "—"}
                          </td>
                          <td style={{ textAlign: "right", color: row.m2 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                            {row.m2 > 0 ? `${row.m2.toLocaleString()} Pcs` : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: row.m3 > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                            {row.m3 > 0 ? `${row.m3.toLocaleString()} Pcs` : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: row.totalQty > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                            {row.totalQty > 0 ? `${row.totalQty.toLocaleString()} Pcs` : "0 Pcs"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch" }}>
                              {latest && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left", padding: "6px 8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: latest.authorRole === "asm" ? "#34d399" : latest.authorRole === "tsm" ? "#fbbf24" : "#818cf8" }}>
                                      {latest.authorName} ({latest.authorRole?.toUpperCase()})
                                    </span>
                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                      {latest.createdAt ? new Date(latest.createdAt).toLocaleDateString("en-IN") : latest.month}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "0.76rem", color: "var(--text-main)", lineHeight: 1.3 }}>
                                    "{latest.remark}"
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => setActiveRemarkModalTarget({
                                  partyId: party.id,
                                  partyName: party.name,
                                  category: row.category,
                                  month: last4Months[3].key,
                                  totalOrderQty: row.totalQty,
                                  totalRevenue: row.totalRevenue
                                })}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.74rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", color: categoryRemarks.length > 0 ? "#38bdf8" : undefined, width: "100%" }}
                              >
                                <MessageSquare size={12} /> {categoryRemarks.length > 0 ? `Remarks (${categoryRemarks.length})` : "+ Add Remark"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View (100% Clear Visibility on Phone) */}
            <div className="mobile-card-view" style={{ gap: "10px" }}>
              {/* Grand Total Card */}
              <div className="glass-panel" style={{ padding: "12px", borderRadius: "12px", border: "1px solid rgba(56, 189, 248, 0.4)", background: "rgba(56, 189, 248, 0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.92rem", letterSpacing: "0.5px" }}>TOTAL SALES (4-MO)</span>
                  <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: "1.05rem" }}>{partyCategoryTotals.totalQty.toLocaleString()} Pcs</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", textAlign: "center" }}>
                  <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{last4Months[0].label}</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>{partyCategoryTotals.m0 > 0 ? partyCategoryTotals.m0.toLocaleString() : "—"}</div>
                  </div>
                  <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{last4Months[1].label}</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>{partyCategoryTotals.m1 > 0 ? partyCategoryTotals.m1.toLocaleString() : "—"}</div>
                  </div>
                  <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{last4Months[2].label}</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>{partyCategoryTotals.m2 > 0 ? partyCategoryTotals.m2.toLocaleString() : "—"}</div>
                  </div>
                  <div style={{ background: "rgba(56, 189, 248, 0.15)", padding: "6px 2px", borderRadius: "6px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--primary)", fontWeight: 700 }}>{last4Months[3].label}</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--primary)" }}>{partyCategoryTotals.m3 > 0 ? partyCategoryTotals.m3.toLocaleString() : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Individual Category Cards */}
              {partyCategoryRows.map(row => {
                const categoryRemarks = (crmPartyRemarks || []).filter(r => 
                  matchParty(r.partyName, party.name, r.partyId, party.id) && 
                  (r.category === row.category || 
                   normalizeCategory(r.category) === row.category ||
                   (row.category === "Polymer Batteries" && (r.category || "").toLowerCase().includes("polymer")) ||
                   (row.category === "Eco Battery" && (r.category || "").toLowerCase().includes("eco")))
                );
                const latest = categoryRemarks[0];

                return (
                  <div key={row.category} className="glass-panel" style={{ padding: "12px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--border-glass)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>{row.category}</strong>
                      <span className="badge badge-primary" style={{ fontSize: "0.78rem", fontWeight: 800 }}>
                        {row.totalQty > 0 ? `${row.totalQty.toLocaleString()} Pcs` : "0 Pcs"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", textAlign: "center" }}>
                      <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "5px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                        <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>{last4Months[0].label}</div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: row.m0 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>{row.m0 > 0 ? row.m0.toLocaleString() : "—"}</div>
                      </div>
                      <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "5px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                        <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>{last4Months[1].label}</div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: row.m1 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>{row.m1 > 0 ? row.m1.toLocaleString() : "—"}</div>
                      </div>
                      <div style={{ background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "5px 2px", borderRadius: "6px", border: "1px solid var(--border-glass)" }}>
                        <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>{last4Months[2].label}</div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: row.m2 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>{row.m2 > 0 ? row.m2.toLocaleString() : "—"}</div>
                      </div>
                      <div style={{ background: "rgba(56, 189, 248, 0.1)", padding: "5px 2px", borderRadius: "6px", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                        <div style={{ fontSize: "0.64rem", color: "var(--primary)", fontWeight: 700 }}>{last4Months[3].label}</div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: row.m3 > 0 ? "var(--primary)" : "var(--text-muted)" }}>{row.m3 > 0 ? row.m3.toLocaleString() : "—"}</div>
                      </div>
                    </div>

                    {latest && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left", padding: "6px 8px", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: latest.authorRole === "asm" ? "#10b981" : latest.authorRole === "tsm" ? "#f59e0b" : "#818cf8" }}>
                            {latest.authorName} ({latest.authorRole?.toUpperCase()})
                          </span>
                          <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                            {latest.createdAt ? new Date(latest.createdAt).toLocaleDateString("en-IN") : latest.month}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-main)", lineHeight: 1.3 }}>
                          "{latest.remark}"
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setActiveRemarkModalTarget({
                        partyId: party.id,
                        partyName: party.name,
                        category: row.category,
                        month: last4Months[3].key,
                        totalOrderQty: row.totalQty,
                        totalRevenue: row.totalRevenue
                      })}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.76rem", padding: "6px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", color: categoryRemarks.length > 0 ? "var(--primary)" : undefined, width: "100%", fontWeight: 600 }}
                    >
                      <MessageSquare size={12} /> {categoryRemarks.length > 0 ? `Remarks (${categoryRemarks.length})` : "+ Add Remark"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Order History & Dispatches */}
        {modalTab === "orders" && (
          <div>
            {/* Desktop View */}
            <div className="desktop-table-view" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", borderRadius: "10px", border: "1px solid var(--border-glass)" }}>
              <table className="table" style={{ width: "100%", minWidth: "540px", fontSize: "0.82rem", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Order / Ref No</th>
                    <th>Item Model</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    {canViewFinancials && <th>Total (₹)</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOrders.length === 0 ? (
                    <tr>
                      <td colSpan={canViewFinancials ? 6 : 5} style={{ textAlign: "center", padding: "26px", color: "var(--text-muted)" }}>
                        No orders logged for this party yet.
                      </td>
                    </tr>
                  ) : (
                    salesOrders.map(o => (
                      <tr key={o.id}>
                        <td>{o.orderDate}</td>
                        <td><code>{o.orderNo}</code></td>
                        <td style={{ fontWeight: 600, color: "var(--primary)" }}>{o.itemModel}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{o.orderQty?.toLocaleString()} Pcs</td>
                        {canViewFinancials && <td style={{ fontWeight: 700, color: "var(--success)" }}>₹{(o.totalInr || 0).toLocaleString()}</td>}
                        <td><span className={`badge ${o.status === "Dispatched" ? "badge-success" : "badge-secondary"}`}>{o.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card Grid (Zero Horizontal Scroll) */}
            <div className="mobile-card-view" style={{ gap: "8px" }}>
              {salesOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No orders logged for this party yet.
                </div>
              ) : (
                salesOrders.map(o => (
                  <div 
                    key={o.id}
                    className="mobile-party-card glass-panel"
                    style={{ padding: "12px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "6px", border: "1px solid var(--border-glass)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.92rem" }}>{o.itemModel}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          <code>{o.orderNo}</code> • <span>{o.orderDate}</span>
                        </div>
                      </div>
                      <span className={`badge ${o.status === "Dispatched" ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "0.7rem" }}>
                        {o.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover, rgba(0,0,0,0.03))", padding: "6px 8px", borderRadius: "6px", fontSize: "0.78rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Quantity:</span>
                      <strong style={{ fontSize: "0.86rem" }}>{o.orderQty?.toLocaleString()} Pcs</strong>
                    </div>

                    {canViewFinancials && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Total Value:</span>
                        <strong style={{ color: "var(--success)" }}>₹{(o.totalInr || 0).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sub-modal for Remark creation inside Party 360 */}
        {activeRemarkModalTarget && (
          <PartyCategoryRemarkModal
            target={activeRemarkModalTarget}
            remarks={(crmPartyRemarks || []).filter(r => 
              matchParty(r.partyName, activeRemarkModalTarget.partyName, r.partyId, activeRemarkModalTarget.partyId) && 
              (r.category === activeRemarkModalTarget.category || 
               normalizeCategory(r.category) === activeRemarkModalTarget.category || 
               (activeRemarkModalTarget.category === "Polymer" && (r.category || "").toLowerCase().includes("polymer")))
            )}
            currentUser={currentUser}
            onSave={async (text) => {
              if (onSavePartyRemark) {
                await onSavePartyRemark({
                  partyId: activeRemarkModalTarget.partyId,
                  partyName: activeRemarkModalTarget.partyName,
                  category: activeRemarkModalTarget.category,
                  month: activeRemarkModalTarget.month,
                  remark: text,
                  authorId: currentUser?.id,
                  authorName: currentUser?.name || "ASM/TSM",
                  authorRole: currentUser?.role || "asm"
                });
              }
            }}
            onDelete={onDeletePartyRemark}
            onClose={() => setActiveRemarkModalTarget(null)}
          />
        )}

      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY 4-MONTH CATEGORY STUDIO MODAL ====================
function PartyMonthlyCategoryStudioModal({
  party,
  salesOrders = [],
  dispatches = [],
  crmPartyRemarks = [],
  partyCategoryMonthlySales = [],
  partyCategoryMonths = [],
  items = [],
  currentUser,
  onSavePartyRemark,
  onDeletePartyRemark,
  canViewFinancials = false,
  formatInr,
  onClose
}) {
  const [remarkInputs, setRemarkInputs] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);
  const [historyCategoryTarget, setHistoryCategoryTarget] = useState(null);
  const { showSuccessToast, showErrorToast } = useLoading();

  // Dynamic Last 4 Months e.g. [Jun 26, Jul 26, Aug 26, Sep 26]
  const last4Months = useMemo(() => {
    if (partyCategoryMonths && partyCategoryMonths.length === 4) {
      return partyCategoryMonths;
    }
    const months = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${yr}-${mo}`;
      const monthName = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const fullMonthName = d.toLocaleDateString("en-IN", { month: "long" });
      months.push({ key, monthName, fullMonthName, label: monthName });
    }
    return months;
  }, [partyCategoryMonths]);

  // Helper to extract YYYY-MM from any date format (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, etc.)
  const extractYearMonth = (dateVal) => {
    if (!dateVal) return "";
    const s = String(dateVal).trim();
    // YYYY-MM-DD or YYYY/MM/DD
    const yyyymm = s.match(/^(\d{4})[-/.](\d{1,2})/);
    if (yyyymm) {
      return `${yyyymm[1]}-${yyyymm[2].padStart(2, "0")}`;
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      const mo = String(parsed.getMonth() + 1).padStart(2, "0");
      return `${yr}-${mo}`;
    }
    return "";
  };

  // Category rows for this party across the last 4 months (FG only, Polymer merged)
  const categoryMatrixRows = useMemo(() => {
    const map = new Map();

    // Standard Makpower FG Categories with Polymer
    const standardFgCategories = [
      "Fast Charger", "Data Cable", "Neckband", "TWS Earbuds", 
      "Polymer", "Power Bank", "Earphones", "Batteries", 
      "Speaker", "Smart Watch", "Car Charger", "Mobile Accessories"
    ];

    standardFgCategories.forEach(cat => {
      map.set(cat, {
        category: cat,
        m0: 0,
        m1: 0,
        m2: 0,
        m3: 0,
        totalQty: 0,
        totalRevenue: 0
      });
    });

    // 1. Populate from server-precalculated partyCategoryMonthlySales
    const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const partyNorm = norm(party?.name);
    const relevantSales = (partyCategoryMonthlySales || []).filter(s => {
      const sNorm = norm(s.partyName);
      return (party?.id && s.partyId === party.id) || sNorm === partyNorm || (sNorm && partyNorm && (sNorm.includes(partyNorm) || partyNorm.includes(sNorm)));
    });

    relevantSales.forEach(s => {
      const cat = normalizeCategory(s.category);
      if (!cat) return;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const qty = parseInt(s.salesQty) || 0;
      if (s.month === last4Months[0].key) row.m0 += qty;
      else if (s.month === last4Months[1].key) row.m1 += qty;
      else if (s.month === last4Months[2].key) row.m2 += qty;
      else if (s.month === last4Months[3].key) row.m3 += qty;
      row.totalQty += qty;
      row.totalRevenue += parseFloat(s.salesRevenue) || 0;
    });

    // 2. Populate from sales orders if row has 0
    (salesOrders || []).forEach(o => {
      let rawCat = o.category;
      if (!rawCat || rawCat === "General" || rawCat === "Unspecified") {
        const found = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        rawCat = found?.category || "";
      }
      const cat = normalizeCategory(rawCat, o.itemModel || "");
      if (!cat) return;

      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const oMonth = extractYearMonth(o.orderDate) || last4Months[3].key;
      const qty = parseInt(o.orderQty) || 0;

      if (row.totalQty === 0) {
        if (oMonth === last4Months[0].key) row.m0 += qty;
        else if (oMonth === last4Months[1].key) row.m1 += qty;
        else if (oMonth === last4Months[2].key) row.m2 += qty;
        else if (oMonth === last4Months[3].key) row.m3 += qty;
        row.totalQty += qty;
      }
      row.totalRevenue += parseFloat(o.totalInr) || 0;
    });

    // 3. Populate from client dispatches if row has 0
    (dispatches || []).forEach(d => {
      const found = items.find(it => it.name === d.itemModel || it.id === d.itemId || it.id === String(d.itemId).replace(/^#+/, ""));
      const cat = normalizeCategory(found?.category || "", d.itemModel || "");
      if (!cat) return;

      if (!map.has(cat)) {
        map.set(cat, { category: cat, m0: 0, m1: 0, m2: 0, m3: 0, totalQty: 0, totalRevenue: 0 });
      }
      const row = map.get(cat);
      const dMonth = extractYearMonth(d.dispatchDate) || last4Months[3].key;
      const qty = parseInt(d.dispatchedQty) || 0;

      if (row.totalQty === 0) {
        if (dMonth === last4Months[0].key) row.m0 += qty;
        else if (dMonth === last4Months[1].key) row.m1 += qty;
        else if (dMonth === last4Months[2].key) row.m2 += qty;
        else if (dMonth === last4Months[3].key) row.m3 += qty;
        row.totalQty += qty;
      }
    });

    // 4. Merge from party precalculated category history if present
    if (party.categorySales && typeof party.categorySales === "object") {
      Object.entries(party.categorySales).forEach(([cName, cData]) => {
        const cat = normalizeCategory(cName);
        if (cat && map.has(cat) && typeof cData === "object") {
          const row = map.get(cat);
          if (row.totalQty === 0) {
            if (cData[last4Months[0].key]) row.m0 += parseInt(cData[last4Months[0].key]) || 0;
            if (cData[last4Months[1].key]) row.m1 += parseInt(cData[last4Months[1].key]) || 0;
            if (cData[last4Months[2].key]) row.m2 += parseInt(cData[last4Months[2].key]) || 0;
            if (cData[last4Months[3].key]) row.m3 += parseInt(cData[last4Months[3].key]) || 0;
            row.totalQty = row.m0 + row.m1 + row.m2 + row.m3;
          }
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty || a.category.localeCompare(b.category));
  }, [partyCategoryMonthlySales, salesOrders, dispatches, items, last4Months, party]);

  // Live list of all remarks matching this party
  const allPartyRemarks = useMemo(() => {
    return (crmPartyRemarks || []).filter(r => matchParty(r.partyName, party?.name, r.partyId, party?.id));
  }, [crmPartyRemarks, party]);

  const matchRemarkToCategory = (rCat, targetCat) => {
    if (!targetCat || targetCat === "All") return true;
    const catClean = (rCat || "").trim().toLowerCase();
    const targetClean = (targetCat || "").trim().toLowerCase();
    if (targetClean === "general" || targetClean === "uncategorized") {
      return !catClean || catClean === "general" || catClean === "uncategorized" || catClean === "account" || catClean === "others";
    }
    if (catClean === targetClean) return true;
    if (targetCat === "Polymer" && catClean.includes("polymer")) return true;
    const norm = normalizeCategory(rCat);
    return norm.toLowerCase() === targetClean;
  };

  const [generalRemarkText, setGeneralRemarkText] = useState("");
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  const handleSaveGeneralRemark = async () => {
    const text = generalRemarkText.trim();
    if (!text) return;
    setIsSavingGeneral(true);
    try {
      if (onSavePartyRemark) {
        await onSavePartyRemark({
          partyId: party.id,
          partyName: party.name,
          category: "General",
          month: last4Months[3].key,
          remark: text,
          authorId: currentUser?.id,
          authorName: currentUser?.name || "Team Member",
          authorRole: currentUser?.role || "crm"
        });
      }
      setGeneralRemarkText("");
      showSuccessToast(`✅ Remark saved for ${party.name}!`);
    } catch (err) {
      showErrorToast(err.message || "Failed to save remark.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveCategoryRemark = async (catName) => {
    const text = (remarkInputs[catName] || "").trim();
    if (!text) return;
    setSavingCategory(catName);
    try {
      if (onSavePartyRemark) {
        await onSavePartyRemark({
          partyId: party.id,
          partyName: party.name,
          category: catName,
          month: last4Months[3].key,
          remark: text,
          authorId: currentUser?.id,
          authorName: currentUser?.name || "Team Member",
          authorRole: currentUser?.role || "crm"
        });
      }
      setRemarkInputs(prev => ({ ...prev, [catName]: "" }));
      showSuccessToast(`✅ Remark saved for ${catName}!`);
    } catch (err) {
      showErrorToast(err.message || "Failed to save remark.");
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(5px)" }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "1150px", width: "100%", padding: "26px", maxHeight: "90vh", overflowY: "auto", margin: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="badge badge-primary" style={{ fontWeight: 800 }}>
                4-Month Category & Remarks Studio
              </span>
              {[party.city, party.state].filter(Boolean).length > 0 && (
                <span className="badge badge-secondary">
                  {[party.city, party.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              {party.name}
            </h2>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Assigned CRM: <strong style={{ color: "#a5b4fc" }}>{party.assignedCrmName || "Unassigned"}</strong>
              {party.assignedAsmName && <span> • ASM: <strong style={{ color: "#6ee7b7" }}>{party.assignedAsmName}</strong></span>}
              {party.assignedTsmName && <span> • TSM: <strong style={{ color: "#fcd34d" }}>{party.assignedTsmName}</strong></span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={22} /></button>
        </div>

        {/* Remarks Activity Feed & Quick Add Banner */}
        <div style={{
          background: "rgba(56, 189, 248, 0.04)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={17} style={{ color: "#38bdf8" }} />
              <strong style={{ fontSize: "1rem", color: "var(--text-main)" }}>
                Recorded Remarks for {party.name}
              </strong>
              <span className="badge" style={{
                background: allPartyRemarks.length > 0 ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                color: allPartyRemarks.length > 0 ? "#38bdf8" : "var(--text-muted)",
                fontWeight: 800,
                fontSize: "0.8rem",
                padding: "3px 10px"
              }}>
                {allPartyRemarks.length} {allPartyRemarks.length === 1 ? "Remark" : "Remarks"}
              </span>
            </div>

            {allPartyRemarks.length > 0 && (
              <button
                onClick={() => setHistoryCategoryTarget({
                  partyId: party.id,
                  partyName: party.name,
                  category: "All",
                  remarks: allPartyRemarks
                })}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.78rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <Clock size={13} /> View Full Log ({allPartyRemarks.length})
              </button>
            )}
          </div>

          {/* Quick Add General / Party Remark Form */}
          <div style={{ display: "flex", gap: "8px", marginBottom: allPartyRemarks.length > 0 ? "14px" : "0" }}>
            <input
              type="text"
              placeholder={`Add general remark for ${party.name} (e.g. payment follow-up, meeting notes, sales discussion)...`}
              value={generalRemarkText}
              onChange={e => setGeneralRemarkText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSaveGeneralRemark();
              }}
              className="form-control"
              style={{ height: "38px", fontSize: "0.84rem", flex: 1 }}
            />
            <button
              onClick={handleSaveGeneralRemark}
              disabled={isSavingGeneral || !generalRemarkText.trim()}
              className="btn btn-primary"
              style={{ height: "38px", padding: "0 16px", fontSize: "0.82rem", whiteSpace: "nowrap", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Send size={13} /> Add Remark
            </button>
          </div>

          {/* Live List of Recorded Remarks */}
          {allPartyRemarks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "0.84rem" }}>
              No remarks recorded for this party yet. Type a remark above or in any category row below to add one.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
              {allPartyRemarks.map(r => {
                const isAuthor = currentUser?.id === r.authorId || currentUser?.name === r.authorName;
                const canDelete = isAuthor || currentUser?.role === "superadmin" || currentUser?.role === "crm" || currentUser?.role === "owner";
                return (
                  <div key={r.id} style={{ background: "var(--bg-card-hover, rgba(255, 255, 255, 0.04))", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <span className="badge" style={{ fontSize: "0.7rem", padding: "2px 8px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 700 }}>
                          🏷️ {r.category || "General"}
                        </span>
                        <span className="badge" style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          background: r.authorRole === "asm" ? "rgba(16, 185, 129, 0.15)" : r.authorRole === "tsm" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)",
                          color: r.authorRole === "asm" ? "#34d399" : r.authorRole === "tsm" ? "#fbbf24" : "#a5b4fc",
                          fontWeight: 700
                        }}>
                          {r.authorName} ({r.authorRole?.toUpperCase()})
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                          📅 {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : (r.month || "")}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.45, wordBreak: "break-word" }}>
                        {r.remark}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        onClick={async () => {
                          if (window.confirm("Delete this remark?")) {
                            try {
                              if (onDeletePartyRemark) await onDeletePartyRemark(r.id);
                              showSuccessToast("Remark deleted.");
                            } catch (err) {
                              showErrorToast("Failed to delete remark.");
                            }
                          }
                        }}
                        className="btn btn-secondary btn-sm"
                        title="Delete remark"
                        style={{ padding: "4px 6px", fontSize: "0.7rem", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4-Month Category Matrix Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.85rem", minWidth: "950px" }}>
            <thead>
              <tr>
                <th style={{ width: "18%" }}>Category</th>
                <th style={{ width: "10%", textAlign: "right" }}>{last4Months[0].monthName}</th>
                <th style={{ width: "10%", textAlign: "right" }}>{last4Months[1].monthName}</th>
                <th style={{ width: "10%", textAlign: "right" }}>{last4Months[2].monthName}</th>
                <th style={{ width: "10%", textAlign: "right" }}>{last4Months[3].monthName}</th>
                <th style={{ width: "30%" }}>Add Remarks ({last4Months[3].monthName})</th>
                <th style={{ width: "12%", textAlign: "center" }}>Remarks History</th>
              </tr>
            </thead>
            <tbody>
              {categoryMatrixRows.map(row => {
                const categoryRemarks = allPartyRemarks.filter(r => matchRemarkToCategory(r.category, row.category));

                return (
                  <tr key={row.category}>
                    <td>
                      <strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>{row.category}</strong>
                    </td>
                    <td style={{ textAlign: "right", color: row.m0 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                      {row.m0 > 0 ? `${row.m0.toLocaleString()} Pcs` : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: row.m1 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                      {row.m1 > 0 ? `${row.m1.toLocaleString()} Pcs` : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: row.m2 > 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                      {row.m2 > 0 ? `${row.m2.toLocaleString()} Pcs` : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: row.m3 > 0 ? "var(--primary)" : "var(--text-muted)", fontWeight: row.m3 > 0 ? 800 : 500 }}>
                      {row.m3 > 0 ? `${row.m3.toLocaleString()} Pcs` : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder={`Add remark for ${row.category}...`}
                          value={remarkInputs[row.category] || ""}
                          onChange={e => setRemarkInputs(prev => ({ ...prev, [row.category]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleSaveCategoryRemark(row.category);
                          }}
                          className="form-control"
                          style={{ height: "34px", fontSize: "0.82rem", flex: 1 }}
                        />
                        <button
                          onClick={() => handleSaveCategoryRemark(row.category)}
                          disabled={savingCategory === row.category || !(remarkInputs[row.category] || "").trim()}
                          className="btn btn-primary btn-sm"
                          style={{ height: "34px", padding: "0 10px", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                        >
                          <Send size={12} /> Save
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => setHistoryCategoryTarget({
                          partyId: party.id,
                          partyName: party.name,
                          category: row.category,
                          remarks: categoryRemarks
                        })}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: "0.76rem",
                          padding: "4px 8px",
                          color: categoryRemarks.length > 0 ? "#38bdf8" : undefined,
                          borderColor: categoryRemarks.length > 0 ? "rgba(56, 189, 248, 0.4)" : undefined,
                          background: categoryRemarks.length > 0 ? "rgba(56, 189, 248, 0.08)" : undefined,
                          fontWeight: categoryRemarks.length > 0 ? 700 : 500,
                          whiteSpace: "nowrap"
                        }}
                      >
                        <Clock size={12} /> Show Remarks History ({categoryRemarks.length})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sub-modal: Historical Remarks Dialog */}
        {historyCategoryTarget && (
          <CategoryRemarksHistoryModal
            target={historyCategoryTarget}
            crmPartyRemarks={crmPartyRemarks}
            currentUser={currentUser}
            onDelete={onDeletePartyRemark}
            onClose={() => setHistoryCategoryTarget(null)}
          />
        )}
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: CATEGORY REMARKS HISTORY MODAL ====================
function CategoryRemarksHistoryModal({ target, crmPartyRemarks = [], currentUser, onDelete, onClose }) {
  const { showSuccessToast, showErrorToast } = useLoading();
  const [deletedIds, setDeletedIds] = useState(new Set());

  // Compute live list of remarks from crmPartyRemarks or target snapshot, filtering out deleted
  const activeRemarks = useMemo(() => {
    let list = [];
    if (crmPartyRemarks && crmPartyRemarks.length > 0) {
      list = crmPartyRemarks.filter(r => {
        const matchesParty = matchParty(r.partyName, target.partyName, r.partyId, target.partyId);
        if (!matchesParty) return false;
        if (!target.category || target.category === "All") return true;
        const targetClean = target.category.trim().toLowerCase();
        const rCatClean = (r.category || "").trim().toLowerCase();
        if (targetClean === "general" || targetClean === "uncategorized") {
          return !rCatClean || rCatClean === "general" || rCatClean === "uncategorized" || rCatClean === "account" || rCatClean === "others";
        }
        if (rCatClean === targetClean) return true;
        if (target.category === "Polymer" && rCatClean.includes("polymer")) return true;
        const norm = normalizeCategory(r.category);
        return norm.toLowerCase() === targetClean;
      });
    }
    if (list.length === 0 && target.remarks && target.remarks.length > 0) {
      list = target.remarks;
    }
    return list.filter(r => !deletedIds.has(r.id));
  }, [crmPartyRemarks, target, deletedIds]);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(5px)" }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", width: "100%", padding: "24px", maxHeight: "85vh", display: "flex", flexDirection: "column", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 800 }}>
                {target.category}
              </span>
              <span className="badge badge-secondary">Remarks History ({activeRemarks.length})</span>
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              {target.partyName}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", padding: "4px" }}>
          {activeRemarks.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
              <MessageSquare size={32} style={{ marginBottom: "8px", opacity: 0.4 }} />
              <p style={{ fontSize: "0.85rem", margin: 0 }}>No past remarks recorded for this category yet.</p>
            </div>
          ) : (
            activeRemarks.map(r => {
              const isAuthor = currentUser?.id === r.authorId || currentUser?.name === r.authorName;
              const canDelete = isAuthor || currentUser?.role === "superadmin" || currentUser?.role === "crm" || currentUser?.role === "owner";

              return (
                <div key={r.id} style={{ background: "var(--bg-card, rgba(255,255,255,0.03))", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="badge" style={{
                        background: r.authorRole === "asm" ? "rgba(16, 185, 129, 0.15)" : r.authorRole === "tsm" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: r.authorRole === "asm" ? "#34d399" : r.authorRole === "tsm" ? "#fbbf24" : "#818cf8",
                        fontWeight: 700,
                        fontSize: "0.72rem"
                      }}>
                        {r.authorName} ({r.authorRole?.toUpperCase()})
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        📅 {r.month || (r.createdAt ? r.createdAt.slice(0, 7) : "")}
                      </span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={async () => {
                          if (window.confirm("Delete this remark?")) {
                            try {
                              setDeletedIds(prev => new Set([...prev, r.id]));
                              if (onDelete) await onDelete(r.id);
                              showSuccessToast("Remark deleted.");
                            } catch (err) {
                              showErrorToast("Failed to delete remark.");
                            }
                          }
                        }}
                        style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "2px" }}
                        title="Delete Remark"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: "0.86rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                    "{r.remark}"
                  </div>

                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", alignSelf: "flex-end" }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : ""}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: TRANSFER ASM / TSM TO ANOTHER CRM MODAL ====================
function TransferAsmCrmModal({ member, crmExecutives = [], allParties = [], onTransfer, onClose }) {
  const currentParentId = member?.parentCrmId || (member?.name?.toLowerCase().includes("ashutosh") ? "u-ankita" : "");
  const currentCrm = crmExecutives.find(c => c.id === currentParentId) || { name: currentParentId === "u-ankita" ? "Ankita" : "Unassigned", id: currentParentId };
  
  const destinationOptions = crmExecutives.filter(c => c.id !== currentParentId);
  const [targetCrmId, setTargetCrmId] = useState(destinationOptions[0]?.id || "");
  const [transferPartiesToo, setTransferPartiesToo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const mId = member?.id;
  const mName = (member?.name || "").trim().toLowerCase();
  const assignedParties = allParties.filter(p => {
    if (member?.role === "asm") {
      return p.assignedAsmId === mId || (p.assignedAsmName && p.assignedAsmName.trim().toLowerCase() === mName);
    } else {
      return p.assignedTsmId === mId || (p.assignedTsmName && p.assignedTsmName.trim().toLowerCase() === mName);
    }
  });

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!targetCrmId) return;
    setSubmitting(true);
    try {
      await onTransfer(member, targetCrmId, transferPartiesToo ? assignedParties : []);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Share2 size={20} /> Transfer Sales Member to Another CRM
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "rgba(0,0,0,0.25)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border-glass)", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Sales Team Member:</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
              {member.name} <span className="badge" style={{ fontSize: "0.72rem", marginLeft: "6px" }}>{member.role?.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{member.email}</div>

            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-glass)", display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Current CRM Owner:</span>
              <strong style={{ color: "#38bdf8" }}>{currentCrm.name}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Assigned Parties:</span>
              <strong style={{ color: "var(--success)" }}>{assignedParties.length} Parties</strong>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Transfer Ownership to New CRM Executive *</label>
            <select
              value={targetCrmId}
              onChange={e => setTargetCrmId(e.target.value)}
              className="form-control"
              style={{ fontWeight: 700, color: "var(--primary)", height: "42px" }}
              required
            >
              {destinationOptions.map(c => (
                <option key={c.id} value={c.id}>
                  💼 {c.name} ({c.email})
                </option>
              ))}
            </select>
            <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
              Once transferred, only the selected CRM executive (and Admins) will see and manage this sales member.
            </small>
          </div>

          {assignedParties.length > 0 && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", background: "rgba(99, 102, 241, 0.08)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <input
                type="checkbox"
                checked={transferPartiesToo}
                onChange={e => setTransferPartiesToo(e.target.checked)}
                style={{ marginTop: "3px" }}
              />
              <span style={{ fontSize: "0.83rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                <strong>Also transfer all {assignedParties.length} assigned parties</strong> to this new CRM executive so their CRM ownership stays in sync.
              </span>
            </label>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={submitting || !targetCrmId}
              className="btn btn-primary"
              style={{ flex: 1, padding: "10px", fontWeight: 700, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <Check size={16} /> {submitting ? "Transferring..." : "Complete CRM Transfer"}
            </button>
            <button type="button" onClick={onClose} disabled={submitting} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: ASM / TSM TEAM CREATION MODAL ====================
function TeamMemberModal({ member, currentExecutive, crmExecutives = [], isAdminOrOwner = false, currentUser, onSave, onClose }) {
  const defaultParent = member?.parentCrmId || 
    (member?.name?.toLowerCase().includes("ashutosh") ? "u-ankita" : "") ||
    (currentUser?.role === "crm" ? currentUser.id : (currentExecutive?.id || "u-ankita"));

  const [name, setName] = useState(member?.name || "");
  const [email, setEmail] = useState(member?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(member?.role || "asm");
  const [phone, setPhone] = useState(member?.phone || "");
  const [territory, setTerritory] = useState(member?.territory || "");
  const [parentCrmId, setParentCrmId] = useState(defaultParent);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const effectiveParentCrmId = isAdminOrOwner 
      ? (parentCrmId || "u-ankita")
      : (currentUser?.role === "crm" ? currentUser.id : (currentExecutive?.id || "u-ankita"));

    onSave({
      ...(member || {}),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim() || (member ? member.password : "MakPower#Sales2026!"),
      role,
      designation: role === "asm" ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)",
      phone: phone.trim(),
      territory: territory.trim(),
      parentCrmId: effectiveParentCrmId
    });
  };

  const assignedCrmObj = crmExecutives.find(c => c.id === (isAdminOrOwner ? parentCrmId : (currentUser?.role === "crm" ? currentUser.id : defaultParent)));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <UserPlus size={20} /> {member ? "Edit Sales Team Account" : "Create ASM / TSM Sales Member"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {isAdminOrOwner ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>Assigned CRM Executive *</label>
              <select
                value={parentCrmId}
                onChange={e => setParentCrmId(e.target.value)}
                className="form-control"
                style={{ fontWeight: 600 }}
              >
                {crmExecutives.map(c => (
                  <option key={c.id} value={c.id}>
                    💼 {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <small style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: "2px", display: "block" }}>
                This sales member will strictly belong to and be visible only under this CRM.
              </small>
            </div>
          ) : (
            <div style={{ padding: "8px 12px", background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              💼 Owning CRM: <strong style={{ color: "var(--primary)" }}>{assignedCrmObj?.name || currentUser?.name || "My CRM"}</strong> (Only you will see this member)
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name *</label>
            <input type="text" required placeholder="e.g. Vikram Sharma" value={name} onChange={e => setName(e.target.value)} className="form-control" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address *</label>
            <input type="email" required placeholder="e.g. user.sales@company.com" value={email} onChange={e => setEmail(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="form-control" style={{ fontWeight: 700, color: "var(--primary)" }}>
                <option value="asm">🟢 ASM (Area Sales Manager)</option>
                <option value="tsm">🟡 TSM (Territory Sales Manager)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone Number</label>
              <input type="text" placeholder="+91 98765 11001" value={phone} onChange={e => setPhone(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Assigned Territory / Region</label>
            <input type="text" placeholder="e.g. Rajasthan & Punjab" value={territory} onChange={e => setTerritory(e.target.value)} className="form-control" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{member ? "New Password (optional)" : "Account Password"}</label>
            <input type="text" placeholder={member ? "Leave blank to keep current" : "Default: Sales#2026!"} value={password} onChange={e => setPassword(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              {member ? "Save Changes" : "Create Sales Member"}
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

// ==================== SUB-COMPONENT: SALES ORDER MODAL ====================
function SalesOrderModal({ parties, items, currentExecutive, onSave, onClose }) {
  const [partyId, setPartyId] = useState(parties[0]?.id || "");
  const [itemModel, setItemModel] = useState(items[0]?.name || "");
  const [category, setCategory] = useState(items[0]?.category || "General");
  const [orderQty, setOrderQty] = useState(100);
  const [unitPriceInr, setUnitPriceInr] = useState(0);
  const [notes, setNotes] = useState("");

  const handleItemSelect = (selectedName) => {
    setItemModel(selectedName);
    const found = items.find(it => it.name === selectedName);
    if (found?.category) {
      setCategory(found.category);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const party = parties.find(p => p.id === partyId);
    if (!party) return;

    onSave({
      partyId,
      partyName: party.name,
      itemModel,
      category,
      orderQty: parseInt(orderQty) || 0,
      unitPriceInr: parseFloat(unitPriceInr) || 0,
      totalInr: (parseInt(orderQty) || 0) * (parseFloat(unitPriceInr) || 0),
      dispatchedQty: 0,
      pendingQty: parseInt(orderQty) || 0,
      status: "Pending Dispatch",
      assignedCrmId: party.assignedCrmId || currentExecutive?.id || "u-ankita",
      assignedAsmId: party.assignedAsmId || "",
      assignedTsmId: party.assignedTsmId || "",
      notes
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "550px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={20} /> Log New Party Sales Order
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Customer / Party *</label>
            <select value={partyId} onChange={e => setPartyId(e.target.value)} className="form-control" required>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item / Model *</label>
              {items && items.length > 0 ? (
                <select 
                  value={itemModel} 
                  onChange={e => handleItemSelect(e.target.value)} 
                  className="form-control" 
                  required
                >
                  <option value="">-- Select Item Model --</option>
                  {items.map(it => (
                    <option key={it.id || it.name} value={it.name}>{it.name} ({it.category || "General"})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  required 
                  value={itemModel} 
                  onChange={e => setItemModel(e.target.value)} 
                  className="form-control" 
                  placeholder="Enter item model name" 
                />
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="form-control" placeholder="e.g. Chargers" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity (Pcs) *</label>
              <input type="number" required min="1" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unit Sale Price (₹) *</label>
              <input type="number" required min="1" value={unitPriceInr} onChange={e => setUnitPriceInr(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Order Value:</span>
            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--success)" }}>
              ₹{((parseInt(orderQty) || 0) * (parseFloat(unitPriceInr) || 0)).toLocaleString()}
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Order Notes / Delivery Terms</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="form-control" placeholder="Optional notes" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              Save Sales Order
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

// ==================== SUB-COMPONENT: DISPATCH RECORD MODAL ====================
function DispatchModal({ order, onSave, onClose }) {
  const [dispatchedQty, setDispatchedQty] = useState(order.pendingQty || order.orderQty || 50);
  const [transporterName, setTransporterName] = useState("V-Trans India Ltd");
  const [docketNo, setDocketNo] = useState(`LR-${Math.floor(100000 + Math.random() * 900000)}`);
  const [invoiceNo, setInvoiceNo] = useState(`INV-MP-26-${Math.floor(1000 + Math.random() * 9000)}`);
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      orderId: order.id,
      orderNo: order.orderNo,
      partyId: order.partyId,
      partyName: order.partyName,
      itemModel: order.itemModel,
      dispatchedQty: parseInt(dispatchedQty) || 0,
      transporterName: transporterName.trim(),
      docketNo: docketNo.trim(),
      invoiceNo: invoiceNo.trim(),
      dispatchDate,
      status: "In Transit",
      assignedCrmId: order.assignedCrmId,
      assignedAsmId: order.assignedAsmId,
      assignedTsmId: order.assignedTsmId
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Truck size={20} /> Record Dispatch for {order.orderNo}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "0.85rem" }}>
            <div><strong>Party:</strong> {order.partyName}</div>
            <div><strong>Item:</strong> {order.itemModel} (Pending: {order.pendingQty} Pcs)</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dispatched Qty *</label>
              <input type="number" required min="1" max={order.pendingQty || order.orderQty} value={dispatchedQty} onChange={e => setDispatchedQty(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dispatch Date *</label>
              <input type="date" required value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="form-control" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transporter Name *</label>
              <input type="text" required placeholder="e.g. VRL Logistics" value={transporterName} onChange={e => setTransporterName(e.target.value)} className="form-control" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Docket / LR Number</label>
              <input type="text" placeholder="LR number" value={docketNo} onChange={e => setDocketNo(e.target.value)} className="form-control" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Invoice Number</label>
            <input type="text" placeholder="INV-MP-26-0000" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="form-control" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-success" style={{ flex: 1, padding: "10px", fontWeight: 700 }}>
              Confirm Dispatch Shipment
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

// ==================== SUB-COMPONENT: ASSIGN PARTIES MODAL ====================
function AssignPartiesModal({ teamMember, allParties = [], onAssign, onClose }) {
  const isAsm = teamMember.role === "asm";
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => {
    const mId = teamMember.id;
    const mName = (teamMember.name || "").trim().toLowerCase();
    return allParties
      .filter(p => {
        if (isAsm) {
          return p.assignedAsmId === mId || (p.assignedAsmName && p.assignedAsmName.trim().toLowerCase() === mName);
        } else {
          return p.assignedTsmId === mId || (p.assignedTsmName && p.assignedTsmName.trim().toLowerCase() === mName);
        }
      })
      .map(p => p.id);
  });

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(allParties.map(p => p.state).filter(Boolean))).sort();
  }, [allParties]);

  const filtered = useMemo(() => {
    return allParties.filter(p => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (p.name || "").toLowerCase().includes(q) ||
                      (p.city || "").toLowerCase().includes(q) ||
                      (p.phone || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      return true;
    });
  }, [allParties, search, stateFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.includes(p.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filtered.some(p => p.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filtered.map(p => p.id)])));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "750px", padding: "24px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={20} /> Assign Parties to {teamMember.name}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "4px 0 0 0" }}>
              Role: <strong>{isAsm ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)"}</strong> | Selected: <strong style={{ color: "var(--primary)" }}>{selectedIds.length}</strong> parties
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Search & State Filter */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search party by name, city, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: "32px", height: "36px" }}
            />
          </div>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="form-control"
            style={{ width: "auto", minHeight: "36px", height: "36px", fontSize: "0.82rem" }}
          >
            <option value="all">All States</option>
            {uniqueStates.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* Quick Select Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "6px 10px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", fontSize: "0.82rem", flexWrap: "wrap", gap: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleToggleSelectAll}
              className="checkbox-input"
            />
            Select All Matching ({filtered.length} parties)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const targetParties = filtered.filter(p => selectedIds.includes(p.id));
                  const headers = ["Party Name", "City", "State", "Phone", "Assigned Sales Rep", "Address", "GST"];
                  const rows = targetParties.map(p => [
                    p.name || "",
                    p.city || "",
                    p.state || "",
                    p.phone || "",
                    p.assignedCrmName || p.assignedCrmId || "",
                    p.address || "",
                    p.gstNumber || p.gst || ""
                  ]);
                  downloadCsv(headers, rows, `Parties_Selected_${targetParties.length}`);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.75rem", padding: "2px 8px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.45)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                title="Download selected parties as CSV"
              >
                <Download size={12} /> Download Selected ({selectedIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Parties Checklist */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No parties found matching criteria.
            </div>
          ) : (
            filtered.map(p => {
              const isChecked = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggleRow(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: isChecked ? "rgba(56, 189, 248, 0.1)" : "transparent",
                    border: isChecked ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="checkbox-input"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {p.name}
                      <span className="badge badge-secondary" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{p.city || "—"}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      State: {p.state || "—"} | Phone: {p.phone || "—"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={() => onAssign(selectedIds)}
            className="btn btn-primary"
            style={{ flex: 1, padding: "10px", fontWeight: 700 }}
          >
            Save Party Assignments ({selectedIds.length})
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: TRACK ASM SALES & PURCHASES MODAL ====================
function AsmSalesDetailModal({ 
  member, 
  allParties = [], 
  allSalesOrders = [], 
  allDispatches = [], 
  crmPartyRemarks = [],
  items = [],
  currentUser,
  canViewFinancials = false,
  onSavePartyRemark,
  onDeletePartyRemark,
  formatInr, 
  onClose 
}) {
  const isAsm = member.role === "asm";
  const [subTab, setSubTab] = useState("items"); // "items" | "parties" | "matrix" | "leaderboard"
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeRemarkModalTarget, setActiveRemarkModalTarget] = useState(null);

  // Find all assigned parties (by ID or Name)
  const assignedParties = useMemo(() => {
    const mId = member.id;
    const mName = (member.name || "").trim().toLowerCase();
    return allParties.filter(p => {
      if (isAsm) {
        return p.assignedAsmId === mId || (p.assignedAsmName && p.assignedAsmName.trim().toLowerCase() === mName);
      } else {
        return p.assignedTsmId === mId || (p.assignedTsmName && p.assignedTsmName.trim().toLowerCase() === mName);
      }
    });
  }, [allParties, member, isAsm]);

  const assignedPartyIdSet = useMemo(() => new Set(assignedParties.map(p => p.id)), [assignedParties]);
  const assignedPartyNameSet = useMemo(() => new Set(assignedParties.map(p => (p.name || "").trim().toLowerCase()).filter(Boolean)), [assignedParties]);

  // Find all sales orders from these assigned parties (by ID or Name)
  const memberOrders = useMemo(() => {
    return allSalesOrders.filter(o => {
      const matchParty = assignedPartyIdSet.has(o.partyId) || 
                         assignedPartyNameSet.has((o.partyName || "").trim().toLowerCase()) || 
                         o.assignedAsmId === member.id || 
                         o.assignedTsmId === member.id;
      if (!matchParty) return false;
      if (startDate || endDate) {
        if (!isDateInBetween(o.orderDate, startDate, endDate)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (o.partyName || "").toLowerCase().includes(q) ||
                      (o.itemModel || "").toLowerCase().includes(q) ||
                      (o.orderNo || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allSalesOrders, assignedPartyIdSet, assignedPartyNameSet, member, startDate, endDate, search]);

  // Find all dispatches linked to these assigned parties (by ID or Name)
  const memberDispatches = useMemo(() => {
    return allDispatches.filter(d => {
      const matchParty = assignedPartyIdSet.has(d.partyId) || 
                         assignedPartyNameSet.has((d.partyName || "").trim().toLowerCase()) || 
                         d.assignedAsmId === member.id || 
                         d.assignedTsmId === member.id;
      if (!matchParty) return false;
      if (startDate || endDate) {
        if (!isDateInBetween(d.dispatchDate, startDate, endDate)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = (d.partyName || "").toLowerCase().includes(q) ||
                      (d.itemModel || "").toLowerCase().includes(q) ||
                      (d.invoiceNo || "").toLowerCase().includes(q) ||
                      (d.transporterName || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allDispatches, assignedPartyIdSet, assignedPartyNameSet, member, startDate, endDate, search]);

  // Month & Category Matrix for this specific ASM/TSM
  const memberMonthCategoryMatrix = useMemo(() => {
    const map = new Map();

    memberOrders.forEach(o => {
      const orderMonth = (o.orderDate || "").slice(0, 7) || "2026-08";
      let rawCat = o.category;
      if (!rawCat || rawCat === "General" || rawCat === "Unspecified") {
        const foundItem = items.find(it => it.name === o.itemModel || it.id === o.itemId);
        rawCat = foundItem?.category || "";
      }
      const cat = normalizeFgCategory(rawCat);
      if (!cat) return;

      const pId = o.partyId || "unknown";
      const pName = o.partyName || "Unknown Party";

      const key = `${pId}___${cat}___${orderMonth}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          partyId: pId,
          partyName: pName,
          category: cat,
          month: orderMonth,
          totalOrderQty: 0,
          totalRevenue: 0,
          orderCount: 0
        });
      }
      const cur = map.get(key);
      cur.totalOrderQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.partyName !== b.partyName) return a.partyName.localeCompare(b.partyName);
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return b.month.localeCompare(a.month);
    });
  }, [memberOrders, items]);

  // Summary KPIs
  const totalRevenue = useMemo(() => {
    return memberOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);
  }, [memberOrders]);

  const totalOrderedUnits = useMemo(() => {
    return memberOrders.reduce((acc, o) => acc + (parseInt(o.orderQty) || 0), 0);
  }, [memberOrders]);

  const totalDispatchedUnits = useMemo(() => {
    const fromOrders = memberOrders.reduce((acc, o) => acc + (parseInt(o.dispatchedQty) || 0), 0);
    const fromDispatches = memberDispatches.reduce((acc, d) => acc + (parseInt(d.dispatchedQty) || 0), 0);
    return Math.max(fromOrders, fromDispatches);
  }, [memberOrders, memberDispatches]);

  // Top Selling Items Leaderboard for this ASM
  const topItems = useMemo(() => {
    const map = new Map();
    memberOrders.forEach(o => {
      const key = o.itemModel || "Unspecified";
      if (!map.has(key)) {
        map.set(key, { itemModel: key, totalQty: 0, totalRevenue: 0, orderCount: 0 });
      }
      const cur = map.get(key);
      cur.totalQty += parseInt(o.orderQty) || 0;
      cur.totalRevenue += parseFloat(o.totalInr) || 0;
      cur.orderCount += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [memberOrders]);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(5px)" }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "1050px", width: "100%", padding: "26px", maxHeight: "90vh", display: "flex", flexDirection: "column", margin: "auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: isAsm ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                {member.name ? member.name.slice(0, 2).toUpperCase() : "SM"}
              </div>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                  {member.name} — Performance Studio
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {isAsm ? "Area Sales Manager (ASM)" : "Territory Sales Manager (TSM)"} | Territory: {member.territory || "General"} | Phone: {member.phone || "—"}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Summary KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {canViewFinancials && (
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "12px", borderRadius: "10px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Sales Revenue</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--success)" }}>{formatInr(totalRevenue)}</div>
            </div>
          )}

          <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Units Ordered</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>{totalOrderedUnits.toLocaleString()} Pcs</div>
          </div>

          <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Dispatches</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fbbf24" }}>{totalDispatchedUnits.toLocaleString()} Pcs</div>
          </div>

          <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.25)", padding: "12px", borderRadius: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Assigned Parties</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#c084fc" }}>{assignedParties.length} Parties</div>
          </div>
        </div>

        {/* Sub-tabs & Filter Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              onClick={() => setSubTab("items")}
              className={`tab-btn ${subTab === "items" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Purchased Items ({memberOrders.length})
            </button>
            <button
              onClick={() => setSubTab("dispatches")}
              className={`tab-btn ${subTab === "dispatches" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <Truck size={13} /> Dispatched Items ({memberDispatches.length})
            </button>
            <button
              onClick={() => setSubTab("matrix")}
              className={`tab-btn ${subTab === "matrix" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: subTab === "matrix" ? 700 : 500 }}
            >
              <MessageSquare size={13} /> Month & Category Matrix + Remarks ({memberMonthCategoryMatrix.length})
            </button>
            <button
              onClick={() => setSubTab("parties")}
              className={`tab-btn ${subTab === "parties" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Assigned Parties ({assignedParties.length})
            </button>
            <button
              onClick={() => setSubTab("leaderboard")}
              className={`tab-btn ${subTab === "leaderboard" ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              Top Items Leaderboard
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search items or parties..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-control"
              style={{ width: "180px", height: "34px", fontSize: "0.82rem" }}
            />
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => { setStartDate(""); setEndDate(""); }}
              placeholder="Filter Dates"
            />
          </div>
        </div>

        {/* Tab Content Display */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px" }}>
          {subTab === "items" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Order Date</th>
                  <th>Party Name</th>
                  <th>Item Model</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  {canViewFinancials && <th style={{ textAlign: "right" }}>Unit Price</th>}
                  {canViewFinancials && <th style={{ textAlign: "right" }}>Total (₹)</th>}
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {memberOrders.length === 0 ? (
                  <tr>
                    <td colSpan={canViewFinancials ? 7 : 5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No purchase orders recorded from assigned parties.
                    </td>
                  </tr>
                ) : (
                  memberOrders.map(order => (
                    <tr key={order.id}>
                      <td><code style={{ fontSize: "0.78rem" }}>{order.orderDate}</code></td>
                      <td>
                        <strong style={{ color: "var(--text-main)" }}>{order.partyName}</strong>
                        {order.city && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{order.city}</div>}
                      </td>
                      <td>
                        <strong style={{ color: "var(--primary)" }}>{order.itemModel}</strong>
                        {order.category && <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "6px" }}>({order.category})</span>}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{order.orderQty?.toLocaleString()} Pcs</td>
                      {canViewFinancials && <td style={{ textAlign: "right" }}>₹{order.unitPriceInr}</td>}
                      {canViewFinancials && <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(order.totalInr)}</td>}
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${order.status === "Dispatched" ? "badge-success" : order.status === "Partially Dispatched" ? "badge-primary" : "badge-secondary"}`} style={{ fontSize: "0.7rem" }}>
                          {order.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {subTab === "dispatches" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Dispatch Date</th>
                  <th>Invoice No</th>
                  <th>Party Name</th>
                  <th>Item Model</th>
                  <th style={{ textAlign: "right" }}>Dispatched Qty</th>
                  <th>Transporter & Docket LR</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {memberDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No dispatched shipments logged for assigned parties.
                    </td>
                  </tr>
                ) : (
                  memberDispatches.map(dsp => (
                    <tr key={dsp.id}>
                      <td><code style={{ fontSize: "0.78rem" }}>{dsp.dispatchDate}</code></td>
                      <td><code style={{ fontSize: "0.8rem", fontWeight: 700 }}>{dsp.invoiceNo || "INV-PENDING"}</code></td>
                      <td><strong style={{ color: "var(--text-main)" }}>{dsp.partyName}</strong></td>
                      <td><strong style={{ color: "var(--primary)" }}>{dsp.itemModel}</strong></td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)", fontSize: "0.9rem" }}>
                        {dsp.dispatchedQty?.toLocaleString()} Pcs
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", fontSize: "0.78rem" }}>
                          <span>{dsp.transporterName || "—"}</span>
                          <span style={{ color: "var(--text-muted)" }}>LR: {dsp.docketNo || "N/A"}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${dsp.status === "Delivered" ? "badge-success" : dsp.status === "In Transit" ? "badge-primary" : "badge-secondary"}`} style={{ fontSize: "0.7rem" }}>
                          {dsp.status || "Dispatched"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {subTab === "matrix" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Party Name</th>
                  <th style={{ width: "16%" }}>Category</th>
                  <th style={{ width: "12%" }}>Month</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Order Qty</th>
                  {canViewFinancials && <th style={{ width: "14%", textAlign: "right" }}>Total (₹)</th>}
                  <th style={{ width: canViewFinancials ? "18%" : "32%", textAlign: "center" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {memberMonthCategoryMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={canViewFinancials ? 6 : 5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No month-wise category orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  memberMonthCategoryMatrix.map(row => {
                    const rowRemarks = (crmPartyRemarks || []).filter(r => (r.partyId === row.partyId || r.partyName === row.partyName) && r.category === row.category && r.month === row.month);
                    const latest = rowRemarks[0];

                    return (
                      <tr key={row.key}>
                        <td><strong style={{ color: "var(--text-main)" }}>{row.partyName}</strong></td>
                        <td>
                          <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 700 }}>
                            {row.category}
                          </span>
                        </td>
                        <td><strong>{row.month}</strong></td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: row.totalOrderQty > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                          {row.totalOrderQty.toLocaleString()} Pcs
                        </td>
                        {canViewFinancials && (
                          <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>
                            {formatInr(row.totalRevenue)}
                          </td>
                        )}
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setActiveRemarkModalTarget({
                              partyId: row.partyId,
                              partyName: row.partyName,
                              category: row.category,
                              month: row.month,
                              totalOrderQty: row.totalOrderQty,
                              totalRevenue: row.totalRevenue
                            })}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.74rem", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <MessageSquare size={12} /> {rowRemarks.length > 0 ? `Remarks (${rowRemarks.length})` : "+ Put Remark"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {subTab === "parties" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Party / Dealer Name</th>
                  <th>Location / State</th>
                  <th>Contact Person & Phone</th>
                  <th style={{ textAlign: "right" }}>Total Orders</th>
                  {canViewFinancials && <th style={{ textAlign: "right" }}>Total Revenue</th>}
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignedParties.length === 0 ? (
                  <tr>
                    <td colSpan={canViewFinancials ? 6 : 5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No parties assigned to this sales manager yet. Click "Assign Parties" on the team card to link accounts.
                    </td>
                  </tr>
                ) : (
                  assignedParties.map(p => {
                    const pOrders = memberOrders.filter(o => o.partyId === p.id || (o.partyName && o.partyName.trim().toLowerCase() === (p.name || "").trim().toLowerCase()));
                    const pRevenue = pOrders.reduce((acc, o) => acc + (parseFloat(o.totalInr) || 0), 0);

                    return (
                      <tr key={p.id}>
                        <td><strong style={{ color: "var(--text-main)" }}>{p.name}</strong></td>
                        <td>{p.city || "—"} {p.state ? `(${p.state})` : ""}</td>
                        <td>{p.contactPerson || "—"} • {p.phone || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{pOrders.length} Orders</td>
                        {canViewFinancials && <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(pRevenue)}</td>}
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${p.status === "Active" ? "badge-success" : "badge-secondary"}`}>
                            {p.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {subTab === "leaderboard" && (
            <table className="table" style={{ width: "100%", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Item Model</th>
                  <th style={{ textAlign: "right" }}>Total Units Ordered</th>
                  <th style={{ textAlign: "right" }}>Orders Count</th>
                  {canViewFinancials && <th style={{ textAlign: "right" }}>Total Revenue (₹)</th>}
                </tr>
              </thead>
              <tbody>
                {topItems.length === 0 ? (
                  <tr>
                    <td colSpan={canViewFinancials ? 5 : 4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No orders recorded for this sales manager yet.
                    </td>
                  </tr>
                ) : (
                  topItems.map((item, idx) => (
                    <tr key={item.itemModel}>
                      <td style={{ fontWeight: 800, color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "var(--text-muted)" }}>
                        #{idx + 1}
                      </td>
                      <td><strong style={{ color: "var(--primary)" }}>{item.itemModel}</strong></td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{item.totalQty.toLocaleString()} Pcs</td>
                      <td style={{ textAlign: "right" }}>{item.orderCount}</td>
                      {canViewFinancials && <td style={{ textAlign: "right", fontWeight: 800, color: "var(--success)" }}>{formatInr(item.totalRevenue)}</td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Sub-modal for Remarks inside ASM Sales modal */}
        {activeRemarkModalTarget && (
          <PartyCategoryRemarkModal
            target={activeRemarkModalTarget}
            remarks={(crmPartyRemarks || []).filter(r => (r.partyId === activeRemarkModalTarget.partyId || r.partyName === activeRemarkModalTarget.partyName) && r.category === activeRemarkModalTarget.category && r.month === activeRemarkModalTarget.month)}
            currentUser={currentUser}
            formatInr={formatInr}
            onSave={async (text) => {
              if (onSavePartyRemark) {
                await onSavePartyRemark({
                  partyId: activeRemarkModalTarget.partyId,
                  partyName: activeRemarkModalTarget.partyName,
                  category: activeRemarkModalTarget.category,
                  month: activeRemarkModalTarget.month,
                  remark: text,
                  authorId: currentUser?.id || member.id,
                  authorName: currentUser?.name || member.name,
                  authorRole: currentUser?.role || member.role || "asm"
                });
              }
            }}
            onDelete={async (id) => {
              if (onDeletePartyRemark) await onDeletePartyRemark(id);
            }}
            onClose={() => setActiveRemarkModalTarget(null)}
          />
        )}

        <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENT: PARTY & CATEGORY MONTHLY REMARK MODAL ====================
function PartyCategoryRemarkModal({ target, remarks = [], currentUser, formatInr, onSave, onDelete, onClose }) {
  const [remarkText, setRemarkText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletedIds, setDeletedIds] = useState(new Set());
  const { showSuccessToast, showErrorToast } = useLoading();

  const activeRemarks = remarks.filter(r => !deletedIds.has(r.id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarkText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(remarkText.trim());
      setRemarkText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(5px)" }}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "650px", width: "100%", padding: "26px", maxHeight: "90vh", display: "flex", flexDirection: "column", margin: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 800 }}>
                {target.category}
              </span>
              <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                📅 {target.month}
              </span>
            </div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              {target.partyName}
            </h3>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Current Month Sales: <strong style={{ color: "var(--primary)" }}>{(target.totalOrderQty || 0).toLocaleString()} Pcs</strong> {target.totalRevenue ? `• ${formatInr(target.totalRevenue)}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Existing Remarks Thread */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(0,0,0,0.15)", marginBottom: "16px", minHeight: "160px", maxHeight: "300px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Remarks History ({activeRemarks.length})
          </div>

          {activeRemarks.length === 0 ? (
            <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.86rem" }}>
              You can log remarks, dealer commitments, and observations below.
            </div>
          ) : (
            activeRemarks.map(r => {
              const isAuthor = currentUser?.id === r.authorId || currentUser?.name === r.authorName;
              const canDelete = isAuthor || currentUser?.role === "superadmin" || currentUser?.role === "crm" || currentUser?.role === "owner";

              return (
                <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className="badge" style={{ 
                        background: r.authorRole === "asm" ? "rgba(16, 185, 129, 0.15)" : r.authorRole === "tsm" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: r.authorRole === "asm" ? "#34d399" : r.authorRole === "tsm" ? "#fbbf24" : "#818cf8",
                        fontWeight: 800,
                        fontSize: "0.72rem"
                      }}>
                        {r.authorRole ? r.authorRole.toUpperCase() : "TEAM"}
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>{r.authorName}</strong>
                      <span className="badge" style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontSize: "0.7rem", padding: "2px 6px" }}>
                        {r.category || target.category}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      {canDelete && (
                        <button
                          onClick={async () => {
                            if (window.confirm("Delete this remark?")) {
                              try {
                                setDeletedIds(prev => new Set([...prev, r.id]));
                                if (onDelete) await onDelete(r.id);
                                showSuccessToast("Remark deleted.");
                              } catch (err) {
                                showErrorToast("Failed to delete remark.");
                              }
                            }
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--danger)", padding: "2px 6px" }}
                          title="Delete remark"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                    "{r.remark}"
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Remark Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "0.86rem", margin: "0 0 6px 0", color: "var(--text-main)" }}>
              Remarks
            </label>
            <textarea
              rows={3}
              required
              placeholder="Type remark here..."
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              className="form-control"
              style={{ fontSize: "0.86rem", background: "rgba(0,0,0,0.25)", color: "var(--text-main)", borderColor: "var(--border-glass)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !remarkText.trim()}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
            >
              {isSubmitting ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
              Post Remark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}