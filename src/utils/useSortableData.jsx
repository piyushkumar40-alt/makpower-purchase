import React, { useState, useMemo, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Copy, Check } from "lucide-react";

export function SortHeader({ sortConfig, onRequestSort, colKey, title, getValue = null, style = {}, onCopyColumn = null, selectedColumnKey = null, onSelectColumn = null }) {
  const isSorted = sortConfig && sortConfig.key === colKey;
  const direction = isSorted ? sortConfig.direction : null;
  const isColumnSelected = selectedColumnKey === colKey;
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    if (onSelectColumn) onSelectColumn(colKey);
    if (onCopyColumn) {
      onCopyColumn(colKey, title, getValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    if (onRequestSort) onRequestSort(colKey, getValue);
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
        <span 
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectColumn) onSelectColumn(colKey);
            if (onCopyColumn) {
              onCopyColumn(colKey, title, getValue);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          style={{ opacity: 0.7, cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "2px" }}
          title={`Copy all values in "${title}" column`}
        >
          {copied ? <Check size={12} style={{ color: "var(--success)" }} /> : <Copy size={11} />}
        </span>
      </div>
    </th>
  );
}

export function useSortableData(items, initialConfig = null) {
  const [sortConfig, setSortConfig] = useState(initialConfig);
  const [selectedColumnKey, setSelectedColumnKey] = useState(null);
  const [copyToastMessage, setCopyToastMessage] = useState("");

  const sortedItems = useMemo(() => {
    let sortableItems = [...(items || [])];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = sortConfig.getValue ? sortConfig.getValue(a) : a[sortConfig.key];
        let bValue = sortConfig.getValue ? sortConfig.getValue(b) : b[sortConfig.key];

        if (aValue === undefined || aValue === null || aValue === "—") aValue = "";
        if (bValue === undefined || bValue === null || bValue === "—") bValue = "";

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
  }, [items, sortConfig]);

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

  const copyColumnValues = useCallback((colKey, colTitle, getValue = null) => {
    const extractFn = getValue || ((item) => item[colKey]);
    const values = sortedItems
      .map(item => {
        const val = extractFn(item);
        if (val === null || val === undefined || val === "—") return "";
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
  }, [sortedItems]);

  const RenderSortHeader = (arg1, arg2, arg3, arg4) => {
    let colKey = arg1;
    let title = arg2;
    let getValue = arg3 || null;
    let style = arg4 || {};

    if (typeof arg1 === "object" && arg1 !== null) {
      colKey = arg1.colKey;
      title = arg1.title;
      getValue = arg1.getValue || null;
      style = arg1.style || {};
    }

    return (
      <SortHeader
        key={colKey}
        colKey={colKey}
        title={title}
        getValue={getValue}
        style={style}
        sortConfig={sortConfig}
        onRequestSort={requestSort}
        onCopyColumn={copyColumnValues}
        selectedColumnKey={selectedColumnKey}
        onSelectColumn={setSelectedColumnKey}
      />
    );
  };

  return { items: sortedItems, requestSort, sortConfig, selectedColumnKey, setSelectedColumnKey, copyColumnValues, copyToastMessage, RenderSortHeader };
}
