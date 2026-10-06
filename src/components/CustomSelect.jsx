import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

/**
 * Universal CustomSelect Component
 * --------------------------------
 * Replaces native HTML <select> and browser <datalist> popups with a unified,
 * high-polish dark glassmorphic dropdown with built-in search, keyboard navigation,
 * custom icons, active checkmarks, and auto-alignment.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select an option...",
  searchable = undefined, // auto true if >= 6 options
  clearable = false,
  disabled = false,
  size = "md", // "sm" | "md" | "lg"
  icon = null,
  label = null,
  className = "",
  style = {},
  menuStyle = {},
  menuWidth = "100%",
  dropdownPlacement = "auto" // "auto" | "bottom" | "top"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placement, setPlacement] = useState("bottom");

  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Normalize options to [{ value, label, count, icon, sublabel }]
  const normalizedOptions = useMemo(() => {
    return (options || []).map(opt => {
      if (opt === null || opt === undefined) return { value: "", label: "" };
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: String(opt), label: String(opt) };
      }
      return {
        value: opt.value !== undefined ? String(opt.value) : (opt.id !== undefined ? String(opt.id) : ""),
        label: opt.label !== undefined ? String(opt.label) : (opt.name !== undefined ? String(opt.name) : String(opt.value || "")),
        count: opt.count,
        icon: opt.icon,
        sublabel: opt.sublabel,
        disabled: opt.disabled
      };
    });
  }, [options]);

  // Current selected option
  const selectedOption = useMemo(() => {
    const stringVal = value !== undefined && value !== null ? String(value) : "";
    return normalizedOptions.find(o => o.value === stringVal) || null;
  }, [normalizedOptions, value]);

  // Should show search input?
  const isSearchable = useMemo(() => {
    if (searchable !== undefined) return searchable;
    return normalizedOptions.length >= 6;
  }, [searchable, normalizedOptions.length]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  // Calculate placement (flip to top if near viewport bottom)
  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return;
    if (dropdownPlacement !== "auto") {
      setPlacement(dropdownPlacement);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const minNeeded = 240;

    if (spaceBelow < minNeeded && spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, [dropdownPlacement]);

  // Open / Close handlers
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      setIsOpen(true);
      setSearchQuery("");
      // Reset highlight to current selected index
      const selIdx = filteredOptions.findIndex(o => o.value === String(value));
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);
    } else {
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  };

  // Focus search input when menu opens
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  // Click outside listener
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
    }
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && optionsListRef.current && highlightedIndex >= 0) {
      const optionElements = optionsListRef.current.querySelectorAll("[data-option-index]");
      const targetElement = optionElements[highlightedIndex];
      if (targetElement) {
        targetElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const target = filteredOptions[highlightedIndex];
          if (!target.disabled) {
            onChange && onChange(target.value, target);
            handleClose();
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "Tab":
        handleClose();
        break;
      default:
        break;
    }
  };

  const handleSelectOption = (opt) => {
    if (opt.disabled) return;
    onChange && onChange(opt.value, opt);
    handleClose();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange && onChange("", null);
  };

  // Dimensions based on size
  const sizeStyles = useMemo(() => {
    switch (size) {
      case "sm":
        return { height: "30px", fontSize: "0.78rem", padding: "4px 8px", iconSize: 13 };
      case "lg":
        return { height: "42px", fontSize: "0.92rem", padding: "8px 14px", iconSize: 16 };
      case "md":
      default:
        return { height: "34px", fontSize: "0.82rem", padding: "6px 10px", iconSize: 14 };
    }
  }, [size]);

  const hasValue = value !== undefined && value !== null && String(value) !== "" && String(value) !== "all";

  return (
    <div 
      ref={containerRef}
      className={`custom-select-wrapper ${className}`}
      style={{ position: "relative", width: "100%", ...style }}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="form-label" style={{ fontSize: "0.76rem", marginBottom: "4px", display: "block" }}>
          {label}
        </label>
      )}

      {/* Trigger Box */}
      <div
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        className={`custom-select-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          width: "100%",
          height: sizeStyles.height,
          padding: sizeStyles.padding,
          fontSize: sizeStyles.fontSize,
          borderRadius: "8px",
          background: isOpen ? "#0f172a" : "rgba(11, 17, 32, 0.85)",
          color: selectedOption ? "var(--text-main, #f8fafc)" : "var(--text-muted, #94a3b8)",
          border: isOpen ? "1px solid #38bdf8" : (hasValue ? "1px solid rgba(56, 189, 248, 0.35)" : "1px solid rgba(255, 255, 255, 0.12)"),
          boxShadow: isOpen ? "0 0 0 3px rgba(56, 189, 248, 0.18)" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
          outline: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {icon && (
            <span style={{ display: "inline-flex", alignItems: "center", color: hasValue ? "#38bdf8" : "var(--text-muted, #94a3b8)", flexShrink: 0 }}>
              {icon}
            </span>
          )}
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: hasValue ? 600 : 400, color: selectedOption ? "#f8fafc" : "#94a3b8" }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.count !== undefined && (
            <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "99px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 700, flexShrink: 0 }}>
              {selectedOption.count}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                padding: "2px",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "color 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted, #94a3b8)"}
              title="Clear selection"
            >
              <X size={12} />
            </button>
          )}

          <ChevronDown
            size={sizeStyles.iconSize}
            style={{
              color: isOpen ? "#38bdf8" : "var(--text-muted, #94a3b8)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease"
            }}
          />
        </div>
      </div>

      {/* Beautiful Dark Glassmorphic Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="custom-select-menu"
          style={{
            position: "absolute",
            left: 0,
            ...(placement === "top"
              ? { bottom: "calc(100% + 5px)" }
              : { top: "calc(100% + 5px)" }),
            width: menuWidth,
            minWidth: "100%",
            zIndex: 9999,
            background: "#080c16",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(56, 189, 248, 0.28)",
            borderRadius: "10px",
            boxShadow: "0 18px 40px -6px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            animation: "fadeInDropdown 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
            ...menuStyle
          }}
        >
          {/* Pinned Search Input if Searchable */}
          {isSearchable && (
            <div style={{ padding: "4px 4px 6px 4px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "4px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} style={{ position: "absolute", left: "9px", color: "var(--text-muted, #64748b)" }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type to filter..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: "100%",
                    height: "29px",
                    padding: "4px 8px 4px 28px",
                    fontSize: "0.78rem",
                    color: "#f8fafc",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    outline: "none"
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#38bdf8"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "6px",
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex"
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Option Items */}
          <div
            ref={optionsListRef}
            className="custom-select-options"
            style={{
              maxHeight: "240px",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(56, 189, 248, 0.3) transparent"
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: "#64748b", fontSize: "0.78rem" }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedOption?.value === opt.value;
                const isHighlighted = highlightedIndex === idx;

                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    data-option-index={idx}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "7px 10px",
                      margin: "1px 2px",
                      borderRadius: "6px",
                      fontSize: sizeStyles.fontSize,
                      cursor: opt.disabled ? "not-allowed" : "pointer",
                      opacity: opt.disabled ? 0.45 : 1,
                      background: isSelected 
                        ? "rgba(56, 189, 248, 0.18)" 
                        : (isHighlighted ? "rgba(255, 255, 255, 0.07)" : "transparent"),
                      color: isSelected 
                        ? "#38bdf8" 
                        : (isHighlighted ? "#ffffff" : "#e2e8f0"),
                      fontWeight: isSelected ? 600 : 400,
                      transition: "background 0.12s ease, color 0.12s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opt.icon && (
                        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                          {opt.icon}
                        </span>
                      )}
                      <div>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opt.label}
                        </div>
                        {opt.sublabel && (
                          <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "1px" }}>
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {opt.count !== undefined && (
                        <span 
                          style={{ 
                            fontSize: "0.7rem", 
                            padding: "1px 6px", 
                            borderRadius: "99px", 
                            background: isSelected ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.07)", 
                            color: isSelected ? "#38bdf8" : "#94a3b8", 
                            fontWeight: 600 
                          }}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={13} style={{ color: "#38bdf8" }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
