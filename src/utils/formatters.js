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

export const normalizeCategoryName = (category) => {
  if (!category) return "General";
  const str = String(category).trim();
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
