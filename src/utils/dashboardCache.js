/**
 * dashboardCache.js
 * High-performance browser caching system for Operations & Accounts Dashboards.
 * 
 * Provides:
 * 1. Synchronous localStorage snapshot hydration for 0ms initial render (Instant UI).
 * 2. Asynchronous IndexedDB storage for large datasets (thousands of purchase orders).
 * 3. Stale-While-Revalidate caching pattern with version stamping.
 * 4. Remember Browser / Remember Device persistence across sessions.
 */

const DB_NAME = "makpower_dash_store_v1";
const DB_STORE = "datasets";
const STORAGE_PREFIX = "makpower_dash_cache_";
const REMEMBER_BROWSER_KEY = "makpower_remember_browser";
const REMEMBERED_EMAIL_KEY = "makpower_remembered_email";
const LAST_ACTIVE_ROLE_KEY = "makpower_last_active_role";

// Helper: Open or create IndexedDB store
function openCacheDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported in this environment"));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Normalize user key for caching (e.g., "rahul", "purchaser", or userId)
export function getNormalizedCacheKey(userOrRole) {
  if (!userOrRole) return "rahul";
  if (typeof userOrRole === "string") {
    const s = userOrRole.trim().toLowerCase();
    if (s.includes("rahul") || s.includes("account") || s.includes("mark purchase")) return "rahul";
    if (s.includes("nitin") || s.includes("pack")) return "nitin";
    if (s.includes("coord")) return "coordinator";
    return s;
  }
  const role = String(userOrRole.role || "").trim().toLowerCase();
  const id = String(userOrRole.id || "").trim().toLowerCase();
  const name = String(userOrRole.name || "").trim().toLowerCase();
  if (role === "rahul" || id === "u-rahul" || name.includes("rahul") || role.includes("account")) return "rahul";
  if (role === "nitin" || id === "u-nitin" || name.includes("nitin")) return "nitin";
  if (role === "coordinator" || id === "u-coordinator") return "coordinator";
  return role || id || "rahul";
}

/**
 * Synchronously retrieves initial state from localStorage for 0ms frame-0 hydration.
 */
export function getInitialSyncCache(userOrRole = "rahul") {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const key = getNormalizedCacheKey(userOrRole);
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    console.warn("[DashboardCache] Sync cache read notice:", err);
  }
  return null;
}

/**
 * Asynchronously retrieves full dataset from IndexedDB (with fallback to localStorage).
 */
export async function getAsyncDashboardCache(userOrRole = "rahul") {
  const key = getNormalizedCacheKey(userOrRole);
  try {
    const db = await openCacheDB();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);

    const result = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });

    if (result && typeof result === "object") {
      return result;
    }
  } catch (err) {
    // Fallback to localStorage
  }
  return getInitialSyncCache(key);
}

/**
 * Saves dashboard state to both localStorage (quick snapshot) and IndexedDB (full persistent cache).
 */
export async function saveDashboardCache(userOrRole, data) {
  if (!data || typeof data !== "object") return;
  const key = getNormalizedCacheKey(userOrRole);
  const now = Date.now();

  const cachePayload = {
    requests: Array.isArray(data.requests) ? data.requests : [],
    vendors: Array.isArray(data.vendors) ? data.vendors : [],
    cargos: Array.isArray(data.cargos) ? data.cargos : [],
    cargoCompanies: Array.isArray(data.cargoCompanies) ? data.cargoCompanies : [],
    items: Array.isArray(data.items) ? data.items : [],
    users: Array.isArray(data.users) ? data.users : [],
    designations: Array.isArray(data.designations) ? data.designations : [],
    cachedAt: now,
    version: data.version || now,
    cacheKey: key
  };

  // 1. Save full payload to IndexedDB
  try {
    const db = await openCacheDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.put({ key, data: cachePayload, updatedAt: now });
  } catch (dbErr) {
    console.warn("[DashboardCache] IndexedDB write notice:", dbErr);
  }

  // 2. Save snapshot to localStorage for instantaneous synchronous hydration
  try {
    // If requests list is huge (> 3000 items), serialize a high-density snapshot for localStorage
    const snapshot = {
      ...cachePayload,
      requests: cachePayload.requests.slice(0, 2500)
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(snapshot));
    localStorage.setItem(LAST_ACTIVE_ROLE_KEY, key);
  } catch (lsErr) {
    console.warn("[DashboardCache] localStorage write notice (quota limit handled):", lsErr);
    // If quota exceeded, clean up old non-critical keys
    try {
      localStorage.removeItem("makpower_audit_logs_cache");
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({
        ...cachePayload,
        requests: cachePayload.requests.slice(0, 1000)
      }));
    } catch (e2) {}
  }
}

/**
 * Clears cached dashboard state (e.g. for hard refresh or explicit cache flush).
 */
export async function clearDashboardCache(userOrRole) {
  const key = getNormalizedCacheKey(userOrRole);
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {}

  try {
    const db = await openCacheDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.delete(key);
  } catch (e) {}
}

/**
 * Remember Browser Settings
 */
export function saveRememberBrowserPreference(email, remember = true) {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_BROWSER_KEY, "true");
      if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
    } else {
      localStorage.removeItem(REMEMBER_BROWSER_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch (e) {}
}

export function getRememberBrowserPreference() {
  try {
    const isRemembered = localStorage.getItem(REMEMBER_BROWSER_KEY) === "true";
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
    return {
      remember: isRemembered,
      email: rememberedEmail
    };
  } catch (e) {
    return { remember: true, email: "" };
  }
}
