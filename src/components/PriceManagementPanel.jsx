import React, { useState, useMemo } from "react";
import { 
  Tag, DollarSign, Plus, UploadCloud, Trash2, Edit2, Search, Filter, 
  Download, CheckCircle2, AlertCircle, Calendar, RefreshCw, X, Check,
  Layers, ArrowUpDown, FileText, ExternalLink
} from "lucide-react";
import Pagination, { SmartSelectionBar } from "./Pagination";
import DateRangeFilter, { isDateInBetween, parseDateTimestamp } from "./DateRangeFilter";
import { useLoading } from "../context/LoadingContext";
import { downloadCsv } from "../utils/formatters";

// Helper: Format Date into DD/MM/YYYY or YYYY-MM-DD cleanly
function formatDateDisplay(dateStr) {
  if (!dateStr) return "—";
  return String(dateStr).trim();
}

// Helper: Check if price record is currently active based on today's date
function isPriceActive(from, to) {
  if (!from && !to) return true;
  const now = new Date().setHours(0, 0, 0, 0);
  const fromTs = from ? parseDateTimestamp(from) : null;
  const toTs = to ? parseDateTimestamp(to) : null;

  if (fromTs && now < fromTs) return false; // Starts in future
  if (toTs) {
    const toEndDay = new Date(toTs).setHours(23, 59, 59, 999);
    if (now > toEndDay) return false; // Expired
  }
  return true;
}

// Helper: Generate a unique, deterministic price record ID from item and validity date window
export function generatePriceId(itemId = "", itemName = "", from = "", to = "") {
  const cleanItem = String(itemId || itemName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanFrom = String(from || "").trim().replace(/[^a-z0-9]/gi, "");
  const cleanTo = String(to || "").trim().replace(/[^a-z0-9]/gi, "");
  return `prc_${cleanItem || "item"}_${cleanFrom || "from"}_${cleanTo || "to"}`;
}

export default function PriceManagementPanel({
  items = [],
  itemPrices = [],
  onAddPrice,
  onUpdatePrice,
  onDeletePrice,
  onBatchUploadPrices,
  onBulkDeletePrices,
  currentUser
}) {
  const { startLoading, finishLoading, showSuccessToast, showErrorToast } = useLoading();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "expired"
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Sorting
  const [sortField, setSortField] = useState("id");
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Checkbox Selection
  const [selectedPriceIds, setSelectedPriceIds] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  // Bulk Upload State
  const [bulkRawText, setBulkRawText] = useState("");
  const [bulkParsedRows, setBulkParsedRows] = useState([]);
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // KPI Metrics
  const { totalRecords, activeRecords, expiredRecords, uniqueItemsCount } = useMemo(() => {
    let active = 0;
    let expired = 0;
    const itemSet = new Set();

    (itemPrices || []).forEach(p => {
      if (isPriceActive(p.from, p.to)) active++;
      else expired++;
      if (p.itemId || p.itemName) itemSet.add(p.itemId || p.itemName);
    });

    return {
      totalRecords: (itemPrices || []).length,
      activeRecords: active,
      expiredRecords: expired,
      uniqueItemsCount: itemSet.size
    };
  }, [itemPrices]);

  // Filtered Price List
  const filteredPrices = useMemo(() => {
    return (itemPrices || []).filter(p => {
      // Search by ID or Item Name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(p.itemId || p.id || "").toLowerCase().includes(q);
        const nameMatch = String(p.itemName || "").toLowerCase().includes(q);
        if (!idMatch && !nameMatch) return false;
      }

      // Status Filter
      if (statusFilter !== "all") {
        const active = isPriceActive(p.from, p.to);
        if (statusFilter === "active" && !active) return false;
        if (statusFilter === "expired" && active) return false;
      }

      // Date Range Filter
      if (filterStartDate || filterEndDate) {
        if (!isDateInBetween(p.from || p.to, filterStartDate, filterEndDate)) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";

      if (sortField === "pp") {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (sortField === "from" || sortField === "to") {
        valA = parseDateTimestamp(valA) || 0;
        valB = parseDateTimestamp(valB) || 0;
      } else if (sortField === "id" || sortField === "itemId") {
        const numA = parseInt(String(valA).replace(/\D/g, ""), 10);
        const numB = parseInt(String(valB).replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          valA = numA;
          valB = numB;
        }
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [itemPrices, searchQuery, statusFilter, filterStartDate, filterEndDate, sortField, sortAsc]);

  // Paginated Slice
  const paginatedPrices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPrices.slice(start, start + itemsPerPage);
  }, [filteredPrices, currentPage, itemsPerPage]);

  const isPageSelected = paginatedPrices.length > 0 && paginatedPrices.every(p => selectedPriceIds.includes(p.id));
  const isAllFilteredSelected = filteredPrices.length > 0 && selectedPriceIds.length === filteredPrices.length;

  const handleToggleSelectAll = () => {
    if (isPageSelected || isAllFilteredSelected) {
      setSelectedPriceIds(prev => prev.filter(id => !paginatedPrices.some(p => p.id === id)));
    } else {
      setSelectedPriceIds(prev => Array.from(new Set([...prev, ...paginatedPrices.map(p => p.id)])));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedPriceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Bulk Delete
  const handleExecuteDeleteSelected = async () => {
    if (selectedPriceIds.length === 0) return;
    if (!window.confirm(`⚠️ Are you sure you want to delete the ${selectedPriceIds.length} selected price records?`)) return;

    startLoading("Deleting Price Records...", `Removing ${selectedPriceIds.length} items from database...`, 1);
    try {
      if (onBulkDeletePrices) {
        await onBulkDeletePrices(selectedPriceIds);
      }
      setSelectedPriceIds([]);
      finishLoading(`Deleted ${selectedPriceIds.length} price records!`);
      showSuccessToast(`Successfully deleted ${selectedPriceIds.length} price records!`);
    } catch (err) {
      finishLoading();
      showErrorToast("Failed to delete selected price records: " + err.message);
    }
  };

  // Single Delete
  const handleExecuteDeleteSingle = async (price) => {
    if (!window.confirm(`Delete price for "${price.itemName || price.itemId}" (₹${price.pp})?`)) return;
    try {
      if (onDeletePrice) {
        await onDeletePrice(price.id);
      }
      setSelectedPriceIds(prev => prev.filter(x => x !== price.id));
      showSuccessToast(`Deleted price for ${price.itemName || price.itemId}`);
    } catch (err) {
      showErrorToast("Failed to delete price: " + err.message);
    }
  };

  // Export CSV (All Filtered or Selected)
  const handleExportCsv = (targetIds = null) => {
    const isSelectedMode = Array.isArray(targetIds) && targetIds.length > 0;
    const targetPrices = isSelectedMode 
      ? filteredPrices.filter(p => targetIds.includes(p.id))
      : filteredPrices;

    if (targetPrices.length === 0) {
      alert("No price records to export.");
      return;
    }
    const headers = ["ID", "Item Name", "PP", "From", "To", "Status"];
    const rows = targetPrices.map(p => [
      p.itemId || p.id || "",
      p.itemName || "",
      p.pp || 0,
      p.from || "",
      p.to || "",
      isPriceActive(p.from, p.to) ? "Active" : "Expired"
    ]);

    const filename = isSelectedMode 
      ? `Price_Master_Selected_${targetPrices.length}`
      : `Price_Master_${new Date().toISOString().split("T")[0]}`;

    downloadCsv(headers, rows, filename);
  };

  // Parse Bulk Text (from Google Sheet / Excel paste)
  const handleParseBulkText = (text) => {
    setBulkRawText(text);
    setBulkUploadError("");
    if (!text || !text.trim()) {
      setBulkParsedRows([]);
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];
    const seenBatchKeys = new Map();

    lines.forEach((line, lineIdx) => {
      // Split by tab or comma
      let cols = line.includes("\t") ? line.split("\t") : line.split(",");
      cols = cols.map(c => c.replace(/^["']|["']$/g, "").trim());

      // Skip header row if detected
      if (lineIdx === 0 && (
        cols[0]?.toLowerCase() === "id" || 
        cols[1]?.toLowerCase().includes("item") || 
        cols[2]?.toLowerCase() === "pp" ||
        cols[2]?.toLowerCase().includes("price")
      )) {
        return;
      }

      if (cols.length >= 2) {
        const id = cols[0] || "";
        const itemName = cols[1] || "";
        const pp = parseFloat(cols[2]) || 0;
        const from = cols[3] || "01/05/2026";
        const to = cols[4] || "01/05/2030";

        if (id || itemName) {
          const baseKey = generatePriceId(id, itemName, from, to);
          let uniquePriceId = baseKey;
          if (seenBatchKeys.has(baseKey)) {
            const count = seenBatchKeys.get(baseKey) + 1;
            seenBatchKeys.set(baseKey, count);
            uniquePriceId = `${baseKey}_${count}`;
          } else {
            seenBatchKeys.set(baseKey, 1);
          }

          parsed.push({
            id: uniquePriceId,
            itemId: id,
            itemName: itemName,
            pp: pp,
            from: from,
            to: to
          });
        }
      }
    });

    setBulkParsedRows(parsed);
  };

  const handleExecuteBulkUpload = async () => {
    if (bulkParsedRows.length === 0) {
      setBulkUploadError("Please paste valid price rows to upload.");
      return;
    }

    setIsUploading(true);
    startLoading("Uploading Price Master...", `Ingesting ${bulkParsedRows.length} price records...`, 1);
    try {
      if (onBatchUploadPrices) {
        await onBatchUploadPrices(bulkParsedRows);
      }
      finishLoading(`Successfully uploaded ${bulkParsedRows.length} price records!`);
      showSuccessToast(`🎉 Successfully uploaded ${bulkParsedRows.length} price records!`);
      setShowBulkUploadModal(false);
      setBulkRawText("");
      setBulkParsedRows([]);
    } catch (err) {
      finishLoading();
      setBulkUploadError(err.message || "Failed to upload prices");
      showErrorToast("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* ==================== TOP BANNER & ACTION HEADER ==================== */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Tag size={22} style={{ color: "var(--primary)" }} /> Price Management Master
            <span className="badge badge-primary" style={{ fontSize: "0.78rem", padding: "4px 10px" }}>
              Admin Studio
            </span>
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", margin: "4px 0 0 0" }}>
            Manage item purchase and partner prices, validity date ranges, bulk ingestion from Excel/Sheets, and price logs.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
          >
            <UploadCloud size={16} /> Bulk Upload Prices (Excel)
          </button>

          <button
            onClick={() => {
              setEditingPrice(null);
              setShowAddModal(true);
            }}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
          >
            <Plus size={16} /> Add Price Entry
          </button>
        </div>
      </div>

      {/* ==================== SUMMARY KPI STATS ==================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="glass-panel" style={{ padding: "18px", display: "flex", alignItems: "center", gap: "14px", borderRadius: "14px" }}>
          <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.12)", color: "var(--primary)" }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Price Entries</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>{totalRecords.toLocaleString()}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--primary)" }}>Across {uniqueItemsCount} catalog items</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px", display: "flex", alignItems: "center", gap: "14px", borderRadius: "14px" }}>
          <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Active Valid Prices</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--success)" }}>{activeRecords.toLocaleString()}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--success)" }}>Currently in effective date range</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px", display: "flex", alignItems: "center", gap: "14px", borderRadius: "14px" }}>
          <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Expired / Future Prices</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--danger)" }}>{expiredRecords.toLocaleString()}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Past validity or scheduled ahead</div>
          </div>
        </div>
      </div>

      {/* ==================== SEARCH & FILTERS BAR ==================== */}
      <div className="glass-panel" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: 1, minWidth: "280px", flexWrap: "wrap" }}>
          {/* Search Box */}
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search by ID or Item Name..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="form-control"
              style={{ paddingLeft: "36px", height: "38px" }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="form-control"
            style={{ width: "auto", minHeight: "38px", height: "38px", fontSize: "0.85rem", padding: "6px 36px 6px 12px" }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired Only</option>
          </select>

          {/* Date Range Filter */}
          <DateRangeFilter
            startDate={filterStartDate}
            endDate={filterEndDate}
            onStartDateChange={setFilterStartDate}
            onEndDateChange={setFilterEndDate}
            onClear={() => {
              setFilterStartDate("");
              setFilterEndDate("");
            }}
            placeholder="Validity Date Range"
          />
        </div>

        {/* Action Buttons & Counter */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {selectedPriceIds.length > 0 && (
            <>
              <button
                onClick={() => handleExportCsv(selectedPriceIds)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.45)", background: "rgba(56, 189, 248, 0.1)" }}
                title="Download selected prices as CSV"
              >
                <Download size={14} /> Download Selected ({selectedPriceIds.length})
              </button>
              <button
                onClick={handleExecuteDeleteSelected}
                className="btn btn-danger"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px" }}
              >
                <Trash2 size={14} /> Delete Selected ({selectedPriceIds.length})
              </button>
            </>
          )}

          <button
            onClick={handleExportCsv}
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "38px" }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ==================== DATA TABLE (IMAGE 3 FORMAT: ID, Item Name, PP, From, To) ==================== */}
      <div className="glass-panel" style={{ padding: 0, overflow: "hidden", borderRadius: "14px" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0, minWidth: "850px" }}>
            <thead>
              <tr>
                <th style={{ width: "45px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isPageSelected || isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="checkbox-input"
                  />
                </th>
                <th onClick={() => handleSort("itemId")} style={{ cursor: "pointer", width: "120px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    ID <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort("itemName")} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    Item Name <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort("pp")} style={{ cursor: "pointer", textAlign: "right", width: "140px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                    PP (Price) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort("from")} style={{ cursor: "pointer", width: "140px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    From <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort("to")} style={{ cursor: "pointer", width: "140px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    To <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                <th style={{ width: "100px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedPrices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                    <Tag size={40} style={{ opacity: 0.35, marginBottom: "12px" }} />
                    <h4 style={{ margin: "0 0 6px 0", color: "var(--text-main)" }}>No price records found</h4>
                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
                      {searchQuery || statusFilter !== "all" 
                        ? "Try clearing your active filters to see all prices."
                        : "Click 'Bulk Upload Prices' or 'Add Price Entry' to create master price entries."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedPrices.map((price, idx) => {
                  const isSelected = selectedPriceIds.includes(price.id);
                  const active = isPriceActive(price.from, price.to);

                  return (
                    <tr 
                      key={price.id || idx}
                      style={{ background: isSelected ? "rgba(56, 189, 248, 0.08)" : undefined }}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(price.id)}
                          className="checkbox-input"
                        />
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: "var(--primary)", fontFamily: "monospace", fontSize: "0.92rem" }}>
                          #{price.itemId || price.id}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.9rem" }}>
                          {price.itemName || "—"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 800, color: "var(--success)", fontSize: "1rem" }}>
                          ₹{Number(price.pp || 0).toLocaleString()}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.84rem", color: "var(--text-muted)" }}>
                          <Calendar size={12} /> {formatDateDisplay(price.from)}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.84rem", color: "var(--text-muted)" }}>
                          <Calendar size={12} /> {formatDateDisplay(price.to)}
                        </div>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${active ? "badge-success" : "badge-danger"}`} style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          {active ? "Active" : "Expired"}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            onClick={() => {
                              setEditingPrice(price);
                              setShowAddModal(true);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 8px" }}
                            title="Edit Price"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => handleExecuteDeleteSingle(price)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px" }}
                            title="Delete Price"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-glass)" }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredPrices.length}
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

      {/* ==================== MODAL: ADD / EDIT SINGLE PRICE ==================== */}
      {showAddModal && (
        <SinglePriceModal
          price={editingPrice}
          items={items}
          onSave={async (priceData) => {
            if (editingPrice) {
              await onUpdatePrice(editingPrice.id, priceData);
              showSuccessToast(`Updated price for ${priceData.itemName || priceData.itemId}`);
            } else {
              await onAddPrice(priceData);
              showSuccessToast(`Added new price entry for ${priceData.itemName || priceData.itemId}`);
            }
            setShowAddModal(false);
            setEditingPrice(null);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingPrice(null);
          }}
        />
      )}

      {/* ==================== MODAL: BULK UPLOAD FROM EXCEL / SHEETS (IMAGE 3) ==================== */}
      {showBulkUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkUploadModal(false)}>
          <div 
            className="modal-content glass-panel card-fade-in" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: "800px", padding: "26px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <UploadCloud size={20} /> Bulk Upload Prices (Google Sheets / Excel)
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "4px 0 0 0" }}>
                  Copy 5 columns from Google Sheet: <strong>ID | Item Name | PP | From | To</strong> and paste below.
                </p>
              </div>
              <button onClick={() => setShowBulkUploadModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            {bulkUploadError && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", marginBottom: "14px", fontSize: "0.85rem" }}>
                {bulkUploadError}
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label className="form-label">Paste Table Data (Ctrl+V)</label>
              <textarea
                rows={6}
                value={bulkRawText}
                onChange={e => handleParseBulkText(e.target.value)}
                placeholder={"1301\tCH39\t80\t01/05/2026\t01/05/2030\n1333\tDC06\t50\t01/05/2026\t01/05/2030\n1324\tDC130\t47\t01/05/2026\t01/05/2030..."}
                className="form-control"
                style={{ fontFamily: "monospace", fontSize: "0.82rem" }}
              />
            </div>

            {/* Parsed Preview Table */}
            {bulkParsedRows.length > 0 && (
              <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "12px", marginBottom: "14px", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--success)" }}>
                    ✓ Detected {bulkParsedRows.length} Price Records
                  </span>
                </div>

                <table className="table" style={{ width: "100%", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Item Name</th>
                      <th style={{ textAlign: "right" }}>PP</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkParsedRows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td><code>#{r.itemId}</code></td>
                        <td><strong>{r.itemName}</strong></td>
                        <td style={{ textAlign: "right", color: "var(--success)", fontWeight: 700 }}>₹{r.pp}</td>
                        <td>{r.from}</td>
                        <td>{r.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkParsedRows.length > 8 && (
                  <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px" }}>
                    + {bulkParsedRows.length - 8} more records...
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button
                onClick={handleExecuteBulkUpload}
                disabled={bulkParsedRows.length === 0 || isUploading}
                className="btn btn-primary"
                style={{ flex: 1, padding: "10px", fontWeight: 700 }}
              >
                {isUploading ? <RefreshCw size={15} className="spin" /> : <UploadCloud size={15} />}
                Import {bulkParsedRows.length} Price Records
              </button>
              <button
                type="button"
                onClick={() => setShowBulkUploadModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==================== SUB-COMPONENT: SINGLE PRICE MODAL ====================
function SinglePriceModal({ price, items = [], onSave, onClose }) {
  const [itemId, setItemId] = useState(price?.itemId || "");
  const [itemName, setItemName] = useState(price?.itemName || "");
  const [pp, setPp] = useState(price?.pp || "");
  const [from, setFrom] = useState(price?.from || "01/05/2026");
  const [to, setTo] = useState(price?.to || "01/05/2030");

  // Auto-fill Item Name if Item ID is selected from catalog
  const handleItemIdChange = (val) => {
    setItemId(val);
    const found = items.find(it => String(it.id).toLowerCase() === String(val).toLowerCase());
    if (found && !itemName) {
      setItemName(found.name);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!itemId.trim() && !itemName.trim()) return;

    onSave({
      ...(price || {}),
      itemId: itemId.trim(),
      itemName: itemName.trim(),
      pp: parseFloat(pp) || 0,
      from: from.trim(),
      to: to.trim()
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel card-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Tag size={18} /> {price ? "Edit Price Entry" : "Add New Price Entry"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. 1301"
                value={itemId}
                onChange={e => handleItemIdChange(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. CH39 or DC06"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                className="form-control"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Purchase / Partner Price (PP ₹) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="e.g. 80"
              value={pp}
              onChange={e => setPp(e.target.value)}
              className="form-control"
              style={{ fontWeight: 700, color: "var(--success)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Effective From Date</label>
              <input
                type="text"
                placeholder="01/05/2026"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Effective To Date</label>
              <input
                type="text"
                placeholder="01/05/2030"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="form-control"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "10px", fontWeight: 700 }}>
              {price ? "Save Changes" : "Create Price Entry"}
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
