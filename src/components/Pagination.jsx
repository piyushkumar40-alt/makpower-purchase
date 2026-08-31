import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2 } from "lucide-react";

/**
 * Universal Pagination Component
 * Defaults to 100 rows per page with page navigation and per-page options
 */
export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 100,
  onPageChange,
  onItemsPerPageChange,
  perPageOptions = [50, 100, 200, 500]
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalItems <= itemsPerPage && currentPage === 1 && !onItemsPerPageChange) {
    return null; // No pagination needed if all items fit on 1 page
  }

  // Generate page numbers to show around current page
  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      flexWrap: "wrap", 
      gap: "12px", 
      marginTop: "16px", 
      padding: "12px 18px", 
      background: "rgba(15, 23, 42, 0.6)", 
      borderRadius: "10px", 
      border: "1px solid var(--border-glass)" 
    }}>
      
      {/* Items Range Display */}
      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
        Showing <strong>{startItem.toLocaleString()}–{endItem.toLocaleString()}</strong> of <strong>{totalItems.toLocaleString()}</strong> rows
      </div>

      {/* Navigation Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 8px", opacity: currentPage === 1 ? 0.4 : 1 }}
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>

        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px", opacity: currentPage === 1 ? 0.4 : 1 }}
          title="Previous Page"
        >
          <ChevronLeft size={14} /> Prev
        </button>

        {/* Numeric Page Buttons */}
        <div style={{ display: "flex", gap: "3px", margin: "0 4px" }}>
          {getPageNumbers().map(pageNum => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`btn btn-sm ${pageNum === currentPage ? "btn-primary" : "btn-secondary"}`}
              style={{
                minWidth: "30px",
                height: "30px",
                padding: "0 6px",
                fontSize: "0.82rem",
                fontWeight: pageNum === currentPage ? 800 : 500
              }}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage >= totalPages}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px", opacity: currentPage >= totalPages ? 0.4 : 1 }}
          title="Next Page"
        >
          Next <ChevronRight size={14} />
        </button>

        <button 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage >= totalPages}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 8px", opacity: currentPage >= totalPages ? 0.4 : 1 }}
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>

      {/* Items Per Page Selector */}
      {onItemsPerPageChange && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Rows per page:</span>
          <select 
            value={itemsPerPage} 
            onChange={e => onItemsPerPageChange(Number(e.target.value))}
            className="form-control"
            style={{ width: "auto", padding: "4px 8px", fontSize: "0.82rem", height: "32px", fontWeight: 600 }}
          >
            {perPageOptions.map(opt => (
              <option key={opt} value={opt}>{opt} rows</option>
            ))}
          </select>
        </div>
      )}

    </div>
  );
}

/**
 * Smart Selection Bar Component (Gmail-style Multi-Page Selector)
 * Displays options:
 * - "All 100 rows on this page are selected. Select all X rows across all pages"
 * - "All X rows across all pages are selected. Select only 100 on this page / Clear selection"
 */
export function SmartSelectionBar({
  selectedCount = 0,
  currentPageCount = 0,
  totalFilteredCount = 0,
  isAllFilteredSelected = false,
  onSelectAllCurrentPage,
  onSelectAllFiltered,
  onClearSelection,
  entityName = "rows",
  actions = null
}) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="card-fade-in" 
      style={{ 
        padding: "10px 18px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        background: isAllFilteredSelected 
          ? "linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(56, 189, 248, 0.15) 100%)" 
          : "rgba(56, 189, 248, 0.12)", 
        border: `1px solid ${isAllFilteredSelected ? "rgba(99, 102, 241, 0.4)" : "rgba(56, 189, 248, 0.3)"}`, 
        borderRadius: "8px",
        marginBottom: "12px",
        flexWrap: "wrap",
        gap: "10px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <CheckCircle2 size={18} style={{ color: isAllFilteredSelected ? "#818cf8" : "#38bdf8" }} />
        
        {isAllFilteredSelected ? (
          <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>
            ✓ All <strong>{totalFilteredCount.toLocaleString()}</strong> {entityName} across all pages are selected.
          </span>
        ) : (
          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-main)" }}>
            <strong>{selectedCount.toLocaleString()}</strong> {entityName} selected.
          </span>
        )}

        {/* Toggle options between current page vs all filtered */}
        {totalFilteredCount > currentPageCount && (
          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", marginLeft: "6px" }}>
            {!isAllFilteredSelected ? (
              <button
                type="button"
                onClick={onSelectAllFiltered}
                style={{
                  background: "rgba(56, 189, 248, 0.2)",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  padding: "3px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                👉 Select all {totalFilteredCount.toLocaleString()} {entityName} across all pages
              </button>
            ) : (
              <button
                type="button"
                onClick={onSelectAllCurrentPage}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid var(--border-glass)",
                  color: "var(--text-muted)",
                  borderRadius: "6px",
                  padding: "3px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Select only {currentPageCount} on this page
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons (e.g. Delete, Export, Clear) */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {actions}

        <button
          type="button"
          onClick={onClearSelection}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.8rem" }}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}
