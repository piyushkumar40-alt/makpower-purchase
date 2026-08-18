import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, Clipboard, ShieldAlert, Sparkles, X, Package } from "lucide-react";
import ItemMasterView from "./ItemMasterView";

export default function RequesterForm({ onAddRequests, purchasers, vendors, currentUser, requests = [], cargos = [], cargoCompanies = [], items = [] }) {
  // Combine items from items prop and requests prop so dropdown has options even if master catalog isn't populated
  const combinedItems = useMemo(() => {
    const map = new Map();
    (items || []).forEach(i => {
      if (i && (i.name || i.model)) {
        const name = (i.name || i.model).trim();
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: i.id || name,
            name: name,
            category: i.category || "",
            type: i.itemType || i.type || "Import",
            itemNature: i.itemNature || "Non Consumables"
          });
        }
      }
    });
    (requests || []).forEach(r => {
      if (r && r.model && r.status !== "Cancelled") {
        const name = r.model.trim();
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: r.id || name,
            name: name,
            category: r.category || "",
            type: r.type || "Import",
            itemNature: r.itemNature || "Non Consumables"
          });
        }
      }
    });
    return Array.from(map.values());
  }, [items, requests]);

  // Build a deduplicated list of categories from both items and requests
  const catalogCategories = useMemo(() => {
    const cats = new Set();
    combinedItems.forEach(i => {
      if (i.category && i.category.trim()) cats.add(i.category.trim());
    });
    (requests || []).forEach(r => {
      if (r.category && r.category.trim()) cats.add(r.category.trim());
    });
    (items || []).forEach(i => {
      if (i.category && i.category.trim()) cats.add(i.category.trim());
    });
    return Array.from(cats).sort();
  }, [combinedItems, items, requests]);
  const [activeTab, setActiveTab] = useState("form"); // "form" | "catalog"
  // Determine default purchaser based on logged-in user
  const defaultPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");

  // Spreadsheet rows state
  const [rows, setRows] = useState([
    {
      id: 1,
      type: "Import",
      itemType: "FG",
      itemNature: "Non Consumables",
      category: "",
      model: "",
      orderQuantity: "",
      requiredByDate: "",
      purchaserId: defaultPurchaserId
    }
  ]);

  const [activeDropdown, setActiveDropdown] = useState(null); // { rowId, field: "model" | "category" }
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 220 });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const openDropdown = (e, rowId, field) => {
    if (e && e.target) {
      const rect = e.target.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 240)
      });
    }
    setHighlightedIndex(0);
    setActiveDropdown({ rowId, field });
  };

  const selectCategoryOption = (rowId, categoryName) => {
    updateCell(rowId, "category", categoryName);
    setActiveDropdown(null);
    setHighlightedIndex(0);
  };

  const selectModelOption = (rowId, item) => {
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          model: item.name,
          category: item.category || r.category,
          type: item.type || r.type,
          itemType: item.itemType || r.itemType || "FG",
          itemNature: item.itemNature || r.itemNature
        };
      }
      return r;
    }));
    setActiveDropdown(null);
    setHighlightedIndex(0);
  };

  // Scroll/resize listener to keep fixed dropdown position updated relative to active input
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeDropdown) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          const rect = activeEl.getBoundingClientRect();
          setDropdownPos({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 240)
          });
        }
      }
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeDropdown]);

  const [entryBy, setEntryBy] = useState(() => {
    return currentUser ? currentUser.name : "Mr. Himanshu";
  });
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  // Sync entry author and default purchaser when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setEntryBy(currentUser.name || "Requester");
      if (currentUser.role === "purchaser") {
        setRows(prev => prev.map(r => ({ ...r, purchaserId: currentUser.id })));
      }
    }
  }, [currentUser]);

  // Strict Validation: Item Model MUST match a valid model in combinedItems (if items exist in system) and match row's itemType (FG/RM)
  const isValidModel = (modelName, rowItemType = null) => {
    if (!modelName || !modelName.trim()) return false;
    if (combinedItems.length > 0) {
      const match = combinedItems.find(i => i.name.toLowerCase() === modelName.trim().toLowerCase());
      if (!match) return false;
      if (rowItemType && match.itemType) {
        return match.itemType.toUpperCase() === rowItemType.toUpperCase();
      }
      return true;
    }
    return true;
  };

  // Validation Check: Good to Go?
  const isGoodToGo = () => {
    return rows.every(r => 
      r.category && 
      r.model && 
      isValidModel(r.model, r.itemType) && 
      r.orderQuantity && 
      r.requiredByDate && 
      r.purchaserId
    );
  };

  const hasInvalidModel = rows.some(r => r.model && !isValidModel(r.model, r.itemType));

  // Add row
  const addRow = () => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    setRows(prev => [
      ...prev,
      {
        id: Date.now(),
        type: "Import",
        itemType: "FG",
        itemNature: "Non Consumables",
        category: "",
        model: "",
        orderQuantity: "",
        requiredByDate: "",
        purchaserId: rowPurchaserId
      }
    ]);
  };

  // Add multiple rows
  const addMultipleRows = (count) => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    const newRows = [];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: Date.now() + i,
        type: "Import",
        itemType: "FG",
        itemNature: "Non Consumables",
        category: "",
        model: "",
        orderQuantity: "",
        requiredByDate: "",
        purchaserId: rowPurchaserId
      });
    }
    setRows(prev => [...prev, ...newRows]);
  };

  // Remove row
  const removeRow = (id) => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    if (rows.length === 1) {
      // Don't remove last row, reset it instead
      setRows([
        {
          id: Date.now(),
          type: "Import",
          itemType: "FG",
          itemNature: "Non Consumables",
          category: "",
          model: "",
          orderQuantity: "",
          requiredByDate: "",
          purchaserId: rowPurchaserId
        }
      ]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update cell
  const updateCell = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Parse Date from DD/MM/YYYY to YYYY-MM-DD
  const parseExcelDate = (dateStr) => {
    if (!dateStr) return "";
    const cleaned = dateStr.trim();
    // Match DD/MM/YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Match YYYY-MM-DD
    const ymdMatch = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return cleaned;
  };

  // Match Purchaser Name (e.g. "Mr. Anees" or "Anees")
  const matchPurchaser = (nameStr) => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    if (!nameStr) return rowPurchaserId;
    const cleanName = nameStr.toLowerCase().replace("mr.", "").trim();
    const match = purchasers.find(p => p?.name && (p.name.toLowerCase().includes(cleanName) || cleanName.includes(p.name.toLowerCase())));
    return match ? match.id : rowPurchaserId;
  };

  // Parse copy-pasted Excel text
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\r?\n/);
    const parsedRows = [];

    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const cols = line.split("\t");

      // Skip header row if it contains descriptive text
      if (idx === 0 && (cols[0].toLowerCase().includes("type") || cols[3].toLowerCase().includes("name"))) {
        return;
      }

      if (cols.length >= 5) {
        // Map Excel columns: Purchase Type | Item Type | Item Nature | Category | Item Name | Qty | Date | Assign To
        // Handle both 7-col and 8-col pasted formats
        let type = "Import";
        let itemType = "RM";
        let itemNature = "Non Consumables";
        let category = "";
        let model = "";
        let qty = "";
        let dateStr = "";
        let assignee = "";

        if (cols.length >= 8) {
          type = cols[0]?.trim() || "Import";
          itemType = cols[1]?.trim() || "RM";
          itemNature = cols[2]?.trim() || "Non Consumables";
          category = cols[3]?.trim() || "";
          model = cols[4]?.trim() || "";
          qty = cols[5] ? parseInt(cols[5].replace(/,/g, ""), 10) : "";
          dateStr = cols[6]?.trim() || "";
          assignee = cols[7]?.trim() || "";
        } else {
          type = cols[0]?.trim() || "Import";
          itemNature = cols[1]?.trim() || "Non Consumables";
          category = cols[2]?.trim() || "";
          model = cols[3]?.trim() || "";
          qty = cols[4] ? parseInt(cols[4].replace(/,/g, ""), 10) : "";
          dateStr = cols[5]?.trim() || "";
          assignee = cols[6]?.trim() || "";
        }

        parsedRows.push({
          id: Date.now() + idx,
          type: ["Import", "Local"].includes(type) ? type : "Import",
          itemType: ["FG", "Finished Goods"].includes(itemType) ? "FG" : "RM",
          itemNature: ["Consumables", "Non Consumables"].includes(itemNature) ? itemNature : "Non Consumables",
          category,
          model,
          orderQuantity: isNaN(qty) ? "" : qty,
          requiredByDate: parseExcelDate(dateStr),
          purchaserId: matchPurchaser(assignee)
        });
      }
    });

    if (parsedRows.length > 0) {
      setRows(parsedRows);
    }
    setPasteText("");
    setShowPasteModal(false);
  };



  // Submit all items
  const handleSubmitAll = () => {
    if (!isGoodToGo()) return;

    // Convert row inputs to submit request format
    const requestsToSubmit = rows.map(r => {
      return {
        purchaserId: r.purchaserId,
        vendorId: "", // Reset vendor - will be selected by purchaser in Step 2!
        orderDate: new Date().toISOString().split("T")[0],
        type: r.type,
        itemType: r.itemType || "RM",
        itemNature: r.itemNature,
        category: r.category,
        model: r.model,
        orderQuantity: parseInt(r.orderQuantity, 10),
        requiredByDate: r.requiredByDate,
        entryBy: entryBy,
        notes: `Bulk request entered by ${entryBy}.`
      };
    });

    onAddRequests(requestsToSubmit);
    setSubmittedCount(requestsToSubmit.length);
    setIsSubmitted(true);
  };

  const handleReset = () => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    setRows([
      {
        id: Date.now(),
        type: "Import",
        itemNature: "Non Consumables",
        category: "",
        model: "",
        orderQuantity: "",
        requiredByDate: "",
        purchaserId: rowPurchaserId
      }
    ]);
    setIsSubmitted(false);
  };

  const goodToGo = isGoodToGo();

  // ==================== SUCCESS SCREEN ====================
  if (isSubmitted) {
    return (
      <div className="glass-panel card-fade-in" style={{ padding: "48px 40px", width: "100%", maxWidth: "640px", margin: "40px auto", textAlign: "center" }}>
        {/* Animated checkmark */}
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: "rgba(16,185,129,0.15)", border: "2px solid var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", boxShadow: "0 0 30px rgba(16,185,129,0.3)",
          animation: "pulse 2s ease-in-out infinite"
        }}>
          <CheckCircle2 size={40} style={{ color: "var(--success)" }} />
        </div>

        <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
          Order Placed Successfully!
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "28px" }}>
          <strong style={{ color: "var(--success)", fontSize: "1.1rem" }}>{submittedCount}</strong> purchase item{submittedCount !== 1 ? "s have" : " has"} been submitted and assigned to the respective purchaser{submittedCount !== 1 ? "s" : ""} for processing.
        </p>

        <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: "28px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", textAlign: "left" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            What happens next?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.88rem" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--primary)", fontWeight: 700, minWidth: "60px" }}>Step 1</span>
              <span style={{ color: "var(--text-muted)" }}>Your request has been logged and is now visible in the purchaser's dashboard.</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--primary)", fontWeight: 700, minWidth: "60px" }}>Step 2</span>
              <span style={{ color: "var(--text-muted)" }}>The assigned purchaser will fill in vendor, pricing, and delivery date details.</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--primary)", fontWeight: 700, minWidth: "60px" }}>Step 3–4</span>
              <span style={{ color: "var(--text-muted)" }}>Items will be grouped into cargo shipments and tracked until warehouse receipt.</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={handleReset}
            className="btn btn-primary"
            style={{ padding: "12px 32px", fontSize: "1rem", fontWeight: 700 }}
          >
            <Plus size={16} /> Place Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel card-fade-in" style={{ padding: "24px 28px", width: "100%", maxWidth: "100%", margin: "0" }}>
      
      {/* Sub Tab Navigation */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
        <button 
          onClick={() => setActiveTab("form")} 
          className={`tab-btn ${activeTab === "form" ? "active" : ""}`}
        >
          Purchase Requisition
        </button>
        {currentUser && (
          <button 
            onClick={() => setActiveTab("catalog")} 
            className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
            style={{ color: "#38bdf8", fontWeight: 700 }}
          >
            <Package size={14} style={{ marginRight: "4px", display: "inline" }} /> Item Catalog & Stock Lookup
          </button>
        )}
      </div>

      {activeTab === "catalog" && currentUser ? (
        <ItemMasterView requests={requests} vendors={vendors} cargos={cargos} cargoCompanies={cargoCompanies} purchasers={purchasers} />
      ) : (
        <>
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem" }}>Mak Power Purchase Request</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>
            Enter multiple purchase items below or copy-paste directly from your tracking Excel sheets.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowPasteModal(true)} className="btn btn-secondary btn-sm" style={{ color: "var(--primary)", borderColor: "var(--primary-glow)" }}>
            <Clipboard size={14} /> Paste from Excel / Sheets
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255, 255, 255, 0.04)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Entry By:</span>
            <input 
              type="text" 
              className="form-control" 
              style={{ width: "160px", padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
              value={entryBy}
              onChange={e => setEntryBy(e.target.value)}
              required
              disabled={!!currentUser}
            />
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="glass-panel" style={{ padding: "2px", background: "rgba(0,0,0,0.2)", marginBottom: "20px" }}>
        <div className="table-container" style={{ maxHeight: "500px", overflowY: "auto" }}>
          <table className="custom-table" style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(15, 23, 42, 0.8)" }}>
                <th style={{ width: "50px", textAlign: "center" }}>Sno.</th>
                <th style={{ width: "130px" }}>Purchase Type</th>
                <th style={{ width: "160px" }}>Item Type</th>
                <th style={{ width: "160px" }}>Item Nature</th>
                <th style={{ width: "220px" }}>Category</th>
                <th>Item Name / Model</th>
                <th style={{ width: "90px" }}>Qty</th>
                <th style={{ width: "150px" }}>Required By Date</th>
                <th style={{ width: "180px" }}>Assign To</th>
                <th style={{ width: "50px", textAlign: "center" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  {/* Sno. */}
                  <td style={{ textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>{index + 1}</td>
                  
                  {/* Purchase Type */}
                  <td>
                    <select 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      value={row.type}
                      onChange={e => updateCell(row.id, "type", e.target.value)}
                    >
                      <option value="Import" style={{ background: "#0f172a" }}>Import</option>
                      <option value="Local" style={{ background: "#0f172a" }}>Local</option>
                    </select>
                  </td>

                  {/* Item Type */}
                  <td>
                    <select 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      value={row.itemType || "FG"}
                      onChange={e => updateCell(row.id, "itemType", e.target.value)}
                    >
                      <option value="FG" style={{ background: "#0f172a" }}>Finished Goods (FG)</option>
                      <option value="RM" style={{ background: "#0f172a" }}>Raw Material (RM)</option>
                    </select>
                  </td>

                  {/* Item Nature */}
                  <td>
                    <select 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      value={row.itemNature}
                      onChange={e => updateCell(row.id, "itemNature", e.target.value)}
                    >
                      <option value="Non Consumables" style={{ background: "#0f172a" }}>Non Consumables</option>
                      <option value="Consumables" style={{ background: "#0f172a" }}>Consumables</option>
                    </select>
                  </td>

                  {/* Category */}
                  <td style={{ position: "relative" }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto", textAlign: "left" }}
                      placeholder="Type or Select Category..." 
                      value={row.category}
                      onFocus={(e) => openDropdown(e, row.id, "category")}
                      onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                      onChange={e => {
                        updateCell(row.id, "category", e.target.value);
                        openDropdown(e, row.id, "category");
                      }}
                      onKeyDown={e => {
                        if (activeDropdown?.rowId === row.id && activeDropdown?.field === "category") {
                          const query = (row.category || "").trim().toLowerCase();
                          const rowItemType = (row.itemType || "FG").toUpperCase();
                          const itemsForType = combinedItems.filter(i => !i.itemType || i.itemType.toUpperCase() === rowItemType);
                          const catsForType = Array.from(new Set(itemsForType.map(i => i.category && i.category.trim()).filter(Boolean))).sort();
                          const candidateCats = catsForType.length > 0 ? catsForType : catalogCategories;
                          const filteredCats = candidateCats.filter(cat => !query || cat.toLowerCase().includes(query));

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedIndex(prev => Math.min(prev + 1, Math.max(0, filteredCats.length - 1)));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedIndex(prev => Math.max(prev - 1, 0));
                          } else if (e.key === "Enter" || e.key === "Tab") {
                            if (filteredCats.length > 0) {
                              e.preventDefault();
                              const selectedCat = filteredCats[highlightedIndex] || filteredCats[0];
                              selectCategoryOption(row.id, selectedCat);
                            }
                          }
                        }
                      }}
                      required
                    />
                    {activeDropdown?.rowId === row.id && activeDropdown?.field === "category" && (() => {
                      const query = (row.category || "").trim().toLowerCase();
                      const rowItemType = (row.itemType || "FG").toUpperCase();

                      // Filter items matching row's selected Item Type (FG or RM)
                      const itemsForType = combinedItems.filter(i => 
                        !i.itemType || i.itemType.toUpperCase() === rowItemType
                      );

                      // Get unique categories for this Item Type
                      const catsForType = Array.from(
                        new Set(itemsForType.map(i => i.category && i.category.trim()).filter(Boolean))
                      ).sort();

                      const candidateCats = catsForType.length > 0 ? catsForType : catalogCategories;
                      const filteredCats = candidateCats.filter(cat => !query || cat.toLowerCase().includes(query));

                      return (
                        <div 
                          onMouseDown={(e) => e.preventDefault()}
                          style={{
                            position: "fixed",
                            top: `${dropdownPos.top}px`,
                            left: `${dropdownPos.left}px`,
                            width: `${dropdownPos.width}px`,
                            maxHeight: "220px",
                            overflowY: "auto",
                            background: "#0f172a",
                            border: "1px solid #38bdf8",
                            borderRadius: "8px",
                            boxShadow: "0 12px 30px rgba(0,0,0,0.95)",
                            zIndex: 99999,
                            textAlign: "left"
                          }}
                        >
                          {filteredCats.length > 0 ? (
                            filteredCats.map((cat, idx) => (
                              <div
                                key={cat}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  fontSize: "0.83rem",
                                  color: "#f8fafc",
                                  textAlign: "left",
                                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                                  background: idx === highlightedIndex ? "#1e293b" : "transparent",
                                  borderLeft: idx === highlightedIndex ? "3px solid #38bdf8" : "3px solid transparent"
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectCategoryOption(row.id, cat);
                                }}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                              >
                                {cat}
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "10px 12px", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              {query ? `Custom category "${row.category}"` : `No saved ${row.itemType || "FG"} categories`}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Item Name / Model */}
                  <td style={{ position: "relative" }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ 
                        padding: "4px 8px", 
                        fontSize: "0.85rem", 
                        height: "auto", 
                        textAlign: "left",
                        borderColor: row.model && !isValidModel(row.model, row.itemType) ? "#ef4444" : undefined,
                        boxShadow: row.model && !isValidModel(row.model, row.itemType) ? "0 0 8px rgba(239, 68, 68, 0.4)" : undefined
                      }}
                      placeholder="Type or Select Item Model..." 
                      value={row.model}
                      onFocus={(e) => openDropdown(e, row.id, "model")}
                      onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                      onChange={e => {
                        const selectedName = e.target.value;
                        openDropdown(e, row.id, "model");
                        const matchedItem = combinedItems.find(i => 
                          i.name.toLowerCase() === selectedName.toLowerCase() &&
                          (!row.itemType || !i.itemType || i.itemType.toUpperCase() === (row.itemType || "FG").toUpperCase())
                        );
                        if (matchedItem) {
                          selectModelOption(row.id, matchedItem);
                        } else {
                          updateCell(row.id, "model", selectedName);
                        }
                      }}
                      onKeyDown={e => {
                        if (activeDropdown?.rowId === row.id && activeDropdown?.field === "model") {
                          const modelQuery = (row.model || "").trim().toLowerCase();
                          const catQuery = (row.category || "").trim().toLowerCase();
                          const rowItemType = (row.itemType || "FG").toUpperCase();

                          let candidateItems = combinedItems.filter(i =>
                            !i.itemType || i.itemType.toUpperCase() === rowItemType
                          );
                          if (candidateItems.length === 0) candidateItems = combinedItems;
                          if (catQuery) {
                            const inCat = candidateItems.filter(i => i.category && (i.category.toLowerCase().includes(catQuery) || catQuery.includes(i.category.toLowerCase())));
                            if (inCat.length > 0) candidateItems = inCat;
                          }
                          const filteredModels = candidateItems.filter(i => !modelQuery || i.name.toLowerCase().includes(modelQuery));

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightedIndex(prev => Math.min(prev + 1, Math.max(0, filteredModels.length - 1)));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightedIndex(prev => Math.max(prev - 1, 0));
                          } else if (e.key === "Enter" || e.key === "Tab") {
                            if (filteredModels.length > 0) {
                              e.preventDefault();
                              const selectedItem = filteredModels[highlightedIndex] || filteredModels[0];
                              selectModelOption(row.id, selectedItem);
                            }
                          }
                        }
                      }}
                      required
                    />
                    {row.model && !isValidModel(row.model, row.itemType) && (
                      <div style={{ fontSize: "0.72rem", color: "#fca5a5", marginTop: "2px", fontWeight: 500 }}>
                        Invalid model for {row.itemType || "FG"} (select from dropdown)
                      </div>
                    )}
                    {activeDropdown?.rowId === row.id && activeDropdown?.field === "model" && (() => {
                      const modelQuery = (row.model || "").trim().toLowerCase();
                      const catQuery = (row.category || "").trim().toLowerCase();
                      const rowItemType = (row.itemType || "FG").toUpperCase();

                      // 1. Filter items by row's selected Item Type (FG or RM)
                      let candidateItems = combinedItems.filter(i =>
                        !i.itemType || i.itemType.toUpperCase() === rowItemType
                      );
                      if (candidateItems.length === 0) {
                        candidateItems = combinedItems;
                      }

                      // 2. Filter items by Category (if specified)
                      if (catQuery) {
                        const inCat = candidateItems.filter(i => 
                          i.category && (
                            i.category.toLowerCase().includes(catQuery) ||
                            catQuery.includes(i.category.toLowerCase())
                          )
                        );
                        if (inCat.length > 0) {
                          candidateItems = inCat;
                        }
                      }

                      // 3. Filter items by model name query
                      const filteredModels = candidateItems.filter(i =>
                        !modelQuery || i.name.toLowerCase().includes(modelQuery)
                      );

                      return (
                        <div 
                          onMouseDown={(e) => e.preventDefault()}
                          style={{
                            position: "fixed",
                            top: `${dropdownPos.top}px`,
                            left: `${dropdownPos.left}px`,
                            width: `${dropdownPos.width}px`,
                            maxHeight: "220px",
                            overflowY: "auto",
                            background: "#0f172a",
                            border: "1px solid #38bdf8",
                            borderRadius: "8px",
                            boxShadow: "0 12px 30px rgba(0,0,0,0.95)",
                            zIndex: 99999,
                            textAlign: "left"
                          }}
                        >
                          {filteredModels.length > 0 ? (
                            filteredModels.map((item, idx) => (
                              <div
                                key={item.id || item.name}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  fontSize: "0.83rem",
                                  color: "#f8fafc",
                                  textAlign: "left",
                                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                  background: idx === highlightedIndex ? "#1e293b" : "transparent",
                                  borderLeft: idx === highlightedIndex ? "3px solid #38bdf8" : "3px solid transparent"
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectModelOption(row.id, item);
                                }}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                              >
                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                                {item.category && (
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    {item.category} • {item.itemType || "RM"} ({item.type || "Import"})
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "10px 12px", fontSize: "0.8rem", color: "#fca5a5", fontStyle: "italic" }}>
                              {modelQuery ? `"${row.model}" is invalid for ${row.itemType || "RM"}. Select from dropdown.` : `No ${row.itemType || "RM"} items available`}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Qty */}
                  <td>
                    <input 
                      type="number" 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      placeholder="Qty" 
                      value={row.orderQuantity}
                      onChange={e => updateCell(row.id, "orderQuantity", e.target.value)}
                      min="1"
                      required
                    />
                  </td>

                  {/* Required By Date */}
                  <td>
                    <input 
                      type="date" 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      value={row.requiredByDate}
                      onChange={e => updateCell(row.id, "requiredByDate", e.target.value)}
                      required
                    />
                  </td>

                  {/* Assign To */}
                  <td>
                    <select 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      value={row.purchaserId}
                      onChange={e => updateCell(row.id, "purchaserId", e.target.value)}
                      required
                    >
                      {purchasers.map(p => (
                        <option key={p.id} value={p.id} style={{ background: "#0f172a" }}>
                          Mr. {p.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions (Delete) */}
                  <td style={{ textAlign: "center" }}>
                    <button 
                      type="button" 
                      onClick={() => removeRow(row.id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: "4px", background: "transparent", border: "none" }}
                    >
                      <Trash2 size={14} style={{ color: "var(--danger)" }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid footer controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        
        {/* Add row options */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={addRow} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Add Row
          </button>
          <button onClick={() => addMultipleRows(10)} className="btn btn-secondary btn-sm">
            + Add 10 Rows
          </button>
          <button onClick={() => addMultipleRows(50)} className="btn btn-secondary btn-sm">
            + Add 50 Rows
          </button>
        </div>

        {/* Submit action block */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {/* Status bar resembling the "Good to Go" Excel bar */}
          <div 
            style={{ 
              padding: "10px 24px", 
              borderRadius: "8px", 
              fontWeight: "bold",
              fontSize: "0.9rem",
              textAlign: "center",
              transition: "0.3s all",
              minWidth: "160px",
              background: goodToGo ? "var(--success)" : hasInvalidModel ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.03)",
              color: goodToGo ? "var(--text-dark)" : hasInvalidModel ? "#fca5a5" : "var(--text-muted)",
              boxShadow: goodToGo ? "0 0 15px var(--success-glow)" : "none",
              border: goodToGo ? "1.5px solid transparent" : hasInvalidModel ? "1.5px solid rgba(239, 68, 68, 0.4)" : "1.5px dashed var(--border-glass)"
            }}
          >
            {goodToGo ? "Good to Go" : hasInvalidModel ? "Invalid Item Model" : "Fill All Cells"}
          </div>

          <button 
            disabled={!goodToGo}
            onClick={handleSubmitAll}
            className="btn btn-primary"
            style={{ 
              padding: "12px 30px", 
              fontSize: "1rem", 
              background: goodToGo ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "rgba(255, 255, 255, 0.05)",
              color: goodToGo ? "var(--text-dark)" : "var(--text-muted)",
              borderColor: goodToGo ? "rgba(255, 255, 255, 0.15)" : "var(--border-glass)",
              boxShadow: goodToGo ? "0 4px 15px rgba(245, 158, 11, 0.25)" : "none",
              fontWeight: 700
            }}
          >
            Place Order ({rows.length} Items)
          </button>
        </div>

      </div>
      </>
      )}

      {/* ==================== EXCEL PASTE WIZARD MODAL ==================== */}
      {showPasteModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: "700px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} style={{ color: "var(--primary)" }} /> Copy-Paste from Excel or Google Sheets
              </h3>
              <button onClick={() => setShowPasteModal(false)} className="modal-close"><X size={18} /></button>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "14px", lineHeight: "1.4" }}>
              Copy columns directly from your tracking sheet and paste below. Make sure columns are in this exact order: <br />
              <strong style={{ color: "var(--primary)" }}>Purchase Type | Item Type | Item Nature | Category | Item Name | Qty | Required Date | Assign To</strong>
            </p>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <textarea 
                className="form-control"
                rows="10"
                placeholder="Paste grid rows here... (fields separated by tabs, rows separated by enters)"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: "0.8rem", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowPasteModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handlePasteSubmit} className="btn btn-primary" disabled={!pasteText.trim()}>
                Import & Parse Rows
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
