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
  // Strip leading prefixes like "Z ", "ZZ ", "S " (case-insensitive, including any chained combinations)
  str = str.replace(/^((ZZ|Z|S)\s+)+/i, "").trim();
  return str;
};

export const normalizeCategoryName = (category) => {
  if (!category) return "General";
  let str = cleanCategoryName(String(category));
  if (!str) return "General";
  if (str.toLowerCase().includes("polymer")) {
    return "Polymer";
  }
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
    // Avoid UTC timezone day shifts across midnight in local time
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, "0");
    const d = String(dateVal.getDate()).padStart(2, "0");
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
    // Swapped day and month (e.g. 2026-08-07 <-> 2026-07-08)
    variants.add(`${parts[0]}-${parts[2]}-${parts[1]}`);
    variants.add(`${parts[2]}/${parts[1]}/${parts[0]}`);
    variants.add(`${parts[1]}/${parts[2]}/${parts[0]}`);
    const mTrim = String(parseInt(parts[1], 10));
    const dTrim = String(parseInt(parts[2], 10));
    variants.add(`${mTrim}/${dTrim}/${parts[0]}`);
    variants.add(`${dTrim}/${mTrim}/${parts[0]}`);
  }
  return Array.from(variants);
};
