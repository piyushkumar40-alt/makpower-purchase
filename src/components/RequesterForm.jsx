import React, { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Clipboard, ShieldAlert, Sparkles, X } from "lucide-react";

export default function RequesterForm({ onAddRequests, purchasers, vendors, currentUser }) {
  // Determine default purchaser based on logged-in user
  const defaultPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");

  // Spreadsheet rows state
  const [rows, setRows] = useState([
    {
      id: 1,
      type: "Import",
      itemNature: "Non Consumables",
      category: "",
      model: "",
      orderQuantity: "",
      requiredByDate: "",
      purchaserId: defaultPurchaserId
    }
  ]);

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
      setEntryBy(currentUser.name);
      if (currentUser.role === "purchaser") {
        setRows(prev => prev.map(r => ({ ...r, purchaserId: currentUser.id })));
      }
    }
  }, [currentUser]);

  // Add row
  const addRow = () => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    setRows(prev => [
      ...prev,
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
  };

  // Add multiple rows
  const addMultipleRows = (count) => {
    const rowPurchaserId = currentUser?.role === "purchaser" ? currentUser.id : (purchasers[0]?.id || "");
    const newRows = [];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: Date.now() + i,
        type: "Import",
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
    const match = purchasers.find(p => p.name.toLowerCase().includes(cleanName) || cleanName.includes(p.name.toLowerCase()));
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
        // Map Excel columns: Type | Nature | Category | Item Name | Qty | Date | Assign To
        const type = cols[0]?.trim() || "Import";
        const itemNature = cols[1]?.trim() || "Non Consumables";
        const category = cols[2]?.trim() || "";
        const model = cols[3]?.trim() || "";
        const qty = cols[4] ? parseInt(cols[4].replace(/,/g, ""), 10) : "";
        const dateStr = cols[5]?.trim() || "";
        const assignee = cols[6]?.trim() || "";

        parsedRows.push({
          id: Date.now() + idx,
          type: ["Import", "Local"].includes(type) ? type : "Import",
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

  // Validation Check: Good to Go?
  const isGoodToGo = () => {
    return rows.every(r => r.category && r.model && r.orderQuantity && r.requiredByDate && r.purchaserId);
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
    <div className="glass-panel card-fade-in" style={{ padding: "28px", width: "100%", maxWidth: "1400px", margin: "20px auto" }}>
      
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h2 style={{ fontSize: "1.6rem" }}>Mak Power Purchase Request Sheet</h2>
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
                  <td>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      placeholder="e.g. MEMORY CARD PACKING" 
                      value={row.category}
                      onChange={e => updateCell(row.id, "category", e.target.value)}
                      required
                    />
                  </td>

                  {/* Item Name */}
                  <td>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ padding: "4px 8px", fontSize: "0.85rem", height: "auto" }}
                      placeholder="e.g. Infinix HOT12i Fighter" 
                      value={row.model}
                      onChange={e => updateCell(row.id, "model", e.target.value)}
                      required
                    />
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
              minWidth: "150px",
              background: goodToGo ? "var(--success)" : "rgba(255, 255, 255, 0.03)",
              color: goodToGo ? "var(--text-dark)" : "var(--text-muted)",
              boxShadow: goodToGo ? "0 0 15px var(--success-glow)" : "none",
              border: goodToGo ? "1.5px solid transparent" : "1.5px dashed var(--border-glass)"
            }}
          >
            {goodToGo ? "Good to Go" : "Fill All Cells"}
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
              <strong style={{ color: "var(--primary)" }}>Purchase Type | Item Nature | Category | Item Name | Qty | Required Date | Assign To</strong>
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
