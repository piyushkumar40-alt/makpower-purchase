import React, { useState } from "react";
import { Layers, Plus, Upload, Trash2, Search, CheckSquare, Square, FileSpreadsheet, Package, AlertCircle, RefreshCw, GitMerge, Edit3, Info, Download, Image, ListPlus, Eye, User } from "lucide-react";
import ItemDetailModal from "./ItemDetailModal";

// Normalize item names for fuzzy duplicate detection (e.g. DC02, DC 02, DC2, DC-2, DC-02 -> DC2)
export function normalizeItemKey(str) {
  if (!str) return "";
  let s = String(str).trim().toUpperCase();
  s = s.replace(/[^A-Z0-9]/g, "");
  s = s.replace(/([A-Z]+)0+(\d+)/g, "$1$2");
  return s;
}

export default function ItemCatalogPanel({
  items = [],
  onAddItem,
  onBulkAddItems,
  onDeleteItems,
  onUpdateItem,
  onMergeItems,
  currentUser = {},
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  cargoCompanies = [],
  onViewItemDetail
}) {
  const isSuperAdmin = currentUser && currentUser.role === "superadmin";

  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const handleItemClick = (item) => {
    if (onViewItemDetail) {
      onViewItemDetail(item);
    } else {
      setSelectedItemDetail(item);
    }
  };
  
  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  // Create item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormMode, setAddFormMode] = useState("single"); // "single" | "multiple"

  // Single Item form fields
  const [newItemId, setNewItemId] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemType, setNewItemType] = useState("RM"); // "RM" | "FG"
  const [newItemNature, setNewItemNature] = useState("Non Consumables");
  const [newItemUnit, setNewItemUnit] = useState("Pcs");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPhoto, setNewItemPhoto] = useState("");
  const [formMsg, setFormMsg] = useState("");

  // Multiple Items form rows
  const [multiRows, setMultiRows] = useState([
    { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" },
    { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" },
    { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" }
  ]);

  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "RM" | "FG"

  // Excel Bulk Upload Modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkParsedItems, setBulkParsedItems] = useState([]);
  const [bulkError, setBulkError] = useState("");
  const [uploadingBulk, setUploadingBulk] = useState(false);

  // Edit Item Modal state (Super Admin only)
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState("RM");
  const [editNature, setEditNature] = useState("Non Consumables");
  const [editUnit, setEditUnit] = useState("Pcs");
  const [editDescription, setEditDescription] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editMsg, setEditMsg] = useState("");

  // Merge Items Modal state (Super Admin only)
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [mergeMsg, setMergeMsg] = useState("");
  const [merging, setMerging] = useState(false);

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

  // Download Empty Template CSV
  const handleDownloadEmptyTemplate = () => {
    const csvContent = [
      "Action,Item ID,Item Name,Category,Item Type (FG/RM),Nature,Unit,Description,Photo URL",
      "NEW,1001,AUDIO-MODEL-01,AUDIO,FG,Consumables,Pcs,Sample Finished Goods Model,https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200",
      "UPDATE,1,AUDIO001,AUDIO,FG,Consumables,Pcs,Updated specifications,https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200",
      "DELETE,2,,,,,,,"
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Makpower_Master_Catalog_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Current Catalog for Bulk Update CSV
  const handleExportAllItemsTemplate = () => {
    if (items.length === 0) {
      alert("No items in catalog to export.");
      return;
    }

    const headers = ["Action", "Item ID", "Item Name", "Category", "Item Type (FG/RM)", "Nature", "Unit", "Description", "Photo URL"];
    const rows = items.map(i => [
      "UPDATE",
      `"${i.id}"`,
      `"${(i.name || "").replace(/"/g, '""')}"`,
      `"${(i.category || "General").replace(/"/g, '""')}"`,
      i.itemType || "RM",
      i.itemNature || "Non Consumables",
      `"${(i.unit || "Pcs").replace(/"/g, '""')}"`,
      `"${(i.description || "").replace(/"/g, '""')}"`,
      `"${(i.photo || "").replace(/"/g, '""')}"`
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Makpower_Catalog_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Multi-Row Form Handlers
  const handleAddMultiRow = () => {
    setMultiRows(prev => [
      ...prev,
      { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" }
    ]);
  };

  const handleRemoveMultiRow = (idx) => {
    setMultiRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMultiRowChange = (idx, field, val) => {
    setMultiRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleCreateMultipleItems = async (e) => {
    e.preventDefault();
    setFormMsg("");

    const validRows = multiRows.filter(r => r.name && r.name.trim());
    if (validRows.length === 0) {
      setFormMsg("Please enter at least one item name.");
      return;
    }

    const existingIds = new Set(items.map(i => String(i.id).trim().toUpperCase()));
    let autoIdCounter = 1;

    const payload = validRows.map(r => {
      let finalId = String(r.id || "").trim().toUpperCase();
      if (!finalId) {
        while (existingIds.has(String(autoIdCounter))) {
          autoIdCounter++;
        }
        finalId = String(autoIdCounter++);
      }
      existingIds.add(finalId);

      return {
        id: finalId,
        name: r.name.trim(),
        category: r.category.trim() || "General",
        itemType: r.itemType || "RM",
        itemNature: r.itemNature || "Non Consumables",
        unit: r.unit.trim() || "Pcs",
        description: r.description.trim(),
        photo: r.photo.trim(),
        currentStock: 0,
        action: "NEW"
      };
    });

    const res = await onBulkAddItems(payload);
    if (res && res.success) {
      setShowAddForm(false);
      setMultiRows([
        { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" },
        { id: "", name: "", category: "", itemType: "RM", itemNature: "Non Consumables", unit: "Pcs", description: "", photo: "" }
      ]);
    } else {
      setFormMsg(`❌ Multi-creation failed: ${res?.error || "Server error."}`);
    }
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

    // Check for fuzzy duplicate item names (e.g. DC02, DC 02, DC2, DC-2, DC-02)
    const targetKey = normalizeItemKey(cleanName);
    const existingMatch = items.find(i => i.id !== cleanId && normalizeItemKey(i.name) === targetKey);
    if (existingMatch) {
      setFormMsg(`⚠️ Item already created! An existing item "${existingMatch.name}" matches "${cleanName}".`);
      return;
    }

    const itemObj = {
      id: cleanId,
      name: cleanName,
      category: newItemCategory.trim() || "General",
      itemType: newItemType,
      itemNature: newItemNature,
      unit: newItemUnit.trim() || "Pcs",
      description: newItemDescription.trim(),
      photo: newItemPhoto.trim(),
      currentStock: 0,
      createdBy: currentUser?.name || "Mr. Anees"
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
    if (!window.confirm(`Are you sure you want to delete item "${name}"?`)) return;
    await onDeleteItems([id]);
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!isSuperAdmin) return;
    if (selectedIds.length === 0) return;
    if (!window.confirm(`⚠️ ARE YOU SURE? This will permanently delete ${selectedIds.length} selected item(s) from the catalog.`)) return;
    await onDeleteItems(selectedIds);
    setSelectedIds([]);
  };

  // Open Edit Item modal (Super Admin only)
  const handleOpenEditModal = (item) => {
    if (!isSuperAdmin) return;
    setEditingItem(item);
    setEditName(item.name || "");
    setEditCategory(item.category || "");
    setEditType(item.itemType || "RM");
    setEditNature(item.itemNature || "Non Consumables");
    setEditUnit(item.unit || "Pcs");
    setEditDescription(item.description || "");
    setEditPhoto(item.photo || "");
    setEditMsg("");
  };

  // Save Edit Item (Super Admin only)
  const handleSaveEditItem = async (e) => {
    e.preventDefault();
    if (!editingItem || !isSuperAdmin) return;
    setEditMsg("");

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditMsg("Item Name is required.");
      return;
    }

    const targetKey = normalizeItemKey(cleanName);
    const match = items.find(i => i.id !== editingItem.id && normalizeItemKey(i.name) === targetKey);
    if (match) {
      setEditMsg(`⚠️ Cannot rename! An item with name "${match.name}" already exists.`);
      return;
    }

    const updated = {
      id: editingItem.id,
      name: cleanName,
      category: editCategory.trim(),
      itemType: editType,
      itemNature: editNature,
      unit: editUnit.trim() || "Pcs",
      description: editDescription.trim(),
      photo: editPhoto.trim()
    };

    if (onUpdateItem) {
      const res = await onUpdateItem(updated);
      if (res && res.success) {
        setEditingItem(null);
      } else {
        setEditMsg(`❌ Update failed: ${res?.error || "Server error"}`);
      }
    }
  };

  // Confirm Merge 2 Items (Super Admin only)
  const handleConfirmMerge = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setMergeMsg("");

    if (!sourceId || !targetId || sourceId === targetId) {
      setMergeMsg("Please select 2 different items to merge.");
      return;
    }

    const sourceItem = items.find(i => i.id === sourceId);
    const targetItem = items.find(i => i.id === targetId);

    if (!sourceItem || !targetItem) {
      setMergeMsg("Selected items not found.");
      return;
    }

    if (!window.confirm(`⚠️ ARE YOU SURE? This will MERGE "${sourceItem.name}" (#${sourceId}) into "${targetItem.name}" (#${targetId}). "${sourceItem.name}" will be deleted and all existing orders will be updated to "${targetItem.name}".`)) {
      return;
    }

    setMerging(true);
    try {
      if (onMergeItems) {
        const res = await onMergeItems(sourceId, targetId);
        if (res && res.success) {
          alert(res.message || `Successfully merged "${sourceItem.name}" into "${targetItem.name}".`);
          setShowMergeModal(false);
          setSourceId("");
          setTargetId("");
        } else {
          setMergeMsg(`Merge failed: ${res?.error || "Server error"}`);
        }
      }
    } catch (err) {
      setMergeMsg(`Merge error: ${err.message}`);
    } finally {
      setMerging(false);
    }
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

        // Ultra-flexible Excel column header matcher (handles truncated headers like 'Item Nam', 'Description.', whitespace, etc.)
        const getRowValue = (rowObj, keywords) => {
          if (!rowObj) return "";
          const rowKeys = Object.keys(rowObj);
          for (const k of rowKeys) {
            const cleanKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            for (const kw of keywords) {
              const cleanKw = kw.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
              if (cleanKey === cleanKw || cleanKey.includes(cleanKw) || cleanKw.includes(cleanKey)) {
                const val = rowObj[k];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                  return String(val).trim();
                }
              }
            }
          }
          return "";
        };

        const existingIds = new Set(items.map(i => String(i.id).trim().toUpperCase()));
        const existingNameKeys = new Map(items.map(i => [normalizeItemKey(i.name), i]));
        const parsed = [];
        let autoIdCounter = 1;

        jsonRows.forEach((row, idx) => {
          const rowKeys = Object.keys(row);
          if (rowKeys.length === 0) return;

          const rawAction = getRowValue(row, ["action", "mode", "status", "operation"]) || "NEW";
          const actionUpper = String(rawAction).trim().toUpperCase();
          const isDeleteAction = actionUpper.includes("DEL") || actionUpper.includes("REM");
          const isUpdateAction = actionUpper.includes("UPD") || actionUpper.includes("EDIT");

          // Look for ID field (Item ID, ID, Sr No, Code, etc.)
          const rawId = getRowValue(row, ["itemid", "id", "srno", "sno", "code", "itemcode", "sr"]);
          
          // Look for Name field (Item Name, Item Nam, Model, Name, Particulars, Title, Product, etc.)
          let rawName = "";
          for (const k of rowKeys) {
            const cleanKey = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
            // Skip ID and Action columns
            if ((cleanKey.includes("id") || cleanKey.includes("srno") || cleanKey.includes("sno") || cleanKey.includes("action") || cleanKey.includes("mode")) && !cleanKey.includes("name") && !cleanKey.includes("nam") && !cleanKey.includes("model")) {
              continue;
            }
            if (cleanKey.includes("name") || cleanKey.includes("nam") || cleanKey.includes("model") || cleanKey.includes("particulars") || cleanKey.includes("title") || cleanKey.includes("product")) {
              const val = row[k];
              if (val !== undefined && val !== null && String(val).trim() !== "") {
                rawName = String(val).trim();
                break;
              }
            }
          }
          
          // Fallback for Name if header is non-standard
          if (!rawName && !isUpdateAction && !isDeleteAction) {
            for (const k of rowKeys) {
              const cleanK = k.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
              if (!cleanK.includes("id") && !cleanK.includes("srno") && !cleanK.includes("sno") && !cleanK.includes("action") && !cleanK.includes("mode") && !cleanK.includes("status")) {
                const val = row[k];
                if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== String(rawId)) {
                  rawName = String(val).trim();
                  break;
                }
              }
            }
          }

          if (!isDeleteAction && !isUpdateAction && !rawName) return; // Skip empty rows for NEW items

          const rawCategory = getRowValue(row, ["category", "cat", "group", "class"]);
          const rawType = getRowValue(row, ["itemtype", "type", "fgrm", "fg", "rm"]);
          const rawNature = getRowValue(row, ["itemnature", "nature", "consumable"]);
          const rawUnit = getRowValue(row, ["unit", "uom", "pcs"]);
          const rawDesc = getRowValue(row, ["desc", "description", "specification", "specs", "notes"]);
          const rawPhoto = getRowValue(row, ["photo", "photourl", "image", "imageurl", "picture", "pic"]);

          let finalType = "";
          if (rawType) {
            const typeStr = String(rawType).trim().toUpperCase();
            finalType = (typeStr.includes("FG") || typeStr.includes("FINISHED")) ? "FG" : "RM";
          } else if (!isUpdateAction) {
            finalType = "RM";
          }

          let finalId = String(rawId || "").trim().toUpperCase();
          if (!finalId && !isUpdateAction && !isDeleteAction) {
            while (existingIds.has(String(autoIdCounter))) {
              autoIdCounter++;
            }
            finalId = String(autoIdCounter++);
          }

          const existingItem = items.find(i => String(i.id).trim().toUpperCase() === finalId);

          parsed.push({
            id: finalId,
            name: rawName ? String(rawName).trim() : (existingItem ? existingItem.name : ""),
            category: rawCategory ? String(rawCategory).trim() : (isUpdateAction ? "" : "General"),
            itemType: finalType || (isUpdateAction ? "" : "RM"),
            itemNature: rawNature ? (String(rawNature).includes("Consumable") ? "Consumables" : "Non Consumables") : (isUpdateAction ? "" : "Non Consumables"),
            unit: rawUnit ? String(rawUnit).trim() : (isUpdateAction ? "" : "Pcs"),
            description: rawDesc ? String(rawDesc).trim() : "",
            photo: rawPhoto ? String(rawPhoto).trim() : "",
            currentStock: 0,
            action: isDeleteAction ? "DELETE" : isUpdateAction ? "UPDATE" : "NEW",
            isDuplicate: !isUpdateAction && !isDeleteAction && Boolean(rawName && existingNameKeys.has(normalizeItemKey(rawName))),
            duplicateMatchName: existingItem ? existingItem.name : null
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
    const validItems = bulkParsedItems.filter(i => !i.isDuplicate || i.action === "UPDATE" || i.action === "DELETE");
    if (validItems.length === 0) {
      setBulkError("⚠️ All items in the uploaded file already exist in the catalog (e.g. DC-02 matched existing DC02). No new items to import.");
      return;
    }

    setUploadingBulk(true);
    try {
      const res = await onBulkAddItems(validItems);
      if (res && res.success) {
        alert(`Bulk action completed successfully! Total processed: ${res.count || validItems.length} (Inserted: ${res.insertedCount || 0}, Updated: ${res.updatedCount || 0}, Deleted: ${res.deletedCount || 0}, Skipped: ${res.skippedCount || 0})`);
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

  // Filter items by search, category & type
  const categories = ["all", ...new Set(items.map(i => i.category).filter(Boolean))];
  const filteredItems = items.filter(i => {
    const matchesCategory = categoryFilter === "all" || i.category === categoryFilter;
    const matchesType = typeFilter === "all" || (i.itemType || "RM") === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || String(i.id).toLowerCase().includes(q) || (i.name && i.name.toLowerCase().includes(q)) || (i.category && i.category.toLowerCase().includes(q));
    return matchesCategory && matchesType && matchesSearch;
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
            System Admin item repository. Manage Item IDs (1, 2, 3...), bulk upload via Excel, Item Types (FG/RM), and categories.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button 
              onClick={handleDownloadEmptyTemplate}
              className="btn btn-secondary btn-sm"
              title="Download Blank CSV Template with Action (NEW/UPDATE/DELETE) columns"
              style={{ fontSize: "0.8rem", borderColor: "rgba(255,255,255,0.2)" }}
            >
              <Download size={14} /> Empty Template
            </button>
            <button 
              onClick={handleExportAllItemsTemplate}
              className="btn btn-secondary btn-sm"
              title="Export all current catalog items into CSV prefilled with UPDATE action for bulk editing"
              style={{ fontSize: "0.8rem", borderColor: "rgba(255,255,255,0.2)" }}
            >
              <Download size={14} /> Export All Items
            </button>
          </div>

          {isSuperAdmin && (
            <button 
              onClick={() => { setShowMergeModal(true); setMergeMsg(""); setSourceId(""); setTargetId(""); }}
              className="btn btn-secondary"
              style={{ fontSize: "0.85rem", borderColor: "#818cf8", color: "#c7d2fe" }}
            >
              <GitMerge size={16} style={{ color: "#818cf8" }} /> Merge 2 Items
            </button>
          )}

          {isSuperAdmin && selectedIds.length > 0 && (
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

      {/* Catalog Database Switcher Tabs: FG Database vs RM Database */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, marginRight: "4px" }}>
          Database Mode:
        </span>
        <button 
          onClick={() => setTypeFilter("FG")}
          className={`btn ${typeFilter === "FG" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 18px", fontSize: "0.88rem", fontWeight: 700, borderRadius: "8px", background: typeFilter === "FG" ? "linear-gradient(135deg, #10b981, #059669)" : undefined, borderColor: "#10b981" }}
        >
          📦 Finished Goods Database (FG) ({items.filter(i => i.itemType === "FG").length})
        </button>

        <button 
          onClick={() => setTypeFilter("RM")}
          className={`btn ${typeFilter === "RM" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 18px", fontSize: "0.88rem", fontWeight: 700, borderRadius: "8px", background: typeFilter === "RM" ? "linear-gradient(135deg, #6366f1, #4f46e5)" : undefined, borderColor: "#6366f1" }}
        >
          🔩 Raw Materials Database (RM) ({items.filter(i => (i.itemType || "RM") !== "FG").length})
        </button>

        <button 
          onClick={() => setTypeFilter("all")}
          className={`btn ${typeFilter === "all" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 18px", fontSize: "0.88rem", fontWeight: 700, borderRadius: "8px" }}
        >
          🌐 All Combined Items ({items.length})
        </button>
      </div>

      {/* Purchaser Info Strip */}
      {!isSuperAdmin && (
        <div className="alert-strip alert-info" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Info size={18} />
          <span style={{ fontSize: "0.85rem" }}>
            <strong>Purchaser Access:</strong> You can create new catalog items with your ID prefix (e.g. <strong>{((currentUser.name || "Purchaser").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "AN")}-#</strong>). Existing item editing, merging, and deletion are restricted to System Admin.
          </span>
        </div>
      )}

      {/* Edit Item Modal (Super Admin only) */}
      {editingItem && isSuperAdmin && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px", border: "1px solid #38bdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
              <Edit3 size={18} /> Edit Master Item Name & Details
            </h3>
            <button onClick={() => setEditingItem(null)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>

          {editMsg && (
            <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {editMsg}
            </div>
          )}

          <form onSubmit={handleSaveEditItem} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item Name / Model*</label>
              <input 
                type="text" 
                className="form-control" 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required 
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <input 
                type="text" 
                className="form-control" 
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Item Type (FG/RM)</label>
              <select className="form-control" value={editType} onChange={e => setEditType(e.target.value)}>
                <option value="RM">RM (Raw Material)</option>
                <option value="FG">FG (Finished Goods)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nature</label>
              <select className="form-control" value={editNature} onChange={e => setEditNature(e.target.value)}>
                <option value="Non Consumables">Non Consumables</option>
                <option value="Consumables">Consumables</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Photo / Public Image URL</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="https://example.com/photo.jpg"
                value={editPhoto}
                onChange={e => setEditPhoto(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
              <label className="form-label">Description / Specifications</label>
              <input 
                type="text" 
                className="form-control" 
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button type="button" onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Merge 2 Items Modal (Super Admin only) */}
      {showMergeModal && isSuperAdmin && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px", border: "1px solid #818cf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "#c7d2fe", display: "flex", alignItems: "center", gap: "8px" }}>
              <GitMerge size={20} /> Merge 2 Master Items into 1
            </h3>
            <button onClick={() => setShowMergeModal(false)} className="btn btn-secondary btn-sm">Close</button>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
            Select a <strong>Source Item</strong> (to delete & merge) and a <strong>Target Item</strong> (to keep). All existing purchase orders referencing the source item will be updated to point to the target item name automatically.
          </p>

          {mergeMsg && (
            <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {mergeMsg}
            </div>
          )}

          <form onSubmit={handleConfirmMerge} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ color: "var(--danger)" }}>1. Type or Select Item to MERGE & DELETE (Source)*</label>
              <input 
                type="text" 
                list="list-merge-source"
                className="form-control" 
                placeholder="Type or select Source Item..." 
                value={items.find(i => i.id === sourceId)?.name || ""}
                onChange={e => {
                  const val = e.target.value;
                  const matched = items.find(i => i.name.toLowerCase() === val.toLowerCase());
                  setSourceId(matched ? matched.id : "");
                }}
                required
              />
              <datalist id="list-merge-source">
                {items.map(i => (
                  <option key={i.id} value={i.name}>
                    {i.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ color: "#34d399" }}>2. Type or Select Master Item to KEEP (Target)*</label>
              <input 
                type="text" 
                list="list-merge-target"
                className="form-control" 
                placeholder="Type or select Target Item..." 
                value={items.find(i => i.id === targetId)?.name || ""}
                onChange={e => {
                  const val = e.target.value;
                  const matched = items.filter(i => i.id !== sourceId).find(i => i.name.toLowerCase() === val.toLowerCase());
                  setTargetId(matched ? matched.id : "");
                }}
                required
              />
              <datalist id="list-merge-target">
                {items.filter(i => i.id !== sourceId).map(i => (
                  <option key={i.id} value={i.name}>
                    {i.name}
                  </option>
                ))}
              </datalist>
            </div>

            {sourceId && targetId && sourceId !== targetId && (
              <div style={{ gridColumn: "1 / -1", padding: "14px 18px", background: "rgba(129, 140, 248, 0.12)", border: "1px solid rgba(129, 140, 248, 0.3)", borderRadius: "8px", fontSize: "0.88rem" }}>
                <strong>Merge Preview:</strong> Item <code>"{items.find(i => i.id === sourceId)?.name}"</code> will be combined into <code>"{items.find(i => i.id === targetId)?.name}"</code>. All purchase order records pointing to "{items.find(i => i.id === sourceId)?.name}" will update to "{items.find(i => i.id === targetId)?.name}".
              </div>
            )}

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setShowMergeModal(false)} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={merging || !sourceId || !targetId} className="btn btn-primary" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                {merging ? "Merging Items..." : "Confirm & Merge Items"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Item Modal / Inline Form */}
      {showAddForm && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px", border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} /> Create Master Items
              </h3>
              <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "6px" }}>
                <button 
                  type="button" 
                  onClick={() => setAddFormMode("single")}
                  className={`btn btn-sm ${addFormMode === "single" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  <Plus size={14} /> Single Item
                </button>
                <button 
                  type="button" 
                  onClick={() => setAddFormMode("multiple")}
                  className={`btn btn-sm ${addFormMode === "multiple" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  <ListPlus size={14} /> Create Multiple at Once
                </button>
              </div>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>

          {formMsg && (
            <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {formMsg}
            </div>
          )}

          {addFormMode === "single" ? (
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
                  placeholder="e.g. AUDIO001"
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
                  placeholder="e.g. AUDIO, NECKBAND"
                  value={newItemCategory}
                  onChange={e => setNewItemCategory(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Item Type (FG/RM)</label>
                <select 
                  className="form-control"
                  value={newItemType}
                  onChange={e => setNewItemType(e.target.value)}
                >
                  <option value="RM">RM (Raw Material)</option>
                  <option value="FG">FG (Finished Goods)</option>
                </select>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Photo / Public Image URL</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="https://example.com/photo.jpg"
                  value={newItemPhoto}
                  onChange={e => setNewItemPhoto(e.target.value)}
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
          ) : (
            /* Multi-Row Item Form */
            <form onSubmit={handleCreateMultipleItems}>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                Fill out multiple item rows below to create them all at once into the catalog:
              </p>

              <div className="table-container" style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
                <table className="custom-table" style={{ fontSize: "0.83rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>Item ID</th>
                      <th style={{ minWidth: "160px" }}>Item Name / Model*</th>
                      <th style={{ width: "120px" }}>Category</th>
                      <th style={{ width: "90px" }}>Type</th>
                      <th style={{ width: "130px" }}>Nature</th>
                      <th style={{ width: "80px" }}>Unit</th>
                      <th style={{ minWidth: "140px" }}>Photo URL</th>
                      <th style={{ width: "50px", textAlign: "center" }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiRows.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "4px 8px", fontSize: "0.82rem" }} 
                            placeholder="Auto ID" 
                            value={row.id} 
                            onChange={e => handleMultiRowChange(idx, "id", e.target.value)} 
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "4px 8px", fontSize: "0.82rem" }} 
                            placeholder="Item Name *" 
                            value={row.name} 
                            onChange={e => handleMultiRowChange(idx, "name", e.target.value)} 
                            required 
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: "4px 8px", fontSize: "0.82rem" }} 
                            placeholder="Category" 
                            value={row.category} 
                            onChange={e => handleMultiRowChange(idx, "category", e.target.value)} 
                          />
                        </td>
                        <td>
                          <select className="form-control" style={{ padding: "4px 6px", fontSize: "0.82rem" }} value={row.itemType} onChange={e => handleMultiRowChange(idx, "itemType", e.target.value)}>
                            <option value="RM">RM</option>
                            <option value="FG">FG</option>
                          </select>
                        </td>
                        <td>
                          <select className="form-control" style={{ padding: "4px 6px", fontSize: "0.82rem" }} value={row.itemNature} onChange={e => handleMultiRowChange(idx, "itemNature", e.target.value)}>
                            <option value="Non Consumables">Non Consumables</option>
                            <option value="Consumables">Consumables</option>
                          </select>
                        </td>
                        <td>
                          <input type="text" className="form-control" style={{ padding: "4px 8px", fontSize: "0.82rem" }} placeholder="Unit" value={row.unit} onChange={e => handleMultiRowChange(idx, "unit", e.target.value)} />
                        </td>
                        <td>
                          <input type="text" className="form-control" style={{ padding: "4px 8px", fontSize: "0.82rem" }} placeholder="Photo URL" value={row.photo} onChange={e => handleMultiRowChange(idx, "photo", e.target.value)} />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" onClick={() => handleRemoveMultiRow(idx)} className="btn btn-sm btn-danger" title="Remove Row" style={{ padding: "4px 8px" }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" onClick={handleAddMultiRow} className="btn btn-secondary btn-sm">
                  <Plus size={14} /> Add Another Row
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    Save All {multiRows.filter(r => r.name.trim()).length} Items
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Excel Bulk Upload Modal */}
      {showBulkModal && (
        <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px", border: "1px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", color: "#34d399", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileSpreadsheet size={20} /> Excel / CSV Bulk Item Import
            </h3>
            <button onClick={() => setShowBulkModal(false)} className="btn btn-secondary btn-sm">Close</button>
          </div>

          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
            Select an Excel file (<code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>). Sheet headers should include: <strong>Item ID</strong>, <strong>Item Name</strong>, <strong>Category</strong>, <strong>Item Type (FG/RM)</strong>, <strong>Nature</strong>, <strong>Unit</strong>, <strong>Description</strong>.
          </p>

          {bulkError && (
            <div className="alert-strip alert-danger" style={{ marginBottom: "16px" }}>
              <AlertCircle size={16} /> {bulkError}
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
              className="form-control"
              style={{ cursor: "pointer" }}
            />
          </div>

          {bulkParsedItems.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.95rem", marginBottom: "10px", color: "var(--primary)" }}>
                Parsed Preview ({bulkParsedItems.length} items ready for bulk action):
              </h4>
              <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "16px" }}>
                <table className="custom-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "65px" }}>Action</th>
                      <th style={{ width: "40px", textAlign: "center" }}>Img</th>
                      <th>ID</th>
                      <th>Name / Model</th>
                      <th>Category</th>
                      <th>Type (FG/RM)</th>
                      <th>Nature</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkParsedItems.map((pi, idx) => (
                      <tr key={idx} style={{ opacity: pi.isDuplicate && pi.action === "NEW" ? 0.65 : 1 }}>
                        <td>
                          <span className={`badge ${pi.action === "DELETE" ? "badge-danger" : pi.action === "UPDATE" ? "badge-secondary" : "badge-success"}`} style={{ fontSize: "0.68rem", textTransform: "uppercase" }}>
                            {pi.action}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {pi.photo ? (
                            <img src={pi.photo} alt="" style={{ width: "22px", height: "22px", borderRadius: "4px", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                          ) : (
                            <Package size={14} style={{ color: "var(--text-muted)" }} />
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--primary)" }}>{pi.id}</td>
                        <td style={{ fontWeight: 600 }}>
                          {pi.name}
                          {pi.isDuplicate && pi.action === "NEW" && (
                            <span className="badge badge-danger" style={{ marginLeft: "8px", fontSize: "0.7rem", textTransform: "none" }}>
                              Already Exists (matches "{pi.duplicateMatchName}") — Skipped
                            </span>
                          )}
                        </td>
                        <td>{pi.category || "General"}</td>
                        <td>
                          <span className={`badge ${pi.itemType === "FG" ? "badge-success" : "badge-secondary"}`}>
                            {pi.itemType || "RM"}
                          </span>
                        </td>
                        <td>{pi.itemNature}</td>
                        <td>{pi.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowBulkModal(false)} className="btn btn-secondary">Cancel</button>
                <button 
                  type="button" 
                  onClick={handleConfirmBulkUpload}
                  disabled={bulkParsedItems.length === 0 || uploadingBulk}
                  className="btn btn-success"
                >
                  {uploadingBulk ? "Processing Bulk Actions..." : `Execute Bulk Actions on ${bulkParsedItems.length} Items`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search, Category & Type Filter Bar */}
      <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text"
            className="form-control"
            placeholder="Search by Item Name, Category, or Specifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Type:</label>
          <select 
            className="form-control"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ width: "auto", minWidth: "130px" }}
          >
            <option value="all">All Types (FG/RM)</option>
            <option value="RM">RM (Raw Material)</option>
            <option value="FG">FG (Finished Goods)</option>
          </select>
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
        <div className="table-container" style={{ maxHeight: "65vh", overflowY: "auto", overflowX: "auto" }}>
          <table className="custom-table">
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input 
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th style={{ width: "50px", textAlign: "center" }}>Image</th>
                {isSuperAdmin && <th style={{ width: "90px" }}>Item ID</th>}
                <th>Name / Model</th>
                <th>Category</th>
                <th>Type (FG/RM)</th>
                <th>Nature</th>
                <th>Unit (UOM)</th>
                <th>Description / Specs</th>
                {isSuperAdmin && <th>Created By</th>}
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? "11" : "9"} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    {searchQuery || categoryFilter !== "all" || typeFilter !== "all"
                      ? "No catalog items match your search filter."
                      : "Master Item Catalog is empty. Click 'Add Master Item' or 'Excel Bulk Upload' above to populate items!"}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  const isFG = item.itemType === "FG";

                  // Resolve Creator Name (e.g. Mr. Anees vs Super Admin)
                  const creatorName = (() => {
                    // 1. If explicit createdBy exists and is a valid purchaser name (not Super Admin), use it
                    if (item.createdBy && !["Super Admin", "u-admin", "System Admin", "Admin"].includes(item.createdBy.trim())) return item.createdBy;
                    if (item.entryBy && !["Super Admin", "u-admin", "System Admin", "Admin"].includes(item.entryBy.trim())) return item.entryBy;

                    // 2. Check item ID prefix (e.g. "AN-1" -> "AN" -> "Mr. Anees")
                    if (item.id && typeof item.id === "string") {
                      const idUpper = item.id.toUpperCase().trim();
                      for (const u of (users || [])) {
                        const prefix = (u.name || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
                        if (prefix && (idUpper.startsWith(`${prefix}-`) || idUpper.startsWith(prefix))) {
                          return u.name;
                        }
                      }
                    }

                    // 3. Search purchase requests for creator of this item model
                    const reqMatch = (requests || []).find(r => r.model && r.model.toLowerCase().trim() === (item.name || "").toLowerCase().trim());
                    if (reqMatch) {
                      const purchaserObj = (users || []).find(u => u.id === reqMatch.purchaserId);
                      if (purchaserObj) return purchaserObj.name;
                      if (reqMatch.entryBy && !["Super Admin", "u-admin", "Guest"].includes(reqMatch.entryBy)) return reqMatch.entryBy;
                    }

                    return item.createdBy || item.entryBy || "Mr. Anees";
                  })();

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
                      <td style={{ textAlign: "center", cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        {item.photo ? (
                          <img 
                            src={item.photo} 
                            alt={item.name} 
                            style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border-color)", margin: "0 auto" }} 
                            onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                          />
                        ) : (
                          <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                            <Package size={16} style={{ color: "var(--primary)" }} />
                          </div>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td style={{ fontWeight: 700, color: "var(--primary)", cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                          #{item.id}
                        </td>
                      )}
                      <td style={{ fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        {item.name}
                      </td>
                      <td style={{ cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        <span className="badge badge-secondary" style={{ fontSize: "0.75rem" }}>
                          {item.category || "General"}
                        </span>
                      </td>
                      <td style={{ cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        <span className="badge" style={{ fontSize: "0.75rem", fontWeight: 700, background: isFG ? "rgba(16, 185, 129, 0.18)" : "rgba(99, 102, 241, 0.18)", color: isFG ? "#34d399" : "#a5b4fc", border: `1px solid ${isFG ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)"}` }}>
                          {isFG ? "FG (Finished)" : "RM (Raw Material)"}
                        </span>
                      </td>
                      <td style={{ cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        <span className={`badge ${item.itemNature === "Consumables" ? "badge-warning" : "badge-approved"}`} style={{ fontSize: "0.75rem" }}>
                          {item.itemNature || "Non Consumables"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        {item.unit || "Pcs"}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "250px", cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                        {item.description || "-"}
                      </td>
                      {isSuperAdmin && (
                        <td style={{ cursor: "pointer" }} onClick={() => handleItemClick(item)}>
                          <span className="badge badge-secondary" style={{ fontSize: "0.75rem", textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <User size={10} />
                            {creatorName}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <button 
                            onClick={() => handleItemClick(item)}
                            className="btn btn-sm btn-primary"
                            title="View Full Item Details, History & Tracking"
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          >
                            <Eye size={14} /> View
                          </button>

                          {isSuperAdmin && (
                            <>
                              <button 
                                onClick={() => handleOpenEditModal(item)}
                                className="btn btn-sm btn-secondary"
                                title="Edit Item Name / Details"
                                style={{ padding: "4px 8px" }}
                              >
                                <Edit3 size={14} />
                              </button>

                              <button 
                                onClick={() => handleDeleteSingle(item.id, item.name)}
                                className="btn btn-sm btn-danger"
                                title="Delete Item"
                                style={{ padding: "4px 8px" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Detail Modal Popup */}
      {selectedItemDetail && (
        <ItemDetailModal 
          item={selectedItemDetail}
          onClose={() => setSelectedItemDetail(null)}
          requests={requests}
          cargos={cargos}
          vendors={vendors}
          users={users}
          cargoCompanies={cargoCompanies}
        />
      )}

    </div>
  );
}
