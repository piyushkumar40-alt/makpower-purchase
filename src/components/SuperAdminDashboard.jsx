import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Users, User, UserCheck, Building, Database, FileText, Plus, UserMinus, RefreshCw, Download, 
  Upload, Eye, Truck, ChevronRight, Sliders, Package, ShieldCheck, Clock, 
  UserX, LogOut, Folder, HardDrive, Trash2, Copy, ExternalLink, Key, Check, 
  CheckCircle, CheckCircle2, Layers, AlertTriangle, ShieldAlert, X, Search, Edit2, Tag, DollarSign
} from "lucide-react";
import TransferModal from "./TransferModal";
import { getCurrencySymbol, CargoCompaniesPanel, VendorDetailModal, CargoCompanyDetailModal } from "./PurchaserDashboard";
import ItemMasterView from "./ItemMasterView";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";
import ItemCatalogPanel from "./ItemCatalogPanel";
import AuditLogsPanel from "./AuditLogsPanel";
import PriceManagementPanel from "./PriceManagementPanel";
import { QuickCreateDesignationModal, QuickCreateVendorModal, QuickCreateCargoCompanyModal, QuickCreateItemModal, QuickCreateUserModal } from "./QuickCreateModals";
import { useLoading } from "../context/LoadingContext";
import { initialUsers } from "../mockData";

export default function SuperAdminDashboard({
  users = [],
  vendors = [],
  requests = [],
  cargos = [],
  cargoCompanies = [],
  auditLogs = [],
  onAddPurchaser,
  onRemovePurchaser,
  onAddVendor,
  onUpdateVendor,
  onRemoveVendor,
  onAddCargoCompany,
  onUpdateCargoCompany,
  onRemoveCargoCompany,
  onExportBackup,
  onImportBackup,
  onUpdateUserInfo,
  settings = { isHidden: false, redirectUrl: "" },
  onUpdateSettings,
  onBatchUpdateRequests,
  items = [],
  onAddItem,
  onBulkAddItems,
  onDeleteItems,
  onPurgeAllData,
  onUpdateItem,
  onMergeItems,
  imsTransactions = [],
  onResolveMissingId,
  onNavigateView,
  crmParties = [],
  onAddParty,
  onUpdateParty,
  onDeleteParty,
  onBulkDeleteParties,
  onBatchUploadParties,
  onBatchAssignParties,
  itemPrices = [],
  onAddPrice,
  onUpdatePrice,
  onDeletePrice,
  onBatchUploadPrices,
  onBulkDeletePrices,
  designations = [],
  onAddDesignation,
  onPullModuleData,
  loadingModules = {},
  recordSectionVisit,
  currentUserId,
  currentUser
}) {
  const effectiveUsers = (users && Array.isArray(users) && users.length > 0) ? users : initialUsers;

  const [subTab, setSubTab] = useState(() => {
    return localStorage.getItem("makpower_admin_subtab") || "purchasers";
  });

  const handleTabSwitch = (targetTab) => {
    setSubTab(targetTab);
    localStorage.setItem("makpower_admin_subtab", targetTab);

    let modKey = null;
    if (targetTab === "vendors") modKey = "vendors";
    else if (targetTab === "cargocompanies") modKey = "cargoCompanies";
    else if (targetTab === "crmparties") modKey = "crmParties";
    else if (targetTab === "audit") modKey = "auditLogs";
    else if (targetTab === "itemmaster") modKey = "items";
    else if (targetTab === "purchasers") modKey = "users";

    if (modKey) {
      if (recordSectionVisit && currentUserId) {
        recordSectionVisit(currentUserId, modKey);
      }
      if (onPullModuleData) {
        onPullModuleData(modKey);
      }
    }
  };

  useEffect(() => {
    let modKey = null;
    if (subTab === "vendors") modKey = "vendors";
    else if (subTab === "cargocompanies") modKey = "cargoCompanies";
    else if (subTab === "crmparties") modKey = "crmParties";
    else if (subTab === "audit") modKey = "auditLogs";
    else if (subTab === "itemmaster") modKey = "items";
    else if (subTab === "purchasers") modKey = "users";

    if (modKey) {
      if (recordSectionVisit && currentUserId) {
        recordSectionVisit(currentUserId, modKey);
      }
      if (onPullModuleData) {
        onPullModuleData(modKey);
      }
    }
  }, []);

  // CRM Parties Studio State
  const [crmPartySearch, setCrmPartySearch] = useState("");
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();

  const [crmPartyFilter, setCrmPartyFilter] = useState("all");
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [bulkPartyRawText, setBulkPartyRawText] = useState("");
  const [bulkParsedParties, setBulkParsedParties] = useState([]);
  const [bulkPartyUploadMsg, setBulkPartyUploadMsg] = useState("");
  const [isUploadingParties, setIsUploadingParties] = useState(false);
  const [partyStudioMode, setPartyStudioMode] = useState("directory"); // "directory" | "bulk"
  const [partyParseMode, setPartyParseMode] = useState("auto"); // "auto" | "city_first" | "name_first" | "sr_city_name" | "crm_first"
  const [bulkDefaultCrmId, setBulkDefaultCrmId] = useState("");
  const [selectedPartyIds, setSelectedPartyIds] = useState([]);

  // Missing Item IDs state for IMS
  const [resolvingAdminItemName, setResolvingAdminItemName] = useState(null);
  const [adminItemCategory, setAdminItemCategory] = useState("Chargers");
  const [adminItemType, setAdminItemType] = useState("FG");
  const [adminItemUnit, setAdminItemUnit] = useState("Pcs");
  const [adminItemDesc, setAdminItemDesc] = useState("");
  const [adminMapTargetId, setAdminMapTargetId] = useState("");

  const adminMissingImsItems = React.useMemo(() => {
    const map = new Map();
    (imsTransactions || []).forEach(tx => {
      if (tx.isMissingId || !tx.itemId) {
        const key = (tx.itemName || "Unknown Item").trim();
        if (!map.has(key)) {
          map.set(key, { name: key, count: 0, totalQty: 0, sampleDate: tx.date, sampleParty: tx.partyName });
        }
        const e = map.get(key);
        e.count++;
        e.totalQty += (parseInt(tx.stockQty) || 0);
      }
    });
    return Array.from(map.values());
  }, [imsTransactions]);

  // CRM Executives list (Ankita, Ajit, Prince, Simran, Harish, etc.)
  const crmExecutives = React.useMemo(() => {
    return (users || []).filter(u => 
      u.role === "crm" || 
      u.role === "asm" || 
      u.role === "tsm" || 
      (u.designation && u.designation.toLowerCase().includes("crm")) ||
      (u.designation && u.designation.toLowerCase().includes("sales"))
    );
  }, [users]);

  // Filtered CRM Parties for directory
  const filteredCrmParties = React.useMemo(() => {
    return (crmParties || []).filter(p => {
      if (crmPartyFilter !== "all") {
        if (crmPartyFilter === "unassigned") {
          if (p.assignedCrmId && p.assignedCrmId !== "") return false;
        } else if (p.assignedCrmId !== crmPartyFilter && p.assignedCrmName !== crmPartyFilter) {
          return false;
        }
      }
      if (crmPartySearch.trim()) {
        const q = crmPartySearch.trim().toLowerCase();
        const matchName = (p.name || "").toLowerCase().includes(q);
        const matchCrm = (p.assignedCrmName || "").toLowerCase().includes(q);
        const matchCity = (p.city || "").toLowerCase().includes(q);
        const matchContact = (p.contactPerson || "").toLowerCase().includes(q);
        const matchPhone = (p.phone || "").toLowerCase().includes(q);
        const matchGst = (p.gstin || "").toLowerCase().includes(q);
        return matchName || matchCrm || matchCity || matchContact || matchPhone || matchGst;
      }
      return true;
    });
  }, [crmParties, crmPartyFilter, crmPartySearch]);

  // Sample CSV generator for CRM Parties
  const handleDownloadPartySampleCsv = () => {
    const sampleRows = [
      ["CRM Email", "Party Name", "Contact Person", "Phone", "City", "State", "GSTIN"],
      ["ankita@makpowerindia.com", "Shree Ganesh Electronics", "Mr. Ramesh Gupta", "9820192831", "Mumbai", "Maharashtra", "27AAAAA0000A1Z5"],
      ["ajit@makpowerindia.com", "Mahalaxmi Power Hub", "Mr. Suresh Jain", "9840192832", "Ahmedabad", "Gujarat", "24BBBBB1111B1Z2"],
      ["prince@makpowerindia.com", "Marwar Mobile Accessories", "Mr. Prakash Singh", "9890192833", "Jaipur", "Rajasthan", "08CCCCC2222C1Z9"],
      ["simran@makpowerindia.com", "Metro Power Solutions", "Mr. Amit Sharma", "9870192834", "Delhi", "Delhi", "07DDDDD3333D1Z4"],
      ["harish@makpowerindia.com", "Balaji Telecom", "Mr. Naresh Patel", "9810192835", "Surat", "Gujarat", "24EEEEE4444E1Z7"],
      ["", "Apex Mobile Distributors", "Mr. Vijay Verma", "9800192836", "Indore", "Madhya Pradesh", ""]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      sampleRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CRM_Parties_Bulk_Upload_Sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Indian Cities & Station list for smart auto-detection
  const KNOWN_CITIES = React.useMemo(() => new Set([
    "samastipur", "ludhiana", "saharsa", "dibrugarh", "beawar", "jaipur", "delhi", "mumbai",
    "ahmedabad", "surat", "pune", "kolkata", "indore", "patna", "kanpur", "lucknow", "raipur",
    "ranchi", "guwahati", "jodhpur", "kota", "udaipur", "gwalior", "agra", "meerut", "varanasi",
    "bhopal", "nagpur", "vadodara", "rajkot", "chandigarh", "jalandhar", "amritsar", "dehradun",
    "bhubaneswar", "cuttack", "hyderabad", "bengaluru", "chennai", "coimbatore", "kochi",
    "jabalpur", "bikaner", "ajmer", "alwar", "bhilwara", "sikar", "sriganganagar", "hanumangarh",
    "muzaffarpur", "bhagalpur", "gaya", "darbhanga", "purnia", "siliguri", "asansol", "dhanbad",
    "jamshedpur", "bokaro", "bilaspur", "durg", "bhilai", "korba", "satna", "rewa", "ujjain"
  ]), []);

  // Bulk Party Parser (Excel paste / CSV) with Smart Column Detection
  const handleParseBulkParties = (rawText, customMode = partyParseMode, defaultCrmId = bulkDefaultCrmId) => {
    setBulkPartyRawText(rawText);
    setBulkPartyUploadMsg("");
    setIsUploadingParties(false);
    if (!rawText || !rawText.trim()) {
      setBulkParsedParties([]);
      return;
    }

    const lines = rawText.trim().split(/\r?\n/);
    const parsed = [];

    // Helper: Split line into columns accurately without breaking multi-word party names
    const parseLineCols = (line) => {
      if (line.includes("\t")) {
        return line.split("\t").map(c => c.trim().replace(/^["']|["']$/g, ""));
      }
      
      if (line.includes(",")) {
        const cols = [];
        let curr = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' || ch === "'") {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            cols.push(curr.trim().replace(/^["']|["']$/g, ""));
            curr = "";
          } else {
            curr += ch;
          }
        }
        cols.push(curr.trim().replace(/^["']|["']$/g, ""));
        return cols;
      }

      const emailMatch = line.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)\s+(.+)$/);
      if (emailMatch) {
        return [emailMatch[1].trim(), emailMatch[2].trim()];
      }
      
      return [line.trim()];
    };

    // Check if line 0 is a header row
    let headerIndices = null;
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes("party") || firstLine.includes("firm") || firstLine.includes("city") || firstLine.includes("station") || firstLine.includes("crm") || firstLine.includes("email") || firstLine.includes("sr") || firstLine.includes("contact")) {
        const rawHeaderCols = parseLineCols(lines[0]).map(c => c.toLowerCase());

        headerIndices = {};
        rawHeaderCols.forEach((col, idx) => {
          if (col.includes("party") || col.includes("firm") || col.includes("customer") || col.includes("dealer") || col.includes("client")) headerIndices.partyName = idx;
          else if (col.includes("city") || col.includes("station") || col.includes("place") || col.includes("location") || col.includes("town")) headerIndices.city = idx;
          else if (col.includes("crm") || col.includes("email") || col.includes("executive") || col.includes("assigned")) headerIndices.crm = idx;
          else if (col.includes("contact") || col.includes("person") || col.includes("owner")) headerIndices.contact = idx;
          else if (col.includes("phone") || col.includes("mobile") || col.includes("tel") || col.includes("contact no")) headerIndices.phone = idx;
          else if (col.includes("state") || col.includes("province")) headerIndices.state = idx;
          else if (col.includes("gst") || col.includes("gstin") || col.includes("tax")) headerIndices.gstin = idx;
          else if (col.includes("limit") || col.includes("credit")) headerIndices.creditLimit = idx;
          else if (col.includes("term") || col.includes("payment")) headerIndices.paymentTerms = idx;
          else if (col.includes("sr") || col.includes("s.no") || col.includes("sno") || col === "#" || col === "no") headerIndices.srNo = idx;
        });
      }
    }

    const defaultCrmUser = defaultCrmId ? users.find(u => u.id === defaultCrmId) : null;

    lines.forEach((line, index) => {
      if (!line.trim()) return;

      // Skip header row if identified
      if (index === 0 && headerIndices && Object.keys(headerIndices).length >= 1) return;

      const cols = parseLineCols(line);
      if (cols.length === 0 || cols.every(c => !c)) return;

      let crmIdentifier = "";
      let partyName = "";
      let contactPerson = "";
      let phone = "";
      let city = "";
      let state = "";
      let gstin = "";
      let creditLimit = 0;
      let paymentTerms = "30 Days";

      if (headerIndices && Object.keys(headerIndices).length >= 2) {
        // Use explicitly identified header indices
        if (headerIndices.partyName !== undefined) partyName = cols[headerIndices.partyName] || "";
        if (headerIndices.city !== undefined) city = cols[headerIndices.city] || "";
        if (headerIndices.crm !== undefined) crmIdentifier = cols[headerIndices.crm] || "";
        if (headerIndices.contact !== undefined) contactPerson = cols[headerIndices.contact] || "";
        if (headerIndices.phone !== undefined) phone = cols[headerIndices.phone] || "";
        if (headerIndices.state !== undefined) state = cols[headerIndices.state] || "";
        if (headerIndices.gstin !== undefined) gstin = cols[headerIndices.gstin] || "";
        if (headerIndices.creditLimit !== undefined) creditLimit = parseFloat(cols[headerIndices.creditLimit]) || 0;
        if (headerIndices.paymentTerms !== undefined) paymentTerms = cols[headerIndices.paymentTerms] || "30 Days";
      } else {
        // Strip leading numeric serial number if present (e.g. 1, 2, 3...)
        let workingCols = [...cols];
        if (workingCols.length >= 2 && /^\d+$/.test(workingCols[0])) {
          workingCols.shift();
        }

        if (customMode === "crm_first") {
          // Explicit Format: [CRM Email | Party Name | Contact | Phone | City | State | GSTIN]
          crmIdentifier = workingCols[0] || "";
          partyName = workingCols[1] || "";
          contactPerson = workingCols[2] || "";
          phone = workingCols[3] || "";
          city = workingCols[4] || "";
          state = workingCols[5] || "";
          gstin = workingCols[6] || "";
        } else if (customMode === "city_first") {
          // Explicit Format: [City / Station | Party Name | Contact | Phone | State | GSTIN]
          city = workingCols[0] || "";
          partyName = workingCols[1] || "";
          contactPerson = workingCols[2] || "";
          phone = workingCols[3] || "";
          state = workingCols[4] || "";
          gstin = workingCols[5] || "";
        } else if (customMode === "name_first") {
          // Explicit Format: [Party Name | City / Station | Contact | Phone | State | GSTIN]
          partyName = workingCols[0] || "";
          city = workingCols[1] || "";
          contactPerson = workingCols[2] || "";
          phone = workingCols[3] || "";
          state = workingCols[4] || "";
          gstin = workingCols[5] || "";
        } else {
          // Smart Auto-Detect Mode
          // 1. Check if column 0 contains an email or matches a known CRM user
          if (workingCols[0] && (workingCols[0].includes("@") || users.some(u => (u.email || "").toLowerCase() === workingCols[0].toLowerCase() || (u.name || "").toLowerCase() === workingCols[0].toLowerCase()))) {
            crmIdentifier = workingCols[0];
            partyName = workingCols[1] || "";
            contactPerson = workingCols[2] || "";
            phone = workingCols[3] || "";
            city = workingCols[4] || "";
            state = workingCols[5] || "";
            gstin = workingCols[6] || "";
          } else {
            const col0 = (workingCols[0] || "").trim();
            const col1 = (workingCols[1] || "").trim();
            const col2 = (workingCols[2] || "").trim();

            const col0Lower = col0.toLowerCase();
            const col1Lower = col1.toLowerCase();

            const col0IsCity = KNOWN_CITIES.has(col0Lower) || (col0 === col0.toUpperCase() && col0.split(" ").length === 1 && col0.length < 15);
            const col1IsCity = KNOWN_CITIES.has(col1Lower) || (col1 === col1.toUpperCase() && col1.split(" ").length === 1 && col1.length < 15);

            if (col0IsCity && !col1IsCity && col1) {
              city = col0;
              partyName = col1;
              contactPerson = col2;
              phone = workingCols[3] || "";
              state = workingCols[4] || "";
            } else {
              partyName = col0;
              city = col1;
              contactPerson = col2;
              phone = workingCols[3] || "";
              state = workingCols[4] || "";
            }
          }
        }
      }

      if (!partyName && !city) return;
      if (!partyName && city) {
        partyName = city;
        city = "";
      }

      const cleanIdent = crmIdentifier.trim().toLowerCase();
      const emailUserPart = cleanIdent.includes("@") ? cleanIdent.split("@")[0].toLowerCase() : cleanIdent;

      let matchedCrm = null;
      if (cleanIdent) {
        matchedCrm = users.find(u => {
          const uEmail = (u.email || "").trim().toLowerCase();
          const uName = (u.name || "").trim().toLowerCase();
          const uId = (u.id || "").trim().toLowerCase();
          
          if (uEmail === cleanIdent || uName === cleanIdent || uId === cleanIdent) return true;
          if (emailUserPart && (uEmail.startsWith(emailUserPart) || uName.toLowerCase().startsWith(emailUserPart) || emailUserPart.startsWith(uName.toLowerCase()))) {
            return true;
          }
          return false;
        });
      }

      if (!matchedCrm && defaultCrmUser) {
        matchedCrm = defaultCrmUser;
      }

      let crmDisplayName = "Unassigned";
      if (matchedCrm) {
        crmDisplayName = matchedCrm.name;
      } else if (emailUserPart) {
        crmDisplayName = emailUserPart.charAt(0).toUpperCase() + emailUserPart.slice(1);
      }

      parsed.push({
        id: `pty-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        name: partyName.trim(),
        assignedCrmId: matchedCrm ? matchedCrm.id : "",
        assignedCrmName: crmDisplayName,
        crmEmailProvided: crmIdentifier,
        isCrmMatched: !!matchedCrm || !!crmIdentifier,
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        gstin: gstin.trim(),
        creditLimit: parseFloat(creditLimit) || 0,
        paymentTerms: paymentTerms || "30 Days",
        status: "Active"
      });
    });

    setBulkParsedParties(parsed);
  };

  // Flip Party Name and City for all parsed rows if inverted
  const handleFlipAllParsedNamesAndCities = () => {
    setBulkParsedParties(prev => prev.map(p => ({
      ...p,
      name: p.city || p.name,
      city: p.name !== p.city ? p.name : ""
    })));
  };

  // Bulk assign all parsed parties to a specific CRM executive
  const handleBulkAssignAllCrm = (crmId) => {
    setBulkDefaultCrmId(crmId);
    if (!crmId) return;
    const crmObj = users.find(u => u.id === crmId);
    if (!crmObj) return;

    setBulkParsedParties(prev => prev.map(p => ({
      ...p,
      assignedCrmId: crmObj.id,
      assignedCrmName: crmObj.name,
      isCrmMatched: true
    })));
  };

  // Commit Bulk Parties to Server Database
  const handleCommitBulkParties = async () => {
    if (bulkParsedParties.length === 0) return;
    setIsUploadingParties(true);
    setBulkPartyUploadMsg("");
    startLoading("Saving CRM Parties...", `Committing ${bulkParsedParties.length} party records to database...`, 20);

    try {
      if (onBatchUploadParties) {
        const res = await onBatchUploadParties(bulkParsedParties);
        if (res && res.success) {
          const successCount = res.count || bulkParsedParties.length;
          finishLoading(`🎉 Saved successfully! ${successCount} Parties added to database.`);
          setBulkPartyUploadMsg(`✅ Successfully saved and committed ${successCount} parties into CRM database!`);
          showSuccessToast(`🎉 Saved successfully! ${successCount} Parties added to CRM database.`);
          setBulkParsedParties([]);
          setBulkPartyRawText("");
          setTimeout(() => setPartyStudioMode("directory"), 1800);
        } else {
          finishLoading();
          showErrorToast(res?.error || "Failed to commit parties");
          setBulkPartyUploadMsg(`❌ Upload failed: ${res?.error || "Unknown server error"}`);
        }
      }
    } catch (err) {
      finishLoading();
      showErrorToast(err.message || "Failed to commit parties");
      setBulkPartyUploadMsg(`❌ Upload Error: ${err.message}`);
    } finally {
      setIsUploadingParties(false);
    }
  };

  const [forceRefreshLoading, setForceRefreshLoading] = useState(false);
  const [forceRefreshMsg, setForceRefreshMsg] = useState("");

  React.useEffect(() => {
    localStorage.setItem("makpower_admin_subtab", subTab);
  }, [subTab]);
  
  // Storage & File Manager State
  const [storageMetrics, setStorageMetrics] = useState(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [storageFolders, setStorageFolders] = useState([]);
  const [storageFiles, setStorageFiles] = useState([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [storageStatusMsg, setStorageStatusMsg] = useState("");

  const loadStorageData = async (folderPath = "") => {
    setLoadingStorage(true);
    try {
      const [mRes, fRes] = await Promise.all([
        fetch("/api/storage/metrics"),
        fetch(`/api/storage/files?folder=${encodeURIComponent(folderPath)}`)
      ]);
      const mData = await mRes.json();
      const fData = await fRes.json();

      if (mData.success) setStorageMetrics(mData);
      if (fData.success) {
        setCurrentFolder(fData.currentFolder || "");
        setStorageFolders(fData.folders || []);
        setStorageFiles(fData.files || []);
      }
    } catch (err) {
      console.error("Storage fetch error:", err.message);
    } finally {
      setLoadingStorage(false);
    }
  };

  React.useEffect(() => {
    if (subTab === "filemanager") {
      loadStorageData(currentFolder);
    }
  }, [subTab]);

  // Storage Manager Filters & Selection State
  const [storageFilterSource, setStorageFilterSource] = useState("all"); // "all" | "postgres" | "cloudinary"
  const [storageFileType, setStorageFileType] = useState("all"); // "all" | "image" | "pdf"
  const [storageSearchQuery, setStorageSearchQuery] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState([]);

  const handleBatchDeleteStorageFiles = async () => {
    if (selectedFileIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedFileIds.length} selected asset(s)?`)) return;

    setLoadingStorage(true);
    let successCount = 0;
    for (const public_id of selectedFileIds) {
      try {
        const res = await fetch("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id })
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (e) {
        console.error("Batch delete item error:", e);
      }
    }

    setStorageStatusMsg(`✅ Successfully deleted ${successCount} file assets!`);
    setSelectedFileIds([]);
    loadStorageData(currentFolder);
    setTimeout(() => setStorageStatusMsg(""), 3500);
  };

  const handleDeleteStorageFile = async (public_id) => {
    if (!window.confirm(`Are you sure you want to delete asset "${public_id}"?`)) return;
    try {
      const res = await fetch("/api/storage/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id })
      });
      const data = await res.json();
      if (data.success) {
        setStorageStatusMsg(`✅ Deleted asset ${public_id}`);
        loadStorageData(currentFolder);
        setTimeout(() => setStorageStatusMsg(""), 3000);
      } else {
        setStorageStatusMsg(`❌ Delete failed: ${data.error}`);
      }
    } catch (err) {
      setStorageStatusMsg(`❌ Delete error: ${err.message}`);
    }
  };

  const handleDeleteAllCloudinaryImages = async () => {
    if (!window.confirm("⚠️ ARE YOU SURE? This will permanently delete ALL images from Cloudinary storage itself!")) return;
    setLoadingStorage(true);
    try {
      const res = await fetch("/api/storage/delete-all-cloudinary", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStorageStatusMsg(`✅ ${data.message}`);
        loadStorageData(currentFolder);
      } else {
        setStorageStatusMsg(`❌ Purge failed: ${data.error}`);
      }
    } catch (err) {
      setStorageStatusMsg(`❌ Purge error: ${err.message}`);
    } finally {
      setLoadingStorage(false);
    }
  };

  // System Settings State
  const [redirectUrlInput, setRedirectUrlInput] = useState(settings.redirectUrl || "https://www.instagram.com/makpowerofficial/");
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Admin Password Update State
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [adminPassMsg, setAdminPassMsg] = useState({ text: "", type: "" });
  const [updatingAdminPass, setUpdatingAdminPass] = useState(false);

  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    setAdminPassMsg({ text: "", type: "" });

    if (!newAdminPassword || newAdminPassword.trim().length === 0) {
      setAdminPassMsg({ text: "Please enter a new password.", type: "danger" });
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminPassMsg({ text: "Passwords do not match. Please verify.", type: "danger" });
      return;
    }

    setUpdatingAdminPass(true);
    try {
      const adminUser = users.find(u => u.role === "superadmin" || u.id === "u-admin") || { id: "u-admin" };
      const res = await onUpdateUserInfo(adminUser.id, { password: newAdminPassword.trim() });
      if (res && res.success) {
        setAdminPassMsg({ text: "✅ Admin password updated successfully! Use your new password on next login.", type: "success" });
        setNewAdminPassword("");
        setConfirmAdminPassword("");
      } else {
        setAdminPassMsg({ text: `❌ Update failed: ${res?.message || "Unknown error"}`, type: "danger" });
      }
    } catch (err) {
      setAdminPassMsg({ text: `❌ Error: ${err.message}`, type: "danger" });
    } finally {
      setUpdatingAdminPass(false);
    }
  };

  // Google Sheets Integration State
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState(settings.googleSheetWebhookUrl || "");
  const [sheetAutoSync, setSheetAutoSync] = useState(settings.googleSheetAutoSyncEnabled === "true" || settings.googleSheetAutoSyncEnabled === true);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetStatusMsg, setSheetStatusMsg] = useState("");
  const [showAppsScriptCode, setShowAppsScriptCode] = useState(false);

  // Cloudinary Photo Migration State
  const [migratingPhotos, setMigratingPhotos] = useState(false);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState("");

  const handleMigratePhotos = async () => {
    setMigratingPhotos(true);
    setMigrationStatusMsg("");
    try {
      const res = await fetch("/api/migrate-photos-to-cloudinary", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMigrationStatusMsg(`✅ ${data.message}`);
      } else {
        setMigrationStatusMsg(`❌ Migration Error: ${data.error}`);
      }
    } catch (err) {
      setMigrationStatusMsg(`❌ Network Error: ${err.message}`);
    } finally {
      setMigratingPhotos(false);
    }
  };

  React.useEffect(() => {
    if (settings.redirectUrl) {
      setRedirectUrlInput(settings.redirectUrl);
    }
    if (settings.googleSheetWebhookUrl !== undefined) {
      setSheetWebhookUrl(settings.googleSheetWebhookUrl || "");
    }
    if (settings.googleSheetAutoSyncEnabled !== undefined) {
      setSheetAutoSync(settings.googleSheetAutoSyncEnabled === "true" || settings.googleSheetAutoSyncEnabled === true);
    }
  }, [settings.redirectUrl, settings.googleSheetWebhookUrl, settings.googleSheetAutoSyncEnabled]);

  const handleManualSheetSync = async () => {
    setSheetSyncing(true);
    setSheetStatusMsg("");
    try {
      // First ensure latest settings are saved
      await handleSaveSheetSettings(sheetWebhookUrl, sheetAutoSync);

      const res = await fetch("/api/google-sheets/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSheetStatusMsg(`✅ Successfully synced ${data.count} rows to Google Sheets at ${data.syncedAt}!`);
      } else {
        setSheetStatusMsg(`❌ Sync Error: ${data.error}`);
      }
    } catch (err) {
      setSheetStatusMsg(`❌ Network Error: ${err.message}`);
    } finally {
      setSheetSyncing(false);
    }
  };

  const handleSaveSheetSettings = async (urlVal, syncVal) => {
    const updated = {
      ...settings,
      googleSheetWebhookUrl: (urlVal || "").trim(),
      googleSheetAutoSyncEnabled: syncVal
    };
    const res = await onUpdateSettings(updated);
    if (res && res.success) {
      setSheetStatusMsg("Google Sheets Webhook settings saved successfully!");
      setTimeout(() => setSheetStatusMsg(""), 3500);
    }
  };

  // Purchaser / Staff State
  const [pSalutation, setPSalutation] = useState("");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPassword, setPPassword] = useState("");
  const [pRole, setPRole] = useState("crm");
  const [pDesignation, setPDesignation] = useState("CRM Executive");
  const [customDesignationInput, setCustomDesignationInput] = useState("");
  const [pError, setPError] = useState("");
  const [pSuccess, setPSuccess] = useState("");
  const [staffFilterTab, setStaffFilterTab] = useState("all");

  // Staff Edit State
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editSalutationVal, setEditSalutationVal] = useState("");
  const [editNameVal, setEditNameVal] = useState("");
  const [editPasswordVal, setEditPasswordVal] = useState("");
  const [editDesignationVal, setEditDesignationVal] = useState("Purchaser");
  const [editRoleVal, setEditRoleVal] = useState("purchaser");
  const [editSuccessMsg, setEditSuccessMsg] = useState("");

  // Vendor State
  const [vName, setVName] = useState("");
  const [vLocation, setVLocation] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vHistory, setVHistory] = useState("");
  const [vPurchaserIds, setVPurchaserIds] = useState([]);
  const [vSuccess, setVSuccess] = useState("");
  const [vError, setVError] = useState("");

  // Audit Logs State
  const [auditFilter, setAuditFilter] = useState("All"); // "All" | "Local" | "Import"
  const [auditSearch, setAuditSearch] = useState("");

  // Active User Sessions & Auth Audit Logs State
  const [activeSessions, setActiveSessions] = useState([]);
  const [authAuditLogs, setAuthAuditLogs] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessionsData = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions data:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  React.useEffect(() => {
    fetchSessionsData();
    const interval = setInterval(fetchSessionsData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForceLogout = async (userId, sessionId) => {
    try {
      const res = await fetch("/api/auth/force-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionId })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Error signing out user:", err);
    }
  };

  const handleForceLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to sign out ALL active users?")) return;
    try {
      const res = await fetch("/api/auth/force-logout-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentAdminId: "u_admin" })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setAuthAuditLogs(data.authAuditLogs || []);
      }
    } catch (err) {
      console.error("Error signing out all users:", err);
    }
  };

  // Offboarding modal state
  const [selectedDeactivateUser, setSelectedDeactivateUser] = useState(null);

  // Backup file state
  const [backupFileError, setBackupFileError] = useState("");
  const [backupFileSuccess, setBackupFileSuccess] = useState("");

  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState(null);
  const [selectedCargoCompanyForDetail, setSelectedCargoCompanyForDetail] = useState(null);
  const [showInactiveVendors, setShowInactiveVendors] = useState(false);
  const [showInactiveCarriers, setShowInactiveCarriers] = useState(false);
  const [showQuickDesignationModal, setShowQuickDesignationModal] = useState(false);

  const activePurchasers = users.filter(u => u.role === "purchaser" && u.status === "active");

  // Add Purchaser Submit
  const handleAddPurchaserSubmit = (e) => {
    e.preventDefault();
    setPError("");
    setPSuccess("");
    if (!pName || !pEmail || !pPassword) return;

    let finalDesignation = pDesignation;
    if (pDesignation === "Custom" && customDesignationInput.trim()) {
      finalDesignation = customDesignationInput.trim();
      if (onAddDesignation) onAddDesignation(finalDesignation);
    }

    let roleVal = "purchaser";
    const dLower = finalDesignation.toLowerCase();
    if (dLower.includes("owner")) roleVal = "owner";
    else if (dLower.includes("admin") || dLower.includes("superadmin")) roleVal = "superadmin";
    else if (dLower.includes("logistics") || dLower.includes("coordinator")) roleVal = "coordinator";
    else if (dLower === "nitin" || dLower.includes("packing manager")) roleVal = "nitin";
    else if (dLower === "rahul" || dLower.includes("accounts update") || dLower.includes("purchase updater")) roleVal = "rahul";
    else if (dLower.includes("crm")) roleVal = "crm";
    else if (dLower.includes("asm") || dLower.includes("area sales")) roleVal = "asm";
    else if (dLower.includes("tsm") || dLower.includes("territory sales")) roleVal = "tsm";

    const res = onAddPurchaser(pName, pEmail, pPassword, finalDesignation, roleVal);
    if (res.success) {
      setPSuccess(`Staff account ${pName} created successfully as ${finalDesignation}!`);
      setPName("");
      setPEmail("");
      setPPassword("");
    } else {
      setPError(res.message);
    }
  };

  // Add Vendor Submit
  const handleAddVendorSubmit = (e) => {
    e.preventDefault();
    setVSuccess("");
    setVError("");
    if (!vName || vPurchaserIds.length === 0) return;

    const res = onAddVendor(vName.trim(), vPurchaserIds, vLocation.trim(), vPhone.trim(), vHistory.trim());
    if (res && !res.success) {
      setVError(res.message);
      return;
    }
    setVSuccess(`Vendor "${vName}" registered successfully!`);
    setVName("");
    setVLocation("");
    setVPhone("");
    setVHistory("");
    setVPurchaserIds([]);
    setVError("");
  };

  // Handle deletion modal confirmed
  const handleTransferConfirmed = (deletedId, destId) => {
    onRemovePurchaser(deletedId, destId);
    setSelectedDeactivateUser(null);
  };

  // Export File Download
  const triggerExportDownload = () => {
    const dataStr = onExportBackup();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `makpower_backup_${new Date().toISOString().split("T")[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import File Upload
  const handleFileUpload = (e) => {
    setBackupFileError("");
    setBackupFileSuccess("");
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.users && parsed.vendors && parsed.requests && parsed.cargos) {
          onImportBackup(parsed);
          setBackupFileSuccess("System database restored successfully! Refreshing view...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setBackupFileError("Invalid file structure. Must contain users, vendors, requests, and cargos.");
        }
      } catch (err) {
        setBackupFileError("Error parsing JSON file. Please verify it is a valid backup.");
      }
    };
    fileReader.readAsText(file);
  };

  const renderModuleLoader = (title) => (
    <div className="glass-panel card-fade-in" style={{ padding: "80px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "350px", border: "1px dashed rgba(56, 189, 248, 0.3)" }}>
      <div style={{ width: "42px", height: "42px", border: "3px solid rgba(56, 189, 248, 0.2)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }}></div>
      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "0.02em" }}>
        Pulling {title} from Database...
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "380px" }}>
        Fetching fresh data on-demand. Adaptive predictive caching active.
      </div>
    </div>
  );

  return (
    <div className="main-layout">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid var(--border-glass)", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Admin Console
          </h3>
        </div>

        <button 
          onClick={() => handleTabSwitch("purchasers")}
          className={`sidebar-link ${subTab === "purchasers" ? "active" : ""}`}
        >
          <Users size={16} /> Users (CRM & Staff)
        </button>

        <button 
          onClick={() => handleTabSwitch("crmparties")}
          className={`sidebar-link ${subTab === "crmparties" ? "active" : ""}`}
          style={{ color: "#818cf8", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Building size={16} /> Parties
          </span>
          {crmParties.length > 0 && (
            <span className="badge badge-secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
              {crmParties.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => handleTabSwitch("vendors")}
          className={`sidebar-link ${subTab === "vendors" ? "active" : ""}`}
        >
          <Building size={16} /> Vendor Hub
        </button>

        <button 
          onClick={() => handleTabSwitch("cargocompanies")}
          className={`sidebar-link ${subTab === "cargocompanies" ? "active" : ""}`}
        >
          <Truck size={16} /> Cargo Companies
        </button>

        <button 
          onClick={() => handleTabSwitch("audit")}
          className={`sidebar-link ${subTab === "audit" ? "active" : ""}`}
        >
          <FileText size={16} /> Audit Purchase Logs
        </button>

        <button 
          onClick={() => handleTabSwitch("backup")}
          className={`sidebar-link ${subTab === "backup" ? "active" : ""}`}
        >
          <Database size={16} /> Database Backup
        </button>

        <button 
          onClick={() => handleTabSwitch("settings")}
          className={`sidebar-link ${subTab === "settings" ? "active" : ""}`}
        >
          <Sliders size={16} /> System Settings
        </button>

        <button 
          onClick={() => handleTabSwitch("itemmaster")}
          className={`sidebar-link ${subTab === "itemmaster" ? "active" : ""}`}
          style={{ color: "#38bdf8", fontWeight: 700 }}
        >
          <Package size={16} /> Item Catalog & Stock
        </button>

        <button 
          onClick={() => handleTabSwitch("pricemanagement")}
          className={`sidebar-link ${subTab === "pricemanagement" ? "active" : ""}`}
          style={{ color: "#34d399", fontWeight: 700 }}
        >
          <Tag size={16} /> Price Management
        </button>

        <button 
          onClick={() => handleTabSwitch("missingids")}
          className={`sidebar-link ${subTab === "missingids" ? "active" : ""}`}
          style={{ 
            color: adminMissingImsItems.length > 0 ? "#f59e0b" : "var(--text-muted)", 
            fontWeight: 700, 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center" 
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldAlert size={16} /> Missing Item IDs (IMS)
          </span>
          {adminMissingImsItems.length > 0 && (
            <span className="badge badge-warning" style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
              {adminMissingImsItems.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => handleTabSwitch("sessions")}
          className={`sidebar-link ${subTab === "sessions" ? "active" : ""}`}
          style={{ color: "#10b981", fontWeight: 700 }}
        >
          <ShieldCheck size={16} /> User Sessions & Logs
        </button>

        <button 
          onClick={() => handleTabSwitch("filemanager")}
          className={`sidebar-link ${subTab === "filemanager" ? "active" : ""}`}
          style={{ color: "#f59e0b", fontWeight: 700 }}
        >
          <Folder size={16} /> Storage & File Manager
        </button>
      </aside>

      {/* Main content display */}
      <section className="main-content">

        {/* USER SESSIONS & AUTH LOGS TAB */}
        {subTab === "sessions" && (
          <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Header & Global Action Bar */}
            <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <ShieldCheck size={24} style={{ color: "#10b981" }} /> User Active Sessions & Authentication Logs
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Monitor who is signed in right now, view login & logout timestamp history, and remotely sign out specific users or all users.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={fetchSessionsData} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <RefreshCw size={14} className={loadingSessions ? "spin" : ""} /> Refresh
                </button>

                <button 
                  onClick={handleForceLogoutAll} 
                  className="btn btn-danger" 
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <LogOut size={14} /> Sign Out All Users
                </button>
              </div>
            </div>

            {/* Currently Active Logged-In Users */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "var(--success)" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--success)" }}></span>
                  Currently Logged In Right Now ({activeSessions.length})
                </h3>
              </div>

              {activeSessions.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  No active user sessions currently registered.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%", minWidth: "650px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "20%", textAlign: "center" }}>Status</th>
                        <th style={{ width: "25%", textAlign: "center" }}>User Name</th>
                        <th style={{ width: "15%", textAlign: "center" }}>Role</th>
                        <th style={{ width: "25%", textAlign: "center" }}>Signed In At</th>
                        <th style={{ width: "15%", textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.map(s => {
                        const displayRole = s.role === "superadmin" ? "Admin" : s.role;
                        const displayName = (s.userName || "").replace(/super\s*admin/gi, "Admin");

                        return (
                          <tr key={s.sessionId}>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }}></span> 🟢 Active Now
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: "var(--primary)", textAlign: "center" }}>{displayName}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-secondary" style={{ textTransform: "capitalize" }}>{displayRole}</span>
                            </td>
                            <td style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>{s.loginTime}</td>
                            <td style={{ textAlign: "center" }}>
                              <button 
                                onClick={() => handleForceLogout(s.userId, s.sessionId)} 
                                className="btn btn-sm btn-danger"
                                style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                              >
                                Sign Out
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

            {/* Login & Logout History Audit Trail */}
            <div className="glass-panel" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={18} style={{ color: "var(--primary)" }} /> Authentication History & Timestamp Log
              </h3>

              {authAuditLogs.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  No authentication logs recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: "450px" }}>
                  <table className="table" style={{ width: "100%", minWidth: "650px" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{ width: "24%", textAlign: "center" }}>Date & Time</th>
                        <th style={{ width: "26%", textAlign: "center" }}>User Name</th>
                        <th style={{ width: "16%", textAlign: "center" }}>Role</th>
                        <th style={{ width: "18%", textAlign: "center" }}>Auth Event Action</th>
                        <th style={{ width: "16%", textAlign: "center" }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authAuditLogs.map(log => {
                        const displayRole = log.role === "superadmin" ? "Admin" : log.role;
                        const displayName = (log.userName || "").replace(/super\s*admin/gi, "Admin");

                        return (
                          <tr key={log.id}>
                            <td style={{ fontSize: "0.83rem", color: "var(--text-muted)", textAlign: "center" }}>{log.timestamp}</td>
                            <td style={{ fontWeight: 600, textAlign: "center" }}>{displayName}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="badge badge-secondary" style={{ textTransform: "capitalize" }}>{displayRole}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`badge ${log.action === "Login" ? "badge-success" : log.action === "Logout" ? "badge-secondary" : "badge-danger"}`}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>{log.details || "N/A"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ITEM MASTER & STOCK TAB */}
        {subTab === "itemmaster" && (
          loadingModules.items && items.length === 0 ? (
            renderModuleLoader("Item Catalog & Master Stock")
          ) : (
            <ItemCatalogPanel 
              items={items}
              onAddItem={onAddItem}
              onBulkAddItems={onBulkAddItems}
              onDeleteItems={onDeleteItems}
              onUpdateItem={onUpdateItem}
              onMergeItems={onMergeItems}
              currentUser={{ role: "superadmin", name: "Admin" }}
              requests={requests}
              cargos={cargos}
              vendors={vendors}
              users={users}
              cargoCompanies={cargoCompanies}
            />
          )
        )}

        {/* PRICE MANAGEMENT TAB (IMAGE 3 SPECIFICATION) */}
        {subTab === "pricemanagement" && (
          <PriceManagementPanel 
            items={items}
            itemPrices={itemPrices}
            onAddPrice={onAddPrice}
            onUpdatePrice={onUpdatePrice}
            onDeletePrice={onDeletePrice}
            onBatchUploadPrices={onBatchUploadPrices}
            onBulkDeletePrices={onBulkDeletePrices}
            currentUser={currentUser}
          />
        )}

        {/* PURCHASERS & CRM USERS MANAGEMENT TAB */}
        {subTab === "purchasers" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>System Users & CRM Staff Management</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
              
              {/* Active Staff List */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)" }}>Active Staff Members</h3>
                
                {/* Role Filter Pills */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                  <button 
                    type="button" 
                    onClick={() => setStaffFilterTab("all")}
                    className={`btn btn-sm ${staffFilterTab === "all" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.78rem" }}
                  >
                    All Users ({effectiveUsers.filter(u => u.role !== "superadmin" && u.status !== "inactive" && u.status !== "disabled").length})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStaffFilterTab("crm")}
                    className={`btn btn-sm ${staffFilterTab === "crm" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.78rem", background: staffFilterTab === "crm" ? "linear-gradient(135deg, #0284c7, #6366f1)" : "" }}
                  >
                    💼 CRM ({effectiveUsers.filter(u => u.role === "crm" && u.status !== "inactive" && u.status !== "disabled").length})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStaffFilterTab("sales")}
                    className={`btn btn-sm ${staffFilterTab === "sales" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.78rem" }}
                  >
                    🟢 ASM/TSM ({effectiveUsers.filter(u => (u.role === "asm" || u.role === "tsm") && u.status !== "inactive" && u.status !== "disabled").length})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStaffFilterTab("purchaser")}
                    className={`btn btn-sm ${staffFilterTab === "purchaser" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.78rem" }}
                  >
                    🛒 Purchasers ({effectiveUsers.filter(u => u.role === "purchaser" && u.status !== "inactive" && u.status !== "disabled").length})
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {effectiveUsers.filter(u => {
                    if (u.role === "superadmin" || u.status === "inactive" || u.status === "disabled") return false;
                    if (staffFilterTab === "crm") return u.role === "crm";
                    if (staffFilterTab === "sales") return u.role === "asm" || u.role === "tsm";
                    if (staffFilterTab === "purchaser") return u.role === "purchaser";
                    return true;
                  }).map(staff => {
                    const getRoleLabel = (role) => {
                      if (role === "nitin") return "Packing";
                      if (role === "rahul") return "Updates";
                      if (role === "coordinator") return "Coordinator";
                      if (role === "crm") return "CRM Executive";
                      if (role === "asm") return "Area Sales Manager";
                      if (role === "tsm") return "Territory Sales Manager";
                      return "Purchaser";
                    };
                    const isPurchaser = staff.role === "purchaser";
                    const isCrmStaff = staff.role === "crm" || staff.role === "asm" || staff.role === "tsm";
                    const activeRequests = isPurchaser ? requests.filter(r => r.purchaserId === staff.id && r.isMaterialRec !== "Yes").length : 0;
                    return (
                      <div key={staff.id} className="glass-panel" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255, 255, 255, 0.01)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                              {staff.name}
                              <span className="badge" style={{ fontSize: "0.65rem", padding: "2px 8px", background: isCrmStaff ? "rgba(99, 102, 241, 0.15)" : "rgba(56, 189, 248, 0.12)", color: isCrmStaff ? "#a5b4fc" : "#38bdf8", border: isCrmStaff ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700 }}>
                                {staff.designation || getRoleLabel(staff.role)}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>{staff.email}</div>
                            {isPurchaser && (
                              <div style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: "4px" }}>{activeRequests} active purchases in tracking</div>
                            )}
                          </div>
                          
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button 
                              onClick={() => {
                                setEditingStaffId(staff.id);
                                let sal = "";
                                let nm = staff.name || "";
                                const match = nm.match(/^(Mr\.|Mrs\.|Miss|Ms\.)\s*(.*)$/i);
                                if (match) {
                                  sal = match[1];
                                  nm = match[2];
                                }
                                setEditSalutationVal(sal);
                                setEditNameVal(nm);
                                setEditPasswordVal("");
                                setEditDesignationVal(staff.designation || "Purchaser");
                                setEditRoleVal(staff.role || "purchaser");
                                setEditSuccessMsg("");
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                            >
                              Edit Account
                            </button>
                            
                            {(isPurchaser || isCrmStaff || staff.role === "coordinator" || staff.role === "nitin" || staff.role === "rahul") && (
                              <button 
                                onClick={() => {
                                  if (isPurchaser) {
                                    setSelectedDeactivateUser(staff);
                                  } else {
                                    if (window.confirm(`Are you sure you want to deactivate account "${staff.name}"?`)) {
                                      onUpdateUserInfo(staff.id, { status: "inactive" });
                                    }
                                  }
                                }}
                                className="btn btn-danger btn-sm"
                                title="Deactivate user account"
                                style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                              >
                                <UserMinus size={12} /> Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Form */}
                        {editingStaffId === staff.id && (
                          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-glass)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--primary)" }}>Edit Staff Account</div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px" }}>
                              <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>Salutation</label>
                                <select 
                                  className="form-control" 
                                  style={{ padding: "4px 6px", fontSize: "0.85rem", height: "32px" }}
                                  value={editSalutationVal}
                                  onChange={e => setEditSalutationVal(e.target.value)}
                                >
                                  <option value="">(None)</option>
                                  <option value="Mr.">Mr.</option>
                                  <option value="Mrs.">Mrs.</option>
                                  <option value="Miss">Miss</option>
                                  <option value="Ms.">Ms.</option>
                                </select>
                              </div>

                              <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                                <label className="form-label" style={{ fontSize: "0.72rem" }}>Full Name</label>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  style={{ padding: "6px 10px", fontSize: "0.85rem", height: "32px" }}
                                  placeholder="Full Name"
                                  value={editNameVal}
                                  onChange={e => setEditNameVal(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                              <label className="form-label" style={{ fontSize: "0.72rem" }}>System Access Role (Permissions)</label>
                              <select 
                                className="form-control" 
                                style={{ padding: "4px 8px", fontSize: "0.85rem", height: "32px", fontWeight: 700, color: "var(--primary)" }}
                                value={editRoleVal}
                                onChange={e => {
                                  const r = e.target.value;
                                  setEditRoleVal(r);
                                  if (r === "owner") setEditDesignationVal("Owner");
                                  else if (r === "purchaser") setEditDesignationVal("Purchaser");
                                  else if (r === "nitin") setEditDesignationVal("Packing");
                                  else if (r === "rahul") setEditDesignationVal("Accounts and Updates");
                                  else if (r === "coordinator") setEditDesignationVal("Logistics");
                                  else if (r === "crm") setEditDesignationVal("CRM Executive");
                                  else if (r === "asm") setEditDesignationVal("Area Sales Manager (ASM)");
                                  else if (r === "tsm") setEditDesignationVal("Territory Sales Manager (TSM)");
                                }}
                              >
                                <option value="crm">💼 CRM (Customer Relationship Management)</option>
                                <option value="asm">🟢 ASM (Area Sales Manager)</option>
                                <option value="tsm">🟡 TSM (Territory Sales Manager)</option>
                                <option value="owner">👑 Owner (Executive Dashboard)</option>
                                <option value="purchaser">🛒 Purchaser (Order Processing)</option>
                                <option value="nitin">📦 Packing</option>
                                <option value="rahul">💰 Accounts & Updates</option>
                                <option value="coordinator">🚚 Logistics Coordinator</option>
                                <option value="superadmin">⚡ System Admin</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0, gap: "4px" }}>
                              <label className="form-label" style={{ fontSize: "0.72rem" }}>Designation Title</label>
                              <select 
                                className="form-control" 
                                style={{ padding: "4px 8px", fontSize: "0.85rem", height: "32px" }}
                                value={editDesignationVal}
                                onChange={e => setEditDesignationVal(e.target.value)}
                              >
                                <option value="CRM Executive">CRM Executive</option>
                                <option value="Area Sales Manager (ASM)">Area Sales Manager (ASM)</option>
                                <option value="Territory Sales Manager (TSM)">Territory Sales Manager (TSM)</option>
                                <option value="Purchaser">Purchaser</option>
                                <option value="Packing">Packing</option>
                                <option value="Accounts and Updates">Accounts and Updates</option>
                                <option value="Accounts">Accounts</option>
                                <option value="Warehouse">Warehouse</option>
                                <option value="Logistics">Logistics</option>
                                <option value="Owner">Owner (Executive Dashboard)</option>
                                <option value="System Admin">System Admin</option>
                                {(designations || []).map(d => (
                                  <option key={d.id} value={d.title}>{d.title}</option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: "4px", gap: "4px" }}>
                              <label className="form-label" style={{ fontSize: "0.72rem" }}>New Password (leave blank to keep current)</label>
                              <input 
                                type="text" 
                                autoComplete="off"
                                className="form-control" 
                                style={{ padding: "6px 10px", fontSize: "0.85rem", height: "32px", WebkitTextSecurity: "disc" }}
                                placeholder="New password"
                                value={editPasswordVal}
                                onChange={e => setEditPasswordVal(e.target.value)}
                              />
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                              <button 
                                onClick={() => {
                                  if (!editNameVal.trim()) return;
                                  const roleVal = editRoleVal || "purchaser";
                                  
                                  const cleanName = editNameVal.trim().replace(/^((mr\.|mrs\.|miss|ms\.)\s*)+/i, "");
                                  const finalName = editSalutationVal ? `${editSalutationVal} ${cleanName}` : cleanName;
                                  
                                  const updates = { 
                                    name: finalName, 
                                    designation: editDesignationVal,
                                    role: roleVal 
                                  };
                                  if (editPasswordVal.trim()) {
                                    updates.password = editPasswordVal.trim();
                                  }
                                  onUpdateUserInfo(staff.id, updates);
                                  setEditSuccessMsg("Account updated!");
                                  setTimeout(() => {
                                    setEditingStaffId(null);
                                    setEditSuccessMsg("");
                                  }, 1200);
                                }}
                                className="btn btn-success btn-sm"
                                style={{ padding: "6px 12px", height: "32px", fontSize: "0.8rem" }}
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => setEditingStaffId(null)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "6px 12px", height: "32px", fontSize: "0.8rem" }}
                              >
                                Cancel
                              </button>
                            </div>
                            {editSuccessMsg && (
                              <div style={{ color: "var(--success)", fontSize: "0.78rem", marginTop: "4px" }}>{editSuccessMsg}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Staff Account Form */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Create New User (CRM / Staff)</h3>
                {pError && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{pError}</div>}
                {pSuccess && <div className="alert-strip alert-success" style={{ marginBottom: "14px" }}>{pSuccess}</div>}

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!pName.trim()) return;
                  const cleanName = pName.trim().replace(/^((mr\.|mrs\.|miss|ms\.)\s*)+/i, "");
                  const finalPName = pSalutation ? `${pSalutation} ${cleanName}` : cleanName;
                  
                  const des = pDesignation === "Custom" ? customDesignationInput.trim() : pDesignation;
                  onAddPurchaser(finalPName, pEmail.trim(), pPassword.trim(), des, pRole);
                  setPSuccess(`✅ Account for "${finalPName}" created successfully with role ${pRole.toUpperCase()}!`);
                  setPName("");
                  setPEmail("");
                  setPPassword("");
                  setCustomDesignationInput("");
                  setTimeout(() => setPSuccess(""), 3500);
                }} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Salutation</label>
                      <select 
                        className="form-control"
                        value={pSalutation}
                        onChange={e => setPSalutation(e.target.value)}
                      >
                        <option value="">(None)</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Miss">Miss</option>
                        <option value="Ms.">Ms.</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Priya Sharma"
                        value={pName}
                        onChange={e => setPName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control"
                      placeholder="e.g. name@makpowerindia.com"
                      value={pEmail}
                      onChange={e => setPEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">System Role*</label>
                    <select 
                      className="form-control"
                      value={pRole}
                      onChange={e => {
                        const r = e.target.value;
                        setPRole(r);
                        if (r === "crm") setPDesignation("CRM Executive");
                        else if (r === "asm") setPDesignation("Area Sales Manager (ASM)");
                        else if (r === "tsm") setPDesignation("Territory Sales Manager (TSM)");
                        else if (r === "purchaser") setPDesignation("Purchaser");
                        else if (r === "nitin") setPDesignation("Packing");
                        else if (r === "rahul") setPDesignation("Accounts and Updates");
                        else if (r === "coordinator") setPDesignation("Logistics");
                        else if (r === "owner") setPDesignation("Owner");
                      }}
                      style={{ fontWeight: 700, borderColor: pRole === "crm" ? "#6366f1" : "" }}
                    >
                      <option value="crm">💼 CRM (Customer Relationship Management)</option>
                      <option value="asm">🟢 Area Sales Manager (ASM)</option>
                      <option value="tsm">🟡 Territory Sales Manager (TSM)</option>
                      <option value="purchaser">🛒 Purchaser</option>
                      <option value="nitin">📦 Packing (Nitin)</option>
                      <option value="rahul">💰 Accounts & Updates (Rahul)</option>
                      <option value="coordinator">🚚 Logistics PC</option>
                      <option value="owner">👑 Owner (Executive Dashboard)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="form-label" style={{ margin: 0 }}>Designation Title</label>
                      <button 
                        type="button" 
                        onClick={() => setShowQuickDesignationModal(true)} 
                        style={{ 
                          color: "#38bdf8", 
                          cursor: "pointer", 
                          fontSize: "0.8rem", 
                          background: "none", 
                          border: "none", 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: "4px",
                          fontWeight: 600
                        }}
                      >
                        <Plus size={13} /> Create New Designation
                      </button>
                    </div>
                    <select 
                      className="form-control"
                      value={pDesignation}
                      onChange={e => setPDesignation(e.target.value)}
                    >
                      <option value="CRM Executive">💼 CRM Executive (Customer Relationship)</option>
                      <option value="Area Sales Manager (ASM)">🟢 Area Sales Manager (ASM)</option>
                      <option value="Territory Sales Manager (TSM)">🟡 Territory Sales Manager (TSM)</option>
                      <option value="Purchaser">🛒 Purchaser</option>
                      <option value="Packing">📦 Packing</option>
                      <option value="Accounts and Updates">💰 Accounts and Updates</option>
                      <option value="Accounts">Accounts</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Logistics">🚚 Logistics</option>
                      <option value="Owner">👑 Owner (Executive Dashboard)</option>
                      <option value="System Admin">⚡ System Admin</option>
                      {(designations || []).map(d => (
                        <option key={d.id} value={d.title}>{d.title}</option>
                      ))}
                      <option value="Custom">+ Write-in Custom Designation</option>
                    </select>
                  </div>

                  <QuickCreateDesignationModal
                    isOpen={showQuickDesignationModal}
                    onClose={() => setShowQuickDesignationModal(false)}
                    onAddDesignation={onAddDesignation}
                    onDesignationCreated={(title) => {
                      if (title) setPDesignation(title);
                    }}
                  />

                  {pDesignation === "Custom" && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Custom Designation Title*</label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Quality Control, Factory Head"
                        value={customDesignationInput}
                        onChange={e => setCustomDesignationInput(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Login Password</label>
                    <input 
                      type="text" 
                      autoComplete="off"
                      className="form-control"
                      placeholder="Choose a strong password"
                      value={pPassword}
                      onChange={e => setPPassword(e.target.value)}
                      required
                      style={{ WebkitTextSecurity: "disc" }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }}>
                    <Plus size={16} /> Create Account
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* VENDORS MANAGEMENT TAB */}
        {subTab === "vendors" && (
          loadingModules.vendors && vendors.length === 0 ? (
            renderModuleLoader("Vendor Hub")
          ) : (
            <div className="card-fade-in">
              <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Vendor Hub</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
                
                {/* Vendors List & Reassign */}
                <div className="glass-panel" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "1.2rem", color: "var(--primary)", margin: 0 }}>Registered Vendors</h3>
                    <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={showInactiveVendors} 
                        onChange={e => setShowInactiveVendors(e.target.checked)} 
                        style={{ cursor: "pointer" }}
                      />
                      Show Inactive
                    </label>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
                    {vendors.filter(v => showInactiveVendors || v.status !== "Inactive").length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
                        No vendors found.
                      </div>
                    ) : (
                      vendors
                        .filter(v => showInactiveVendors || v.status !== "Inactive")
                        .map(vendor => (
                          <div 
                            key={vendor.id} 
                            className="glass-panel" 
                            style={{ 
                              padding: "14px", 
                              display: "flex", 
                              flexDirection: "column", 
                              gap: "8px", 
                              background: "rgba(255, 255, 255, 0.01)",
                              opacity: vendor.status === "Inactive" ? 0.6 : 1,
                              borderLeft: vendor.status === "Inactive" ? "3px solid #ef4444" : "3px solid var(--primary)"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span 
                                  onClick={() => setSelectedVendorForDetail(vendor)}
                                  style={{ fontWeight: 600, color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}
                                  title="Click to view full vendor profile"
                                >
                                  {vendor.name}
                                </span>
                                {vendor.status === "Inactive" && (
                                  <span className="badge badge-danger" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>Inactive</span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button 
                                  onClick={() => setEditingVendor(vendor)} 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "4px 8px" }}
                                  title="Edit Vendor"
                                >
                                  <Edit2 size={12} />
                                </button>
                                {vendor.status !== "Inactive" && (
                                  <button 
                                    onClick={() => onRemoveVendor(vendor.id)} 
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: "4px 8px" }}
                                    title="Deactivate Vendor"
                                  >
                                    <UserMinus size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                              {vendor.location && <span>📍 {vendor.location}</span>}
                              {vendor.phone && <span>📞 {vendor.phone}</span>}
                            </div>

                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              <strong style={{ color: "var(--text)" }}>Assigned Purchasers:</strong>{" "}
                              {vendor.purchaserIds && vendor.purchaserIds.length > 0 ? (
                                vendor.purchaserIds.map(pid => {
                                  const p = users.find(u => u.id === pid);
                                  return p ? p.name : pid;
                                }).join(", ")
                              ) : (
                                <span style={{ color: "#ef4444" }}>None (Unassigned)</span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Register Vendor Form */}
                <div className="glass-panel" style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Register New Vendor</h3>
                  {vSuccess && <div className="badge badge-success" style={{ display: "block", padding: "8px", marginBottom: "12px", textAlign: "center" }}>{vSuccess}</div>}
                  {vError && <div className="badge badge-danger" style={{ display: "block", padding: "8px", marginBottom: "12px", textAlign: "center" }}>{vError}</div>}
                  
                  <form onSubmit={handleAddVendorSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div className="form-group">
                      <label className="form-label">Vendor Company Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Shenzhen Electronics Co."
                        value={vName}
                        onChange={e => setVName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Location / Address</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Guangzhou, China"
                        value={vLocation}
                        onChange={e => setVLocation(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone / WhatsApp / WeChat</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="+86..."
                        value={vPhone}
                        onChange={e => setVPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Assign Purchasers (Select multiple)</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto", background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "4px" }}>
                        {users.filter(u => u.role !== "superadmin" && u.status === "active").map(p => (
                          <label key={p.id} style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                            <input 
                              type="checkbox" 
                              checked={vPurchaserIds.includes(p.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setVPurchaserIds(prev => [...prev, p.id]);
                                } else {
                                  setVPurchaserIds(prev => prev.filter(id => id !== p.id));
                                }
                              }}
                            />
                            {p.name} ({p.role})
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Notes / History</label>
                      <textarea 
                        className="form-control" 
                        placeholder="Payment terms, contact person, etc."
                        rows="2"
                        value={vHistory}
                        onChange={e => setVHistory(e.target.value)}
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: "100%", marginTop: "10px" }}
                      disabled={vPurchaserIds.length === 0}
                    >
                      <Plus size={16} /> Register Vendor
                    </button>
                  </form>
                </div>

              </div>
            </div>
          )
        )}

        {/* AUDIT LOG TAB */}
        {subTab === "audit" && (
          loadingModules.auditLogs && auditLogs.length === 0 ? (
            renderModuleLoader("Audit Purchase Logs")
          ) : (
            <AuditLogsPanel auditLogs={auditLogs} users={users} requests={requests} vendors={vendors} />
          )
        )}

        {/* DATABASE BACKUP TAB */}
        {subTab === "backup" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>System State Synchronization</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "30px" }}>
              
              {/* Export Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)" }}>Export State</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Download a backup file containing all user roles, registered vendors, active purchase sheets, payment history, and linked Cargo logistics data.
                </p>

                <button onClick={triggerExportDownload} className="btn btn-primary" style={{ width: "100%" }}>
                  <Download size={16} /> Download Backup (.json)
                </button>
              </div>

              {/* Import Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)" }}>Import State</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Upload a previously saved Mak Power backup file. This will restore the entire database state. 
                  <strong style={{ color: "var(--danger)" }}> WARNING: This will overwrite your current browser data.</strong>
                </p>

                {backupFileError && <div className="alert-strip alert-danger">{backupFileError}</div>}
                {backupFileSuccess && <div className="alert-strip alert-success">{backupFileSuccess}</div>}

                <div className="form-group">
                  <label className="doc-upload-btn" style={{ justifyContent: "center", padding: "14px", borderStyle: "dashed" }}>
                    <Upload size={16} /> <span>Upload Backup File</span>
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleFileUpload} 
                      style={{ display: "none" }} 
                    />
                  </label>
                </div>
              </div>

              {/* Cloudinary Image Migration Panel */}
              <div className="glass-panel" style={{ padding: "24px", gridColumn: "1 / -1" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={18} style={{ color: "#38bdf8" }} /> Cloudinary Photo Storage Migration Engine
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
                  Automatically scans your database for any local SVG, base64, or data-URI photos, uploads them to your Cloudinary database storage, and converts database references to fast HTTPS Cloudinary URLs.
                </p>

                {migrationStatusMsg && (
                  <div className={`alert-strip ${migrationStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {migrationStatusMsg}
                  </div>
                )}

                <button 
                  onClick={handleMigratePhotos}
                  disabled={migratingPhotos}
                  className="btn btn-primary"
                  style={{ padding: "12px 24px", fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <RefreshCw size={16} className={migratingPhotos ? "spin" : ""} />
                  {migratingPhotos ? "Migrating Database Photos to Cloudinary..." : "Migrate All Database Photos to Cloudinary"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* CARGO COMPANIES MANAGEMENT TAB */}
        {subTab === "cargocompanies" && (
          loadingModules.cargoCompanies && cargoCompanies.length === 0 ? (
            renderModuleLoader("Cargo Companies")
          ) : (
            <div className="card-fade-in">
              <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>Cargo Companies</h2>
              <CargoCompaniesPanel 
                cargoCompanies={cargoCompanies}
                onAddCargoCompany={onAddCargoCompany}
                onUpdateCargoCompany={onUpdateCargoCompany}
                onRemoveCargoCompany={onRemoveCargoCompany}
                onSelectCargoCompany={setSelectedCargoCompanyForDetail}
              />
            </div>
          )
        )}

        {/* SYSTEM SETTINGS TAB */}
        {subTab === "settings" && (
          <div className="card-fade-in">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "20px" }}>System Settings</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px", alignItems: "start" }}>
              
              {/* Admin Password Management Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Key size={20} style={{ color: "#38bdf8" }} /> Update Admin Password
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Update the master password for the Super Admin account (<code>admin@company.com</code>).
                </p>

                {adminPassMsg.text && (
                  <div className={`alert-strip alert-${adminPassMsg.type}`} style={{ marginBottom: "16px" }}>
                    {adminPassMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdateAdminPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">New Admin Password</label>
                    <input 
                      type="text"
                      autoComplete="off"
                      className="form-control"
                      placeholder="Enter new password"
                      value={newAdminPassword}
                      onChange={e => setNewAdminPassword(e.target.value)}
                      required
                      style={{ WebkitTextSecurity: "disc" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Confirm New Admin Password</label>
                    <input 
                      type="text"
                      autoComplete="off"
                      className="form-control"
                      placeholder="Re-enter new password"
                      value={confirmAdminPassword}
                      onChange={e => setConfirmAdminPassword(e.target.value)}
                      required
                      style={{ WebkitTextSecurity: "disc" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingAdminPass}
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}
                  >
                    {updatingAdminPass ? "Updating Admin Password..." : "Update Admin Password"}
                  </button>
                </form>
              </div>
              
              {/* Visibility Controller Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>System Visibility Mode</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
                  Toggling panic mode hides the entire application. Anyone trying to visit the website will be forced to redirect to the URL configured on the right.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: settings.isHidden ? "var(--danger)" : "var(--success)", boxShadow: settings.isHidden ? "0 0 10px var(--danger)" : "0 0 10px var(--success)" }}></div>
                    <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                      System Status: {settings.isHidden ? "HIDDEN (Panic Mode)" : "ACTIVE / VISIBLE"}
                    </span>
                  </div>

                  <button 
                    onClick={async () => {
                      const updated = { ...settings, isHidden: !settings.isHidden };
                      const res = await onUpdateSettings(updated);
                      if (res && res.success) {
                        setSettingsSuccessMsg(`System visibility updated to: ${updated.isHidden ? "Hidden" : "Visible"}`);
                        setTimeout(() => setSettingsSuccessMsg(""), 3000);
                      }
                    }} 
                    className={`btn ${settings.isHidden ? "btn-primary" : "btn-danger"}`}
                    style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
                  >
                    {settings.isHidden ? "Show Application (Turn Off Panic)" : "Hide App & Force Redirect Users"}
                  </button>
                </div>

                {settingsSuccessMsg && (
                  <div className="alert-strip alert-success" style={{ marginTop: "16px", marginBottom: 0 }}>
                    {settingsSuccessMsg}
                  </div>
                )}
              </div>

              {/* Cloudinary CDN Photo Migration Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Upload size={20} style={{ color: "#38bdf8" }} /> Cloudinary Storage & Photo Migration
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Scans all database order items and catalog model photos. Converts raw Base64 data images (`data:image...`) into hosted Cloudinary HTTPS CDN URLs for Google Sheets rendering.
                </p>

                {migrationStatusMsg && (
                  <div className={`alert-strip ${migrationStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {migrationStatusMsg}
                  </div>
                )}

                <button
                  onClick={handleMigratePhotos}
                  disabled={migratingPhotos}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <RefreshCw size={16} className={migratingPhotos ? "spin" : ""} />
                  {migratingPhotos ? "Migrating All Photos to Cloudinary..." : "Migrate All Database Photos to Cloudinary CDN"}
                </button>
              </div>

              {/* Data Purge / Wipe Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--danger)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Trash2 size={20} style={{ color: "var(--danger)" }} /> Purge Operational Data
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Wipes all operational data (orders, requests, vendors, items, cargo shipments) starting completely fresh with 0 records. User accounts are preserved.
                </p>

                <button
                  onClick={async () => {
                    if (!window.confirm("⚠️ ARE YOU SURE? This will permanently delete ALL orders, vendors, items, and cargo shipments!")) return;
                    if (onPurgeAllData) {
                      await onPurgeAllData(true);
                      alert("✅ All operational data, vendors, and items have been purged successfully!");
                    }
                  }}
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}
                >
                  Purge All Orders, Vendors, Cargo & Items Data
                </button>
              </div>

              {/* Broadcast Red Update Banner Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "var(--danger)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <RefreshCw size={20} style={{ color: "var(--danger)" }} /> Broadcast Red Update Banner
                </h3>
                
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
                  Displays a prominent sticky red alert banner at the top of all active users' browsers (purchasers, managers, coordinator, owner, guests) prompting them to click for a hard cache refresh (Ctrl+Shift+R) for latest webapp updates.
                </p>

                {forceRefreshMsg && (
                  <div className="alert-strip alert-success" style={{ marginBottom: "16px" }}>
                    <Check size={16} /> {forceRefreshMsg}
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!window.confirm("⚡ Are you sure you want to broadcast the red update banner to ALL connected browsers?")) return;
                    try {
                      setForceRefreshLoading(true);
                      const res = await fetch("/api/settings/force-refresh", { method: "POST" });
                      const json = await res.json();
                      if (json.success) {
                        setForceRefreshMsg("⚡ Red update banner broadcasted to all connected browsers!");
                        setTimeout(() => setForceRefreshMsg(""), 5000);
                      }
                    } catch (err) {
                      alert("Failed to broadcast update banner: " + err.message);
                    } finally {
                      setForceRefreshLoading(false);
                    }
                  }}
                  disabled={forceRefreshLoading}
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "12px", fontSize: "0.9rem", fontWeight: 700, background: "linear-gradient(135deg, #dc2626, #ef4444)" }}
                >
                  <RefreshCw size={16} className={forceRefreshLoading ? "spin" : ""} /> {forceRefreshLoading ? "Broadcasting..." : "⚡ Broadcast Red Update Banner to All Browsers"}
                </button>
              </div>

              {/* Redirect Settings Panel */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--primary)" }}>Panic Redirect Settings</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Redirect Target URL</label>
                    <input 
                      type="url" 
                      className="form-control" 
                      placeholder="https://www.instagram.com/makpowerofficial/"
                      value={redirectUrlInput}
                      onChange={e => setRedirectUrlInput(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      if (!redirectUrlInput.trim()) return;
                      const updated = { ...settings, redirectUrl: redirectUrlInput.trim() };
                      const res = await onUpdateSettings(updated);
                      if (res && res.success) {
                        setSettingsSuccessMsg("Redirect URL updated successfully!");
                        setTimeout(() => setSettingsSuccessMsg(""), 3000);
                      }
                    }} 
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Save Redirect URL
                  </button>

                  <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px", marginTop: "6px" }}>
                    <label className="form-label" style={{ color: "var(--primary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                      Instant Panic Trigger Link (/web):
                    </label>
                    <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "0.8rem", wordBreak: "break-all", justifyContent: "space-between", alignItems: "center" }}>
                      <code>{window.location.origin}/web</code>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                      Share this link with trusted team members. Opening this link in any browser will immediately lock the app and redirect them to your Instagram page.
                    </span>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px", marginTop: "6px" }}>
                    <label className="form-label" style={{ color: "var(--primary)", fontSize: "0.85rem", marginBottom: "4px" }}>
                      Bypass Code Link (?bypass=true):
                    </label>
                    <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "0.8rem", wordBreak: "break-all", justifyContent: "space-between", alignItems: "center" }}>
                      <code>{window.location.origin}/?bypass=true</code>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
                      Use this bypass link to access the app and log back in as Super Admin when panic mode is active.
                    </span>
                  </div>
                </div>
              </div>

              {/* Google Sheets Integration Panel */}
              <div className="glass-panel" style={{ padding: "24px", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={20} style={{ color: "#10b981" }} /> Google Sheets 27-Column Adaptive Auto-Sync (3 Min Active Throttle & Idle Backoff)
                  </h3>

                  {settings.lastGoogleSheetSyncTime && (
                    <span className="badge badge-success" style={{ fontSize: "0.78rem" }}>
                      Last Synced: {settings.lastGoogleSheetSyncTime}
                    </span>
                  )}
                </div>

                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "16px" }}>
                  Intelligent Adaptive Sync: When activity occurs in app (e.g. Nitin packing orders, new requisitions), syncs every 3 minutes (min 3 min gap between runs). When idle (&lt;30m), syncs every 30 mins. After 30m idle, takes a 60 min gap, then increases gap up to 3 hours standing backup interval.
                </p>

                {sheetStatusMsg && (
                  <div className={`alert-strip ${sheetStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {sheetStatusMsg}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Google Apps Script Webhook URL</label>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                      <input 
                        type="url" 
                        className="form-control" 
                        placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                        value={sheetWebhookUrl}
                        onChange={e => setSheetWebhookUrl(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button 
                        onClick={() => handleSaveSheetSettings(sheetWebhookUrl, sheetAutoSync)}
                        className="btn btn-secondary"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        Save Settings
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <input 
                        type="checkbox" 
                        id="sheetAutoSyncToggle"
                        checked={sheetAutoSync}
                        onChange={e => {
                          const val = e.target.checked;
                          setSheetAutoSync(val);
                          handleSaveSheetSettings(sheetWebhookUrl, val);
                        }}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <label htmlFor="sheetAutoSyncToggle" style={{ fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                        Enable Automatic 10-Minute Sync Engine
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
                    <button 
                      onClick={handleManualSheetSync}
                      disabled={sheetSyncing}
                      className="btn btn-primary"
                      style={{ padding: "12px", fontSize: "0.92rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <RefreshCw size={16} className={sheetSyncing ? "spin" : ""} />
                      {sheetSyncing ? "Syncing 27 Columns to Google Sheets..." : "Sync to Google Sheet Now"}
                    </button>

                    <button 
                      onClick={() => setShowAppsScriptCode(!showAppsScriptCode)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8rem" }}
                    >
                      {showAppsScriptCode ? "Hide Google Apps Script Setup Code" : "📋 View Google Apps Script Setup Code"}
                    </button>
                  </div>
                </div>

                {showAppsScriptCode && (
                  <div style={{ marginTop: "20px", background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                    <h4 style={{ fontSize: "0.88rem", color: "var(--primary)", marginBottom: "8px" }}>Google Apps Script Receiver Code (Copy & Paste into Google Sheets → Extensions → Apps Script):</h4>
                    <pre style={{ background: "#0f172a", color: "#38bdf8", padding: "12px", borderRadius: "6px", fontSize: "0.75rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>
{`function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Imported Data From App";
  var sheet = ss.getSheetByName(sheetName);
  
  // If the sheet tab "Imported Data From App" does not exist, create it automatically
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var headers = ["Purchaser", "Vendor", "Order Date", "Type", "Model", "Order Quantity", "Price (RMB)", "Total (RMB)", "Advance Payment", "Balance Payment", "Photo", "Vendor EDD", "Cargo Order Date", "Cargo Detail", "Cargo Price", "Cargo Price UOM", "CBM as per Packing List", "Total Cargo Price", "Mode of Transport", "Cargo Shipping Date", "Cargo ETA", "Packing List", "Invoice", "Is Material Rec?", "Packing Slip", "Packing Ordered By Nitin", "Purchase Updated?"];
  
  sheet.clearContents();
  
  var allRows = [headers];
  if (data.rows && data.rows.length > 0) {
    for (var i = 0; i < data.rows.length; i++) {
      var r = data.rows[i];
      allRows.push([
        r.purchaser || "", r.vendor || "", r.orderDate || "", r.type || "", r.model || "",
        r.orderQuantity || "", r.priceRmb || "", r.totalRmb || "", r.advancePayment || "",
        r.balancePayment || "", r.photo || "", r.vendorEdd || "", r.cargoOrderDate || "",
        r.cargoDetail || "", r.cargoPrice || "", r.cargoPriceUom || "", r.cbmPackingList || "",
        r.totalCargoPrice || "", r.modeOfTransport || "", r.cargoShippingDate || "",
        r.cargoEta || "", r.packingListFile || "", r.invoiceFile || "", r.isMaterialRec || "",
        r.packingSlip || "", r.packingOrderedByNitin || "", r.purchaseUpdated || ""
      ]);
    }
  }

  // Write all rows at once in a single batch setValues operation
  sheet.getRange(1, 1, allRows.length, headers.length).setValues(allRows);

  return ContentService.createTextOutput(JSON.stringify({ status: "success", sheet: sheetName, count: data.rows ? data.rows.length : 0 })).setMimeType(ContentService.MimeType.JSON);
}`}
                    </pre>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* STORAGE & DESKTOP FILE MANAGER TAB */}
        {subTab === "filemanager" && (() => {
          // Requirement 2: Live Filtered Files Calculation
          const rawFiles = Array.isArray(storageFiles) ? storageFiles : [];
          const rawFolders = Array.isArray(storageFolders) ? storageFolders : [];
          const rawSelectedIds = Array.isArray(selectedFileIds) ? selectedFileIds : [];

          const filteredStorageFiles = rawFiles.filter(file => {
            if (!file) return false;
            const isCloudinary = file.storageType === "Cloudinary CDN" || (file.url && file.url.includes("cloudinary.com"));

            if (storageFilterSource === "postgres" && isCloudinary) return false;
            if (storageFilterSource === "cloudinary" && !isCloudinary) return false;

            if (storageSearchQuery && storageSearchQuery.trim() !== "") {
              const q = storageSearchQuery.toLowerCase();
              const matchName = file.name ? file.name.toLowerCase().includes(q) : false;
              const matchId = file.public_id ? file.public_id.toLowerCase().includes(q) : false;
              if (!matchName && !matchId) return false;
            }

            if (storageFileType && storageFileType !== "all") {
              const fmt = (file.format || "").toLowerCase();
              if (storageFileType === "image") {
                const isImg = ["jpg", "png", "jpeg", "webp", "gif", "svg"].includes(fmt) || (file.url && file.url.startsWith("data:image"));
                if (!isImg) return false;
              } else if (storageFileType === "pdf") {
                const isPdf = fmt === "pdf" || (file.name && file.name.toLowerCase().endsWith(".pdf")) || (file.url && file.url.toLowerCase().endsWith(".pdf"));
                if (!isPdf) return false;
              }
            }

            return true;
          });

          const isAllSelected = filteredStorageFiles.length > 0 && filteredStorageFiles.every(f => rawSelectedIds.includes(f.public_id));

          const handleSelectAllFiles = (e) => {
            if (e.target.checked) {
              setSelectedFileIds(filteredStorageFiles.map(f => f.public_id));
            } else {
              setSelectedFileIds([]);
            }
          };

          const handleToggleFileSelect = (public_id) => {
            setSelectedFileIds(prev =>
              (Array.isArray(prev) ? prev : []).includes(public_id) 
                ? prev.filter(id => id !== public_id) 
                : [...(Array.isArray(prev) ? prev : []), public_id]
            );
          };

          return (
            <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Header */}
              <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <HardDrive size={24} style={{ color: "#f59e0b" }} /> Live Storage Usage & Desktop File Manager
                  </h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                    Real-time database storage metrics for PostgreSQL and Cloudinary CDN, plus desktop folder browsing, multi-select, and asset deletion.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button 
                    onClick={handleDeleteAllCloudinaryImages}
                    className="btn btn-danger"
                    disabled={loadingStorage}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    title="Permanently delete all images from Cloudinary storage"
                  >
                    <Trash2 size={16} /> Delete All Images from Cloudinary
                  </button>
                  <button 
                    onClick={() => loadStorageData(currentFolder)} 
                    className="btn btn-secondary"
                    disabled={loadingStorage}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <RefreshCw size={16} className={loadingStorage ? "spin" : ""} /> Refresh Storage Metrics
                  </button>
                </div>
              </div>

              {/* Requirement 2: Interactive Storage Source Metric Cards (Click to Filter) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                
                {/* PostgreSQL Storage Card */}
                <div 
                  className="glass-panel" 
                  onClick={() => setStorageFilterSource(storageFilterSource === "postgres" ? "all" : "postgres")}
                  style={{ 
                    padding: "20px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "16px", 
                    cursor: "pointer",
                    border: storageFilterSource === "postgres" ? "2px solid #38bdf8" : "1px solid var(--border-glass)",
                    background: storageFilterSource === "postgres" ? "rgba(56, 189, 248, 0.12)" : "var(--bg-card)",
                    transition: "all 0.2s ease"
                  }}
                  title="Click to view PostgreSQL Database assets only"
                >
                  <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                    <Database size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>PostgreSQL Database Storage</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {storageMetrics?.postgres?.sizeStr || "Loading..."}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: "2px", fontWeight: 600 }}>
                      {storageFilterSource === "postgres" ? "✓ FILTERING: PostgreSQL Data Only" : "Click to show PostgreSQL Data only"}
                    </div>
                  </div>
                </div>

                {/* Cloudinary Storage Card */}
                <div 
                  className="glass-panel" 
                  onClick={() => setStorageFilterSource(storageFilterSource === "cloudinary" ? "all" : "cloudinary")}
                  style={{ 
                    padding: "20px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "16px", 
                    cursor: "pointer",
                    border: storageFilterSource === "cloudinary" ? "2px solid #f59e0b" : "1px solid var(--border-glass)",
                    background: storageFilterSource === "cloudinary" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-card)",
                    transition: "all 0.2s ease"
                  }}
                  title="Click to view Cloudinary CDN assets only"
                >
                  <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    <HardDrive size={28} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Cloudinary Media CDN Storage</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {storageMetrics?.cloudinary?.usageStr || "Loading..."}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "2px", fontWeight: 600 }}>
                      {storageFilterSource === "cloudinary" ? "✓ FILTERING: Cloudinary Data Only" : "Click to show Cloudinary Data only"}
                    </div>
                  </div>
                </div>

              </div>

              {/* Requirement 2: Data Filters, Search, Select All, and Multi-Select Batch Actions Toolbar */}
              <div className="glass-panel" style={{ padding: "18px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "16px" }}>
                  
                  {/* Left Filters */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>Data Filters:</span>
                    
                    {/* Storage Source Filter */}
                    <select 
                      className="form-control" 
                      style={{ width: "200px" }}
                      value={storageFilterSource}
                      onChange={e => setStorageFilterSource(e.target.value)}
                    >
                      <option value="all" style={{ background: "#0f172a" }}>All Storage Sources</option>
                      <option value="postgres" style={{ background: "#0f172a" }}>PostgreSQL Database Only</option>
                      <option value="cloudinary" style={{ background: "#0f172a" }}>Cloudinary CDN Only</option>
                    </select>

                    {/* File Format Filter */}
                    <select 
                      className="form-control" 
                      style={{ width: "160px" }}
                      value={storageFileType}
                      onChange={e => setStorageFileType(e.target.value)}
                    >
                      <option value="all" style={{ background: "#0f172a" }}>All File Types</option>
                      <option value="image" style={{ background: "#0f172a" }}>Images Only</option>
                      <option value="pdf" style={{ background: "#0f172a" }}>PDF Documents</option>
                    </select>

                    {/* Search Input */}
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="Search asset name or ID..."
                      style={{ width: "220px" }}
                      value={storageSearchQuery}
                      onChange={e => setStorageSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Right Select & Select All Option */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <label className="checkbox-label" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      <input 
                        type="checkbox"
                        className="checkbox-input"
                        checked={isAllSelected}
                        onChange={handleSelectAllFiles}
                      />
                      Select All ({filteredStorageFiles.length})
                    </label>

                    {selectedFileIds.length > 0 && (
                      <button 
                        onClick={handleBatchDeleteStorageFiles}
                        className="btn btn-danger btn-sm"
                        style={{ padding: "6px 14px" }}
                      >
                        <Trash2 size={14} /> Delete Selected ({selectedFileIds.length})
                      </button>
                    )}
                  </div>

                </div>

                {/* Filter summary status strip */}
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>Showing <strong>{filteredStorageFiles.length}</strong> of {storageFiles.length} total files</span>
                  {storageFilterSource !== "all" && (
                    <span className="badge badge-primary" style={{ fontSize: "0.7rem" }}>
                      Source: {storageFilterSource === "postgres" ? "PostgreSQL Database" : "Cloudinary CDN"}
                    </span>
                  )}
                  {selectedFileIds.length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: "0.7rem" }}>
                      {selectedFileIds.length} files selected
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop File Manager Explorer */}
              <div className="glass-panel" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                  
                  {/* Breadcrumbs */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", fontWeight: 600 }}>
                    <button 
                      onClick={() => loadStorageData("")}
                      className="btn btn-sm btn-secondary"
                      style={{ padding: "4px 10px" }}
                    >
                      Root /
                    </button>
                    {currentFolder && (
                      <span style={{ color: "var(--primary)" }}>{currentFolder}</span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {storageFolders.length} folders, {filteredStorageFiles.length} matching files
                  </div>
                </div>

                {storageStatusMsg && (
                  <div className={`alert-strip ${storageStatusMsg.includes("❌") ? "alert-danger" : "alert-success"}`} style={{ marginBottom: "16px" }}>
                    {storageStatusMsg}
                  </div>
                )}

                {/* Folders List */}
                {storageFolders.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folders</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                      {storageFolders.map(folder => (
                        <div 
                          key={folder.path}
                          onClick={() => loadStorageData(folder.path)}
                          className="glass-panel"
                          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", border: "1px solid var(--border-glass)", transition: "all 0.2s ease" }}
                        >
                          <Folder size={20} style={{ color: "#f59e0b" }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Grid with Select Option on every file card */}
                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Files & Assets</h4>
                
                {filteredStorageFiles.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    No files match the selected filter criteria.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                    {filteredStorageFiles.map(file => {
                      const isChecked = selectedFileIds.includes(file.public_id);

                      return (
                        <div 
                          key={file.public_id}
                          className="glass-panel"
                          style={{ 
                            padding: "14px", 
                            display: "flex", 
                            flexDirection: "column", 
                            justify: "space-between", 
                            gap: "10px", 
                            border: isChecked ? "2px solid var(--primary)" : "1px solid var(--border-glass)",
                            background: isChecked ? "rgba(56, 189, 248, 0.08)" : "var(--bg-card)",
                            position: "relative"
                          }}
                        >
                          {/* Selection Checkbox */}
                          <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 5 }}>
                            <input 
                              type="checkbox"
                              className="checkbox-input"
                              checked={isChecked}
                              onChange={() => handleToggleFileSelect(file.public_id)}
                              title="Select asset"
                            />
                          </div>

                          <div>
                            {/* Thumbnail */}
                            <div style={{ width: "100%", height: "110px", borderRadius: "6px", background: "rgba(0,0,0,0.3)", overflow: "hidden", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {file.url ? (
                                <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <FileText size={32} style={{ opacity: 0.4 }} />
                              )}
                            </div>

                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "20px" }} title={file.name}>
                              {file.name}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Size: {file.sizeStr}</span>
                              <span className="badge badge-secondary" style={{ fontSize: "0.62rem" }}>{file.storageType || "Database"}</span>
                            </div>
                          </div>

                          {/* File Card Actions */}
                          <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border-glass)", paddingTop: "8px" }}>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-sm btn-secondary"
                              style={{ flex: 1, padding: "4px", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                            >
                              <ExternalLink size={12} /> View
                            </a>
                            <button 
                              onClick={() => handleDeleteStorageFile(file.public_id)}
                              className="btn btn-sm btn-secondary"
                              style={{ color: "var(--danger)", padding: "4px 8px" }}
                              title="Delete File Asset"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

            </div>
          );
        })()}

        {/* ITEM CATALOG & MASTER STOCK TAB */}
        {subTab === "itemmaster" && (
          <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <ItemCatalogPanel 
              items={items}
              onAddItem={onAddItem}
              onBulkAddItems={onBulkAddItems}
              onDeleteItems={onDeleteItems}
              onUpdateItem={onUpdateItem}
              onMergeItems={onMergeItems}
              currentUser={{ role: "superadmin", name: "Super Admin" }}
              requests={requests}
              cargos={cargos}
              vendors={vendors}
              users={users}
              cargoCompanies={cargoCompanies}
              onViewItemDetail={(item) => {
                if (onNavigateView) onNavigateView("itemcatalog");
              }}
            />
          </div>
        )}

        {/* ==================== MISSING ITEM IDS RESOLUTION TAB (IMS) ==================== */}
        {subTab === "missingids" && (
          <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Header */}
            <div className="glass-panel" style={{ padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                  <ShieldAlert size={26} /> Missing Item IDs Resolution Studio (IMS)
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px", margin: 0 }}>
                  Review unlinked item names uploaded in the IMS Stock Ledger. Create them as Master Catalog items in 1 click or map them to existing SKUs to automatically resolve all historical entries.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => onNavigateView && onNavigateView("ims")}
                  className="btn btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <Layers size={15} /> Open Full IMS Ledger
                </button>
              </div>
            </div>

            {adminMissingImsItems.length === 0 ? (
              <div className="glass-panel" style={{ padding: "60px 20px", textAlign: "center" }}>
                <CheckCircle2 size={48} style={{ color: "var(--success)", marginBottom: "14px" }} />
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--success)" }}>
                  All Item IDs are 100% Linked & Resolved!
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "500px", margin: "8px auto 0" }}>
                  Every transaction in the IMS stock ledger is linked to a valid Master Item ID in your catalog.
                </p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: "24px", overflowX: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                    Unlinked Item Models Found in IMS ({adminMissingImsItems.length})
                  </h3>
                </div>

                <table className="table" style={{ width: "100%", minWidth: "850px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "35%" }}>Unlinked Item Name in IMS</th>
                      <th style={{ width: "15%", textAlign: "center" }}>Affected Transactions</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Total Stock Qty</th>
                      <th style={{ width: "15%" }}>Sample Date / Party</th>
                      <th style={{ width: "20%", textAlign: "center" }}>Resolution Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminMissingImsItems.map(item => (
                      <tr key={item.name}>
                        <td style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.92rem" }}>
                          {item.name}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-warning" style={{ fontWeight: 800 }}>
                            {item.count} Transactions
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: item.totalQty >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {item.totalQty > 0 ? `+${item.totalQty}` : item.totalQty} Pcs
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {item.sampleDate || "2026"} • {item.sampleParty || "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setResolvingAdminItemName(item.name)}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            <Plus size={13} /> Create Master Item / Link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal for Admin Missing ID Resolution */}
            {resolvingAdminItemName && (
              <div className="modal-backdrop" onClick={() => setResolvingAdminItemName(null)}>
                <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", padding: "28px" }}>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                    <div>
                      <span className="badge badge-warning" style={{ marginBottom: "4px" }}>Admin SKU Resolution</span>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                        Create Master Item for "{resolvingAdminItemName}"
                      </h3>
                    </div>
                    <button onClick={() => setResolvingAdminItemName(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
                  </div>

                  {/* Option 1: 1-Click Create in Master Catalog */}
                  <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "10px", padding: "18px", marginBottom: "18px" }}>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#818cf8", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Plus size={16} /> Option 1: Create as New Master SKU
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                      Creates the item in the Master Item Catalog with a new unique Item ID and automatically backfills all historical IMS rows!
                    </p>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!resolvingAdminItemName) return;

                      const nextIdNum = items.reduce((max, it) => {
                        const n = parseInt(String(it.id).replace(/\D/g, ""), 10);
                        return !isNaN(n) && n > max ? n : max;
                      }, 100) + 1;
                      const newItemId = `it-${nextIdNum}`;

                      await onAddItem({
                        id: newItemId,
                        name: resolvingAdminItemName.trim(),
                        category: adminItemCategory,
                        itemType: adminItemType,
                        unit: adminItemUnit,
                        description: adminItemDesc || `Created from IMS missing ID resolution`,
                        currentStock: 0
                      });

                      if (onResolveMissingId) {
                        await onResolveMissingId(resolvingAdminItemName.trim(), newItemId, resolvingAdminItemName.trim());
                      }

                      setResolvingAdminItemName(null);
                      setAdminItemDesc("");
                    }} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: "0.78rem" }}>Category</label>
                          <select value={adminItemCategory} onChange={e => setAdminItemCategory(e.target.value)} className="form-control" style={{ fontSize: "0.82rem" }}>
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
                          <select value={adminItemType} onChange={e => setAdminItemType(e.target.value)} className="form-control" style={{ fontSize: "0.82rem" }}>
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

                  {/* Option 2: Map to Existing Master Item */}
                  <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "18px" }}>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Check size={16} /> Option 2: Map to an Existing Master Item
                    </h4>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!resolvingAdminItemName || !adminMapTargetId) return;

                      const targetItem = items.find(i => i.id === adminMapTargetId);
                      if (!targetItem) return;

                      if (onResolveMissingId) {
                        await onResolveMissingId(resolvingAdminItemName.trim(), targetItem.id, targetItem.name);
                      }
                      setResolvingAdminItemName(null);
                      setAdminMapTargetId("");
                    }} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <select value={adminMapTargetId} onChange={e => setAdminMapTargetId(e.target.value)} className="form-control" style={{ fontSize: "0.85rem" }} required>
                          <option value="">-- Choose Existing Master Item --</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>
                              #{it.id} - {it.name} ({it.category || "General"})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button type="submit" disabled={!adminMapTargetId} className="btn btn-secondary btn-sm" style={{ fontWeight: 700, padding: "8px" }}>
                        Map & Update IMS Transactions
                      </button>
                    </form>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== PARTIES DIRECTORY & BULK UPLOAD TAB ==================== */}
        {subTab === "crmparties" && (
          loadingModules.crmParties && crmParties.length === 0 ? (
            renderModuleLoader("Parties Directory & Bulk Upload Studio")
          ) : (
            <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Header & Sub-Navigation */}
            <div className="glass-panel" style={{ padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                  <Building size={26} /> Parties Directory & Bulk Upload Studio
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px", margin: 0 }}>
                  Bulk import party accounts from Excel/CSV (CRM Email ID, Party Name) with auto CRM matching, or manage individual customer accounts.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <button 
                  onClick={handleDownloadPartySampleCsv}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", fontWeight: 700 }}
                  title="Download sample CSV template for bulk party upload"
                >
                  <Download size={14} /> Download Sample CSV
                </button>

                <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px", border: "1px solid var(--border-glass)" }}>
                  <button
                    onClick={() => setPartyStudioMode("directory")}
                    className={`btn btn-sm ${partyStudioMode === "directory" ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "0.82rem", fontWeight: 700, padding: "5px 12px" }}
                  >
                    Directory ({crmParties.length})
                  </button>
                  <button
                    onClick={() => setPartyStudioMode("bulk")}
                    className={`btn btn-sm ${partyStudioMode === "bulk" ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "0.82rem", fontWeight: 700, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Upload size={13} /> Bulk Upload
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingParty(null);
                    setShowPartyModal(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                >
                  <Plus size={15} /> + Add Party
                </button>
              </div>
            </div>

            {/* ==================== VIEW 1: BULK EXCEL / CSV UPLOADER ==================== */}
            {partyStudioMode === "bulk" && (
              <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="glass-panel" style={{ padding: "26px" }}>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                        <Upload size={20} /> Bulk Upload Parties from Excel / CSV
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", marginTop: "4px", margin: 0 }}>
                        Paste rows directly from Excel or upload a file. Auto-detects Station/City, Party Name, Contact, and CRM Email.
                      </p>
                    </div>

                    {/* Column Layout Selection Chips */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Paste Column Layout:</span>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-glass)" }}>
                        {[
                          { id: "auto", label: "✨ Auto-Detect" },
                          { id: "city_first", label: "📍 City | Party Name" },
                          { id: "name_first", label: "🏢 Party Name | City" },
                          { id: "crm_first", label: "👤 CRM | Party | City" }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              setPartyParseMode(mode.id);
                              if (bulkPartyRawText) handleParseBulkParties(bulkPartyRawText, mode.id);
                            }}
                            className={`btn btn-sm ${partyParseMode === mode.id ? "btn-primary" : "btn-ghost"}`}
                            style={{ fontSize: "0.76rem", padding: "4px 10px", fontWeight: partyParseMode === mode.id ? 700 : 500 }}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {bulkPartyUploadMsg && (
                    <div className={`alert-strip ${bulkPartyUploadMsg.includes("✅") ? "alert-success" : "alert-danger"}`} style={{ marginBottom: "16px" }}>
                      {bulkPartyUploadMsg}
                    </div>
                  )}

                  {/* Paste Textarea */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Paste Excel Cells or CSV Rows</label>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {bulkParsedParties.length > 0 ? `📊 Parsed ${bulkParsedParties.length} party records` : "Supports tab-separated & comma-separated text"}
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={bulkPartyRawText}
                      onChange={e => handleParseBulkParties(e.target.value)}
                      placeholder={"SAMASTIPUR\tShree Ganesh Electronics\tMr. Ramesh Gupta\t9820192831\tBihar\nludhiana\tMarwar Mobile Accessories\tMr. Suresh Jain\t9840192832\tPunjab\nSAHARSA\tBalaji Telecom\tMr. Prakash Singh\t9890192833\tBihar\nDIBRUGARH\tPower Solutions\tMr. Amit Sharma\t9870192834\tAssam\nBEAWAR\tMetro Mobile Point\tMr. Naresh Patel\t9810192835\tRajasthan"}
                      className="form-control"
                      style={{ fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.4 }}
                    />
                  </div>

                  {/* File Upload & Actions Toolbar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <FileText size={14} /> Choose CSV / Excel File
                        <input 
                          type="file" 
                          accept=".csv,.txt,.tsv" 
                          style={{ display: "none" }} 
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => handleParseBulkParties(evt.target?.result || "");
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleDownloadPartySampleCsv}
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}
                      >
                        <Download size={13} /> Sample CSV
                      </button>

                      {bulkParsedParties.length > 0 && (
                        <button
                          type="button"
                          onClick={handleFlipAllParsedNamesAndCities}
                          className="btn btn-secondary btn-sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.4)" }}
                          title="Click if Party Name and City columns are swapped"
                        >
                          <RefreshCw size={13} /> ⇄ Flip Party Name & City
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      {bulkParsedParties.length > 0 && (
                        <span style={{ fontSize: "0.85rem", color: "var(--success)", fontWeight: 700 }}>
                          ✓ {bulkParsedParties.length} parties ready to commit
                        </span>
                      )}

                      <button
                        onClick={handleCommitBulkParties}
                        disabled={bulkParsedParties.length === 0 || isUploadingParties}
                        className="btn btn-primary"
                        style={{ padding: "9px 24px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", boxShadow: "0 4px 15px rgba(56, 189, 248, 0.3)" }}
                      >
                        {isUploadingParties ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={17} />}
                        {isUploadingParties ? "Saving to Database..." : `Commit & Save ${bulkParsedParties.length} Parties to Database`}
                      </button>
                    </div>
                  </div>

                </div>

                {/* Parsed Preview Table */}
                {bulkParsedParties.length > 0 && (
                  <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <h4 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                          <CheckCircle2 size={18} style={{ color: "var(--success)" }} /> Live Parse & CRM Assignment Preview ({bulkParsedParties.length})
                        </h4>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          Review the extracted party names, cities, and CRM executive assignments below.
                        </span>
                      </div>

                      {/* Bulk Assign Dropdown */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Assign All to:</span>
                        <select
                          value={bulkDefaultCrmId}
                          onChange={e => handleBulkAssignAllCrm(e.target.value)}
                          className="form-control"
                          style={{ width: "auto", height: "34px", fontSize: "0.82rem" }}
                        >
                          <option value="">-- Choose CRM Executive --</option>
                          {crmExecutives.map(u => (
                            <option key={u.id} value={u.id}>{u.name} (CRM)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <table className="table" style={{ width: "100%", minWidth: "900px" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "5%", textAlign: "center" }}>#</th>
                          <th style={{ width: "32%" }}>Party Name / Firm</th>
                          <th style={{ width: "16%" }}>City / Station</th>
                          <th style={{ width: "22%" }}>Assigned CRM Executive</th>
                          <th style={{ width: "15%" }}>Contact & Phone</th>
                          <th style={{ width: "10%" }}>State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkParsedParties.map((p, idx) => (
                          <tr key={p.id || idx}>
                            <td style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {idx + 1}
                            </td>
                            <td style={{ wordBreak: "break-word", whiteSpace: "normal" }}>
                              <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.95rem", lineHeight: 1.3 }}>
                                {p.name}
                              </div>
                              {p.gstin && (
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                  GST: {p.gstin}
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.88rem" }}>
                                {p.city || "—"}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-primary" style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 8px", fontSize: "0.82rem" }}>
                                <User size={13} /> {p.assignedCrmName || "Unassigned"}
                              </span>
                              {p.crmEmailProvided && (
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "3px", fontFamily: "monospace" }}>
                                  {p.crmEmailProvided}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: "0.85rem" }}>
                              <span style={{ fontWeight: 600 }}>{p.contactPerson || "—"}</span><br />
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.phone || ""}</span>
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                              {p.state || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Bottom Action Toolbar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border-glass)", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ fontSize: "0.86rem", color: "var(--text-muted)" }}>
                        Ready to import <strong style={{ color: "var(--primary)" }}>{bulkParsedParties.length}</strong> party records.
                      </div>

                      <button
                        type="button"
                        onClick={handleCommitBulkParties}
                        disabled={bulkParsedParties.length === 0 || isUploadingParties}
                        className="btn btn-primary"
                        style={{ padding: "10px 28px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", boxShadow: "0 4px 20px rgba(56, 189, 248, 0.35)" }}
                      >
                        {isUploadingParties ? <RefreshCw size={17} className="spin" /> : <CheckCircle2 size={18} />}
                        {isUploadingParties ? "Saving to Database..." : `Commit & Save ${bulkParsedParties.length} Parties to Database`}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ==================== VIEW 2: PARTY DIRECTORY TABLE ==================== */}
            {partyStudioMode === "directory" && (
              <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Search & Filter Bar */}
                <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "280px", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
                      <Search size={15} style={{ position: "absolute", left: "10px", top: "11px", color: "var(--text-muted)" }} />
                      <input 
                        type="text" 
                        placeholder="Search party name, contact person, phone, city, GSTIN..." 
                        value={crmPartySearch}
                        onChange={e => setCrmPartySearch(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: "32px", fontSize: "0.85rem", height: "36px" }}
                      />
                    </div>

                    <select
                      value={crmPartyFilter}
                      onChange={e => setCrmPartyFilter(e.target.value)}
                      className="form-control"
                      style={{ width: "auto", height: "36px", fontSize: "0.85rem" }}
                    >
                      <option value="all">All CRM Executives ({crmParties.length})</option>
                      <option value="unassigned">Unassigned Parties ({crmParties.filter(p => !p.assignedCrmId).length})</option>
                      {crmExecutives.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({crmParties.filter(p => p.assignedCrmId === u.id || p.assignedCrmName === u.name).length} parties)
                        </option>
                      ))}
                    </select>

                    {(crmPartySearch || crmPartyFilter !== "all") && (
                      <button 
                        onClick={() => { setCrmPartySearch(""); setCrmPartyFilter("all"); }}
                        className="btn btn-secondary btn-sm"
                        style={{ height: "36px" }}
                      >
                        Reset
                      </button>
                    )}

                    {/* Multi-Delete Button */}
                    {selectedPartyIds.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`⚠️ Are you sure you want to delete ${selectedPartyIds.length} selected party accounts?`)) return;
                          if (onBulkDeleteParties) {
                            await onBulkDeleteParties(selectedPartyIds);
                            showSuccessToast(`✅ Deleted ${selectedPartyIds.length} parties successfully!`);
                          }
                          setSelectedPartyIds([]);
                        }}
                        className="btn btn-danger btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "36px", fontWeight: 700, padding: "0 14px", animation: "pulse 2s infinite" }}
                      >
                        <Trash2 size={14} /> Delete Selected ({selectedPartyIds.length})
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {selectedPartyIds.length > 0 && (
                      <button
                        onClick={() => setSelectedPartyIds([])}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                      >
                        Clear Selection
                      </button>
                    )}
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      Showing <strong>{filteredCrmParties.length}</strong> of <strong>{crmParties.length}</strong> registered parties
                    </div>
                  </div>
                </div>

                {/* Directory Table */}
                <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
                  {filteredCrmParties.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                      <Building size={36} style={{ marginBottom: "12px", opacity: 0.4 }} />
                      <h4>No parties found</h4>
                      <p style={{ fontSize: "0.85rem" }}>Click "Bulk Upload" to import parties from Excel or "+ Add Party" to create one.</p>
                    </div>
                  ) : (
                    <table className="table" style={{ width: "100%", minWidth: "950px" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "40px", textAlign: "center" }}>
                            <input 
                              type="checkbox"
                              className="checkbox-input"
                              checked={filteredCrmParties.length > 0 && filteredCrmParties.every(p => selectedPartyIds.includes(p.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPartyIds(Array.from(new Set([...selectedPartyIds, ...filteredCrmParties.map(p => p.id)])));
                                } else {
                                  setSelectedPartyIds(prev => prev.filter(id => !filteredCrmParties.some(p => p.id === id)));
                                }
                              }}
                              title="Select all on this view"
                            />
                          </th>
                          <th style={{ width: "26%" }}>Party / Firm Name</th>
                          <th style={{ width: "22%" }}>Assigned CRM Executive (Reassign)</th>
                          <th style={{ width: "18%" }}>Contact Person & Phone</th>
                          <th style={{ width: "14%" }}>City / State</th>
                          <th style={{ width: "10%" }}>GSTIN</th>
                          <th style={{ width: "8%", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCrmParties.map(party => {
                          const isChecked = selectedPartyIds.includes(party.id);
                          return (
                            <tr key={party.id} style={{ background: isChecked ? "rgba(56, 189, 248, 0.08)" : undefined }}>
                              <td style={{ textAlign: "center" }}>
                                <input 
                                  type="checkbox"
                                  className="checkbox-input"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedPartyIds(prev => prev.includes(party.id) ? prev.filter(x => x !== party.id) : [...prev, party.id]);
                                  }}
                                  title="Select party"
                                />
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.92rem" }}>
                                  {party.name}
                                </div>
                                {party.status && (
                                  <span className={`badge ${party.status === "Active" ? "badge-success" : "badge-secondary"}`} style={{ fontSize: "0.66rem", marginTop: "2px" }}>
                                    {party.status}
                                  </span>
                                )}
                              </td>
                              <td>
                                {/* Direct CRM Reassignment Dropdown */}
                                <select
                                  value={party.assignedCrmId || ""}
                                  onChange={async (e) => {
                                    const targetId = e.target.value;
                                    const targetUser = users.find(u => u.id === targetId);
                                    const updated = {
                                      ...party,
                                      assignedCrmId: targetId,
                                      assignedCrmName: targetUser ? targetUser.name : "Unassigned"
                                    };
                                    if (onUpdateParty) {
                                      await onUpdateParty(updated);
                                    }
                                  }}
                                  className="form-control"
                                  style={{ fontSize: "0.82rem", height: "32px", padding: "4px 8px", background: party.assignedCrmId ? "rgba(99, 102, 241, 0.08)" : "rgba(245, 158, 11, 0.1)" }}
                                >
                                  <option value="">-- Unassigned --</option>
                                  {crmExecutives.map(u => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.email})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ fontSize: "0.85rem" }}>
                                <strong>{party.contactPerson || "—"}</strong><br />
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{party.phone || ""}</span>
                              </td>
                              <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                {party.city || "—"} {party.state ? `(${party.state})` : ""}
                              </td>
                              <td style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                                {party.gstin || "—"}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: "6px" }}>
                                  <button
                                    onClick={() => {
                                      setEditingParty(party);
                                      setShowPartyModal(true);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    title="Edit Party Details"
                                    style={{ padding: "4px 7px" }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`Are you sure you want to delete party "${party.name}"?`)) {
                                        if (onDeleteParty) await onDeleteParty(party.id);
                                        setSelectedPartyIds(prev => prev.filter(x => x !== party.id));
                                      }
                                    }}
                                    className="btn btn-danger btn-sm"
                                    title="Delete Party"
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
                </div>

              </div>
            )}

            {/* ==================== SINGLE PARTY CREATE / EDIT MODAL ==================== */}
            {showPartyModal && (
              <div className="modal-backdrop" onClick={() => setShowPartyModal(false)}>
                <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px", padding: "28px" }}>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
                      {editingParty ? `Edit Party "${editingParty.name}"` : "Register New CRM Party"}
                    </h3>
                    <button onClick={() => setShowPartyModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const partyName = editingParty ? editingParty.name : (formData.get("name")?.trim());
                    if (!partyName) return;

                    const crmId = formData.get("assignedCrmId");
                    const matchedCrm = users.find(u => u.id === crmId);

                    const partyObj = {
                      id: editingParty ? editingParty.id : `pty-${Date.now()}`,
                      name: partyName,
                      assignedCrmId: crmId || "",
                      assignedCrmName: matchedCrm ? matchedCrm.name : "Unassigned",
                      contactPerson: formData.get("contactPerson")?.trim() || "",
                      phone: formData.get("phone")?.trim() || "",
                      email: formData.get("email")?.trim() || "",
                      city: formData.get("city")?.trim() || "",
                      state: formData.get("state")?.trim() || "",
                      gstin: formData.get("gstin")?.trim() || "",
                      status: formData.get("status") || "Active"
                    };

                    if (editingParty && onUpdateParty) {
                      await onUpdateParty(partyObj);
                    } else if (onAddParty) {
                      await onAddParty(partyObj);
                    }

                    setShowPartyModal(false);
                    setEditingParty(null);
                  }} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Party / Firm Name *</label>
                        {!!editingParty && (
                          <span style={{ fontSize: "0.76rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                            <Lock size={12} /> Locked (Party Name cannot be changed)
                          </span>
                        )}
                      </div>
                      <input 
                        name="name" 
                        type="text" 
                        defaultValue={editingParty?.name || ""} 
                        required 
                        placeholder="e.g. Shree Ganesh Electronics, Balaji Telecom..." 
                        readOnly={Boolean(editingParty)}
                        disabled={Boolean(editingParty)}
                        className="form-control"
                        style={{
                          background: Boolean(editingParty) ? "rgba(255, 255, 255, 0.04)" : "",
                          cursor: Boolean(editingParty) ? "not-allowed" : "text",
                          color: Boolean(editingParty) ? "var(--text-muted)" : "var(--text-main)",
                          border: Boolean(editingParty) ? "1px solid rgba(245, 158, 11, 0.3)" : ""
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700 }}>Assigned CRM Executive</label>
                      <select name="assignedCrmId" defaultValue={editingParty?.assignedCrmId || ""} className="form-control">
                        <option value="">-- Unassigned (Admin) --</option>
                        {crmExecutives.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Contact Person</label>
                        <input name="contactPerson" type="text" defaultValue={editingParty?.contactPerson || ""} placeholder="Contact name" className="form-control" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Phone Number</label>
                        <input name="phone" type="text" defaultValue={editingParty?.phone || ""} placeholder="Phone / Mobile" className="form-control" />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">City</label>
                        <input name="city" type="text" defaultValue={editingParty?.city || ""} placeholder="City (e.g. Mumbai, Delhi)" className="form-control" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">State</label>
                        <input name="state" type="text" defaultValue={editingParty?.state || ""} placeholder="State (e.g. Maharashtra)" className="form-control" />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">GSTIN / Tax ID</label>
                      <input name="gstin" type="text" defaultValue={editingParty?.gstin || ""} placeholder="GST number" className="form-control" />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                      <button type="button" onClick={() => setShowPartyModal(false)} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                        {editingParty ? "Save Changes" : "Register Party"}
                      </button>
                    </div>

                  </form>

                </div>
              </div>
            )}

            </div>
          )
        )}

      </section>

      {/* Render Deactivation modal if open */}
      {selectedDeactivateUser && (
        <TransferModal 
          purchaser={selectedDeactivateUser}
          activeUsers={users.filter(u => u.status === "active")}
          requests={requests}
          vendors={vendors}
          onClose={() => setSelectedDeactivateUser(null)}
          onConfirm={handleTransferConfirmed}
        />
      )}

      {/* ==================== VENDOR DETAIL MODAL ==================== */}
      {selectedVendorForDetail && (
        <VendorDetailModal 
          vendor={selectedVendorForDetail}
          requests={requests}
          cargos={cargos}
          purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
          currentUser={{ role: "superadmin" }}
          onUpdateVendor={onUpdateVendor}
          onRemoveVendor={onRemoveVendor}
          onClose={() => setSelectedVendorForDetail(null)}
        />
      )}

      {/* ==================== CARGO COMPANY DETAIL MODAL ==================== */}
      {selectedCargoCompanyForDetail && (
        <CargoCompanyDetailModal 
          company={selectedCargoCompanyForDetail}
          cargos={cargos}
          requests={requests}
          currentUser={{ role: "superadmin" }}
          onUpdateCargoCompany={onUpdateCargoCompany}
          onRemoveCargoCompany={onRemoveCargoCompany}
          onClose={() => setSelectedCargoCompanyForDetail(null)}
        />
      )}

    </div>
  );
}
