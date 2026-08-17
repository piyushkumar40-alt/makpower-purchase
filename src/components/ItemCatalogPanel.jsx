import React, { useState } from "react";
import { Layers, Plus, Upload, Trash2, Search, CheckSquare, Square, FileSpreadsheet, Package, AlertCircle, RefreshCw } from "lucide-react";

export default function ItemCatalogPanel({
  items = [],
  onAddItem,
  onBulkAddItems,
  onDeleteItems,
  currentUser = {}
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  // Create single item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemId, setNewItemId] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemNature, setNewItemNature] = useState("Non Consumables");
  const [newItemUnit, setNewItemUnit] = useState("Pcs");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPhoto, setNewItemPhoto] = useState("");
  const [formMsg, setFormMsg] = useState("");

  // Excel Bulk Upload Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkParsedItems, setBulkParsedItems] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [uploadingBulk, setUploadingBulk] = useState(false);

  // Auto-generate next unique ID when opening add form
  const handleOpenAddForm = () => {
    const existingIds = new Set(items.map(i => String(i.id).trim().toUpperCase()));
    let generatedId = "";

    const isPurchaser = currentUser && currentUser.role === "purchaser";
    if (isPurchaser) {
      // Purchaser ID format: First 2 letters of purchaser name + "-" + number (e.g. AN-1, AN-2)
      const prefix = (currentUser.name || "Purchaser").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "AN";
      let maxNum = 0;
      items.forEach(i => {
        const idStr = String(i.id).trim().toUpperCase();
        if (idStr.startsWith(prefix)) {
          const numPart = parseInt(idStr.replace(/[^\d]/g, ""), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      });
      let nextNum = maxNum + 1;
      let candidate = `${prefix}-${nextNum}`;
      while (existingIds.has(candidate.toUpperCase())) {
        nextNum++;
        candidate = `${prefix}-${nextNum}`;
      }
      generatedId = candidate;
    } else {
      // Admin ID format: Numeric sequence 1, 2, 3...
      const numericIds = items
        .map(i => parseInt(String(i.id).replace(/\D/g, ""), 10))
        .filter(n => !isNaN(n));
      let nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
      while (existingIds.has(String(nextNum))) {
        nextNum++;
      }
      generatedId = String(nextNum);
    }

    setNewItemId(generatedId);
    setFormMsg("");
    setShowAddForm(true);
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    setFormMsg("");

    const cleanId = newItemId.trim();
    const cleanName = newItemName.trim();

    if (!cleanId || !cleanName) {
      setFormMsg("Item ID and Item Name are required.");
      return;
    }

    const itemObj = {
      id: cleanId,
      name: cleanName,
      category: newItemCategory.trim() || "General",
      itemNature: newItemNature,
      unit: newItemUnit.trim() || "Pcs",
      description: newItemDescription.trim(),
      photo: newItemPhoto.trim(),
      currentStock: 0
    };

    const res = await onAddItem(itemObj);
    if (res && res.success) {
      setNewItemName("");
      setNewItemCategory("");
      setNewItemDescription("");
      setNewItemPhoto("");
      setShowAddForm(false);
    } else {
      setFormMsg(`❌ Creation failed: ${res?.error || "ID already exists or server error."}`);
    }
  };

  // Single Item Delete
  const handleDeleteSingle = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete item "${name}" (ID: ${id})?`)) return;
    await onDeleteItems([id]);
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`⚠️ ARE YOU SURE? This will permanently delete ${selectedIds.length} selected item(s) from the catalog.`)) return;
    await onDeleteItems(selectedIds);
    setSelectedIds([]);
  };

  // Checkbox toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectId = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Excel / CSV File Upload Handler using SheetJS
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkError("");
    setBulkParsedItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        let jsonRows = [];

        if (window.XLSX) {
          const workbook = window.XLSX.read(data, { type: "binary" });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          jsonRows = window.XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        } else {
          // Basic CSV fallback parser if SheetJS CDN is offline
          const text = new TextDecoder().decode(new Uint8Array(data));
          const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) throw new Error("CSV file is empty or missing headers.");
          const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
          jsonRows = lines.slice(1).map(line => {
            const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = cols[idx] || ""; });
            return obj;
          });
        }

        if (!jsonRows || jsonRows.length === 0) {
          setBulkError("Uploaded file contains no rows.");
          return;
        }

        // Map columns intelligently (supports headers like: ID, Item ID, Name, Item Name, Model, Category, Nature, Unit, Description)
        const existingIds = new Set(items.map(i => String(i.id).trim().toUpperCase()));
        const parsed = [];
        let autoIdCounter = 1;

        jsonRows.forEach((row, idx) => {
          // Look for ID field
          const rawId = row["ID"] || row["Item ID"] || row["id"] || row["itemId"] || row["Item_ID"] || row["Sr No"] || row["S.No"];
          const rawName = row["Name"] || row["Item Name"] || row["Model"] || row["name"] || row["Item"];
          const rawCategory = row["Category"] || row["category"] || row["Group"] || "General";
          const rawNature = row["Nature"] || row["Item Nature"] || row["itemNature"] || "Non Consumables";
          const rawUnit = row["Unit"] || row["UOM"] || row["unit"] || "Pcs";
          const rawDesc = row["Description"] || row["Notes"] || row["Specs"] || row["description"] || "";

          if (!rawName) return; // Skip empty rows

          let finalId = String(rawId || "").trim().toUpperCase();

          if (!finalId) {
            while (existingIds.has(String(autoIdCounter))) {
              autoIdCounter++;
            }
            finalId = String(autoIdCounter++);
          } else if (existingIds.has(finalId)) {
            // Deduplicate ID if already taken in system or sheet!
            let suffix = 1;
            let candidate = `${finalId}-${suffix}`;
            while (existingIds.has(candidate)) {
              suffix++;
              candidate = `${finalId}-${suffix}`;
            }
            finalId = candidate;
          }

          existingIds.add(finalId);

          parsed.push({
            id: finalId,
            name: String(rawName).trim(),
            category: String(rawCategory).trim(),
            itemNature: String(rawNature).includes("Consumable") ? "Consumables" : "Non Consumables",
            unit: String(rawUnit).trim() || "Pcs",
            description: String(rawDesc).trim(),
            currentStock: 0
          });
        });

        if (parsed.length === 0) {
          setBulkError("Could not parse any valid item rows. Ensure columns 'Item ID' and 'Item Name' are present.");
          return;
        }

        setBulkParsedItems(parsed);
      } catch (err) {
        console.error("Excel parse error:", err);
        setBulkError(`Error reading Excel file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkUpload = async () => {
    if (bulkParsedItems.length === 0) return;
    setUploadingBulk(true);
    try {
      const res = await onBulkAddItems(bulkParsedItems);
      if (res && res.success) {
        setShowBulkModal(false);
        setBulkParsedItems([]);
      } else {
        setBulkError(`Bulk import failed: ${res?.error || "Server error"}`);
      }
    } catch (err) {
      setBulkError(`Bulk import error: ${err.message}`);
    } finally {
      setUploadingBulk(false);
    }
  };

  // Filter items by search & category
  const categories = ["all", ...new Set(items.map(i => i.category).filter(Boolean))];
  const filteredItems = items.filter(i => {
    const matchesCategory = categoryFilter === "all" || i.category === categoryFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || String(i.id).toLowerCase().includes(q) || (i.name && i.name.toLowerCase().includes(q)) || (i.category && i.category.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="card-fade-in">
      
      {/* Top Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <Package size={24} style={{ color: "var(--primary)" }} /> Master Item Catalog
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
            System Admin item repository. Manage Item IDs (1, 2, 3...), bulk upload via Excel, and item definitions.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="btn btn-danger"
              style={{ fontSize: "0.85rem" }}
            >
              <Trash2 size={16} /> Delete Selected ({selectedIds.length})
            </button>
          )}

          <button 
            onClick={() => { setShowBulkModal(true); setBulkParsedItems([]); setBulkError(""); }}
            className="btn btn-secondary"
            style={{ fontSize: "0.85rem", borderColor: "#10b981", color: "#a7f3d0" }}
          >
            <FileSpreadsheet size={16} style={{ color: "#10b981" }} /> Excel Bulk Upload
          </button>

          <button 
            onClick={handleOpenAddForm}
            className="btn btn-primary"
            style={{ fontSize: "0.85rem" }}
          >
            <Plus size={16} /> Add Master Item
          </button>
        </div>
      </div>

      {/* Add Item Modal / Inline Form */}
      {showAddForm && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px", border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={18} /> Create New Master Item
            </h3>
            <button onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>

          {formMsg && (
            <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {formMsg}
            </div>
          )}

          <form onSubmit={handleCreateItem} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item ID (Numeric / String)*</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. 1, 2, 3..."
                value={newItemId}
                onChange={e => setNewItemId(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item Name / Model*</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. XM-900 Transducer"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. Electronics, Hardware"
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nature</label>
              <select 
                className="form-control"
                value={newItemNature}
                onChange={e => setNewItemNature(e.target.value)}
              >
                <option value="Non Consumables">Non Consumables</option>
                <option value="Consumables">Consumables</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unit (UOM)</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Pcs, Set, Kg, Box"
                value={newItemUnit}
                onChange={e => setNewItemUnit(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
              <label className="form-label">Description / Specifications</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Detailed technical specifications..."
                value={newItemDescription}
                onChange={e => setNewItemDescription(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Save Master Item</button>
            </div>
          </form>
        </div>
      )}

      {/* Excel Bulk Upload Modal */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "700px" }}>
            <h3 style={{ fontSize: "1.3rem", color: "var(--primary)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileSpreadsheet size={22} style={{ color: "#10b981" }} /> Excel Bulk Import Master Items
            </h3>
            
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Upload an Excel file (<code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>) containing columns like <strong>ID</strong>, <strong>Item Name</strong>, <strong>Category</strong>, <strong>Nature</strong>, and <strong>Unit</strong>.
            </p>

            {bulkError && (
              <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
                <AlertCircle size={16} /> {bulkError}
              </div>
            )}

            <div style={{ border: "2px dashed var(--border-glass)", borderRadius: "12px", padding: "24px", textAlign: "center", marginBottom: "20px", background: "rgba(0,0,0,0.1)" }}>
              <Upload size={32} style={{ color: "var(--primary)", marginBottom: "10px" }} />
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Select Excel or CSV File</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>Supported formats: .xlsx, .xls, .csv</div>
              
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
                id="excel-file-input"
              />
              <label htmlFor="excel-file-input" className="btn btn-primary" style={{ cursor: "pointer" }}>
                Browse Excel File
              </label>
            </div>

            {bulkParsedItems.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#10b981" }}>
                    ✅ Successfully parsed {bulkParsedItems.length} items from file!
                  </span>
                </div>

                <div className="table-container" style={{ maxHeight: "220px", overflowY: "auto" }}>
                  <table className="custom-table" style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Name / Model</th>
                        <th>Category</th>
                        <th>Nature</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkParsedItems.slice(0, 15).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: "var(--primary)" }}>{item.id}</td>
                          <td>{item.name}</td>
                          <td>{item.category}</td>
                          <td>{item.itemNature}</td>
                          <td>{item.unit}</td>
                        </tr>
                      ))}
                      {bulkParsedItems.length > 15 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                            + {bulkParsedItems.length - 15} more items...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border-glass)", paddingTop: "16px" }}>
              <button 
                onClick={() => { setShowBulkModal(false); setBulkParsedItems([]); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              
              <button 
                onClick={handleConfirmBulkUpload}
                disabled={bulkParsedItems.length === 0 || uploadingBulk}
                className="btn btn-success"
              >
                {uploadingBulk ? "Importing Items..." : `Import ${bulkParsedItems.length} Items to Catalog`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 250px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text"
            className="form-control"
            placeholder="Search by Item ID (1, 2, 3...), Name, or Category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Category:</label>
          <select 
            className="form-control"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: "auto", minWidth: "140px" }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "auto" }}>
          Total Catalog Items: <strong>{filteredItems.length}</strong>
        </div>
      </div>

      {/* Master Items Table */}
      <div className="glass-panel" style={{ padding: "4px" }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input 
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th>Item ID</th>
                <th>Name / Model</th>
                <th>Category</th>
                <th>Nature</th>
                <th>Unit (UOM)</th>
                <th>Description / Specs</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    {searchQuery || categoryFilter !== "all" 
                      ? "No catalog items match your search filter."
                      : "Master Item Catalog is empty. Click 'Add Master Item' or 'Excel Bulk Upload' above to populate items!"}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr key={item.id} className={isSelected ? "planner-row-selected" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(item.id)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.9rem" }}>
                        #{item.id}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {item.name}
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: "0.75rem" }}>
                          {item.category || "General"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.itemNature === "Consumables" ? "badge-warning" : "badge-approved"}`} style={{ fontSize: "0.75rem" }}>
                          {item.itemNature || "Non Consumables"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {item.unit || "Pcs"}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "250px" }}>
                        {item.description || "-"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button 
                          onClick={() => handleDeleteSingle(item.id, item.name)}
                          className="btn btn-sm btn-danger"
                          title="Delete Item"
                          style={{ padding: "4px 8px" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
