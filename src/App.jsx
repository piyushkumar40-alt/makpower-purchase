import React, { useState, useEffect } from "react";
import { LogIn, ShoppingCart, ShieldAlert, LogOut, Settings, BarChart2, Package } from "lucide-react";
import LoginPage from "./components/LoginPage";
import RequesterForm from "./components/RequesterForm";
import PurchaserDashboard from "./components/PurchaserDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import NitinDashboard from "./components/NitinDashboard";
import RahulDashboard from "./components/RahulDashboard";
import CoordinatorDashboard from "./components/CoordinatorDashboard";
import { initialUsers, initialVendors, initialRequests, initialCargoShipments, initialCargoCompanies } from "./mockData";

export default function App() {
  // Load initial data from localStorage or mockData
  // Load initial data from Express DB API
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [cargoCompanies, setCargoCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("vanguard_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  // activeView: "login" | "requester" | "dashboard" | "admin" | "nitin" | "rahul" | "coordinator"
  const [activeView, setActiveView] = useState(() => {
    const savedUser = localStorage.getItem("vanguard_current_user");
    if (savedUser) {
      const u = JSON.parse(savedUser);
      if (u.role === "superadmin") return "admin";
      if (u.role === "nitin") return "nitin";
      if (u.role === "rahul") return "rahul";
      if (u.role === "coordinator") return "coordinator";
      return "dashboard";
    }
    return "login";
  });

  // Fetch full state on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/state");
        const data = await res.json();
        setUsers(data.users || []);
        setVendors(data.vendors || []);
        setRequests(data.requests || []);
        setCargos(data.cargos || []);
        setCargoCompanies(data.cargoCompanies || []);
      } catch (err) {
        console.error("Failed to load initial state from database API:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync active session only to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("vanguard_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("vanguard_current_user");
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

  // Auth Handlers
  const handleLogin = (email, password) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "active");
    if (user) {
      setCurrentUser(user);
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

  const handleLogout = () => {
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
    const reqsWithIds = newReqs.map((req, idx) => ({
      ...req,
      id: `req-${Date.now()}-${idx}`,
      isMaterialRec: "No",
      cargoId: "",
      priceRmb: "",
      totalRmb: "",
      advancePayment: "",
      balancePayment: "",
      photo: "",
      vendorEdd: "",
      packingOrderedByNitin: "No",
      purchaseUpdated: "No",
      notes: req.notes || "",
      itemNature: req.itemNature || "Non Consumables",
      category: req.category || "",
      requiredByDate: req.requiredByDate || "",
      entryBy: req.entryBy || "Guest"
    }));
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
          <div className="logo-area">
            <Package size={26} strokeWidth={2.5} />
            <span>MAK POWER PURCHASE</span>
          </div>

          <div className="nav-links">
            {/* View switching logic for logged-in users */}
            {currentUser && (
              <>
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
                  <BarChart2 size={14} /> Dashboard
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveView("requester")} 
              className={`btn btn-sm btn-secondary ${activeView === "requester" ? "active" : ""}`}
            >
              <ShoppingCart size={14} /> Requester Portal
            </button>

            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

      {/* Loading Screen Overlay */}
      {loading ? (
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", height: "80vh" }}>
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "4px solid var(--primary-glow)", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }}></div>
            <h2 style={{ fontSize: "1.4rem", textShadow: "0 0 10px var(--primary-glow)" }}>Connecting Database...</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Syncing Vanguard Purchase & Logistics ledger</p>
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

        {activeView === "requester" && (
          <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
            <RequesterForm 
              onAddRequests={addRequests} 
              purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")} 
              vendors={vendors} 
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
          />
        )}
      </main>
      )}
    </div>
  );
}
