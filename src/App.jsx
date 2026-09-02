import React, { useState, useEffect, useMemo, useRef } from "react";
import { LogIn, ShoppingCart, ShieldAlert, LogOut, Settings, BarChart2, Package, Sun, Moon, Home, Menu, X, Building2, RefreshCw, Search, Bell, Briefcase, Layers } from "lucide-react";
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
import CrmDashboard from "./components/CrmDashboard";
import ImsDashboard from "./components/ImsDashboard";
import { initialUsers, initialVendors, initialRequests, initialCargoShipments, initialCargoCompanies, initialCrmParties, initialCrmSalesOrders, initialCrmDispatches, initialImsTransactions } from "./mockData";
import { 
  recordUserLogin, 
  recordSectionVisit, 
  getPredictivePreloadSections, 
  TRACKABLE_MODULES 
} from "./utils/userIntentionTracker";
import { isDateInBetween } from "./components/DateRangeFilter";

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
  // Load initial data from localStorage cache for 0ms instant startup
  const cachedState = React.useMemo(() => {
    try {
      const saved = localStorage.getItem("makpower_app_state_cache");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const [users, setUsers] = useState(() => {
    if (cachedState?.users && Array.isArray(cachedState.users) && cachedState.users.length > 0) {
      return cachedState.users;
    }
    return initialUsers;
  });
  const [vendors, setVendors] = useState(() => cachedState?.vendors || []);
  const [requests, setRequests] = useState(() => cachedState?.requests || []);
  const [cargos, setCargos] = useState(() => cachedState?.cargos || []);
  const [cargoCompanies, setCargoCompanies] = useState(() => cachedState?.cargoCompanies || []);
  const [items, setItems] = useState(() => cachedState?.items || []);
  const [designations, setDesignations] = useState(() => cachedState?.designations || []);
  const [crmParties, setCrmParties] = useState(() => cachedState?.crmParties || []);
  const [crmSalesOrders, setCrmSalesOrders] = useState(() => cachedState?.crmSalesOrders || []);
  const [crmDispatches, setCrmDispatches] = useState(() => cachedState?.crmDispatches || []);
  const [auditLogs, setAuditLogs] = useState([]);
  const [imsTransactions, setImsTransactions] = useState(() => {
    if (cachedState?.imsTransactions && Array.isArray(cachedState.imsTransactions)) {
      return cachedState.imsTransactions;
    }
    return [];
  });
  const [imsSummary, setImsSummary] = useState(() => cachedState?.imsSummary || null);
  const [imsPeriodSummary, setImsPeriodSummary] = useState(null);
  const [imsItemStocks, setImsItemStocks] = useState(() => cachedState?.imsSummary?.itemStocks || []);
  const [imsRange, setImsRange] = useState("3days");
  const [itemPrices, setItemPrices] = useState(() => {
    if (cachedState?.itemPrices && Array.isArray(cachedState.itemPrices)) {
      return cachedState.itemPrices;
    }
    return [];
  });
  const [crmPartyRemarks, setCrmPartyRemarks] = useState(() => {
    if (cachedState?.crmPartyRemarks && Array.isArray(cachedState.crmPartyRemarks)) {
      return cachedState.crmPartyRemarks;
    }
    return [];
  });
  const [settings, setSettings] = useState(() => cachedState?.settings || { isHidden: false, redirectUrl: "https://www.instagram.com/makpowerofficial/" });
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const handleHardCacheRefresh = async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn("Cache clearing warning:", e);
    }
    const cleanUrl = window.location.origin + window.location.pathname + "?nocache=" + Date.now();
    window.location.href = cleanUrl;
  };

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("makpower_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  // On-Demand Data Pulling & Loading State
  const [loadingModules, setLoadingModules] = useState({});
  const activePullPromisesRef = React.useRef({});
  const loadedModulesRef = React.useRef(new Set());

  const pullModuleData = React.useCallback(async (moduleKey, force = false) => {
    if (!moduleKey) return;
    if (!force && loadedModulesRef.current.has(moduleKey) && !activePullPromisesRef.current[moduleKey]) {
      return; // Already loaded and cached in memory
    }
    if (activePullPromisesRef.current[moduleKey]) {
      return activePullPromisesRef.current[moduleKey]; // Deduplicate concurrent in-flight pulls
    }

    setLoadingModules(prev => ({ ...prev, [moduleKey]: true }));

    const pullPromise = (async () => {
      try {
        if (moduleKey === TRACKABLE_MODULES.USERS || moduleKey === "users") {
          const res = await fetch("/api/users");
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setUsers(data.map(u => ({ ...u, name: sanitizeUserName(u.name) })));
          } else {
            setUsers(initialUsers);
          }
        } else if (moduleKey === TRACKABLE_MODULES.VENDORS) {
          const res = await fetch("/api/vendors");
          const data = await res.json();
          if (Array.isArray(data)) setVendors(data);
        } else if (moduleKey === TRACKABLE_MODULES.CARGO_COMPANIES) {
          const res = await fetch("/api/cargo-companies");
          const data = await res.json();
          if (Array.isArray(data)) setCargoCompanies(data);
        } else if (moduleKey === TRACKABLE_MODULES.CARGOS) {
          const res = await fetch("/api/cargos");
          const data = await res.json();
          if (Array.isArray(data)) setCargos(data);
        } else if (moduleKey === TRACKABLE_MODULES.REQUESTS) {
          const res = await fetch("/api/requests");
          const data = await res.json();
          if (Array.isArray(data)) setRequests(data.map(r => ({ ...r, purchaseUpdated: r.purchaseUpdated || "No" })));
        } else if (moduleKey === TRACKABLE_MODULES.ITEMS) {
          const res = await fetch("/api/items");
          const data = await res.json();
          if (Array.isArray(data)) setItems(data);
        } else if (moduleKey === TRACKABLE_MODULES.CRM_PARTIES) {
          const q = currentUser ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}&userName=${encodeURIComponent(currentUser.name || '')}` : "";
          const res = await fetch(`/api/crm/parties${q}`);
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.parties || []);
          setCrmParties(list);
        } else if (moduleKey === TRACKABLE_MODULES.CRM_SALES_ORDERS) {
          const q = currentUser ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}&userName=${encodeURIComponent(currentUser.name || '')}` : "";
          const res = await fetch(`/api/crm/sales-orders${q}`);
          const data = await res.json();
          if (Array.isArray(data)) setCrmSalesOrders(data);
        } else if (moduleKey === TRACKABLE_MODULES.CRM_DISPATCHES) {
          const q = currentUser ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}&userName=${encodeURIComponent(currentUser.name || '')}` : "";
          const res = await fetch(`/api/crm/dispatches${q}`);
          const data = await res.json();
          if (Array.isArray(data)) setCrmDispatches(data);
        } else if (moduleKey === TRACKABLE_MODULES.IMS_TRANSACTIONS || moduleKey === "imsTransactions") {
          let query = "";
          if (typeof force === "object" && force !== null) {
            const params = new URLSearchParams();
            if (force.startDate) params.append("startDate", force.startDate);
            if (force.endDate) params.append("endDate", force.endDate);
            if (force.range) params.append("range", force.range);
            query = `?${params.toString()}`;
          } else if (force === "all") {
            query = "?range=all";
          } else {
            const d = new Date();
            d.setDate(d.getDate() - 3);
            const start3Days = d.toISOString().split("T")[0];
            const todayStr = (new Date()).toISOString().split("T")[0];
            query = `?startDate=${start3Days}&endDate=${todayStr}`;
          }
          const res = await fetch(`/api/ims/transactions${query}`);
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.transactions || []);
          setImsTransactions(list);
          if (data?.imsSummary) {
            setImsSummary(data.imsSummary);
          }
          if (data?.periodSummary) {
            setImsPeriodSummary(data.periodSummary);
          }
          if (data?.itemStocks) {
            setImsItemStocks(data.itemStocks);
          }
          setImsRange(data?.range || (force === "all" ? "all" : "3days"));
        } else if (moduleKey === TRACKABLE_MODULES.AUDIT_LOGS) {
          const res = await fetch("/api/audit-logs");
          const data = await res.json();
          if (Array.isArray(data)) setAuditLogs(data);
        } else if (moduleKey === TRACKABLE_MODULES.DESIGNATIONS) {
          const res = await fetch("/api/designations");
          const data = await res.json();
          if (Array.isArray(data)) setDesignations(data);
        }
        loadedModulesRef.current.add(moduleKey);
      } catch (err) {
        console.error(`Error pulling module data [${moduleKey}]:`, err);
      } finally {
        setLoadingModules(prev => ({ ...prev, [moduleKey]: false }));
        delete activePullPromisesRef.current[moduleKey];
      }
    })();

    activePullPromisesRef.current[moduleKey] = pullPromise;
    return pullPromise;
  }, []);

  // Adaptive Predictive Preload Trigger on Login / Session Start
  useEffect(() => {
    if (currentUser && currentUser.id) {
      recordUserLogin(currentUser.id);
      const predictivePreloads = getPredictivePreloadSections(currentUser.id);
      if (predictivePreloads.length > 0) {
        predictivePreloads.forEach(modKey => {
          pullModuleData(modKey, false);
        });
      }
    }
  }, [currentUser, pullModuleData]);

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
      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      }).catch(() => {});
      setAuditLogs(prev => [entry, ...prev]);
    } catch (err) {
      console.error("Failed to record audit log:", err);
    }
  };

  // activeView: "login" | "home" | "requester" | "dashboard" | "admin" | "nitin" | "rahul" | "coordinator" | "itemcatalog" | "itemdetail"
  const [activeView, setActiveView] = useState(() => {
    const savedUser = localStorage.getItem("makpower_current_user");
    const savedView = localStorage.getItem("makpower_active_view");
    if (savedUser) {
      if (savedView && savedView !== "itemdetail" && savedView !== "login") return savedView;
      try {
        const u = JSON.parse(savedUser);
        const r = (u.role || "").toLowerCase();
        if (r === "superadmin") return "admin";
        if (r === "crm" || r === "asm" || r === "tsm") return "crm";
        if (r === "owner") return "owner";
      } catch (e) {}
      return "home";
    }
    return "login";
  });

  useEffect(() => {
    if (currentUser && activeView === "login") {
      const r = (currentUser.role || "").toLowerCase();
      if (r === "superadmin") setActiveView("admin");
      else if (r === "crm" || r === "asm" || r === "tsm") setActiveView("crm");
      else if (r === "owner") setActiveView("owner");
      else setActiveView("home");
    }
  }, [currentUser, activeView]);

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

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("makpower_read_notifications") || "[]");
    } catch (e) {
      return [];
    }
  });

  // Calculate real-time notifications for the active user (remarks, allocations)
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    const list = [];
    const readSet = new Set(readNotificationIds);

    if (["crm", "asm", "tsm", "superadmin", "owner"].includes(currentUser.role)) {
      (crmPartyRemarks || []).forEach(r => {
        const isOwnParty = (crmParties || []).some(p => 
          (p.id === r.partyId || (p.name && r.partyName && p.name.trim().toLowerCase() === r.partyName.trim().toLowerCase())) &&
          (currentUser.role === "superadmin" || currentUser.role === "owner" || p.assignedCrmId === currentUser.id || p.assignedAsmId === currentUser.id || p.assignedTsmId === currentUser.id)
        );
        const isNotAuthor = r.authorId !== currentUser.id && r.authorName !== currentUser.name;

        if (isOwnParty && isNotAuthor) {
          list.push({
            id: `rem-${r.id}`,
            title: `Remark on ${r.partyName}`,
            description: `${r.authorName} (${r.authorRole?.toUpperCase()}): "${r.remark}" [${r.category}]`,
            time: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "Recent",
            read: readSet.has(`rem-${r.id}`),
            type: "remark",
            data: r
          });
        }
      });
    }

    return list.sort((a, b) => (b.data?.createdAt || "").localeCompare(a.data?.createdAt || ""));
  }, [currentUser, crmPartyRemarks, crmParties, readNotificationIds]);

  const unreadNotificationsCount = userNotifications.filter(n => !n.read).length;

  const sanitizeUserName = (name) => {
    if (!name) return "";
    let clean = String(name).trim();
    clean = clean.replace(/^(mr\.|mrs\.|miss|ms\.)\s+((mr\.|mrs\.|miss|ms\.)\s+)/i, "$2");
    return clean;
  };

  // Fetch full state on mount & set up 15-second background sync
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: only fallback after 3 minutes if backend fails completely
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }, 180000);

    async function loadData(isInterval = false) {
      try {
        const q = currentUser ? `?userId=${encodeURIComponent(currentUser.id)}&userRole=${encodeURIComponent(currentUser.role)}&userName=${encodeURIComponent(currentUser.name || '')}` : "";
        const res = await fetch(`/api/state${q}`);
        const data = await res.json();
        if (!isMounted) return;

        if (Array.isArray(data.users)) setUsers(data.users.map(u => ({ ...u, name: sanitizeUserName(u.name) })));
        if (Array.isArray(data.vendors)) setVendors(data.vendors);
        if (Array.isArray(data.requests)) setRequests(data.requests.map(r => ({ ...r, purchaseUpdated: r.purchaseUpdated || "No" })));
        if (Array.isArray(data.cargos)) setCargos(data.cargos);
        if (Array.isArray(data.cargoCompanies)) setCargoCompanies(data.cargoCompanies);
        if (Array.isArray(data.items)) setItems(data.items);
        if (Array.isArray(data.designations)) setDesignations(data.designations);
        if (Array.isArray(data.crmParties)) setCrmParties(data.crmParties);
        if (Array.isArray(data.crmSalesOrders)) setCrmSalesOrders(data.crmSalesOrders);
        if (Array.isArray(data.crmDispatches)) setCrmDispatches(data.crmDispatches);
        if (data.imsSummary) {
          setImsSummary(data.imsSummary);
        }
        if (Array.isArray(data.imsTransactions)) {
          if (!loadedModulesRef.current.has(TRACKABLE_MODULES.IMS_TRANSACTIONS) && !loadedModulesRef.current.has("imsTransactions")) {
            setImsTransactions(data.imsTransactions);
          }
        }
        if (Array.isArray(data.itemPrices)) {
          setItemPrices(data.itemPrices);
        }
        if (Array.isArray(data.crmPartyRemarks)) {
          setCrmPartyRemarks(data.crmPartyRemarks);
        }
        
        if (data.settings) {
          setSettings(data.settings);
          if (data.settings.forceRefreshTimestamp) {
            const incomingTs = Number(data.settings.forceRefreshTimestamp);
            if (lastRefreshTsRef.current === null) {
              lastRefreshTsRef.current = incomingTs;
            } else if (incomingTs > lastRefreshTsRef.current) {
              lastRefreshTsRef.current = incomingTs;
              console.log("⚡ New update signal received from server. Showing red banner...");
              setShowUpdateBanner(true);
            }
          }
        }

        setTimeout(() => {
          try {
            localStorage.setItem("makpower_app_state_cache", JSON.stringify({
              users: data.users || [],
              vendors: data.vendors || [],
              requests: data.requests || [],
              cargos: data.cargos || [],
              cargoCompanies: data.cargoCompanies || [],
              items: data.items || [],
              designations: data.designations || [],
              crmParties: data.crmParties || [],
              crmSalesOrders: data.crmSalesOrders || [],
              crmDispatches: data.crmDispatches || [],
              imsTransactions: (data.imsTransactions || []).slice(0, 1000),
              imsSummary: data.imsSummary || null,
              itemPrices: data.itemPrices || [],
              crmPartyRemarks: data.crmPartyRemarks || [],
              settings: data.settings || {}
            }));
          } catch (e) {
            console.warn("Local cache save warning:", e);
          }
        }, 50);

        if (!isInterval) {
          fetch("/api/audit-logs")
            .then(r => r.json())
            .then(logs => { if (isMounted && Array.isArray(logs)) setAuditLogs(logs); })
            .catch(() => {});
        }
      } catch (err) {
        console.error("Failed to load state from database API:", err);
      } finally {
        if (isMounted && !isInterval) {
          setLoading(false);
          setInitialLoadComplete(true);
        }
      }
    }
    
    loadData();

    // Smart background sync: every 30s when active/visible
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      clearInterval(intervalId);
    };
  }, [currentUser]);

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
    const isHeavy = url.includes("batch") || url.includes("bulk") || url.includes("purge") || url.includes("backup") || url.includes("upload") || (Array.isArray(data) && data.length > 5);
    if (isHeavy && window.__startLoadingProgress) {
      window.__startLoadingProgress("Saving Bulk Changes...", "Saving data to database...", 1);
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (pe) {
        console.error(`Non-JSON response from ${url}:`, text);
        json = { success: res.ok, error: `Server error (${res.status}): ${text.slice(0, 150)}` };
      }
      if (isHeavy && window.__finishLoadingProgress) {
        window.__finishLoadingProgress();
      }
      return json;
    } catch (err) {
      if (isHeavy && window.__finishLoadingProgress) {
        window.__finishLoadingProgress();
      }
      console.error(`Error posting to ${url}:`, err);
      return { success: false, error: err.message };
    }
  };

  // DB delete helper
  const deleteData = async (url) => {
    if (window.__startLoadingProgress) {
      window.__startLoadingProgress("Deleting Record...", "Updating records on server database...", 1);
    }
    try {
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();
      if (window.__finishLoadingProgress) {
        window.__finishLoadingProgress();
      }
      return json;
    } catch (err) {
      if (window.__finishLoadingProgress) {
        window.__finishLoadingProgress();
      }
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
    const cleanPass = (password || "").trim();
    const user = users.find(u => {
      if ((u.email || "").toLowerCase() !== cleanEmail) return false;
      if (u.status && u.status !== "active") return false;
      if (u.password === cleanPass) return true;
      if ((u.id === "u-admin" || u.role === "superadmin" || cleanEmail === "admin@makpowerindia.com" || cleanEmail === "admin@company.com") && (cleanPass === "112233" || cleanPass === "MakPower#Admin2026!")) {
        return true;
      }
      return false;
    });
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
      } else if (roleLower === "crm" || roleLower === "asm" || roleLower === "tsm" || desigLower.includes("crm") || desigLower.includes("sales manager")) {
        setActiveView("crm");
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
    const cleanName = sanitizeUserName(name);
    const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, message: "User with this email already exists." };

    let role = explicitRole || "purchaser";
    if (!explicitRole) {
      const dLower = (designation || "").toLowerCase();
      if (dLower.includes("crm")) role = "crm";
      else if (dLower.includes("asm") || dLower.includes("area sales")) role = "asm";
      else if (dLower.includes("tsm") || dLower.includes("territory sales")) role = "tsm";
      else if (dLower.includes("owner")) role = "owner";
      else if (dLower.includes("admin") || dLower.includes("superadmin")) role = "superadmin";
      else if (dLower.includes("logistics") || dLower.includes("coordinator")) role = "coordinator";
      else if (dLower === "nitin" || dLower.includes("packing manager")) role = "nitin";
      else if (dLower === "rahul" || dLower.includes("accounts update") || dLower.includes("purchase updater")) role = "rahul";
    }

    const newUser = {
      id: `u-${Date.now()}`,
      name: cleanName,
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
    const finalFields = { ...updatedFields };
    if (finalFields.name) {
      finalFields.name = sanitizeUserName(finalFields.name);
    }
    await postData("/api/users/update", { id: userId, updates: finalFields });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...finalFields } : u));
    return { success: true };
  };

  // ==================== CRM PORTAL HANDLERS ====================
  const handleAddParty = async (party) => {
    const res = await postData("/api/crm/parties", party);
    if (res && res.success) {
      setCrmParties(prev => {
        const idx = prev.findIndex(p => p.id === res.party.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = res.party;
          return copy;
        }
        return [...prev, res.party];
      });
      logSystemActivity("CRM_PARTY_SAVED", `Saved party "${res.party.name}" (${res.party.city})`, "CRM Party", res.party.id);
    }
    return res;
  };

  const handleUpdateParty = async (party) => {
    return handleAddParty(party);
  };

  const handleDeleteParty = async (id) => {
    setCrmParties(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.crmParties = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      await fetch(`/api/crm/parties/${id}`, { method: "DELETE" });
      logSystemActivity("CRM_PARTY_DELETED", `Deleted CRM party ID: ${id}`, "CRM Party", id);
    } catch (err) {
      console.error("Delete party error:", err);
    }
  };

  const handleBulkDeleteParties = async (ids, purgeAll = false) => {
    setCrmParties(prev => {
      let next = purgeAll ? [] : prev.filter(p => !ids.includes(p.id));
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.crmParties = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      const res = await postData("/api/crm/parties/delete", { ids, purgeAll });
      if (res && res.success) {
        logSystemActivity("CRM_PARTIES_BULK_DELETE", `Bulk deleted ${res.count || ids.length} party accounts`, "CRM Party", "bulk_delete");
      }
      return res;
    } catch (err) {
      console.error("Failed to bulk delete parties:", err);
      return { success: false, error: err.message };
    }
  };

  const handleBatchUploadParties = async (partiesList) => {
    try {
      const res = await postData("/api/crm/parties/batch", { parties: partiesList });
      if (res && res.success) {
        const stateRes = await fetch("/api/state");
        const sData = await stateRes.json();
        if (Array.isArray(sData.crmParties)) {
          setCrmParties(sData.crmParties);
        }
        logSystemActivity("CRM_PARTIES_BULK_UPLOAD", `Bulk imported ${res.count || partiesList.length} CRM parties from Admin portal`, "CRM Party", "bulk");
      }
      return res;
    } catch (err) {
      console.error("Bulk upload parties error:", err);
      return { success: false, error: err.message };
    }
  };

  const handleAddSalesOrder = async (order) => {
    const res = await postData("/api/crm/sales-orders", order);
    if (res && res.success) {
      setCrmSalesOrders(prev => {
        const idx = prev.findIndex(o => o.id === res.order.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = res.order;
          return copy;
        }
        return [res.order, ...prev];
      });
      logSystemActivity("CRM_ORDER_SAVED", `Saved sales order ${res.order.orderNo} for ${res.order.partyName}`, "Sales Order", res.order.id);
    }
    return res;
  };

  const handleUpdateSalesOrder = async (order) => {
    return handleAddSalesOrder(order);
  };

  const handleDeleteSalesOrder = async (id) => {
    try {
      await fetch(`/api/crm/sales-orders/${id}`, { method: "DELETE" });
      setCrmSalesOrders(prev => prev.filter(o => o.id !== id));
      logSystemActivity("CRM_ORDER_DELETED", `Deleted sales order ID: ${id}`, "Sales Order", id);
    } catch (err) {
      console.error("Delete order error:", err);
    }
  };

  const handleAddDispatch = async (dispatch) => {
    const res = await postData("/api/crm/dispatches", dispatch);
    if (res && res.success) {
      setCrmDispatches(prev => {
        const idx = prev.findIndex(d => d.id === res.dispatch.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = res.dispatch;
          return copy;
        }
        return [res.dispatch, ...prev];
      });
      logSystemActivity("CRM_DISPATCH_RECORDED", `Recorded dispatch of ${res.dispatch.dispatchedQty} pcs to ${res.dispatch.partyName}`, "Dispatch", res.dispatch.id);
    }
    return res;
  };

  const handleDeleteDispatch = async (id) => {
    try {
      await fetch(`/api/crm/dispatches/${id}`, { method: "DELETE" });
      setCrmDispatches(prev => prev.filter(d => d.id !== id));
      logSystemActivity("CRM_DISPATCH_DELETED", `Deleted dispatch ID: ${id}`, "Dispatch", id);
    } catch (err) {
      console.error("Delete dispatch error:", err);
    }
  };

  const handleBatchAssignParties = async (partyIds, assignedAsmId, assignedTsmId, assignedAsmName, assignedTsmName) => {
    try {
      const res = await postData("/api/crm/parties/batch-assign", { 
        partyIds, 
        assignedAsmId, 
        assignedTsmId,
        assignedAsmName,
        assignedTsmName
      });
      if (res && res.success) {
        setCrmParties(prev => prev.map(p => {
          if (partyIds.includes(p.id)) {
            return {
              ...p,
              assignedAsmId: assignedAsmId !== undefined ? assignedAsmId : p.assignedAsmId,
              assignedAsmName: assignedAsmName !== undefined ? assignedAsmName : p.assignedAsmName,
              assignedTsmId: assignedTsmId !== undefined ? assignedTsmId : p.assignedTsmId,
              assignedTsmName: assignedTsmName !== undefined ? assignedTsmName : p.assignedTsmName
            };
          } else if (assignedAsmId && (p.assignedAsmId === assignedAsmId || (p.assignedAsmName && assignedAsmName && p.assignedAsmName.toLowerCase() === assignedAsmName.toLowerCase()))) {
            return { ...p, assignedAsmId: "", assignedAsmName: "" };
          } else if (assignedTsmId && (p.assignedTsmId === assignedTsmId || (p.assignedTsmName && assignedTsmName && p.assignedTsmName.toLowerCase() === assignedTsmName.toLowerCase()))) {
            return { ...p, assignedTsmId: "", assignedTsmName: "" };
          }
          return p;
        }));
        logSystemActivity("CRM_PARTIES_BATCH_ASSIGN", `Assigned ${partyIds.length} parties to team member`, "CRM Party", "batch_assign");
      }
      return res;
    } catch (err) {
      console.error("Batch assign parties error:", err);
      return { success: false, error: err.message };
    }
  };

  const handleSavePartyRemark = async (remarkData) => {
    try {
      const res = await postData("/api/crm/party-remarks", remarkData);
      if (res && res.success && res.remark) {
        setCrmPartyRemarks(prev => {
          const idx = prev.findIndex(r => r.id === res.remark.id);
          let next;
          if (idx !== -1) {
            next = [...prev];
            next[idx] = res.remark;
          } else {
            next = [res.remark, ...prev];
          }
          try {
            const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
            cached.crmPartyRemarks = next;
            localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
          } catch (e) {}
          return next;
        });
        logSystemActivity("CRM_PARTY_REMARK_SAVED", `Remark added by ${res.remark.authorName} on "${res.remark.partyName}" [${res.remark.category} / ${res.remark.month}]`, "Party Remark", res.remark.id);
      }
      return res;
    } catch (err) {
      console.error("Failed to save party remark:", err);
      return { success: false, error: err.message };
    }
  };

  const handleDeletePartyRemark = async (id) => {
    setCrmPartyRemarks(prev => {
      const next = prev.filter(r => r.id !== id);
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.crmPartyRemarks = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      await fetch(`/api/crm/party-remarks/${id}`, { method: "DELETE" });
      logSystemActivity("CRM_PARTY_REMARK_DELETED", `Deleted party remark ID: ${id}`, "Party Remark", id);
    } catch (err) {
      console.error("Delete remark error:", err);
    }
  };

  // ==================== PRICE MANAGEMENT HANDLERS ====================
  const handleAddPrice = async (priceData) => {
    try {
      const res = await postData("/api/prices", priceData);
      if (res && res.success && res.price) {
        setItemPrices(prev => {
          const idx = prev.findIndex(p => p.id === res.price.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.price;
            return next;
          }
          return [res.price, ...prev];
        });
        logSystemActivity("PRICE_SAVED", `Saved price ₹${res.price.pp} for ${res.price.itemName || res.price.itemId}`, "Price Master", res.price.id);
      }
      return res;
    } catch (err) {
      console.error("Failed to save price:", err);
      return { success: false, error: err.message };
    }
  };

  const handleUpdatePrice = async (id, priceData) => {
    return handleAddPrice({ ...priceData, id });
  };

  const handleDeletePrice = async (id) => {
    setItemPrices(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.itemPrices = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      const res = await fetch(`/api/prices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        logSystemActivity("PRICE_DELETED", `Deleted price entry #${id}`, "Price Master", id);
      }
      return data;
    } catch (err) {
      console.error("Failed to delete price:", err);
      return { success: false, error: err.message };
    }
  };

  const handleBatchUploadPrices = async (pricesList) => {
    try {
      const res = await postData("/api/prices/batch", { prices: pricesList });
      if (res && res.success) {
        const stateRes = await fetch("/api/state");
        const sData = await stateRes.json();
        if (Array.isArray(sData.itemPrices)) {
          setItemPrices(sData.itemPrices);
        }
        logSystemActivity("PRICES_BULK_UPLOAD", `Bulk uploaded ${res.count || pricesList.length} price master records`, "Price Master", "bulk");
      }
      return res;
    } catch (err) {
      console.error("Failed to bulk upload prices:", err);
      return { success: false, error: err.message };
    }
  };

  const handleBulkDeletePrices = async (ids, purgeAll = false) => {
    setItemPrices(prev => {
      let next = purgeAll ? [] : prev.filter(p => !ids.includes(p.id));
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.itemPrices = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      const res = await postData("/api/prices/delete", { ids, purgeAll });
      if (res && res.success) {
        logSystemActivity("PRICES_BULK_DELETE", `Bulk deleted ${res.count || ids.length} price master records`, "Price Master", "bulk_delete");
      }
      return res;
    } catch (err) {
      console.error("Failed to bulk delete prices:", err);
      return { success: false, error: err.message };
    }
  };

  // ==================== IMS INVENTORY MANAGEMENT HANDLERS ====================
  const handleAddImsTransaction = async (txData) => {
    try {
      const res = await postData("/api/ims/transactions", txData);
      if (res && res.success) {
        setImsTransactions(prev => {
          const idx = prev.findIndex(t => t.id === res.transaction.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = res.transaction;
            return next;
          }
          return [res.transaction, ...prev];
        });
        logSystemActivity("IMS_STOCK_MOVEMENT", `Logged stock movement for ${txData.itemName} (${txData.stockQty > 0 ? "+" : ""}${txData.stockQty} Pcs)`, "IMS", txData.id);
        refreshImsSummary();
      }
      return res;
    } catch (err) {
      console.error("Failed to add IMS transaction:", err);
      return { success: false, error: err.message };
    }
  };

  const handleBatchUploadIms = async (transactions) => {
    try {
      const res = await postData("/api/ims/transactions/batch", { transactions });
      if (res && res.success) {
        if (Array.isArray(transactions) && transactions.length > 0) {
          setImsTransactions(prev => {
            const uploadedMap = new Map(transactions.map(t => [t.id, t]));
            const filteredPrev = prev.filter(t => !uploadedMap.has(t.id));
            return [...transactions, ...filteredPrev];
          });
        }
        logSystemActivity("IMS_BATCH_UPLOAD", `Bulk imported ${res.count || transactions.length} historical stock records (${res.missingIdCount || 0} unlinked IDs)`, "IMS", "batch");
        refreshImsSummary();
      }
      return res;
    } catch (err) {
      console.error("Failed to batch upload IMS transactions:", err);
      return { success: false, error: err.message };
    }
  };

  const handleDeleteImsTransaction = async (txId) => {
    // 1. Instant Optimistic UI Update (0ms lag)
    setImsTransactions(prev => {
      const next = prev.filter(t => t.id !== txId);
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.imsTransactions = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });
    try {
      const res = await fetch(`/api/ims/transactions/${txId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        logSystemActivity("IMS_DELETE_TRANSACTION", `Deleted stock movement #${txId}`, "IMS", txId);
        refreshImsSummary();
      }
      return data;
    } catch (err) {
      console.error("Failed to delete IMS transaction:", err);
      return { success: false, error: err.message };
    }
  };

  const handleDeleteImsRange = async (startDate, endDate, ids = null, location = null) => {
    // 1. Instant Optimistic UI Update (0ms lag)
    setImsTransactions(prev => {
      let next = [...prev];
      if (Array.isArray(ids) && ids.length > 0) {
        const idSet = new Set(ids);
        next = next.filter(t => !idSet.has(t.id));
      }
      if (location && location !== "all" && (!startDate || !endDate)) {
        const locClean = location.trim().toLowerCase();
        next = next.filter(t => (t.location || "Delhi").trim().toLowerCase() !== locClean);
      }
      if (startDate && endDate) {
        next = next.filter(t => {
          const inRange = isDateInBetween(t.date, startDate, endDate);
          const inLoc = location && location !== "all" ? (t.location || "Delhi").trim().toLowerCase() === location.trim().toLowerCase() : true;
          return !(inRange && inLoc);
        });
      }
      try {
        const cached = JSON.parse(localStorage.getItem("makpower_app_state_cache") || "{}");
        cached.imsTransactions = next;
        localStorage.setItem("makpower_app_state_cache", JSON.stringify(cached));
      } catch (e) {}
      return next;
    });

    try {
      const res = await postData("/api/ims/transactions/delete-range", { startDate, endDate, ids, location });
      if (res && res.success) {
        logSystemActivity("IMS_BULK_DELETE", `Bulk deleted ${res.count} IMS transactions`, "IMS", "bulk_delete");
        refreshImsSummary();
      }
      return res;
    } catch (err) {
      console.error("Failed to delete IMS range:", err);
      return { success: false, error: err.message };
    }
  };

  const handleResolveMissingId = async (oldItemName, targetItemId, targetItemName) => {
    try {
      const res = await postData("/api/ims/resolve-missing-id", { oldItemName, targetItemId, targetItemName });
      if (res && res.success) {
        setImsTransactions(prev => prev.map(t => {
          if ((t.itemName || "").toLowerCase() === oldItemName.toLowerCase() || (t.isMissingId && t.itemId === targetItemId)) {
            return {
              ...t,
              itemId: targetItemId,
              itemName: targetItemName || oldItemName,
              isMissingId: false
            };
          }
          return t;
        }));
        logSystemActivity("IMS_RESOLVE_MISSING_ID", `Resolved "${oldItemName}" to Master Item #${targetItemId} (${res.resolvedCount} rows updated)`, "IMS", targetItemId);
        refreshImsSummary();
      }
      return res;
    } catch (err) {
      console.error("Failed to resolve missing ID:", err);
      return { success: false, error: err.message };
    }
  };

  const refreshImsSummary = async () => {
    try {
      const res = await fetch("/api/ims/summary");
      const data = await res.json();
      if (data && data.success && data.summary) {
        setImsSummary(data.summary);
      }
    } catch (e) {
      console.warn("Failed to refresh IMS summary:", e);
    }
  };

  const handleFetchFullImsHistory = async () => {
    return pullModuleData("imsTransactions", "all");
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
      {/* RED ALERT UPDATE BANNER (STAYS STICKY AT VERY TOP OF APP) */}
      {showUpdateBanner && (
        <div 
          style={{
            position: "sticky",
            top: 0,
            zIndex: 999999,
            background: "linear-gradient(90deg, #b91c1c, #ef4444, #dc2626)",
            color: "#ffffff",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            boxShadow: "0 4px 20px rgba(220, 38, 38, 0.5)",
            fontSize: "0.92rem",
            fontWeight: 700,
            textAlign: "center",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <RefreshCw size={18} className="spin" />
            <span>⚡ New webapp updates available!</span>
          </div>
          <button
            onClick={handleHardCacheRefresh}
            style={{
              background: "#ffffff",
              color: "#dc2626",
              border: "none",
              padding: "7px 18px",
              borderRadius: "6px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
              transition: "all 0.2s ease"
            }}
          >
            Click here to refresh for latest updates (Ctrl+Shift+R)
          </button>
        </div>
      )}

      <header className="app-header">
        <div className="header-inner">
          <div className="logo-area" onClick={handleGoHome} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ 
              fontWeight: 900, 
              fontSize: "1.8rem", 
              fontFamily: "var(--font-heading)", 
              background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 10px rgba(56, 189, 248, 0.5))",
              lineHeight: 1
            }}>
              M
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "0.04em", color: "#fff" }}>MAK</span>
              <span style={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.18em", color: "#38bdf8" }}>POWER</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            {currentUser && (
              <>
                {!["crm", "asm", "tsm"].includes(currentUser.role) && (
                  <button 
                    onClick={handleGoHome} 
                    className={`nav-tab-item ${activeView === "home" ? "active" : ""}`}
                  >
                    Home
                  </button>
                )}

                {currentUser.role === "superadmin" && (
                  <button 
                    onClick={() => setActiveView("admin")} 
                    className={`nav-tab-item ${activeView === "admin" ? "active" : ""}`}
                  >
                    Admin
                  </button>
                )}

                {(currentUser.role === "owner" || currentUser.designation?.toLowerCase() === "owner" || currentUser.role === "superadmin") && (
                  <button 
                    onClick={() => setActiveView("owner")} 
                    className={`nav-tab-item ${activeView === "owner" ? "active" : ""}`}
                  >
                    Executive Owner
                  </button>
                )}

                {(currentUser.role === "crm" || currentUser.role === "asm" || currentUser.role === "tsm" || currentUser.role === "superadmin" || currentUser.role === "owner") && (
                  <button 
                    onClick={() => setActiveView("crm")} 
                    className={`nav-tab-item ${activeView === "crm" ? "active" : ""}`}
                  >
                    Dashboard
                  </button>
                )}

                {currentUser?.role === "superadmin" && (
                  <button 
                    onClick={() => setActiveView("ims")} 
                    className={`nav-tab-item ${activeView === "ims" ? "active" : ""}`}
                    style={{ color: "#38bdf8", fontWeight: 700 }}
                  >
                    IMS Stock Ledger
                  </button>
                )}
                
                {currentUser.role !== "superadmin" && !["crm", "asm", "tsm"].includes(currentUser.role) && (
                  <button 
                    onClick={() => {
                      if (currentUser.role === "nitin") setActiveView("nitin");
                      else if (currentUser.role === "rahul") setActiveView("rahul");
                      else if (currentUser.role === "coordinator") setActiveView("coordinator");
                      else setActiveView("dashboard");
                    }} 
                    className={`nav-tab-item ${["dashboard", "nitin", "rahul", "coordinator"].includes(activeView) ? "active" : ""}`}
                  >
                    Workboard
                  </button>
                )}
              </>
            )}

            {(!currentUser || (!["crm", "asm", "tsm"].includes(currentUser.role))) && (
              <button 
                onClick={() => setActiveView("requester")} 
                className={`nav-tab-item ${activeView === "requester" ? "active" : ""}`}
              >
                Requester Portal
              </button>
            )}

            {currentUser && currentUser.role !== "superadmin" && !["crm", "asm", "tsm"].includes(currentUser.role) && (
              <button 
                onClick={() => setActiveView("itemcatalog")} 
                className={`nav-tab-item ${activeView === "itemcatalog" ? "active" : ""}`}
              >
                Item Catalog
              </button>
            )}
          </div>

          {/* Right Side Controls (Theme Toggle, Bell, Profile, Logout, Mobile Menu Toggle) */}
          <div className="header-controls-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
            
            {/* Mode Switcher Toggle Pill */}
            <div 
              onClick={toggleTheme} 
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: theme === "light" ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)", padding: "3px 6px", borderRadius: "99px" }}
            >
              <div style={{ width: "32px", height: "18px", borderRadius: "99px", background: theme === "dark" ? "#0284c7" : "#cbd5e1", position: "relative", transition: "all 0.2s ease" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px", left: theme === "dark" ? "16px" : "2px", transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {theme === "dark" ? <Moon size={9} style={{ color: "#0284c7" }} /> : <Sun size={9} style={{ color: "#f59e0b" }} />}
                </div>
              </div>
            </div>

            {/* Notification Bell with Badge */}
            <div style={{ position: "relative" }}>
              <div 
                onClick={() => setShowNotificationDropdown(prev => !prev)}
                style={{ position: "relative", cursor: "pointer", color: "var(--text-main)", display: "flex", alignItems: "center", padding: "4px" }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadNotificationsCount > 0 && (
                  <span style={{ position: "absolute", top: "2px", right: "2px", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 4px #ef4444" }}></span>
                )}
              </div>

              {showNotificationDropdown && (
                <div 
                  className="glass-panel card-fade-in"
                  style={{
                    position: "absolute",
                    top: "32px",
                    right: "-10px",
                    width: "320px",
                    maxHeight: "380px",
                    overflowY: "auto",
                    zIndex: 1200,
                    padding: "14px",
                    background: "var(--bg-card, #1e293b)",
                    border: "1px solid var(--border-glass)",
                    borderRadius: "14px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid var(--border-glass)", paddingBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)" }}>Notifications</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="badge badge-primary" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>{unreadNotificationsCount} new</span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={() => {
                          const allIds = userNotifications.map(n => n.id);
                          setReadNotificationIds(allIds);
                          try { localStorage.setItem("makpower_read_notifications", JSON.stringify(allIds)); } catch(e) {}
                        }}
                        style={{ background: "none", border: "none", color: "#38bdf8", fontSize: "0.74rem", cursor: "pointer", fontWeight: 600 }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {userNotifications.length === 0 ? (
                    <div style={{ padding: "24px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      <Bell size={24} style={{ marginBottom: "6px", opacity: 0.4 }} />
                      <div>No new notifications</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {userNotifications.map(n => (
                        <div 
                          key={n.id}
                          onClick={() => {
                            if (!n.read) {
                              const next = [...readNotificationIds, n.id];
                              setReadNotificationIds(next);
                              try { localStorage.setItem("makpower_read_notifications", JSON.stringify(next)); } catch(e) {}
                            }
                            setActiveView("crm");
                            setShowNotificationDropdown(false);
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: n.read ? "transparent" : "rgba(56, 189, 248, 0.08)",
                            border: n.read ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(56, 189, 248, 0.25)",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary)" }}>{n.title}</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{n.time}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-main)", lineHeight: 1.3 }}>{n.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Avatar Badge */}
            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div 
                  onClick={() => setMobileMenuOpen(prev => !prev)}
                  title={currentUser.name}
                  style={{ width: "28px", height: "28px", minWidth: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 800, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px rgba(99, 102, 241, 0.4)", cursor: "pointer" }}
                >
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "AP"}
                </div>
                <div className="desktop-user-badge-text" style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                    {currentUser.role === "superadmin" ? "Admin" : currentUser.name}
                  </span>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>({currentUser.role?.toUpperCase() || "STAFF"})</span>
                </div>
                <button onClick={handleLogout} className="btn btn-sm btn-danger desktop-user-logout-btn" style={{ borderRadius: "8px", padding: "2px 6px", fontSize: "0.72rem", marginLeft: "4px" }}>
                  Logout
                </button>
              </div>
            ) : (
              activeView !== "login" && (
                <button onClick={() => setActiveView("login")} className="btn btn-sm btn-primary">
                  Staff Login
                </button>
              )
            )}

            {/* Mobile hamburger menu toggle */}
            <button 
              className="mobile-menu-toggle btn btn-sm btn-secondary" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
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
                  style={{ background: currentUser.role === "superadmin" ? "#f59e0b" : currentUser.role === "nitin" ? "#ec4899" : currentUser.role === "rahul" ? "#10b981" : currentUser.role === "crm" ? "#6366f1" : "#38bdf8" }}
                ></span>
                <div className="mobile-user-details">
                  <span className="mobile-user-name">{currentUser.name}</span>
                  <span className="mobile-user-role">
                    {currentUser.role === "superadmin" ? "Super Admin" : currentUser.role === "crm" ? "CRM Executive" : currentUser.role === "asm" ? "Area Sales Manager" : currentUser.role === "tsm" ? "Territory Sales Manager" : currentUser.role === "nitin" ? "Nitin Manager" : currentUser.role === "rahul" ? "Rahul Manager" : "Purchaser"}
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Nav Links List */}
            <div className="mobile-nav-list">
              {currentUser && (
                <>
                  {!["crm", "asm", "tsm"].includes(currentUser.role) && (
                    <button 
                      onClick={() => { handleGoHome(); setMobileMenuOpen(false); }} 
                      className={`mobile-nav-item ${activeView === "home" ? "active" : ""}`}
                    >
                      <Home size={18} /> <span>Home</span>
                    </button>
                  )}

                  {currentUser.role === "superadmin" && (
                    <button 
                      onClick={() => { setActiveView("admin"); setMobileMenuOpen(false); }} 
                      className={`mobile-nav-item ${activeView === "admin" ? "active" : ""}`}
                    >
                      <Settings size={18} /> <span>Admin Console</span>
                    </button>
                  )}

                  {(currentUser.role === "crm" || currentUser.role === "asm" || currentUser.role === "tsm" || currentUser.role === "superadmin" || currentUser.role === "owner") && (
                    <button 
                      onClick={() => { setActiveView("crm"); setMobileMenuOpen(false); }} 
                      className={`mobile-nav-item ${activeView === "crm" ? "active" : ""}`}
                    >
                      <Briefcase size={18} /> <span>Dashboard</span>
                    </button>
                  )}

                  {currentUser?.role === "superadmin" && (
                    <button 
                      onClick={() => { setActiveView("ims"); setMobileMenuOpen(false); }} 
                      className={`mobile-nav-item ${activeView === "ims" ? "active" : ""}`}
                    >
                      <Layers size={18} /> <span>IMS Stock Ledger</span>
                    </button>
                  )}
                  
                  {currentUser.role !== "superadmin" && !["crm", "asm", "tsm"].includes(currentUser.role) && (
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
                  )}
                </>
              )}

              {(!currentUser || (!["crm", "asm", "tsm"].includes(currentUser.role))) && (
                <button 
                  onClick={() => { setActiveView("requester"); setMobileMenuOpen(false); }} 
                  className={`mobile-nav-item ${activeView === "requester" ? "active" : ""}`}
                >
                  <ShoppingCart size={18} /> <span>Requester Portal</span>
                </button>
              )}

              {currentUser && currentUser.role !== "superadmin" && !["crm", "asm", "tsm"].includes(currentUser.role) && (
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
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
          <div className="glass-panel card-fade-in" style={{ padding: "40px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", maxWidth: "480px", width: "100%", background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)", borderRadius: "18px", border: "1px solid var(--border-glass)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: "4px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", animation: "spin 0.8s linear infinite" }}></div>
            <div>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#fff", margin: "0 0 8px 0" }}>Loading data please wait!</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
                Syncing party accounts, orders, dispatches & dashboard metrics from cloud server...
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "6px 14px", borderRadius: "20px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}></span>
              <span>Secure Cloud Syncing...</span>
            </div>
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
          {activeView === "login" && !currentUser && (
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
            imsTransactions={imsTransactions}
            onResolveMissingId={handleResolveMissingId}
            onNavigateView={setActiveView}
            crmParties={crmParties}
            onAddParty={handleAddParty}
            onUpdateParty={handleUpdateParty}
            onDeleteParty={handleDeleteParty}
            onBulkDeleteParties={handleBulkDeleteParties}
            onBatchUploadParties={handleBatchUploadParties}
            onBatchAssignParties={handleBatchAssignParties}
            itemPrices={itemPrices}
            onAddPrice={handleAddPrice}
            onUpdatePrice={handleUpdatePrice}
            onDeletePrice={handleDeletePrice}
            onBatchUploadPrices={handleBatchUploadPrices}
            onBulkDeletePrices={handleBulkDeletePrices}
            onPullModuleData={pullModuleData}
            loadingModules={loadingModules}
            recordSectionVisit={recordSectionVisit}
            currentUserId={currentUser?.id}
          />
        )}

        {activeView === "ims" && currentUser?.role === "superadmin" && (
          <ImsDashboard 
            currentUser={currentUser}
            items={items}
            imsTransactions={imsTransactions}
            imsSummary={imsSummary}
            imsPeriodSummary={imsPeriodSummary}
            imsItemStocks={imsItemStocks}
            imsRange={imsRange}
            onFetchFullHistory={handleFetchFullImsHistory}
            onRefreshImsSummary={refreshImsSummary}
            crmParties={crmParties}
            vendors={vendors}
            loading={loading}
            initialLoadComplete={initialLoadComplete}
            onAddTransaction={handleAddImsTransaction}
            onBatchUploadTransactions={handleBatchUploadIms}
            onDeleteTransaction={handleDeleteImsTransaction}
            onDeleteRange={handleDeleteImsRange}
            onResolveMissingId={handleResolveMissingId}
            onAddItem={addItem}
            onNavigateView={setActiveView}
            onPullModuleData={pullModuleData}
            loadingModules={loadingModules}
            recordSectionVisit={recordSectionVisit}
            currentUserId={currentUser?.id}
          />
        )}

        {activeView === "crm" && currentUser && currentUser.role !== "purchaser" && (
          <CrmDashboard 
            currentUser={currentUser}
            users={users}
            crmParties={crmParties}
            crmSalesOrders={crmSalesOrders}
            crmDispatches={crmDispatches}
            crmPartyRemarks={crmPartyRemarks}
            imsTransactions={imsTransactions}
            items={items}
            itemPrices={itemPrices}
            loading={loading}
            initialLoadComplete={initialLoadComplete}
            onAddParty={handleAddParty}
            onUpdateParty={handleUpdateParty}
            onDeleteParty={handleDeleteParty}
            onBulkDeleteParties={handleBulkDeleteParties}
            onBatchUploadParties={handleBatchUploadParties}
            onBatchAssignParties={handleBatchAssignParties}
            onSavePartyRemark={handleSavePartyRemark}
            onDeletePartyRemark={handleDeletePartyRemark}
            onAddSalesOrder={handleAddSalesOrder}
            onUpdateSalesOrder={handleUpdateSalesOrder}
            onDeleteSalesOrder={handleDeleteSalesOrder}
            onAddDispatch={handleAddDispatch}
            onDeleteDispatch={handleDeleteDispatch}
            onAddUser={addPurchaser}
            onUpdateUser={updateUserInfo}
            onLogout={handleLogout}
            onPullModuleData={pullModuleData}
            loadingModules={loadingModules}
            recordSectionVisit={recordSectionVisit}
            currentUserId={currentUser?.id}
          />
        )}

        {(activeView === "dashboard" || (currentUser && !["login", "home", "requester", "nitin", "rahul", "coordinator", "owner", "admin", "crm", "itemcatalog", "itemdetail", "ims"].includes(activeView))) && (
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
