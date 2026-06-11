import React from "react";
import { Clock, Truck, AlertCircle, Award } from "lucide-react";

export default function AnalyticsPanel({ requests, vendors, cargos }) {
  // 1. Calculations
  const pendingCount = requests.filter(r => !r.priceRmb).length;
  const awaitingCargoCount = requests.filter(r => r.priceRmb && !r.cargoId).length;
  const inTransitCount = requests.filter(r => r.cargoId && r.isMaterialRec !== "Yes").length;
  
  // Calculate delayed count for current month
  const todayStr = "2026-06-11";
  const today = new Date(todayStr);

  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    return dateStr.startsWith("2026-06");
  };

  let delayedCount = 0;

  // Price delays
  requests.forEach(r => {
    if (!r.priceRmb) {
      if (r.requiredByDate && new Date(r.requiredByDate) < today && isCurrentMonth(r.requiredByDate)) {
        delayedCount++;
      }
    }
  });

  // Cargo assignment delays
  requests.forEach(r => {
    if (r.priceRmb && !r.cargoId) {
      const delayDate = r.vendorReadyDate || r.vendorEdd;
      if (delayDate && new Date(delayDate) < today && isCurrentMonth(delayDate)) {
        delayedCount++;
      }
    }
  });

  // Cargo transit delays
  const myCargoIds = new Set(requests.map(r => r.cargoId).filter(Boolean));
  const myCargos = cargos.filter(c => myCargoIds.has(c.id));
  myCargos.forEach(c => {
    if (c.isMaterialRec !== "Yes") {
      if (c.cargoEta && new Date(c.cargoEta) < today && isCurrentMonth(c.cargoEta)) {
        delayedCount++;
      }
    }
  });

  return (
    <div className="card-fade-in" style={{ marginBottom: "30px" }}>
      
      {/* Counters Grid */}
      <div className="dashboard-grid">
        {/* Delayed of the Month */}
        <div className="glass-panel metric-card" style={{ borderLeft: `4px solid ${delayedCount > 2 ? "var(--danger)" : delayedCount === 0 ? "var(--success)" : "var(--warning)"}` }}>
          <div>
            <div className="metric-label">Delayed of the Month</div>
            <div 
              className="metric-value" 
              style={{ 
                color: delayedCount > 2 ? "var(--danger)" : delayedCount === 0 ? "var(--success)" : "var(--warning)",
                textShadow: delayedCount > 2 ? "0 0 10px var(--danger-glow)" : delayedCount === 0 ? "0 0 10px var(--success-glow)" : "0 0 10px var(--warning-glow)"
              }}
            >
              {delayedCount === 0 ? "0 (Good)" : delayedCount}
            </div>
          </div>
          <div 
            style={{ 
              padding: "10px", 
              background: delayedCount > 2 ? "var(--danger-glow)" : delayedCount === 0 ? "var(--success-glow)" : "var(--warning-glow)", 
              borderRadius: "12px", 
              color: delayedCount > 2 ? "var(--danger)" : delayedCount === 0 ? "var(--success)" : "var(--warning)" 
            }}
          >
            <Clock size={24} />
          </div>
        </div>

        {/* Pending Pricing */}
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div>
            <div className="metric-label">Step 1: Awaiting Price</div>
            <div className="metric-value" style={{ color: "var(--warning)" }}>
              {pendingCount}
            </div>
          </div>
          <div style={{ padding: "10px", background: "var(--warning-glow)", borderRadius: "12px", color: "var(--warning)" }}>
            <AlertCircle size={24} />
          </div>
        </div>

        {/* Ready to Cargo */}
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div>
            <div className="metric-label">Step 2: Awaiting Cargo</div>
            <div className="metric-value" style={{ color: "var(--primary)" }}>
              {awaitingCargoCount}
            </div>
          </div>
          <div style={{ padding: "10px", background: "var(--primary-glow)", borderRadius: "12px", color: "var(--primary)" }}>
            <Award size={24} />
          </div>
        </div>

        {/* Cargo In-Transit */}
        <div className="glass-panel metric-card" style={{ borderLeft: "4px solid var(--secondary)" }}>
          <div>
            <div className="metric-label">Step 3: Cargo In-Transit</div>
            <div className="metric-value" style={{ color: "var(--secondary)" }}>
              {inTransitCount}
            </div>
          </div>
          <div style={{ padding: "10px", background: "rgba(129, 140, 248, 0.15)", borderRadius: "12px", color: "var(--secondary)" }}>
            <Truck size={24} />
          </div>
        </div>
      </div>

    </div>
  );
}
