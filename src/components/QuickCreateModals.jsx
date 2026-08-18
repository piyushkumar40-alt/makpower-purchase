import React, { useState } from "react";
import { Plus, X, Sparkles, Building2, Truck, Package, UserPlus, Tag } from "lucide-react";

// ==================== 1. QUICK VENDOR MODAL ====================
export function QuickCreateVendorModal({ isOpen, onClose, onAddVendor, currentUser, onVendorCreated }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const purchaserIds = currentUser?.id ? [currentUser.id] : [];
      const res = await onAddVendor(name.trim(), purchaserIds, location.trim(), phone.trim());
      if (res && res.success === false) {
        setError(res.message || "Failed to create vendor.");
      } else {
        const created = res?.vendor || { id: `v-${Date.now()}`, name: name.trim() };
        if (onVendorCreated) onVendorCreated(created);
        onClose();
      }
    } catch (err) {
      setError("An error occurred while creating vendor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "480px", width: "92%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 size={18} /> Register New Vendor
          </h3>
          <button type="button" onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Vendor / Supplier Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shenzhen Electronics Co."
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location / Address</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Shenzhen, China"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. +86 755 88889999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create & Auto-Select"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 2. QUICK CARGO COMPANY MODAL ====================
export function QuickCreateCargoCompanyModal({ isOpen, onClose, onAddCargoCompany, onCompanyCreated }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await onAddCargoCompany(name.trim(), location.trim(), phone.trim());
      if (res && res.success === false) {
        setError(res.message || "Failed to create cargo company.");
      } else {
        const created = res?.company || { id: `cc-${Date.now()}`, name: name.trim() };
        if (onCompanyCreated) onCompanyCreated(created);
        onClose();
      }
    } catch (err) {
      setError("An error occurred while creating cargo company.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "480px", width: "92%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Truck size={18} /> Register New Transport / Cargo Company
          </h3>
          <button type="button" onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Cargo Company Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Express Global Logistics"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hub / Office Location</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Guangzhou Warehouse"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone / WeChat</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. +86 20 87654321"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create & Auto-Select"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 3. QUICK CATALOG ITEM MODAL ====================
export function QuickCreateItemModal({ isOpen, onClose, onAddItem, onItemCreated }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("FG");
  const [type, setType] = useState("Import");
  const [itemNature, setItemNature] = useState("Non Consumables");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Item Model Name is required.");
      return;
    }
    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    setSubmitting(true);
    try {
      const newItem = {
        id: `item-${Date.now()}`,
        name: name.trim(),
        category: category.trim(),
        itemType,
        type,
        itemNature,
        createdAt: new Date().toISOString()
      };
      if (onAddItem) {
        await onAddItem(newItem);
      }
      if (onItemCreated) onItemCreated(newItem);
      onClose();
    } catch (err) {
      setError("Failed to create item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "520px", width: "92%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Package size={18} /> Add New Item to Master Catalog
          </h3>
          <button type="button" onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Item Model / Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. 15BI BATTERY BOTTAM"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Bottom, Battery, PCB..."
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Item Type</label>
              <select className="form-control" value={itemType} onChange={e => setItemType(e.target.value)}>
                <option value="FG" style={{ background: "#0f172a" }}>Finished Goods (FG)</option>
                <option value="RM" style={{ background: "#0f172a" }}>Raw Material (RM)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Type</label>
              <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                <option value="Import" style={{ background: "#0f172a" }}>Import</option>
                <option value="Local" style={{ background: "#0f172a" }}>Local</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Item Nature</label>
            <select className="form-control" value={itemNature} onChange={e => setItemNature(e.target.value)}>
              <option value="Non Consumables" style={{ background: "#0f172a" }}>Non Consumables</option>
              <option value="Consumables" style={{ background: "#0f172a" }}>Consumables</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Save to Catalog & Use"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 4. QUICK PURCHASER USER MODAL ====================
export function QuickCreateUserModal({ isOpen, onClose, onAddPurchaser, onUserCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("MakPower#2026!");
  const [designation, setDesignation] = useState("Purchaser");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, Email and Password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onAddPurchaser(name.trim(), email.trim(), password.trim(), designation);
      if (res && res.success === false) {
        setError(res.message || "Failed to create user.");
      } else {
        const created = res?.user || { id: `u-${Date.now()}`, name: name.trim() };
        if (onUserCreated) onUserCreated(created);
        onClose();
      }
    } catch (err) {
      setError("Failed to create purchaser account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "480px", width: "92%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <UserPlus size={18} /> Register New Purchaser / User
          </h3>
          <button type="button" onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Mr. Rajesh Kumar"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="e.g. rajesh@makpowerindia.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Initial Password *</label>
              <input 
                type="text" 
                className="form-control" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Designation</label>
              <input 
                type="text" 
                className="form-control" 
                value={designation}
                onChange={e => setDesignation(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create & Auto-Select"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 5. QUICK DESIGNATION MODAL ====================
export function QuickCreateDesignationModal({ isOpen, onClose, onAddDesignation, onDesignationCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("purchaser");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Designation Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (onAddDesignation) {
        await onAddDesignation({ title: title.trim(), description: description.trim(), role });
      }
      if (onDesignationCreated) onDesignationCreated(title.trim());
      onClose();
    } catch (err) {
      setError("Failed to create designation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999999 }}>
      <div className="glass-panel modal-content" style={{ maxWidth: "480px", width: "92%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "12px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Tag size={18} /> Create New Designation
          </h3>
          <button type="button" onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {error && <div className="alert-strip alert-danger" style={{ marginBottom: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="form-group">
            <label className="form-label">Designation Title *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Quality Auditor / Sourcing Manager"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Responsibilities</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. In charge of material inspection and vendor quality"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">System Access Role</label>
            <select className="form-control" value={role} onChange={e => setRole(e.target.value)}>
              <option value="purchaser" style={{ background: "#0f172a" }}>Purchaser (Standard Access)</option>
              <option value="coordinator" style={{ background: "#0f172a" }}>Logistics Coordinator</option>
              <option value="owner" style={{ background: "#0f172a" }}>Company Executive / Owner</option>
              <option value="superadmin" style={{ background: "#0f172a" }}>System Administrator</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Save Designation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
