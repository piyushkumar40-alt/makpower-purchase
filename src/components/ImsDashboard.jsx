import React, { useState, useMemo } from "react";
import { 
  Package, TrendingUp, TrendingDown, Layers, Search, Filter, Download, 
  Plus, UploadCloud, AlertTriangle, CheckCircle2, RefreshCw, X, Edit2, 
  Trash2, FileText, ArrowUpDown, Calendar, Building2, Tag, ShieldAlert,
  ChevronRight, Database, Check, Eye
} from "lucide-react";

export default function ImsDashboard({
  currentUser,
  items = [],
  imsTransactions = [],
  crmParties = [],
  vendors = [],
  onAddTransaction,
  onBatchUploadTransactions,
  onDeleteTransaction,
  onDeleteRange,
  onResolveMissingId,
  onAddItem,
  onNavigateView
}) {
  // Active Tab: "ledger" | "matrix" | "bulk" | "missingids"
  const [activeTab, setActiveTab] = useState("ledger");

  // Filter States for Ledger
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [movementFilter, setMovementFilter] = useState("all"); // "all" | "IN" | "OUT"
  const [missingIdFilter, setMissingIdFilter] = useState("all"); // "all" | "missing" | "linked"
  const [locationFilter, setLocationFilter] = useState("all"); // "all" | "Delhi" | "Mumbai"
  const [selectedItemFilter, setSelectedItemFilter] = useState("all");

  // Multi-row Checkbox Selection
  const [selectedTxIds, setSelectedTxIds] = useState([]);

  // Date Range Purge / Bulk Delete Modal State
  const [showDeleteRangeModal, setShowDeleteRangeModal] = useState(false);
  const [delRangeStart, setDelRangeStart] = useState("");
  const [delRangeEnd, setDelRangeEnd] = useState("");
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
    let net = 0;
    let inUnits = 0;
    let outUnits = 0;
    let delhiNet = 0;
    let mumbaiNet = 0;
    let missingCount = 0;
    const missingSet = new Map(); // itemName -> { count, totalQty }

    imsTransactions.forEach(tx => {
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
  }, [imsTransactions]);

  // ==================== FILTERED TRANSACTIONS ====================
  const filteredTransactions = useMemo(() => {
    return imsTransactions.filter(tx => {
      // Search query (Item name, party name, remarks, itemId, location)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          (tx.itemName || "").toLowerCase().includes(q) ||
          (tx.partyName || "").toLowerCase().includes(q) ||
          (tx.remarks || "").toLowerCase().includes(q) ||
          (tx.location || "").toLowerCase().includes(q) ||
          (tx.itemId || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // Warehouse Location Filter
      if (locationFilter !== "all") {
        const txLoc = (tx.location || "Delhi").trim().toLowerCase();
        if (txLoc !== locationFilter.toLowerCase()) return false;
      }

      // Date range
      if (startDate && (tx.date || "") < startDate) return false;
      if (endDate && (tx.date || "") > endDate) return false;

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
      if (sortField === "stockQty") {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [imsTransactions, searchQuery, locationFilter, startDate, endDate, movementFilter, missingIdFilter, selectedItemFilter, sortField, sortAsc]);

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

    // Aggregate transactions
    imsTransactions.forEach(tx => {
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

    return Array.from(map.values());
  }, [items, imsTransactions]);

  // ==================== BULK UPLOAD PARSER ====================
  const handleParseBulkText = (text) => {
    setBulkRawText(text);
    if (!text.trim()) {
      setBulkParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const parsed = [];

    // Create item maps for fast matching
    const itemsMapById = new Map(items.map(i => [String(i.id).trim().toLowerCase(), i]));
    const itemsMapByName = new Map(items.map(i => [String(i.name).trim().toLowerCase(), i]));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle TSV (Excel copy-paste) or CSV
      let cols = [];
      if (line.includes("\t")) {
        cols = line.split("\t").map(c => c.trim().replace(/^["']|["']$/g, ""));
      } else {
        // Simple CSV splitter
        cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
      }

      // Skip header row if detected
      if (i === 0 && (cols[0].toLowerCase().includes("date") || cols[1]?.toLowerCase().includes("item"))) {
        continue;
      }

      // Expected columns: [0: Date, 1: Item Name, 2: Stock, 3: Remarks, 4: Party Name, 5: Item ID, 6: Location]
      const rawDate = cols[0] || new Date().toISOString().split("T")[0];
      const rawItemName = cols[1] || "";
      const rawStock = parseInt(cols[2]) || 0;
      const rawRemarks = cols[3] || "";
      const rawParty = cols[4] || "";
      let rawItemId = cols[5] || "";
      let rawLocation = cols[6] || "";

      // Smart location detection if passed in other column positions
      if (!rawLocation) {
        if (cols[5] && (cols[5].toLowerCase() === "delhi" || cols[5].toLowerCase() === "mumbai")) {
          rawLocation = cols[5];
          rawItemId = "";
        } else if (cols[3] && (cols[3].toLowerCase() === "delhi" || cols[3].toLowerCase() === "mumbai")) {
          rawLocation = cols[3];
        } else {
          rawLocation = "Delhi";
        }
      }

      // Format location nicely (e.g. "delhi" -> "Delhi", "mumbai" -> "Mumbai")
      rawLocation = rawLocation.toLowerCase().includes("mumbai") ? "Mumbai" : "Delhi";

      if (!rawItemName && !rawItemId) continue;

      // Auto-match Item ID if missing
      let isMatched = false;
      if (rawItemId && itemsMapById.has(rawItemId.toLowerCase())) {
        isMatched = true;
      } else if (rawItemName && itemsMapByName.has(rawItemName.toLowerCase())) {
        rawItemId = itemsMapByName.get(rawItemName.toLowerCase()).id;
        isMatched = true;
      }

      parsed.push({
        id: `ims-upload-${Date.now()}-${i}`,
        date: formatDateForInput(rawDate),
        itemName: rawItemName || (itemsMapById.get(rawItemId.toLowerCase())?.name || "Unknown Item"),
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

  const handleExecuteBulkUpload = async () => {
    if (bulkParsedRows.length === 0) return;
    setIsUploading(true);
    setBulkUploadMsg("");

    try {
      const res = await onBatchUploadTransactions(bulkParsedRows);
      if (res && (res.success || res.count)) {
        setBulkUploadMsg(`✅ Successfully uploaded ${res.count || bulkParsedRows.length} transactions into IMS! (${res.missingIdCount || 0} missing item IDs flagged for review)`);
        setBulkParsedRows([]);
        setBulkRawText("");
        setTimeout(() => setActiveTab("ledger"), 2000);
      } else {
        setBulkUploadMsg(`❌ Upload failed: ${res?.error || "Unknown server error"}`);
      }
    } catch (err) {
      setBulkUploadMsg(`❌ Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper date formatter
  function formatDateForInput(dStr) {
    if (!dStr) return new Date().toISOString().split("T")[0];
    const clean = dStr.trim();
    // Check if DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
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
    return imsTransactions.filter(tx => tx.date >= delRangeStart && tx.date <= delRangeEnd);
  }, [imsTransactions, delRangeStart, delRangeEnd]);

  const rangeMatchedNetQty = useMemo(() => {
    return rangeMatchedTransactions.reduce((sum, tx) => sum + (parseInt(tx.stockQty) || 0), 0);
  }, [rangeMatchedTransactions]);

  // Execute Range Deletion
  const handleExecuteDeleteRange = async () => {
    if (!delRangeStart || !delRangeEnd) return;
    if (rangeMatchedTransactions.length === 0) {
      alert("No transactions found between the selected dates.");
      return;
    }
    const confirmMsg = `⚠️ Are you sure you want to PERMANENTLY DELETE ALL ${rangeMatchedTransactions.length} inventory transactions between ${delRangeStart} and ${delRangeEnd}?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingRange(true);
    try {
      if (onDeleteRange) {
        await onDeleteRange(delRangeStart, delRangeEnd);
      }
      setSelectedTxIds(prev => prev.filter(id => !rangeMatchedTransactions.some(t => t.id === id)));
      setShowDeleteRangeModal(false);
      setDelRangeStart("");
      setDelRangeEnd("");
    } catch (err) {
      alert("Failed to delete range: " + err.message);
    } finally {
      setIsDeletingRange(false);
    }
  };

  // Execute Selected Rows Deletion
  const handleExecuteDeleteSelected = async () => {
    if (selectedTxIds.length === 0) return;
    const confirmMsg = `⚠️ Are you sure you want to permanently delete the ${selectedTxIds.length} selected transaction(s)?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (onDeleteRange) {
        await onDeleteRange(null, null, selectedTxIds);
      } else if (onDeleteTransaction) {
        for (const id of selectedTxIds) {
          await onDeleteTransaction(id);
        }
      }
      setSelectedTxIds([]);
    } catch (err) {
      alert("Failed to delete selected rows: " + err.message);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedTxIds.length === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(filteredTransactions.map(t => t.id));
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
      <div className="glass-panel" style={{ padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "18px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", borderRadius: "10px", background: "linear-gradient(135deg, #0284c7, #6366f1)", color: "#fff" }}>
              <Layers size={22} />
            </div>
            <div>
              <span className="badge badge-primary" style={{ fontSize: "0.72rem", marginBottom: "4px" }}>Mak Power Logistics</span>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                IMS Stock Movement & Inventory Ledger
              </h1>
            </div>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "6px", margin: 0 }}>
            Real-time chronological inventory transactions, stock inflows (+), outflows (-), batch upload (2026 to date), and SKU mapping.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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

      {/* ==================== 5 KPI SUMMARY CARDS ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        
        {/* Card 1: Total Physical Stock */}
        <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8" }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total All On-Hand</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: totalNetStock >= 0 ? "var(--text-main)" : "var(--danger)" }}>
              {totalNetStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "#38bdf8", marginTop: "1px" }}>Combined Warehouses</div>
          </div>
        </div>

        {/* Card 2: Delhi Warehouse Stock */}
        <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid rgba(56, 189, 248, 0.3)", background: "rgba(56, 189, 248, 0.04)" }}>
          <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.18)", color: "#38bdf8" }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 700 }}>🏢 Delhi Warehouse</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: delhiStock >= 0 ? "#38bdf8" : "var(--danger)" }}>
              {delhiStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>Delhi On-Hand Stock</div>
          </div>
        </div>

        {/* Card 3: Mumbai Warehouse Stock */}
        <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid rgba(168, 85, 247, 0.3)", background: "rgba(168, 85, 247, 0.04)" }}>
          <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.18)", color: "#c084fc" }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.74rem", color: "#c084fc", fontWeight: 700 }}>🏢 Mumbai Warehouse</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: mumbaiStock >= 0 ? "#c084fc" : "var(--danger)" }}>
              {mumbaiStock.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>Mumbai On-Hand Stock</div>
          </div>
        </div>

        {/* Card 4: Total Inward Movement */}
        <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Inward (+)</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--success)" }}>
              +{totalInwardUnits.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>Factory & Vendor Inflows</div>
          </div>
        </div>

        {/* Card 5: Total Outward Movement */}
        <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Dispatched (-)</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--danger)" }}>
              -{totalOutwardUnits.toLocaleString()} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pcs</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>Party & Dealer Outflows</div>
          </div>
        </div>

      </div>

      {/* ==================== NAVIGATION TABS ==================== */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px", overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`nav-tab-item ${activeTab === "ledger" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <FileText size={16} /> <span>Stock Movement Ledger ({filteredTransactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`nav-tab-item ${activeTab === "matrix" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 600 }}
        >
          <Package size={16} /> <span>Item Stock Matrix ({itemStockMatrix.length})</span>
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
          <ShieldAlert size={16} /> <span>Missing Item IDs Studio ({distinctMissingItems.length})</span>
        </button>
      </div>

      {/* ==================== TAB 1: STOCK MOVEMENT LEDGER ==================== */}
      {activeTab === "ledger" && (
        <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Action & Filter Bar */}
          <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px", flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
                <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search item, party, location, ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: "36px", height: "36px", fontSize: "0.85rem" }}
                />
              </div>

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

              {/* Date Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="form-control"
                  style={{ width: "auto", height: "36px", fontSize: "0.8rem", padding: "4px 8px" }}
                  title="From Date (2026+)"
                />
                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="form-control"
                  style={{ width: "auto", height: "36px", fontSize: "0.8rem", padding: "4px 8px" }}
                  title="To Date"
                />
              </div>

              {(startDate || endDate || searchQuery || locationFilter !== "all" || movementFilter !== "all" || missingIdFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
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
            </div>

            {/* Export & Actions */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button 
                onClick={() => {
                  setDelRangeStart(startDate || "2026-01-01");
                  setDelRangeEnd(endDate || new Date().toISOString().split("T")[0]);
                  setShowDeleteRangeModal(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }}
                title="Select date range to delete all transactions at once"
              >
                <Trash2 size={14} /> Delete by Date Range
              </button>

              <button 
                onClick={handleExportCsv}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          {/* Floating Selected Rows Action Strip */}
          {selectedTxIds.length > 0 && (
            <div className="glass-panel card-fade-in" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={18} style={{ color: "var(--danger)" }} />
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {selectedTxIds.length} transaction(s) selected
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setSelectedTxIds([])}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.8rem" }}
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleExecuteDeleteSelected}
                  className="btn btn-danger btn-sm"
                  style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Trash2 size={14} /> Delete Selected ({selectedTxIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
            {filteredTransactions.length === 0 ? (
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
                        checked={selectedTxIds.length > 0 && selectedTxIds.length === filteredTransactions.length}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: "pointer" }}
                        title="Select All Filtered Rows"
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
                    <th style={{ width: "10%" }}>Item ID</th>
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
                    <th style={{ width: "14%" }}>Party Name</th>
                    <th style={{ width: "10%" }}>Remarks</th>
                    <th style={{ width: "6%", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => {
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

                        {/* 3. Item ID */}
                        <td>
                          {tx.itemId ? (
                            <span className="badge badge-secondary" style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8" }}>
                              #{tx.itemId}
                            </span>
                          ) : (
                            <button
                              onClick={() => setResolvingMissingItemName(tx.itemName)}
                              className="badge"
                              style={{ 
                                background: "rgba(239, 68, 68, 0.15)", 
                                color: "var(--danger)", 
                                border: "1px dashed rgba(239, 68, 68, 0.4)",
                                cursor: "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 700
                              }}
                            >
                              + Create / Link ID
                            </button>
                          )}
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
                {itemStockMatrix.map(item => (
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
                  {distinctMissingItems.map(item => (
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
              Select a start and end date. All stock movement records within this date range will be permanently removed.
            </p>

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
