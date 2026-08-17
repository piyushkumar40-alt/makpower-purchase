export const initialUsers = [
  {
    id: "u-admin",
    name: "Super Admin",
    email: "admin@makpowerindia.com",
    password: "MakPower#Admin2026!",
    role: "superadmin",
    designation: "System Admin",
    status: "active"
  },
  {
    id: "u-owner",
    name: "Company Owner",
    email: "owner@makpowerindia.com",
    password: "MakPower#Owner2026!",
    role: "owner",
    designation: "Owner",
    status: "active"
  },
  {
    id: "u-anees",
    name: "Anees",
    email: "anees@makpowerindia.com",
    password: "MakPower#Anees2026!",
    role: "purchaser",
    designation: "Purchaser",
    status: "active"
  },
  {
    id: "u-nitin",
    name: "Nitin Kumar",
    email: "nitin@makpowerindia.com",
    password: "MakPower#Nitin2026!",
    role: "purchaser",
    designation: "Packing",
    status: "active"
  },
  {
    id: "u-rahul",
    name: "Rahul",
    email: "rahul@makpowerindia.com",
    password: "MakPower#Rahul2026!",
    role: "purchaser",
    designation: "Accounts and Updates",
    status: "active"
  },
  {
    id: "u-coordinator",
    name: "Logistics PC",
    email: "pc@makpowerindia.com",
    password: "MakPower#Coord2026!",
    role: "coordinator",
    designation: "Logistics",
    status: "active"
  }
];

export const initialDesignations = [
  { id: "d-owner", title: "Owner", role: "owner", description: "Company Executive / Owner Dashboard Access" },
  { id: "d-accounts-updates", title: "Accounts and Updates", role: "purchaser", description: "Accounts & Financial Order Updates" },
  { id: "d-purchaser", title: "Purchaser", role: "purchaser", description: "Purchase Requisitions & Vendor Management" },
  { id: "d-packing", title: "Packing", role: "purchaser", description: "Packing & Production Purchasing" },
  { id: "d-accounts", title: "Accounts", role: "purchaser", description: "Payment & Accounts Reconciliation" },
  { id: "d-warehouse", title: "Warehouse", role: "purchaser", description: "Inventory & Stock Receiving" },
  { id: "d-logistics", title: "Logistics", role: "coordinator", description: "Cargo & Shipment Dispatch Management" },
  { id: "d-admin", title: "System Admin", role: "superadmin", description: "Full System Administration" }
];

export const initialVendors = [];
export const initialRequests = [];
export const initialCargoShipments = [];
export const initialCargoCompanies = [];
export const initialItems = [];
