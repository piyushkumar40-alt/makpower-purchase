import React from "react";
import { Calendar, X } from "lucide-react";

export default function DateRangeFilter({ 
  startDate = "", 
  endDate = "", 
  onStartDateChange, 
  onEndDateChange, 
  onClear 
}) {

  const handlePreset = (presetType) => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split("T")[0];

    if (presetType === "all") {
      onStartDateChange("");
      onEndDateChange("");
    } else if (presetType === "today") {
      const dateStr = formatDate(today);
      onStartDateChange(dateStr);
      onEndDateChange(dateStr);
    } else if (presetType === "week") {
      const pastWeek = new Date(today);
      pastWeek.setDate(today.getDate() - 7);
      onStartDateChange(formatDate(pastWeek));
      onEndDateChange(formatDate(today));
    } else if (presetType === "month") {
      const pastMonth = new Date(today);
      pastMonth.setMonth(today.getMonth() - 1);
      onStartDateChange(formatDate(pastMonth));
      onEndDateChange(formatDate(today));
    }
  };

  const hasFilter = Boolean(startDate || endDate);

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.15)", padding: "4px 10px", borderRadius: "8px", border: "1px solid var(--border-glass)" }}>
        <Calendar size={14} style={{ color: "var(--primary)" }} />
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Between Dates:</span>

        <input 
          type="date" 
          className="form-control" 
          value={startDate} 
          onChange={e => onStartDateChange(e.target.value)}
          style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto", height: "32px" }}
          placeholder="Start Date"
        />
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>to</span>
        <input 
          type="date" 
          className="form-control" 
          value={endDate} 
          onChange={e => onEndDateChange(e.target.value)}
          style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto", height: "32px" }}
          placeholder="End Date"
        />

        {hasFilter && (
          <button 
            onClick={onClear} 
            className="btn btn-sm btn-secondary" 
            style={{ padding: "4px 8px", height: "32px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
            title="Clear Date Filter"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "4px" }}>
        <button onClick={() => handlePreset("all")} className={`btn btn-sm ${!startDate && !endDate ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
          All Time
        </button>
        <button onClick={() => handlePreset("today")} className="btn btn-sm btn-secondary" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
          Today
        </button>
        <button onClick={() => handlePreset("week")} className="btn btn-sm btn-secondary" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
          Last 7 Days
        </button>
        <button onClick={() => handlePreset("month")} className="btn btn-sm btn-secondary" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
          Last 30 Days
        </button>
      </div>
    </div>
  );
}

// Helper utility to parse various date formats reliably into Unix timestamp
export function parseDateTimestamp(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    const t = dateStr.getTime();
    return isNaN(t) ? null : t;
  }
  const str = String(dateStr).trim();
  if (!str) return null;

  // Check ISO YYYY-MM-DD (e.g. "2026-01-05" or "2026-01-05T10:30:00Z")
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d).getTime();
  }

  // Check DD-MM-YYYY or DD/MM/YYYY (e.g. "05-01-2026", "25/08/2026")
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return new Date(y, m, d).getTime();
  }

  // Fallback to standard JavaScript Date parser
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;
  return null;
}

// Helper utility to check if a date string falls in range (inclusive)
export function isDateInBetween(dateStr, startDate, endDate) {
  if (!startDate && !endDate) return true;
  if (!dateStr) return false;

  const targetTs = parseDateTimestamp(dateStr);
  if (!targetTs) return true; // If unparseable, don't hide by default unless strict

  if (startDate) {
    const startTs = parseDateTimestamp(startDate);
    if (startTs) {
      const startDay = new Date(startTs).setHours(0, 0, 0, 0);
      if (targetTs < startDay) return false;
    }
  }

  if (endDate) {
    const endTs = parseDateTimestamp(endDate);
    if (endTs) {
      const endDay = new Date(endTs).setHours(23, 59, 59, 999);
      if (targetTs > endDay) return false;
    }
  }

  return true;
}

