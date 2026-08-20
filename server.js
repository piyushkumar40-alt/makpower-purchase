import express from "express";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { initialUsers, initialVendors, initialRequests, initialCargoShipments, initialCargoCompanies } from "./src/mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "50mb" }));

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
  } catch (err) {
    console.error("PostgreSQL connection failed. Falling back to local JSON file database. Error:", err.message);
  }
} else {
  console.log("No DATABASE_URL found. Using local JSON database (db.json) for development.");
}

// Local File Database Helper (Fallback)
const DB_FILE = path.join(__dirname, "db.json");

function readLocalJson() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: initialUsers,
      vendors: initialVendors,
      requests: initialRequests,
      cargos: initialCargoShipments,
      cargoCompanies: initialCargoCompanies,
      settings: {
        isHidden: false,
        redirectUrl: "https://www.instagram.com/makpowerofficial/"
      }
    };
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
    if (Array.isArray(data.requests)) {
      data.requests = data.requests.map(r => ({ ...r, purchaseUpdated: "No" }));
    }
    const adminIdx = data.users.findIndex(x => x.id === "u-admin" || x.role === "superadmin" || x.email === "admin@company.com");
    if (adminIdx !== -1 && data.users[adminIdx].password === "MakPower#Admin2026!") {
      data.users[adminIdx].password = "112233";
      writeLocalJson(data);
    }
    return data;
  } catch (e) {
    console.error("Error reading db.json, returning default mock data:", e.message);
    return {
      users: initialUsers,
      vendors: initialVendors,
      requests: initialRequests,
      cargos: initialCargoShipments,
      cargoCompanies: initialCargoCompanies,
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
    `);

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

    // Sync Users to new @makpowerindia.com list if legacy users exist
    const legacyUserCheck = await pool.query("SELECT COUNT(*) FROM users WHERE email LIKE '%@company.com'");
    if (parseInt(legacyUserCheck.rows[0].count) > 0) {
      await pool.query("DELETE FROM users");
      for (const u of initialUsers) {
        await pool.query(
          `INSERT INTO users ("id", "name", "email", "password", "role", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
          [u.id, u.name, u.email, u.password, u.role, u.status]
        );
      }
      console.log("Re-synced users to @makpowerindia.com domain.");
    }

    // 2. Check if seeding is required
    const userCheck = await pool.query("SELECT COUNT(*) FROM users");
    const count = parseInt(userCheck.rows[0].count);
    if (count === 0) {
      console.log("PG Database is empty. Seeding initial data...");

      // Seed Users
      for (const u of initialUsers) {
        await pool.query(
          `INSERT INTO users ("id", "name", "email", "password", "role", "status") VALUES ($1, $2, $3, $4, $5, $6)`,
          [u.id, u.name, u.email, u.password, u.role, u.status]
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

    // Set purchaseUpdated = 'No' for all items in the database
    await pool.query(`UPDATE requests SET "purchaseUpdated" = 'No'`);

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

// Run DB setup on start
await setupPgDatabase();

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
      packingOrderedByNitin: r.packingOrderedByNitin === "Yes" ? "Packing Ordered" : "Pending Packing",
      purchaseUpdated: r.purchaseUpdated || ""
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

// 1. GET /api/state - Fetches full system state
app.get("/api/state", async (req, res) => {
  if (isPg) {
    try {
      const usersRes = await pool.query("SELECT * FROM users");
      const vendorsRes = await pool.query("SELECT * FROM vendors");
      const cargoCompaniesRes = await pool.query("SELECT * FROM cargo_companies");
      const cargosRes = await pool.query("SELECT * FROM cargos");
      const requestsRes = await pool.query("SELECT * FROM requests");
      const settingsRes = await pool.query("SELECT * FROM settings");
      const itemsRes = await pool.query("SELECT * FROM items ORDER BY CAST(NULLIF(regexp_replace(\"id\", '\\D', '', 'g'), '') AS INTEGER) ASC, \"id\" ASC");

      // Format types back
      const vendors = vendorsRes.rows.map(v => ({
        ...v,
        purchaserIds: v.purchaserIds ? JSON.parse(v.purchaserIds) : []
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

      res.json({
        users: usersRes.rows,
        vendors,
        cargoCompanies: cargoCompaniesRes.rows,
        cargos,
        requests,
        settings,
        items: itemsRes.rows || []
      });
    } catch (err) {
      console.error("GET /api/state error:", err.message);
      res.status(500).json({ error: "Failed to query PG state." });
    }
  } else {
    res.json(readLocalJson());
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
  }
});

// ==================== SYSTEM AUDIT LOGS & VERSION HISTORY API ====================

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

// Serve frontend compiled client assets in production
app.use(express.static(path.join(__dirname, "dist")));

// SPA Router Fallback - routes all other routes to React SPA index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
