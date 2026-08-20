import React, { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function useSortableData(items, initialConfig = null) {
  const [sortConfig, setSortConfig] = useState(initialConfig);

  const sortedItems = useMemo(() => {
    let sortableItems = [...(items || [])];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = sortConfig.getValue ? sortConfig.getValue(a) : a[sortConfig.key];
        let bValue = sortConfig.getValue ? sortConfig.getValue(b) : b[sortConfig.key];

        if (aValue === undefined || aValue === null || aValue === "—") aValue = "";
        if (bValue === undefined || bValue === null || bValue === "—") bValue = "";

        // Number check
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (!isNaN(aNum) && !isNaN(bNum) && String(aValue).trim() !== "" && String(bValue).trim() !== "") {
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String / Date comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (aStr < bStr) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aStr > bStr) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key, getValue = null) => {
    let direction = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction, getValue });
  };

  const RenderSortHeader = ({ colKey, title, getValue = null, style = {} }) => {
    const isSorted = sortConfig && sortConfig.key === colKey;
    const direction = isSorted ? sortConfig.direction : null;

    return (
      <th 
        onClick={() => requestSort(colKey, getValue)}
        style={{ 
          cursor: "pointer", 
          userSelect: "none", 
          transition: "all 0.2s ease",
          color: isSorted ? "var(--primary)" : undefined,
          whiteSpace: "nowrap",
          ...style 
        }}
        title={`Click to sort by ${title}`}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span>{title}</span>
          {direction === "asc" && <ArrowUp size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />}
          {direction === "desc" && <ArrowDown size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />}
          {!direction && <ArrowUpDown size={12} style={{ opacity: 0.35, flexShrink: 0 }} />}
        </div>
      </th>
    );
  };

  return { items: sortedItems, requestSort, sortConfig, RenderSortHeader };
}
