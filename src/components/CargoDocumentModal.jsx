import React, { useState, useEffect } from "react";
import { 
  X, 
  Upload, 
  Download, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  FileSpreadsheet, 
  Eye, 
  Loader2, 
  Link2,
  Search,
  Layers,
  Trash2
} from "lucide-react";
import { useModalEscape } from "../utils/useModalEscape";
import { uploadToCloudinary } from "../utils/upload";
import { downloadOrOpenBlob } from "../utils/formatters";

/**
 * Reusable Cargo Document Viewer, Downloader & Attachment Modal.
 * Handles images, PDFs, Excel/CSV spreadsheets (with live SheetJS table preview),
 * and missing file attachments ("not even here").
 */
export default function CargoDocumentModal({ 
  docInfo, 
  onClose, 
  onUpdateCargo, 
  bundledRequests = [] 
}) {
  useModalEscape(onClose);
  if (!docInfo) return null;

  const { cargo, docType, fileName, field, dataField } = docInfo;
  const [currentFileName, setCurrentFileName] = useState(docInfo.fileName || "");
  const [currentData, setCurrentData] = useState(docInfo.fileData || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Spreadsheet Live Preview States
  const [parsedSheets, setParsedSheets] = useState({});
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [sheetParseError, setSheetParseError] = useState("");
  const [tableSearch, setTableSearch] = useState("");

  const lowerName = String(currentFileName || "").toLowerCase();
  const isSpreadsheet = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lowerName) || (typeof currentData === "string" && currentData.startsWith("data:image/"));
  const isPdf = lowerName.endsWith(".pdf") || (typeof currentData === "string" && currentData.startsWith("data:application/pdf"));
  const isWebUrl = typeof currentData === "string" && (currentData.startsWith("http://") || currentData.startsWith("https://"));

  // Parse spreadsheet when currentData is available
  useEffect(() => {
    if (!isSpreadsheet || !currentData) return;
    let cancelled = false;
    setIsParsingSheet(true);
    setSheetParseError("");

    async function loadSpreadsheet() {
      try {
        if (typeof window === "undefined" || !window.XLSX) {
          throw new Error("Spreadsheet engine (SheetJS) is not loaded in browser.");
        }

        let workbook;
        if (currentData.startsWith("http://") || currentData.startsWith("https://")) {
          const resp = await fetch(currentData);
          if (!resp.ok) throw new Error(`Could not fetch spreadsheet from CDN (${resp.status})`);
          const arrayBuffer = await resp.arrayBuffer();
          workbook = window.XLSX.read(arrayBuffer, { type: "array" });
        } else if (currentData.startsWith("data:")) {
          const base64Data = currentData.split(",")[1] || currentData;
          workbook = window.XLSX.read(base64Data, { type: "base64" });
        } else {
          workbook = window.XLSX.read(currentData, { type: "base64" });
        }

        if (cancelled) return;

        const sheets = {};
        (workbook.SheetNames || []).forEach(name => {
          const ws = workbook.Sheets[name];
          const jsonRows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          // Filter out completely blank rows
          sheets[name] = jsonRows.filter(row => Array.isArray(row) && row.some(cell => cell !== "" && cell !== null && cell !== undefined));
        });

        setParsedSheets(sheets);
        setSheetNames(workbook.SheetNames || []);
        setActiveSheetIndex(0);
      } catch (err) {
        if (!cancelled) {
          console.warn("Spreadsheet preview parser notice:", err);
          setSheetParseError(err.message || "Spreadsheet preview could not be generated.");
        }
      } finally {
        if (!cancelled) {
          setIsParsingSheet(false);
        }
      }
    }

    loadSpreadsheet();
    return () => { cancelled = true; };
  }, [currentData, isSpreadsheet]);

  // Check if any bundled items have packing list data to offer as 1-click fallback
  const itemWithDoc = !currentData && docType?.toLowerCase().includes("packing")
    ? bundledRequests.find(r => r.itemPackingListData && r.itemPackingListData.trim() !== "")
    : null;

  const handleAttachFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError("");
    setSuccessMessage("");
    try {
      const url = await uploadToCloudinary(file, "makpower_docs");
      const finalData = url || "";
      setCurrentFileName(file.name);
      setCurrentData(finalData);

      if (cargo && onUpdateCargo) {
        await onUpdateCargo({
          ...cargo,
          [field]: file.name,
          [dataField]: finalData
        });
      }

      setSuccessMessage(`File "${file.name}" uploaded and attached successfully!`);
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkItemDoc = async (item) => {
    if (!item?.itemPackingListData || !cargo || !onUpdateCargo) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const targetName = item.itemPackingListFile || currentFileName;
      setCurrentFileName(targetName);
      setCurrentData(item.itemPackingListData);
      await onUpdateCargo({
        ...cargo,
        [field]: targetName,
        [dataField]: item.itemPackingListData
      });
      setSuccessMessage(`Linked packing list from item "${item.model}" successfully!`);
    } catch (err) {
      setUploadError(`Failed to link item document: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!cargo || !onUpdateCargo) return;
    setIsUploading(true);
    setUploadError("");
    try {
      await onUpdateCargo({
        ...cargo,
        [field]: "",
        [dataField]: ""
      });
      setCurrentFileName("");
      setCurrentData("");
      if (onClose) onClose();
    } catch (err) {
      setUploadError(`Failed to remove document: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!currentData) return;
    downloadOrOpenBlob(currentData, currentFileName || fileName);
  };

  const googleDocsViewerUrl = isWebUrl 
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(currentData)}&embedded=false`
    : null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div 
        className="glass-panel modal-content" 
        style={{ 
          width: "95%", 
          maxWidth: isSpreadsheet ? "1050px" : (isImage || isPdf ? "850px" : "620px"), 
          maxHeight: "92vh", 
          display: "flex", 
          flexDirection: "column", 
          padding: "24px", 
          position: "relative",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          borderRadius: "14px"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ 
              width: "42px", 
              height: "42px", 
              borderRadius: "10px", 
              background: isSpreadsheet ? "rgba(16, 185, 129, 0.15)" : isPdf ? "rgba(239, 68, 68, 0.15)" : "rgba(56, 189, 248, 0.15)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: isSpreadsheet ? "var(--success)" : isPdf ? "var(--danger)" : "var(--primary)" 
            }}>
              {isSpreadsheet ? <FileSpreadsheet size={24} /> : isImage ? <Eye size={24} /> : <FileText size={24} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)" }}>
                {docType || "Cargo Document"}
              </h3>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "3px" }}>
                Cargo: <span style={{ color: "var(--primary)", fontWeight: 600 }}>{cargo?.id || "—"}</span> &nbsp;|&nbsp; 
                File: <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{currentFileName || "Unnamed Document"}</span>
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-icon" 
            style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", padding: "6px" }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
          {/* Success Notification */}
          {successMessage && (
            <div style={{ 
              background: "rgba(16, 185, 129, 0.15)", 
              border: "1px solid rgba(16, 185, 129, 0.35)", 
              borderRadius: "8px", 
              padding: "10px 14px", 
              marginBottom: "14px", 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              color: "var(--success)", 
              fontSize: "0.85rem", 
              fontWeight: 600 
            }}>
              <CheckCircle2 size={16} /> {successMessage}
            </div>
          )}

          {/* If Image and Data Present */}
          {isImage && currentData && (
            <div style={{ textAlign: "center", background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "16px", marginBottom: "16px", border: "1px solid var(--border-glass)" }}>
              <img src={currentData} alt={currentFileName} style={{ maxWidth: "100%", maxHeight: "55vh", objectFit: "contain", borderRadius: "6px" }} />
            </div>
          )}

          {/* If PDF and Data Present */}
          {isPdf && currentData && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", overflow: "hidden", marginBottom: "16px", border: "1px solid var(--border-glass)" }}>
              <iframe src={currentData} title={currentFileName} style={{ width: "100%", height: "55vh", border: "none" }} />
            </div>
          )}

          {/* If Data Present (Spreadsheet / Any File Attached) */}
          {currentData ? (
            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-glass)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
              
              {/* Header Action Bar for Document */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontWeight: 700, fontSize: "0.95rem" }}>
                  <CheckCircle2 size={18} /> File Content Attached &amp; Ready
                </div>
                
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleDownload}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600, padding: "6px 14px" }}
                  >
                    <Download size={15} /> Download {isSpreadsheet ? "Excel (.xlsx)" : "Document"}
                  </button>

                  {googleDocsViewerUrl && isSpreadsheet && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.open(googleDocsViewerUrl, "_blank", "noopener,noreferrer")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}
                      title="View in Google Docs Viewer"
                    >
                      <Eye size={14} /> Google Viewer <ExternalLink size={11} />
                    </button>
                  )}

                  {isWebUrl && !isSpreadsheet && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.open(currentData, "_blank", "noopener,noreferrer")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem" }}
                    >
                      <ExternalLink size={14} /> Direct URL
                    </button>
                  )}
                </div>
              </div>

              {/* LIVE SPREADSHEET VIEWER (SheetJS) */}
              {isSpreadsheet && (
                <div>
                  {isParsingSheet && (
                    <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      <Loader2 size={24} className="spinner" style={{ marginBottom: "8px", color: "var(--primary)" }} />
                      <div>Reading and rendering spreadsheet data...</div>
                    </div>
                  )}

                  {!isParsingSheet && sheetNames.length > 0 && (() => {
                    const currentSheetName = sheetNames[activeSheetIndex] || sheetNames[0];
                    const rows = parsedSheets[currentSheetName] || [];
                    const filteredRows = tableSearch.trim()
                      ? rows.filter((r, idx) => idx === 0 || r.some(cell => String(cell || "").toLowerCase().includes(tableSearch.toLowerCase())))
                      : rows;

                    return (
                      <div>
                        {/* Sheet Tabs & Search */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                            {sheetNames.length > 1 && sheetNames.map((name, idx) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setActiveSheetIndex(idx)}
                                className={`btn btn-sm ${activeSheetIndex === idx ? "btn-primary" : "btn-secondary"}`}
                                style={{ fontSize: "0.75rem", padding: "3px 10px", borderRadius: "6px" }}
                              >
                                <Layers size={11} style={{ marginRight: "4px" }} /> {name} ({parsedSheets[name]?.length || 0})
                              </button>
                            ))}
                            {sheetNames.length === 1 && (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                                📄 Sheet: <strong style={{ color: "var(--text-main)" }}>{currentSheetName}</strong> ({rows.length} rows)
                              </span>
                            )}
                          </div>

                          {rows.length > 0 && (
                            <div style={{ position: "relative", width: "220px" }}>
                              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                              <input
                                type="text"
                                placeholder="Search in sheet..."
                                value={tableSearch}
                                onChange={e => setTableSearch(e.target.value)}
                                className="form-control"
                                style={{ paddingLeft: "30px", height: "30px", fontSize: "0.78rem" }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Interactive Spreadsheet Data Table */}
                        {filteredRows.length === 0 ? (
                          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            No matching rows found for "{tableSearch}".
                          </div>
                        ) : (
                          <div style={{ 
                            maxHeight: "50vh", 
                            overflow: "auto", 
                            border: "1px solid var(--border-glass)", 
                            borderRadius: "8px", 
                            background: "rgba(0,0,0,0.2)" 
                          }}>
                            <table className="table table-dark table-sm table-hover" style={{ margin: 0, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                              <thead>
                                <tr style={{ background: "rgba(15, 23, 42, 0.95)", position: "sticky", top: 0, zIndex: 2 }}>
                                  <th style={{ width: "40px", textAlign: "center", color: "var(--text-muted)", padding: "8px 10px", fontSize: "0.72rem", borderBottom: "2px solid var(--border-glass)" }}>#</th>
                                  {(filteredRows[0] || []).map((headerCell, colIdx) => (
                                    <th key={colIdx} style={{ padding: "8px 12px", color: "var(--primary)", fontWeight: 700, borderBottom: "2px solid var(--border-glass)" }}>
                                      {headerCell !== "" && headerCell !== null && headerCell !== undefined ? String(headerCell) : `Col ${colIdx + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRows.slice(1, 201).map((row, rIdx) => (
                                  <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                                    <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.72rem", padding: "6px 10px" }}>{rIdx + 1}</td>
                                    {(filteredRows[0] || []).map((_, cIdx) => (
                                      <td key={cIdx} style={{ padding: "6px 12px" }}>
                                        {row[cIdx] !== "" && row[cIdx] !== null && row[cIdx] !== undefined ? String(row[cIdx]) : "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {filteredRows.length > 201 && (
                              <div style={{ padding: "8px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", borderTop: "1px solid var(--border-glass)" }}>
                                Showing first 200 rows of {filteredRows.length - 1} data rows. Download Excel file for complete ledger.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!isParsingSheet && sheetParseError && (
                    <div style={{ padding: "14px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      <div style={{ color: "#f59e0b", fontWeight: 700, marginBottom: "4px" }}>Note on Online Preview:</div>
                      {sheetParseError}
                      <div style={{ marginTop: "8px" }}>
                        Click <strong>Download Excel</strong> above to open this spreadsheet directly in Microsoft Excel, Apple Numbers, or WPS.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* If Missing Data (Payload not uploaded yet) */
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f59e0b", fontWeight: 700, fontSize: "0.98rem", marginBottom: "8px" }}>
                <AlertTriangle size={20} /> Document Payload Not Attached
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The filename is recorded as <strong style={{ color: "var(--primary)" }}>{currentFileName || fileName}</strong>, but its file content (payload) was not uploaded to the server yet (common for records created prior to payload storage). You can attach the file below to view and persist it.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <label 
                    className="btn btn-primary" 
                    style={{ 
                      display: "inline-flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      cursor: isUploading ? "wait" : "pointer",
                      padding: "9px 18px",
                      fontWeight: 600
                    }}
                  >
                    {isUploading ? <Loader2 size={16} className="spinner" /> : <Upload size={16} />}
                    {isUploading ? "Uploading & Attaching..." : "Upload & Attach File"}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv,.pdf,image/*" 
                      disabled={isUploading} 
                      style={{ display: "none" }} 
                      onChange={handleAttachFile} 
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleRemoveDocument}
                    disabled={isUploading}
                    className="btn btn-secondary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 16px",
                      fontSize: "0.85rem",
                      color: "var(--danger)",
                      borderColor: "rgba(239, 68, 68, 0.4)"
                    }}
                    title="Remove unattached document reference from cargo"
                  >
                    <Trash2 size={15} /> Remove Unattached Reference
                  </button>
                </div>

                {/* If bundled item has document available */}
                {itemWithDoc && (
                  <div style={{ marginTop: "4px", padding: "10px 14px", background: "rgba(56, 189, 248, 0.08)", border: "1px dashed rgba(56, 189, 248, 0.3)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <Link2 size={14} /> Item Packing List Available
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                      Bundled item <strong>{itemWithDoc.model}</strong> has attached file: <em>{itemWithDoc.itemPackingListFile}</em>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLinkItemDoc(itemWithDoc)}
                      disabled={isUploading}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.78rem" }}
                    >
                      <CheckCircle2 size={13} /> Link Item Packing List to This Cargo
                    </button>
                  </div>
                )}
              </div>

              {uploadError && <div style={{ color: "var(--danger)", fontSize: "0.82rem", marginTop: "10px" }}>{uploadError}</div>}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <label 
              className="btn btn-secondary btn-sm" 
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: isUploading ? "wait" : "pointer", fontSize: "0.8rem" }}
            >
              <Upload size={13} /> {isUploading ? "Uploading..." : (currentData ? "Replace / Re-upload File" : "Upload File")}
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv,.pdf,image/*" 
                disabled={isUploading} 
                style={{ display: "none" }} 
                onChange={handleAttachFile} 
              />
            </label>
            {!currentData && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRemoveDocument}
                disabled={isUploading}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--danger)", fontSize: "0.78rem" }}
                title="Remove unattached document reference"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {currentData && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleDownload}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Download / Open
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
