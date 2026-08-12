import React, { useState, useMemo, useEffect } from "react";
import { Package, Search, Filter, Truck, CheckCircle2, Clock, Building, ArrowLeft, ExternalLink, ChevronRight, Layers, DollarSign, MapPin, Tag, ShieldCheck, Upload } from "lucide-react";
import { uploadToCloudinary } from "../utils/upload";
import DateRangeFilter, { isDateInBetween } from "./DateRangeFilter";
import Pagination from "./Pagination";

export default function ItemMasterView({ requests = [], vendors = [], cargos = [], cargoCompanies = [], purchasers = [], onBatchUpdateRequests }) {
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination State (50 per page for 5 Lakh scale)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [uploadingModel, setUploadingModel] = useState(null);
  const [localPhotoMap, setLocalPhotoMap] = useState({});

  const handleUpdateItemPhoto = async (modelName, file) => {
    if (!file) return;
    setUploadingModel(modelName);
    try {
      const cloudinaryUrl = await uploadToCloudinary(file, "makpower_photos");
      const lowerKey = modelName.trim().toLowerCase();

      setLocalPhotoMap(prev => ({
        ...prev,
        [lowerKey]: cloudinaryUrl
      }));

      const matchingRequests = requests.filter(r => (r.model || "").trim().toLowerCase() === lowerKey);
      if (matchingRequests.length > 0) {
        const updatedBatch = matchingRequests.map(r => ({ ...r, photo: cloudinaryUrl }));
        if (onBatchUpdateRequests) {
          await onBatchUpdateRequests(updatedBatch);
        } else {
          await fetch("/api/requests/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedBatch)
          });
        }
      }
    } catch (err) {
      console.error("Failed to update item photo:", err);
    } finally {
      setUploadingModel(null);
    }
  };

  // Helper to convert currency to RMB base
  const convertToRmb = (amount, currency = "RMB") => {
    const val = parseFloat(amount || 0);
    if (isNaN(val)) return 0;
    if (currency === "USD") return val * 7.25;
    if (currency === "INR") return val * 0.086;
    return val;
  };

  // Group requests by unique model name
  const itemsCatalog = useMemo(() => {
    const map = {};

    requests.forEach(r => {
      if (r.status === "Cancelled") return;
      const key = (r.model || "Unknown Model").trim();
      const lowerKey = key.toLowerCase();

      if (!map[lowerKey]) {
        map[lowerKey] = {
          model: key,
          category: r.category || "Uncategorized",
          itemNature: r.itemNature || "Non Consumables",
          photo: r.photo || "",
          requests: [],
          vendorIds: new Set(),
          totalOrderedQty: 0,     // In-transit / active ordered
          totalDeliveredQty: 0,   // Delivered warehouse inventory
          totalEverPurchased: 0,  // Grand total
          totalSpentRmb: 0
        };
      }

      const item = map[lowerKey];
      // Keep best available photo
      if (localPhotoMap[lowerKey]) {
        item.photo = localPhotoMap[lowerKey];
      } else if (!item.photo && r.photo) {
        item.photo = r.photo;
      }
      if (r.category && item.category === "Uncategorized") {
        item.category = r.category;
      }

      item.requests.push(r);
      if (r.vendorId) item.vendorIds.add(r.vendorId);

      const qty = parseInt(r.orderQuantity || 0);
      item.totalEverPurchased += qty;

      if (r.isMaterialRec === "Yes") {
        item.totalDeliveredQty += qty;
      } else {
        item.totalOrderedQty += qty;
      }

      item.totalSpentRmb += convertToRmb(r.totalRmb, r.currency);
    });

    // Determine current location stage for each item model
    return Object.values(map).map(item => {
      const activeReqs = item.requests.filter(r => r.isMaterialRec !== "Yes");

      let latestStage = "Delivered Stock";
      let latestStageCode = 5;

      if (activeReqs.length > 0) {
        // Find highest stage among active requests
        activeReqs.forEach(r => {
          let stageCode = 1;
          let stageName = "Order Placed / Commercial Specs";

          if (r.cargoId) {
            const cargo = cargos.find(c => c.id === r.cargoId);
            if (cargo && cargo.cargoShippingDate) {
              stageCode = 4;
              stageName = "In Freight Transit";
            } else {
              stageCode = 3;
              stageName = "Cargo Consolidated";
            }
          } else if (r.vendorEdd || r.priceRmb) {
            stageCode = 2;
            stageName = "Vendor Production";
          }

          if (stageCode < latestStageCode) {
            latestStageCode = stageCode;
            latestStage = stageName;
          }
        });
      }

      const vendorList = Array.from(item.vendorIds).map(id => vendors.find(v => v.id === id)?.name).filter(Boolean);

      return {
        ...item,
        vendors: vendorList.length > 0 ? vendorList : ["Not Specified"],
        latestStage,
        latestStageCode
      };
    });
  }, [requests, vendors, cargos]);

  // Extract distinct categories & vendors for filters
  const categories = useMemo(() => {
    const set = new Set(["All"]);
    itemsCatalog.forEach(i => i.category && set.add(i.category));
    return Array.from(set);
  }, [itemsCatalog]);

  const vendorNames = useMemo(() => {
    const set = new Set(["All"]);
    itemsCatalog.forEach(i => i.vendors.forEach(v => set.add(v)));
    return Array.from(set);
  }, [itemsCatalog]);

  // Filter items for Page 1 catalog grid
  const filteredItems = useMemo(() => {
    return itemsCatalog.filter(item => {
      const matchesSearch = item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.vendors.some(v => v.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === "All" || item.category === categoryFilter;
      const matchesVendor = vendorFilter === "All" || item.vendors.includes(vendorFilter);
      const matchesStage = stageFilter === "All" ||
                           (stageFilter === "In-Transit" && item.latestStageCode < 5) ||
                           (stageFilter === "Delivered" && item.latestStageCode === 5);

      const matchesDate = !startDate && !endDate ? true : item.requests.some(r => isDateInBetween(r.orderDate || r.createdDate, startDate, endDate));

      return matchesSearch && matchesCat && matchesVendor && matchesStage && matchesDate;
    });
  }, [itemsCatalog, searchQuery, categoryFilter, vendorFilter, stageFilter, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, vendorFilter, stageFilter, startDate, endDate]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Total summary metrics
  const totalItemsCount = itemsCatalog.length;
  const totalInTransitQty = itemsCatalog.reduce((sum, i) => sum + i.totalOrderedQty, 0);
  const totalDeliveredQty = itemsCatalog.reduce((sum, i) => sum + i.totalDeliveredQty, 0);
  const totalValuationRmb = itemsCatalog.reduce((sum, i) => sum + i.totalSpentRmb, 0);

  // Render Page 2: Detailed Item & Location Drill-Down
  if (selectedModel) {
    const item = itemsCatalog.find(i => i.model.toLowerCase() === selectedModel.toLowerCase()) || {
      model: selectedModel,
      category: "N/A",
      itemNature: "N/A",
      photo: "",
      vendors: [],
      requests: [],
      totalOrderedQty: 0,
      totalDeliveredQty: 0,
      totalEverPurchased: 0,
      totalSpentRmb: 0
    };

    return (
      <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Top Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button 
            onClick={() => setSelectedModel(null)} 
            className="btn btn-secondary" 
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <ArrowLeft size={16} /> Back to Item Catalog
          </button>

          <span className="badge badge-primary" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
            Model: {item.model}
          </span>
        </div>

        {/* Item Header Card */}
        <div className="glass-panel" style={{ padding: "24px", display: "grid", gridTemplateColumns: "180px 1fr", gap: "24px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ width: "180px", height: "180px", background: "rgba(15, 23, 42, 0.6)", borderRadius: "12px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-glass)" }}>
              {item.photo ? (
                <img src={item.photo} alt={item.model} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px" }}>
                  <Package size={48} style={{ opacity: 0.4, marginBottom: "8px" }} />
                  <div style={{ fontSize: "0.75rem" }}>No Cloudinary Photo</div>
                </div>
              )}
            </div>

            <label className="doc-upload-btn" style={{ width: "100%", padding: "8px", fontSize: "0.8rem", justifyContent: "center", opacity: uploadingModel === item.model ? 0.7 : 1 }}>
              <Upload size={14} /> <span>{uploadingModel === item.model ? "Uploading to Cloudinary..." : "Update Item Photo"}</span>
              <input 
                type="file" 
                accept="image/*" 
                disabled={uploadingModel === item.model}
                onChange={e => handleUpdateItemPhoto(item.model, e.target.files[0])} 
                style={{ display: "none" }} 
              />
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)", marginBottom: "4px" }}>{item.model}</h2>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge badge-info"><Tag size={12} style={{ marginRight: "4px" }} /> {item.category}</span>
                <span className="badge badge-secondary"><Layers size={12} style={{ marginRight: "4px" }} /> {item.itemNature}</span>
                <span className="badge badge-success"><Building size={12} style={{ marginRight: "4px" }} /> Made By: {item.vendors.join(", ")}</span>
              </div>
            </div>

            {/* Inventory KPI Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginTop: "8px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Ordered</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#38bdf8" }}>{item.totalEverPurchased} units</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>In-Transit / Active</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f59e0b" }}>{item.totalOrderedQty} units</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Delivered Stock</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--success)" }}>{item.totalDeliveredQty} units</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Spend</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)" }}>¥{item.totalSpentRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Where is Item Now? Visual Supply Chain Milestone Stepper */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)" }}>
            <MapPin size={20} /> Where is this Item Now? (Real-Time Location & Milestone Pipeline)
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", position: "relative" }}>
            {[
              { step: 1, title: "Step 1: Order Placed", desc: "Commercial & Tech Specs" },
              { step: 2, title: "Step 2: Vendor Factory", desc: "Production at Vendor Site" },
              { step: 3, title: "Step 3: Cargo Ready", desc: "Grouped in Cargo Batch" },
              { step: 4, title: "Step 4: Freight Transit", desc: "Sea / Air Shipping Transit" },
              { step: 5, title: "Step 5: Warehouse Stock", desc: "Delivered & Stored in Inventory" }
            ].map(s => {
              const isActive = item.latestStageCode >= s.step;
              const isCurrent = item.latestStageCode === s.step;
              return (
                <div 
                  key={s.step} 
                  style={{ 
                    background: isCurrent ? "rgba(56, 189, 248, 0.15)" : isActive ? "rgba(34, 197, 94, 0.08)" : "rgba(15, 23, 42, 0.4)",
                    border: `1px solid ${isCurrent ? "#38bdf8" : isActive ? "rgba(34, 197, 94, 0.4)" : "var(--border-glass)"}`,
                    borderRadius: "10px",
                    padding: "14px",
                    textAlign: "center"
                  }}
                >
                  <div style={{ 
                    width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto 8px auto",
                    background: isCurrent ? "#38bdf8" : isActive ? "var(--success)" : "rgba(255,255,255,0.1)",
                    color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {isActive ? "✓" : s.step}
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isCurrent ? "#38bdf8" : "#fff", marginBottom: "4px" }}>{s.title}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Purchase Orders & Purchaser History Table */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={20} style={{ color: "var(--primary)" }} /> Purchase Orders & Purchaser Tracking History
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Date</th>
                  <th>Purchaser Name</th>
                  <th>Made By (Vendor)</th>
                  <th>Order Qty</th>
                  <th>Price & Currency</th>
                  <th>Cargo Tracking</th>
                  <th>Where is Item Now?</th>
                  <th>Receipt Status</th>
                </tr>
              </thead>
              <tbody>
                {item.requests.map(r => {
                  const purchaser = purchasers.find(p => p.id === r.purchaserId)?.name || r.purchaserId || "Himanshu / Requester";
                  const vendor = vendors.find(v => v.id === r.vendorId)?.name || "Pending Vendor Selection";
                  const cargo = cargos.find(c => c.id === r.cargoId);

                  let itemStage = "Order Placed (Step 1)";
                  if (r.isMaterialRec === "Yes") {
                    itemStage = "Delivered Warehouse (Step 5)";
                  } else if (cargo && cargo.cargoShippingDate) {
                    itemStage = `In Freight Transit (Step 4: ${cargo.modeOfTransport || "Transit"})`;
                  } else if (r.cargoId) {
                    itemStage = `Cargo Consolidated (Step 3: ${r.cargoId})`;
                  } else if (r.vendorEdd || r.priceRmb) {
                    itemStage = "Vendor Factory Production (Step 2)";
                  }

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.id}</td>
                      <td>{r.orderDate || "N/A"}</td>
                      <td style={{ fontWeight: 600, color: "var(--primary)" }}>{purchaser}</td>
                      <td>{vendor}</td>
                      <td style={{ fontWeight: 700 }}>{r.orderQuantity} pcs</td>
                      <td>
                        {r.priceRmb ? (
                          <span>{r.currency || "RMB"} {r.priceRmb} / pc <br /><small style={{ color: "var(--text-muted)" }}>Total: {r.currency || "RMB"} {r.totalRmb}</small></span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Pending Pricing</span>
                        )}
                      </td>
                      <td>
                        {r.cargoId ? (
                          <span className="badge badge-info"><Truck size={12} style={{ marginRight: "4px" }} /> {r.cargoId}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Not in Cargo</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${r.isMaterialRec === "Yes" ? "badge-success" : "badge-pending"}`}>
                          {itemStage}
                        </span>
                      </td>
                      <td>
                        {r.isMaterialRec === "Yes" ? (
                          <span style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.85rem" }}>✓ Delivered ({r.actualReceivedDate || "Received"})</span>
                        ) : (
                          <span style={{ color: "#f59e0b", fontSize: "0.85rem" }}>⏳ In-Transit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // Render Page 1: Item Master Catalog & Inventory Grid
  return (
    <div className="card-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Page Title & Core Metrics Bar */}
      <div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "6px" }}>Item Master Catalog & Live Inventory Tracking</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Comprehensive catalog of all items, supplier source ("Made By"), ordered quantities, live warehouse inventory, and real-time location stage.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Total Item Models</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>{totalItemsCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>In-Transit / Ordered Qty</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#f59e0b" }}>{totalInTransitQty} pcs</div>
        </div>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Delivered Warehouse Inventory</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--success)" }}>{totalDeliveredQty} pcs</div>
        </div>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>Total Catalog Spend</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#38bdf8" }}>¥{totalValuationRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: "16px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by Item Model, Vendor Name, or Category..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
        </div>

        <DateRangeFilter 
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={() => { setStartDate(""); setEndDate(""); }}
        />

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <select className="form-control" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: "0.85rem" }}>
              <option value="All">All Categories</option>
              {categories.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <select className="form-control" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} style={{ fontSize: "0.85rem" }}>
              <option value="All">All Vendors (Made By)</option>
              {vendorNames.filter(v => v !== "All").map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <select className="form-control" value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ fontSize: "0.85rem" }}>
              <option value="All">All Transit Stages</option>
              <option value="In-Transit">In-Transit / Active Orders</option>
              <option value="Delivered">Delivered Warehouse Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Items Grid (Page 1) */}
      {filteredItems.length === 0 ? (
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <Package size={36} style={{ opacity: 0.4, marginBottom: "12px" }} /><br />
          No items found matching your filter criteria.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {paginatedItems.map(item => (
              <div 
                key={item.model} 
                className="glass-panel" 
                style={{ 
                  padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", 
                  transition: "all 0.2s ease", cursor: "pointer", border: "1px solid var(--border-glass)" 
                }}
                onClick={() => setSelectedModel(item.model)}
              >
                <div>
                  {/* Top Image & Model Header */}
                  <div style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                      <div style={{ width: "70px", height: "70px", borderRadius: "8px", background: "rgba(15,23,42,0.8)", border: "1px solid var(--border-glass)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {item.photo ? (
                          <img src={item.photo} alt={item.model} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Package size={28} style={{ opacity: 0.4 }} />
                        )}
                      </div>
                      <label 
                        className="doc-upload-btn" 
                        style={{ fontSize: "0.62rem", padding: "2px 6px", height: "auto", minWidth: "auto", opacity: uploadingModel === item.model ? 0.7 : 1 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <Upload size={9} /> <span>{uploadingModel === item.model ? "..." : "Edit Photo"}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          disabled={uploadingModel === item.model}
                          onChange={e => {
                            e.stopPropagation();
                            handleUpdateItemPhoto(item.model, e.target.files[0]);
                          }} 
                          style={{ display: "none" }} 
                        />
                      </label>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 
                        style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {item.model}
                      </h4>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Made By: <strong>{item.vendors.slice(0, 2).join(", ")}{item.vendors.length > 2 ? "..." : ""}</strong>
                      </div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                        <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>{item.category}</span>
                        <span className="badge badge-secondary" style={{ fontSize: "0.68rem" }}>{item.itemNature}</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Stock & Location Badge */}
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", marginBottom: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>In-Transit Ordered</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>{item.totalOrderedQty} pcs</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Delivered Stock</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--success)" }}>{item.totalDeliveredQty} pcs</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>Stage Location:</span>
                    <span className={`badge ${item.latestStageCode === 5 ? "badge-success" : "badge-warning"}`} style={{ fontSize: "0.72rem" }}>
                      <MapPin size={10} style={{ marginRight: "4px" }} /> {item.latestStage}
                    </span>
                  </div>
                </div>

                {/* Card Action */}
                <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: "12px", marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{item.requests.length} order batch(es)</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                    View Details & Track <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Pagination 
            currentPage={currentPage}
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}

    </div>
  );
}
