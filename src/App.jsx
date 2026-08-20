import React, { useState, useEffect } from "react";
import { LogIn, ShoppingCart, ShieldAlert, LogOut, Settings, BarChart2, Package, Sun, Moon, Home, Menu, X, Building2 } from "lucide-react";
import LoginPage from "./components/LoginPage";
import RequesterForm from "./components/RequesterForm";
import PurchaserDashboard from "./components/PurchaserDashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import NitinDashboard from "./components/NitinDashboard";
import RahulDashboard from "./components/RahulDashboard";
import CoordinatorDashboard from "./components/CoordinatorDashboard";
import ItemMasterView from "./components/ItemMasterView";
import ItemCatalogPanel from "./components/ItemCatalogPanel";
import OwnerDashboard from "./components/OwnerDashboard";
import ItemDetailModal from "./components/ItemDetailModal";
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

  // Disable browser default Ctrl+D bookmarking globally app-wide
  useEffect(() => {
    const disableCtrlD = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", disableCtrlD, true);
    return () => window.removeEventListener("keydown", disableCtrlD, true);
  }, []);

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
  const [designations, setDesignations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({ isHidden: false, redirectUrl: "https://www.instagram.com/makpowerofficial/" });
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("makpower_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  // System Audit Activity Logger (Google Sheets-style version history)
  const logSystemActivity = async (action, details, entityType = "", entityId = "", oldData = null, newData = null) => {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: currentUser?.id || "system",
      userName: currentUser?.name || currentUser?.email || "System User",
      role: currentUser?.role || "user",
      action,
      details,
      entityType,
      entityId,
      oldData: oldData ? (typeof oldData === "string" ? oldData : JSON.stringify(oldData)) : "",
      newData: newData ? (typeof newData === "string" ? newData : JSON.stringify(newData)) : "",
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }),
      isoTime: new Date().toISOString()
    };
    try {
      await postData("/api/audit-logs", entry);
      setAuditLogs(prev => [entry, ...prev]);
    } catch (err) {
      console.error("Failed to record audit log:", err);
    }
  };

  // activeView: "login" | "home" | "requester" | "dashboard" | "admin" | "nitin" | "rahul" | "coordinator" | "itemcatalog" | "itemdetail"
  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem("makpower_active_view");
    const savedUser = localStorage.getItem("makpower_current_user");
    if (savedUser) {
      if (savedView && savedView !== "itemdetail") return savedView;
      return "home";
    }
    return "login";
  });

  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [previousViewBeforeItemDetail, setPreviousViewBeforeItemDetail] = useState("dashboard");

  const handleOpenItemDetail = (item) => {
    if (!item) return;
    setPreviousViewBeforeItemDetail(activeView);
    setSelectedItemForDetail(item);
    setActiveView("itemdetail");
  };

  const handleBackFromItemDetail = () => {
    setActiveView(previousViewBeforeItemDetail || "dashboard");
    setSelectedItemForDetail(null);
  };

  useEffect(() => {
    if (currentUser) {
      if (activeView !== "itemdetail") {
        localStorage.setItem("makpower_active_view", activeView);
      }
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

  const lastRefreshTsRef = React.useRef(null);

  // Fetch full state on mount & set up 10-second polling
  useEffect(() => {
    async function loadData(isInterval = false) {
      try {
        const [res, auditRes] = await Promise.all([
          fetch("/api/state"),
          fetch("/api/audit-logs")
        ]);
        const data = await res.json();
        setUsers(data.users || []);
        setVendors(data.vendors || []);
        setRequests((data.requests || []).map(r => ({ ...r, purchaseUpdated: r.purchaseUpdated || "No" })));
        setCargos(data.cargos || []);
        setCargoCompanies(data.cargoCompanies || []);
        setItems(data.items || []);
        setDesignations(data.designations || []);
        if (data.settings) {
          setSettings(data.settings);
          if (data.settings.forceRefreshTimestamp) {
            const incomingTs = Number(data.settings.forceRefreshTimestamp);
            if (lastRefreshTsRef.current === null) {
              lastRefreshTsRef.current = incomingTs;
            } else if (incomingTs > lastRefreshTsRef.current) {
              lastRefreshTsRef.current = incomingTs;
              console.log("⚡ Server requested force client webapp refresh. Reloading...");
              window.location.reload();
            }
          }
        }

        if (auditRes.ok) {
          const aLogs = await auditRes.json();
          setAuditLogs(aLogs || []);
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

  // Add Designation Handler
  const addDesignation = async (designationObj) => {
    const res = await postData("/api/designations", designationObj);
    if (res && res.success) {
      setDesignations(prev => [...prev.filter(d => d.title !== designationObj.title), res.designation]);
    }
    return res;
  };

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
    const cleanEmail = (email || "").trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password && u.status === "active");
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

      const roleLower = (user.role || "").toLowerCase();
      const desigLower = (user.designation || "").toLowerCase();

      if (roleLower === "superadmin" || desigLower === "system admin" || cleanEmail === "admin@makpowerindia.com" || cleanEmail === "admin@company.com") {
        setActiveView("admin");
      } else if (roleLower === "owner" || desigLower === "owner" || cleanEmail === "owner@makpowerindia.com") {
        setActiveView("owner");
      } else if (user.id === "u-nitin" || cleanEmail === "nitin@makpowerindia.com" || roleLower === "nitin") {
        setActiveView("nitin");
      } else if (user.id === "u-rahul" || cleanEmail === "rahul@makpowerindia.com") {
        setActiveView("rahul");
      } else if (user.id === "u-coordinator" || cleanEmail === "pc@makpowerindia.com" || roleLower === "coordinator") {
        setActiveView("coordinator");
      } else {
        setActiveView("dashboard");
      }
      logSystemActivity("USER_LOGIN", `User "${user.name}" (${user.role}) logged in successfully`, "User Session", user.id);
      return { success: true };
    }
    return { success: false, message: "Invalid email, password, or inactive account." };
  };

  const handleLogout = async () => {
    const sessionId = localStorage.getItem("makpower_session_id");
    if (currentUser) {
      logSystemActivity("USER_LOGOUT", `User "${currentUser.name}" signed out`, "User Session", currentUser.id);
      try {
        await postData("/api/auth/logout", { userId: currentUser.id, sessionId });
      } catch (err) {
        console.error("Logout notify error:", err);
      }
    }
    localStorage.removeItem("makpower_session_id");
    localStorage.removeItem("makpower_active_view");
    localStorage.removeItem("makpower_purchaser_tab");
    localStorage.removeItem("makpower_admin_subtab");
    localStorage.removeItem("makpower_nitin_tab");
    localStorage.removeItem("makpower_rahul_tab");
    localStorage.removeItem("makpower_coord_tab");
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
    const creatorName = reqsWithIds[0]?.entryBy || currentUser?.name || "Requester";
    const modelsSummary = reqsWithIds.map(r => `${r.model || "Item"} (${r.orderQuantity || 1} Pcs)`).join(", ");
    logSystemActivity(
      "CREATE_REQUEST", 
      `"${creatorName}" submitted ${reqsWithIds.length} new requisition(s): ${modelsSummary}`, 
      "Requisition", 
      reqsWithIds[0]?.id, 
      null, 
      reqsWithIds
    );
  };

  const updateRequest = async (updatedReq) => {
    const oldReq = requests.find(r => r.id === updatedReq.id);
    const newReq = {
      ...updatedReq,
      actualReceivedDate: updatedReq.isMaterialRec === "Yes" ? (updatedReq.actualReceivedDate || "2026-06-11") : ""
    };
    await postData("/api/requests", newReq);
    setRequests(prev => prev.map(r => r.id === newReq.id ? newReq : r));

    const vName = vendors.find(v => v.id === newReq.vendorId)?.name || "N/A";
    let actionLabel = "UPDATE_REQUEST";
    let detailText = `Updated requisition details for ${newReq.model} (#${newReq.id})`;
    if (!oldReq?.priceRmb && newReq.priceRmb) {
      actionLabel = "PRICE_REQUEST";
      detailText = `Priced ${newReq.model} (#${newReq.id}): ¥${newReq.priceRmb} RMB | EDD: ${newReq.vendorEdd} | Vendor: ${vName}`;
    } else if (!oldReq?.vendorReadyDate && newReq.vendorReadyDate) {
      actionLabel = "VENDOR_READY";
      detailText = `Marked vendor ready for ${newReq.model} (#${newReq.id}) on ${newReq.vendorReadyDate}`;
    } else if (oldReq?.isMaterialRec !== "Yes" && newReq.isMaterialRec === "Yes") {
      actionLabel = "MATERIAL_RECEIVED";
      detailText = `Marked material received for ${newReq.model} (#${newReq.id})`;
    }
    logSystemActivity(actionLabel, detailText, "Requisition", newReq.id, oldReq, newReq);
  };

  const batchUpdateRequests = async (updatedReqs, customAction = "BATCH_UPDATE_REQUESTS", customDetails = "") => {
    const mapped = updatedReqs.map(req => ({
      ...req,
      actualReceivedDate: req.isMaterialRec === "Yes" ? (req.actualReceivedDate || "2026-06-11") : ""
    }));
    await postData("/api/requests/batch", mapped);
    setRequests(prev => prev.map(r => {
      const match = mapped.find(x => x.id === r.id);
      return match ? match : r;
    }));
    const modelsList = mapped.map(r => r.model).filter(Boolean).join(", ");
    const detailText = customDetails || `Bulk updated ${mapped.length} requisition(s)${modelsList ? `: ${modelsList}` : ""}`;
    logSystemActivity(customAction, detailText, "Requisition", mapped[0]?.id, null, mapped);
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
    logSystemActivity("CANCEL_ORDER", `Cancelled purchase order ${target.model} (#${target.id}) ${reason ? `- Reason: ${reason}` : ""}`, "Requisition", target.id, target, updated);
  };

  const undoCargoAssignment = async (requestId) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;
    const updated = { ...target, cargoId: "", cargoAssignedAt: "" };
    await postData("/api/requests", updated);
    setRequests(prev => prev.map(r => r.id === requestId ? updated : r));
    logSystemActivity("UNDO_CARGO", `Undid cargo assignment for ${target.model} (#${target.id})`, "Requisition", target.id, target, updated);
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
    logSystemActivity("UNDO_PRICING", `Undid pricing for ${target.model} (#${target.id})`, "Requisition", target.id, target, updated);
  };

  const addCargo = async (cargoDetails, selectedRequestIds, itemPickedQtyMap = {}) => {
    const newCargoId = `cargo-${Date.now()}`;
    const newCargo = {
      id: newCargoId,
      ...cargoDetails,
      isMaterialRec: cargoDetails.isMaterialRec || "No",
      receivedDate: cargoDetails.isMaterialRec === "Yes" ? (cargoDetails.receivedDate || new Date().toISOString().split("T")[0]) : ""
    };

    await postData("/api/cargos", newCargo);
    setCargos(prev => [newCargo, ...prev]);

    const updatedItems = [];
    const newRemainingItems = [];

    requests.filter(r => selectedRequestIds.includes(r.id)).forEach(r => {
      const totalVendorQty = parseInt(r.vendorOrderQuantity || r.orderQuantity || 0);
      const pickedQty = itemPickedQtyMap[r.id] != null ? parseInt(itemPickedQtyMap[r.id]) : totalVendorQty;
      const remainingQty = totalVendorQty > pickedQty ? totalVendorQty - pickedQty : 0;

      const updatedReq = {
        ...r,
        cargoId: newCargoId,
        cargoPickedQty: pickedQty,
        vendorOrderQuantity: pickedQty,
        cargoAssignedAt: new Date().toISOString(),
        isMaterialRec: newCargo.isMaterialRec,
        actualReceivedDate: newCargo.isMaterialRec === "Yes" ? (cargoDetails.receivedDate || new Date().toISOString().split("T")[0]) : "",
        totalRmb: r.priceRmb ? parseFloat(r.priceRmb) * pickedQty : r.totalRmb
      };
      updatedItems.push(updatedReq);

      if (remainingQty > 0) {
        const remReq = {
          ...r,
          id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderQuantity: remainingQty,
          vendorOrderQuantity: remainingQty,
          cargoId: "",
          cargoPickedQty: 0,
          cargoAssignedAt: "",
          isMaterialRec: "No",
          actualReceivedDate: "",
          parentRequestId: r.id,
          status: "Active",
          notes: `${r.notes ? r.notes + " | " : ""}Partial cargo pickup: ${pickedQty} Pcs loaded to Cargo #${newCargoId}, ${remainingQty} Pcs balance left at vendor`
        };
        newRemainingItems.push(remReq);
      }
    });

    const allBatch = [...updatedItems, ...newRemainingItems];
    await postData("/api/requests/batch", allBatch);

    setRequests(prev => {
      const remainingMap = new Map(updatedItems.map(x => [x.id, x]));
      const updatedList = prev.map(r => remainingMap.has(r.id) ? remainingMap.get(r.id) : r);
      return [...newRemainingItems, ...updatedList];
    });

    logSystemActivity("CREATE_CARGO", `Created Cargo Shipment #${newCargoId} (${newCargo.cargoDetail || "Cargo"}) bundling ${selectedRequestIds.length} items`, "Cargo", newCargoId, null, newCargo);
  };

  const updateCargo = async (updatedCargo, itemReceiptMap = {}) => {
    const oldCargo = cargos.find(c => c.id === updatedCargo.id);
    const cargoWithDate = {
      ...updatedCargo,
      receivedDate: updatedCargo.isMaterialRec === "Yes" ? (updatedCargo.receivedDate || new Date().toISOString().split("T")[0]) : ""
    };
    await postData("/api/cargos", cargoWithDate);
    setCargos(prev => prev.map(c => c.id === cargoWithDate.id ? cargoWithDate : c));

    const updatedItems = [];
    const newShortageItems = [];

    requests.filter(r => r.cargoId === cargoWithDate.id).forEach(r => {
      const expectedQty = parseInt(r.cargoPickedQty || r.vendorOrderQuantity || r.orderQuantity || 0);
      const recInfo = itemReceiptMap[r.id];
      const receivedQty = (recInfo && recInfo.receivedQty != null) ? parseInt(recInfo.receivedQty) : (cargoWithDate.isMaterialRec === "Yes" ? expectedQty : (r.receivedQuantity || expectedQty));
      const shortageAction = recInfo?.shortageAction || "cancel";
      const shortageQty = expectedQty > receivedQty ? expectedQty - receivedQty : 0;

      const updatedReq = {
        ...r,
        isMaterialRec: cargoWithDate.isMaterialRec,
        actualReceivedDate: cargoWithDate.isMaterialRec === "Yes" ? (r.actualReceivedDate || cargoWithDate.receivedDate || new Date().toISOString().split("T")[0]) : "",
        receivedQuantity: receivedQty,
        shortageQty: shortageQty
      };
      updatedItems.push(updatedReq);

      if (cargoWithDate.isMaterialRec === "Yes" && shortageQty > 0 && shortageAction === "reorder") {
        const shortageReq = {
          ...r,
          id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderQuantity: shortageQty,
          vendorOrderQuantity: shortageQty,
          cargoId: "",
          cargoPickedQty: 0,
          cargoAssignedAt: "",
          isMaterialRec: "No",
          actualReceivedDate: "",
          parentRequestId: r.id,
          status: "Active",
          notes: `${r.notes ? r.notes + " | " : ""}Shortage re-order: ${shortageQty} Pcs short from Cargo #${updatedCargo.id}`
        };
        newShortageItems.push(shortageReq);
      }
    });

    if (updatedItems.length > 0 || newShortageItems.length > 0) {
      const allBatch = [...updatedItems, ...newShortageItems];
      await postData("/api/requests/batch", allBatch);
      setRequests(prev => {
        const updatedMap = new Map(updatedItems.map(x => [x.id, x]));
        const updatedList = prev.map(r => updatedMap.has(r.id) ? updatedMap.get(r.id) : r);
        return [...newShortageItems, ...updatedList];
      });
    }
    logSystemActivity("UPDATE_CARGO", `Updated Cargo Shipment #${updatedCargo.id} (${updatedCargo.cargoDetail || "Cargo"})`, "Cargo", updatedCargo.id, oldCargo, cargoWithDate);
  };

  const addPurchaser = async (name, email, password, designation = "Purchaser", explicitRole = null) => {
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, message: "User with this email already exists." };

    let role = explicitRole || "purchaser";
    if (!explicitRole) {
      const dLower = (designation || "").toLowerCase();
      if (dLower.includes("owner")) role = "owner";
      else if (dLower.includes("admin") || dLower.includes("superadmin")) role = "superadmin";
      else if (dLower.includes("logistics") || dLower.includes("coordinator")) role = "coordinator";
      else if (dLower === "nitin" || dLower.includes("packing manager")) role = "nitin";
      else if (dLower === "rahul" || dLower.includes("accounts update") || dLower.includes("purchase updater")) role = "rahul";
    }

    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      role,
      designation: designation || "Purchaser",
      status: "active"
    };
    const dbRes = await postData("/api/users", newUser);
    if (dbRes && (dbRes.success || dbRes.id)) {
      setUsers(prev => [...prev, newUser]);
      return { success: true, user: newUser, message: `✅ Staff account "${newUser.name}" saved to database successfully!` };
    }
    return { success: false, message: dbRes?.error || "Failed to save user account to database." };
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
    const trimmedName = name.trim();
    const existing = vendors.find(v => v.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return { success: true, vendor: existing, message: `✅ Vendor "${existing.name}" is active and ready in database.` };
    }

    const allPurchaserIds = users.filter(u => u.role === "purchaser").map(u => u.id);
    const validPurchaserIds = Array.isArray(purchaserIds) && purchaserIds.length > 0 
      ? purchaserIds 
      : allPurchaserIds;

    const newVendor = {
      id: `v-${Date.now()}`,
      name: trimmedName,
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: "Active",
      purchaserIds: validPurchaserIds
    };
    const dbRes = await postData("/api/vendors", newVendor);
    if (dbRes && (dbRes.success || dbRes.id)) {
      setVendors(prev => [...prev, newVendor]);
      logSystemActivity("CREATE_VENDOR", `Registered vendor "${newVendor.name}" (${newVendor.location || "China"})`, "Vendor", newVendor.id, null, newVendor);
      return { success: true, vendor: newVendor, message: `✅ Vendor "${newVendor.name}" saved to database successfully!` };
    }
    return { success: false, message: dbRes?.error || "Failed to save vendor to server database." };
  };

  const updateVendor = async (updatedVendor) => {
    const oldVendor = vendors.find(v => v.id === updatedVendor.id);
    const exists = vendors.some(v => v.id !== updatedVendor.id && v.name.trim().toLowerCase() === updatedVendor.name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Vendor "${updatedVendor.name}" already exists.` };
    }
    await postData("/api/vendors", updatedVendor);
    setVendors(prev => prev.map(v => v.id === updatedVendor.id ? updatedVendor : v));
    logSystemActivity("UPDATE_VENDOR", `Updated vendor "${updatedVendor.name}"`, "Vendor", updatedVendor.id, oldVendor, updatedVendor);
    return { success: true, message: `✅ Vendor "${updatedVendor.name}" updated in database successfully!` };
  };

  const updateCargoCompany = async (updatedCompany) => {
    const oldCompany = cargoCompanies.find(cc => cc.id === updatedCompany.id);
    const exists = cargoCompanies.some(cc => cc.id !== updatedCompany.id && cc.name.trim().toLowerCase() === updatedCompany.name.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Cargo company "${updatedCompany.name}" already exists.` };
    }
    await postData("/api/cargo-companies", updatedCompany);
    setCargoCompanies(prev => prev.map(cc => cc.id === updatedCompany.id ? updatedCompany : cc));
    logSystemActivity("UPDATE_CARGO_COMPANY", `Updated transport company "${updatedCompany.name}"`, "Cargo Carrier", updatedCompany.id, oldCompany, updatedCompany);
    return { success: true, message: `✅ Transport company "${updatedCompany.name}" updated in database successfully!` };
  };

  const removeVendor = async (vendorId) => {
    const target = vendors.find(v => v.id === vendorId);
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

    logSystemActivity("DELETE_VENDOR", `Removed vendor "${target?.name || vendorId}"`, "Vendor", vendorId);
    return { success: true };
  };

  const addCargoCompany = async (name, location = "", phone = "", history = "") => {
    const trimmedName = name.trim();
    const existing = cargoCompanies.find(cc => cc.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return { success: true, company: existing, message: `✅ Transport company "${existing.name}" is active and ready in database.` };
    }
    const newCompany = {
      id: `cc-${Date.now()}`,
      name: trimmedName,
      location: location.trim(),
      phone: phone.trim(),
      history: history.trim(),
      status: "Active"
    };
    const dbRes = await postData("/api/cargo-companies", newCompany);
    if (dbRes && (dbRes.success || dbRes.id)) {
      setCargoCompanies(prev => [...prev, newCompany]);
      logSystemActivity("CREATE_CARGO_COMPANY", `Registered transport company "${newCompany.name}"`, "Cargo Carrier", newCompany.id, null, newCompany);
      return { success: true, company: newCompany, message: `✅ Transport company "${newCompany.name}" saved to database successfully!` };
    }
    return { success: false, message: dbRes?.error || "Failed to save transport company to server database." };
  };

  const removeCargoCompany = async (companyId) => {
    const target = cargoCompanies.find(cc => cc.id === companyId);
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

    logSystemActivity("DELETE_CARGO_COMPANY", `Removed transport company "${target?.name || companyId}"`, "Cargo Carrier", companyId);
    return { success: true };
  };

  const addItem = async (newItem) => {
    const oldItem = items.find(i => i.id === newItem.id);
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
      logSystemActivity(oldItem ? "UPDATE_ITEM" : "CREATE_ITEM", `${oldItem ? "Updated" : "Added"} item "${newItem.name}" (${newItem.category}) in Master Catalog`, "Master Item", newItem.id, oldItem, newItem);
      return { ...res, item: newItem, message: `✅ Item "${newItem.name}" saved to database catalog successfully!` };
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

  const updateItemPhoto = async (itemId, newPhotoUrl, authorName) => {
    const updatedBy = authorName || currentUser?.name || "Purchaser";
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    const existingItem = items.find(i => i.id === itemId);
    if (!existingItem) return { success: false, error: "Item not found" };

    const oldPhoto = existingItem.photo;
    let photoHistory = Array.isArray(existingItem.photoHistory) ? [...existingItem.photoHistory] : [];
    if (oldPhoto && oldPhoto !== newPhotoUrl) {
      photoHistory.unshift({
        id: `ph-${Date.now()}`,
        photoUrl: oldPhoto,
        updatedBy: updatedBy,
        updatedAt: new Date().toISOString()
      });
    }

    const prunedHistory = photoHistory.filter(h => new Date(h.updatedAt || h.timestamp || Date.now()) >= sixMonthsAgo);

    const res = await postData("/api/items/update-photo", { itemId, photoUrl: newPhotoUrl, updatedBy });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, photo: newPhotoUrl, photoHistory: prunedHistory } : i));
    return res || { success: true };
  };

  const mergeItems = async (sourceId, targetId) => {
    const res = await postData("/api/items/merge", { sourceId, targetId });
    if (res && res.success) {
      setItems(prev => prev.filter(i => i.id !== sourceId));
    }
    return res;
  };

  const purgeAllData = async (purgeItems = true) => {
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

                {(currentUser.role === "owner" || currentUser.designation?.toLowerCase() === "owner" || currentUser.role === "superadmin") && (
                  <button 
                    onClick={() => setActiveView("owner")} 
                    className={`btn btn-sm btn-secondary ${activeView === "owner" ? "active" : ""}`}
                    style={{ borderColor: "#38bdf8", color: "#7dd3fc", fontWeight: 700 }}
                  >
                    <Building2 size={14} style={{ color: "#38bdf8" }} /> Executive Owner
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

            {currentUser && currentUser.role !== "superadmin" && (
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

              {currentUser && currentUser.role !== "superadmin" && (
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
          <div style={{ flex: 1, width: "100%", padding: "16px 24px" }}>
            <RequesterForm 
              onAddRequests={addRequests} 
              purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")} 
              vendors={vendors} 
              requests={requests}
              cargos={cargos}
              cargoCompanies={cargoCompanies}
              currentUser={currentUser}
              items={items}
              onAddItem={addItem}
              onAddPurchaser={addPurchaser}
            />
          </div>
        )}

        {activeView === "nitin" && currentUser && (
          <NitinDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            items={items}
            purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
            onBatchUpdateRequests={batchUpdateRequests}
            onLogout={handleLogout}
          />
        )}

        {activeView === "rahul" && currentUser && (
          <RahulDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
            onBatchUpdateRequests={batchUpdateRequests}
            onLogout={handleLogout}
          />
        )}

        {activeView === "coordinator" && currentUser && (
          <CoordinatorDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            users={users}
            onLogout={handleLogout}
          />
        )}

        {activeView === "owner" && currentUser && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
            <OwnerDashboard 
              currentUser={currentUser}
              requests={requests}
              cargos={cargos}
              vendors={vendors}
              users={users}
              items={items}
              cargoCompanies={cargoCompanies}
              settings={settings}
              onUpdateSettings={handleUpdateSystemSettings}
              onLogout={handleLogout}
            />
          </div>
        )}

        {activeView === "admin" && currentUser && (
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
            designations={designations}
            onAddDesignation={addDesignation}
          />
        )}

        {(activeView === "dashboard" || (currentUser && !["login", "home", "requester", "nitin", "rahul", "coordinator", "owner", "admin", "itemcatalog"].includes(activeView))) && (
          <PurchaserDashboard 
            currentUser={currentUser}
            requests={requests}
            vendors={vendors}
            cargos={cargos}
            cargoCompanies={cargoCompanies}
            purchasers={users.filter(u => u.role === "purchaser" && u.status === "active")}
            onUpdateRequest={updateRequest}
            batchUpdateRequests={batchUpdateRequests}
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

        {activeView === "itemcatalog" && currentUser && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
            <ItemCatalogPanel 
              items={items}
              onAddItem={addItem}
              onBulkAddItems={bulkAddItems}
              onDeleteItems={deleteItems}
              onUpdateItem={updateItem}
              onMergeItems={mergeItems}
              currentUser={currentUser}
              requests={requests}
              cargos={cargos}
              vendors={vendors}
              users={users}
              cargoCompanies={cargoCompanies}
              onViewItemDetail={handleOpenItemDetail}
              onUpdateItemPhoto={updateItemPhoto}
            />
          </div>
        )}

        {activeView === "itemdetail" && selectedItemForDetail && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
            <ItemDetailModal 
              item={items.find(i => i.id === selectedItemForDetail.id) || selectedItemForDetail}
              onClose={handleBackFromItemDetail}
              onBack={handleBackFromItemDetail}
              isFullPage={true}
              requests={requests}
              cargos={cargos}
              vendors={vendors}
              users={users}
              cargoCompanies={cargoCompanies}
              currentUser={currentUser}
              onUpdateItemPhoto={updateItemPhoto}
            />
          </div>
        )}
      </main>
      )}
    </div>
  );
}
