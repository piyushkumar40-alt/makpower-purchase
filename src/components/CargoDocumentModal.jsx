import React, { useState } from "react";
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
  Link2 
} from "lucide-react";
import { useModalEscape } from "../utils/useModalEscape";
import { uploadToCloudinary } from "../utils/upload";
import { downloadOrOpenBlob } from "../utils/formatters";

/**
 * Reusable Cargo Document Viewer, Downloader & Attachment Modal.
 * Handles images, PDFs, Excel/CSV spreadsheets, and missing file attachments ("not even here").
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
  const [currentData, setCurrentData] = useState(docInfo.fileData || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const lowerName = String(fileName || "").toLowerCase();
  const isSpreadsheet = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lowerName) || (typeof currentData === "string" && currentData.startsWith("data:image/"));
  const isPdf = lowerName.endsWith(".pdf") || (typeof currentData === "string" && currentData.startsWith("data:application/pdf"));
  const isWebUrl = typeof currentData === "string" && (currentData.startsWith("http://") || currentData.startsWith("https://"));

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
      setCurrentData(finalData);

      if (cargo && onUpdateCargo) {
        await onUpdateCargo({
          ...cargo,
          [field]: file.name,
          [dataField]: finalData
        });
      }

      setSuccessMessage(`File "${file.name}" uploaded and attached successfully!`);
      // Trigger download / open
      downloadOrOpenBlob(finalData, file.name);
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkItemDoc = async (item) => {
    if (!item?.itemPackingListData || !cargo || !onUpdateCargo) return;
    setIsUploading(true);
    try {
      setCurrentData(item.itemPackingListData);
      await onUpdateCargo({
        ...cargo,
        [field]: item.itemPackingListFile || fileName,
        [dataField]: item.itemPackingListData
      });
      setSuccessMessage(`Linked packing list from item "${item.model}" successfully!`);
      downloadOrOpenBlob(item.itemPackingListData, item.itemPackingListFile || fileName);
    } catch (err) {
      setUploadError(`Failed to link item document: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!currentData) return;
    downloadOrOpenBlob(currentData, fileName);
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
          maxWidth: isImage || isPdf ? "850px" : "620px", 
          maxHeight: "90vh", 
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
                File: <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{fileName || "Unnamed Document"}</span>
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
              <img src={currentData} alt={fileName} style={{ maxWidth: "100%", maxHeight: "55vh", objectFit: "contain", borderRadius: "6px" }} />
            </div>
          )}

          {/* If PDF and Data Present */}
          {isPdf && currentData && (
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", overflow: "hidden", marginBottom: "16px", border: "1px solid var(--border-glass)" }}>
              <iframe src={currentData} title={fileName} style={{ width: "100%", height: "55vh", border: "none" }} />
            </div>
          )}

          {/* If Data Present (Spreadsheet / Any File Attached) */}
          {currentData ? (
            <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.25)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontWeight: 700, fontSize: "0.95rem", marginBottom: "6px" }}>
                <CheckCircle2 size={18} /> File Content Attached &amp; Ready
              </div>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The document <strong>{fileName}</strong> is stored securely. You can download it directly to open in Excel or view it online.
              </p>
              
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownload}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600, padding: "8px 16px" }}
                >
                  <Download size={16} /> Download {isSpreadsheet ? "Excel / CSV" : "Document"}
                </button>

                {googleDocsViewerUrl && isSpreadsheet && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.open(googleDocsViewerUrl, "_blank", "noopener,noreferrer")}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                    title="View spreadsheet in Google Docs Viewer without needing MS Excel installed"
                  >
                    <Eye size={15} /> View in Google Docs Viewer <ExternalLink size={12} />
                  </button>
                )}

                {isWebUrl && !isSpreadsheet && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.open(currentData, "_blank", "noopener,noreferrer")}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                  >
                    <ExternalLink size={15} /> Open Direct Link
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* If Missing Data ("not even here") */
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f59e0b", fontWeight: 700, fontSize: "0.98rem", marginBottom: "8px" }}>
                <AlertTriangle size={20} /> File Content Not Attached ("Not Even Here")
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The filename is recorded as <strong style={{ color: "var(--primary)" }}>{fileName}</strong>, but its file content (payload) was not uploaded to the server yet.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
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
                    {isUploading ? "Uploading & Attaching..." : "Choose File to Attach & Open"}
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv,.pdf,image/*" 
                      disabled={isUploading} 
                      style={{ display: "none" }} 
                      onChange={handleAttachFile} 
                    />
                  </label>
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
          <div>
            <label 
              className="btn btn-secondary btn-sm" 
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: isUploading ? "wait" : "pointer", fontSize: "0.8rem" }}
            >
              <Upload size={13} /> {isUploading ? "Uploading..." : "Replace / Re-upload File"}
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv,.pdf,image/*" 
                disabled={isUploading} 
                style={{ display: "none" }} 
                onChange={handleAttachFile} 
              />
            </label>
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
