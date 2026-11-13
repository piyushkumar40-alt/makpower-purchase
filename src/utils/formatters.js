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

export const cleanCategoryName = (category, itemName = "") => {
  const itemStr = itemName && typeof itemName === "string" ? itemName.trim() : "";
  const itemLower = itemStr.toLowerCase();

  // If item name or description contains pouch -> always "Pouch Battery"
  if (itemLower.includes("pouch")) {
    return "Pouch Battery";
  }

  if (!category || typeof category !== "string") {
    return category || "";
  }
  let str = category.trim();

  // 1. Remove "Z ", "ZZ ", "S " wording from everywhere (prefixes, suffixes, internal words)
  str = str.replace(/^((ZZ|Z|S)[\s\-_]+)+/gi, "");
  str = str.replace(/([\s\-_]+(ZZ|Z|S))+$/gi, "");
  str = str.replace(/\b(ZZ|Z|S)\b[\s\-_]*/gi, " ");
  str = str.replace(/\s+/g, " ").trim();

  if (!str) return "";

  const lower = str.toLowerCase();

  // 2. Pouch Batteries -> "Pouch Battery"
  if (
    lower === "pouch" ||
    lower.includes("pouch") ||
    lower.includes("pouch battery") ||
    lower.includes("pouch batteries")
  ) {
    return "Pouch Battery";
  }

  // 3. Merge all polymers into single "Polymer" (excluding pouch batteries)
  if (
    !lower.includes("pouch") && (
      lower === "polymer" ||
      lower.includes("polymer") ||
      lower.includes("li-poly") ||
      lower.includes("lithium poly") ||
      lower.includes("poly battery") ||
      lower === "polymers" ||
      lower.startsWith("poly ")
    )
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

  // Normalize year helper: converts 2-digit or 00xx years (e.g. 0026 -> 2026, 26 -> 2026, 1926 -> 2026)
  const normalizeYear = (yrStr) => {
    let yNum = parseInt(yrStr, 10);
    if (isNaN(yNum)) return yrStr;
    if (yNum < 100) return String(2000 + yNum);
    if (yNum >= 1900 && yNum < 1950) return String(yNum + 100);
    return String(yNum);
  };

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const formatYmd = (yRaw, mRaw, dRaw) => {
      const y = normalizeYear(yRaw);
      const m = String(mRaw).padStart(2, "0");
      const d = String(dRaw).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    if (dateVal.getUTCHours() === 0 && dateVal.getUTCMinutes() === 0 && dateVal.getUTCSeconds() === 0) {
      return formatYmd(dateVal.getUTCFullYear(), dateVal.getUTCMonth() + 1, dateVal.getUTCDate());
    }
    if (dateVal.getHours() === 0 && dateVal.getMinutes() === 0 && dateVal.getSeconds() === 0) {
      return formatYmd(dateVal.getFullYear(), dateVal.getMonth() + 1, dateVal.getDate());
    }
    const buffered = new Date(dateVal.getTime() + 12 * 3600 * 1000);
    return formatYmd(buffered.getUTCFullYear(), buffered.getUTCMonth() + 1, buffered.getUTCDate());
  }

  let str = String(dateVal).trim();
  if (!str) return "";

  // 1. Correct 00xx- prefix (e.g. 0026-12-08 -> 2026-12-08)
  if (/^00\d{2}[-\/\.]/.test(str)) {
    str = "20" + str.slice(2);
  }

  // 2. Check if numeric serial (Excel date: e.g. 40000 to 60000)
  const num = Number(str);
  if (!isNaN(num) && num > 25000 && num < 65000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = normalizeYear(d.getUTCFullYear());
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dt = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    }
  }

  // 3. Check YYYY-MM-DD or YYYY-DD-MM (e.g. 2026-07-08 or 2026-08-19 or 0026-12-08)
  const ymdMatch = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (ymdMatch) {
    const y = normalizeYear(ymdMatch[1]);
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

  // 4. Check DD-MM-YYYY or MM-DD-YYYY or D/M/YYYY or M/D/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = normalizeYear(slashMatch[3]);

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

  const userId = String(user.id || "").trim().toLowerCase();
  const userName = String(user.name || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();

  const rPurchaserId = String(r.purchaserId || "").trim().toLowerCase();
  const rPurchaserName = String(r.purchaserName || r.assignedPurchaser || r.purchaser || "").trim().toLowerCase();

  const cleanStr = (s) => String(s || "").toLowerCase().replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/i, "").trim();
  const cleanUserName = cleanStr(userName);
  const cleanRPurchaserName = cleanStr(rPurchaserName);

  // 1. Direct ID match
  if (rPurchaserId && userId && rPurchaserId === userId) return true;

  // 2. Anees special aliases & ID matching
  const isAnees = userId === "u-anees" || cleanUserName.includes("anees") || userEmail.includes("anees");
  if (isAnees) {
    if (
      rPurchaserId === "u-anees" || 
      rPurchaserId === "anees" || 
      rPurchaserId.includes("anees") || 
      cleanRPurchaserName.includes("anees")
    ) {
      return true;
    }
  }

  // 3. Rahul Kumar special aliases (legacy u-rahul was used before separation from Rahul Mann in Accounts)
  const isRahulKumar = userId === "u-rahul-kumar" || 
    (cleanUserName.includes("rahul") && !cleanUserName.includes("mann")) || 
    userEmail.includes("rahulkumar");

  if (isRahulKumar) {
    if (
      rPurchaserId === "u-rahul-kumar" || 
      rPurchaserId === "u-rahul" || 
      rPurchaserId === "rahul" || 
      rPurchaserId.includes("rahul") || 
      (cleanRPurchaserName.includes("rahul") && !cleanRPurchaserName.includes("mann"))
    ) {
      return true;
    }
  }

  // 4. Himanshi special aliases & ID matching
  const isHimanshi = userId === "u-himanshi" || 
    cleanUserName.includes("himanshi") || 
    userEmail.includes("himanshi");

  if (isHimanshi) {
    if (
      rPurchaserId === "u-himanshi" || 
      rPurchaserId === "himanshi" || 
      rPurchaserId.includes("himanshi") || 
      cleanRPurchaserName.includes("himanshi")
    ) {
      return true;
    }
  }

  // 5. Direct Name match in r.purchaserId or r.purchaserName
  if (cleanUserName) {
    if (rPurchaserId && (rPurchaserId === cleanUserName || rPurchaserId.includes(cleanUserName))) return true;
    if (cleanRPurchaserName && (cleanRPurchaserName === cleanUserName || cleanRPurchaserName.includes(cleanUserName) || cleanUserName.includes(cleanRPurchaserName))) return true;
  }
  if (userId && cleanRPurchaserName && cleanRPurchaserName === userId) return true;

  // 6. Check if explicitly assigned to ANOTHER active purchaser (Anees, Himanshi, Rahul Kumar, etc.)
  if (!isAnees && (rPurchaserId === "u-anees" || rPurchaserId.includes("anees") || cleanRPurchaserName.includes("anees"))) {
    return false;
  }
  if (!isRahulKumar && (rPurchaserId === "u-rahul-kumar" || rPurchaserId === "u-rahul" || (rPurchaserId.includes("rahul") && !rPurchaserId.includes("mann")) || (cleanRPurchaserName.includes("rahul") && !cleanRPurchaserName.includes("mann")))) {
    return false;
  }
  if (!isHimanshi && (rPurchaserId === "u-himanshi" || rPurchaserId.includes("himanshi") || cleanRPurchaserName.includes("himanshi"))) {
    return false;
  }

  const isAssignedToOther = (purchasers || []).some(p => {
    const pId = String(p.id || "").trim().toLowerCase();
    const pCleanName = cleanStr(p.name);
    if (!pId || pId === userId || (cleanUserName && pCleanName === cleanUserName)) return false;

    return (rPurchaserId && (rPurchaserId === pId || rPurchaserId === pCleanName || (pCleanName && rPurchaserId.includes(pCleanName)))) ||
           (cleanRPurchaserName && (cleanRPurchaserName === pId || cleanRPurchaserName === pCleanName || (pCleanName && cleanRPurchaserName.includes(pCleanName))));
  });

  if (isAssignedToOther) {
    return false;
  }

  // 7. Legacy fallback: only completely unassigned orders (no ID and no name) default to Himanshi
  if (isHimanshi && !rPurchaserId && !rPurchaserName) {
    return true;
  }

  return false;
};

/**
 * Determines whether a vendor is accessible to the specified user.
 * Supports:
 * - Admin/Manager bypass (SuperAdmin, Owner, Admin, Purchase Manager)
 * - purchaserIds matching user.id or user.name
 * - Himanshi matching "himanshi" or "u-himanshi" in purchaserIds
 * - Associated orders: if user has any orders with this vendor, vendor is accessible
 * - Unassigned vendor pool: vendors with no assigned purchasers are accessible to all purchasers
 */
export const isVendorForUser = (v, user, requests = []) => {
  if (!v || !user) return false;
  if (user.role === "superadmin" || user.role === "owner" || user.role === "admin") return true;

  const isPurchaseManager = user.role === "purchase_manager" || 
    user.role === "purchase-manager" ||
    (user.designation && String(user.designation).toLowerCase().includes("purchase manager")) ||
    String(user.name || "").toLowerCase().includes("anees");

  // Purchase Manager has full access to all vendors
  if (isPurchaseManager) {
    return true;
  }

  const userId = String(user.id || "").trim().toLowerCase();
  const userName = String(user.name || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();

  const pIds = Array.isArray(v.purchaserIds) ? v.purchaserIds.map(x => String(x || "").trim().toLowerCase()) : [];

  // 1. Direct ID match
  if (userId && pIds.includes(userId)) return true;

  // 2. Direct Name match
  if (userName && pIds.some(pid => pid === userName || pid.includes(userName) || userName.includes(pid))) {
    return true;
  }

  // 3. Himanshi match in purchaserIds
  const isHimanshi = userId === "u-himanshi" || 
    userName.includes("himanshi") || 
    userEmail.includes("himanshi");
  if (isHimanshi && pIds.some(pid => pid.includes("himanshi") || pid === "u-himanshi")) {
    return true;
  }

  // 4. Rahul Kumar match in purchaserIds (supports legacy u-rahul / rahul)
  const isRahulKumar = userId === "u-rahul-kumar" || 
    (userName.includes("rahul") && !userName.includes("mann")) || 
    userEmail.includes("rahulkumar");
  if (isRahulKumar && pIds.some(pid => pid.includes("rahul") || pid === "u-rahul" || pid === "u-rahul-kumar")) {
    return true;
  }

  // 5. Has existing orders for this vendor related to this purchaser
  if (Array.isArray(requests) && requests.some(r => r && r.vendorId === v.id && isRequestForUser(r, user))) {
    return true;
  }

  // 6. Unassigned vendors are accessible to all purchasers
  if (pIds.length === 0) {
    return true;
  }

  return false;
};

/**
 * Gets a clean display name for the purchaser of a request.
 */
export const getPurchaserDisplayName = (r, purchasers = []) => {
  if (!r) return "Mrs. Himanshi Wadhwa";
  if (r.purchaserId) {
    const found = (purchasers || []).find(p => p.id === r.purchaserId || (p.name && p.name.toLowerCase() === String(r.purchaserId).toLowerCase()));
    if (found) return found.name;
    // Map legacy u-rahul / rahul to Rahul Kumar
    if (r.purchaserId === "u-rahul" || String(r.purchaserId).toLowerCase() === "rahul" || String(r.purchaserId).toLowerCase().includes("rahul")) {
      const rk = (purchasers || []).find(p => p.id === "u-rahul-kumar" || (p.name && p.name.toLowerCase().includes("rahul") && !p.name.toLowerCase().includes("mann")));
      if (rk) return rk.name;
      return "Mr. Rahul Kumar";
    }
  }
  if (r.purchaserName) {
    const pNameLower = String(r.purchaserName).toLowerCase();
    if (pNameLower.includes("rahul") && !pNameLower.includes("mann")) {
      const rk = (purchasers || []).find(p => p.id === "u-rahul-kumar" || (p.name && p.name.toLowerCase().includes("rahul") && !p.name.toLowerCase().includes("mann")));
      if (rk) return rk.name;
      return "Mr. Rahul Kumar";
    }
    return r.purchaserName;
  }
  if (r.assignedPurchaser) {
    const aLower = String(r.assignedPurchaser).toLowerCase();
    if (aLower.includes("rahul") && !aLower.includes("mann")) {
      const rk = (purchasers || []).find(p => p.id === "u-rahul-kumar" || (p.name && p.name.toLowerCase().includes("rahul") && !p.name.toLowerCase().includes("mann")));
      if (rk) return rk.name;
      return "Mr. Rahul Kumar";
    }
    return r.assignedPurchaser;
  }
  if (r.purchaser) {
    const prLower = String(r.purchaser).toLowerCase();
    if (prLower.includes("rahul") && !prLower.includes("mann")) {
      const rk = (purchasers || []).find(p => p.id === "u-rahul-kumar" || (p.name && p.name.toLowerCase().includes("rahul") && !p.name.toLowerCase().includes("mann")));
      if (rk) return rk.name;
      return "Mr. Rahul Kumar";
    }
    return r.purchaser;
  }
  if (r.purchaserId) {
    const clean = String(r.purchaserId).trim();
    if (clean.toLowerCase().includes("himanshi")) return "Mrs. Himanshi Wadhwa";
    if (clean.toLowerCase().includes("anees")) return "Mr. Anees";
    if (clean.toLowerCase().includes("nitin")) return "Nitin Kumar";
    if (clean.toLowerCase().includes("rahul")) {
      const rk = (purchasers || []).find(p => p.id === "u-rahul-kumar" || (p.name && p.name.toLowerCase().includes("rahul") && !p.name.toLowerCase().includes("mann")));
      return rk ? rk.name : "Mr. Rahul Kumar";
    }
    return clean;
  }
  return "Mrs. Himanshi Wadhwa";
};

/**
 * Opens or downloads a document given its fileData (URL or Base64 Data URI) and fileName.
 * - For images & PDFs: opens in a new tab for instant viewing.
 * - For Excel (.xlsx, .xls), CSV, or other binary files: triggers a browser download so Excel or the OS opens it.
 */
export const downloadOrOpenBlob = async (fileData, fileName = "document") => {
  if (!fileData) return false;

  const lowerName = String(fileName || "").toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(lowerName) || /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(String(fileData));
  const isPdf = /\.pdf(\?.*)?$/i.test(lowerName) || /\.pdf(\?.*)?$/i.test(String(fileData));

  // 1. HTTP or HTTPS web URL (e.g. Cloudinary CDN)
  if (typeof fileData === "string" && (fileData.startsWith("http://") || fileData.startsWith("https://"))) {
    if (isImage || isPdf) {
      window.open(fileData, "_blank", "noopener,noreferrer");
      return true;
    }

    // For spreadsheets (.xlsx, .xls, .csv) & binary documents:
    // Fetch blob so download attribute works 100% with exact filename across all browsers
    try {
      const resp = await fetch(fileData);
      if (resp.ok) {
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName || "document.xlsx";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return true;
      }
    } catch (err) {
      console.warn("Direct blob download failed, falling back to window.open:", err);
    }

    // Fallback: direct window.open
    window.open(fileData, "_blank");
    return true;
  }

  // 2. Base64 Data URI
  if (typeof fileData === "string" && fileData.startsWith("data:")) {
    try {
      const parts = fileData.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      let mime = mimeMatch ? mimeMatch[1] : "";

      if (!mime || mime === "application/octet-stream") {
        if (lowerName.endsWith(".xlsx")) mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        else if (lowerName.endsWith(".xls")) mime = "application/vnd.ms-excel";
        else if (lowerName.endsWith(".csv")) mime = "text/csv";
        else if (lowerName.endsWith(".pdf")) mime = "application/pdf";
        else if (lowerName.endsWith(".png")) mime = "image/png";
        else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) mime = "image/jpeg";
        else if (lowerName.endsWith(".webp")) mime = "image/webp";
        else mime = "application/octet-stream";
      }

      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const isImg = mime.startsWith("image/");
      const isPdfMime = mime === "application/pdf";

      if (isImg || isPdfMime) {
        window.open(blobUrl, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      return true;
    } catch (e) {
      console.error("Error opening base64 data:", e);
      window.open(fileData, "_blank");
      return true;
    }
  }

  return false;
};

export const getCurrencySymbol = (cur) => {
  const c = (cur || "").toString().toUpperCase().trim();
  if (c === "USD" || c === "$") return "$";
  if (c === "INR" || c === "RS" || c === "₹") return "₹";
  return "¥";
};

export const calculateTotalCargoPrice = (cargo, order) => {
  const c = cargo || order;
  if (!c) return 0;
  const rate = parseFloat(c.cargoPrice || 0);
  const uom = c.cargoPriceUom || "";
  const basis = parseFloat(c.cbmPackingList || 0);
  const stored = parseFloat(c.totalCargoPrice);

  if (uom === "per CBM" || uom === "per KG") {
    if (rate > 0 && basis > 0) {
      if (isNaN(stored) || !stored || stored === rate) {
        return rate * basis;
      }
      return stored;
    }
  } else if (uom === "per Pc") {
    if (rate > 0 && basis > 0) {
      if (isNaN(stored) || !stored || stored === rate) {
        return rate * basis;
      }
      return stored;
    }
  }

  if (!isNaN(stored) && stored > 0) return stored;
  if (!isNaN(rate) && rate > 0) return rate;
  return 0;
};

/**
 * Calculates the SLA deadline and status for Step 2 Vendor Bill Verification.
 * 
 * Rules:
 * 1. Has Bill: cargo must have invoiceFile / bill uploaded.
 * 2. Material Received: cargo.isMaterialRec === "Yes" || Boolean(cargo.receivedDate).
 * 3. Pre-condition for SLA: BOTH bill must be uploaded AND material must be received.
 *    - If bill is uploaded BUT material is NOT received yet (e.g. in transit):
 *      Not overdue! Status is "awaiting_material". SLA starts once warehouse receives goods.
 * 4. Two Scenarios when both are present:
 *    - Scenario 1 (Bill uploaded earlier, material received today/later):
 *      Trigger date = Material Received Date (cargo.receivedDate).
 *      Rahul has 3 working days (excluding Sunday) from material received date.
 *    - Scenario 2 (Material received earlier, bill uploaded later):
 *      Trigger date = Bill Upload Date (cargo.billUploadedAt).
 *      Rahul has 3 working days (excluding Sunday) from bill upload date.
 * 5. Working Days calculation (excluding Sunday):
 *    Starting from triggerDate, count 3 days skipping getDay() === 0 (Sunday).
 */
export const calculateBillSlaStatus = (cargo) => {
  const hasBill = Boolean(cargo?.invoiceFile);
  if (!hasBill) {
    return { hasBill: false, shouldShow: false };
  }

  const isVerified = cargo.billStatus === "verified" || Boolean(cargo.billVerifiedAt);
  const isMaterialReceived = cargo.isMaterialRec === "Yes" || Boolean(cargo.receivedDate) || Boolean(cargo.actualReceivedDate);

  if (!isMaterialReceived) {
    return {
      hasBill: true,
      shouldShow: true,
      isVerified,
      isMaterialReceived: false,
      scenario: "awaiting_material",
      scenarioLabel: "In Freight Transit • Awaiting Material Receipt",
      statusLabel: "Waiting for Warehouse Material Receipt",
      isOverdue: false,
      isDueToday: false,
      daysRemaining: null,
      deadlineDate: null,
      billUploadedAt: cargo.billUploadedAt,
      description: "Bill uploaded by purchaser • 3-day SLA countdown will begin once material is received at warehouse."
    };
  }

  // Both bill uploaded AND material received!
  const rawRec = cargo.receivedDate || cargo.actualReceivedDate || "";
  const rawUpload = cargo.billUploadedAt || cargo.cargoShippingDate || cargo.cargoOrderDate || "";

  const normRec = parseFlexibleDate(rawRec) || rawRec;
  const normUpload = parseFlexibleDate(rawUpload) || rawUpload;

  const recDateObj = normRec ? new Date(normRec) : null;
  const uploadDateObj = normUpload ? new Date(normUpload) : null;

  const recTs = recDateObj && !isNaN(recDateObj.getTime()) ? recDateObj.getTime() : 0;
  const uploadTs = uploadDateObj && !isNaN(uploadDateObj.getTime()) ? uploadDateObj.getTime() : 0;

  let triggerDateStr = "";
  let triggerDateObj = null;
  let scenario = "";

  if (recTs >= uploadTs && recTs > 0) {
    // Scenario 1: Bill uploaded earlier, material received today/later -> 3 days from material received date
    triggerDateStr = normRec || rawRec;
    triggerDateObj = recDateObj;
    scenario = "material_received_after_bill";
  } else if (uploadTs > 0) {
    // Scenario 2: Material received earlier, bill uploaded later -> 3 days from bill upload date
    triggerDateStr = normUpload || rawUpload;
    triggerDateObj = uploadDateObj;
    scenario = "bill_uploaded_after_material";
  } else {
    triggerDateStr = normRec || normUpload || new Date().toISOString().split("T")[0];
    triggerDateObj = new Date(triggerDateStr);
    scenario = "standard";
  }

  // Add 3 working days excluding Sundays
  const cur = new Date(triggerDateObj.getFullYear(), triggerDateObj.getMonth(), triggerDateObj.getDate());
  let addedWorkingDays = 0;
  while (addedWorkingDays < 3) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) { // 0 is Sunday
      addedWorkingDays++;
    }
  }
  cur.setHours(23, 59, 59, 999);

  const now = new Date();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const deadlineMidnight = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()).getTime();

  let diffDays = 0;
  if (nowMidnight > deadlineMidnight) {
    let c = new Date(deadlineMidnight);
    while (c < nowMidnight) {
      c.setDate(c.getDate() + 1);
      if (c.getDay() !== 0) {
        diffDays--;
      }
    }
  } else if (nowMidnight < deadlineMidnight) {
    let c = new Date(nowMidnight);
    while (c < deadlineMidnight) {
      c.setDate(c.getDate() + 1);
      if (c.getDay() !== 0) {
        diffDays++;
      }
    }
  } else {
    diffDays = 0;
  }

  const isOverdue = diffDays < 0;
  const isDueToday = diffDays === 0;

  return {
    hasBill: true,
    shouldShow: true,
    isVerified,
    isMaterialReceived: true,
    scenario,
    scenarioLabel: scenario === "material_received_after_bill" 
      ? "Scenario 1: Bill Uploaded Earlier • Material Received Later" 
      : "Scenario 2: Material Received Earlier • Bill Uploaded Later",
    triggerDate: triggerDateStr,
    deadlineDate: cur,
    deadlineFormatted: cur.toLocaleDateString(),
    daysRemaining: diffDays,
    isOverdue,
    isDueToday,
    description: scenario === "material_received_after_bill"
      ? `Material received on ${rawRec || triggerDateStr}. Rahul Accounts has 3 working days (excl. Sunday) from receipt date to verify bill.`
      : `Bill uploaded on ${rawUpload ? new Date(rawUpload).toLocaleDateString() : triggerDateStr}. Rahul Accounts has 3 working days (excl. Sunday) from upload date to verify bill.`
  };
};

export const calculateCargoTotalCartons = (cargo, requests = []) => {
  if (!cargo) return 0;
  if (cargo.totalCartons != null && cargo.totalCartons !== "" && !isNaN(parseInt(cargo.totalCartons, 10))) {
    const directVal = parseInt(cargo.totalCartons, 10);
    if (directVal > 0) return directVal;
  }
  if (!Array.isArray(requests) || requests.length === 0) return 0;
  const cargoItems = requests.filter(r => r.cargoId === cargo.id || (cargo.cargoDetail && r.cargoId === cargo.cargoDetail));
  return cargoItems.reduce((sum, r) => {
    if (r.totalCartons != null && r.totalCartons !== "" && !isNaN(parseInt(r.totalCartons, 10))) {
      return sum + parseInt(r.totalCartons, 10);
    }
    const ipc = parseInt(r.itemsPerCarton, 10);
    const qty = parseInt(r.cargoPickedQty || r.vendorOrderQuantity || r.orderQuantity || 0, 10);
    if (ipc > 0 && qty > 0) {
      return sum + Math.ceil(qty / ipc);
    }
    return sum;
  }, 0);
};

export const calculateItemCartons = (item) => {
  if (!item) return 0;
  if (item.totalCartons != null && item.totalCartons !== "" && !isNaN(parseInt(item.totalCartons, 10))) {
    return parseInt(item.totalCartons, 10);
  }
  const ipc = parseInt(item.itemsPerCarton, 10);
  const qty = parseInt(item.cargoPickedQty || item.vendorOrderQuantity || item.orderQuantity || 0, 10);
  if (ipc > 0 && qty > 0) {
    return Math.ceil(qty / ipc);
  }
  return 0;
};


export const formatCancelDate = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  } catch (e) {}
  return String(val).split("T")[0] || "—";
};

export const formatCancelTime = (val) => {
  if (!val) return "—";
  try {
    if (typeof val === "string" && !val.includes("T") && !val.includes(":")) {
      return "—";
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    }
  } catch (e) {}
  return "—";
};

export const formatPunchDateTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      return `${datePart}, ${timePart}`;
    }
  } catch (e) {}
  return String(val) || "—";
};

export const formatPunchDate = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  } catch (e) {}
  return String(val).split("T")[0] || "—";
};

export const formatPunchTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
  } catch (e) {}
  return "—";
};

/**
 * Intelligent parser for pasted price rows.
 * Supports:
 * - Single Price: "20", "15.5", "¥20", "$ 15.5", "20 RMB" -> { type: "price_only", price: 20, currency }
 * - Model & Price (tab, space, comma, colon): "dx45 20", "48DX\t22.5", "39LX, 15.5", "dx45: 20"
 *   -> { type: "model_price", model: "dx45", price: 20, currency }
 * Prevents concatenating letters/numbers into huge numbers like "4520" for "dx45 20".
 */
export const parsePastedPriceLine = (rawLine) => {
  const line = (rawLine || "").trim();
  if (!line) return null;

  // Detect currency if explicitly present in line
  let detectedCurrency = null;
  if (/¥|rmb|cny/i.test(line)) detectedCurrency = "RMB";
  else if (/\$|usd/i.test(line)) detectedCurrency = "USD";
  else if (/₹|inr/i.test(line)) detectedCurrency = "INR";

  // Check 1: Tab-separated columns (Excel / Google Sheets paste)
  if (line.includes("\t")) {
    const cols = line.split("\t").map(c => c.trim()).filter(Boolean);
    if (cols.length >= 2) {
      const modelPart = cols[0];
      const pricePart = cols[cols.length - 1];
      const cleanPrice = pricePart.replace(/[¥$₹€,\s]|(?:rmb|usd|inr|cny)/gi, "").replace(/[^0-9.]/g, "");
      const parsedNum = parseFloat(cleanPrice);
      if (!isNaN(parsedNum)) {
        return { type: "model_price", model: modelPart, price: parsedNum, currency: detectedCurrency };
      }
    }
  }

  // Check 2: Comma or semicolon separated
  if (/[,;]/.test(line)) {
    const parts = line.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const modelPart = parts[0];
      const pricePart = parts[parts.length - 1];
      const cleanPrice = pricePart.replace(/[¥$₹€,\s]|(?:rmb|usd|inr|cny)/gi, "").replace(/[^0-9.]/g, "");
      const parsedNum = parseFloat(cleanPrice);
      if (!isNaN(parsedNum)) {
        return { type: "model_price", model: modelPart, price: parsedNum, currency: detectedCurrency };
      }
    }
  }

  // Check 3: Is the ENTIRE line just a number/price?
  // e.g. "20", "20.5", "¥20", "$ 15.5", "100 RMB"
  const entireCleanPrice = line.replace(/[¥$₹€,\s]|(?:rmb|usd|inr|cny)/gi, "");
  if (/^\d+(?:\.\d+)?$/.test(entireCleanPrice)) {
    const parsedNum = parseFloat(entireCleanPrice);
    if (!isNaN(parsedNum)) {
      return { type: "price_only", price: parsedNum, currency: detectedCurrency };
    }
  }

  // Check 4: Space-separated or delimiter-separated "Model Price"
  // e.g. "dx45 20", "48DX 22.0", "39LX  15.5", "iPhone 13 Pro 450", "dx45: 20", "dx45 - 20"
  const match = line.match(/^(.*?)(?:[\s\t,;:=]+)([\$¥₹€]?\s*\d+(?:\.\d+)?\s*(?:rmb|usd|inr|cny)?)$/i);
  if (match) {
    const modelPart = match[1].trim();
    const pricePart = match[2].trim();
    const cleanPrice = pricePart.replace(/[¥$₹€,\s]|(?:rmb|usd|inr|cny)/gi, "").replace(/[^0-9.]/g, "");
    const parsedNum = parseFloat(cleanPrice);
    if (modelPart && !isNaN(parsedNum)) {
      return { type: "model_price", model: modelPart, price: parsedNum, currency: detectedCurrency };
    }
  }

  // Fallback: If line contains multiple tokens, test if the last token is a valid price
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const lastToken = tokens[tokens.length - 1].replace(/[¥$₹€,\s]|(?:rmb|usd|inr|cny)/gi, "");
    const parsedNum = parseFloat(lastToken);
    if (!isNaN(parsedNum)) {
      const modelPart = tokens.slice(0, -1).join(" ");
      return { type: "model_price", model: modelPart, price: parsedNum, currency: detectedCurrency };
    }
  }

  return null;
};

/**
 * Fuzzy/normalized model matching between request model and pasted model name.
 */
export const isModelMatch = (reqModel, inputModel) => {
  if (!reqModel || !inputModel) return false;
  const rm = reqModel.trim().toLowerCase();
  const im = inputModel.trim().toLowerCase();
  if (rm === im) return true;

  // Normalized alphanumeric match (removes spaces, dashes, slashes, underscores)
  const normR = rm.replace(/[^a-z0-9]/g, "");
  const normI = im.replace(/[^a-z0-9]/g, "");
  if (normR === normI && normR.length > 0) return true;

  // Transposed letters & digits match (e.g. dx45 vs 45dx)
  const alphaR = normR.replace(/[0-9]/g, "");
  const numR = normR.replace(/[^0-9]/g, "");
  const alphaI = normI.replace(/[0-9]/g, "");
  const numI = normI.replace(/[^0-9]/g, "");
  if (alphaR && numR && alphaR === alphaI && numR === numI) return true;

  // Substring match if length is substantial
  if (normR.length >= 4 && normI.length >= 4) {
    if (normR.includes(normI) || normI.includes(normR)) return true;
  }

  return false;
};
/**
 * Resilient cargo matcher: checks if a request's cargoId matches a cargo object (or cargo ID string).
 * Matches by exact ID, trimmed case-insensitive ID, or cargoDetail.
 */
export const isCargoMatch = (reqCargoId, cargo) => {
  if (!reqCargoId || !cargo) return false;
  const rc = String(reqCargoId).trim().toLowerCase();
  if (typeof cargo === "string") {
    return rc === String(cargo).trim().toLowerCase();
  }
  const cid = String(cargo.id || "").trim().toLowerCase();
  const cDetail = cargo.cargoDetail ? String(cargo.cargoDetail).trim().toLowerCase() : "";
  return rc === cid || (cDetail !== "" && rc === cDetail);
};

/**
 * Reconciles base cargo shipments with active requests.
 * Ensures that if requests reference a cargoId not currently in the cargos array,
 * a synthesized cargo shipment is created and included.
 */
export const reconcileCargosWithRequests = (cargos = [], requests = []) => {
  const base = Array.isArray(cargos) ? [...cargos] : [];
  const knownKeys = new Set(
    base.flatMap(c => [
      String(c.id || "").trim().toLowerCase(),
      c.cargoDetail ? String(c.cargoDetail).trim().toLowerCase() : null
    ]).filter(Boolean)
  );

  const missingMap = new Map();
  (requests || []).forEach(r => {
    const cid = String(r.cargoId || "").trim();
    if (!cid || r.status === "Cancelled") return;
    const cidLower = cid.toLowerCase();
    if (!knownKeys.has(cidLower) && !missingMap.has(cidLower)) {
      missingMap.set(cidLower, {
        id: r.cargoId,
        cargoDetail: r.cargoDetail || r.cargoId,
        vendorId: r.vendorId || "",
        vendorName: r.vendorName || "",
        cargoOrderDate: r.vendorReadyDate || r.orderDate || new Date().toISOString().split("T")[0],
        cargoShippingDate: r.vendorReadyDate || r.orderDate || "",
        cargoEta: r.vendorEdd || "",
        modeOfTransport: "Sea",
        currency: r.currency || "RMB",
        isMaterialRec: r.isMaterialRec || "No",
        receivedDate: r.actualReceivedDate || (r.isMaterialRec === "Yes" ? (r.receivedDate || "") : ""),
        totalCartons: r.totalCartons || 0,
        synthetic: true
      });
    }
  });

  return missingMap.size > 0 ? [...base, ...missingMap.values()] : base;
};

