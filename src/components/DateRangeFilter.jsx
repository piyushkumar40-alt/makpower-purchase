import React, { useState, useEffect, useRef, useMemo } from "react";
import { Calendar, ChevronDown, ChevronRight, ChevronLeft, X, Check } from "lucide-react";

// Month names abbreviation
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Helper: Format Date object to "YYYY-MM-DD"
export function formatYMD(date) {
  if (!date || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper: Format "YYYY-MM-DD" to human display string e.g. "Aug 31, 2026"
export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const ts = parseDateTimestamp(dateStr);
  if (!ts) return dateStr;
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function DateRangeFilter({
  startDate = "",
  endDate = "",
  onStartDateChange,
  onEndDateChange,
  onClear,
  placeholder = "Select date range",
  buttonStyle = {},
  align = "left" // "left" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [rangeLabel, setRangeLabel] = useState("Fixed");
  
  // Menu Dropdown states
  const [showAutoMenu, setShowAutoMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // "thisMonth" | "last7Days" | null

  // Reference for click-outside
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => formatYMD(today), [today]);

  // Dual Calendar Month/Year states
  const [leftCal, setLeftCal] = useState(() => {
    const d = startDate ? new Date(parseDateTimestamp(startDate) || Date.now()) : today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [rightCal, setRightCal] = useState(() => {
    const d = endDate ? new Date(parseDateTimestamp(endDate) || Date.now()) : today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Sync temp dates when props change or popover opens
  useEffect(() => {
    if (isOpen) {
      setTempStart(startDate);
      setTempEnd(endDate);
      const sDate = startDate ? new Date(parseDateTimestamp(startDate) || Date.now()) : today;
      const eDate = endDate ? new Date(parseDateTimestamp(endDate) || Date.now()) : today;
      setLeftCal({ year: sDate.getFullYear(), month: sDate.getMonth() });
      setRightCal({ year: eDate.getFullYear(), month: eDate.getMonth() });
    }
  }, [isOpen, startDate, endDate, today]);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target) &&
        triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setShowAutoMenu(false);
        setActiveSubmenu(null);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Presets Generator Helper
  const applyPreset = (presetName, startYMD, endYMD) => {
    setTempStart(startYMD);
    setTempEnd(endYMD);
    setRangeLabel(presetName);
    setShowAutoMenu(false);
    setActiveSubmenu(null);

    // Sync calendars to selected dates
    if (startYMD) {
      const d = new Date(parseDateTimestamp(startYMD));
      setLeftCal({ year: d.getFullYear(), month: d.getMonth() });
    }
    if (endYMD) {
      const d = new Date(parseDateTimestamp(endYMD));
      setRightCal({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const handleSelectPreset = (key) => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();
    const curDay = now.getDay(); // 0 is Sunday, 1 is Monday

    switch (key) {
      case "all":
        applyPreset("All Time", "", "");
        break;
      case "today": {
        const d = formatYMD(now);
        applyPreset("Today", d, d);
        break;
      }
      case "yesterday": {
        const yest = new Date(now);
        yest.setDate(curDate - 1);
        const d = formatYMD(yest);
        applyPreset("Yesterday", d, d);
        break;
      }
      case "this_week_sun": {
        const start = new Date(now);
        start.setDate(curDate - curDay);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        applyPreset("This week (starts Sunday)", formatYMD(start), formatYMD(end));
        break;
      }
      case "this_week_sun_td": {
        const start = new Date(now);
        start.setDate(curDate - curDay);
        applyPreset("This week to date (starts Sunday)", formatYMD(start), formatYMD(now));
        break;
      }
      case "this_week_mon": {
        const start = new Date(now);
        const diff = curDay === 0 ? -6 : 1 - curDay;
        start.setDate(curDate + diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        applyPreset("This week (starts Monday)", formatYMD(start), formatYMD(end));
        break;
      }
      case "this_week_mon_td": {
        const start = new Date(now);
        const diff = curDay === 0 ? -6 : 1 - curDay;
        start.setDate(curDate + diff);
        applyPreset("This week to date (starts Monday)", formatYMD(start), formatYMD(now));
        break;
      }
      case "this_month": {
        const start = new Date(curYear, curMonth, 1);
        const end = new Date(curYear, curMonth + 1, 0);
        applyPreset("This month", formatYMD(start), formatYMD(end));
        break;
      }
      case "this_month_td": {
        const start = new Date(curYear, curMonth, 1);
        applyPreset("This month to date", formatYMD(start), formatYMD(now));
        break;
      }
      case "this_quarter": {
        const qStartMonth = Math.floor(curMonth / 3) * 3;
        const start = new Date(curYear, qStartMonth, 1);
        const end = new Date(curYear, qStartMonth + 3, 0);
        applyPreset("This quarter", formatYMD(start), formatYMD(end));
        break;
      }
      case "this_quarter_td": {
        const qStartMonth = Math.floor(curMonth / 3) * 3;
        const start = new Date(curYear, qStartMonth, 1);
        applyPreset("This quarter to date", formatYMD(start), formatYMD(now));
        break;
      }
      case "this_year": {
        const start = new Date(curYear, 0, 1);
        const end = new Date(curYear, 11, 31);
        applyPreset("This year", formatYMD(start), formatYMD(end));
        break;
      }
      case "this_year_td": {
        const start = new Date(curYear, 0, 1);
        applyPreset("This year to date", formatYMD(start), formatYMD(now));
        break;
      }
      case "last_7_days": {
        const start = new Date(now);
        start.setDate(curDate - 7);
        applyPreset("Last 7 days", formatYMD(start), formatYMD(now));
        break;
      }
      case "last_14_days": {
        const start = new Date(now);
        start.setDate(curDate - 14);
        applyPreset("Last 14 days", formatYMD(start), formatYMD(now));
        break;
      }
      case "last_28_days": {
        const start = new Date(now);
        start.setDate(curDate - 28);
        applyPreset("Last 28 days", formatYMD(start), formatYMD(now));
        break;
      }
      case "last_30_days": {
        const start = new Date(now);
        start.setDate(curDate - 30);
        applyPreset("Last 30 days", formatYMD(start), formatYMD(now));
        break;
      }
      case "last_week_sun": {
        const start = new Date(now);
        start.setDate(curDate - curDay - 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        applyPreset("Last week (starts Sunday)", formatYMD(start), formatYMD(end));
        break;
      }
      case "last_week_mon": {
        const start = new Date(now);
        const diff = curDay === 0 ? -6 : 1 - curDay;
        start.setDate(curDate + diff - 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        applyPreset("Last week (starts Monday)", formatYMD(start), formatYMD(end));
        break;
      }
      case "last_month": {
        const start = new Date(curYear, curMonth - 1, 1);
        const end = new Date(curYear, curMonth, 0);
        applyPreset("Last month", formatYMD(start), formatYMD(end));
        break;
      }
      case "last_quarter": {
        const qStartMonth = Math.floor(curMonth / 3) * 3 - 3;
        const start = new Date(curYear, qStartMonth, 1);
        const end = new Date(curYear, qStartMonth + 3, 0);
        applyPreset("Last quarter", formatYMD(start), formatYMD(end));
        break;
      }
      case "last_year": {
        const start = new Date(curYear - 1, 0, 1);
        const end = new Date(curYear - 1, 11, 31);
        applyPreset("Last year", formatYMD(start), formatYMD(end));
        break;
      }
      default:
        break;
    }
  };

  // Calendar Day Generation Helper
  const getCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    
    // Day of week: 0 for Monday (0-indexed in our M T W T F S S grid)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    const days = [];
    // Blank padding days before first of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // Month days
    for (let d = 1; d <= totalDays; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ day: d, ymd });
    }
    return days;
  };

  const leftDays = useMemo(() => getCalendarDays(leftCal.year, leftCal.month), [leftCal]);
  const rightDays = useMemo(() => getCalendarDays(rightCal.year, rightCal.month), [rightCal]);

  // Navigation handlers
  const prevMonth = (side) => {
    if (side === "left") {
      setLeftCal(prev => {
        const m = prev.month === 0 ? 11 : prev.month - 1;
        const y = prev.month === 0 ? prev.year - 1 : prev.year;
        return { year: y, month: m };
      });
    } else {
      setRightCal(prev => {
        const m = prev.month === 0 ? 11 : prev.month - 1;
        const y = prev.month === 0 ? prev.year - 1 : prev.year;
        return { year: y, month: m };
      });
    }
  };

  const nextMonth = (side) => {
    if (side === "left") {
      setLeftCal(prev => {
        const m = prev.month === 11 ? 0 : prev.month + 1;
        const y = prev.month === 11 ? prev.year + 1 : prev.year;
        return { year: y, month: m };
      });
    } else {
      setRightCal(prev => {
        const m = prev.month === 11 ? 0 : prev.month + 1;
        const y = prev.month === 11 ? prev.year + 1 : prev.year;
        return { year: y, month: m };
      });
    }
  };

  // Day Click Handlers
  const handleLeftDayClick = (ymd) => {
    setTempStart(ymd);
    setRangeLabel("Fixed");
    if (tempEnd && ymd > tempEnd) {
      setTempEnd(ymd);
    }
  };

  const handleRightDayClick = (ymd) => {
    setTempEnd(ymd);
    setRangeLabel("Fixed");
    if (tempStart && ymd < tempStart) {
      setTempStart(ymd);
    }
  };

  // Commit Apply
  const handleApply = () => {
    if (onStartDateChange) onStartDateChange(tempStart);
    if (onEndDateChange) onEndDateChange(tempEnd);
    setIsOpen(false);
    setShowAutoMenu(false);
    setActiveSubmenu(null);
  };

  // Cancel
  const handleCancel = () => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setIsOpen(false);
    setShowAutoMenu(false);
    setActiveSubmenu(null);
  };

  // Reset / Clear
  const handleClear = (e) => {
    e.stopPropagation();
    if (onStartDateChange) onStartDateChange("");
    if (onEndDateChange) onEndDateChange("");
    if (onClear) onClear();
    setTempStart("");
    setTempEnd("");
    setRangeLabel("Fixed");
    setIsOpen(false);
  };

  // Trigger Display Text
  const hasActiveFilter = Boolean(startDate || endDate);
  const displayText = useMemo(() => {
    if (!startDate && !endDate) return placeholder;
    if (startDate && endDate) {
      if (startDate === endDate) return formatDisplayDate(startDate);
      return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
    }
    if (startDate) return `From ${formatDisplayDate(startDate)}`;
    return `Up to ${formatDisplayDate(endDate)}`;
  }, [startDate, endDate, placeholder]);

  const [effectiveAlign, setEffectiveAlign] = useState(align || "left");

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (align === "right" || (rect.left + 640 > window.innerWidth - 20)) {
        setEffectiveAlign("right");
      } else {
        setEffectiveAlign("left");
      }
    }
  }, [isOpen, align]);

  return (
    <div style={{ position: "relative", display: "inline-block", userSelect: "none" }}>
      
      {/* TRIGGER BUTTON (Matches Screenshot 1) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "7px 14px",
          background: hasActiveFilter ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.04)",
          border: hasActiveFilter ? "1px solid rgba(56, 189, 248, 0.5)" : "1px solid var(--border-glass)",
          borderRadius: "8px",
          color: hasActiveFilter ? "var(--primary)" : "var(--text)",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer",
          minWidth: "210px",
          transition: "all 0.2s ease",
          boxShadow: hasActiveFilter ? "0 0 10px rgba(56, 189, 248, 0.15)" : "none",
          ...buttonStyle
        }}
        title="Click to select custom date range or preset"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={15} style={{ color: hasActiveFilter ? "var(--primary)" : "var(--text-muted)" }} />
          <span>{displayText}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {hasActiveFilter && (
            <span
              onClick={handleClear}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.1)",
                color: "var(--text-muted)",
                cursor: "pointer",
                transition: "background 0.15s"
              }}
              title="Clear date range"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {/* DROPDOWN POPOVER MODAL (Matches Screenshots 2, 3, 4, 5) */}
      {isOpen && <div
          ref={popoverRef}
          className="card-fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: effectiveAlign === "right" ? 0 : "auto",
            left: effectiveAlign === "right" ? "auto" : 0,
            zIndex: 9999,
            background: "#0f172a",
            color: "var(--text, #f3f4f6)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "16px",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.2)",
            padding: "24px 28px",
            minWidth: "640px",
            maxWidth: "calc(100vw - 32px)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)"
          }}
        >
          {/* Top Auto Date Range Preset Selector Bar */}
          <div style={{ marginBottom: "20px", position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowAutoMenu(prev => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 16px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "var(--text)",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                minWidth: "190px"
              }}
            >
              <span>{rangeLabel}</span>
              <ChevronDown size={15} style={{ color: "var(--text-muted)" }} />
            </button>

            {/* NESTED PRESETS MENU (Screenshots 3, 4, 5) */}
            {showAutoMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  zIndex: 10000,
                  background: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "10px",
                  boxShadow: "0 15px 35px rgba(0,0,0,0.6)",
                  padding: "6px 0",
                  minWidth: "200px",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div 
                  onClick={() => { setRangeLabel("Fixed"); setShowAutoMenu(false); }}
                  style={{ padding: "8px 14px", fontSize: "0.83rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  className="menu-item-hover"
                >
                  Fixed (Custom)
                  {rangeLabel === "Fixed" && <Check size={14} style={{ color: "var(--primary)" }} />}
                </div>

                <div 
                  onClick={() => handleSelectPreset("today")}
                  style={{ padding: "8px 14px", fontSize: "0.83rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  Today
                </div>

                <div 
                  onClick={() => handleSelectPreset("yesterday")}
                  style={{ padding: "8px 14px", fontSize: "0.83rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  Yesterday
                </div>

                {/* Submenu 1: This Month */}
                <div
                  onMouseEnter={() => setActiveSubmenu("thisMonth")}
                  onClick={() => setActiveSubmenu(activeSubmenu === "thisMonth" ? null : "thisMonth")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "0.83rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    position: "relative",
                    background: activeSubmenu === "thisMonth" ? "rgba(255, 255, 255, 0.08)" : "transparent"
                  }}
                  className="menu-item-hover"
                >
                  <span>This month</span>
                  <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />

                  {activeSubmenu === "thisMonth" && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "100%",
                        zIndex: 10001,
                        background: "var(--bg-panel, #1e293b)",
                        border: "1px solid var(--border-glass, rgba(255, 255, 255, 0.15))",
                        borderRadius: "8px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        padding: "6px 0",
                        minWidth: "240px"
                      }}
                    >
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_month"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer", fontWeight: 700 }} className="menu-item-hover">This month</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_month_td"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This month to date</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_week_sun"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This week (starts Sunday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_week_sun_td"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This week to date (starts Sunday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_week_mon"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This week (starts Monday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_week_mon_td"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This week to date (starts Monday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_quarter"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This quarter</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_quarter_td"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This quarter to date</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_year"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This year</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("this_year_td"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">This year to date</div>
                    </div>
                  )}
                </div>

                {/* Submenu 2: Last 7 Days */}
                <div
                  onMouseEnter={() => setActiveSubmenu("last7Days")}
                  onClick={() => setActiveSubmenu(activeSubmenu === "last7Days" ? null : "last7Days")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "0.83rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    position: "relative",
                    background: activeSubmenu === "last7Days" ? "rgba(255, 255, 255, 0.08)" : "transparent"
                  }}
                  className="menu-item-hover"
                >
                  <span>Last 7 days</span>
                  <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />

                  {activeSubmenu === "last7Days" && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: "100%",
                        zIndex: 10001,
                        background: "var(--bg-panel, #1e293b)",
                        border: "1px solid var(--border-glass, rgba(255, 255, 255, 0.15))",
                        borderRadius: "8px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        padding: "6px 0",
                        minWidth: "220px"
                      }}
                    >
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_7_days"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer", fontWeight: 700 }} className="menu-item-hover">Last 7 days</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_14_days"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last 14 days</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_28_days"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last 28 days</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_30_days"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last 30 days</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_week_sun"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last week (starts Sunday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_week_mon"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last week (starts Monday)</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_month"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last month</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_quarter"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last quarter</div>
                      <div onClick={(e) => { e.stopPropagation(); handleSelectPreset("last_year"); }} style={{ padding: "7px 14px", fontSize: "0.82rem", cursor: "pointer" }} className="menu-item-hover">Last year</div>
                    </div>
                  )}
                </div>

                <div 
                  onClick={() => handleSelectPreset("all")}
                  style={{ padding: "8px 14px", fontSize: "0.83rem", cursor: "pointer", borderTop: "1px solid var(--border-glass)" }}
                  className="menu-item-hover"
                >
                  All Time (Advanced)
                </div>
              </div>
            )}
          </div>

          {/* DUAL CALENDARS CONTAINER */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "36px" }}>
            
            {/* LEFT CALENDAR (Start date) */}
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "10px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Start date
              </div>

              {/* Month Navigation Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", padding: "0 4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.03em", color: "#38bdf8" }}>
                  {MONTH_NAMES[leftCal.month]} {leftCal.year}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button type="button" onClick={() => prevMonth("left")} className="cal-nav-btn" title="Previous Month">
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={() => nextMonth("left")} className="cal-nav-btn" title="Next Month">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers: M T W T F S S */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: "4px", justifyContent: "center", textAlign: "center", marginBottom: "8px" }}>
                {WEEKDAYS.map((w, i) => (
                  <span key={i} style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    {w}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: "4px", justifyContent: "center", textAlign: "center" }}>
                {leftDays.map((item, idx) => {
                  if (!item) return <div key={`blank-l-${idx}`} style={{ width: "36px", height: "36px" }}></div>;
                  
                  const isSelected = item.ymd === tempStart;
                  const isToday = item.ymd === todayYMD;
                  const inRange = tempStart && tempEnd && item.ymd >= tempStart && item.ymd <= tempEnd;

                  return (
                    <button
                      key={item.ymd}
                      type="button"
                      onClick={() => handleLeftDayClick(item.ymd)}
                      style={{
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                        fontWeight: isSelected || isToday ? 800 : 500,
                        borderRadius: isSelected ? "50%" : inRange ? "6px" : "50%",
                        background: isSelected ? "var(--primary, #38bdf8)" : inRange ? "rgba(56, 189, 248, 0.18)" : "transparent",
                        color: isSelected ? "#0f172a" : inRange ? "#38bdf8" : "var(--text)",
                        border: isToday && !isSelected ? "1px solid rgba(255, 255, 255, 0.4)" : "none",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      className="cal-day-cell"
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT CALENDAR (End date) */}
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "10px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                End date
              </div>

              {/* Month Navigation Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", padding: "0 4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.03em", color: "#38bdf8" }}>
                  {MONTH_NAMES[rightCal.month]} {rightCal.year}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button type="button" onClick={() => prevMonth("right")} className="cal-nav-btn" title="Previous Month">
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={() => nextMonth("right")} className="cal-nav-btn" title="Next Month">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekday Headers: M T W T F S S */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: "4px", justifyContent: "center", textAlign: "center", marginBottom: "8px" }}>
                {WEEKDAYS.map((w, i) => (
                  <span key={i} style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    {w}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: "4px", justifyContent: "center", textAlign: "center" }}>
                {rightDays.map((item, idx) => {
                  if (!item) return <div key={`blank-r-${idx}`} style={{ width: "36px", height: "36px" }}></div>;
                  
                  const isSelected = item.ymd === tempEnd;
                  const isToday = item.ymd === todayYMD;
                  const inRange = tempStart && tempEnd && item.ymd >= tempStart && item.ymd <= tempEnd;

                  return (
                    <button
                      key={item.ymd}
                      type="button"
                      onClick={() => handleRightDayClick(item.ymd)}
                      style={{
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                        fontWeight: isSelected || isToday ? 800 : 500,
                        borderRadius: isSelected ? "50%" : inRange ? "6px" : "50%",
                        background: isSelected ? "var(--primary, #38bdf8)" : inRange ? "rgba(56, 189, 248, 0.18)" : "transparent",
                        color: isSelected ? "#0f172a" : inRange ? "#38bdf8" : "var(--text)",
                        border: isToday && !isSelected ? "1px solid rgba(255, 255, 255, 0.4)" : "none",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      className="cal-day-cell"
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* FOOTER ACTIONS (Cancel & Apply buttons) */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "22px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
              style={{ padding: "7px 18px", fontSize: "0.86rem", fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="btn btn-primary"
              style={{ padding: "7px 22px", fontSize: "0.86rem", fontWeight: 700 }}
            >
              Apply
            </button>
          </div>

        </div>}

      <style>{`
        .menu-item-hover:hover {
          background: rgba(56, 189, 248, 0.12) !important;
          color: var(--primary) !important;
        }
        .cal-nav-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-glass);
          color: var(--text);
          border-radius: 4px;
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cal-nav-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .cal-day-cell:hover {
          background: rgba(56, 189, 248, 0.25) !important;
        }
      `}</style>
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

