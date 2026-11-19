import React from "react";
import RahulDashboard from "./RahulDashboard";

/**
 * NitinDashboard
 * 
 * Provides Nitin (Packing Team) with identical 360° vendor, cargo, order lifecycle,
 * and document visibility as Rahul Accounts, but specialized for marking and archiving
 * packing orders purchased (packingOrderedByNitin).
 */
export default function NitinDashboard(props) {
  return <RahulDashboard {...props} dashboardMode="nitin" />;
}
