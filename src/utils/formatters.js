export const formatIndianCurrency = (amount, symbol = "?") => {
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
