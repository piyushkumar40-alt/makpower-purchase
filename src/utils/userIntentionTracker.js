/**
 * Adaptive User Intention & Predictive Preload Tracker
 * 
 * Rules:
 * 1. If a user visits a section in >= 3 consecutive logins, that section is marked
 *    for predictive background preloading upon subsequent logins for instant 0ms access.
 * 2. If a user does NOT visit a section for >= 5 consecutive logins, preloading is
 *    automatically disabled to conserve network payload and memory.
 * 3. Captures user habit telemetry locally in localStorage without server overhead.
 */

const STORAGE_KEY = "makpower_user_intention_data";

export const TRACKABLE_MODULES = {
  VENDORS: "vendors",
  CARGO_COMPANIES: "cargoCompanies",
  CARGOS: "cargos",
  REQUESTS: "requests",
  ITEMS: "items",
  CRM_PARTIES: "crmParties",
  CRM_SALES_ORDERS: "crmSalesOrders",
  CRM_DISPATCHES: "crmDispatches",
  IMS_TRANSACTIONS: "imsTransactions",
  AUDIT_LOGS: "auditLogs",
  DESIGNATIONS: "designations"
};

const PRELOAD_THRESHOLD_CONSECUTIVE_VISITS = 3;
const UNLOAD_THRESHOLD_CONSECUTIVE_NON_VISITS = 5;

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Failed to persist user intention data:", e);
  }
}

/**
 * Call on each login / session start.
 * Increments login count and updates consecutive non-visit streak for modules not visited in previous session.
 */
export function recordUserLogin(userId) {
  if (!userId) return;
  const store = getStore();
  if (!store[userId]) {
    store[userId] = {
      loginCount: 0,
      lastLoginTs: Date.now(),
      currentSessionVisits: [],
      previousSessionVisits: [],
      modules: {}
    };
  }

  const userProfile = store[userId];
  userProfile.loginCount = (userProfile.loginCount || 0) + 1;
  userProfile.lastLoginTs = Date.now();

  // Evaluate previous session visits against streaks
  const prevVisits = new Set(userProfile.currentSessionVisits || []);
  userProfile.previousSessionVisits = Array.from(prevVisits);
  userProfile.currentSessionVisits = []; // Reset for new session

  Object.values(TRACKABLE_MODULES).forEach(modKey => {
    if (!userProfile.modules[modKey]) {
      userProfile.modules[modKey] = {
        totalVisits: 0,
        consecutiveVisits: 0,
        consecutiveNonVisits: 0,
        lastVisitedTs: null,
        isPredictivePreloadEnabled: false
      };
    }

    const modStats = userProfile.modules[modKey];
    if (prevVisits.has(modKey)) {
      modStats.consecutiveVisits = (modStats.consecutiveVisits || 0) + 1;
      modStats.consecutiveNonVisits = 0;
      if (modStats.consecutiveVisits >= PRELOAD_THRESHOLD_CONSECUTIVE_VISITS) {
        modStats.isPredictivePreloadEnabled = true;
      }
    } else {
      modStats.consecutiveNonVisits = (modStats.consecutiveNonVisits || 0) + 1;
      modStats.consecutiveVisits = 0;
      if (modStats.consecutiveNonVisits >= UNLOAD_THRESHOLD_CONSECUTIVE_NON_VISITS) {
        modStats.isPredictivePreloadEnabled = false;
      }
    }
  });

  saveStore(store);
}

/**
 * Call whenever the user clicks or navigates into a specific module/tab.
 */
export function recordSectionVisit(userId, moduleKey) {
  if (!userId || !moduleKey) return;
  const store = getStore();
  if (!store[userId]) {
    recordUserLogin(userId);
  }

  const userProfile = store[userId];
  if (!userProfile.currentSessionVisits) userProfile.currentSessionVisits = [];
  if (!userProfile.currentSessionVisits.includes(moduleKey)) {
    userProfile.currentSessionVisits.push(moduleKey);
  }

  if (!userProfile.modules) userProfile.modules = {};
  if (!userProfile.modules[moduleKey]) {
    userProfile.modules[moduleKey] = {
      totalVisits: 0,
      consecutiveVisits: 1,
      consecutiveNonVisits: 0,
      lastVisitedTs: Date.now(),
      isPredictivePreloadEnabled: false
    };
  }

  const mod = userProfile.modules[moduleKey];
  mod.totalVisits = (mod.totalVisits || 0) + 1;
  mod.lastVisitedTs = Date.now();
  mod.consecutiveNonVisits = 0;

  saveStore(store);
}

/**
 * Returns an array of module keys that should be predictively preloaded in background after login.
 */
export function getPredictivePreloadSections(userId) {
  if (!userId) return [];
  const store = getStore();
  const userProfile = store[userId];
  if (!userProfile || !userProfile.modules) return [];

  const preloads = [];
  Object.entries(userProfile.modules).forEach(([modKey, stats]) => {
    if (stats.isPredictivePreloadEnabled || (stats.consecutiveVisits >= PRELOAD_THRESHOLD_CONSECUTIVE_VISITS)) {
      preloads.push(modKey);
    }
  });

  return preloads;
}

/**
 * Returns true if a specific module is flagged for predictive preload.
 */
export function shouldPreloadSection(userId, moduleKey) {
  if (!userId || !moduleKey) return false;
  const preloads = getPredictivePreloadSections(userId);
  return preloads.includes(moduleKey);
}

/**
 * Get full habit intelligence summary for user telemetry display.
 */
export function getUserIntentionProfile(userId) {
  if (!userId) return null;
  const store = getStore();
  return store[userId] || null;
}
