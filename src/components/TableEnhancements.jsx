import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Columns, Copy, Check, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

/**
 * Column Selector Dropdown Component
 * Allows users to show/hide specific table columns dynamically.
 */
export function ColumnSelectorModal({ allColumns = [], visibleColumns = [], onToggleColumn, onResetColumns }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary btn-sm"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid var(--border-glass)",
          color: "var(--text-main)",
          fontSize: "0.8rem",
          fontWeight: 600,
          padding: "6px 12px"
        }}
        title="Customize visible columns for this table"
      >
        <Columns size={14} style={{ color: "#38bdf8" }} />
        <span>Columns ({visibleColumns.length}/{allColumns.length})</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 9999,
            background: "#0f172a",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "10px",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.75)",
            padding: "12px 14px",
            minWidth: "210px",
            maxHeight: "340px",
            overflowY: "auto"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "6px" }}>
            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#38bdf8" }}>Visible Columns</span>
            {onResetColumns && (
              <button
                type="button"
                onClick={onResetColumns}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "underline" }}
              >
                Reset All
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {allColumns.map(col => {
              const isChecked = visibleColumns.includes(col.id);
              return (
                <label key={col.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleColumn(col.id)}
                  />
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Header Component for Sorting and Column Selection/Copying
 */
export function EnhancedSortHeader({
  colKey,
  title,
  sortConfig,
  onRequestSort,
  getValue = null,
  onCopyColumn = null,
  selectedColumnKey = null,
  onSelectColumn = null,
  style = {}
}) {
  const isSorted = sortConfig && sortConfig.key === colKey;
  const direction = isSorted ? sortConfig.direction : null;
  const isColumnSelected = selectedColumnKey === colKey;
  const [copiedToast, setCopiedToast] = useState(false);

  const handleClick = (e) => {
    // 1. Highlight / Select column
    if (onSelectColumn) {
      onSelectColumn(colKey);
    }
    // 2. Copy all column data to clipboard
    if (onCopyColumn) {
      const copySuccess = onCopyColumn(colKey, title);
      if (copySuccess) {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }
    }
    // 3. Request column sort
    if (onRequestSort) {
      onRequestSort(colKey, getValue);
    }
  };

  return (
    <th
      onClick={handleClick}
      style={{
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.2s ease",
        background: isColumnSelected ? "rgba(56, 189, 248, 0.25) !important" : undefined,
        borderBottom: isColumnSelected ? "2px solid #38bdf8" : undefined,
        color: isSorted || isColumnSelected ? "#38bdf8" : undefined,
        whiteSpace: "nowrap",
        position: "sticky",
        top: 0,
        zIndex: 20,
        ...style
      }}
      title={`Click to select column, copy values & sort by ${title}`}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span>{title}</span>
          {direction === "asc" && <ArrowUp size={13} style={{ color: "#38bdf8", flexShrink: 0 }} />}
          {direction === "desc" && <ArrowDown size={13} style={{ color: "#38bdf8", flexShrink: 0 }} />}
          {!direction && <ArrowUpDown size={12} style={{ opacity: 0.35, flexShrink: 0 }} />}
        </div>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectColumn) onSelectColumn(colKey);
            if (onCopyColumn) {
              onCopyColumn(colKey, title);
              setCopiedToast(true);
              setTimeout(() => setCopiedToast(false), 2000);
            }
          }}
          style={{
            background: "none",
            border: "none",
            color: copiedToast ? "var(--success)" : "var(--text-muted)",
            cursor: "pointer",
            padding: "2px",
            display: "inline-flex",
            alignItems: "center",
            opacity: 0.75
          }}
          title={`Copy all values in "${title}" column`}
        >
          {copiedToast ? <Check size={13} style={{ color: "var(--success)" }} /> : <Copy size={12} />}
        </button>
      </div>
    </th>
  );
}

/**
 * Universal Custom Hook for Table Management:
 * 1. Sorting
 * 2. Column Visibility Controls
 * 3. Single-Click Header Column Selection & Copying
 */
export function useTableManager({ tableId, allColumns = [], defaultVisible = null, items = [], getValueMap = {} }) {
  const defaultKeys = useMemo(() => defaultVisible || allColumns.map(c => c.id), [defaultVisible, allColumns]);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`table_cols_${tableId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultKeys;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`table_cols_${tableId}`, JSON.stringify(visibleColumns));
    } catch (e) {}
  }, [tableId, visibleColumns]);

  const toggleColumn = useCallback((colId) => {
    setVisibleColumns(prev => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== colId);
      } else {
        return [...prev, colId];
      }
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(defaultKeys);
  }, [defaultKeys]);

  const isColVisible = useCallback((colId) => visibleColumns.includes(colId), [visibleColumns]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState(null);

  const sortedItems = useMemo(() => {
    let sortableItems = [...(items || [])];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = sortConfig.getValue ? sortConfig.getValue(a) : (getValueMap[sortConfig.key] ? getValueMap[sortConfig.key](a) : a[sortConfig.key]);
        let bValue = sortConfig.getValue ? sortConfig.getValue(b) : (getValueMap[sortConfig.key] ? getValueMap[sortConfig.key](b) : b[sortConfig.key]);

        if (aValue === undefined || aValue === null || aValue === "-") aValue = "";
        if (bValue === undefined || bValue === null || bValue === "-") bValue = "";

        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (!isNaN(aNum) && !isNaN(bNum) && String(aValue).trim() !== "" && String(bValue).trim() !== "") {
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig, getValueMap]);

  const requestSort = useCallback((key, getValue = null) => {
    setSortConfig(prevConfig => {
      let direction = "asc";
      if (prevConfig && prevConfig.key === key && prevConfig.direction === "asc") {
        direction = "desc";
      } else if (prevConfig && prevConfig.key === key && prevConfig.direction === "desc") {
        return null;
      }
      return { key, direction, getValue };
    });
  }, []);

  // Single-Click Header Column Selection & Copying
  const [selectedColumnKey, setSelectedColumnKey] = useState(null);
  const [copyToastMessage, setCopyToastMessage] = useState("");

  const copyColumnValues = useCallback((colKey, colTitle) => {
    const extractFn = getValueMap[colKey] || ((item) => item[colKey]);
    const values = sortedItems
      .map(item => {
        const val = extractFn(item);
        if (val === null || val === undefined || val === "-") return "";
        return String(val).trim();
      })
      .filter(val => val !== "");

    if (values.length === 0) return false;

    const copyText = values.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyText);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = copyText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopyToastMessage(`Copied ${values.length} item(s) from "${colTitle}" column to clipboard!`);
    setTimeout(() => setCopyToastMessage(""), 3000);
    return true;
  }, [sortedItems, getValueMap]);

  return {
    allColumns,
    visibleColumns,
    toggleColumn,
    resetColumns,
    isColVisible,
    sortedItems,
    requestSort,
    sortConfig,
    selectedColumnKey,
    setSelectedColumnKey,
    copyColumnValues,
    copyToastMessage,
    ColumnSelectorBtn: () => (
      <ColumnSelectorModal
        allColumns={allColumns}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
      />
    )
  };
}
