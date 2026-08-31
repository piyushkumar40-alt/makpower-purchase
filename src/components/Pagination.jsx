import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 50,
  onPageChange,
  onItemsPerPageChange
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalItems <= itemsPerPage && currentPage === 1) {
    return null; // No pagination needed if all items fit on 1 page
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginTop: "16px", padding: "12px 16px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
      
      {/* Items Range Display */}
      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
        Showing <strong>{startItem}-{endItem}</strong> of <strong>{totalItems.toLocaleString()}</strong> items
      </div>

      {/* Navigation Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 8px" }}
          title="First Page"
        >
          <ChevronsLeft size={14} />
        </button>

        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
          title="Previous Page"
        >
          <ChevronLeft size={14} /> Prev
        </button>

        <span style={{ fontSize: "0.85rem", padding: "0 8px", fontWeight: 600, color: "var(--primary)" }}>
          Page {currentPage} of {totalPages}
        </span>

        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage >= totalPages}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
          title="Next Page"
        >
          Next <ChevronRight size={14} />
        </button>

        <button 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage >= totalPages}
          className="btn btn-sm btn-secondary"
          style={{ padding: "6px 8px" }}
          title="Last Page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>

      {/* Items Per Page Selector */}
      {onItemsPerPageChange && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Per page:</span>
          <select 
            value={itemsPerPage} 
            onChange={e => onItemsPerPageChange(Number(e.target.value))}
            className="form-control"
            style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem", height: "30px" }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </div>
      )}

    </div>
  );
}
