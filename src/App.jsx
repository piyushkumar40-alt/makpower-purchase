import React, { useState, useEffect } from "react";
import { LogIn, ShoppingCart, ShieldAlert, LogOut, Settings, BarChart2, Package, Sun, Moon, Home, Menu, X } from "lucide-react";
import LoginPage from "./components/LoginPage";
import RequesterForm from "./components/RequesterForm";
import PurchaserDashboard from "./components/PurchaserDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import NitinDashboard from "./components/NitinDashboard";
import RahulDashboard from "./components/RahulDashboard";
import CoordinatorDashboard from "./components/CoordinatorDashboard";
import ItemMasterView from "./components/ItemMasterView";
import HomePage from "./components/HomePage";
import { initialUsers, initialVendors, initialRequests, initialCargoShipments, initialCargoCompanies } from "./mockData";

export default function App() {
  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Theme State ("dark" | "light")
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("makpower_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("makpower_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  // Load initial data from localStorage or mockData
  // Load initial data from Express DB API
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [cargoCompanies, setCargoCompanies] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ isHidden: false, redirectUrl: "https://www.instagram.com/makpowerofficial/" });
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("makpower_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  // activeView: "login" | "home" | "requester" | "dashboard" | "admin" | "nitin" | "rahul" | "coordinator" | "itemcatalog"
  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem("makpower_active_view");
    const savedUser = localStorage.getItem("makpower_current_user");
    if (savedUser) {
      if (savedView) return savedView;
      return "home";
    }
    return "login";
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("makpower_active_view", activeView);
    } else {
      localStorage.removeItem("makpower_active_view");
    }
  }, [activeView, currentUser]);

  const handleGoHome = () => {
    if (!currentUser) {
      setActiveView("login");
      return;
    }
    setActiveView("home");
  };

  // Fetch full state on mount & set up 10-second polling
  useEffect(() => {
    async function loadData(isInterval = false) {
      try {
        const res = await fetch("/api/state");
        const data = await res.json();
        setUsers(data.users || []);
        setVendors(data.vendors || []);
        setRequests(data.requests || []);
        setCargos(data.cargos || []);
        setCargoCompanies(data.cargoCompanies || []);
        setItems(data.items || []);
        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error("Failed to load state from database API:", err);
      } finally {
        if (!isInterval) {
          setLoading(false);
        }
      }
    }
    
    loadData();

    const intervalId = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Panic Mode Redirection Check
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bypass") === "true") {
      localStorage.setItem("admin_bypass", "true");
    }

    if (!loading && settings && settings.isHidden) {
      if (localStorage.getItem("admin_bypass") === "true") {
        return;
      }
      window.location.href = settings.redirectUrl || "https://www.instagram.com/makpowerofficial/";
    }
  }, [loading, settings]);

  // Sync active session only to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("makpower_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("makpower_current_user");
    }
  }, [currentUser]);

  // DB post helper
  const postData = async (url, data) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      console.error(`Error posting to ${url}:`, err);
      return { success: false, error: err.message };
    }
  };

  // DB delete helper
  const deleteData = async (url) => {
    try {
      const res = await fetch(url, { method: "DELETE" });
      return await res.json();
    } catch (err) {
      console.error(`Error deleting ${url}:`, err);
      return { success: false, error: err.message };
    }
  };

  const handleUpdateSystemSettings = async (newSettings) => {
    setSettings(newSettings);
    const res = await postData("/api/settings", newSettings);
    return res;
  };

  // Check if session was explicitly revoked remotely by Admin
  useEffect(() => {
    if (!currentUser) return;
    async function checkSessionStatus() {
      try {
        const res = await fetch("/api/auth/sessions");
        const data = await res.json();
        if (data.success && Array.isArray(data.revokedUserIds)) {
          if (data.revokedUserIds.includes(currentUser.id)) {
            setCurrentUser(null);
            setActiveView("login");
            localStorage.removeItem("makpower_session_id");
          }
        }
      } catch (err) {
        // Silently ignore network checks
      }
    }

    const checkTimer = setInterval(checkSessionStatus, 15000);
    return () => clearInterval(checkTimer);
  }, [currentUser]);

  // Auth Handlers
  const handleLogin = async (email, password) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "active");
    if (user) {
      setCurrentUser(user);
      
      try {
        const res = await postData("/api/auth/login", { user });
        if (res.sessionId) {
          localStorage.setItem("makpower_session_id", res.sessionId);
        }
      } catch (err) {
        console.error("Login session record error:", err);
      }

      if (user.role === "superadmin") {
        setActiveView("admin");
      } else if (user.role === "nitin") {
        setActiveView("nitin");
      } else if (user.role === "rahul") {
        setActiveView("rahul");
      } else if (user.role === "coordinator") {
        setActiveView("coordinator");
      } else {
        setActiveView("dashboard");
      }
      return { success: true };
    }
    return { success: false, message: "Invalid email, password, or inactive account." };
  };

  const handleLogout = async () => {
    const sessionId = localStorage.getItem("makpower_session_id");
    if (currentUser) {
      try {
        await postData("/api/auth/logout", { userId: currentUser.id, sessionId });
      } catch (err) {
        console.error("Logout notify error:", err);
      }
    }
    localStorage.removeItem("makpower_session_id");
    setCurrentUser(null);
    setActiveView("login");
  };

  const enterAsGuest = () => {
    setCurrentUser(null);
    setActiveView("requester");
  };

  const addRequest = (newReq) => {
    addRequests([newReq]);
  };

  const addRequests = async (newReqs) => {
    const reqsWithIds = newReqs.map((req, idx) => {
      const lowerModel = (req.model || "").trim().toLowerCase();
      const existingPhoto = (settings && settings[`photo_${lowerModel}`]) ||
        (requests.find(r => (r.model || "").trim().toLowerCase() === lowerModel && r.photo)?.photo) ||
        "";

      return {
        ...req,
        id: `req-${Date.now()}-${idx}`,
        isMaterialRec: "No",
        cargoId: "",
        priceRmb: "",
        totalRmb: "",
        advancePayment: "",
        balancePayment: "",
        photo: req.photo || existingPhoto,
        vendorEdd: "",
        packingOrderedByNitin: "No",
        purchaseUpdated: "No",
        notes: req.notes || "",
        itemNature: req.itemNature || "Non Consumables",
        category: req.category || "",
        requiredByDate: req.requiredByDate || "",
        entryBy: req.entryBy || "Guest"
      };
    });
    await postData("/api/requests/batch", reqsWithIds);
    setRequests(prev => [...reqsWithIds, ...prev]);
  };

  const updateRequest = async (updatedReq) => {
    const newReq = {
      ...updatedReq,
      actualReceivedDate: updatedReq.isMaterialRec === "Yes" ? (updatedReq.actualReceivedDate || "2026-06-11") : ""
    };
    await postData("/api/requests", newReq);
    setRequests(prev => prev.map(r => r.id === newReq.id ? newReq : r));
  };

  const batchUpdateRequests = async (updatedReqs) => {
    const mapped = updatedReqs.map(req => ({
      ...req,
      actualReceivedDate: req.isMaterialRec === "Yes" ? (req.actualReceivedDate || "2026-06-11") : ""
    }));
    await postData("/api/requests/batch", mapped);
    setRequests(prev => prev.map(r => {
      const match = mapped.find(x => x.id === r.id);
      return match ? match : r;
    }));
  };

  const cancelRequest = async (requestId, reason = "") => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;
    const updated = {
      ...target,
      status: "Cancelled",
      cancellationReason: reason,
      cancelledAt: new Date().toISOString().split("T")[0]
    };
    await postData("/api/requests", updated);
    setRequests(prev => prev.map(r => r.id === requestId ? updated : r));
  };

  const undoCargoAssignment = async (requestId) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;
    const updated = { ...target, cargoId: "", cargoAssignedAt: "" };
    await postData("/api/requests", updated);
    setRequests(prev => prev.map(r => r.id === requestId ? updated : r));
  };

  const undoPricing = async (requestId) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;
    const updated = {
      ...target,
      vendorId: "",
      priceRmb: "",
      totalRmb: "",
      advancePayment: "",
      balancePayment: "",
      vendorEdd: "",
      currency: "",
      pricedAt: "",
      photo: ""
    };
    await postData("/api/requests", updated);
    setRequests(prev => prev.map(r => r.id === requestId ? updated : r));
  };

  const addCargo = async (cargoDetails, selectedRequestIds) => {
    const newCargoId = `cargo-${Date.now()}`;
    const newCargo = {
      id: newCargoId,
      ...cargoDetails,
      isMaterialRec: cargoDetails.isMaterialRec || "No",
      receivedDate: cargoDetails.isMaterialRec === "Yes" ? "2026-06-11" : ""
    };

    await postData("/api/cargos", newCargo);
    setCargos(prev => [newCargo, ...prev]);

    const updatedItems = requests.filter(r => selectedRequestIds.includes(r.id)).map(r => ({
      ...r,
      cargoId: newCargoId,
      cargoAssignedAt: new Date().toISOString(),
      isMaterialRec: newCargo.isMaterialRec,
      actualReceivedDate: newCargo.isMaterialRec === "Yes" ? "2026-06-11" : ""
    }));

    await postData("/api/requests/batch", updatedItems);
    setRequests(prev => prev.map(r => {
      const match = updatedItems.find(x => x.id === r.id);
      return match ? match : r;
    }));
  };

  const updateCargo = async (updatedCargo) => {
    const cargoWithDate = {
      ...updatedCargo,
      receivedDate: updatedCargo.isMaterialRec === "Yes" ? (updatedCargo.receivedDate || "2026-06-11") : ""
    };
    await postData("/api/cargos", cargoWithDate);
    setCargos(prev => prev.map(c => c.id === cargoWithDate.id ? cargoWithDate : c));

    const updatedItems = requests.filter(r => r.cargoId === cargoWithDate.id).map(r => ({
      ...r,
      isMaterialRec: cargoWithDate.isMaterialRec,
      actualReceivedDate: cargoWithDate.isMaterialRec === "Yes" ? (r.actualReceivedDate || "2026-06-11") : ""
    }));

    if (updatedItems.length > 0) {
      await postData("/api/requests/batch", updatedItems);
      setRequests(prev => prev.map(r => {
        const match = updatedItems.find(x => x.id === r.id);
        return match ? match : r;
      }));
    }
  };

  const addPurchaser = async (name, email, password) => {
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, message: "User with this email already exists." };

    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      role: "purchaser",
      status: "active"
    };
    await postData("/api/users", newUser);
    setUsers(prev => [...prev, newUser]);
    return { success: true };
  };

  const removePurchaser = async (purchaserId, transferDestId) => {
    await postData("/api/users/update", { id: purchaserId, updates: { status: "inactive" } });
    setUsers(prev => prev.map(u => u.id === purchaserId ? { ...u, status: "inactive" } : u));

    const updatedVendors = vendors.filter(v => v.purchaserIds.includes(purchaserId)).map(v => {
      const filtered = v.purchaserIds.filter(id => id !== purchaserId);
      if (!filtered.includes(transferDestId)) {
        filtered.push(transferDestId);
      }
      return { ...v, purchaserIds: filtered };
    });

    for (const v of updatedVendors) {
      await postData("/api/vendors", v);
    }
    setVendors(prev => prev.map(v => {
      const match = updatedVendors.find(x => x.id === v.id);
      return match ? match : v;
    }));

    const updatedRequests = requests.filter(r => r.purchaserId === purchaserId).map(r => ({
      ...r,
      purchaserId: transferDestId
    }));

    if (updatedRequests.length > 0) {
      await postData("/api/requests/batch", updatedRequests);
      setRequests(prev => prev.map(r => {
        const match = updatedRequests.find(x => x.id === r.id);
        return match ? match : r;
      }));
    }

    return { success: true };
  };

  const updateUserInfo = async (userId, updatedFields) => {
    await postData("/api/users/update", { id: userId, updates: updatedFields });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updatedFields } : u));
    return { success: true };
  };

  const addVendor = async (name, purchaserIds, location = "", phone = "", history = "") => {
    const exists = vendors.some(v => v.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Vendor "${name}" already exists.` };
    }
    const newVendor = {
      id: `v-${Date.now()}`,
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: "Active",
      purchaserIds: Array.isArray(purchaserIds) ? purchaserIds : [purchaserIds]
    };
    await postData("/api/vendors", newVendor);
    setVendors(prev => [...prev, newVendor]);
    return { success: true };
  };

  const updateVendor = async (updatedVendor) => {
    const exists = vendors.some(v => v.id !== updatedVendor.id && v.name.trim().toLowerCase() === updatedVendor.name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Vendor "${updatedVendor.name}" already exists.` };
    }
    await postData("/api/vendors", updatedVendor);
    setVendors(prev => prev.map(v => v.id === updatedVendor.id ? updatedVendor : v));
    return { success: true };
  };

  const updateCargoCompany = async (updatedCompany) => {
    const exists = cargoCompanies.some(cc => cc.id !== updatedCompany.id && cc.name.trim().toLowerCase() === updatedCompany.name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Cargo company "${updatedCompany.name}" already exists.` };
    }
    await postData("/api/cargo-companies", updatedCompany);
    setCargoCompanies(prev => prev.map(cc => cc.id === updatedCompany.id ? updatedCompany : cc));
    return { success: true };
  };

  const removeVendor = async (vendorId) => {
    await deleteData(`/api/vendors/${vendorId}`);
    setVendors(prev => prev.filter(v => v.id !== vendorId));

    const updatedReqs = requests.filter(r => r.vendorId === vendorId).map(r => ({ ...r, vendorId: "" }));
    if (updatedReqs.length > 0) {
      await postData("/api/requests/batch", updatedReqs);
      setRequests(prev => prev.map(r => {
        const match = updatedReqs.find(x => x.id === r.id);
        return match ? match : r;
      }));
    }

    const updatedCargos = cargos.filter(c => c.vendorId === vendorId).map(c => ({ ...c, vendorId: "" }));
    for (const c of updatedCargos) {
      await postData("/api/cargos", c);
    }
    setCargos(prev => prev.map(c => {
      const match = updatedCargos.find(x => x.id === c.id);
      return match ? match : c;
    }));

    return { success: true };
  };

  const addCargoCompany = async (name, location = "", phone = "", history = "") => {
    const exists = cargoCompanies.some(cc => cc.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Cargo company "${name}" already exists.` };
    }
    const newCompany = {
      id: `cc-${Date.now()}`,
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: "Active"
    };
    await postData("/api/cargo-companies", newCompany);
    setCargoCompanies(prev => [...prev, newCompany]);
    return { success: true };
  };

  const removeCargoCompany = async (companyId) => {
    await deleteData(`/api/cargo-companies/${companyId}`);
    setCargoCompanies(prev => prev.filter(cc => cc.id !== companyId));

    const updatedCargos = cargos.filter(c => c.cargoCompanyId === companyId).map(c => ({ ...c, cargoCompanyId: "" }));
    for (const c of updatedCargos) {
      await postData("/api/cargos", c);
    }
    setCargos(prev => prev.map(c => {
      const match = updatedCargos.find(x => x.id === c.id);
      return match ? match : c;
    }));

    return { success: true };
  };

  const addItem = async (newItem) => {
    const res = await postData("/api/items", newItem);
    if (res && res.success) {
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === newItem.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = newItem;
          return updated;
        }
        return [...prev, newItem];
      });
    }
    return res;
  };

  const bulkAddItems = async (itemList) => {
    const res = await postData("/api/items/bulk", { items: itemList });
    if (res && res.success) {
      setItems(prev => {
        const map = new Map(prev.map(i => [i.id, i]));
        itemList.forEach(i => map.set(i.id, i));
        return Array.from(map.values());
      });
    }
    return res;
  };

  const deleteItems = async (itemIds) => {
    const res = await postData("/api/items/delete", { ids: itemIds });
    if (res && res.success) {
      setItems(prev => prev.filter(i => !itemIds.includes(i.id)));
    }
    return res;
  };

  const updateItem = async (itemObj) => {
    const res = await postData("/api/items/update", itemObj);
    if (res && res.success) {
      setItems(prev => prev.map(i => i.id === itemObj.id ? { ...i, ...itemObj } : i));
    }
    return res;
  };

  const mergeItems = async (sourceId, targetId) => {
    const res = await postData("/api/items/merge", { sourceId, targetId });
    if (res && res.success) {
      setItems(prev => prev.filter(i => i.id !== sourceId));
    }
    return res;
  };

  const purgeAllData = async (purgeItems = false) => {
    const res = await postData("/api/data/purge", { purgeItems });
    if (res && res.success) {
      setRequests([]);
      setCargos([]);
      setVendors([]);
      setCargoCompanies([]);
      if (purgeItems) setItems([]);
    }
    return res;
  };

  const exportBackupData = () => {
    return JSON.stringify({ users, vendors, requests, cargos, cargoCompanies });
  };

  const importBackupData = async (dataObj) => {
    await postData("/api/backup/import", dataObj);
    if (dataObj.users) setUsers(dataObj.users);
    if (dataObj.vendors) setVendors(dataObj.vendors);
    if (dataObj.requests) setRequests(dataObj.requests);
    if (dataObj.cargos) setCargos(dataObj.cargos);
    if (dataObj.cargoCompanies) setCargoCompanies(dataObj.cargoCompanies);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-area" onClick={handleGoHome} style={{ cursor: "pointer" }}>
            <Package size={26} strokeWidth={2.5} />
            <span>MAK POWER PURCHASE</span>
          </div>

          {/* Mobile hamburger menu toggle */}
          <button 
            className="mobile-menu-toggle btn btn-sm btn-secondary" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Desktop Navigation Links */}
          <div className="nav-links">
            {currentUser && (
              <>
                <button 
                  onClick={handleGoHome} 
                  className={`btn btn-sm btn-secondary ${activeView === "home" ? "active" : ""}`}
                  title="Go to Home Page"
                  style={{ fontWeight: 600 }}
                >
                  <Home size={14} style={{ color: "var(--primary)" }} /> Home
                </button>

                {currentUser.role === "superadmin" && (
                  <button 
                    onClick={() => setActiveView("admin")} 
                    className={`btn btn-sm btn-secondary ${activeView === "admin" ? "active" : ""}`}
                  >
                    <Settings size={14} /> Admin
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    if (currentUser.role === "nitin") setActiveView("nitin");
                    else if (currentUser.role === "rahul") setActiveView("rahul");
                    else if (currentUser.role === "coordinator") setActiveView("coordinator");
                    else setActiveView("dashboard");
                  }} 
                  className={`btn btn-sm btn-secondary ${["dashboard", "nitin", "rahul", "coordinator"].includes(activeView) ? "active" : ""}`}
                >
                  <BarChart2 size={14} /> Workboard
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveView("requester")} 
              className={`btn btn-sm btn-secondary ${activeView === "requester" ? "active" : ""}`}
            >
              <ShoppingCart size={14} /> Requester Portal
            </button>

            {currentUser?.role !== "superadmin" && (
              <button 
                onClick={() => setActiveView("itemcatalog")} 
                className={`btn btn-sm btn-secondary ${activeView === "itemcatalog" ? "active" : ""}`}
                style={{ color: "var(--primary)", fontWeight: 700 }}
              >
                <Package size={14} /> Item Catalog & Stock
              </button>
            )}

            {/* Global Light / Dark Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="btn btn-sm btn-secondary"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {theme === "dark" ? <Sun size={14} style={{ color: "#f59e0b" }} /> : <Moon size={14} style={{ color: "#818cf8" }} />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>

            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span className="user-badge">
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: currentUser.role === "superadmin" ? "#f59e0b" : currentUser.role === "nitin" ? "#ec4899" : currentUser.role === "rahul" ? "#10b981" : "#38bdf8" }}></span>
                  {currentUser.name} ({currentUser.role === "superadmin" ? "Admin" : currentUser.role === "nitin" ? "Nitin" : currentUser.role === "rahul" ? "Rahul" : "Purchaser"})
                </span>
                <button onClick={handleLogout} className="btn btn-sm btn-danger">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            ) : (
              activeView !== "login" && (
                <button onClick={() => setActiveView("login")} className="btn btn-sm btn-primary">
                  <LogIn size={14} /> Staff Login
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* ==================== ANIMATED MOBILE NAVIGATION DRAWER ==================== */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-panel" onClick={e => e.stopPropagation()}>
            
            {/* Drawer Header */}
            <div className="mobile-drawer-header">
              <div className="logo-area" style={{ fontSize: "1.15rem" }} onClick={() => { handleGoHome(); setMobileMenuOpen(false); }}>
                <Package size={22} strokeWidth={2.5} />
                <span>MAK POWER</span>
              </div>
              <button 
                className="mobile-drawer-close" 
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Profile Info Card */}
            {currentUser && (
              <div className="mobile-user-card">
                <span 
                  className="user-role-dot" 
                  style={{ background: currentUser.role === "superadmin" ? "#f59e0b" : currentUser.role === "nitin" ? "#ec4899" : currentUser.role === "rahul" ? "#10b981" : "#38bdf8" }}
                ></span>
                <div className="mobile-user-details">
                  <span className="mobile-user-name">{currentUser.name}</span>
                  <span className="mobile-user-role">
                    {currentUser.role === "superadmin" ? "Super Admin" : currentUser.role === "nitin" ? "Nitin Manager" : currentUser.role === "rahul" ? "Rahul Manager" : "Purchaser"}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Nav Links List */}
            <div className="mobile-nav-list">
              {currentUser && (
                <>
                  <button 
                    onClick={() => { handleGoHome(); setMobileMenuOpen(false); }} 
                    className={`mobile-nav-item ${activeView === "home" ? "active" : ""}`}
                  >
                    <Home size={18} /> <span>Home</span>
                  </button>

                  {currentUser.role === "superadmin" && (
                    <button 
                      onClick={() => { setActiveView("admin"); setMobileMenuOpen(false); }} 
                      className={`mobile-nav-item ${activeView === "admin" ? "active" : ""}`}
                    >
                      <Settings size={18} /> <span>Admin Console</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (currentUser.role === "nitin") setActiveView("nitin");
                      else if (currentUser.role === "rahul") setActiveView("rahul");
                      else if (currentUser.role === "coordinator") setActiveView("coordinator");
                      else setActiveView("dashboard");
                    }} 
                    className={`mobile-nav-item ${["dashboard", "nitin", "rahul", "coordinator"].includes(activeView) ? "active" : ""}`}
                  >
                    <BarChart2 size={18} /> <span>Operations Workboard</span>
                  </button>
                </>
              )}

              <button 
                onClick={() => { setActiveView("requester"); setMobileMenuOpen(false); }} 
                className={`mobile-nav-item ${activeView === "requester" ? "active" : ""}`}
              >
                <ShoppingCart size={18} /> <span>Requester Portal</span>
              </button>

              {currentUser?.role !== "superadmin" && (
                <button 
                  onClick={() => { setActiveView("itemcatalog"); setMobileMenuOpen(false); }} 
                  className={`mobile-nav-item ${activeView === "itemcatalog" ? "active" : ""}`}
                >
                  <Package size={18} /> <span>Item Catalog & Stock</span>
                </button>
              )}

              {/* Theme Toggle Button */}
              <button 
                onClick={() => { toggleTheme(); }} 
                className="mobile-nav-item theme-switch-item"
              >
                {theme === "dark" ? <Sun size={18} style={{ color: "#f59e0b" }} /> : <Moon size={18} style={{ color: "#818cf8" }} />}
                <span>{theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
              </button>

              {currentUser ? (
                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }} 
                  className="mobile-nav-item logout-item"
                >
                  <LogOut size={18} /> <span>Logout</span>
                </button>
              ) : (
                activeView !== "login" && (
                  <button 
                    onClick={() => { setActiveView("login"); setMobileMenuOpen(false); }} 
                    className="mobile-nav-item login-item"
                  >
                    <LogIn size={18} /> <span>Staff Login</span>
                  </button>
                )
              )}
            </div>

          </div>
        </div>
      )}

      {/* Loading Screen Overlay */}
      {loading ? (
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", height: "80vh" }}>
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "4px solid var(--primary-glow)", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }}></div>
            <h2 style={{ fontSize: "1.4rem", textShadow: "0 0 10px var(--primary-glow)" }}>Connecting...</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Syncing Mak Power Purchase Ledger</p>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        /* Main App Screens */
        <main className="main-content-area" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {activeView === "login" && (
            <LoginPage onLogin={handleLogin} onEnterAsGuest={enterAsGuest} users={users} />
          )}

          {activeView === "home" && currentUser && (
            <HomePage 
              currentUser={currentUser}
              users={users}
              requests={requests}
              vendors={vendors}
              cargos={cargos}
              cargoCompanies={cargoCompanies}
              onNavigateView={setActiveView}
              onLogout={handleLogout}
            />
          )}

        {activeView === "requester" && (
          <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
            <RequesterForm 
              onAddRequests={addRequests} 
              purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")} 
              vendors={vendors} 
              requests={requests}
              cargos={cargos}
              cargoCompanies={cargoCompanies}
              currentUser={currentUser}
            />
          </div>
        )}

        {activeView === "nitin" && currentUser?.role === "nitin" && (
          <NitinDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            onBatchUpdateRequests={batchUpdateRequests}
            onLogout={handleLogout}
          />
        )}

        {activeView === "rahul" && currentUser?.role === "rahul" && (
          <RahulDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            onBatchUpdateRequests={batchUpdateRequests}
            onLogout={handleLogout}
          />
        )}

        {activeView === "dashboard" && currentUser && (
          <PurchaserDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            cargoCompanies={cargoCompanies}
            purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
            onUpdateRequest={updateRequest}
            onCancelOrder={cancelRequest}
            onUndoCargoAssignment={undoCargoAssignment}
            onUndoPricing={undoPricing}
            onAddCargo={addCargo}
            onUpdateCargo={updateCargo}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onRemoveVendor={removeVendor}
            onAddCargoCompany={addCargoCompany}
            onUpdateCargoCompany={updateCargoCompany}
            onRemoveCargoCompany={removeCargoCompany}
            items={items}
            onAddItem={addItem}
            onBulkAddItems={bulkAddItems}
            onDeleteItems={deleteItems}
            onUpdateItem={updateItem}
            onMergeItems={mergeItems}
          />
        )}

        {activeView === "coordinator" && currentUser?.role === "coordinator" && (
          <CoordinatorDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            users={users}
            onLogout={handleLogout}
          />
        )}

        {activeView === "admin" && currentUser?.role === "superadmin" && (
          <SuperAdminDashboard 
            users={users}
            vendors={vendors}
            requests={requests}
            cargos={cargos}
            cargoCompanies={cargoCompanies}
            onAddPurchaser={addPurchaser}
            onRemovePurchaser={removePurchaser}
            onAddVendor={addVendor}
            onUpdateVendor={updateVendor}
            onRemoveVendor={removeVendor}
            onAddCargoCompany={addCargoCompany}
            onUpdateCargoCompany={updateCargoCompany}
            onRemoveCargoCompany={removeCargoCompany}
            onExportBackup={exportBackupData}
            onImportBackup={importBackupData}
            onUpdateUserInfo={updateUserInfo}
            settings={settings}
            onUpdateSettings={handleUpdateSystemSettings}
            onBatchUpdateRequests={batchUpdateRequests}
            items={items}
            onAddItem={addItem}
            onBulkAddItems={bulkAddItems}
            onDeleteItems={deleteItems}
            onUpdateItem={updateItem}
            onMergeItems={mergeItems}
            onPurgeAllData={purgeAllData}
          />
        )}

        {activeView === "itemcatalog" && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
            <ItemMasterView 
              requests={requests} 
              vendors={vendors} 
              cargos={cargos} 
              cargoCompanies={cargoCompanies} 
              purchasers={users.filter(u => u.role === "purchaser")} 
              settings={settings}
              onUpdateSettings={handleUpdateSystemSettings}
              onBatchUpdateRequests={batchUpdateRequests}
            />
          </div>
        )}
      </main>
      )}
    </div>
  );
}
