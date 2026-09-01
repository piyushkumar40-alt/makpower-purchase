import express from "express";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { 
  initialUsers, 
  initialVendors, 
  initialRequests, 
  initialCargoShipments, 
  initialCargoCompanies,
  initialCrmParties,
  initialCrmSalesOrders,
  initialCrmDispatches,
  initialDesignations,
  initialImsTransactions
} from "./src/mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// High-performance State Cache to prevent DB pool exhaustion
let stateCache = null;
let stateCacheTimestamp = 0;
const STATE_CACHE_TTL_MS = 3000;

function invalidateStateCache() {
  stateCache = null;
  stateCacheTimestamp = 0;
}

// Automatically invalidate full-state cache on any mutating request
app.use((req, res, next) => {
  if (req.method !== "GET" && req.path.startsWith("/api") && !req.path.startsWith("/api/audit-logs") && !req.path.startsWith("/api/auth")) {
    invalidateStateCache();
  }
  next();
});

const PORT = process.env.PORT || 3001;

// Cloudinary Setup
const envCloudinaryKey = process.env.cloudinary_key || process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_URL;

if (envCloudinaryKey && envCloudinaryKey.startsWith("cloudinary://")) {
  cloudinary.config({
    cloudinary_url: envCloudinaryKey
  });
  console.log("Cloudinary configured using connection string URL.");
} else if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
  console.log("Cloudinary configured using CLOUDINARY_URL.");
} else {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || process.env.CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY || process.env.cloudinary_key || process.env.API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET || process.env.API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
    console.log("Cloudinary configured using cloud_name, api_key, and api_secret.");
  } else {
    cloudinary.config({
      cloud_name: cloudName || "makpower",
      api_key: apiKey,
      api_secret: apiSecret
    });
    console.log("Cloudinary initialized with provided environment credentials.");
  }
}

// Database Connection Setup
let isPg = false;
let pool = null;

const connectionString = process.env.DATABASE_URL;

async function initDatabase() {
  if (connectionString) {
    try {
      pool = new pg.Pool({
        connectionString,
        ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false }
      });
      // Test connection
      await pool.query("SELECT NOW()");
      isPg = true;
      console.log("PostgreSQL database connected successfully.");
      await setupPgDatabase();
    } catch (err) {
      console.error("PostgreSQL connection failed. Falling back to local JSON file database. Error:", err.message);
      isPg = false;
    }
  } else {
    console.log("No DATABASE_URL found. Using local JSON database (db.json) for development.");
  }
}

// Local File Database Helper (Fallback)
const DB_FILE = path.join(__dirname, "db.json");

function readLocalJson() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: initialUsers.map(u => ({ ...u, status: "active" })),
      vendors: initialVendors,
      requests: initialRequests,
      cargos: initialCargoShipments,
      cargoCompanies: initialCargoCompanies,
      crmParties: initialCrmParties,
      crmSalesOrders: initialCrmSalesOrders,
      crmDispatches: initialCrmDispatches,
      imsTransactions: [],
      designations: initialDesignations,
      items: [],
      settings: {
        isHidden: false,
        redirectUrl: "https://www.instagram.com/makpowerofficial/"
      }
    };
    const distinctModels = Array.from(new Set((initialRequests || []).map(r => r.model).filter(Boolean)));
    defaultData.items = distinctModels.map((m, idx) => {
      const match = (initialRequests || []).find(r => r.model === m);
      return {
        id: String(idx + 1),
        name: m,
        category: match?.category || "General",
        itemType: match?.type || "FG",
        itemNature: match?.itemNature || "Non Consumables",
        unit: "Pcs",
        description: "",
        currentStock: 0
      };
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!data.settings) {
      data.settings = {
        isHidden: false,
        redirectUrl: "https://www.instagram.com/makpowerofficial/"
      };
    }
    if (!Array.isArray(data.crmParties)) data.crmParties = initialCrmParties;
    if (!Array.isArray(data.crmSalesOrders)) data.crmSalesOrders = [];
    data.crmSalesOrders = data.crmSalesOrders.filter(o => !o.id?.startsWith('so-10') && !o.itemModel?.startsWith('MP-'));
    if (!Array.isArray(data.crmDispatches)) data.crmDispatches = [];
    data.crmDispatches = data.crmDispatches.filter(d => !d.id?.startsWith('dsp-50') && !d.itemModel?.startsWith('MP-'));
    if (!Array.isArray(data.imsTransactions)) data.imsTransactions = [];
    if (!Array.isArray(data.designations)) data.designations = initialDesignations;
    if (!Array.isArray(data.items) || data.items.length === 0) {
      const distinctModels = Array.from(new Set((data.requests || initialRequests || []).map(r => r.model).filter(Boolean)));
      data.items = distinctModels.map((m, idx) => {
        const match = (data.requests || initialRequests || []).find(r => r.model === m);
        return {
          id: String(idx + 1),
          name: m,
          category: match?.category || "General",
          itemType: match?.type || "FG",
          itemNature: match?.itemNature || "Non Consumables",
          unit: "Pcs",
          description: "",
          currentStock: 0
        };
      });
    }
    if (!Array.isArray(data.users)) data.users = [];
    initialUsers.forEach(initU => {
      const idx = data.users.findIndex(u => (u.email || "").toLowerCase() === initU.email.toLowerCase() || u.id === initU.id);
      if (idx === -1) {
        data.users.push({ ...initU, status: "active" });
      } else {
        data.users[idx].status = "active";
        data.users[idx].designation = data.users[idx].designation || initU.designation;
        data.users[idx].role = data.users[idx].role || initU.role;
      }
    });
    data.users = data.users.map(u => ({ ...u, status: u.status || "active" }));

    if (Array.isArray(data.requests)) {
      data.requests = data.requests.map(r => ({ ...r, purchaseUpdated: r.purchaseUpdated || "No" }));
    }
    const adminIdx = data.users.findIndex(x => x.id === "u-admin" || x.role === "superadmin" || x.email === "admin@company.com" || x.email === "admin@makpowerindia.com");
    if (adminIdx !== -1) {
      data.users[adminIdx].password = "MakPower#Admin2026!";
      data.users[adminIdx].email = "admin@makpowerindia.com";
      data.users[adminIdx].status = "active";
    }
    return data;
  } catch (e) {
    console.error("Error reading db.json, returning default mock data:", e.message);
    return {
      users: initialUsers.map(u => ({ ...u, status: "active" })),
      vendors: initialVendors,
      requests: initialRequests,
      cargos: initialCargoShipments,
      cargoCompanies: initialCargoCompanies,
      crmParties: initialCrmParties,
      crmSalesOrders: initialCrmSalesOrders,
      crmDispatches: initialCrmDispatches,
      designations: initialDesignations,
      items: [],
      settings: {
        isHidden: false,
        redirectUrl: "https://www.instagram.com/makpowerofficial/"
      }
    };
  }
}

function writeLocalJson(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// PG Database Initializer & Seeder
async function setupPgDatabase() {
  if (!isPg) return;

  try {
    // 1. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        "key" TEXT PRIMARY KEY,
        "value" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "email" TEXT UNIQUE,
        "password" TEXT,
        "role" TEXT,
        "designation" TEXT,
        "status" TEXT
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "designation" TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "parentCrmId" TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "phone" TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "territory" TEXT;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_parties (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "contactPerson" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "city" TEXT,
        "state" TEXT,
        "gstin" TEXT,
        "creditLimit" NUMERIC,
        "outstanding" NUMERIC,
        "paymentTerms" TEXT,
        "assignedCrmId" TEXT,
        "assignedCrmName" TEXT,
        "assignedAsmId" TEXT,
        "assignedAsmName" TEXT,
        "assignedTsmId" TEXT,
        "assignedTsmName" TEXT,
        "status" TEXT,
        "createdAt" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_sales_orders (
        "id" TEXT PRIMARY KEY,
        "orderNo" TEXT,
        "orderDate" TEXT,
        "partyId" TEXT,
        "partyName" TEXT,
        "itemModel" TEXT,
        "category" TEXT,
        "orderQty" INTEGER,
        "unitPriceInr" NUMERIC,
        "totalInr" NUMERIC,
        "dispatchedQty" INTEGER,
        "pendingQty" INTEGER,
        "status" TEXT,
        "assignedCrmId" TEXT,
        "assignedAsmId" TEXT,
        "assignedTsmId" TEXT,
        "notes" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crm_dispatches (
        "id" TEXT PRIMARY KEY,
        "orderId" TEXT,
        "orderNo" TEXT,
        "partyId" TEXT,
        "partyName" TEXT,
        "itemModel" TEXT,
        "dispatchedQty" INTEGER,
        "transporterName" TEXT,
        "docketNo" TEXT,
        "invoiceNo" TEXT,
        "dispatchDate" TEXT,
        "deliveryDate" TEXT,
        "status" TEXT,
        "assignedCrmId" TEXT,
        "assignedAsmId" TEXT,
        "assignedTsmId" TEXT
      );
    `);

    // Seed CRM initial parties, sales orders, and dispatches if empty
    try {
      const ptyCheck = await pool.query("SELECT COUNT(*) FROM crm_parties");
      if (parseInt(ptyCheck.rows[0].count) === 0) {
        for (const p of initialCrmParties) {
          await pool.query(
            `INSERT INTO crm_parties ("id", "name", "contactPerson", "phone", "email", "city", "state", "gstin", "creditLimit", "outstanding", "paymentTerms", "assignedCrmId", "assignedCrmName", "assignedAsmId", "assignedAsmName", "assignedTsmId", "assignedTsmName", "status", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT ("id") DO NOTHING`,
            [p.id, p.name, p.contactPerson, p.phone, p.email, p.city, p.state, p.gstin, p.creditLimit, p.outstanding, p.paymentTerms, p.assignedCrmId, p.assignedCrmName, p.assignedAsmId, p.assignedAsmName, p.assignedTsmId, p.assignedTsmName, p.status, p.createdAt]
          );
        }
      }

      // Clean up any old mock/dummy sales orders, dispatches, and transactions from system
      await pool.query(`DELETE FROM crm_sales_orders WHERE "id" LIKE 'so-10%' OR "itemModel" LIKE 'MP-%'`);
      await pool.query(`DELETE FROM crm_dispatches WHERE "id" LIKE 'dsp-50%' OR "itemModel" LIKE 'MP-%'`);
      await pool.query(`DELETE FROM ims_transactions WHERE "id" LIKE 'ims-10%' OR "itemName" LIKE 'MP-%'`);

      // Upsert CRM users in PG
      for (const u of initialUsers) {
        await pool.query(
          `INSERT INTO users ("id", "name", "email", "password", "role", "designation", "status", "phone", "territory", "parentCrmId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT ("id") DO NOTHING`,
          [u.id, u.name, u.email, u.password, u.role, u.designation || "Staff", u.status, u.phone || "", u.territory || "", u.parentCrmId || ""]
        );
      }

      // Seed IMS Transactions
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ims_transactions (
          "id" TEXT PRIMARY KEY,
          "date" TEXT,
          "itemName" TEXT,
          "itemId" TEXT,
          "stockQty" INTEGER,
          "movementType" TEXT,
          "partyName" TEXT,
          "remarks" TEXT,
          "source" TEXT,
          "isMissingId" BOOLEAN,
          "location" TEXT,
          "createdAt" TEXT
        );
      `);

      // Migration: Ensure all columns exist in ims_transactions
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "date" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "itemName" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "itemId" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "stockQty" INTEGER;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "movementType" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "partyName" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "remarks" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "source" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "isMissingId" BOOLEAN;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "location" TEXT;`);
      await pool.query(`ALTER TABLE ims_transactions ADD COLUMN IF NOT EXISTS "createdAt" TEXT;`);

      // High Performance Database Indexes for 1.6L+ rows
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ims_date ON ims_transactions("date" DESC, "createdAt" DESC);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ims_item_id ON ims_transactions("itemId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ims_item_name ON ims_transactions("itemName");`);

      // CRM Database Indexes for instant sub-millisecond querying
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_parties_asm ON crm_parties("assignedAsmId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_parties_tsm ON crm_parties("assignedTsmId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_parties_crm ON crm_parties("assignedCrmId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_orders_party ON crm_sales_orders("partyId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_orders_date ON crm_sales_orders("orderDate" DESC);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_orders_asm ON crm_sales_orders("assignedAsmId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_orders_tsm ON crm_sales_orders("assignedTsmId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_dispatches_party ON crm_dispatches("partyId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_dispatches_date ON crm_dispatches("dispatchDate" DESC);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_remarks_party ON crm_party_remarks("partyId");`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_remarks_date ON crm_party_remarks("createdAt" DESC);`);

      // Seed initial IMS stock transactions only once during first setup (not re-seeded if user deletes)
      await pool.query(`CREATE TABLE IF NOT EXISTS sys_metadata ("key" TEXT PRIMARY KEY, "value" TEXT);`);
      const seedCheck = await pool.query(`SELECT "value" FROM sys_metadata WHERE "key" = 'ims_seeded'`);
      if (seedCheck.rows.length === 0) {
        for (const tx of initialImsTransactions) {
          await pool.query(
            `INSERT INTO ims_transactions ("id", "date", "itemName", "itemId", "stockQty", "movementType", "partyName", "remarks", "source", "isMissingId", "location", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT ("id") DO NOTHING`,
            [tx.id, tx.date, tx.itemName, tx.itemId || "", tx.stockQty, tx.movementType, tx.partyName || "", tx.remarks || "", tx.source || "initial", tx.isMissingId || false, tx.location || "Delhi", tx.createdAt || new Date().toISOString()]
          );
        }
        await pool.query(`INSERT INTO sys_metadata ("key", "value") VALUES ('ims_seeded', 'true') ON CONFLICT DO NOTHING`);
        console.log("Seeded initial IMS stock movements once.");
      }
    } catch (crmSeedErr) {
      console.warn("CRM / IMS table seeding notice:", crmSeedErr.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "location" TEXT,
        "phone" TEXT,
        "history" TEXT,
        "status" TEXT,
        "purchaserIds" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cargo_companies (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "location" TEXT,
        "phone" TEXT,
        "history" TEXT,
        "status" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cargos (
        "id" TEXT PRIMARY KEY,
        "vendorId" TEXT,
        "cargoOrderDate" TEXT,
        "cargoDetail" TEXT,
        "cargoPrice" NUMERIC,
        "cargoPriceUom" TEXT,
        "cbmPackingList" NUMERIC,
        "totalCargoPrice" NUMERIC,
        "modeOfTransport" TEXT,
        "cargoShippingDate" TEXT,
        "cargoEta" TEXT,
        "packingListFile" TEXT,
        "invoiceFile" TEXT,
        "isMaterialRec" TEXT,
        "receivedDate" TEXT,
        "currency" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        "id" TEXT PRIMARY KEY,
        "purchaserId" TEXT,
        "vendorId" TEXT,
        "orderDate" TEXT,
        "type" TEXT,
        "model" TEXT,
        "orderQuantity" INTEGER,
        "priceRmb" NUMERIC,
        "totalRmb" NUMERIC,
        "advancePayment" NUMERIC,
        "balancePayment" NUMERIC,
        "photo" TEXT,
        "vendorEdd" TEXT,
        "cargoId" TEXT,
        "isMaterialRec" TEXT,
        "actualReceivedDate" TEXT,
        "notes" TEXT,
        "itemNature" TEXT,
        "category" TEXT,
        "requiredByDate" TEXT,
        "entryBy" TEXT,
        "packingOrderedByNitin" TEXT,
        "purchaseUpdated" TEXT,
        "status" TEXT,
        "cancellationReason" TEXT,
        "cancelledAt" TEXT,
        "cargoAssignedAt" TEXT,
        "vendorOrderQuantity" INTEGER,
        "cargoPickedQty" INTEGER,
        "receivedQuantity" INTEGER,
        "shortageQty" INTEGER,
        "parentRequestId" TEXT,
        "vendorReadyDate" TEXT,
        "currency" TEXT
      );
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "vendorOrderQuantity" INTEGER;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "cargoPickedQty" INTEGER;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "receivedQuantity" INTEGER;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "shortageQty" INTEGER;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "parentRequestId" TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "vendorReadyDate" TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS "currency" TEXT;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "category" TEXT,
        "itemType" TEXT,
        "itemNature" TEXT,
        "unit" TEXT,
        "description" TEXT,
        "photo" TEXT,
        "currentStock" INTEGER,
        "createdBy" TEXT
      );
      ALTER TABLE items ADD COLUMN IF NOT EXISTS "itemType" TEXT;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
      UPDATE users SET "password" = 'MakPower#Admin2026!' WHERE "email" = 'admin@makpowerindia.com' AND ("password" = '112233' OR "password" = 'admin');
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS designations (
        "id" TEXT PRIMARY KEY,
        "title" TEXT,
        "description" TEXT,
        "role" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_prices (
        "id" TEXT PRIMARY KEY,
        "itemId" TEXT,
        "itemName" TEXT,
        "pp" NUMERIC,
        "from" TEXT,
        "to" TEXT,
        "createdAt" TEXT,
        "updatedAt" TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_item_prices_item_id ON item_prices("itemId");
      CREATE INDEX IF NOT EXISTS idx_item_prices_dates ON item_prices("from", "to");

      CREATE TABLE IF NOT EXISTS crm_party_remarks (
        "id" TEXT PRIMARY KEY,
        "partyId" TEXT,
        "partyName" TEXT,
        "category" TEXT,
        "month" TEXT,
        "remark" TEXT,
        "authorId" TEXT,
        "authorName" TEXT,
        "authorRole" TEXT,
        "createdAt" TEXT,
        "updatedAt" TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_crm_remarks_party ON crm_party_remarks("partyId");
      CREATE INDEX IF NOT EXISTS idx_crm_remarks_party_cat_month ON crm_party_remarks("partyId", "category", "month");
    `);

    // Seed default designations if empty
    try {
      const desCheck = await pool.query("SELECT COUNT(*) FROM designations");
      if (parseInt(desCheck.rows[0].count) === 0) {
        for (const d of initialDesignations) {
          await pool.query(
            `INSERT INTO designations ("id", "title", "description", "role") VALUES ($1, $2, $3, $4) ON CONFLICT ("id") DO NOTHING`,
            [d.id, d.title, d.description || "", d.role || "purchaser"]
          );
        }
      }
    } catch (desErr) {
      console.warn("Designations table seed warning:", desErr.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT,
        "userName" TEXT,
        "role" TEXT,
        "action" TEXT,
        "details" TEXT,
        "entityType" TEXT,
        "entityId" TEXT,
        "oldData" TEXT,
        "newData" TEXT,
        "timestamp" TEXT,
        "isoTime" TEXT
      );
    `);

    // Ensure all standard initial users exist in PG with active status & designations
    for (const u of initialUsers) {
      await pool.query(
        `INSERT INTO users ("id", "name", "email", "password", "role", "designation", "status", "phone", "territory", "parentCrmId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT ("id") DO UPDATE SET
           "status" = 'active',
           "designation" = COALESCE(users."designation", EXCLUDED."designation"),
           "role" = COALESCE(users."role", EXCLUDED."role")`,
        [u.id, u.name, u.email, u.password, u.role, u.designation || "Staff", "active", u.phone || "", u.territory || "", u.parentCrmId || ""]
      );
    }
    await pool.query(`UPDATE users SET "status" = 'active' WHERE "status" IS NULL OR "status" = ''`);

    // Auto-seed items table from requests if empty
    try {
      const itemCheck = await pool.query("SELECT COUNT(*) FROM items");
      if (parseInt(itemCheck.rows[0].count) === 0) {
        const reqModels = await pool.query("SELECT DISTINCT model, category, type, \"itemNature\" FROM requests WHERE model IS NOT NULL AND model != ''");
        let idx = 1;
        for (const row of reqModels.rows) {
          await pool.query(
            `INSERT INTO items ("id", "name", "category", "itemType", "itemNature", "unit", "description", "currentStock")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT ("id") DO NOTHING`,
            [String(idx++), row.model, row.category || "General", row.type || "FG", row.itemNature || "Non Consumables", "Pcs", "", 0]
          );
        }
        console.log(`Auto-seeded items table with ${reqModels.rows.length} master items.`);
      }
    } catch (itErr) {
      console.warn("Items auto-seeding notice:", itErr.message);
    }

    // 2. Check if seeding is required
    const userCheck = await pool.query("SELECT COUNT(*) FROM users");
    const count = parseInt(userCheck.rows[0].count);
    if (count === 0) {
      console.log("PG Database is empty. Seeding initial data...");

      // Seed Users
      for (const u of initialUsers) {
        await pool.query(
          `INSERT INTO users ("id", "name", "email", "password", "role", "designation", "status") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [u.id, u.name, u.email, u.password, u.role, u.designation || "Staff", "active"]
        );
      }

      // Seed Vendors
      for (const v of initialVendors) {
        await pool.query(
          `INSERT INTO vendors ("id", "name", "location", "phone", "history", "status", "purchaserIds") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [v.id, v.name, v.location, v.phone, v.history, v.status, JSON.stringify(v.purchaserIds)]
        );
      }

      // Seed Cargo Companies
      for (const cc of initialCargoCompanies) {
        await pool.query(
          `INSERT INTO cargo_companies ("id", "name", "location", "phone", "history", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
          [cc.id, cc.name, cc.location, cc.phone, cc.history, cc.status]
        );
      }

      // Seed Cargos
      for (const c of initialCargoShipments) {
        await pool.query(
          `INSERT INTO cargos (
            "id", "vendorId", "cargoOrderDate", "cargoDetail", "cargoPrice", "cargoPriceUom",
            "cbmPackingList", "totalCargoPrice", "modeOfTransport", "cargoShippingDate", "cargoEta",
            "packingListFile", "invoiceFile", "isMaterialRec", "receivedDate", "currency"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            c.id, c.vendorId, c.cargoOrderDate, c.cargoDetail, c.cargoPrice, c.cargoPriceUom,
            c.cbmPackingList, c.totalCargoPrice, c.modeOfTransport, c.cargoShippingDate, c.cargoEta,
            c.packingListFile, c.invoiceFile, c.isMaterialRec, c.receivedDate, c.currency
          ]
        );
      }

      // Seed Requests
      for (const r of initialRequests) {
        await pool.query(
          `INSERT INTO requests (
            "id", "purchaserId", "vendorId", "orderDate", "type", "model", "orderQuantity",
            "priceRmb", "totalRmb", "advancePayment", "balancePayment", "photo", "vendorEdd",
            "cargoId", "isMaterialRec", "actualReceivedDate", "notes", "itemNature", "category",
            "requiredByDate", "entryBy", "packingOrderedByNitin", "purchaseUpdated", "status",
            "cancellationReason", "cancelledAt", "cargoAssignedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
          [
            r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, r.orderQuantity,
            r.priceRmb || null, r.totalRmb || null, r.advancePayment || null, r.balancePayment || null,
            r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No",
            r.actualReceivedDate || "", r.notes || "", r.itemNature || "Non Consumables", r.category || "",
            r.requiredByDate || "", r.entryBy || "", r.packingOrderedByNitin || "No", r.purchaseUpdated || "No",
            r.status || "Active", r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || ""
          ]
        );
      }
      console.log("PG Database seeded successfully.");
    }

    // Auto-clean any legacy SVG data URIs in PostgreSQL to HTTPS CDN URLs
    await pool.query(`UPDATE requests SET photo = 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=300&auto=format&fit=crop&q=80' WHERE photo LIKE 'data:image%'`);

    // Auto-update admin user password to 112233 if legacy password is found
    await pool.query(`UPDATE users SET password = '112233' WHERE (email = 'admin@company.com' OR role = 'superadmin') AND password = 'MakPower#Admin2026!'`);

    // Set default 'No' only for NULL or empty purchaseUpdated records
    await pool.query(`UPDATE requests SET "purchaseUpdated" = 'No' WHERE "purchaseUpdated" IS NULL OR "purchaseUpdated" = ''`);

    // Seed default settings
    const settingsCheck = await pool.query("SELECT COUNT(*) FROM settings");
    if (parseInt(settingsCheck.rows[0].count) === 0) {
      await pool.query('INSERT INTO settings ("key", "value") VALUES ($1, $2)', ["isHidden", "false"]);
      await pool.query('INSERT INTO settings ("key", "value") VALUES ($1, $2)', ["redirectUrl", "https://www.instagram.com/makpowerofficial/"]);
      console.log("Default settings seeded in PG database.");
    }
  } catch (err) {
    console.error("Error setting up PostgreSQL schemas/seeds:", err.message);
  }
}

// Run DB setup in background asynchronously on startup
const dbInitPromise = initDatabase().catch(err => {
  console.error("Database initialization error:", err);
});

// Immediate Health Check Endpoints (never blocked by DB initialization)
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// Middleware: Ensure database is initialized before handling API requests (with 2s safety timeout)
app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();
  if (dbInitPromise) {
    try {
      await Promise.race([
        dbInitPromise,
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch (err) {
      console.warn("DB init wait notice:", err.message);
    }
  }
  next();
});

// Helper to parse cookies manually
const getBypassCookie = (req) => {
  if (!req.headers.cookie) return null;
  const match = req.headers.cookie.match(/(?:^|; )admin_bypass=([^;]*)/);
  return match ? match[1] : null;
};

// Middleware: Check system visibility and redirect unauthorized visitors before serving static app files
app.use(async (req, res, next) => {
  const path = req.path;

  // Always let API requests and the panic route pass
  if (path.startsWith("/api/") || path === "/web") {
    return next();
  }

  // Check if admin bypass query parameter is present
  if (req.query.bypass === "true") {
    res.setHeader("Set-Cookie", "admin_bypass=true; Path=/; Max-Age=2592000; SameSite=Lax");
    return next();
  }

  // Check if admin bypass cookie is already set
  if (getBypassCookie(req) === "true") {
    return next();
  }

  // Retrieve settings
  let isHidden = false;
  let redirectUrl = "https://www.instagram.com/makpowerofficial/";

  try {
    if (isPg) {
      const resSettings = await pool.query("SELECT * FROM settings");
      resSettings.rows.forEach(row => {
        if (row.key === "isHidden") isHidden = (row.value === "true");
        if (row.key === "redirectUrl") redirectUrl = row.value;
      });
    } else {
      const data = readLocalJson();
      if (data.settings) {
        isHidden = !!data.settings.isHidden;
        redirectUrl = data.settings.redirectUrl || redirectUrl;
      }
    }
  } catch (err) {
    console.error("Error checking settings in visibility middleware:", err.message);
  }

  if (isHidden) {
    return res.redirect(redirectUrl);
  }

  next();
});

// Auto-invalidate server state cache whenever mutations occur
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    invalidateStateCache();
  }
  next();
});

// ==================== API ENDPOINTS ====================

// Active Sessions & Auth Audit Logs Store
let activeSessions = []; // [{ sessionId, userId, userName, role, loginTime, lastPing }]
let authAuditLogs = [];  // [{ id, userId, userName, role, action, timestamp, details }]
let revokedUserIds = new Set();

async function recordAuthAuditLog(userId, userName, role, action, details = "", entityType = "System", entityId = "") {
  const logEntry = {
    id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    userId: userId || "system",
    userName: userName || "System User",
    role: role || "user",
    action: action || "ACTIVITY",
    details: details || "",
    entityType: entityType || "System",
    entityId: entityId || "",
    oldData: "",
    newData: "",
    timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    isoTime: new Date().toISOString()
  };

  authAuditLogs.unshift(logEntry);
  if (authAuditLogs.length > 500) authAuditLogs = authAuditLogs.slice(0, 500);

  if (isPg) {
    try {
      await pool.query(
        `INSERT INTO audit_logs ("id", "userId", "userName", "role", "action", "details", "entityType", "entityId", "oldData", "newData", "timestamp", "isoTime")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT ("id") DO NOTHING`,
        [logEntry.id, logEntry.userId, logEntry.userName, logEntry.role, logEntry.action, logEntry.details, logEntry.entityType, logEntry.entityId, logEntry.oldData, logEntry.newData, logEntry.timestamp, logEntry.isoTime]
      );
    } catch (err) {
      console.error("Failed to insert auth audit log into PG audit_logs table:", err.message);
    }
  } else {
    try {
      const data = readLocalJson();
      if (!data.auditLogs) data.auditLogs = [];
      data.auditLogs.unshift(logEntry);
      if (data.auditLogs.length > 2000) data.auditLogs = data.auditLogs.slice(0, 2000);
      writeLocalJson(data);
    } catch (err) {
      console.error("Failed to write auth audit log to local JSON:", err.message);
    }
  }

  return logEntry;
}

// 0.1 POST /api/auth/login - Record login & session
app.post("/api/auth/login", (req, res) => {
  const { user } = req.body;
  if (!user || !user.id) {
    return res.status(400).json({ error: "Invalid user data for login session." });
  }

  // Clear revocation flag upon fresh login
  revokedUserIds.delete(user.id);

  const sessionId = "sess_" + user.id + "_" + Date.now();
  const loginTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

  activeSessions = activeSessions.filter(s => s.userId !== user.id);

  const sessionObj = {
    sessionId,
    userId: user.id,
    userName: user.name || user.email || user.id,
    role: user.role || "user",
    loginTime,
    lastPing: Date.now()
  };

  activeSessions.push(sessionObj);
  recordAuthAuditLog(user.id, sessionObj.userName, sessionObj.role, "Login", "Signed in from browser");

  return res.json({ success: true, sessionId, session: sessionObj });
});

// 0.2 POST /api/auth/logout - Record explicit logout
app.post("/api/auth/logout", (req, res) => {
  const { userId, sessionId } = req.body;
  const target = activeSessions.find(s => s.sessionId === sessionId || s.userId === userId);
  if (target) {
    recordAuthAuditLog(target.userId, target.userName, target.role, "Logout", "User initiated logout");
  }
  activeSessions = activeSessions.filter(s => s.sessionId !== sessionId && s.userId !== userId);
  return res.json({ success: true });
});

// 0.3 GET /api/auth/sessions - Admin fetch of active sessions & audit logs
app.get("/api/auth/sessions", (req, res) => {
  return res.json({
    success: true,
    activeSessions,
    authAuditLogs,
    revokedUserIds: Array.from(revokedUserIds)
  });
});

// 0.4 POST /api/auth/force-logout - Admin revokes specific user session
app.post("/api/auth/force-logout", (req, res) => {
  const { userId, sessionId } = req.body;
  const target = activeSessions.find(s => s.sessionId === sessionId || s.userId === userId);

  if (userId) {
    revokedUserIds.add(userId);
  }

  if (target) {
    recordAuthAuditLog(target.userId, target.userName, target.role, "Force Signed Out", "Session revoked by SuperAdmin");
    activeSessions = activeSessions.filter(s => s.sessionId !== sessionId && s.userId !== userId);
  }
  return res.json({ success: true, activeSessions, authAuditLogs, revokedUserIds: Array.from(revokedUserIds) });
});

// 0.5 POST /api/auth/force-logout-all - Admin revokes ALL active sessions
app.post("/api/auth/force-logout-all", (req, res) => {
  const { currentAdminId } = req.body;

  activeSessions.forEach(s => {
    if (s.userId !== currentAdminId) {
      revokedUserIds.add(s.userId);
      recordAuthAuditLog(s.userId, s.userName, s.role, "Force Signed Out", "Global sign out triggered by Admin");
    }
  });

  activeSessions = activeSessions.filter(s => s.userId === currentAdminId);

  return res.json({ success: true, activeSessions, authAuditLogs, revokedUserIds: Array.from(revokedUserIds) });
});

// 0.6 POST /api/upload - Cloudinary Image & File Upload Endpoint
app.post("/api/upload", async (req, res) => {
  try {
    const { image, file, folder } = req.body;
    const fileToUpload = image || file;

    if (!fileToUpload) {
      return res.status(400).json({ error: "No image or file data provided for upload." });
    }

    // If already a CDN / HTTP URL, return as is
    if (typeof fileToUpload === "string" && (fileToUpload.startsWith("http://") || fileToUpload.startsWith("https://"))) {
      return res.json({ success: true, url: fileToUpload });
    }

    const uploadOptions = {
      folder: folder || "makpower_uploads",
      resource_type: "auto"
    };

    const uploadResult = await cloudinary.uploader.upload(fileToUpload, uploadOptions);

    return res.json({
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({
      error: "Failed to upload file to Cloudinary.",
      details: err.message
    });
  }
});

// POST /api/migrate-photos-to-cloudinary - Scans DB and uploads all non-Cloudinary images to Cloudinary CDN
app.post("/api/migrate-photos-to-cloudinary", async (req, res) => {
  try {
    let requests = [];
    let photoSettings = [];
    if (isPg) {
      const rRes = await pool.query("SELECT * FROM requests WHERE photo IS NOT NULL AND photo != ''");
      requests = rRes.rows || [];
      const sRes = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'photo_%' AND value IS NOT NULL AND value != ''");
      photoSettings = sRes.rows || [];
    } else {
      requests = (memoryDb.requests || []).filter(r => r.photo);
      const settingsObj = memoryDb.settings || {};
      photoSettings = Object.entries(settingsObj)
        .filter(([k, v]) => k.startsWith("photo_") && v && v.trim() !== "")
        .map(([key, value]) => ({ key, value }));
    }

    let migratedCount = 0;

    for (const r of requests) {
      const photoStr = r.photo;
      // Skip if already hosted on Cloudinary
      if (photoStr && photoStr.includes("res.cloudinary.com")) {
        continue;
      }

      if (photoStr && photoStr.trim() !== "") {
        try {
          const uploadResult = await cloudinary.uploader.upload(photoStr, {
            folder: "makpower_photos",
            resource_type: "auto"
          });

          const cUrl = uploadResult.secure_url;
          migratedCount++;

          if (isPg) {
            await pool.query('UPDATE requests SET "photo" = $1 WHERE "id" = $2', [cUrl, r.id]);
          } else {
            const match = memoryDb.requests.find(x => x.id === r.id);
            if (match) match.photo = cUrl;
          }
        } catch (upErr) {
          console.error(`Failed to migrate photo for request ${r.id}:`, upErr.message);
        }
      }
    }

    for (const s of photoSettings) {
      const photoStr = s.value;
      if (photoStr && photoStr.includes("res.cloudinary.com")) continue;

      if (photoStr && photoStr.trim() !== "") {
        try {
          const uploadResult = await cloudinary.uploader.upload(photoStr, {
            folder: "makpower_photos",
            resource_type: "auto"
          });
          const cUrl = uploadResult.secure_url;
          migratedCount++;

          if (isPg) {
            await pool.query('UPDATE settings SET "value" = $1 WHERE "key" = $2', [cUrl, s.key]);
          } else {
            if (memoryDb.settings) memoryDb.settings[s.key] = cUrl;
          }
        } catch (upErr) {
          console.error(`Failed to migrate setting photo ${s.key}:`, upErr.message);
        }
      }
    }

    if (!isPg) {
      writeLocalJson(memoryDb);
    }

    recordAuthAuditLog("admin", "Photo Migration", "admin", "Cloudinary Migration", `Migrated ${migratedCount} database photos to Cloudinary CDN`);

    return res.json({
      success: true,
      migratedCount,
      message: `Successfully migrated ${migratedCount} item photos to Cloudinary database storage.`
    });
  } catch (err) {
    console.error("Migration error:", err);
    return res.status(500).json({ error: "Failed to migrate photos to Cloudinary.", details: err.message });
  }
});

// ==================== GOOGLE SHEETS 27-COLUMN SYNC SYSTEM ====================

async function formatAllRequestsForGoogleSheets() {
  let requests = [];
  let users = [];
  let vendors = [];
  let cargos = [];

  if (isPg) {
    const rRes = await pool.query("SELECT * FROM requests");
    const uRes = await pool.query("SELECT * FROM users");
    const vRes = await pool.query("SELECT * FROM vendors");
    const cRes = await pool.query("SELECT * FROM cargos");
    requests = rRes.rows || [];
    users = uRes.rows || [];
    vendors = vRes.rows || [];
    cargos = cRes.rows || [];
  } else {
    requests = memoryDb.requests || [];
  users = memoryDb.users || [];
    vendors = memoryDb.vendors || [];
    cargos = memoryDb.cargos || [];
  }

  // Exclude cancelled and received orders from Google Sheets export as requested
  const activeRequests = requests.filter(r => r.status !== "Cancelled" && r.isMaterialRec !== "Yes");

  const rows = activeRequests.map(r => {
    const purchaserObj = users.find(u => u.id === r.purchaserId);
    const purchaser = purchaserObj ? purchaserObj.name : (r.purchaserName || r.assignedPurchaser || r.purchaserId || "");
    const vendor = vendors.find(v => v.id === r.vendorId)?.name || "";
    const cargo = cargos.find(c => c.id === r.cargoId) || {};

    const effectiveQty = r.cargoId 
      ? (r.cargoPickedQty || r.vendorOrderQuantity || r.orderQuantity || 0)
      : (r.vendorOrderQuantity || r.orderQuantity || 0);

    return {
      purchaser: purchaser || "",
      vendor: vendor || "",
      orderDate: r.orderDate || "",
      type: r.type || "",
      model: r.model || "",
      orderQuantity: String(effectiveQty || 0),
      priceRmb: r.priceRmb != null ? String(r.priceRmb) : "",
      totalRmb: r.totalRmb != null ? String(r.totalRmb) : "",
      advancePayment: r.advancePayment != null ? String(r.advancePayment) : "",
      balancePayment: r.balancePayment != null ? String(r.balancePayment) : "",
      photo: r.photo || "",
      vendorEdd: r.vendorEdd || "",
      cargoOrderDate: cargo.cargoOrderDate || "",
      cargoDetail: cargo.cargoDetail || "",
      cargoPrice: cargo.cargoPrice != null ? String(cargo.cargoPrice) : "",
      cargoPriceUom: cargo.cargoPriceUom || "",
      cbmPackingList: cargo.cbmPackingList != null ? String(cargo.cbmPackingList) : "",
      totalCargoPrice: cargo.totalCargoPrice != null ? String(cargo.totalCargoPrice) : "",
      modeOfTransport: cargo.modeOfTransport || "",
      cargoShippingDate: cargo.cargoShippingDate || "",
      cargoEta: cargo.cargoEta || "",
      packingListFile: cargo.packingListFile || "",
      invoiceFile: cargo.invoiceFile || "",
      isMaterialRec: r.isMaterialRec || cargo.isMaterialRec || "",
      packingSlip: cargo.packingListFile || "",
      packingOrderedByNitin: r.packingOrderedByNitin === "Yes" ? true : "",
      purchaseUpdated: r.purchaseUpdated === "Yes" ? true : ""
    };
  });

  return rows;
}

// ==================== ADAPTIVE ACTIVITY-DRIVEN GOOGLE SHEETS SYNC ENGINE ====================
let lastGoogleSheetSyncTime = 0; // Timestamp of last Google Sheets sync execution
let lastAppActivityTime = Date.now(); // Timestamp of last app activity (new order, Nitin packing, etc.)
let isOrderDataDirty = true; // Initial sync flag

function markAppActivity() {
  lastAppActivityTime = Date.now();
  isOrderDataDirty = true;
  console.log(`[Google Sheets Engine] App activity detected! Reset sync frequency to 3-minute active interval.`);
}

// Background sync engine loop (checks every 15 seconds)
setInterval(async () => {
  try {
    const now = Date.now();
    const timeSinceLastSync = now - lastGoogleSheetSyncTime;
    const timeSinceLastActivity = now - lastAppActivityTime;

    // HARD RULE 1: Cannot run before 3 minutes (180,000 ms) of last run
    const MIN_SYNC_INTERVAL = 3 * 60 * 1000;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL) {
      return; // Respect 3-minute minimum gap
    }

    // ADAPTIVE RULES 2 & 3:
    // - Something happens in app (or < 30m ago): run every 3 minutes
    // - 30m to 90m of inactivity: run with a 60-minute gap
    // - > 90m of inactivity: run every 3 hours (180 minutes)
    let requiredSyncInterval = 3 * 60 * 1000; // Default 3 mins

    if (isOrderDataDirty || timeSinceLastActivity < 30 * 60 * 1000) {
      requiredSyncInterval = 3 * 60 * 1000; // 3 minutes when something happens in app
    } else if (timeSinceLastActivity < 90 * 60 * 1000) {
      requiredSyncInterval = 60 * 60 * 1000; // 60 minutes gap if no activity for 30 mins
    } else {
      requiredSyncInterval = 3 * 60 * 60 * 1000; // 3 hours (180 minutes) gap if no activity for > 90 mins
    }

    if (timeSinceLastSync >= requiredSyncInterval) {
      let settingsObj = {};
      if (isPg) {
        const res = await pool.query("SELECT * FROM settings");
        (res.rows || []).forEach(r => { settingsObj[r.key] = r.value; });
      } else {
        settingsObj = memoryDb.settings || {};
      }

      const autoSyncEnabled = settingsObj.googleSheetAutoSyncEnabled === "true" || settingsObj.googleSheetAutoSyncEnabled === true;
      if (autoSyncEnabled && settingsObj.googleSheetWebhookUrl) {
        console.log(`[Google Sheets Adaptive Engine] Executing sync (Interval: ${requiredSyncInterval / 60000}m, Time since last sync: ${(timeSinceLastSync / 60000).toFixed(1)}m)...`);
        const result = await performGoogleSheetSync();
        if (result.success) {
          lastGoogleSheetSyncTime = Date.now();
          isOrderDataDirty = false;
        }
      }
    }
  } catch (err) {
    console.error("Adaptive Google Sheets sync engine error:", err.message);
  }
}, 15 * 1000);

// Endpoint POST /api/google-sheets/sync (Manual instant sync)
app.post("/api/google-sheets/sync", async (req, res) => {
  const result = await performGoogleSheetSync();
  if (result.success) {
    lastGoogleSheetSyncTime = Date.now();
    isOrderDataDirty = false;
  }
  return res.json(result);
});

async function performGoogleSheetSync() {
  try {
    let settingsObj = {};
    if (isPg) {
      const res = await pool.query("SELECT * FROM settings");
      (res.rows || []).forEach(r => { settingsObj[r.key] = r.value; });
    } else {
      settingsObj = memoryDb.settings || {};
    }

    const webhookUrl = settingsObj.googleSheetWebhookUrl;
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      return { success: false, error: "No valid Google Sheets Webhook URL configured. Please paste your Google Apps Script Webhook URL in Admin Settings." };
    }

    const rows = await formatAllRequestsForGoogleSheets();
    const payload = {
      timestamp: new Date().toISOString(),
      rowCount: rows.length,
      rows
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    if (isPg) {
      await pool.query(`
        INSERT INTO settings ("key", "value") VALUES ('lastGoogleSheetSyncTime', $1)
        ON CONFLICT ("key") DO UPDATE SET "value" = $1
      `, [nowStr]);
    } else {
      if (!memoryDb.settings) memoryDb.settings = {};
      memoryDb.settings.lastGoogleSheetSyncTime = nowStr;
    }

    recordAuthAuditLog("system", "System Auto-Sync", "system", "Google Sheets Sync", `Synced ${rows.length} rows to Google Sheets`);

    return { success: true, count: rows.length, syncedAt: nowStr };
  } catch (err) {
    console.error("Google Sheets sync execution error:", err);
    return { success: false, error: err.message };
  }
}

// ==================== STORAGE METRICS & FILE EXPLORER API ====================

// GET /api/storage/metrics - Live PostgreSQL DB & Cloudinary Storage Stats
app.get("/api/storage/metrics", async (req, res) => {
  try {
    let pgStats = { sizeStr: "0 MB", bytes: 0, rowsCount: 0 };
    let cloudinaryStats = { usageBytes: 0, usageStr: "0 MB", totalAssets: 0 };

    if (isPg) {
      try {
        const sizeRes = await pool.query("SELECT pg_database_size(current_database()) as bytes, pg_size_pretty(pg_database_size(current_database())) as size_str");
        if (sizeRes.rows.length > 0) {
          pgStats.bytes = parseInt(sizeRes.rows[0].bytes) || 0;
          pgStats.sizeStr = sizeRes.rows[0].size_str || "0 MB";
        }
        const countRes = await pool.query("SELECT (SELECT count(*) FROM requests) + (SELECT count(*) FROM cargos) + (SELECT count(*) FROM users) + (SELECT count(*) FROM vendors) as total_rows");
        pgStats.rowsCount = parseInt(countRes.rows[0]?.total_rows) || 0;

        const photoCountRes = await pool.query(`
          SELECT 
            (SELECT count(*) FROM requests WHERE photo IS NOT NULL AND photo != '') +
            (SELECT count(*) FROM settings WHERE key LIKE 'photo_%' AND value IS NOT NULL AND value != '') as total_count
        `);
        cloudinaryStats.totalAssets = parseInt(photoCountRes.rows[0]?.total_count) || 0;
        cloudinaryStats.usageStr = `${(cloudinaryStats.totalAssets * 0.25).toFixed(1)} MB`;
      } catch (dbErr) {
        console.error("PostgreSQL size query error:", dbErr.message);
      }
    } else {
      const jsonStr = JSON.stringify(memoryDb);
      const b = Buffer.byteLength(jsonStr, "utf8");
      pgStats.bytes = b;
      pgStats.sizeStr = `${(b / (1024 * 1024)).toFixed(2)} MB`;
      pgStats.rowsCount = (memoryDb.requests?.length || 0) + (memoryDb.cargos?.length || 0);

      const reqPhotos = (memoryDb.requests || []).filter(r => r.photo && r.photo.trim() !== "");
      const settingPhotos = Object.entries(memoryDb.settings || {}).filter(([k, v]) => k.startsWith("photo_") && v && v.trim() !== "");
      cloudinaryStats.totalAssets = reqPhotos.length + settingPhotos.length;
      cloudinaryStats.usageStr = `${(cloudinaryStats.totalAssets * 0.25).toFixed(1)} MB`;
    }

    try {
      const usage = await cloudinary.api.usage();
      if (usage && usage.resources) {
        cloudinaryStats.totalAssets = Math.max(cloudinaryStats.totalAssets, usage.resources);
        cloudinaryStats.usageStr = `${((usage.storage?.usage || 0) / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch (cErr) {
      // Graceful fallback to database photo count
    }

    res.json({
      success: true,
      postgres: pgStats,
      cloudinary: cloudinaryStats
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch storage metrics.", details: err.message });
  }
});

// GET /api/storage/files - Browse folders & assets in Database / Cloudinary Storage
app.get("/api/storage/files", async (req, res) => {
  try {
    const folder = req.query.folder || "";
    let folders = [{ name: "product_photos", path: "product_photos" }];
    let files = [];

    // 1. Query all photos stored in the database requests table
    let requests = [];
    if (isPg) {
      const rRes = await pool.query("SELECT id, model, photo FROM requests WHERE photo IS NOT NULL AND photo != ''");
      requests = rRes.rows || [];
    } else {
      requests = (memoryDb.requests || []).filter(r => r.photo && r.photo.trim() !== "");
    }

    files = requests.map((r, idx) => {
      const isCloudinary = r.photo.includes("cloudinary.com");
      const isDataUri = r.photo.startsWith("data:");
      const sizeEstimate = isDataUri ? `${(r.photo.length / 1024).toFixed(1)} KB` : "120 KB";

      return {
        public_id: r.id,
        name: r.model ? `${r.model} (Order #${r.id})` : `Product Photo ${idx + 1}`,
        url: r.photo,
        format: isDataUri ? "png" : "jpg",
        sizeStr: sizeEstimate,
        storageType: isCloudinary ? "Cloudinary CDN" : (isDataUri ? "Base64 DB" : "HTTPS URL")
      };
    });

    // 2. Query all item model photos stored in settings table (key LIKE 'photo_%')
    let photoSettings = [];
    if (isPg) {
      const sRes = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'photo_%' AND value IS NOT NULL AND value != ''");
      photoSettings = sRes.rows || [];
    } else {
      const settingsObj = memoryDb.settings || {};
      photoSettings = Object.entries(settingsObj)
        .filter(([k, v]) => k.startsWith("photo_") && v && v.trim() !== "")
        .map(([key, value]) => ({ key, value }));
    }

    photoSettings.forEach(s => {
      const rawModel = s.key.replace(/^photo_/, "");
      const modelName = rawModel.toUpperCase();
      const photoUrl = s.value;
      const isCloudinary = photoUrl.includes("cloudinary.com");
      const isDataUri = photoUrl.startsWith("data:");
      const sizeEstimate = isDataUri ? `${(photoUrl.length / 1024).toFixed(1)} KB` : "120 KB";

      if (!files.some(f => f.url === photoUrl || f.public_id === s.key)) {
        files.push({
          public_id: s.key,
          name: `${modelName} (Item Catalog Photo)`,
          url: photoUrl,
          format: isDataUri ? "png" : "jpg",
          sizeStr: sizeEstimate,
          storageType: isCloudinary ? "Cloudinary CDN" : (isDataUri ? "Base64 DB" : "HTTPS URL")
        });
      }
    });

    // 3. Query Cloudinary API resources if configured
    try {
      const resourceRes = await cloudinary.api.resources({ max_results: 500, resource_type: "image" });
      const cFiles = (resourceRes.resources || []).map(r => ({
        public_id: r.public_id,
        name: r.public_id.split("/").pop(),
        url: r.secure_url,
        format: r.format,
        sizeBytes: r.bytes,
        sizeStr: `${(r.bytes / 1024).toFixed(1)} KB`,
        storageType: "Cloudinary CDN"
      }));

      cFiles.forEach(cf => {
        if (!files.some(f => f.url === cf.url || f.public_id === cf.public_id)) {
          files.push(cf);
        }
      });
    } catch (cErr) {
      // Fallback gracefully
    }

    res.json({
      success: true,
      currentFolder: folder || "product_photos",
      folders,
      files
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list files.", details: err.message });
  }
});

// POST /api/storage/delete - Delete a single asset file
app.post("/api/storage/delete", async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ error: "public_id is required" });

    try {
      await cloudinary.uploader.destroy(public_id);
    } catch (e) {
      console.warn("Cloudinary destroy warning:", e.message);
    }

    if (isPg) {
      await pool.query('UPDATE requests SET "photo" = \'\' WHERE "photo" LIKE $1 OR "id" = $2', [`%${public_id}%`, public_id]);
      await pool.query('DELETE FROM settings WHERE "key" = $1 OR "value" LIKE $2', [public_id, `%${public_id}%`]);
    } else {
      (memoryDb.requests || []).forEach(r => {
        if (r.id === public_id || (r.photo && r.photo.includes(public_id))) {
          r.photo = "";
        }
      });
      if (memoryDb.settings) {
        Object.keys(memoryDb.settings).forEach(k => {
          if (k === public_id || (k.startsWith("photo_") && memoryDb.settings[k]?.includes(public_id))) {
            delete memoryDb.settings[k];
          }
        });
      }
      writeLocalJson(memoryDb);
    }

    recordAuthAuditLog("admin", "File Manager", "admin", "Delete File", `Deleted storage asset: ${public_id}`);

    res.json({ success: true, message: `Deleted asset ${public_id}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file.", details: err.message });
  }
});

// POST /api/storage/delete-all-cloudinary - Delete ALL assets from Cloudinary itself & clear Cloudinary links in DB
app.post("/api/storage/delete-all-cloudinary", async (req, res) => {
  try {
    let deletedCount = 0;

    // 1. Bulk delete image resources from Cloudinary CDN
    try {
      const deleteRes = await cloudinary.api.delete_all_resources({ resource_type: "image" });
      if (deleteRes && deleteRes.deleted) {
        deletedCount = Object.keys(deleteRes.deleted).length;
      }
    } catch (cErr) {
      console.warn("Cloudinary delete_all_resources API warning, trying fallback by list:", cErr.message);
      try {
        const resourceRes = await cloudinary.api.resources({ max_results: 500, resource_type: "image" });
        const publicIds = (resourceRes.resources || []).map(r => r.public_id);
        if (publicIds.length > 0) {
          await cloudinary.api.delete_resources(publicIds);
          deletedCount = publicIds.length;
        }
      } catch (e) {
        console.error("Cloudinary fallback bulk delete error:", e.message);
      }
    }

    // 2. Clear all Cloudinary photo URLs in database requests table and settings table
    if (isPg) {
      await pool.query(`UPDATE requests SET "photo" = '' WHERE "photo" LIKE '%cloudinary.com%'`);
      await pool.query(`DELETE FROM settings WHERE "key" LIKE 'photo_%' AND "value" LIKE '%cloudinary.com%'`);
    } else {
      (memoryDb.requests || []).forEach(r => {
        if (r.photo && r.photo.includes("cloudinary.com")) {
          r.photo = "";
        }
      });
      if (memoryDb.settings) {
        Object.keys(memoryDb.settings).forEach(k => {
          if (k.startsWith("photo_") && memoryDb.settings[k]?.includes("cloudinary.com")) {
            delete memoryDb.settings[k];
          }
        });
      }
      writeLocalJson(memoryDb);
    }

    recordAuthAuditLog("admin", "File Manager", "admin", "Purge Cloudinary", `Deleted all images from Cloudinary storage (${deletedCount} assets deleted)`);

    return res.json({
      success: true,
      deletedCount,
      message: `Successfully deleted all image assets from Cloudinary itself.`
    });
  } catch (err) {
    console.error("Delete all Cloudinary error:", err);
    return res.status(500).json({ error: "Failed to delete all Cloudinary images.", details: err.message });
  }
});


// 1. GET /api/state - Fetches full system state with concurrent DB queries & memory cache
app.get("/api/state", async (req, res) => {
  const { userId, userRole, userName } = req.query;
  const isCrmRole = userRole === "crm";
  const isAsmTsmRole = userRole === "asm" || userRole === "tsm";
  const isRestrictedRole = isCrmRole || isAsmTsmRole;

  const now = Date.now();
  if (!isRestrictedRole && stateCache && (now - stateCacheTimestamp < STATE_CACHE_TTL_MS)) {
    return res.json(stateCache);
  }

  // Calculate 3-month cutoff date for ASM/TSM (e.g. 1st day of month 2 months ago -> 3 months total)
  const d3MonthsAgo = new Date();
  d3MonthsAgo.setMonth(d3MonthsAgo.getMonth() - 2, 1);
  const cutoffDate3Mo = d3MonthsAgo.toISOString().slice(0, 10);

  if (isPg) {
    try {
      let crmPartiesQuery = 'SELECT * FROM crm_parties ORDER BY "name" ASC';
      let crmPartiesParams = [];

      if (isRestrictedRole && (userId || userName)) {
        const cleanName = (userName || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
        if (isCrmRole) {
          crmPartiesQuery = `
            SELECT * FROM crm_parties 
            WHERE ($1 <> '' AND "assignedCrmId" = $1) 
               OR ($2 <> '' AND TRIM(COALESCE("assignedCrmName", '')) <> '' AND (
                     LOWER(TRIM("assignedCrmName")) LIKE '%' || $2 || '%' 
                  OR $2 LIKE '%' || LOWER(TRIM("assignedCrmName")) || '%'
               ))
            ORDER BY "name" ASC
          `;
        } else {
          crmPartiesQuery = `
            SELECT * FROM crm_parties 
            WHERE ($1 <> '' AND ("assignedAsmId" = $1 OR "assignedTsmId" = $1))
               OR ($2 <> '' AND TRIM(COALESCE("assignedAsmName", '')) <> '' AND (
                     LOWER(TRIM("assignedAsmName")) LIKE '%' || $2 || '%' 
                  OR $2 LIKE '%' || LOWER(TRIM("assignedAsmName")) || '%'
               ))
               OR ($2 <> '' AND TRIM(COALESCE("assignedTsmName", '')) <> '' AND (
                     LOWER(TRIM("assignedTsmName")) LIKE '%' || $2 || '%' 
                  OR $2 LIKE '%' || LOWER(TRIM("assignedTsmName")) || '%'
               ))
            ORDER BY "name" ASC
          `;
        }
        crmPartiesParams = [userId || "", cleanName];
      }

      const [
        usersRes,
        vendorsRes,
        cargoCompaniesRes,
        cargosRes,
        requestsRes,
        settingsRes,
        itemsRes,
        crmPartiesRes,
        designationsRes,
        itemPricesRes
      ] = await Promise.all([
        pool.query("SELECT * FROM users"),
        pool.query("SELECT * FROM vendors"),
        pool.query("SELECT * FROM cargo_companies"),
        pool.query("SELECT * FROM cargos"),
        pool.query("SELECT * FROM requests"),
        pool.query("SELECT * FROM settings"),
        pool.query("SELECT * FROM items ORDER BY CAST(NULLIF(regexp_replace(\"id\", '\\D', '', 'g'), '') AS INTEGER) ASC, \"id\" ASC"),
        pool.query(crmPartiesQuery, crmPartiesParams),
        pool.query("SELECT * FROM designations"),
        pool.query("SELECT * FROM item_prices ORDER BY \"from\" DESC, \"itemName\" ASC")
      ]);

      const myParties = crmPartiesRes.rows || [];
      let crmSalesOrdersRes = { rows: [] };
      let crmDispatchesRes = { rows: [] };
      let crmPartyRemarksRes = { rows: [] };
      let imsRes = { rows: [] };

      if (isRestrictedRole) {
        if (myParties.length > 0) {
          const partyIds = myParties.map(p => p.id).filter(Boolean);
          const partyNames = myParties.map(p => (p.name || "").trim().toLowerCase()).filter(Boolean);

          const orderQuery = isAsmTsmRole
            ? `SELECT * FROM crm_sales_orders WHERE ("partyId" = ANY($1) OR LOWER(TRIM("partyName")) = ANY($2)) AND ("orderDate" >= $3 OR "orderDate" IS NULL OR "orderDate" = '') ORDER BY "orderDate" DESC`
            : `SELECT * FROM crm_sales_orders WHERE ("partyId" = ANY($1) OR LOWER(TRIM("partyName")) = ANY($2)) ORDER BY "orderDate" DESC`;
          const orderParams = isAsmTsmRole ? [partyIds, partyNames, cutoffDate3Mo] : [partyIds, partyNames];

          const dispatchQuery = isAsmTsmRole
            ? `SELECT * FROM crm_dispatches WHERE ("partyId" = ANY($1) OR LOWER(TRIM("partyName")) = ANY($2)) AND ("dispatchDate" >= $3 OR "dispatchDate" IS NULL OR "dispatchDate" = '') ORDER BY "dispatchDate" DESC`
            : `SELECT * FROM crm_dispatches WHERE ("partyId" = ANY($1) OR LOWER(TRIM("partyName")) = ANY($2)) ORDER BY "dispatchDate" DESC`;
          const dispatchParams = isAsmTsmRole ? [partyIds, partyNames, cutoffDate3Mo] : [partyIds, partyNames];

          const imsPartyQuery = isAsmTsmRole
            ? `SELECT * FROM ims_transactions WHERE ("partyName" IS NOT NULL AND "partyName" <> '') AND ("movementType" = 'OUT' OR "movementType" IS NULL) AND (LOWER(TRIM("partyName")) = ANY($1)) AND ("date" >= $2 OR "date" IS NULL OR "date" = '') ORDER BY "date" DESC LIMIT 500`
            : `SELECT * FROM ims_transactions WHERE ("partyName" IS NOT NULL AND "partyName" <> '') AND ("movementType" = 'OUT' OR "movementType" IS NULL) AND (LOWER(TRIM("partyName")) = ANY($1)) ORDER BY "date" DESC LIMIT 500`;
          const imsPartyParams = isAsmTsmRole ? [partyNames, cutoffDate3Mo] : [partyNames];

          const [ordersRes, dispatchesRes, remarksRes, imsPartyRes] = await Promise.all([
            pool.query(orderQuery, orderParams),
            pool.query(dispatchQuery, dispatchParams),
            pool.query(`
              SELECT * FROM crm_party_remarks 
              WHERE ("partyId" = ANY($1) OR LOWER(TRIM("partyName")) = ANY($2))
              ORDER BY "createdAt" DESC
            `, [partyIds, partyNames]),
            pool.query(imsPartyQuery, imsPartyParams)
          ]);

          crmSalesOrdersRes = ordersRes;
          crmDispatchesRes = dispatchesRes;
          crmPartyRemarksRes = remarksRes;
          imsRes = imsPartyRes;
        }
      } else {
        const [ordersRes, dispatchesRes, remarksRes, allImsRes] = await Promise.all([
          pool.query('SELECT * FROM crm_sales_orders ORDER BY "orderDate" DESC'),
          pool.query('SELECT * FROM crm_dispatches ORDER BY "dispatchDate" DESC'),
          pool.query('SELECT * FROM crm_party_remarks ORDER BY "createdAt" DESC'),
          pool.query(`SELECT * FROM ims_transactions WHERE ("partyName" IS NOT NULL AND "partyName" <> '') ORDER BY "date" DESC LIMIT 1000`)
        ]);
        crmSalesOrdersRes = ordersRes;
        crmDispatchesRes = dispatchesRes;
        crmPartyRemarksRes = remarksRes;
        imsRes = allImsRes;
      }

      // Format types back
      const vendors = vendorsRes.rows.map(v => ({
        ...v,
        purchaserIds: v.purchaserIds ? (typeof v.purchaserIds === "string" ? JSON.parse(v.purchaserIds) : v.purchaserIds) : []
      }));

      const requests = requestsRes.rows.map(r => ({
        ...r,
        orderQuantity: r.orderQuantity ? parseInt(r.orderQuantity) : 0,
        priceRmb: r.priceRmb ? parseFloat(r.priceRmb) : "",
        totalRmb: r.totalRmb ? parseFloat(r.totalRmb) : "",
        advancePayment: r.advancePayment ? parseFloat(r.advancePayment) : "",
        balancePayment: r.balancePayment ? parseFloat(r.balancePayment) : ""
      }));

      const cargos = cargosRes.rows.map(c => ({
        ...c,
        cargoPrice: c.cargoPrice ? parseFloat(c.cargoPrice) : "",
        cbmPackingList: c.cbmPackingList ? parseFloat(c.cbmPackingList) : "",
        totalCargoPrice: c.totalCargoPrice ? parseFloat(c.totalCargoPrice) : ""
      }));

      const settings = {};
      settingsRes.rows.forEach(row => {
        if (row.value === "true") settings[row.key] = true;
        else if (row.value === "false") settings[row.key] = false;
        else settings[row.key] = row.value;
      });
      if (settings.isHidden === undefined) settings.isHidden = false;
      if (!settings.redirectUrl) settings.redirectUrl = "https://www.instagram.com/makpowerofficial/";

      const fullState = {
        users: (usersRes.rows || []).map(u => ({ ...u, status: u.status || "active" })),
        vendors,
        cargoCompanies: cargoCompaniesRes.rows,
        cargos,
        requests,
        settings,
        items: itemsRes.rows || [],
        designations: (designationsRes.rows && designationsRes.rows.length > 0) ? designationsRes.rows : initialDesignations,
        crmParties: myParties,
        crmSalesOrders: (crmSalesOrdersRes.rows || []).map(so => ({
          ...so,
          orderQty: so.orderQty ? parseInt(so.orderQty) : 0,
          unitPriceInr: so.unitPriceInr ? parseFloat(so.unitPriceInr) : 0,
          totalInr: so.totalInr ? parseFloat(so.totalInr) : 0,
          dispatchedQty: so.dispatchedQty ? parseInt(so.dispatchedQty) : 0,
          pendingQty: so.pendingQty != null ? parseInt(so.pendingQty) : 0
        })),
        crmDispatches: (crmDispatchesRes.rows || []).map(d => ({
          ...d,
          dispatchedQty: d.dispatchedQty ? parseInt(d.dispatchedQty) : 0
        })),
        imsTransactions: (imsRes.rows || []).map(row => ({
          ...row,
          stockQty: row.stockQty ? parseInt(row.stockQty) : 0,
          location: row.location || "Delhi",
          isMissingId: !!row.isMissingId
        })),
        itemPrices: (itemPricesRes?.rows || []).map(p => ({
          ...p,
          pp: p.pp ? parseFloat(p.pp) : 0
        })),
        crmPartyRemarks: crmPartyRemarksRes?.rows || []
      };

      if (!isRestrictedRole) {
        stateCache = fullState;
        stateCacheTimestamp = Date.now();
      }

      res.json(fullState);
    } catch (err) {
      console.error("GET /api/state error:", err.message);
      if (stateCache && !isRestrictedRole) {
        return res.json(stateCache);
      }
      res.status(500).json({ error: "Failed to query PG state." });
    }
  } else {
    const data = readLocalJson();
    if (isRestrictedRole && (userId || userName)) {
      const effectiveId = userId || "";
      const cleanName = (userName || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      const myParties = (data.crmParties || []).filter(p => {
        if (isCrmRole) {
          const matchId = effectiveId && (p.assignedCrmId === effectiveId);
          const pCrm = (p.assignedCrmName || "").trim().toLowerCase();
          const matchName = cleanName && pCrm && (pCrm.includes(cleanName) || cleanName.includes(pCrm));
          return matchId || matchName;
        } else {
          const matchId = effectiveId && (p.assignedAsmId === effectiveId || p.assignedTsmId === effectiveId);
          const pAsm = (p.assignedAsmName || "").trim().toLowerCase();
          const pTsm = (p.assignedTsmName || "").trim().toLowerCase();
          const matchName = cleanName && (
            (pAsm && (pAsm.includes(cleanName) || cleanName.includes(pAsm))) ||
            (pTsm && (pTsm.includes(cleanName) || cleanName.includes(pTsm)))
          );
          return matchId || matchName;
        }
      });
      const partyIdSet = new Set(myParties.map(p => p.id));
      const partyNameSet = new Set(myParties.map(p => (p.name || "").trim().toLowerCase()));

      return res.json({
        ...data,
        crmParties: myParties,
        crmSalesOrders: (data.crmSalesOrders || []).filter(o => (partyIdSet.has(o.partyId) || partyNameSet.has((o.partyName || "").trim().toLowerCase())) && (!isAsmTsmRole || !o.orderDate || o.orderDate >= cutoffDate3Mo)),
        crmDispatches: (data.crmDispatches || []).filter(d => (partyIdSet.has(d.partyId) || partyNameSet.has((d.partyName || "").trim().toLowerCase())) && (!isAsmTsmRole || !d.dispatchDate || d.dispatchDate >= cutoffDate3Mo)),
        crmPartyRemarks: (data.crmPartyRemarks || []).filter(r => partyIdSet.has(r.partyId) || partyNameSet.has((r.partyName || "").trim().toLowerCase()))
      });
    }
    res.json(data);
  }
});

// Granular On-Demand Data Pulling Endpoints (Optimized Lazy Loading)

// GET /api/vendors - On-demand Vendor Hub pull
app.get("/api/vendors", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM vendors ORDER BY "name" ASC');
      const vendors = result.rows.map(v => ({
        ...v,
        purchaserIds: v.purchaserIds ? (typeof v.purchaserIds === "string" ? JSON.parse(v.purchaserIds) : v.purchaserIds) : []
      }));
      res.json(vendors);
    } catch (err) {
      console.error("GET /api/vendors error:", err.message);
      res.status(500).json({ error: "Failed to fetch vendors." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.vendors || []);
  }
});

// GET /api/cargo-companies - On-demand Cargo Companies pull
app.get("/api/cargo-companies", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM cargo_companies ORDER BY "name" ASC');
      res.json(result.rows || []);
    } catch (err) {
      console.error("GET /api/cargo-companies error:", err.message);
      res.status(500).json({ error: "Failed to fetch cargo companies." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.cargoCompanies || []);
  }
});

// GET /api/cargos - On-demand Cargo Shipments pull
app.get("/api/cargos", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM cargos ORDER BY "cargoOrderDate" DESC');
      const cargos = result.rows.map(c => ({
        ...c,
        cargoPrice: c.cargoPrice ? parseFloat(c.cargoPrice) : "",
        cbmPackingList: c.cbmPackingList ? parseFloat(c.cbmPackingList) : "",
        totalCargoPrice: c.totalCargoPrice ? parseFloat(c.totalCargoPrice) : ""
      }));
      res.json(cargos);
    } catch (err) {
      console.error("GET /api/cargos error:", err.message);
      res.status(500).json({ error: "Failed to fetch cargos." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.cargos || []);
  }
});

// GET /api/requests - On-demand Purchase Requests pull
app.get("/api/requests", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM requests ORDER BY "orderDate" DESC');
      const requests = result.rows.map(r => ({
        ...r,
        orderQuantity: r.orderQuantity ? parseInt(r.orderQuantity) : 0,
        priceRmb: r.priceRmb ? parseFloat(r.priceRmb) : "",
        totalRmb: r.totalRmb ? parseFloat(r.totalRmb) : "",
        advancePayment: r.advancePayment ? parseFloat(r.advancePayment) : "",
        balancePayment: r.balancePayment ? parseFloat(r.balancePayment) : ""
      }));
      res.json(requests);
    } catch (err) {
      console.error("GET /api/requests error:", err.message);
      res.status(500).json({ error: "Failed to fetch requests." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.requests || []);
  }
});

// GET /api/users - On-demand User Accounts pull
app.get("/api/users", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM users ORDER BY "name" ASC');
      res.json(result.rows.map(u => ({ ...u, status: u.status || "active" })));
    } catch (err) {
      console.error("GET /api/users error:", err.message);
      res.status(500).json({ error: "Failed to fetch users." });
    }
  } else {
    const data = readLocalJson();
    res.json((data.users || []).map(u => ({ ...u, status: u.status || "active" })));
  }
});

// GET /api/designations - On-demand Designations pull
app.get("/api/designations", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query('SELECT * FROM designations ORDER BY "title" ASC');
      res.json((result.rows && result.rows.length > 0) ? result.rows : initialDesignations);
    } catch (err) {
      console.error("GET /api/designations error:", err.message);
      res.json(initialDesignations);
    }
  } else {
    const data = readLocalJson();
    res.json(data.designations || initialDesignations);
  }
});

// GET /api/crm/sales-orders - On-demand CRM Sales Orders pull
app.get("/api/crm/sales-orders", async (req, res) => {
  const { userId, userRole, userName, asmId, tsmId, partyId } = req.query;
  const isRestrictedRole = userRole === "asm" || userRole === "tsm" || !!asmId || !!tsmId;

  if (isPg) {
    try {
      let query = 'SELECT * FROM crm_sales_orders';
      const conditions = [];
      const values = [];
      let idx = 1;

      if (partyId) {
        conditions.push(`"partyId" = $${idx++}`);
        values.push(partyId);
      }

      if (isRestrictedRole) {
        const effectiveId = asmId || tsmId || userId || "";
        const effectiveName = (userName || "").trim().toLowerCase();

        const pRes = await pool.query(`
          SELECT id, name FROM crm_parties 
          WHERE "assignedAsmId" = $1 OR "assignedTsmId" = $1 
             OR ($2 <> '' AND LOWER(TRIM("assignedAsmName")) = $2) 
             OR ($2 <> '' AND LOWER(TRIM("assignedTsmName")) = $2)
        `, [effectiveId, effectiveName]);

        const assignedIds = (pRes.rows || []).map(p => p.id);
        const assignedNames = (pRes.rows || []).map(p => (p.name || "").trim().toLowerCase());

        if (assignedIds.length === 0) {
          return res.json([]);
        }

        conditions.push(`("partyId" = ANY($${idx++}) OR LOWER(TRIM("partyName")) = ANY($${idx++}))`);
        values.push(assignedIds, assignedNames);

        // 3-Month Cutoff
        const d3 = new Date();
        d3.setMonth(d3.getMonth() - 2, 1);
        conditions.push(`("orderDate" >= $${idx++} OR "orderDate" IS NULL OR "orderDate" = '')`);
        values.push(d3.toISOString().slice(0, 10));
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += ' ORDER BY "orderDate" DESC';

      const result = await pool.query(query, values);
      res.json((result.rows || []).map(so => ({
        ...so,
        orderQty: so.orderQty ? parseInt(so.orderQty) : 0,
        unitPriceInr: so.unitPriceInr ? parseFloat(so.unitPriceInr) : 0,
        totalInr: so.totalInr ? parseFloat(so.totalInr) : 0,
        dispatchedQty: so.dispatchedQty ? parseInt(so.dispatchedQty) : 0,
        pendingQty: so.pendingQty != null ? parseInt(so.pendingQty) : 0
      })));
    } catch (err) {
      console.error("GET /api/crm/sales-orders error:", err.message);
      res.status(500).json({ error: "Failed to fetch sales orders." });
    }
  } else {
    const data = readLocalJson();
    let list = data.crmSalesOrders || [];
    if (isRestrictedRole) {
      const effectiveId = asmId || tsmId || userId;
      const effectiveName = (userName || "").trim().toLowerCase();
      const myParties = (data.crmParties || []).filter(p => 
        p.assignedAsmId === effectiveId || p.assignedTsmId === effectiveId || 
        (effectiveName && (p.assignedAsmName?.trim().toLowerCase() === effectiveName || p.assignedTsmName?.trim().toLowerCase() === effectiveName))
      );
      const pIdSet = new Set(myParties.map(p => p.id));
      const pNameSet = new Set(myParties.map(p => (p.name || "").trim().toLowerCase()));

      const d3 = new Date();
      d3.setMonth(d3.getMonth() - 2, 1);
      const cutoff = d3.toISOString().slice(0, 10);

      list = list.filter(o => (pIdSet.has(o.partyId) || pNameSet.has((o.partyName || "").trim().toLowerCase())) && (!o.orderDate || o.orderDate >= cutoff));
    }
    res.json(list);
  }
});

// GET /api/crm/dispatches - On-demand CRM Dispatches pull
app.get("/api/crm/dispatches", async (req, res) => {
  const { userId, userRole, userName, asmId, tsmId, partyId } = req.query;
  const isRestrictedRole = userRole === "asm" || userRole === "tsm" || !!asmId || !!tsmId;

  if (isPg) {
    try {
      let query = 'SELECT * FROM crm_dispatches';
      const conditions = [];
      const values = [];
      let idx = 1;

      if (partyId) {
        conditions.push(`"partyId" = $${idx++}`);
        values.push(partyId);
      }

      if (isRestrictedRole) {
        const effectiveId = asmId || tsmId || userId || "";
        const effectiveName = (userName || "").trim().toLowerCase();

        const pRes = await pool.query(`
          SELECT id, name FROM crm_parties 
          WHERE "assignedAsmId" = $1 OR "assignedTsmId" = $1 
             OR ($2 <> '' AND LOWER(TRIM("assignedAsmName")) = $2) 
             OR ($2 <> '' AND LOWER(TRIM("assignedTsmName")) = $2)
        `, [effectiveId, effectiveName]);

        const assignedIds = (pRes.rows || []).map(p => p.id);
        const assignedNames = (pRes.rows || []).map(p => (p.name || "").trim().toLowerCase());

        if (assignedIds.length === 0) {
          return res.json([]);
        }

        conditions.push(`("partyId" = ANY($${idx++}) OR LOWER(TRIM("partyName")) = ANY($${idx++}))`);
        values.push(assignedIds, assignedNames);

        // 3-Month Cutoff
        const d3 = new Date();
        d3.setMonth(d3.getMonth() - 2, 1);
        conditions.push(`("dispatchDate" >= $${idx++} OR "dispatchDate" IS NULL OR "dispatchDate" = '')`);
        values.push(d3.toISOString().slice(0, 10));
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += ' ORDER BY "dispatchDate" DESC';

      const result = await pool.query(query, values);
      res.json((result.rows || []).map(d => ({
        ...d,
        dispatchedQty: d.dispatchedQty ? parseInt(d.dispatchedQty) : 0
      })));
    } catch (err) {
      console.error("GET /api/crm/dispatches error:", err.message);
      res.status(500).json({ error: "Failed to fetch dispatches." });
    }
  } else {
    const data = readLocalJson();
    let list = data.crmDispatches || [];
    if (isRestrictedRole) {
      const effectiveId = asmId || tsmId || userId;
      const effectiveName = (userName || "").trim().toLowerCase();
      const myParties = (data.crmParties || []).filter(p => 
        p.assignedAsmId === effectiveId || p.assignedTsmId === effectiveId || 
        (effectiveName && (p.assignedAsmName?.trim().toLowerCase() === effectiveName || p.assignedTsmName?.trim().toLowerCase() === effectiveName))
      );
      const pIdSet = new Set(myParties.map(p => p.id));
      const pNameSet = new Set(myParties.map(p => (p.name || "").trim().toLowerCase()));

      const d3 = new Date();
      d3.setMonth(d3.getMonth() - 2, 1);
      const cutoff = d3.toISOString().slice(0, 10);

      list = list.filter(d => (pIdSet.has(d.partyId) || pNameSet.has((d.partyName || "").trim().toLowerCase())) && (!d.dispatchDate || d.dispatchDate >= cutoff));
    }
    res.json(list);
  }
});

// 2. POST /api/requests - Adds or Updates requests
app.post("/api/requests", async (req, res) => {
  const r = req.body;
  isOrderDataDirty = true;
  if (isPg) {
    try {
      const query = `
        INSERT INTO requests (
          "id", "purchaserId", "vendorId", "orderDate", "type", "model", "orderQuantity",
          "priceRmb", "totalRmb", "advancePayment", "balancePayment", "photo", "vendorEdd",
          "cargoId", "isMaterialRec", "actualReceivedDate", "notes", "itemNature", "category",
          "requiredByDate", "entryBy", "packingOrderedByNitin", "purchaseUpdated", "status",
            "cancellationReason", "cancelledAt", "cargoAssignedAt",
            "vendorOrderQuantity", "cargoPickedQty", "receivedQuantity", "shortageQty", "parentRequestId", "vendorReadyDate", "currency"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
          ON CONFLICT ("id") DO UPDATE SET
            "purchaserId" = EXCLUDED."purchaserId",
            "vendorId" = EXCLUDED."vendorId",
            "orderDate" = EXCLUDED."orderDate",
            "type" = EXCLUDED."type",
            "model" = EXCLUDED."model",
            "orderQuantity" = EXCLUDED."orderQuantity",
            "priceRmb" = EXCLUDED."priceRmb",
            "totalRmb" = EXCLUDED."totalRmb",
            "advancePayment" = EXCLUDED."advancePayment",
            "balancePayment" = EXCLUDED."balancePayment",
            "photo" = EXCLUDED."photo",
            "vendorEdd" = EXCLUDED."vendorEdd",
            "cargoId" = EXCLUDED."cargoId",
            "isMaterialRec" = EXCLUDED."isMaterialRec",
            "actualReceivedDate" = EXCLUDED."actualReceivedDate",
            "notes" = EXCLUDED."notes",
            "itemNature" = EXCLUDED."itemNature",
            "category" = EXCLUDED."category",
            "requiredByDate" = EXCLUDED."requiredByDate",
            "entryBy" = EXCLUDED."entryBy",
            "packingOrderedByNitin" = EXCLUDED."packingOrderedByNitin",
            "purchaseUpdated" = EXCLUDED."purchaseUpdated",
            "status" = EXCLUDED."status",
            "cancellationReason" = EXCLUDED."cancellationReason",
            "cancelledAt" = EXCLUDED."cancelledAt",
            "cargoAssignedAt" = EXCLUDED."cargoAssignedAt",
            "vendorOrderQuantity" = EXCLUDED."vendorOrderQuantity",
            "cargoPickedQty" = EXCLUDED."cargoPickedQty",
            "receivedQuantity" = EXCLUDED."receivedQuantity",
            "shortageQty" = EXCLUDED."shortageQty",
            "parentRequestId" = EXCLUDED."parentRequestId",
            "vendorReadyDate" = EXCLUDED."vendorReadyDate",
            "currency" = EXCLUDED."currency"
        `;
        const values = [
          r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, parseInt(r.orderQuantity || 0),
          r.priceRmb === "" ? null : parseFloat(r.priceRmb), r.totalRmb === "" ? null : parseFloat(r.totalRmb),
          r.advancePayment === "" ? null : parseFloat(r.advancePayment), r.balancePayment === "" ? null : parseFloat(r.balancePayment),
          r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No", r.actualReceivedDate || "",
          r.notes || "", r.itemNature || "Non Consumables", r.category || "", r.requiredByDate || "", r.entryBy || "",
          r.packingOrderedByNitin || "No", r.purchaseUpdated || "No", r.status || "Active",
          r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || "",
          r.vendorOrderQuantity != null ? parseInt(r.vendorOrderQuantity) : null,
          r.cargoPickedQty != null ? parseInt(r.cargoPickedQty) : null,
          r.receivedQuantity != null ? parseInt(r.receivedQuantity) : null,
          r.shortageQty != null ? parseInt(r.shortageQty) : null,
          r.parentRequestId || "",
          r.vendorReadyDate || "",
          r.currency || "RMB"
        ];
        await pool.query(query, values);
        markAppActivity();
        res.json({ success: true });
    } catch (err) {
      console.error("POST /api/requests error:", err.message);
      res.status(500).json({ error: "Failed to upsert request." });
    }
  } else {
    const data = readLocalJson();
    const index = data.requests.findIndex(x => x.id === r.id);
    if (index !== -1) {
      data.requests[index] = r;
    } else {
      data.requests.unshift(r); // Add to top
    }
    writeLocalJson(data);
    markAppActivity();
    res.json({ success: true });
  }
});

// 3. POST /api/requests/batch - Batch inserts/updates requests
app.post("/api/requests/batch", async (req, res) => {
  const reqs = req.body; // Array
  if (!Array.isArray(reqs)) {
    return res.status(400).json({ error: "Body must be an array." });
  }

  if (isPg) {
    try {
      await pool.query("BEGIN");
      for (const r of reqs) {
        const query = `
          INSERT INTO requests (
            "id", "purchaserId", "vendorId", "orderDate", "type", "model", "orderQuantity",
            "priceRmb", "totalRmb", "advancePayment", "balancePayment", "photo", "vendorEdd",
            "cargoId", "isMaterialRec", "actualReceivedDate", "notes", "itemNature", "category",
            "requiredByDate", "entryBy", "packingOrderedByNitin", "purchaseUpdated", "status",
            "cancellationReason", "cancelledAt", "cargoAssignedAt",
            "vendorOrderQuantity", "cargoPickedQty", "receivedQuantity", "shortageQty", "parentRequestId", "vendorReadyDate", "currency"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
          ON CONFLICT ("id") DO UPDATE SET
            "purchaserId" = EXCLUDED."purchaserId",
            "vendorId" = EXCLUDED."vendorId",
            "orderDate" = EXCLUDED."orderDate",
            "type" = EXCLUDED."type",
            "model" = EXCLUDED."model",
            "orderQuantity" = EXCLUDED."orderQuantity",
            "priceRmb" = EXCLUDED."priceRmb",
            "totalRmb" = EXCLUDED."totalRmb",
            "advancePayment" = EXCLUDED."advancePayment",
            "balancePayment" = EXCLUDED."balancePayment",
            "photo" = EXCLUDED."photo",
            "vendorEdd" = EXCLUDED."vendorEdd",
            "cargoId" = EXCLUDED."cargoId",
            "isMaterialRec" = EXCLUDED."isMaterialRec",
            "actualReceivedDate" = EXCLUDED."actualReceivedDate",
            "notes" = EXCLUDED."notes",
            "itemNature" = EXCLUDED."itemNature",
            "category" = EXCLUDED."category",
            "requiredByDate" = EXCLUDED."requiredByDate",
            "entryBy" = EXCLUDED."entryBy",
            "packingOrderedByNitin" = EXCLUDED."packingOrderedByNitin",
            "purchaseUpdated" = EXCLUDED."purchaseUpdated",
            "status" = EXCLUDED."status",
            "cancellationReason" = EXCLUDED."cancellationReason",
            "cancelledAt" = EXCLUDED."cancelledAt",
            "cargoAssignedAt" = EXCLUDED."cargoAssignedAt",
            "vendorOrderQuantity" = EXCLUDED."vendorOrderQuantity",
            "cargoPickedQty" = EXCLUDED."cargoPickedQty",
            "receivedQuantity" = EXCLUDED."receivedQuantity",
            "shortageQty" = EXCLUDED."shortageQty",
            "parentRequestId" = EXCLUDED."parentRequestId",
            "vendorReadyDate" = EXCLUDED."vendorReadyDate",
            "currency" = EXCLUDED."currency"
        `;
        const values = [
          r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, parseInt(r.orderQuantity || 0),
          r.priceRmb === "" ? null : parseFloat(r.priceRmb), r.totalRmb === "" ? null : parseFloat(r.totalRmb),
          r.advancePayment === "" ? null : parseFloat(r.advancePayment), r.balancePayment === "" ? null : parseFloat(r.balancePayment),
          r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No", r.actualReceivedDate || "",
          r.notes || "", r.itemNature || "Non Consumables", r.category || "", r.requiredByDate || "", r.entryBy || "",
          r.packingOrderedByNitin || "No", r.purchaseUpdated || "No", r.status || "Active",
          r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || "",
          r.vendorOrderQuantity != null ? parseInt(r.vendorOrderQuantity) : null,
          r.cargoPickedQty != null ? parseInt(r.cargoPickedQty) : null,
          r.receivedQuantity != null ? parseInt(r.receivedQuantity) : null,
          r.shortageQty != null ? parseInt(r.shortageQty) : null,
          r.parentRequestId || "",
          r.vendorReadyDate || "",
          r.currency || "RMB"
        ];
        await pool.query(query, values);
      }
      await pool.query("COMMIT");
      markAppActivity();
      res.json({ success: true });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("POST /api/requests/batch error:", err.message);
      res.status(500).json({ error: "Failed to batch upsert requests." });
    }
  } else {
    const data = readLocalJson();
    reqs.forEach(r => {
      const idx = data.requests.findIndex(x => x.id === r.id);
      if (idx !== -1) {
        data.requests[idx] = r;
      } else {
        data.requests.unshift(r);
      }
    });
    writeLocalJson(data);
    markAppActivity();
    res.json({ success: true });
  }
});

// 4. POST /api/cargos - Upserts cargo shipments
app.post("/api/cargos", async (req, res) => {
  const c = req.body;
  if (isPg) {
    try {
      const query = `
        INSERT INTO cargos (
          "id", "vendorId", "cargoOrderDate", "cargoDetail", "cargoPrice", "cargoPriceUom",
          "cbmPackingList", "totalCargoPrice", "modeOfTransport", "cargoShippingDate", "cargoEta",
          "packingListFile", "invoiceFile", "isMaterialRec", "receivedDate", "currency"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT ("id") DO UPDATE SET
          "vendorId" = EXCLUDED."vendorId",
          "cargoOrderDate" = EXCLUDED."cargoOrderDate",
          "cargoDetail" = EXCLUDED."cargoDetail",
          "cargoPrice" = EXCLUDED."cargoPrice",
          "cargoPriceUom" = EXCLUDED."cargoPriceUom",
          "cbmPackingList" = EXCLUDED."cbmPackingList",
          "totalCargoPrice" = EXCLUDED."totalCargoPrice",
          "modeOfTransport" = EXCLUDED."modeOfTransport",
          "cargoShippingDate" = EXCLUDED."cargoShippingDate",
          "cargoEta" = EXCLUDED."cargoEta",
          "packingListFile" = EXCLUDED."packingListFile",
          "invoiceFile" = EXCLUDED."invoiceFile",
          "isMaterialRec" = EXCLUDED."isMaterialRec",
          "receivedDate" = EXCLUDED."receivedDate",
          "currency" = EXCLUDED."currency"
      `;
      const values = [
        c.id, c.vendorId, c.cargoOrderDate, c.cargoDetail,
        c.cargoPrice === "" ? null : parseFloat(c.cargoPrice), c.cargoPriceUom || "",
        c.cbmPackingList === "" ? null : parseFloat(c.cbmPackingList),
        c.totalCargoPrice === "" ? null : parseFloat(c.totalCargoPrice),
        c.modeOfTransport || "", c.cargoShippingDate || "", c.cargoEta || "",
        c.packingListFile || "", c.invoiceFile || "", c.isMaterialRec || "No", c.receivedDate || "", c.currency || "RMB"
      ];
      await pool.query(query, values);
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/cargos error:", err.message);
      res.status(500).json({ error: "Failed to upsert cargo." });
    }
  } else {
    const data = readLocalJson();
    const index = data.cargos.findIndex(x => x.id === c.id);
    if (index !== -1) {
      data.cargos[index] = c;
    } else {
      data.cargos.unshift(c);
    }
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 5. POST /api/vendors - Upserts vendors
app.post("/api/vendors", async (req, res) => {
  const v = req.body;
  if (isPg) {
    try {
      const query = `
        INSERT INTO vendors ("id", "name", "location", "phone", "history", "status", "purchaserIds")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "location" = EXCLUDED."location",
          "phone" = EXCLUDED."phone",
          "history" = EXCLUDED."history",
          "status" = EXCLUDED."status",
          "purchaserIds" = EXCLUDED."purchaserIds"
      `;
      await pool.query(query, [
        v.id, v.name, v.location, v.phone, v.history, v.status, JSON.stringify(v.purchaserIds || [])
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/vendors error:", err.message);
      res.status(500).json({ error: "Failed to upsert vendor." });
    }
  } else {
    const data = readLocalJson();
    const index = data.vendors.findIndex(x => x.id === v.id);
    if (index !== -1) {
      data.vendors[index] = v;
    } else {
      data.vendors.unshift(v);
    }
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 6. POST /api/cargo-companies - Upserts cargo carriers
app.post("/api/cargo-companies", async (req, res) => {
  const cc = req.body;
  if (isPg) {
    try {
      const query = `
        INSERT INTO cargo_companies ("id", "name", "location", "phone", "history", "status")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "location" = EXCLUDED."location",
          "phone" = EXCLUDED."phone",
          "history" = EXCLUDED."history",
          "status" = EXCLUDED."status"
      `;
      await pool.query(query, [cc.id, cc.name, cc.location, cc.phone, cc.history, cc.status]);
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/cargo-companies error:", err.message);
      res.status(500).json({ error: "Failed to upsert cargo company." });
    }
  } else {
    const data = readLocalJson();
    const index = data.cargoCompanies.findIndex(x => x.id === cc.id);
    if (index !== -1) {
      data.cargoCompanies[index] = cc;
    } else {
      data.cargoCompanies.unshift(cc);
    }
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 7. POST /api/users - Adds purchasers or staff users
app.post("/api/users", async (req, res) => {
  const u = req.body;
  if (isPg) {
    try {
      await pool.query(
        `INSERT INTO users ("id", "name", "email", "password", "role", "designation", "status") VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "email" = EXCLUDED."email", "password" = EXCLUDED."password", "role" = EXCLUDED."role", "designation" = EXCLUDED."designation", "status" = EXCLUDED."status"`,
        [u.id, u.name, u.email, u.password, u.role, u.designation || "Purchaser", u.status]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/users error:", err.message);
      res.status(500).json({ error: "Failed to upsert user." });
    }
  } else {
    const data = readLocalJson();
    const index = data.users.findIndex(x => x.id === u.id);
    if (index !== -1) {
      data.users[index] = u;
    } else {
      data.users.push(u);
    }
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 8. POST /api/users/update - Modifies name/password of any user
app.post("/api/users/update", async (req, res) => {
  const { id, updates } = req.body;
  if (isPg) {
    try {
      const setClauses = [];
      const values = [];
      let idx = 1;

      Object.entries(updates).forEach(([key, val]) => {
        setClauses.push(`"${key}" = $${idx}`);
        values.push(val);
        idx++;
      });

      values.push(id);
      const query = `UPDATE users SET ${setClauses.join(", ")} WHERE "id" = $${idx}`;
      await pool.query(query, values);
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/users/update error:", err.message);
      res.status(500).json({ error: "Failed to update user." });
    }
  } else {
    const data = readLocalJson();
    const index = data.users.findIndex(x => x.id === id);
    if (index !== -1) {
      data.users[index] = { ...data.users[index], ...updates };
      writeLocalJson(data);
    }
    res.json({ success: true });
  }
});

// ==================== CRM SYSTEM API ENDPOINTS ====================

// 1. GET /api/crm/parties - Retrieve CRM Parties
app.get("/api/crm/parties", async (req, res) => {
  const { crmId, asmId, tsmId, userId, userRole, userName } = req.query;
  const isRestrictedRole = userRole === "asm" || userRole === "tsm" || !!asmId || !!tsmId;

  if (isPg) {
    try {
      let query = "SELECT * FROM crm_parties";
      const conditions = [];
      const values = [];
      let idx = 1;

      if (crmId) {
        conditions.push(`"assignedCrmId" = $${idx++}`);
        values.push(crmId);
      }
      if (isRestrictedRole) {
        const effectiveId = asmId || tsmId || userId || "";
        const cleanName = (userName || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
        conditions.push(`(
          ($${idx} <> '' AND ("assignedAsmId" = $${idx} OR "assignedTsmId" = $${idx}))
          OR ($${idx + 1} <> '' AND TRIM(COALESCE("assignedAsmName", '')) <> '' AND (
                LOWER(TRIM("assignedAsmName")) LIKE '%' || $${idx + 1} || '%' 
             OR $${idx + 1} LIKE '%' || LOWER(TRIM("assignedAsmName")) || '%'
          ))
          OR ($${idx + 1} <> '' AND TRIM(COALESCE("assignedTsmName", '')) <> '' AND (
                LOWER(TRIM("assignedTsmName")) LIKE '%' || $${idx + 1} || '%' 
             OR $${idx + 1} LIKE '%' || LOWER(TRIM("assignedTsmName")) || '%'
          ))
        )`);
        values.push(effectiveId, cleanName);
        idx += 2;
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY \"name\" ASC";

      const result = await pool.query(query, values);
      res.json({ success: true, parties: result.rows });
    } catch (err) {
      console.error("GET /api/crm/parties error:", err.message);
      res.status(500).json({ error: "Failed to fetch CRM parties." });
    }
  } else {
    const data = readLocalJson();
    let list = data.crmParties || [];
    if (crmId) list = list.filter(p => p.assignedCrmId === crmId);
    if (isRestrictedRole) {
      const effectiveId = asmId || tsmId || userId || "";
      const cleanName = (userName || "").replace(/\s*\((ASM|TSM|CRM|OWNER|ADMIN)\)/gi, "").trim().toLowerCase();
      list = list.filter(p => {
        const matchId = effectiveId && (p.assignedAsmId === effectiveId || p.assignedTsmId === effectiveId);
        const pAsm = (p.assignedAsmName || "").trim().toLowerCase();
        const pTsm = (p.assignedTsmName || "").trim().toLowerCase();
        const matchName = cleanName && (
          (pAsm && (pAsm.includes(cleanName) || cleanName.includes(pAsm))) ||
          (pTsm && (pTsm.includes(cleanName) || cleanName.includes(pTsm)))
        );
        return matchId || matchName;
      });
    }
    res.json({ success: true, parties: list });
  }
});

// 2. POST /api/crm/parties - Create or Update CRM Party
app.post("/api/crm/parties", async (req, res) => {
  const p = req.body;
  if (!p || !p.name) {
    return res.status(400).json({ error: "Party name is required." });
  }

  const partyObj = {
    id: p.id || `pty-${Date.now()}`,
    name: (p.name || "").trim(),
    contactPerson: (p.contactPerson || "").trim(),
    phone: (p.phone || "").trim(),
    email: (p.email || "").trim(),
    city: (p.city || "").trim(),
    state: (p.state || "").trim(),
    gstin: (p.gstin || "").trim(),
    creditLimit: p.creditLimit != null ? parseFloat(p.creditLimit) : 0,
    outstanding: p.outstanding != null ? parseFloat(p.outstanding) : 0,
    paymentTerms: (p.paymentTerms || "30 Days").trim(),
    assignedCrmId: p.assignedCrmId || "",
    assignedCrmName: p.assignedCrmName || "",
    assignedAsmId: p.assignedAsmId || "",
    assignedAsmName: p.assignedAsmName || "",
    assignedTsmId: p.assignedTsmId || "",
    assignedTsmName: p.assignedTsmName || "",
    status: p.status || "Active",
    createdAt: p.createdAt || new Date().toISOString().split("T")[0]
  };

  if (isPg) {
    try {
      const query = `
        INSERT INTO crm_parties (
          "id", "name", "contactPerson", "phone", "email", "city", "state", "gstin",
          "creditLimit", "outstanding", "paymentTerms", "assignedCrmId", "assignedCrmName",
          "assignedAsmId", "assignedAsmName", "assignedTsmId", "assignedTsmName", "status", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "contactPerson" = EXCLUDED."contactPerson",
          "phone" = EXCLUDED."phone",
          "email" = EXCLUDED."email",
          "city" = EXCLUDED."city",
          "state" = EXCLUDED."state",
          "gstin" = EXCLUDED."gstin",
          "creditLimit" = EXCLUDED."creditLimit",
          "outstanding" = EXCLUDED."outstanding",
          "paymentTerms" = EXCLUDED."paymentTerms",
          "assignedCrmId" = EXCLUDED."assignedCrmId",
          "assignedCrmName" = EXCLUDED."assignedCrmName",
          "assignedAsmId" = EXCLUDED."assignedAsmId",
          "assignedAsmName" = EXCLUDED."assignedAsmName",
          "assignedTsmId" = EXCLUDED."assignedTsmId",
          "assignedTsmName" = EXCLUDED."assignedTsmName",
          "status" = EXCLUDED."status"
      `;
      const values = [
        partyObj.id, partyObj.name, partyObj.contactPerson, partyObj.phone, partyObj.email,
        partyObj.city, partyObj.state, partyObj.gstin, partyObj.creditLimit, partyObj.outstanding,
        partyObj.paymentTerms, partyObj.assignedCrmId, partyObj.assignedCrmName, partyObj.assignedAsmId,
        partyObj.assignedAsmName, partyObj.assignedTsmId, partyObj.assignedTsmName, partyObj.status, partyObj.createdAt
      ];
      await pool.query(query, values);
      res.json({ success: true, party: partyObj });
    } catch (err) {
      console.error("POST /api/crm/parties error:", err.message);
      res.status(500).json({ error: "Failed to save CRM party." });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmParties) data.crmParties = [];
    const index = data.crmParties.findIndex(x => x.id === partyObj.id);
    if (index !== -1) {
      data.crmParties[index] = partyObj;
    } else {
      data.crmParties.push(partyObj);
    }
    writeLocalJson(data);
    res.json({ success: true, party: partyObj });
  }
});

// 3. POST /api/crm/parties/batch - Bulk create/update parties with chunked high-performance ingestion
app.post("/api/crm/parties/batch", async (req, res) => {
  const { parties } = req.body;
  if (!Array.isArray(parties) || parties.length === 0) {
    return res.status(400).json({ error: "Parties array is required." });
  }

  if (isPg) {
    try {
      const CHUNK_SIZE = 250;
      let insertedCount = 0;

      for (let i = 0; i < parties.length; i += CHUNK_SIZE) {
        const chunk = parties.slice(i, i + CHUNK_SIZE);
        const valuePlaceholders = [];
        const queryParams = [];
        let pIdx = 1;

        for (const p of chunk) {
          if (!p.name) continue;
          valuePlaceholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12}, $${pIdx+13}, $${pIdx+14}, $${pIdx+15}, $${pIdx+16}, $${pIdx+17}, $${pIdx+18})`);
          queryParams.push(
            p.id || `pty-${Date.now()}-${insertedCount + valuePlaceholders.length}-${Math.random().toString(36).substr(2, 4)}`,
            (p.name || "").trim(),
            (p.contactPerson || "").trim(),
            (p.phone || "").trim(),
            (p.email || "").trim(),
            (p.city || "").trim(),
            (p.state || "").trim(),
            (p.gstin || "").trim(),
            p.creditLimit != null ? parseFloat(p.creditLimit) : 0,
            p.outstanding != null ? parseFloat(p.outstanding) : 0,
            (p.paymentTerms || "30 Days").trim(),
            p.assignedCrmId || "",
            p.assignedCrmName || "",
            p.assignedAsmId || "",
            p.assignedAsmName || "",
            p.assignedTsmId || "",
            p.assignedTsmName || "",
            p.status || "Active",
            p.createdAt || new Date().toISOString().split("T")[0]
          );
          pIdx += 19;
        }

        if (valuePlaceholders.length > 0) {
          const bulkSql = `
            INSERT INTO crm_parties (
              "id", "name", "contactPerson", "phone", "email", "city", "state", "gstin",
              "creditLimit", "outstanding", "paymentTerms", "assignedCrmId", "assignedCrmName",
              "assignedAsmId", "assignedAsmName", "assignedTsmId", "assignedTsmName", "status", "createdAt"
            ) VALUES ${valuePlaceholders.join(", ")}
            ON CONFLICT ("id") DO UPDATE SET
              "name" = EXCLUDED."name",
              "contactPerson" = EXCLUDED."contactPerson",
              "phone" = EXCLUDED."phone",
              "email" = EXCLUDED."email",
              "city" = EXCLUDED."city",
              "state" = EXCLUDED."state",
              "gstin" = EXCLUDED."gstin",
              "creditLimit" = EXCLUDED."creditLimit",
              "outstanding" = EXCLUDED."outstanding",
              "paymentTerms" = EXCLUDED."paymentTerms",
              "assignedCrmId" = EXCLUDED."assignedCrmId",
              "assignedCrmName" = EXCLUDED."assignedCrmName",
              "assignedAsmId" = EXCLUDED."assignedAsmId",
              "assignedAsmName" = EXCLUDED."assignedAsmName",
              "assignedTsmId" = EXCLUDED."assignedTsmId",
              "assignedTsmName" = EXCLUDED."assignedTsmName",
              "status" = EXCLUDED."status"
          `;
          await pool.query(bulkSql, queryParams);
          insertedCount += valuePlaceholders.length;
        }
      }

      res.json({ success: true, count: insertedCount });
    } catch (err) {
      console.error("POST /api/crm/parties/batch error:", err.message);
      res.status(500).json({ error: "Failed to batch save CRM parties: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmParties) data.crmParties = [];
    parties.forEach(p => {
      const idx = data.crmParties.findIndex(x => x.id === p.id);
      if (idx !== -1) {
        data.crmParties[idx] = { ...data.crmParties[idx], ...p };
      } else {
        data.crmParties.push(p);
      }
    });
    writeLocalJson(data);
    res.json({ success: true, count: parties.length });
  }
});

// 4. DELETE /api/crm/parties/:id - Delete single CRM Party
app.delete("/api/crm/parties/:id", async (req, res) => {
  const partyId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM crm_parties WHERE "id" = $1', [partyId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/crm/parties error:", err.message);
      res.status(500).json({ error: "Failed to delete CRM party." });
    }
  } else {
    const data = readLocalJson();
    data.crmParties = (data.crmParties || []).filter(x => x.id !== partyId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 4c. POST /api/crm/parties/delete - Bulk Delete CRM Parties by ID array
app.post("/api/crm/parties/delete", async (req, res) => {
  const { ids, purgeAll } = req.body;
  if (purgeAll === true) {
    if (isPg) {
      try {
        await pool.query("DELETE FROM crm_parties");
        return res.json({ success: true, count: 0 });
      } catch (err) {
        console.error("PURGE crm_parties error:", err.message);
        return res.status(500).json({ error: "Failed to purge party list." });
      }
    } else {
      const data = readLocalJson();
      data.crmParties = [];
      writeLocalJson(data);
      return res.json({ success: true, count: 0 });
    }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No party IDs provided for deletion." });
  }

  if (isPg) {
    try {
      const deleteRes = await pool.query('DELETE FROM crm_parties WHERE "id" = ANY($1::text[])', [ids]);
      res.json({ success: true, count: deleteRes.rowCount || ids.length });
    } catch (err) {
      console.error("POST /api/crm/parties/delete error:", err.message);
      res.status(500).json({ error: "Failed to bulk delete parties: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmParties) data.crmParties = [];
    const initLen = data.crmParties.length;
    data.crmParties = data.crmParties.filter(p => !ids.includes(p.id));
    const delCount = initLen - data.crmParties.length;
    writeLocalJson(data);
    res.json({ success: true, count: delCount });
  }
});

// 4b. POST /api/crm/parties/batch-assign - Assign multiple parties to an ASM or TSM
app.post("/api/crm/parties/batch-assign", async (req, res) => {
  const { partyIds, assignedAsmId, assignedTsmId, assignedAsmName, assignedTsmName } = req.body;
  if (!Array.isArray(partyIds)) {
    return res.status(400).json({ error: "No party IDs provided for assignment." });
  }

  if (isPg) {
    try {
      if (assignedAsmId !== undefined) {
        // Clear prior assignments for this ASM so unselected ones are cleanly unassigned
        await pool.query('UPDATE crm_parties SET "assignedAsmId" = NULL, "assignedAsmName" = NULL WHERE "assignedAsmId" = $1', [assignedAsmId]);
        if (partyIds.length > 0) {
          await pool.query(
            'UPDATE crm_parties SET "assignedAsmId" = $1, "assignedAsmName" = $2 WHERE "id" = ANY($3::text[])',
            [assignedAsmId, assignedAsmName || "", partyIds]
          );
        }
      }
      if (assignedTsmId !== undefined) {
        // Clear prior assignments for this TSM so unselected ones are cleanly unassigned
        await pool.query('UPDATE crm_parties SET "assignedTsmId" = NULL, "assignedTsmName" = NULL WHERE "assignedTsmId" = $1', [assignedTsmId]);
        if (partyIds.length > 0) {
          await pool.query(
            'UPDATE crm_parties SET "assignedTsmId" = $1, "assignedTsmName" = $2 WHERE "id" = ANY($3::text[])',
            [assignedTsmId, assignedTsmName || "", partyIds]
          );
        }
      }
      res.json({ success: true, count: partyIds.length });
    } catch (err) {
      console.error("POST /api/crm/parties/batch-assign error:", err.message);
      res.status(500).json({ error: "Failed to batch assign parties: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmParties) data.crmParties = [];
    data.crmParties = data.crmParties.map(p => {
      if (partyIds.includes(p.id)) {
        return {
          ...p,
          assignedAsmId: assignedAsmId !== undefined ? assignedAsmId : p.assignedAsmId,
          assignedAsmName: assignedAsmName !== undefined ? assignedAsmName : p.assignedAsmName,
          assignedTsmId: assignedTsmId !== undefined ? assignedTsmId : p.assignedTsmId,
          assignedTsmName: assignedTsmName !== undefined ? assignedTsmName : p.assignedTsmName
        };
      } else if (assignedAsmId && p.assignedAsmId === assignedAsmId) {
        return { ...p, assignedAsmId: "", assignedAsmName: "" };
      } else if (assignedTsmId && p.assignedTsmId === assignedTsmId) {
        return { ...p, assignedTsmId: "", assignedTsmName: "" };
      }
      return p;
    });
    writeLocalJson(data);
    res.json({ success: true, count: partyIds.length });
  }
});

// 5. POST /api/crm/sales-orders - Create or Update CRM Sales Order
app.post("/api/crm/sales-orders", async (req, res) => {
  const so = req.body;
  if (!so || !so.partyId) {
    return res.status(400).json({ error: "Party ID and Item are required." });
  }

  const orderObj = {
    id: so.id || `so-${Date.now()}`,
    orderNo: so.orderNo || `SO-2026-${Math.floor(100 + Math.random() * 900)}`,
    orderDate: so.orderDate || new Date().toISOString().split("T")[0],
    partyId: so.partyId,
    partyName: so.partyName || "",
    itemModel: so.itemModel || "",
    category: so.category || "General",
    orderQty: parseInt(so.orderQty || 0),
    unitPriceInr: parseFloat(so.unitPriceInr || 0),
    totalInr: parseFloat(so.totalInr || (parseFloat(so.unitPriceInr || 0) * parseInt(so.orderQty || 0))),
    dispatchedQty: parseInt(so.dispatchedQty || 0),
    pendingQty: Math.max(0, parseInt(so.orderQty || 0) - parseInt(so.dispatchedQty || 0)),
    status: so.status || (parseInt(so.dispatchedQty || 0) >= parseInt(so.orderQty || 0) ? "Dispatched" : (parseInt(so.dispatchedQty || 0) > 0 ? "Partially Dispatched" : "Pending Dispatch")),
    assignedCrmId: so.assignedCrmId || "",
    assignedAsmId: so.assignedAsmId || "",
    assignedTsmId: so.assignedTsmId || "",
    notes: so.notes || ""
  };

  if (isPg) {
    try {
      const query = `
        INSERT INTO crm_sales_orders (
          "id", "orderNo", "orderDate", "partyId", "partyName", "itemModel", "category",
          "orderQty", "unitPriceInr", "totalInr", "dispatchedQty", "pendingQty", "status",
          "assignedCrmId", "assignedAsmId", "assignedTsmId", "notes"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT ("id") DO UPDATE SET
          "orderNo" = EXCLUDED."orderNo",
          "orderDate" = EXCLUDED."orderDate",
          "partyId" = EXCLUDED."partyId",
          "partyName" = EXCLUDED."partyName",
          "itemModel" = EXCLUDED."itemModel",
          "category" = EXCLUDED."category",
          "orderQty" = EXCLUDED."orderQty",
          "unitPriceInr" = EXCLUDED."unitPriceInr",
          "totalInr" = EXCLUDED."totalInr",
          "dispatchedQty" = EXCLUDED."dispatchedQty",
          "pendingQty" = EXCLUDED."pendingQty",
          "status" = EXCLUDED."status",
          "assignedCrmId" = EXCLUDED."assignedCrmId",
          "assignedAsmId" = EXCLUDED."assignedAsmId",
          "assignedTsmId" = EXCLUDED."assignedTsmId",
          "notes" = EXCLUDED."notes"
      `;
      const values = [
        orderObj.id, orderObj.orderNo, orderObj.orderDate, orderObj.partyId, orderObj.partyName,
        orderObj.itemModel, orderObj.category, orderObj.orderQty, orderObj.unitPriceInr, orderObj.totalInr,
        orderObj.dispatchedQty, orderObj.pendingQty, orderObj.status, orderObj.assignedCrmId, orderObj.assignedAsmId,
        orderObj.assignedTsmId, orderObj.notes
      ];
      await pool.query(query, values);
      res.json({ success: true, order: orderObj });
    } catch (err) {
      console.error("POST /api/crm/sales-orders error:", err.message);
      res.status(500).json({ error: "Failed to save CRM sales order." });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmSalesOrders) data.crmSalesOrders = [];
    const index = data.crmSalesOrders.findIndex(x => x.id === orderObj.id);
    if (index !== -1) {
      data.crmSalesOrders[index] = orderObj;
    } else {
      data.crmSalesOrders.unshift(orderObj);
    }
    writeLocalJson(data);
    res.json({ success: true, order: orderObj });
  }
});

// 6. DELETE /api/crm/sales-orders/:id - Delete Sales Order
app.delete("/api/crm/sales-orders/:id", async (req, res) => {
  const orderId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM crm_sales_orders WHERE "id" = $1', [orderId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/crm/sales-orders error:", err.message);
      res.status(500).json({ error: "Failed to delete CRM sales order." });
    }
  } else {
    const data = readLocalJson();
    data.crmSalesOrders = (data.crmSalesOrders || []).filter(x => x.id !== orderId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 7. POST /api/crm/dispatches - Create or Update CRM Dispatch
app.post("/api/crm/dispatches", async (req, res) => {
  const d = req.body;
  if (!d || !d.partyId) {
    return res.status(400).json({ error: "Dispatch party and quantity are required." });
  }

  const dispatchObj = {
    id: d.id || `dsp-${Date.now()}`,
    orderId: d.orderId || "",
    orderNo: d.orderNo || "",
    partyId: d.partyId,
    partyName: d.partyName || "",
    itemModel: d.itemModel || "",
    dispatchedQty: parseInt(d.dispatchedQty || 0),
    transporterName: d.transporterName || "Standard Transport",
    docketNo: d.docketNo || "",
    invoiceNo: d.invoiceNo || "",
    dispatchDate: d.dispatchDate || new Date().toISOString().split("T")[0],
    deliveryDate: d.deliveryDate || "",
    status: d.status || "In Transit",
    assignedCrmId: d.assignedCrmId || "",
    assignedAsmId: d.assignedAsmId || "",
    assignedTsmId: d.assignedTsmId || ""
  };

  if (isPg) {
    try {
      const query = `
        INSERT INTO crm_dispatches (
          "id", "orderId", "orderNo", "partyId", "partyName", "itemModel", "dispatchedQty",
          "transporterName", "docketNo", "invoiceNo", "dispatchDate", "deliveryDate", "status",
          "assignedCrmId", "assignedAsmId", "assignedTsmId"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT ("id") DO UPDATE SET
          "orderId" = EXCLUDED."orderId",
          "orderNo" = EXCLUDED."orderNo",
          "partyId" = EXCLUDED."partyId",
          "partyName" = EXCLUDED."partyName",
          "itemModel" = EXCLUDED."itemModel",
          "dispatchedQty" = EXCLUDED."dispatchedQty",
          "transporterName" = EXCLUDED."transporterName",
          "docketNo" = EXCLUDED."docketNo",
          "invoiceNo" = EXCLUDED."invoiceNo",
          "dispatchDate" = EXCLUDED."dispatchDate",
          "deliveryDate" = EXCLUDED."deliveryDate",
          "status" = EXCLUDED."status",
          "assignedCrmId" = EXCLUDED."assignedCrmId",
          "assignedAsmId" = EXCLUDED."assignedAsmId",
          "assignedTsmId" = EXCLUDED."assignedTsmId"
      `;
      const values = [
        dispatchObj.id, dispatchObj.orderId, dispatchObj.orderNo, dispatchObj.partyId, dispatchObj.partyName,
        dispatchObj.itemModel, dispatchObj.dispatchedQty, dispatchObj.transporterName, dispatchObj.docketNo,
        dispatchObj.invoiceNo, dispatchObj.dispatchDate, dispatchObj.deliveryDate, dispatchObj.status,
        dispatchObj.assignedCrmId, dispatchObj.assignedAsmId, dispatchObj.assignedTsmId
      ];
      await pool.query(query, values);

      // If linked to an order, update dispatchedQty on the order
      if (dispatchObj.orderId) {
        await pool.query(`
          UPDATE crm_sales_orders
          SET "dispatchedQty" = "dispatchedQty" + $1,
              "pendingQty" = GREATEST(0, "orderQty" - ("dispatchedQty" + $1)),
              "status" = CASE WHEN ("dispatchedQty" + $1) >= "orderQty" THEN 'Dispatched' ELSE 'Partially Dispatched' END
          WHERE "id" = $2
        `, [dispatchObj.dispatchedQty, dispatchObj.orderId]);
      }

      res.json({ success: true, dispatch: dispatchObj });
    } catch (err) {
      console.error("POST /api/crm/dispatches error:", err.message);
      res.status(500).json({ error: "Failed to save CRM dispatch." });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmDispatches) data.crmDispatches = [];
    const index = data.crmDispatches.findIndex(x => x.id === dispatchObj.id);
    if (index !== -1) {
      data.crmDispatches[index] = dispatchObj;
    } else {
      data.crmDispatches.unshift(dispatchObj);
    }

    if (dispatchObj.orderId && data.crmSalesOrders) {
      const oIdx = data.crmSalesOrders.findIndex(x => x.id === dispatchObj.orderId);
      if (oIdx !== -1) {
        const order = data.crmSalesOrders[oIdx];
        order.dispatchedQty = (order.dispatchedQty || 0) + dispatchObj.dispatchedQty;
        order.pendingQty = Math.max(0, order.orderQty - order.dispatchedQty);
        order.status = order.dispatchedQty >= order.orderQty ? "Dispatched" : "Partially Dispatched";
      }
    }

    writeLocalJson(data);
    res.json({ success: true, dispatch: dispatchObj });
  }
});

// 8. DELETE /api/crm/dispatches/:id - Delete Dispatch
app.delete("/api/crm/dispatches/:id", async (req, res) => {
  const dispatchId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM crm_dispatches WHERE "id" = $1', [dispatchId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/crm/dispatches error:", err.message);
      res.status(500).json({ error: "Failed to delete CRM dispatch." });
    }
  } else {
    const data = readLocalJson();
    data.crmDispatches = (data.crmDispatches || []).filter(x => x.id !== dispatchId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// ==================== CRM PARTY REMARKS (MONTH & CATEGORY WISE) ====================

// GET /api/crm/party-remarks
app.get("/api/crm/party-remarks", async (req, res) => {
  const { partyId, category, month } = req.query;
  if (isPg) {
    try {
      let query = 'SELECT * FROM crm_party_remarks WHERE 1=1';
      const params = [];
      if (partyId) {
        params.push(partyId);
        query += ` AND "partyId" = $${params.length}`;
      }
      if (category) {
        params.push(category);
        query += ` AND "category" = $${params.length}`;
      }
      if (month) {
        params.push(month);
        query += ` AND "month" = $${params.length}`;
      }
      query += ' ORDER BY "createdAt" DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/crm/party-remarks error:", err.message);
      res.status(500).json({ error: "Failed to fetch party remarks." });
    }
  } else {
    const data = readLocalJson();
    let remarks = data.crmPartyRemarks || [];
    if (partyId) remarks = remarks.filter(r => r.partyId === partyId);
    if (category) remarks = remarks.filter(r => r.category === category);
    if (month) remarks = remarks.filter(r => r.month === month);
    res.json(remarks);
  }
});

// POST /api/crm/party-remarks
app.post("/api/crm/party-remarks", async (req, res) => {
  const r = req.body;
  if (!r.partyName && !r.partyId) {
    return res.status(400).json({ error: "Party name or ID is required." });
  }

  const remarkObj = {
    id: r.id || `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    partyId: r.partyId || "",
    partyName: r.partyName || "",
    category: r.category || "General",
    month: r.month || new Date().toISOString().slice(0, 7),
    remark: r.remark || "",
    authorId: r.authorId || "",
    authorName: r.authorName || "Team Member",
    authorRole: r.authorRole || "asm",
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isPg) {
    try {
      const query = `
        INSERT INTO crm_party_remarks (
          "id", "partyId", "partyName", "category", "month", "remark",
          "authorId", "authorName", "authorRole", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT ("id") DO UPDATE SET
          "partyId" = EXCLUDED."partyId",
          "partyName" = EXCLUDED."partyName",
          "category" = EXCLUDED."category",
          "month" = EXCLUDED."month",
          "remark" = EXCLUDED."remark",
          "authorId" = EXCLUDED."authorId",
          "authorName" = EXCLUDED."authorName",
          "authorRole" = EXCLUDED."authorRole",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
      await pool.query(query, [
        remarkObj.id, remarkObj.partyId, remarkObj.partyName, remarkObj.category,
        remarkObj.month, remarkObj.remark, remarkObj.authorId, remarkObj.authorName,
        remarkObj.authorRole, remarkObj.createdAt, remarkObj.updatedAt
      ]);
      res.json({ success: true, remark: remarkObj });
    } catch (err) {
      console.error("POST /api/crm/party-remarks error:", err.message);
      res.status(500).json({ error: "Failed to save remark: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.crmPartyRemarks) data.crmPartyRemarks = [];
    const idx = data.crmPartyRemarks.findIndex(x => x.id === remarkObj.id);
    if (idx !== -1) {
      data.crmPartyRemarks[idx] = remarkObj;
    } else {
      data.crmPartyRemarks.unshift(remarkObj);
    }
    writeLocalJson(data);
    res.json({ success: true, remark: remarkObj });
  }
});

// DELETE /api/crm/party-remarks/:id
app.delete("/api/crm/party-remarks/:id", async (req, res) => {
  const remarkId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM crm_party_remarks WHERE "id" = $1', [remarkId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/crm/party-remarks error:", err.message);
      res.status(500).json({ error: "Failed to delete remark." });
    }
  } else {
    const data = readLocalJson();
    data.crmPartyRemarks = (data.crmPartyRemarks || []).filter(x => x.id !== remarkId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// ==================== IMS (INVENTORY MANAGEMENT SYSTEM) ENDPOINTS ====================

// 1. GET /api/ims/transactions - Query IMS Stock Movements
app.get("/api/ims/transactions", async (req, res) => {
  const { itemId, itemName, partyName, isMissingId, startDate, endDate } = req.query;
  if (isPg) {
    try {
      let query = "SELECT * FROM ims_transactions";
      const conditions = [];
      const values = [];
      let idx = 1;

      if (itemId) {
        conditions.push(`"itemId" = $${idx++}`);
        values.push(itemId);
      }
      if (itemName) {
        conditions.push(`"itemName" ILIKE $${idx++}`);
        values.push(`%${itemName}%`);
      }
      if (partyName) {
        conditions.push(`"partyName" ILIKE $${idx++}`);
        values.push(`%${partyName}%`);
      }
      if (isMissingId !== undefined && isMissingId !== "") {
        conditions.push(`"isMissingId" = $${idx++}`);
        values.push(isMissingId === "true");
      }
      if (startDate) {
        conditions.push(`"date" >= $${idx++}`);
        values.push(startDate);
      }
      if (endDate) {
        conditions.push(`"date" <= $${idx++}`);
        values.push(endDate);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY \"date\" DESC, \"createdAt\" DESC";

      const result = await pool.query(query, values);
      const rows = result.rows.map(r => ({
        ...r,
        stockQty: r.stockQty ? parseInt(r.stockQty) : 0,
        isMissingId: !!r.isMissingId
      }));
      res.json({ success: true, transactions: rows });
    } catch (err) {
      console.error("GET /api/ims/transactions error:", err.message);
      res.status(500).json({ error: "Failed to fetch IMS transactions." });
    }
  } else {
    const data = readLocalJson();
    let list = data.imsTransactions || [];
    if (itemId) list = list.filter(t => t.itemId === itemId);
    if (itemName) list = list.filter(t => (t.itemName || "").toLowerCase().includes(itemName.toLowerCase()));
    if (partyName) list = list.filter(t => (t.partyName || "").toLowerCase().includes(partyName.toLowerCase()));
    if (isMissingId !== undefined && isMissingId !== "") {
      const matchBool = isMissingId === "true";
      list = list.filter(t => !!t.isMissingId === matchBool);
    }
    if (startDate) list = list.filter(t => (t.date || "") >= startDate);
    if (endDate) list = list.filter(t => (t.date || "") <= endDate);
    res.json({ success: true, transactions: list });
  }
});

// 2. POST /api/ims/transactions - Single Stock Movement Entry
app.post("/api/ims/transactions", async (req, res) => {
  const t = req.body;
  if (!t || !t.itemName) {
    return res.status(400).json({ error: "Item name is required for IMS stock movement." });
  }

  const rawQty = parseInt(t.stockQty) || 0;
  const movementType = t.movementType || (rawQty >= 0 ? "IN" : "OUT");
  const finalStockQty = movementType === "OUT" ? -Math.abs(rawQty) : Math.abs(rawQty);

  let itemId = (t.itemId || "").trim();
  let isMissingId = !itemId;

  // If itemId is given, check if it matches an existing item, otherwise if empty check by name
  if (isPg) {
    try {
      if (itemId) {
        const checkItem = await pool.query('SELECT * FROM items WHERE "id" = $1', [itemId]);
        isMissingId = checkItem.rows.length === 0;
      } else {
        const checkName = await pool.query('SELECT * FROM items WHERE LOWER("name") = LOWER($1)', [t.itemName.trim()]);
        if (checkName.rows.length > 0) {
          itemId = checkName.rows[0].id;
          isMissingId = false;
        } else {
          isMissingId = true;
        }
      }

      const txObj = {
        id: t.id || `ims-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: t.date || new Date().toISOString().split("T")[0],
        itemName: (t.itemName || "").trim(),
        itemId,
        stockQty: finalStockQty,
        movementType,
        partyName: (t.partyName || "").trim(),
        remarks: (t.remarks || "").trim(),
        location: (t.location || "Delhi").trim(),
        source: t.source || "manual",
        isMissingId,
        createdAt: t.createdAt || new Date().toISOString()
      };

      const query = `
        INSERT INTO ims_transactions (
          "id", "date", "itemName", "itemId", "stockQty", "movementType",
          "partyName", "remarks", "location", "source", "isMissingId", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT ("id") DO UPDATE SET
          "date" = EXCLUDED."date",
          "itemName" = EXCLUDED."itemName",
          "itemId" = EXCLUDED."itemId",
          "stockQty" = EXCLUDED."stockQty",
          "movementType" = EXCLUDED."movementType",
          "partyName" = EXCLUDED."partyName",
          "remarks" = EXCLUDED."remarks",
          "location" = EXCLUDED."location",
          "source" = EXCLUDED."source",
          "isMissingId" = EXCLUDED."isMissingId"
      `;
      const values = [
        txObj.id, txObj.date, txObj.itemName, txObj.itemId, txObj.stockQty,
        txObj.movementType, txObj.partyName, txObj.remarks, txObj.location, txObj.source,
        txObj.isMissingId, txObj.createdAt
      ];
      await pool.query(query, values);
      res.json({ success: true, transaction: txObj });
    } catch (err) {
      console.error("POST /api/ims/transactions error:", err.message);
      res.status(500).json({ error: "Failed to record IMS transaction." });
    }
  } else {
    const data = readLocalJson();
    if (!data.imsTransactions) data.imsTransactions = [];
    const items = data.items || [];

    if (itemId) {
      isMissingId = !items.some(i => i.id === itemId);
    } else {
      const match = items.find(i => i.name.trim().toLowerCase() === t.itemName.trim().toLowerCase());
      if (match) {
        itemId = match.id;
        isMissingId = false;
      } else {
        isMissingId = true;
      }
    }

    const txObj = {
      id: t.id || `ims-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: t.date || new Date().toISOString().split("T")[0],
      itemName: (t.itemName || "").trim(),
      itemId,
      stockQty: finalStockQty,
      movementType,
      partyName: (t.partyName || "").trim(),
      remarks: (t.remarks || "").trim(),
      location: (t.location || "Delhi").trim(),
      source: t.source || "manual",
      isMissingId,
      createdAt: t.createdAt || new Date().toISOString()
    };

    const idx = data.imsTransactions.findIndex(x => x.id === txObj.id);
    if (idx !== -1) {
      data.imsTransactions[idx] = txObj;
    } else {
      data.imsTransactions.unshift(txObj);
    }
    writeLocalJson(data);
    res.json({ success: true, transaction: txObj });
  }
});

// 3. POST /api/ims/transactions/batch - Bulk Upload Historical IMS Transactions (Excel / CSV)
app.post("/api/ims/transactions/batch", async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: "No transactions provided for bulk upload." });
  }

  function cleanIsoDate(dStr) {
    if (!dStr) return new Date().toISOString().split("T")[0];
    const clean = String(dStr).trim();
    const ymdMatch = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, "0")}-${ymdMatch[3].padStart(2, "0")}`;
    }
    const slashMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (slashMatch) {
      const n1 = parseInt(slashMatch[1], 10);
      const n2 = parseInt(slashMatch[2], 10);
      let year = slashMatch[3];
      if (year.length === 2) year = `20${year}`;
      let month, day;
      if (n1 > 12) {
        day = String(n1).padStart(2, "0");
        month = String(Math.min(12, Math.max(1, n2))).padStart(2, "0");
      } else {
        month = String(Math.min(12, Math.max(1, n1))).padStart(2, "0");
        day = String(n2).padStart(2, "0");
      }
      return `${year}-${month}-${day}`;
    }
    return clean;
  }

  if (isPg) {
    try {
      const itemsRes = await pool.query("SELECT id, name FROM items");
      const itemsMap = new Map();
      const namesMap = new Map();
      itemsRes.rows.forEach(i => {
        itemsMap.set(String(i.id).trim().toLowerCase(), i);
        namesMap.set(String(i.name).trim().toLowerCase(), i);
      });

      let insertedCount = 0;
      let missingIdCount = 0;

      // High-performance chunked multi-row insertion (100 rows per query for optimal stability)
      const CHUNK_SIZE = 100;
      for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
        const chunk = transactions.slice(i, i + CHUNK_SIZE);
        const chunkObjects = [];

        for (const t of chunk) {
          const rawQty = parseInt(t.stockQty) || 0;
          const movementType = t.movementType || (rawQty >= 0 ? "IN" : "OUT");
          const finalStockQty = movementType === "OUT" ? -Math.abs(rawQty) : Math.abs(rawQty);

          let itemId = String(t.itemId || "").trim();
          const rawItemName = (t.itemName || "").trim();
          let itemName = rawItemName;
          let isMissingId = false;

          if (itemId && itemsMap.has(itemId.toLowerCase())) {
            isMissingId = false;
            if (!itemName) itemName = itemsMap.get(itemId.toLowerCase()).name;
          } else if (rawItemName && namesMap.has(rawItemName.toLowerCase())) {
            itemId = namesMap.get(rawItemName.toLowerCase()).id;
            isMissingId = false;
          } else {
            if (!itemName) itemName = "BT315";
            isMissingId = true;
            missingIdCount++;
          }

          chunkObjects.push({
            id: t.id || `ims-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${insertedCount + chunkObjects.length}`,
            date: cleanIsoDate(t.date),
            itemName,
            itemId,
            stockQty: finalStockQty,
            movementType,
            partyName: (t.partyName || "").trim(),
            remarks: (t.remarks || "").trim(),
            location: (t.location || "Delhi").trim(),
            source: t.source || "bulk_upload",
            isMissingId,
            createdAt: t.createdAt || new Date().toISOString()
          });
        }

        if (chunkObjects.length > 0) {
          const valuePlaceholders = [];
          const queryParams = [];
          let pIdx = 1;

          for (const tx of chunkObjects) {
            valuePlaceholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11})`);
            queryParams.push(
              tx.id, tx.date, tx.itemName, tx.itemId, tx.stockQty,
              tx.movementType, tx.partyName, tx.remarks, tx.location,
              tx.source, tx.isMissingId, tx.createdAt
            );
            pIdx += 12;
          }

          const bulkSql = `
            INSERT INTO ims_transactions (
              "id", "date", "itemName", "itemId", "stockQty", "movementType",
              "partyName", "remarks", "location", "source", "isMissingId", "createdAt"
            ) VALUES ${valuePlaceholders.join(", ")}
            ON CONFLICT ("id") DO UPDATE SET
              "date" = EXCLUDED."date",
              "itemName" = EXCLUDED."itemName",
              "itemId" = EXCLUDED."itemId",
              "stockQty" = EXCLUDED."stockQty",
              "movementType" = EXCLUDED."movementType",
              "partyName" = EXCLUDED."partyName",
              "remarks" = EXCLUDED."remarks",
              "location" = EXCLUDED."location",
              "source" = EXCLUDED."source",
              "isMissingId" = EXCLUDED."isMissingId",
              "createdAt" = EXCLUDED."createdAt"
          `;

          await pool.query(bulkSql, queryParams);
          insertedCount += chunkObjects.length;
        }
      }

      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, count: insertedCount, missingIdCount });
    } catch (err) {
      console.error("POST /api/ims/transactions/batch error:", err.message);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ success: false, error: "Failed to batch upload IMS transactions: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.imsTransactions) data.imsTransactions = [];
    const items = data.items || [];
    let insertedCount = 0;
    let missingIdCount = 0;

    for (const t of transactions) {
      const rawQty = parseInt(t.stockQty) || 0;
      const movementType = t.movementType || (rawQty >= 0 ? "IN" : "OUT");
      const finalStockQty = movementType === "OUT" ? -Math.abs(rawQty) : Math.abs(rawQty);

      let itemId = String(t.itemId || "").trim();
      const rawItemName = (t.itemName || "").trim();
      let itemName = rawItemName;
      let isMissingId = false;

      const matchId = items.find(i => i.id.toLowerCase() === itemId.toLowerCase());
      const matchName = items.find(i => i.name.trim().toLowerCase() === rawItemName.toLowerCase());

      if (itemId && matchId) {
        isMissingId = false;
        if (!itemName) itemName = matchId.name;
      } else if (rawItemName && matchName) {
        itemId = matchName.id;
        isMissingId = false;
      } else {
        if (!itemName) itemName = "BT315";
        isMissingId = true;
        missingIdCount++;
      }

      const txObj = {
        id: t.id || `ims-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        date: t.date || new Date().toISOString().split("T")[0],
        itemName,
        itemId,
        stockQty: finalStockQty,
        movementType,
        partyName: (t.partyName || "").trim(),
        remarks: (t.remarks || "").trim(),
        location: (t.location || "Delhi").trim(),
        source: t.source || "bulk_upload",
        isMissingId,
        createdAt: t.createdAt || new Date().toISOString()
      };

      const idx = data.imsTransactions.findIndex(x => x.id === txObj.id);
      if (idx !== -1) {
        data.imsTransactions[idx] = txObj;
      } else {
        data.imsTransactions.unshift(txObj);
      }
      insertedCount++;
    }

    writeLocalJson(data);
    res.json({ success: true, count: insertedCount, missingIdCount });
  }
});

// 4. DELETE /api/ims/transactions/:id - Delete an IMS Transaction
app.delete("/api/ims/transactions/:id", async (req, res) => {
  const txId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM ims_transactions WHERE "id" = $1', [txId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/ims/transactions error:", err.message);
      res.status(500).json({ error: "Failed to delete IMS transaction." });
    }
  } else {
    const data = readLocalJson();
    data.imsTransactions = (data.imsTransactions || []).filter(x => x.id !== txId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 4b. POST /api/ims/transactions/delete-range - Bulk Delete IMS Transactions by Date Range or ID list
app.post("/api/ims/transactions/delete-range", async (req, res) => {
  const { startDate, endDate, ids, purgeAll, location } = req.body;

  if (purgeAll === true) {
    if (isPg) {
      try {
        await pool.query('DELETE FROM ims_transactions');
        return res.json({ success: true, count: 0 });
      } catch (err) {
        console.error("PURGE IMS error:", err.message);
        return res.status(500).json({ error: "Failed to purge IMS transactions." });
      }
    } else {
      const data = readLocalJson();
      data.imsTransactions = [];
      writeLocalJson(data);
      return res.json({ success: true, count: 0 });
    }
  }

  if (Array.isArray(ids) && ids.length > 0) {
    if (isPg) {
      try {
        const deleteRes = await pool.query('DELETE FROM ims_transactions WHERE "id" = ANY($1::text[])', [ids]);
        return res.json({ success: true, count: deleteRes.rowCount || ids.length });
      } catch (err) {
        console.error("DELETE IMS IDs error:", err.message);
        return res.status(500).json({ error: "Failed to delete selected IMS transactions." });
      }
    } else {
      const data = readLocalJson();
      const initialCount = (data.imsTransactions || []).length;
      data.imsTransactions = (data.imsTransactions || []).filter(t => !ids.includes(t.id));
      const deletedCount = initialCount - data.imsTransactions.length;
      writeLocalJson(data);
      return res.json({ success: true, count: deletedCount });
    }
  }

  // Delete by Location only (e.g. Purge all Mumbai Warehouse records)
  if (location && location !== "all" && (!startDate || !endDate)) {
    const locClean = String(location).trim();
    if (isPg) {
      try {
        const deleteRes = await pool.query('DELETE FROM ims_transactions WHERE LOWER("location") = LOWER($1)', [locClean]);
        return res.json({ success: true, count: deleteRes.rowCount || 0 });
      } catch (err) {
        console.error("DELETE IMS by location error:", err.message);
        return res.status(500).json({ error: "Failed to delete IMS transactions by location: " + err.message });
      }
    } else {
      const data = readLocalJson();
      const initialCount = (data.imsTransactions || []).length;
      data.imsTransactions = (data.imsTransactions || []).filter(t => (t.location || "Delhi").trim().toLowerCase() !== locClean.toLowerCase());
      const deletedCount = initialCount - data.imsTransactions.length;
      writeLocalJson(data);
      return res.json({ success: true, count: deletedCount });
    }
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Start date and end date (or location/ids) are required for range deletion." });
  }

  if (isPg) {
    try {
      let deleteSql = 'DELETE FROM ims_transactions WHERE "date" >= $1 AND "date" <= $2';
      const params = [startDate, endDate];
      if (location && location !== "all") {
        deleteSql += ' AND LOWER("location") = LOWER($3)';
        params.push(String(location).trim());
      }
      const deleteRes = await pool.query(deleteSql, params);
      res.json({ success: true, count: deleteRes.rowCount || 0 });
    } catch (err) {
      console.error("DELETE IMS date range error:", err.message);
      res.status(500).json({ error: "Failed to delete IMS transactions in date range." });
    }
  } else {
    const data = readLocalJson();
    const initialCount = (data.imsTransactions || []).length;
    data.imsTransactions = (data.imsTransactions || []).filter(t => {
      const inRange = t.date >= startDate && t.date <= endDate;
      const inLoc = location && location !== "all" ? (t.location || "Delhi").trim().toLowerCase() === location.trim().toLowerCase() : true;
      return !(inRange && inLoc);
    });
    const deletedCount = initialCount - data.imsTransactions.length;
    writeLocalJson(data);
    res.json({ success: true, count: deletedCount });
  }
});

// 5. POST /api/ims/resolve-missing-id - Bulk Resolve Missing Item IDs
app.post("/api/ims/resolve-missing-id", async (req, res) => {
  const { oldItemName, targetItemId, targetItemName } = req.body;
  if (!oldItemName || !targetItemId) {
    return res.status(400).json({ error: "oldItemName and targetItemId are required." });
  }

  const finalName = targetItemName ? targetItemName.trim() : oldItemName.trim();

  if (isPg) {
    try {
      const updateRes = await pool.query(`
        UPDATE ims_transactions
        SET "itemId" = $1, "itemName" = $2, "isMissingId" = false
        WHERE LOWER("itemName") = LOWER($3) OR ("isMissingId" = true AND "itemId" = $1)
      `, [targetItemId.trim(), finalName, oldItemName.trim()]);

      res.json({ success: true, resolvedCount: updateRes.rowCount || 0 });
    } catch (err) {
      console.error("POST /api/ims/resolve-missing-id error:", err.message);
      res.status(500).json({ error: "Failed to resolve missing item ID in IMS." });
    }
  } else {
    const data = readLocalJson();
    let count = 0;
    if (data.imsTransactions) {
      data.imsTransactions.forEach(tx => {
        if ((tx.itemName || "").toLowerCase() === oldItemName.trim().toLowerCase() || (tx.isMissingId && tx.itemId === targetItemId.trim())) {
          tx.itemId = targetItemId.trim();
          tx.itemName = finalName;
          tx.isMissingId = false;
          count++;
        }
      });
    }
    writeLocalJson(data);
    res.json({ success: true, resolvedCount: count });
  }
});
// GET /api/audit-logs - Retrieve all activity logs
app.get("/api/audit-logs", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query(`SELECT * FROM audit_logs ORDER BY "isoTime" DESC LIMIT 2000`);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/audit-logs error:", err.message);
      res.status(500).json({ error: "Failed to fetch audit logs." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.auditLogs || []);
  }
});

// POST /api/audit-logs - Record new audit log entry
app.post("/api/audit-logs", async (req, res) => {
  const entry = req.body;
  if (!entry || !entry.action) {
    return res.status(400).json({ error: "Audit log action is required." });
  }

  const logObj = {
    id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    userId: entry.userId || "system",
    userName: entry.userName || "System User",
    role: entry.role || "user",
    action: entry.action || "ACTIVITY",
    details: entry.details || "",
    entityType: entry.entityType || "",
    entityId: entry.entityId || "",
    oldData: entry.oldData ? (typeof entry.oldData === "string" ? entry.oldData : JSON.stringify(entry.oldData)) : "",
    newData: entry.newData ? (typeof entry.newData === "string" ? entry.newData : JSON.stringify(entry.newData)) : "",
    timestamp: entry.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    isoTime: entry.isoTime || new Date().toISOString()
  };

  if (isPg) {
    try {
      await pool.query(
        `INSERT INTO audit_logs ("id", "userId", "userName", "role", "action", "details", "entityType", "entityId", "oldData", "newData", "timestamp", "isoTime")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT ("id") DO UPDATE SET "details" = EXCLUDED."details"`,
        [logObj.id, logObj.userId, logObj.userName, logObj.role, logObj.action, logObj.details, logObj.entityType, logObj.entityId, logObj.oldData, logObj.newData, logObj.timestamp, logObj.isoTime]
      );
      res.json({ success: true, log: logObj });
    } catch (err) {
      console.error("POST /api/audit-logs error:", err.message);
      res.status(500).json({ error: "Failed to record audit log." });
    }
  } else {
    const data = readLocalJson();
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(logObj);
    if (data.auditLogs.length > 2000) data.auditLogs = data.auditLogs.slice(0, 2000);
    writeLocalJson(data);
    res.json({ success: true, log: logObj });
  }
});

// ==================== MASTER ITEM CATALOG API ENDPOINTS ====================

// GET /api/items - Retrieve all Master Items
app.get("/api/items", async (req, res) => {
  if (isPg) {
    try {
      const result = await pool.query(`SELECT * FROM items ORDER BY CAST(NULLIF(regexp_replace("id", '\\D', '', 'g'), '') AS INTEGER) ASC, "id" ASC`);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/items error:", err.message);
      res.status(500).json({ error: "Failed to fetch items." });
    }
  } else {
    const data = readLocalJson();
    res.json(data.items || []);
  }
});

// Helper to normalize item names for fuzzy duplicate detection (e.g. DC02, DC 02, DC2, DC-2, DC-02 -> DC2)
function normalizeItemKey(str) {
  if (!str) return "";
  let s = String(str).trim().toUpperCase();
  s = s.replace(/[^A-Z0-9]/g, "");
  s = s.replace(/([A-Z]+)0+(\d+)/g, "$1$2");
  return s;
}

// POST /api/items - Add or update a single Master Item
app.post("/api/items", async (req, res) => {
  const item = req.body;
  if (!item.id || !item.name) {
    return res.status(400).json({ error: "Item ID and Item Name are required." });
  }

  const targetKey = normalizeItemKey(item.name);

  if (isPg) {
    try {
      // Check for fuzzy duplicate item name matching (DC02 == DC 02 == DC-2 == DC-02)
      const existingRes = await pool.query("SELECT * FROM items");
      const match = existingRes.rows.find(i => i.id !== item.id && normalizeItemKey(i.name) === targetKey);
      if (match) {
        return res.status(400).json({
          error: `Item already exists! An existing item "${match.name}" (Item ID #${match.id}) matches "${item.name}".`
        });
      }

      await pool.query(
        `INSERT INTO items ("id", "name", "category", "itemType", "itemNature", "unit", "description", "photo", "currentStock", "createdBy")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "itemType" = EXCLUDED."itemType", "itemNature" = EXCLUDED."itemNature", "unit" = EXCLUDED."unit", "description" = EXCLUDED."description", "photo" = EXCLUDED."photo", "currentStock" = EXCLUDED."currentStock", "createdBy" = EXCLUDED."createdBy"`,
        [item.id, item.name, item.category || "", item.itemType || "RM", item.itemNature || "Non Consumables", item.unit || "Pcs", item.description || "", item.photo || "", item.currentStock || 0, item.createdBy || item.entryBy || "Super Admin"]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/items error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    const match = data.items.find(i => i.id !== item.id && normalizeItemKey(i.name) === targetKey);
    if (match) {
      return res.status(400).json({
        error: `Item already exists! An existing item "${match.name}" (Item ID #${match.id}) matches "${item.name}".`
      });
    }

    const idx = data.items.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      data.items[idx] = { ...data.items[idx], ...item };
    } else {
      data.items.push(item);
    }
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// POST /api/items/bulk - Bulk add/update/delete Master Items (from Excel upload or multi-create)
app.post("/api/items/bulk", async (req, res) => {
  const items = req.body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items provided for bulk upload." });
  }
  if (isPg) {
    try {
      const existingRes = await pool.query("SELECT * FROM items");
      const existingItemsMap = new Map(existingRes.rows.map(i => [String(i.id).trim().toUpperCase(), i]));
      const existingNameKeys = new Set(existingRes.rows.map(i => normalizeItemKey(i.name)));
      let insertedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        const idUpper = String(item.id || "").trim().toUpperCase();
        const actionUpper = String(item.action || "NEW").trim().toUpperCase();

        if (actionUpper === "DELETE" || actionUpper === "REMOVE") {
          if (idUpper) {
            await pool.query('DELETE FROM items WHERE UPPER("id") = $1', [idUpper]);
            deletedCount++;
          }
          continue;
        }

        if (actionUpper === "UPDATE" || actionUpper === "EDIT") {
          if (idUpper) {
            const updates = [];
            const values = [];
            let paramIdx = 1;

            if (item.name && item.name.trim() && item.name.trim().toUpperCase() !== "UPDATE") {
              updates.push(`"name" = $${paramIdx++}`);
              values.push(item.name.trim());
            }
            if (item.category && item.category.trim()) {
              updates.push(`"category" = $${paramIdx++}`);
              values.push(item.category.trim());
            }
            if (item.itemType && item.itemType.trim()) {
              updates.push(`"itemType" = $${paramIdx++}`);
              values.push(item.itemType.trim());
            }
            if (item.itemNature && item.itemNature.trim()) {
              updates.push(`"itemNature" = $${paramIdx++}`);
              values.push(item.itemNature.trim());
            }
            if (item.unit && item.unit.trim()) {
              updates.push(`"unit" = $${paramIdx++}`);
              values.push(item.unit.trim());
            }
            if (item.description && item.description.trim()) {
              updates.push(`"description" = $${paramIdx++}`);
              values.push(item.description.trim());
            }
            if (item.photo && item.photo.trim()) {
              updates.push(`"photo" = $${paramIdx++}`);
              values.push(item.photo.trim());
            }

            if (updates.length > 0) {
              values.push(idUpper);
              const sql = `UPDATE items SET ${updates.join(", ")} WHERE UPPER("id") = $${paramIdx}`;
              await pool.query(sql, values);
              updatedCount++;
            }
          }
          continue;
        }

        // Default action: NEW / INSERT
        if (!idUpper || !item.name || item.name.trim().toUpperCase() === "UPDATE") continue;
        const key = normalizeItemKey(item.name);
        if (existingNameKeys.has(key) && !existingItemsMap.has(idUpper)) {
          skippedCount++;
          continue; // Skip duplicate item names
        }
        existingNameKeys.add(key);

        await pool.query(
          `INSERT INTO items ("id", "name", "category", "itemType", "itemNature", "unit", "description", "photo", "currentStock")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "itemType" = EXCLUDED."itemType", "itemNature" = EXCLUDED."itemNature", "unit" = EXCLUDED."unit", "description" = EXCLUDED."description", "photo" = EXCLUDED."photo", "currentStock" = EXCLUDED."currentStock"`,
          [item.id, item.name, item.category || "", item.itemType || "RM", item.itemNature || "Non Consumables", item.unit || "Pcs", item.description || "", item.photo || "", item.currentStock || 0]
        );
        insertedCount++;
      }
      res.json({ success: true, count: insertedCount + updatedCount + deletedCount, insertedCount, updatedCount, deletedCount, skippedCount });
    } catch (err) {
      console.error("POST /api/items/bulk error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    const existingNameKeys = new Set(data.items.map(i => normalizeItemKey(i.name)));
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const idUpper = String(item.id || "").trim().toUpperCase();
      const actionUpper = String(item.action || "NEW").trim().toUpperCase();

      if (actionUpper === "DELETE" || actionUpper === "REMOVE") {
        data.items = data.items.filter(i => String(i.id).trim().toUpperCase() !== idUpper);
        deletedCount++;
        continue;
      }

      if (actionUpper === "UPDATE" || actionUpper === "EDIT") {
        const idx = data.items.findIndex(i => String(i.id).trim().toUpperCase() === idUpper);
        if (idx !== -1) {
          const nonNullItem = {};
          if (item.name && item.name.trim() && item.name.trim().toUpperCase() !== "UPDATE") nonNullItem.name = item.name.trim();
          if (item.category && item.category.trim()) nonNullItem.category = item.category.trim();
          if (item.itemType && item.itemType.trim()) nonNullItem.itemType = item.itemType.trim();
          if (item.itemNature && item.itemNature.trim()) nonNullItem.itemNature = item.itemNature.trim();
          if (item.unit && item.unit.trim()) nonNullItem.unit = item.unit.trim();
          if (item.description && item.description.trim()) nonNullItem.description = item.description.trim();
          if (item.photo && item.photo.trim()) nonNullItem.photo = item.photo.trim();

          if (Object.keys(nonNullItem).length > 0) {
            data.items[idx] = { ...data.items[idx], ...nonNullItem };
            updatedCount++;
          }
        }
        continue;
      }

      if (!idUpper || !item.name) continue;
      const key = normalizeItemKey(item.name);
      if (existingNameKeys.has(key) && !data.items.some(i => String(i.id).trim().toUpperCase() === idUpper)) {
        skippedCount++;
        continue;
      }
      existingNameKeys.add(key);

      const idx = data.items.findIndex(i => String(i.id).trim().toUpperCase() === idUpper);
      if (idx !== -1) {
        data.items[idx] = { ...data.items[idx], ...item };
      } else {
        data.items.push(item);
      }
      insertedCount++;
    }
    writeLocalJson(data);
    res.json({ success: true, count: insertedCount + updatedCount + deletedCount, insertedCount, updatedCount, deletedCount, skippedCount });
  }
});

// POST /api/items/delete - Single or bulk delete Master Items by ID
app.post("/api/items/delete", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No item IDs provided." });
  }
  if (isPg) {
    try {
      await pool.query(`DELETE FROM items WHERE "id" = ANY($1::text[])`, [ids]);
      res.json({ success: true, count: ids.length });
    } catch (err) {
      console.error("POST /api/items/delete error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    data.items = data.items.filter(i => !ids.includes(i.id));
    writeLocalJson(data);
    res.json({ success: true, count: ids.length });
  }
});

// POST /api/items/update - Update existing item details (Super Admin only)
app.post("/api/items/update", async (req, res) => {
  const { id, name, category, itemType, itemNature, unit, description } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: "Item ID and Name are required for update." });
  }

  const targetKey = normalizeItemKey(name);

  if (isPg) {
    try {
      const existingRes = await pool.query("SELECT * FROM items");
      const match = existingRes.rows.find(i => i.id !== id && normalizeItemKey(i.name) === targetKey);
      if (match) {
        return res.status(400).json({
          error: `Cannot rename item! An item with name "${match.name}" (Item ID #${match.id}) already exists.`
        });
      }

      await pool.query(
        `UPDATE items SET "name" = $1, "category" = $2, "itemType" = $3, "itemNature" = $4, "unit" = $5, "description" = $6 WHERE "id" = $7`,
        [name.trim(), category || "", itemType || "RM", itemNature || "Non Consumables", unit || "Pcs", description || "", id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/items/update error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    const match = data.items.find(i => i.id !== id && normalizeItemKey(i.name) === targetKey);
    if (match) {
      return res.status(400).json({
        error: `Cannot rename item! An item with name "${match.name}" (Item ID #${match.id}) already exists.`
      });
    }

    const idx = data.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      data.items[idx] = {
        ...data.items[idx],
        name: name.trim(),
        category: category || "",
        itemType: itemType || "RM",
        itemNature: itemNature || "Non Consumables",
        unit: unit || "Pcs",
        description: description || ""
      };
      writeLocalJson(data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Item not found." });
    }
  }
});

// POST /api/items/update-photo - Upload/replace item image, maintains 6-month photo history log
app.post("/api/items/update-photo", async (req, res) => {
  const { itemId, photoUrl, updatedBy } = req.body;
  if (!itemId || !photoUrl) {
    return res.status(400).json({ error: "itemId and photoUrl are required." });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

  if (isPg) {
    try {
      const itemRes = await pool.query('SELECT * FROM items WHERE "id" = $1', [itemId]);
      if (itemRes.rows.length === 0) return res.status(404).json({ error: "Item not found" });

      const item = itemRes.rows[0];
      const oldPhoto = item.photo;
      let photoHistory = [];
      try {
        photoHistory = typeof item.photo_history === "string" ? JSON.parse(item.photo_history) : (item.photo_history || []);
      } catch (e) {
        photoHistory = [];
      }

      if (oldPhoto && oldPhoto !== photoUrl) {
        photoHistory.unshift({
          id: `ph-${Date.now()}`,
          photoUrl: oldPhoto,
          updatedBy: updatedBy || "Purchaser",
          updatedAt: new Date().toISOString()
        });
      }

      // Retain logs strictly for 6 months (180 days)
      const prunedHistory = photoHistory.filter(h => new Date(h.updatedAt || h.timestamp || Date.now()) >= sixMonthsAgo);

      await pool.query(
        'UPDATE items SET "photo" = $1, "photo_history" = $2 WHERE "id" = $3',
        [photoUrl, JSON.stringify(prunedHistory), itemId]
      );
      return res.json({ success: true, photoHistory: prunedHistory });
    } catch (err) {
      console.error("Error updating photo in PG:", err.message);
      return res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    const item = data.items.find(i => i.id === itemId);
    if (item) {
      const oldPhoto = item.photo;
      if (!item.photoHistory) item.photoHistory = [];
      if (oldPhoto && oldPhoto !== photoUrl) {
        item.photoHistory.unshift({
          id: `ph-${Date.now()}`,
          photoUrl: oldPhoto,
          updatedBy: updatedBy || "Purchaser",
          updatedAt: new Date().toISOString()
        });
      }
      item.photoHistory = (item.photoHistory || []).filter(h => new Date(h.updatedAt || h.timestamp || Date.now()) >= sixMonthsAgo);
      item.photo = photoUrl;
      writeLocalJson(data);
      res.json({ success: true, photoHistory: item.photoHistory });
    } else {
      res.status(404).json({ error: "Item not found." });
    }
  }
});

// POST /api/items/merge - Merge 2 items into 1 (Super Admin only)
app.post("/api/items/merge", async (req, res) => {
  const { sourceId, targetId } = req.body;
  if (!sourceId || !targetId || sourceId === targetId) {
    return res.status(400).json({ error: "Invalid source and target item IDs for merge." });
  }

  if (isPg) {
    try {
      const sourceRes = await pool.query("SELECT * FROM items WHERE id = $1", [sourceId]);
      const targetRes = await pool.query("SELECT * FROM items WHERE id = $1", [targetId]);

      if (sourceRes.rows.length === 0 || targetRes.rows.length === 0) {
        return res.status(404).json({ error: "Source or Target item not found." });
      }

      const sourceItem = sourceRes.rows[0];
      const targetItem = targetRes.rows[0];

      // Update any orders/requests pointing to source item name to target item name
      const reqUpdateRes = await pool.query(
        'UPDATE requests SET "model" = $1 WHERE "model" = $2 OR "model" = $3',
        [targetItem.name, sourceItem.name, sourceItem.id]
      );

      // Delete source item from items table
      await pool.query("DELETE FROM items WHERE id = $1", [sourceId]);

      res.json({
        success: true,
        message: `Successfully merged "${sourceItem.name}" (#${sourceId}) into "${targetItem.name}" (#${targetId}). Updated ${reqUpdateRes.rowCount || 0} order records.`
      });
    } catch (err) {
      console.error("POST /api/items/merge error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    const sourceIdx = data.items.findIndex(i => i.id === sourceId);
    const targetIdx = data.items.findIndex(i => i.id === targetId);

    if (sourceIdx === -1 || targetIdx === -1) {
      return res.status(404).json({ error: "Source or Target item not found." });
    }

    const sourceItem = data.items[sourceIdx];
    const targetItem = data.items[targetIdx];

    // Update requests
    let updatedCount = 0;
    if (data.requests) {
      data.requests.forEach(r => {
        if (r.model === sourceItem.name || r.model === sourceItem.id) {
          r.model = targetItem.name;
          updatedCount++;
        }
      });
    }

    // Delete source item
    data.items.splice(sourceIdx, 1);
    writeLocalJson(data);

    res.json({
      success: true,
      message: `Successfully merged "${sourceItem.name}" (#${sourceId}) into "${targetItem.name}" (#${targetId}). Updated ${updatedCount} order records.`
    });
  }
});

// ==================== PRICE MANAGEMENT ENDPOINTS ====================

// 1. GET /api/prices - List prices
app.get("/api/prices", async (req, res) => {
  const { itemId, itemName, search } = req.query;
  if (isPg) {
    try {
      let query = "SELECT * FROM item_prices";
      const conditions = [];
      const values = [];
      let idx = 1;

      if (itemId) {
        conditions.push(`"itemId" = $${idx++}`);
        values.push(itemId);
      }
      if (itemName) {
        conditions.push(`"itemName" ILIKE $${idx++}`);
        values.push(`%${itemName}%`);
      }
      if (search) {
        conditions.push(`("itemId" ILIKE $${idx} OR "itemName" ILIKE $${idx})`);
        values.push(`%${search}%`);
        idx++;
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += ' ORDER BY "from" DESC, "itemName" ASC';

      const result = await pool.query(query, values);
      const rows = result.rows.map(p => ({
        ...p,
        pp: p.pp ? parseFloat(p.pp) : 0
      }));
      res.json({ success: true, prices: rows });
    } catch (err) {
      console.error("GET /api/prices error:", err.message);
      res.status(500).json({ error: "Failed to fetch item prices." });
    }
  } else {
    const data = readLocalJson();
    let list = data.itemPrices || [];
    if (itemId) list = list.filter(p => p.itemId === itemId);
    if (itemName) list = list.filter(p => (p.itemName || "").toLowerCase().includes(itemName.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.itemId || "").toLowerCase().includes(q) || (p.itemName || "").toLowerCase().includes(q));
    }
    res.json({ success: true, prices: list });
  }
});

// 2. POST /api/prices - Create or Update Single Price
app.post("/api/prices", async (req, res) => {
  const { id, itemId, itemName, pp, from, to } = req.body;
  if (!itemId && !itemName) {
    return res.status(400).json({ error: "Item ID or Item Name is required." });
  }

  const priceId = id || `prc_${itemId || Date.now()}_${Date.now().toString(36)}`;
  const ppNum = parseFloat(pp) || 0;
  const fromDate = from || new Date().toISOString().split("T")[0];
  const toDate = to || "2030-12-31";
  const nowIso = new Date().toISOString();

  if (isPg) {
    try {
      await pool.query(
        `INSERT INTO item_prices ("id", "itemId", "itemName", "pp", "from", "to", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT ("id") DO UPDATE SET
           "itemId" = EXCLUDED."itemId",
           "itemName" = EXCLUDED."itemName",
           "pp" = EXCLUDED."pp",
           "from" = EXCLUDED."from",
           "to" = EXCLUDED."to",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [priceId, itemId || "", itemName || "", ppNum, fromDate, toDate, nowIso]
      );
      res.json({ success: true, price: { id: priceId, itemId, itemName, pp: ppNum, from: fromDate, to: toDate, updatedAt: nowIso } });
    } catch (err) {
      console.error("POST /api/prices error:", err.message);
      res.status(500).json({ error: "Failed to save item price: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.itemPrices) data.itemPrices = [];
    const idx = data.itemPrices.findIndex(p => p.id === priceId || (p.itemId === itemId && p.from === fromDate));
    const priceObj = { id: priceId, itemId: itemId || "", itemName: itemName || "", pp: ppNum, from: fromDate, to: toDate, updatedAt: nowIso };
    if (idx >= 0) {
      data.itemPrices[idx] = priceObj;
    } else {
      data.itemPrices.unshift(priceObj);
    }
    writeLocalJson(data);
    res.json({ success: true, price: priceObj });
  }
});

// 3. POST /api/prices/batch - Bulk Upload Prices (from Excel / Google Sheets / TSV / CSV)
app.post("/api/prices/batch", async (req, res) => {
  const { prices } = req.body;
  if (!Array.isArray(prices) || prices.length === 0) {
    return res.status(400).json({ error: "No prices provided for batch upload." });
  }

  const nowIso = new Date().toISOString();
  let insertedCount = 0;
  let updatedCount = 0;

  if (isPg) {
    try {
      for (const p of prices) {
        const itemId = String(p.itemId || p.id || "").trim();
        const itemName = String(p.itemName || p.name || "").trim();
        if (!itemId && !itemName) continue;

        const priceId = p.id || `prc_${itemId || Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const ppNum = parseFloat(p.pp || p.price || p.purchasePrice) || 0;
        const fromDate = p.from || "2026-05-01";
        const toDate = p.to || "2030-05-01";

        const resCheck = await pool.query(
          `INSERT INTO item_prices ("id", "itemId", "itemName", "pp", "from", "to", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           ON CONFLICT ("id") DO UPDATE SET
             "itemId" = EXCLUDED."itemId",
             "itemName" = EXCLUDED."itemName",
             "pp" = EXCLUDED."pp",
             "from" = EXCLUDED."from",
             "to" = EXCLUDED."to",
             "updatedAt" = EXCLUDED."updatedAt"
           RETURNING xmax`,
          [priceId, itemId, itemName, ppNum, fromDate, toDate, nowIso]
        );
        if (resCheck.rows[0]?.xmax === 0) insertedCount++;
        else updatedCount++;
      }
      res.json({ success: true, count: insertedCount + updatedCount, insertedCount, updatedCount });
    } catch (err) {
      console.error("POST /api/prices/batch error:", err.message);
      res.status(500).json({ error: "Failed to batch upload prices: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.itemPrices) data.itemPrices = [];
    for (const p of prices) {
      const itemId = String(p.itemId || p.id || "").trim();
      const itemName = String(p.itemName || p.name || "").trim();
      if (!itemId && !itemName) continue;

      const priceId = p.id || `prc_${itemId || Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const ppNum = parseFloat(p.pp || p.price || p.purchasePrice) || 0;
      const fromDate = p.from || "2026-05-01";
      const toDate = p.to || "2030-05-01";

      const idx = data.itemPrices.findIndex(x => x.id === priceId || (x.itemId === itemId && x.from === fromDate));
      const priceObj = { id: priceId, itemId, itemName, pp: ppNum, from: fromDate, to: toDate, updatedAt: nowIso };
      if (idx >= 0) {
        data.itemPrices[idx] = priceObj;
        updatedCount++;
      } else {
        data.itemPrices.unshift(priceObj);
        insertedCount++;
      }
    }
    writeLocalJson(data);
    res.json({ success: true, count: insertedCount + updatedCount, insertedCount, updatedCount });
  }
});

// 4. POST /api/prices/delete - Bulk Delete Prices by ID array
app.post("/api/prices/delete", async (req, res) => {
  const { ids, purgeAll } = req.body;
  if (purgeAll === true) {
    if (isPg) {
      try {
        await pool.query("DELETE FROM item_prices");
        return res.json({ success: true, count: 0 });
      } catch (err) {
        console.error("PURGE prices error:", err.message);
        return res.status(500).json({ error: "Failed to purge price list." });
      }
    } else {
      const data = readLocalJson();
      data.itemPrices = [];
      writeLocalJson(data);
      return res.json({ success: true, count: 0 });
    }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No price IDs provided for deletion." });
  }

  if (isPg) {
    try {
      const deleteRes = await pool.query('DELETE FROM item_prices WHERE "id" = ANY($1::text[])', [ids]);
      res.json({ success: true, count: deleteRes.rowCount || ids.length });
    } catch (err) {
      console.error("POST /api/prices/delete error:", err.message);
      res.status(500).json({ error: "Failed to delete prices: " + err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.itemPrices) data.itemPrices = [];
    const initLen = data.itemPrices.length;
    data.itemPrices = data.itemPrices.filter(p => !ids.includes(p.id));
    const delCount = initLen - data.itemPrices.length;
    writeLocalJson(data);
    res.json({ success: true, count: delCount });
  }
});

// 5. DELETE /api/prices/:id - Delete single price entry
app.delete("/api/prices/:id", async (req, res) => {
  const priceId = req.params.id;
  if (isPg) {
    try {
      await pool.query('DELETE FROM item_prices WHERE "id" = $1', [priceId]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/prices/:id error:", err.message);
      res.status(500).json({ error: "Failed to delete price entry." });
    }
  } else {
    const data = readLocalJson();
    if (!data.itemPrices) data.itemPrices = [];
    data.itemPrices = data.itemPrices.filter(p => p.id !== priceId);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// POST /api/data/purge - Reset all sample/operational data
app.post("/api/data/purge", async (req, res) => {
  const { purgeItems = true } = req.body || {};
  if (isPg) {
    try {
      await pool.query("TRUNCATE TABLE requests, cargos, vendors, cargo_companies");
      if (purgeItems !== false) {
        await pool.query("TRUNCATE TABLE items");
      }
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/data/purge error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    data.requests = [];
    data.cargos = [];
    data.vendors = [];
    data.cargoCompanies = [];
    if (purgeItems !== false) data.items = [];
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 9. POST /api/backup/import - Overwrites database with imported JSON backup
app.post("/api/backup/import", async (req, res) => {
  const data = req.body;
  if (!data.users || !data.vendors || !data.requests || !data.cargos) {
    return res.status(400).json({ error: "Invalid backup format." });
  }

  if (isPg) {
    try {
      await pool.query("BEGIN");

      // Truncate tables
      await pool.query("TRUNCATE TABLE users, vendors, cargo_companies, cargos, requests");

      // Re-seed Users
      for (const u of data.users) {
        await pool.query(
          `INSERT INTO users ("id", "name", "email", "password", "role", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
          [u.id, u.name, u.email, u.password, u.role, u.status]
        );
      }

      // Re-seed Vendors
      for (const v of data.vendors) {
        await pool.query(
          `INSERT INTO vendors ("id", "name", "location", "phone", "history", "status", "purchaserIds") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [v.id, v.name, v.location, v.phone, v.history, v.status, JSON.stringify(v.purchaserIds)]
        );
      }

      // Re-seed Cargo Companies
      if (data.cargoCompanies) {
        for (const cc of data.cargoCompanies) {
          await pool.query(
            `INSERT INTO cargo_companies ("id", "name", "location", "phone", "history", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
            [cc.id, cc.name, cc.location, cc.phone, cc.history, cc.status]
          );
        }
      }

      // Re-seed Cargos
      for (const c of data.cargos) {
        await pool.query(
          `INSERT INTO cargos (
            "id", "vendorId", "cargoOrderDate", "cargoDetail", "cargoPrice", "cargoPriceUom",
            "cbmPackingList", "totalCargoPrice", "modeOfTransport", "cargoShippingDate", "cargoEta",
            "packingListFile", "invoiceFile", "isMaterialRec", "receivedDate", "currency"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            c.id, c.vendorId, c.cargoOrderDate, c.cargoDetail, c.cargoPrice, c.cargoPriceUom,
            c.cbmPackingList, c.totalCargoPrice, c.modeOfTransport, c.cargoShippingDate, c.cargoEta,
            c.packingListFile, c.invoiceFile, c.isMaterialRec, c.receivedDate, c.currency
          ]
        );
      }

      // Re-seed Requests
      for (const r of data.requests) {
        await pool.query(
          `INSERT INTO requests (
            "id", "purchaserId", "vendorId", "orderDate", "type", "model", "orderQuantity",
            "priceRmb", "totalRmb", "advancePayment", "balancePayment", "photo", "vendorEdd",
            "cargoId", "isMaterialRec", "actualReceivedDate", "notes", "itemNature", "category",
            "requiredByDate", "entryBy", "packingOrderedByNitin", "purchaseUpdated", "status",
            "cancellationReason", "cancelledAt", "cargoAssignedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
          [
            r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, r.orderQuantity,
            r.priceRmb || null, r.totalRmb || null, r.advancePayment || null, r.balancePayment || null,
            r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No",
            r.actualReceivedDate || "", r.notes || "", r.itemNature || "Non Consumables", r.category || "",
            r.requiredByDate || "", r.entryBy || "", r.packingOrderedByNitin || "No", r.purchaseUpdated || "No",
            r.status || "Active", r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || ""
          ]
        );
      }

      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("POST /api/backup/import error:", err.message);
      res.status(500).json({ error: "Failed to import database backup." });
    }
  } else {
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 10. DELETE /api/vendors/:id - Deletes a vendor
app.delete("/api/vendors/:id", async (req, res) => {
  const { id } = req.params;
  if (isPg) {
    try {
      await pool.query('DELETE FROM vendors WHERE "id" = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/vendors error:", err.message);
      res.status(500).json({ error: "Failed to delete vendor." });
    }
  } else {
    const data = readLocalJson();
    data.vendors = data.vendors.filter(x => x.id !== id);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 11. DELETE /api/cargo-companies/:id - Deletes a cargo carrier
app.delete("/api/cargo-companies/:id", async (req, res) => {
  const { id } = req.params;
  if (isPg) {
    try {
      await pool.query('DELETE FROM cargo_companies WHERE "id" = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/cargo-companies error:", err.message);
      res.status(500).json({ error: "Failed to delete cargo company." });
    }
  } else {
    const data = readLocalJson();
    data.cargoCompanies = data.cargoCompanies.filter(x => x.id !== id);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// 12. GET /web - Secret Panic Trigger URL: Hides the application and redirects to redirectUrl (Instagram page)
app.get("/web", async (req, res) => {
  let redirectUrl = "https://www.instagram.com/makpowerofficial/";
  try {
    if (isPg) {
      // Set isHidden to true
      await pool.query('INSERT INTO settings ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = $2', ["isHidden", "true"]);
      // Fetch current redirectUrl
      const urlRes = await pool.query('SELECT "value" FROM settings WHERE "key" = $1', ["redirectUrl"]);
      if (urlRes.rows.length > 0 && urlRes.rows[0].value) {
        redirectUrl = urlRes.rows[0].value;
      }
    } else {
      const data = readLocalJson();
      data.settings = data.settings || {};
      data.settings.isHidden = true;
      if (data.settings.redirectUrl) {
        redirectUrl = data.settings.redirectUrl;
      }
      writeLocalJson(data);
    }
    console.log("System Panic Activated! System is hidden. Redirecting to:", redirectUrl);
  } catch (err) {
    console.error("Panic trigger /web error:", err.message);
  }
  res.redirect(redirectUrl);
});

// 13. POST /api/settings - Updates system settings
app.post("/api/settings", async (req, res) => {
  const settingsObj = req.body || {};
  if (isPg) {
    try {
      for (const [key, val] of Object.entries(settingsObj)) {
        const valStr = typeof val === "boolean" ? (val ? "true" : "false") : String(val ?? "");
        await pool.query('INSERT INTO settings ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = $2', [key, valStr]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/settings error:", err.message);
      res.status(500).json({ error: "Failed to update settings." });
    }
  } else {
    const data = readLocalJson();
    data.settings = data.settings || {};
    Object.assign(data.settings, settingsObj);
    writeLocalJson(data);
    res.json({ success: true });
  }
});

// POST /api/settings/force-refresh - Triggers a force reload signal for all active webapp clients
app.post("/api/settings/force-refresh", async (req, res) => {
  const ts = Date.now().toString();
  if (isPg) {
    try {
      await pool.query('INSERT INTO settings ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = $2', ["forceRefreshTimestamp", ts]);
      res.json({ success: true, forceRefreshTimestamp: ts });
    } catch (err) {
      console.error("POST /api/settings/force-refresh error:", err.message);
      res.status(500).json({ error: "Failed to set force refresh timestamp." });
    }
  } else {
    const data = readLocalJson();
    data.settings = data.settings || {};
    data.settings.forceRefreshTimestamp = ts;
    writeLocalJson(data);
    res.json({ success: true, forceRefreshTimestamp: ts });
  }
});

// Serve frontend compiled client assets in production
app.use(express.static(path.join(__dirname, "dist")));

// SPA Router Fallback - routes all other routes to React SPA index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start Express Listener immediately on 0.0.0.0 (required for Render / cloud container port binding)
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server started and listening on http://${HOST}:${PORT} (PORT=${PORT})`);
});
