export const formatIndianCurrency = (amount, symbol = "₹") => {
  const rawNum = parseFloat(amount || 0);
  if (isNaN(rawNum) || rawNum === 0) return `${symbol} 0`;
  
  const sign = rawNum < 0 ? "-" : "";
  const num = Math.abs(rawNum);

  if (num >= 10000000) {
    const val = (num / 10000000).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return `${sign}${symbol} ${val} crore`;
  }
  if (num >= 100000) {
    const val = (num / 100000).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return `${sign}${symbol} ${val} lacs`;
  }
  return `${sign}${symbol} ${Math.round(num).toLocaleString("en-IN")}`;
};

export const cleanCategoryName = (category) => {
  if (!category || typeof category !== "string") return category || "";
  let str = category.trim();

  // 1. Remove "Z ", "ZZ ", "S " wording from everywhere (prefixes, suffixes, internal words)
  str = str.replace(/^((ZZ|Z|S)[\s\-_]+)+/gi, "");
  str = str.replace(/([\s\-_]+(ZZ|Z|S))+$/gi, "");
  str = str.replace(/\b(ZZ|Z|S)\b[\s\-_]*/gi, " ");
  str = str.replace(/\s+/g, " ").trim();

  if (!str) return "";

  const lower = str.toLowerCase();

  // 2. Merge all polymers into single "Polymer"
  if (
    lower === "polymer" ||
    lower.includes("polymer") ||
    lower.includes("li-poly") ||
    lower.includes("lithium poly") ||
    lower.includes("pouch battery") ||
    lower.includes("poly battery") ||
    lower === "polymers" ||
    lower.startsWith("poly ")
  ) {
    return "Polymer";
  }

  // 3. Merge all data cables into single "Data Cable"
  if (
    lower === "data cable" ||
    lower.includes("data cable") ||
    lower.includes("datacable") ||
    lower.includes("data-cable") ||
    lower.includes("data_cable") ||
    lower === "cables" ||
    lower === "cable" ||
    lower.includes("usb cable") ||
    lower.includes("charging cable") ||
    lower.includes("type-c cable") ||
    lower.includes("braided cable")
  ) {
    return "Data Cable";
  }

  return str;
};

export const normalizeCategoryName = (category) => {
  if (!category) return "General";
  let str = cleanCategoryName(String(category));
  if (!str) return "General";
  return str;
};

// Robust CSV Exporter with UTF-8 BOM for full Excel compatibility
export const downloadCsv = (headers, rows, filename = "export") => {
  const csvString = [
    headers.map(h => `"${String(h || '').replace(/"/g, '""')}"`).join(","),
    ...rows.map(r => r.map(cell => `"${String(cell === null || cell === undefined ? '' : cell).replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Download Excel (.xlsx) file using SheetJS if available, falling back to CSV with UTF-8 BOM
export const downloadExcelOrCsv = (headers, rows, filename = "export") => {
  const finalFilename = `${filename}_${new Date().toISOString().split("T")[0]}`;
  if (typeof window !== "undefined" && window.XLSX) {
    try {
      const data = [headers, ...rows];
      const ws = window.XLSX.utils.aoa_to_sheet(data);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      window.XLSX.writeFile(wb, `${finalFilename}.xlsx`);
      return;
    } catch (err) {
      console.warn("SheetJS write failed, falling back to CSV:", err);
    }
  }
  downloadCsv(headers, rows, filename);
};

// Parse and normalize various date formats (M/D/YYYY, YYYY-MM-DD, D/M/YYYY, Excel serials) to YYYY-MM-DD
export const parseFlexibleDate = (dateVal) => {
  if (!dateVal) return "";
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    // SheetJS creates UTC midnight Date objects (00:00:00 UTC) when reading Excel dates.
    // Using local getDate() causes dates to shift backwards by 1 day in any negative timezone.
    // Check if UTC midnight first:
    if (dateVal.getUTCHours() === 0 && dateVal.getUTCMinutes() === 0 && dateVal.getUTCSeconds() === 0) {
      const y = dateVal.getUTCFullYear();
      const m = String(dateVal.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateVal.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    // Check if constructed at local midnight:
    if (dateVal.getHours() === 0 && dateVal.getMinutes() === 0 && dateVal.getSeconds() === 0) {
      const y = dateVal.getFullYear();
      const m = String(dateVal.getMonth() + 1).padStart(2, "0");
      const d = String(dateVal.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    // Fallback using midday buffer (add 12 hours) to avoid edge boundary crossings:
    const buffered = new Date(dateVal.getTime() + 12 * 3600 * 1000);
    const y = buffered.getUTCFullYear();
    const m = String(buffered.getUTCMonth() + 1).padStart(2, "0");
    const d = String(buffered.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(dateVal).trim();
  if (!str) return "";

  // Check if numeric serial (Excel date: e.g. 40000 to 60000)
  const num = Number(str);
  if (!isNaN(num) && num > 25000 && num < 65000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dt = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    }
  }

  // Check YYYY-MM-DD or YYYY-DD-MM (e.g. 2026-07-08 or 2026-08-19 or 2026/08/19)
  const ymdMatch = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const p1 = parseInt(ymdMatch[2], 10);
    const p2 = parseInt(ymdMatch[3], 10);
    // If p1 > 12, it is YYYY-DD-MM
    if (p1 > 12 && p2 <= 12) {
      const m = String(p2).padStart(2, "0");
      const d = String(p1).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const m = String(Math.min(12, Math.max(1, p1))).padStart(2, "0");
    const d = String(p2).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Check DD-MM-YYYY or MM-DD-YYYY or D/M/YYYY or M/D/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    let y = slashMatch[3];
    if (y.length === 2) y = `20${y}`;

    if (p1 > 12) {
      // p1 is day, p2 is month (DD/MM/YYYY)
      const d = String(p1).padStart(2, "0");
      const m = String(Math.min(12, Math.max(1, p2))).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (p2 > 12) {
      // p2 is day, p1 is month (MM/DD/YYYY)
      const m = String(Math.min(12, Math.max(1, p1))).padStart(2, "0");
      const d = String(p2).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // Both <= 12: default to standard month/day
    const m = String(Math.min(12, Math.max(1, p1))).padStart(2, "0");
    const d = String(p2).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return str;
};

// Generate plausible format variants of a date for flexible matching
export const getDateVariants = (dateVal) => {
  if (!dateVal) return [];
  const base = parseFlexibleDate(dateVal);
  if (!base) return [];
  const variants = new Set([base, String(dateVal).trim()]);
  const parts = base.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    // Swapped day and month (e.g. 2026-08-10 <-> 2026-10-08)
    variants.add(`${year}-${day}-${month}`);
    variants.add(`${day}/${month}/${year}`);
    variants.add(`${month}/${day}/${year}`);
    const mTrim = String(parseInt(month, 10));
    const dTrim = String(parseInt(day, 10));
    variants.add(`${mTrim}/${dTrim}/${year}`);
    variants.add(`${dTrim}/${mTrim}/${year}`);
    variants.add(`${year}/${month}/${day}`);
    variants.add(`${year}.${month}.${day}`);
    variants.add(`${day}-${month}-${year}`);

    // Adjacent ±1 day variants (reconciles past timezone shifts e.g. 2026-08-09 vs 2026-08-10)
    try {
      const curDt = new Date(`${year}-${month}-${day}T12:00:00Z`);
      if (!isNaN(curDt.getTime())) {
        const prevDt = new Date(curDt.getTime() - 86400000);
        const nextDt = new Date(curDt.getTime() + 86400000);
        const fmt = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        variants.add(fmt(prevDt));
        variants.add(fmt(nextDt));
      }
    } catch {
      // Ignore date math error
    }
  }
  return Array.from(variants);
};

/**
 * Determines whether a purchase request belongs to the specified user.
 * Supports:
 * - Direct ID matching (e.g. "u-himanshi", "u-anees")
 * - Name matching in purchaserId, purchaserName, assignedPurchaser, purchaser
 * - Himanshi fallback: as established across NitinDashboard & RahulDashboard,
 *   unassigned requests or requests with unmapped purchaser IDs belong to Himanshi Wadhwa.
 */
export const isRequestForUser = (r, user, purchasers = []) => {
  if (!r || !user) return false;
  if (user.role === "superadmin" || user.role === "owner") return true;

  const userId = String(user.id || "").trim().toLowerCase();
  const userName = String(user.name || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();

  const isHimanshi = userId === "u-himanshi" || 
    userName.includes("himanshi") || 
    userEmail.includes("himanshi");

  const isPurchaseManager = user.role === "purchase_manager" || 
    (user.designation && String(user.designation).toLowerCase().includes("purchase manager")) ||
    userName.includes("anees");

  // Core purchasing leadership & primary purchaser (Himanshi & Anees) have full access to all purchase orders
  if (isHimanshi || isPurchaseManager) {
    return true;
  }

  const rPurchaserId = String(r.purchaserId || "").trim().toLowerCase();
  const rPurchaserName = String(r.purchaserName || r.assignedPurchaser || r.purchaser || "").trim().toLowerCase();

  // 1. Direct ID match
  if (rPurchaserId && userId && rPurchaserId === userId) return true;

  // 2. Direct Name match in r.purchaserId
  if (rPurchaserId && userName && (rPurchaserId === userName || rPurchaserId.includes(userName) || userName.includes(rPurchaserId))) {
    return true;
  }

  // 3. Name match in r.purchaserName, r.assignedPurchaser, r.purchaser
  if (rPurchaserName) {
    if (userName && (rPurchaserName === userName || rPurchaserName.includes(userName) || userName.includes(rPurchaserName))) {
      return true;
    }
    if (userId && rPurchaserName === userId) return true;
  }

  // 4. Default unassigned requests belong to general purchase pool
  if (!rPurchaserId && !rPurchaserName) {
    return true;
  }

  return false;
};

/**
 * Determines whether a vendor is accessible to the specified user.
 * Supports:
 * - Admin/Owner bypass
 * - purchaserIds matching user.id or user.name
 * - Himanshi matching "himanshi" or "u-himanshi" in purchaserIds
 * - Associated orders: if user has any orders with this vendor, vendor is accessible
 * - Unassigned vendor pool: vendors with no assigned purchasers are accessible to all purchasers
 */
export const isVendorForUser = (v, user, requests = []) => {
  if (!v || !user) return false;
  if (user.role === "superadmin" || user.role === "owner") return true;

  const userId = String(user.id || "").trim().toLowerCase();
  const userName = String(user.name || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();

  const isHimanshi = userId === "u-himanshi" || 
    userName.includes("himanshi") || 
    userEmail.includes("himanshi");

  const isPurchaseManager = user.role === "purchase_manager" || 
    (user.designation && String(user.designation).toLowerCase().includes("purchase manager")) ||
    userName.includes("anees");

  // Core purchasing leadership & primary purchaser (Himanshi & Anees) have full access to all vendors
  if (isHimanshi || isPurchaseManager) {
    return true;
  }

  const pIds = Array.isArray(v.purchaserIds) ? v.purchaserIds.map(x => String(x || "").trim().toLowerCase()) : [];

  // 1. Direct ID match
  if (userId && pIds.includes(userId)) return true;

  // 2. Direct Name match
  if (userName && pIds.some(pid => pid === userName || pid.includes(userName) || userName.includes(pid))) {
    return true;
  }

  // 3. Himanshi match in purchaserIds
  if (isHimanshi && pIds.some(pid => pid.includes("himanshi") || pid === "u-himanshi")) {
    return true;
  }

  // 4. Has existing orders for this vendor
  if (Array.isArray(requests) && requests.some(r => r && r.vendorId === v.id && isRequestForUser(r, user))) {
    return true;
  }

  // 5. Unassigned vendors are accessible to all purchasers
  if (pIds.length === 0) {
    return true;
  }

  return false;
};

/**
 * Gets a clean display name for the purchaser of a request.
 */
export const getPurchaserDisplayName = (r, purchasers = []) => {
  if (!r) return "Himanshi Wadhwa";
  if (r.purchaserId) {
    const found = (purchasers || []).find(p => p.id === r.purchaserId || (p.name && p.name.toLowerCase() === String(r.purchaserId).toLowerCase()));
    if (found) return found.name;
  }
  if (r.purchaserName) return r.purchaserName;
  if (r.assignedPurchaser) return r.assignedPurchaser;
  if (r.purchaser) return r.purchaser;
  if (r.purchaserId) {
    const clean = String(r.purchaserId).trim();
    if (clean.toLowerCase().includes("himanshi")) return "Himanshi Wadhwa";
    if (clean.toLowerCase().includes("anees")) return "Anees";
    if (clean.toLowerCase().includes("nitin")) return "Nitin Kumar";
    if (clean.toLowerCase().includes("rahul")) return "Rahul";
    return clean;
  }
  return "Himanshi Wadhwa";
};
