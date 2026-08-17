export const initialUsers = [
  {
    id: "u-admin",
    name: "Super Admin",
    email: "admin@company.com",
    password: "112233",
    role: "superadmin",
    status: "active"
  },
  {
    id: "u-anees",
    name: "Anees",
    email: "anees@company.com",
    password: "MakPower#Anees2026!",
    role: "purchaser",
    status: "active"
  },
  {
    id: "u-john",
    name: "John",
    email: "john@company.com",
    password: "MakPower#John2026!",
    role: "purchaser",
    status: "active"
  },
  {
    id: "u-sarah",
    name: "Sarah",
    email: "sarah@company.com",
    password: "MakPower#Sarah2026!",
    role: "purchaser",
    status: "active"
  },
  {
    id: "u-nitin",
    name: "Nitin Kumar",
    email: "nitin@company.com",
    password: "MakPower#Nitin2026!",
    role: "nitin",
    status: "active"
  },
  {
    id: "u-rahul",
    name: "Rahul Dev",
    email: "rahul@company.com",
    password: "MakPower#Rahul2026!",
    role: "rahul",
    status: "active"
  },
  {
    id: "u-coordinator",
    name: "Priya Sharma",
    email: "coordinator@company.com",
    password: "MakPower#Coord2026!",
    role: "coordinator",
    status: "active"
  }
];

export const initialVendors = [
  { id: "v-1", name: "Shenzhen Micro-Electronics Ltd", location: "Shenzhen High-Tech Park, Nanshan, CN", phone: "+86 755 2699 1111", history: "Initial partner for electronics boards. High yield rates.", status: "Active", purchaserIds: ["u-anees"] },
  { id: "v-2", name: "Ningbo Precision Hardware Corp", location: "Ningbo Free Trade Zone, Zhejiang, CN", phone: "+86 574 8688 2222", history: "Reliable thread manufacturing. Some steel price fluctuations.", status: "Active", purchaserIds: ["u-john"] },
  { id: "v-3", name: "Guangzhou Industrial Spares Co", location: "Guangzhou Economic Dev Zone, Guangdong, CN", phone: "+86 20 3200 3333", history: "Good for general mechanical spares and PLC components.", status: "Active", purchaserIds: ["u-sarah"] },
  { id: "v-4", name: "Dongguan Polymer Moldings", location: "Dongguan Industrial Estate, Guangdong, CN", phone: "+86 769 8500 4444", history: "Specialized in customized plastic covers and enclosures.", status: "Active", purchaserIds: ["u-anees"] },
  { id: "v-5", name: "Local Packaging Solutions", location: "Okhla Industrial Area, Phase-III, New Delhi, IN", phone: "+91 11 4160 5555", history: "Local packaging material and casing provider.", status: "Active", purchaserIds: ["u-john", "u-anees"] }
];

// High quality product photo URLs stored on Cloudinary / CDN
const sensorSvg = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80";
const boltSvg = "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=300&auto=format&fit=crop&q=80";
const plcSvg = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=80";

export const initialRequests = [
  // 1. Pending Purchaser Details (Step 1 Completed, Step 2 Pending)
  {
    id: "req-1",
    purchaserId: "u-anees",
    vendorId: "v-1",
    orderDate: "2026-06-10",
    type: "Import",
    model: "XM-900 Ultrasonic Transducer",
    orderQuantity: 80,
    priceRmb: "",
    totalRmb: "",
    advancePayment: "",
    balancePayment: "",
    photo: "",
    vendorEdd: "",
    cargoId: "",
    isMaterialRec: "No",
    notes: "Requires quick verification from Anees regarding specs."
  },
  // 2. Awaiting Cargo Assignment (Step 2 Completed, Step 3 Pending)
  // Has historical photo for "XM-900 Ultrasonic Transducer"
  {
    id: "req-2",
    purchaserId: "u-anees",
    vendorId: "v-1",
    orderDate: "2026-06-08",
    type: "Import",
    model: "XM-900 Ultrasonic Transducer",
    orderQuantity: 40,
    priceRmb: 120,
    totalRmb: 4800,
    advancePayment: 1500,
    balancePayment: 3300,
    photo: sensorSvg,
    vendorEdd: "2026-06-13", // Alert: Due soon!
    cargoId: "",
    isMaterialRec: "No",
    notes: "First batch for validation."
  },
  // 3. Urgent Pending Purchaser Details (Overdue Alert!)
  {
    id: "req-3",
    purchaserId: "u-john",
    vendorId: "v-2",
    orderDate: "2026-05-25",
    type: "Local",
    model: "HD-M12 Steel Threaded Bolts",
    orderQuantity: 500,
    priceRmb: 6,
    totalRmb: 3000,
    advancePayment: 3000,
    balancePayment: 0,
    photo: boltSvg,
    vendorEdd: "2026-06-05", // Alert: Overdue!
    cargoId: "",
    isMaterialRec: "No",
    notes: "Vendor delayed production due to material shortages."
  },
  // 4. In-Transit / Cargo Shipped (Step 3 Completed, Step 4 Pending)
  {
    id: "req-4",
    purchaserId: "u-john",
    vendorId: "v-2",
    orderDate: "2026-06-01",
    type: "Local",
    model: "HD-M12 Steel Threaded Bolts",
    orderQuantity: 1200,
    priceRmb: 5.5,
    totalRmb: 6600,
    advancePayment: 2000,
    balancePayment: 4600,
    photo: boltSvg,
    vendorEdd: "2026-06-08",
    cargoId: "cargo-101",
    isMaterialRec: "No",
    notes: "Shipped via land logistics."
  },
  // 5. Another item combined into the same Cargo "cargo-101"
  {
    id: "req-5",
    purchaserId: "u-john",
    vendorId: "v-2",
    orderDate: "2026-06-01",
    type: "Local",
    model: "HD-M16 Heavy Duty Washers",
    orderQuantity: 3000,
    priceRmb: 1.2,
    totalRmb: 3600,
    advancePayment: 1000,
    balancePayment: 2600,
    photo: boltSvg,
    vendorEdd: "2026-06-08",
    cargoId: "cargo-101",
    isMaterialRec: "No",
    notes: "Bundled together with the bolts cargo shipment."
  },
  // 6. Completed Purchase (Step 4 Completed - Received)
  {
    id: "req-6",
    purchaserId: "u-sarah",
    vendorId: "v-3",
    orderDate: "2026-05-15",
    type: "Import",
    model: "PLC-80 Programmable Logic Board",
    orderQuantity: 25,
    priceRmb: 450,
    totalRmb: 11250,
    advancePayment: 5000,
    balancePayment: 6250,
    photo: plcSvg,
    vendorEdd: "2026-06-01",
    cargoId: "cargo-100",
    isMaterialRec: "Yes",
    actualReceivedDate: "2026-05-28",
    notes: "Delivered to warehouse, QC checked and approved."
  }
];

export const initialCargoShipments = [
  {
    id: "cargo-100",
    vendorId: "v-3",
    cargoOrderDate: "2026-05-20",
    cargoDetail: "Express electronics shipping, double boxed",
    cargoPrice: 750,
    cargoPriceUom: "Flat Rate",
    cbmPackingList: 0.45,
    totalCargoPrice: 750,
    modeOfTransport: "Air",
    cargoShippingDate: "2026-05-22",
    cargoEta: "2026-05-29",
    packingListFile: "PK-PLC-80.pdf",
    invoiceFile: "INV-99388.pdf",
    isMaterialRec: "Yes",
    receivedDate: "2026-05-28"
  },
  {
    id: "cargo-101",
    vendorId: "v-2",
    cargoOrderDate: "2026-06-05",
    cargoDetail: "Ningbo steel hardware truck delivery",
    cargoPrice: 150,
    cargoPriceUom: "per CBM",
    cbmPackingList: 2.1,
    totalCargoPrice: 315,
    modeOfTransport: "Land",
    cargoShippingDate: "2026-06-07",
    cargoEta: "2026-06-15", // In Transit
    packingListFile: "PL-BOLTS-12.pdf",
    invoiceFile: "INV-BOLTS-12.pdf",
    isMaterialRec: "No"
  }
];

export const initialCargoCompanies = [
  { id: "cc-1", name: "Maersk Logistics", location: "Shenzhen Port Terminal, CN", phone: "+86 755 8888 1234", history: "Primary choice for Sea Cargo shipments. Excellent container tracking.", status: "Active" },
  { id: "cc-2", name: "DHL Express", location: "Guangzhou Baiyun Airport Hub, CN", phone: "+86 20 6666 4321", history: "Used for high-priority air shipments and fragile electronics.", status: "Active" },
  { id: "cc-3", name: "SF Express", location: "Beijing Capital Logistics Center, CN", phone: "+86 10 7777 5678", history: "Reliable land shipping and quick cross-province distribution.", status: "Active" }
];
