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
        "status" TEXT
      );
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
        "cargoAssignedAt" TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "category" TEXT,
        "itemNature" TEXT,
        "unit" TEXT,
        "description" TEXT,
        "photo" TEXT,
        "currentStock" INTEGER
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

function recordAuthAuditLog(userId, userName, role, action, details = "") {
  const logEntry = {
    id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
    userId,
    userName,
    role,
    action,
    timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    isoTime: new Date().toISOString(),
    details
  };
  authAuditLogs.unshift(logEntry);
  if (authAuditLogs.length > 500) authAuditLogs = authAuditLogs.slice(0, 500);
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

  // Exclude delivered orders from Google Sheets sync (only sync pending/in-transit items)
  const activePendingRequests = requests.filter(r => {
    const isDelivered = (r.isMaterialRec === "Yes" || Boolean(r.actualReceivedDate && r.actualReceivedDate.trim() !== "") || r.status === "Delivered");
    return !isDelivered;
  });

  const rows = activePendingRequests.map(r => {
    const purchaser = users.find(u => u.id === r.purchaserId)?.name || "";
    const vendor = vendors.find(v => v.id === r.vendorId)?.name || "";
    const cargo = cargos.find(c => c.id === r.cargoId) || {};

    return {
      purchaser: purchaser || "",
      vendor: vendor || "",
      orderDate: r.orderDate || "",
      type: r.type || "",
      model: r.model || "",
      orderQuantity: r.orderQuantity != null ? String(r.orderQuantity) : "",
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
      packingOrderedByNitin: r.packingOrderedByNitin || "",
      purchaseUpdated: r.purchaseUpdated || ""
    };
  });

  return rows;
}

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

// Smart Activity-Driven Auto-Sync Engine (Only syncs if order activity occurred in last 10 mins)
let isOrderDataDirty = true; // Initial sync on startup if enabled

setInterval(async () => {
  try {
    let settingsObj = {};
    if (isPg) {
      const res = await pool.query("SELECT * FROM settings");
      (res.rows || []).forEach(r => { settingsObj[r.key] = r.value; });
    } else {
      settingsObj = memoryDb.settings || {};
    }

    const autoSyncEnabled = settingsObj.googleSheetAutoSyncEnabled === "true" || settingsObj.googleSheetAutoSyncEnabled === true;
    
    if (autoSyncEnabled && settingsObj.googleSheetWebhookUrl) {
      if (isOrderDataDirty) {
        console.log("Order changes detected! Triggering 10-minute automated Google Sheets Sync...");
        const result = await performGoogleSheetSync();
        if (result.success) {
          isOrderDataDirty = false; // Reset dirty flag after successful sync
        }
      } else {
        console.log("No order activity in the last 10 minutes. Skipping Google Sheets sync.");
      }
    }
  } catch (err) {
    console.error("10-minute Smart Google Sheets cron error:", err);
  }
}, 10 * 60 * 1000);

// Endpoint POST /api/google-sheets/sync (Manual instant sync)
app.post("/api/google-sheets/sync", async (req, res) => {
  const result = await performGoogleSheetSync();
  if (result.success) isOrderDataDirty = false;
  return res.json(result);
});

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
          "cancellationReason", "cancelledAt", "cargoAssignedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
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
          "cargoAssignedAt" = EXCLUDED."cargoAssignedAt"
      `;
      const values = [
        r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, parseInt(r.orderQuantity || 0),
        r.priceRmb === "" ? null : parseFloat(r.priceRmb), r.totalRmb === "" ? null : parseFloat(r.totalRmb),
        r.advancePayment === "" ? null : parseFloat(r.advancePayment), r.balancePayment === "" ? null : parseFloat(r.balancePayment),
        r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No", r.actualReceivedDate || "",
        r.notes || "", r.itemNature || "Non Consumables", r.category || "", r.requiredByDate || "", r.entryBy || "",
        r.packingOrderedByNitin || "No", r.purchaseUpdated || "No", r.status || "Active",
        r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || ""
      ];
      await pool.query(query, values);
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
            "cancellationReason", "cancelledAt", "cargoAssignedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
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
            "cargoAssignedAt" = EXCLUDED."cargoAssignedAt"
        `;
        const values = [
          r.id, r.purchaserId, r.vendorId, r.orderDate, r.type, r.model, parseInt(r.orderQuantity || 0),
          r.priceRmb === "" ? null : parseFloat(r.priceRmb), r.totalRmb === "" ? null : parseFloat(r.totalRmb),
          r.advancePayment === "" ? null : parseFloat(r.advancePayment), r.balancePayment === "" ? null : parseFloat(r.balancePayment),
          r.photo || "", r.vendorEdd || "", r.cargoId || "", r.isMaterialRec || "No", r.actualReceivedDate || "",
          r.notes || "", r.itemNature || "Non Consumables", r.category || "", r.requiredByDate || "", r.entryBy || "",
          r.packingOrderedByNitin || "No", r.purchaseUpdated || "No", r.status || "Active",
          r.cancellationReason || "", r.cancelledAt || "", r.cargoAssignedAt || ""
        ];
        await pool.query(query, values);
      }
      await pool.query("COMMIT");
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
        `INSERT INTO users ("id", "name", "email", "password", "role", "status") VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "email" = EXCLUDED."email", "password" = EXCLUDED."password", "role" = EXCLUDED."role", "status" = EXCLUDED."status"`,
        [u.id, u.name, u.email, u.password, u.role, u.status]
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
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found." });
    }
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

// POST /api/items - Add or update a single Master Item
app.post("/api/items", async (req, res) => {
  const item = req.body;
  if (!item.id || !item.name) {
    return res.status(400).json({ error: "Item ID and Item Name are required." });
  }
  if (isPg) {
    try {
      await pool.query(
        `INSERT INTO items ("id", "name", "category", "itemNature", "unit", "description", "photo", "currentStock")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "itemNature" = EXCLUDED."itemNature", "unit" = EXCLUDED."unit", "description" = EXCLUDED."description", "photo" = EXCLUDED."photo", "currentStock" = EXCLUDED."currentStock"`,
        [item.id, item.name, item.category || "", item.itemNature || "Non Consumables", item.unit || "Pcs", item.description || "", item.photo || "", item.currentStock || 0]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("POST /api/items error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
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

// POST /api/items/bulk - Bulk add/update Master Items (from Excel upload)
app.post("/api/items/bulk", async (req, res) => {
  const items = req.body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items provided for bulk upload." });
  }
  if (isPg) {
    try {
      for (const item of items) {
        if (!item.id || !item.name) continue;
        await pool.query(
          `INSERT INTO items ("id", "name", "category", "itemNature", "unit", "description", "photo", "currentStock")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category", "itemNature" = EXCLUDED."itemNature", "unit" = EXCLUDED."unit", "description" = EXCLUDED."description", "photo" = EXCLUDED."photo", "currentStock" = EXCLUDED."currentStock"`,
          [item.id, item.name, item.category || "", item.itemNature || "Non Consumables", item.unit || "Pcs", item.description || "", item.photo || "", item.currentStock || 0]
        );
      }
      res.json({ success: true, count: items.length });
    } catch (err) {
      console.error("POST /api/items/bulk error:", err.message);
      res.status(500).json({ error: err.message });
    }
  } else {
    const data = readLocalJson();
    if (!data.items) data.items = [];
    for (const item of items) {
      if (!item.id || !item.name) continue;
      const idx = data.items.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        data.items[idx] = { ...data.items[idx], ...item };
      } else {
        data.items.push(item);
      }
    }
    writeLocalJson(data);
    res.json({ success: true, count: items.length });
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

// POST /api/data/purge - Reset all sample/operational data
app.post("/api/data/purge", async (req, res) => {
  const { purgeItems } = req.body || {};
  if (isPg) {
    try {
      await pool.query("TRUNCATE TABLE requests, cargos, vendors, cargo_companies");
      if (purgeItems) {
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
    if (purgeItems) data.items = [];
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
