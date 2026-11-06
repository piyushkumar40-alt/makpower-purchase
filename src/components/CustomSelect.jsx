import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

/**
 * Universal CustomSelect Component
 * --------------------------------
 * Replaces native HTML <select> and browser <datalist> popups with a unified,
 * high-polish dark glassmorphic dropdown with built-in search, keyboard navigation,
 * custom icons, active checkmarks, auto-alignment, and optional portal rendering.
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
  triggerStyle = {},
  menuStyle = {},
  menuWidth = "100%",
  dropdownPlacement = "auto", // "auto" | "bottom" | "top"
  portal = false, // renders via React portal to document.body (prevents clipping in tables/modals)
  displayCustomValue = true // if value doesn't match an option value/label, still display it instead of blank placeholder
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placement, setPlacement] = useState("bottom");
  const [portalCoords, setPortalCoords] = useState({ top: 0, left: 0, width: 0, isTop: false, maxHeight: 260 });

  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Normalize options to [{ value, label, count, icon, sublabel, disabled }]
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

  // Current selected option - matches by value first, then fallback by label (case-insensitive)
  const selectedOption = useMemo(() => {
    const stringVal = value !== undefined && value !== null ? String(value) : "";
    if (!stringVal) return null;
    return (
      normalizedOptions.find(o => o.value === stringVal) ||
      normalizedOptions.find(o => o.label.toLowerCase() === stringVal.toLowerCase()) ||
      null
    );
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

  // Calculate placement and portal coordinates
  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const minNeeded = 220;

    let targetPlacement = dropdownPlacement;
    if (targetPlacement === "auto") {
      targetPlacement = spaceBelow < minNeeded && spaceAbove > spaceBelow ? "top" : "bottom";
    }
    setPlacement(targetPlacement);

    if (portal) {
      const isTop = targetPlacement === "top";
      const topPos = isTop ? rect.top - 6 : rect.bottom + 6;
      setPortalCoords({
        top: topPos,
        left: rect.left,
        width: rect.width,
        isTop,
        maxHeight: Math.min(260, Math.max(140, (isTop ? spaceAbove : spaceBelow) - 15))
      });
    }
  }, [dropdownPlacement, portal]);

  // Update placement / coordinates on resize and scroll
  useEffect(() => {
    if (!isOpen) return;
    updatePlacement();
    if (!portal) return;

    const handleUpdate = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // If container scrolled off screen, close dropdown
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
        setIsOpen(false);
        return;
      }
      updatePlacement();
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, portal, updatePlacement]);

  // Open / Close handlers
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      setIsOpen(true);
      setSearchQuery("");
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

  // Click outside listener - handles both standard & portaled menu
  useEffect(() => {
    const handlePointerDown = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inContainer && !inMenu) {
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
  const displayLabel = selectedOption 
    ? selectedOption.label 
    : (displayCustomValue && hasValue ? String(value) : placeholder);

  const menuNode = (
    <div
      ref={menuRef}
      className={`custom-select-menu ${portal ? "custom-select-portal" : ""}`}
      style={{
        position: portal ? "fixed" : "absolute",
        left: portal ? `${portalCoords.left}px` : 0,
        ...(portal
          ? {
              top: `${portalCoords.top}px`,
              transform: portalCoords.isTop ? "translateY(-100%)" : "none",
              width: menuWidth === "100%" ? `${Math.max(portalCoords.width, 160)}px` : menuWidth,
              minWidth: `${Math.max(portalCoords.width, 140)}px`
            }
          : {
              ...(placement === "top"
                ? { bottom: "calc(100% + 5px)" }
                : { top: "calc(100% + 5px)" }),
              width: menuWidth,
              minWidth: "100%"
            }),
        zIndex: 99999,
        borderRadius: "10px",
        padding: "6px",
        display: "flex",
        flexDirection: "column",
        animation: "fadeInDropdown 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        ...menuStyle
      }}
    >
      {/* Pinned Search Input if Searchable */}
      {isSearchable && (
        <div className="custom-select-search-container" style={{ padding: "4px 4px 6px 4px", marginBottom: "4px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={13} className="custom-select-search-icon" style={{ position: "absolute", left: "9px" }} />
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
              className="custom-select-search-input"
              style={{
                width: "100%",
                height: "29px",
                padding: "4px 8px 4px 28px",
                fontSize: "0.78rem",
                borderRadius: "6px",
                outline: "none"
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="custom-select-search-clear"
                style={{
                  position: "absolute",
                  right: "6px",
                  background: "transparent",
                  border: "none",
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
          maxHeight: portal ? `${portalCoords.maxHeight}px` : "240px",
          overflowY: "auto",
          scrollbarWidth: "thin"
        }}
      >
        {filteredOptions.length === 0 ? (
          <div className="custom-select-empty" style={{ padding: "12px", textAlign: "center", fontSize: "0.78rem" }}>
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
                className={`custom-select-option ${isSelected ? "selected" : ""} ${isHighlighted ? "highlighted" : ""} ${opt.disabled ? "disabled" : ""}`}
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
                      <div className="custom-select-option-sublabel" style={{ fontSize: "0.7rem", marginTop: "1px" }}>
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {opt.count !== undefined && (
                    <span 
                      className={`custom-select-option-count ${isSelected ? "selected" : ""}`}
                      style={{ 
                        fontSize: "0.7rem", 
                        padding: "1px 6px", 
                        borderRadius: "99px", 
                        fontWeight: 600 
                      }}
                    >
                      {opt.count}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={13} className="custom-select-option-check" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

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
        className={`custom-select-trigger ${isOpen ? "open" : ""} ${hasValue ? "has-value" : ""} ${disabled ? "disabled" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          width: "100%",
          height: style.height || sizeStyles.height,
          padding: sizeStyles.padding,
          fontSize: sizeStyles.fontSize,
          borderRadius: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
          outline: "none",
          ...triggerStyle
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {icon && (
            <span className="custom-select-trigger-icon" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {icon}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="custom-select-trigger-icon" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span 
            className="custom-select-value-text"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: hasValue ? 600 : 400 }}
          >
            {displayLabel}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="custom-select-trigger-badge">
              {selectedOption.count}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="custom-select-clear-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                padding: "2px",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "color 0.15s"
              }}
              title="Clear selection"
            >
              <X size={12} />
            </button>
          )}

          <ChevronDown
            size={sizeStyles.iconSize}
            className="custom-select-chevron"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease"
            }}
          />
        </div>
      </div>

      {/* Render Dropdown Menu */}
      {isOpen && (portal ? createPortal(menuNode, document.body) : menuNode)}
    </div>
  );
}
