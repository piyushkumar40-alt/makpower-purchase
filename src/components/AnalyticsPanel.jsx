import React from "react";
import { Clock, Truck, AlertCircle, Award } from "lucide-react";

export default function AnalyticsPanel({ requests = [], vendors = [], cargos = [], onSelectTab }) {
  // 1. Dynamic Reference Date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const currentMonthPrefix = todayStr.slice(0, 7);

  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    return dateStr.startsWith(currentMonthPrefix);
  };

  // 2. Calculations: Distinguish between Orders (Lots / Cargos) and Items
  const pendingItems = requests.filter(r => !r.priceRmb && r.status !== "Cancelled");
  const awaitingCargoItems = requests.filter(r => r.priceRmb && !r.cargoId && r.status !== "Cancelled");
  const inTransitItems = requests.filter(r => r.cargoId && r.isMaterialRec !== "Yes" && r.status !== "Cancelled");

  // Unique Orders (Lots grouped by vendor + orderDate)
  const pendingLots = new Set(pendingItems.map(r => `${r.vendorId}__${r.orderDate || 'no_date'}`)).size;
  const awaitingCargoLots = new Set(awaitingCargoItems.map(r => `${r.vendorId}__${r.orderDate || 'no_date'}`)).size;

  // Active In-transit Cargos
  const myCargoIds = new Set(requests.map(r => r.cargoId).filter(Boolean));
  const myCargos = (cargos || []).filter(c => myCargoIds.has(c.id));
  const inTransitCargosCount = myCargos.filter(c => c.isMaterialRec !== "Yes").length;

  let delayedItemsCount = 0;

  // Price delays
  pendingItems.forEach(r => {
    if (r.requiredByDate && new Date(r.requiredByDate) < today && isCurrentMonth(r.requiredByDate)) {
      delayedItemsCount++;
    }
  });

  // Cargo assignment delays
  awaitingCargoItems.forEach(r => {
    const delayDate = r.vendorReadyDate || r.vendorEdd;
    if (delayDate && new Date(delayDate) < today && isCurrentMonth(delayDate)) {
      delayedItemsCount++;
    }
  });

  // Cargo transit delays
  myCargos.forEach(c => {
    if (c.isMaterialRec !== "Yes") {
      if (c.cargoEta && new Date(c.cargoEta) < today && isCurrentMonth(c.cargoEta)) {
        delayedItemsCount++;
      }
    }
  });

  // Delivery reschedules & Bad Impact calculation
  let totalEddReschedules = 0;
  let totalSlippedDays = 0;
  const vendorsWithBadImpact = new Set();
  const cargosWithBadImpact = new Set();

  requests.forEach(r => {
    const hist = Array.isArray(r.vendorEddHistory) ? r.vendorEddHistory : (typeof r.vendorEddHistory === "string" ? JSON.parse(r.vendorEddHistory || "[]") : []);
    if (hist.length > 0) {
      totalEddReschedules += hist.length;
      if (r.vendorId) vendorsWithBadImpact.add(r.vendorId);
      hist.forEach(h => {
        const slip = parseInt(h.postponedDays || 0);
        if (slip > 0) totalSlippedDays += slip;
      });
    }
  });

  cargos.forEach(c => {
    const hist = Array.isArray(c.cargoEtaHistory) ? c.cargoEtaHistory : (typeof c.cargoEtaHistory === "string" ? JSON.parse(c.cargoEtaHistory || "[]") : []);
    if (hist.length > 0) {
      totalEddReschedules += hist.length;
      if (c.cargoCompanyId) cargosWithBadImpact.add(c.cargoCompanyId);
      hist.forEach(h => {
        const slip = parseInt(h.postponedDays || 0);
        if (slip > 0) totalSlippedDays += slip;
      });
    }
  });

  return (
    <div className="card-fade-in" style={{ marginBottom: "24px" }}>
      
      {/* Counters Grid */}
      <div className="dashboard-grid">
        
        {/* 1. Delayed of the Month */}
        <div 
          onClick={() => onSelectTab && onSelectTab("alerts")} 
          className="metric-card glow-cyan-card" 
          style={{ 
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          title="Click to navigate to Delayed Operations & Action Alerts tab"
        >
          <div>
            <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700 }}>
              Delayed Items (Month)
            </div>
            <div 
              className="metric-value" 
              style={{ 
                color: "#38bdf8",
                fontSize: "1.4rem",
                fontWeight: 800
              }}
            >
              {delayedItemsCount === 0 ? "0 (Good)" : `${delayedItemsCount} Items`}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Target timeline missed
            </div>
          </div>
          <div 
            style={{ 
              padding: "10px", 
              background: "rgba(56, 189, 248, 0.15)", 
              borderRadius: "12px", 
              color: "#38bdf8" 
            }}
          >
            <Clock size={24} />
          </div>
        </div>

        {/* 2. Pending Pricing (Step 1) */}
        <div 
          onClick={() => onSelectTab && onSelectTab("pending")} 
          className="metric-card glow-purple-card" 
          style={{ cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          title="Click to navigate to Step 1: Awaiting Price tab"
        >
          <div>
            <div className="metric-label" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700 }}>Step 1: Awaiting Price</div>
            <div className="metric-value" style={{ color: "#a855f7", fontSize: "1.4rem", fontWeight: 800 }}>
              {pendingLots} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Orders (Lots)</span>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {pendingItems.length} Items awaiting quote
            </div>
          </div>
          <div style={{ padding: "10px", background: "rgba(168, 85, 247, 0.15)", borderRadius: "12px", color: "#a855f7" }}>
            <AlertCircle size={24} />
          </div>
        </div>

        {/* 3. Ready to Cargo (Step 2) */}
        <div 
          onClick={() => onSelectTab && onSelectTab("planner")} 
          className="metric-card glow-blue-card" 
          style={{ cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          title="Click to navigate to Step 2: Awaiting Cargo Consolidation tab"
        >
          <div>
            <div className="metric-label" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700 }}>Step 2: Awaiting Cargo</div>
            <div className="metric-value" style={{ color: "#3b82f6", fontSize: "1.4rem", fontWeight: 800 }}>
              {awaitingCargoLots} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Orders (Lots)</span>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {awaitingCargoItems.length} Items ready for cargo
            </div>
          </div>
          <div style={{ padding: "10px", background: "rgba(59, 130, 246, 0.15)", borderRadius: "12px", color: "#3b82f6" }}>
            <Award size={24} />
          </div>
        </div>

        {/* 4. Cargo In-Transit (Step 3) */}
        <div 
          onClick={() => onSelectTab && onSelectTab("shipments")} 
          className="metric-card glow-teal-card" 
          style={{ cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          title="Click to navigate to Step 3: Cargo In-Transit tab"
        >
          <div>
            <div className="metric-label" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 700 }}>Step 3: Cargo In-Transit</div>
            <div className="metric-value" style={{ color: "#06b6d4", fontSize: "1.4rem", fontWeight: 800 }}>
              {inTransitCargosCount} <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Cargos</span>
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {inTransitItems.length} Items in transit
            </div>
          </div>
          <div style={{ padding: "10px", background: "rgba(6, 182, 212, 0.15)", borderRadius: "12px", color: "#06b6d4" }}>
            <Truck size={24} />
          </div>
        </div>

      </div>

      {/* Slippage & Bad Impact Alert Strip */}
      {totalEddReschedules > 0 && (
        <div style={{
          marginTop: "16px",
          padding: "12px 18px",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "0.85rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fbbf24", fontWeight: 600 }}>
            <Clock size={18} />
            <span>
              <strong>Delivery Timeline Slippage Log:</strong> {totalEddReschedules} delivery reschedules logged across {vendorsWithBadImpact.size} vendor(s) and {cargosWithBadImpact.size} carrier(s) resulting in <strong>+{totalSlippedDays} cumulative days postponed</strong>.
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              type="button"
              onClick={() => onSelectTab && onSelectTab("vendors")} 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 10px", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" }}
            >
              Vendor Bad Impact →
            </button>
            <button 
              type="button"
              onClick={() => onSelectTab && onSelectTab("cargocompanies")} 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 10px", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" }}
            >
              Carrier Bad Impact →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
