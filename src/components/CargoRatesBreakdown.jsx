import React, { useState } from "react";
import { getCargoRates, getCurrencySymbol, calculateCargoTotalCartons, calculateTotalCargoPrice } from "../utils/formatters";
import { Package, Layers, ChevronDown, ChevronUp } from "lucide-react";

export default function CargoRatesBreakdown({ cargo, compact = false, collapsible = false, defaultExpanded = true, showTitle = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rates = getCargoRates(cargo);

  if (!rates || rates.length === 0) return null;
  const isMulti = rates.length > 1;
  const currency = cargo?.currency || "RMB";
  const curSymbol = getCurrencySymbol(currency);
  const totalCartons = calculateCargoTotalCartons(cargo);
  const totalPrice = calculateTotalCargoPrice(cargo);

  // Compact inline badge / pill for table cells
  if (compact) {
    if (!isMulti) {
      const single = rates[0];
      return (
        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
          {single.cartons ? `📦 ${single.cartons} Ctns` : ""} {single.uom ? `(${single.uom})` : ""}
        </span>
      );
    }

    return (
      <div style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
        <span 
          style={{ 
            fontSize: "0.72rem", 
            fontWeight: 700, 
            padding: "2px 8px", 
            borderRadius: "6px", 
            background: "rgba(168, 85, 247, 0.15)", 
            color: "#c084fc", 
            border: "1px solid rgba(168, 85, 247, 0.35)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            whiteSpace: "nowrap"
          }}
          title={rates.map((r, i) => `${r.typeName || `Type ${i+1}`}: ${r.cartons || 0} Ctns @ ${r.uom} (${curSymbol}${r.price})`).join(" | ")}
        >
          <Layers size={11} /> {rates.length} Cargo Types ({totalCartons} Ctns)
        </span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {rates.map(r => `${r.cartons ? `${r.cartons}c` : ""} ${r.uom?.replace("per ", "/") || ""}`).join(" + ")}
        </span>
      </div>
    );
  }

  // Full breakdown viewer
  return (
    <div 
      style={{ 
        background: "rgba(0, 0, 0, 0.15)", 
        border: "1px solid var(--border-glass, rgba(148, 163, 184, 0.25))", 
        borderRadius: "8px", 
        padding: "12px 14px", 
        marginTop: "12px",
        marginBottom: "12px"
      }}
    >
      {showTitle && (
        <div 
          onClick={collapsible ? () => setExpanded(prev => !prev) : undefined}
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: expanded ? "10px" : 0, 
            cursor: collapsible ? "pointer" : "default",
            userSelect: "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary, #38bdf8)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Package size={15} /> Cargo Types &amp; Rates Breakdown
            </span>
            {isMulti ? (
              <span style={{ fontSize: "0.72rem", background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                {rates.length} Types in Shipment
              </span>
            ) : (
              <span style={{ fontSize: "0.72rem", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                Single Type Rate
              </span>
            )}
            {collapsible && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {expanded ? "Hide" : "Show"}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Total: <strong style={{ color: "var(--warning, #f59e0b)" }}>📦 {totalCartons} Cartons</strong>
            {" | "}
            Total Freight: <strong style={{ color: "#10b981" }}>{curSymbol}{Number(totalPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-glass, #cbd5e1)", textAlign: "left", fontSize: "0.74rem" }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Type / Description</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Cartons</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Price Unit (UOM)</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Rate</th>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Measurement / Basis</th>
                <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Calculated Cost</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "7px 8px", fontWeight: 600, color: "var(--text-main)" }}>
                    {r.typeName || `Cargo Type #${i + 1}`}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--warning, #f59e0b)", fontWeight: 700 }}>
                    {r.cartons != null && r.cartons !== "" ? `📦 ${r.cartons} Cartons` : "—"}
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <span style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", padding: "2px 8px", borderRadius: "5px", fontSize: "0.74rem", fontWeight: 700 }}>
                      {r.uom || "per CBM"}
                    </span>
                  </td>
                  <td style={{ padding: "7px 8px", fontWeight: 600 }}>
                    {curSymbol}{r.price != null && r.price !== "" ? r.price : "—"}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--text-muted)" }}>
                    {r.rateBasis ? (
                      `${r.rateBasis} ${r.uom === "per CBM" ? "m³" : r.uom === "per Pc" ? "Pcs" : r.uom === "per KG" ? "KG" : ""}`
                    ) : (r.uom === "Flat Rate" ? "Fixed Freight" : "—")}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#10b981", fontSize: "0.85rem" }}>
                    {curSymbol}{Number(r.totalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            {rates.length > 1 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-glass, #cbd5e1)", fontWeight: 700 }}>
                  <td style={{ padding: "8px 8px", color: "var(--text-main)" }}>
                    Total ({rates.length} Cargo Types)
                  </td>
                  <td style={{ padding: "8px 8px", color: "var(--warning, #f59e0b)" }}>
                    📦 {totalCartons} Cartons
                  </td>
                  <td colSpan={3} style={{ padding: "8px 8px", color: "var(--text-muted)", fontSize: "0.74rem" }}>
                    Consolidated Multi-Type Cargo
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#10b981", fontSize: "0.92rem" }}>
                    {curSymbol}{Number(totalPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
