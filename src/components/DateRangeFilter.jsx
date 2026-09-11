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
  align = "left", // "left" | "right"
  firstAvailableDate = ""
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

    // Immediately commit the preset and close modal on single click
    if (onStartDateChange) onStartDateChange(startYMD);
    if (onEndDateChange) onEndDateChange(endYMD);
    setIsOpen(false);
  };

  const handleSelectPreset = (key) => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();
    const curDay = now.getDay(); // 0 is Sunday, 1 is Monday

    switch (key) {
      case "closing_as_of": {
        const end = tempEnd || formatYMD(now);
        applyPreset(`Closing Stock (as of ${formatDisplayDate(end)})`, firstAvailableDate || end, end);
        break;
      }
      case "closing_today": {
        const d = formatYMD(now);
        applyPreset(`Closing Stock (as of ${formatDisplayDate(d)})`, firstAvailableDate || d, d);
        break;
      }
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
    setRangeLabel(`Closing Stock (${formatDisplayDate(ymd)})`);
    if (!tempStart && firstAvailableDate) {
      setTempStart(firstAvailableDate);
    } else if (tempStart && ymd < tempStart) {
      setTempStart(firstAvailableDate || ymd);
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

  const [popoverPos, setPopoverPos] = useState({
    top: "calc(100% + 8px)",
    bottom: "auto",
    left: "0px",
    right: "auto",
    maxHeight: "88vh"
  });

  const autoMenuBtnRef = useRef(null);
  const autoMenuRef = useRef(null);
  const [autoMenuPos, setAutoMenuPos] = useState({
    top: "calc(100% + 6px)",
    bottom: "auto",
    maxHeight: "320px"
  });

  // Calculate Popover Position & Viewport Collision Handling
  const updatePopoverPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const padding = 12;

    // Constrain width to screen
    const popoverWidth = Math.min(640, screenWidth - padding * 2);

    // Calculate vertical space above and below
    const spaceBelow = screenHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    let vPos = {};
    let calculatedMaxHeight = "88vh";

    // If space below is constrained (<420px) and space above offers more room, flip UPWARDS
    if (spaceBelow < 420 && spaceAbove > spaceBelow) {
      vPos = { bottom: "calc(100% + 8px)", top: "auto" };
      calculatedMaxHeight = `${Math.max(260, Math.min(spaceAbove, screenHeight - padding * 2))}px`;
    } else {
      vPos = { top: "calc(100% + 8px)", bottom: "auto" };
      calculatedMaxHeight = `${Math.max(260, Math.min(spaceBelow, screenHeight - padding * 2))}px`;
    }

    // Horizontal clamping within viewport
    const idealLeftInViewport = Math.max(padding, Math.min(rect.left, screenWidth - popoverWidth - padding));
    const relativeLeft = idealLeftInViewport - rect.left;

    setPopoverPos({
      ...vPos,
      left: `${relativeLeft}px`,
      right: "auto",
      maxHeight: calculatedMaxHeight
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePopoverPos();
      window.addEventListener("resize", updatePopoverPos, { passive: true });
      window.addEventListener("scroll", updatePopoverPos, { passive: true });
      return () => {
        window.removeEventListener("resize", updatePopoverPos);
        window.removeEventListener("scroll", updatePopoverPos);
      };
    }
  }, [isOpen]);

  // Calculate Preset Dropdown Position inside popover
  const updateAutoMenuPos = () => {
    if (!autoMenuBtnRef.current || !popoverRef.current) return;
    const btnRect = autoMenuBtnRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    
    const spaceBelow = popoverRect.bottom - btnRect.bottom - 16;
    const spaceAbove = btnRect.top - popoverRect.top - 16;

    if (spaceBelow < 250 && spaceAbove > spaceBelow) {
      setAutoMenuPos({
        bottom: "calc(100% + 6px)",
        top: "auto",
        maxHeight: `${Math.max(160, spaceAbove)}px`
      });
    } else {
      setAutoMenuPos({
        top: "calc(100% + 6px)",
        bottom: "auto",
        maxHeight: `${Math.max(160, spaceBelow)}px`
      });
    }
  };

  useEffect(() => {
    if (showAutoMenu) {
      updateAutoMenuPos();
    }
  }, [showAutoMenu]);

  // Keep rangeLabel accurate to current dates
  useEffect(() => {
    if (!startDate && !endDate) {
      setRangeLabel("Fixed / Custom");
      return;
    }
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const sMonth = formatYMD(new Date(curYear, curMonth, 1));
    const eMonth = formatYMD(new Date(curYear, curMonth + 1, 0));
    const todayStr = formatYMD(now);

    if (startDate === sMonth && endDate === eMonth) {
      setRangeLabel("This month");
    } else if (startDate === sMonth && endDate === todayStr) {
      setRangeLabel("This month to date");
    } else if (startDate === formatYMD(new Date(curYear, curMonth - 1, 1)) && endDate === formatYMD(new Date(curYear, curMonth, 0))) {
      setRangeLabel("Last month");
    } else if (startDate === formatYMD(new Date(now.getTime() - 7 * 86400000)) && endDate === todayStr) {
      setRangeLabel("Last 7 days");
    } else if (firstAvailableDate && startDate === firstAvailableDate) {
      setRangeLabel(`Closing Stock (${formatDisplayDate(endDate || todayStr)})`);
    }
  }, [startDate, endDate, firstAvailableDate]);

  return (
    <div style={{ position: "relative", display: "inline-block", userSelect: "none" }}>
      
      {/* TRIGGER BUTTON (Matches Pill Format with bold border) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="form-control"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          background: (startDate || endDate) ? "rgba(56, 189, 248, 0.12)" : "var(--bg-input, rgba(15, 23, 42, 0.6))",
          border: isOpen ? "2px solid #38bdf8" : (startDate || endDate) ? "2px solid #38bdf8" : "1.5px solid var(--border-glass, rgba(255, 255, 255, 0.2))",
          borderRadius: "10px",
          padding: "6px 12px",
          color: (startDate || endDate) ? "#38bdf8" : "var(--text-main, var(--text-muted))",
          fontSize: "0.82rem",
          fontWeight: 700,
          height: "36px",
          transition: "all 0.2s",
          boxShadow: isOpen ? "0 0 12px rgba(56, 189, 248, 0.3)" : (startDate || endDate) ? "0 0 8px rgba(56, 189, 248, 0.15)" : "none",
          ...buttonStyle
        }}
      >
        <Calendar size={14} style={{ color: (startDate || endDate) ? "#38bdf8" : "var(--text-muted)" }} />
        
        <span style={{ letterSpacing: "0.2px" }}>
          {displayText}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
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
                background: "rgba(255, 255, 255, 0.15)",
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

      {/* DROPDOWN POPOVER MODAL (Smart dynamic location & bounds) */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="card-fade-in"
          style={{
            position: "absolute",
            top: popoverPos.top,
            bottom: popoverPos.bottom,
            right: popoverPos.right,
            left: popoverPos.left,
            zIndex: 9999,
            background: "var(--bg-panel, var(--bg-card, #0f172a))",
            color: "var(--text-main, var(--text, #f3f4f6))",
            border: "2px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "16px",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.2)",
            padding: "18px 20px",
            minWidth: "min(640px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 20px)",
            maxHeight: popoverPos.maxHeight || "88vh",
            overflowY: "auto",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)"
          }}
        >
          {/* Top Quick Preset Bar & Selector with BOLD BORDER */}
          <div style={{ marginBottom: "16px", position: "relative" }}>
            
            {/* Primary Preset Selector Button with 2px solid border */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <button
                ref={autoMenuBtnRef}
                type="button"
                onClick={() => setShowAutoMenu(prev => !prev)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 14px",
                  borderRadius: "10px",
                  border: "2px solid #38bdf8", // BOLD, HIGH-CONTRAST BORDER LINE
                  background: "var(--bg-card-hover, rgba(56, 189, 248, 0.08))",
                  color: "var(--text-main, #38bdf8)",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(56, 189, 248, 0.2)",
                  transition: "all 0.15s"
                }}
                title="Click to choose from all date range presets"
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px", color: rangeLabel?.includes("month") ? "#38bdf8" : "inherit" }}>
                  <span>📅</span>
                  <span>{rangeLabel || "This month"}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Presets
                  </span>
                  <ChevronDown size={16} style={{ transform: showAutoMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </div>
              </button>
            </div>

            {/* Quick 1-Click Shortcut Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {/* This Month with prominent 2px solid border */}
              <button
                type="button"
                onClick={() => handleSelectPreset("this_month")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "2px solid #38bdf8", // BOLD CRISP BORDER LINE
                  background: rangeLabel === "This month" ? "rgba(56, 189, 248, 0.22)" : "rgba(56, 189, 248, 0.08)",
                  color: "#38bdf8",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  boxShadow: rangeLabel === "This month" ? "0 0 8px rgba(56, 189, 248, 0.3)" : "none"
                }}
              >
                📅 This Month
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset("this_month_td")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: rangeLabel === "This month to date" ? "2px solid #38bdf8" : "1.5px solid var(--border-glass, rgba(255, 255, 255, 0.18))",
                  background: rangeLabel === "This month to date" ? "rgba(56, 189, 248, 0.2)" : "var(--bg-card-hover, rgba(255, 255, 255, 0.06))",
                  color: rangeLabel === "This month to date" ? "#38bdf8" : "var(--text-main, var(--text))",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                This Month TD
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset("last_month")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: rangeLabel === "Last month" ? "2px solid #38bdf8" : "1.5px solid var(--border-glass, rgba(255, 255, 255, 0.18))",
                  background: rangeLabel === "Last month" ? "rgba(56, 189, 248, 0.2)" : "var(--bg-card-hover, rgba(255, 255, 255, 0.06))",
                  color: rangeLabel === "Last month" ? "#38bdf8" : "var(--text-main, var(--text))",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Last Month
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset("last_7_days")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: rangeLabel === "Last 7 days" ? "2px solid #38bdf8" : "1.5px solid var(--border-glass, rgba(255, 255, 255, 0.18))",
                  background: rangeLabel === "Last 7 days" ? "rgba(56, 189, 248, 0.2)" : "var(--bg-card-hover, rgba(255, 255, 255, 0.06))",
                  color: rangeLabel === "Last 7 days" ? "#38bdf8" : "var(--text-main, var(--text))",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Last 7 Days
              </button>

              {firstAvailableDate && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset("closing_as_of")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: rangeLabel?.startsWith("Closing") ? "2px solid #38bdf8" : "1.5px solid rgba(56, 189, 248, 0.35)",
                    background: rangeLabel?.startsWith("Closing") ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  ⭐ Closing Stock
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectPreset("all")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: rangeLabel === "All Time" ? "2px solid #38bdf8" : "1.5px solid var(--border-glass, rgba(255, 255, 255, 0.18))",
                  background: rangeLabel === "All Time" ? "rgba(56, 189, 248, 0.2)" : "var(--bg-card-hover, rgba(255, 255, 255, 0.06))",
                  color: rangeLabel === "All Time" ? "#38bdf8" : "var(--text-main, var(--text))",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                All Time
              </button>
            </div>

            {/* SMART PRESETS DROPDOWN (Categorized, flat, 100% inside container, no right flyouts) */}
            {showAutoMenu && (
              <div
                ref={autoMenuRef}
                style={{
                  position: "absolute",
                  top: autoMenuPos.top,
                  bottom: autoMenuPos.bottom,
                  left: 0,
                  right: 0,
                  zIndex: 10000,
                  background: "var(--bg-panel, var(--bg-card, #1e293b))",
                  border: "2px solid #38bdf8",
                  borderRadius: "12px",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.65), 0 0 1px rgba(255, 255, 255, 0.2)",
                  padding: "8px 0",
                  maxHeight: autoMenuPos.maxHeight || "320px",
                  overflowY: "auto",
                  backdropFilter: "blur(20px)"
                }}
              >
                {/* SECTION: Current Periods */}
                <div style={{ padding: "4px 14px 2px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Current Periods
                </div>
                <div 
                  onClick={() => handleSelectPreset("this_month")}
                  style={{
                    padding: "8px 14px",
                    margin: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "#38bdf8",
                    border: "1.5px solid #38bdf8", // BOLD BORDER IN DROPDOWN FOR THIS MONTH
                    background: "rgba(56, 189, 248, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                  className="menu-item-hover"
                >
                  <span>📅 This month (Full current month)</span>
                  {rangeLabel === "This month" && <Check size={14} color="#38bdf8" />}
                </div>

                <div 
                  onClick={() => handleSelectPreset("this_month_td")}
                  style={{
                    padding: "7px 14px",
                    margin: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "0.83rem",
                    cursor: "pointer",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                  className="menu-item-hover"
                >
                  <span>📅 This month to date (1st to today)</span>
                  {rangeLabel === "This month to date" && <Check size={14} color="#38bdf8" />}
                </div>

                <div 
                  onClick={() => handleSelectPreset("this_week_mon")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  This week (Mon – Sun)
                </div>

                <div 
                  onClick={() => handleSelectPreset("this_week_mon_td")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  This week to date (Mon to today)
                </div>

                {/* SECTION: Previous Periods */}
                <div style={{ padding: "8px 14px 2px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", borderTop: "1px solid var(--border-glass, rgba(255,255,255,0.1))", marginTop: "6px" }}>
                  Previous Periods
                </div>

                <div 
                  onClick={() => handleSelectPreset("last_month")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.83rem", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  className="menu-item-hover"
                >
                  <span>🕒 Last month</span>
                  {rangeLabel === "Last month" && <Check size={14} color="#38bdf8" />}
                </div>

                <div 
                  onClick={() => handleSelectPreset("last_7_days")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  className="menu-item-hover"
                >
                  <span>🕒 Last 7 days</span>
                  {rangeLabel === "Last 7 days" && <Check size={14} color="#38bdf8" />}
                </div>

                <div 
                  onClick={() => handleSelectPreset("last_14_days")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  🕒 Last 14 days
                </div>

                <div 
                  onClick={() => handleSelectPreset("last_30_days")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  🕒 Last 30 days
                </div>

                <div 
                  onClick={() => handleSelectPreset("yesterday")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  🕒 Yesterday
                </div>

                <div 
                  onClick={() => handleSelectPreset("today")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  🕒 Today
                </div>

                {/* SECTION: Closing Stock & Full History */}
                <div style={{ padding: "8px 14px 2px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", borderTop: "1px solid var(--border-glass, rgba(255,255,255,0.1))", marginTop: "6px" }}>
                  Closing Stock & All-Time
                </div>

                {firstAvailableDate && (
                  <div 
                    onClick={() => handleSelectPreset("closing_as_of")}
                    style={{ padding: "8px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.83rem", cursor: "pointer", fontWeight: 700, color: "#38bdf8" }}
                    className="menu-item-hover"
                  >
                    ⭐ Closing Stock (From 1st Day: {formatDisplayDate(firstAvailableDate)})
                  </div>
                )}

                <div 
                  onClick={() => handleSelectPreset("this_year")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  📅 This year
                </div>

                <div 
                  onClick={() => handleSelectPreset("last_year")}
                  style={{ padding: "7px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer" }}
                  className="menu-item-hover"
                >
                  📅 Last year
                </div>

                <div 
                  onClick={() => handleSelectPreset("all")}
                  style={{ padding: "8px 14px", margin: "2px 8px", borderRadius: "6px", fontSize: "0.83rem", cursor: "pointer", fontWeight: 700, borderTop: "1px solid var(--border-glass, rgba(255, 255, 255, 0.15))" }}
                  className="menu-item-hover"
                >
                  🌐 All Time (Full History)
                </div>
              </div>
            )}
          </div>

          {/* DUAL CALENDARS CONTAINER */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            
            {/* LEFT CALENDAR (Start date) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Start date
                </div>
                {firstAvailableDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempStart(firstAvailableDate);
                      const ts = parseDateTimestamp(firstAvailableDate);
                      if (ts) {
                        const d = new Date(ts);
                        setLeftCal({ year: d.getFullYear(), month: d.getMonth() });
                      }
                    }}
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      border: tempStart === firstAvailableDate ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
                      background: tempStart === firstAvailableDate ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
                      color: tempStart === firstAvailableDate ? "#38bdf8" : "var(--text-muted)",
                      cursor: "pointer",
                      fontWeight: 700,
                      transition: "all 0.15s"
                    }}
                    title={`Click to set Start Date to earliest stock record (${firstAvailableDate})`}
                  >
                    {tempStart === firstAvailableDate ? "✓ 1st Stock Day" : `Use 1st Day (${formatDisplayDate(firstAvailableDate)})`}
                  </button>
                )}
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

        </div>
      )}

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

