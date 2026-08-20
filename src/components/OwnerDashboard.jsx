import React from "react";
import { Building2, ShieldCheck } from "lucide-react";
import CapitalPipelineStudio from "./CapitalPipelineStudio";

export default function OwnerDashboard({
  currentUser = {},
  requests = [],
  cargos = [],
  vendors = [],
  users = [],
  items = [],
  cargoCompanies = [],
  settings = {},
  onUpdateSettings,
  onLogout
}) {
  return (
    <div className="card-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Top Welcome & Navigation Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px" }}>
              <Building2 size={32} style={{ color: "#38bdf8" }} /> Executive Owner Dashboard
            </h1>
            <span className="badge" style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#fff", padding: "4px 12px", fontSize: "0.8rem", borderRadius: "12px", fontWeight: 700 }}>
              <ShieldCheck size={14} style={{ display: "inline", marginRight: "4px" }} /> Executive Owner Mode
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Real-time multi-currency procurement analytics, live exchange rate conversions, vendor performance, and supply chain intelligence.
          </p>
        </div>

        {onLogout && (
          <button onClick={onLogout} className="btn btn-danger btn-sm">
            Logout
          </button>
        )}
      </div>

      {/* Purchase Report Module */}
      <CapitalPipelineStudio 
        requests={requests}
        cargos={cargos}
        vendors={vendors}
        users={users}
        settings={settings}
      />
    </div>
  );
}
