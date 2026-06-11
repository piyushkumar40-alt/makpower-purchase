import express from "express";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initialUsers, initialVendors, initialRequests, initialCargoShipments, initialCargoCompanies } from "./src/mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3001;

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
      cargoCompanies: initialCargoCompanies
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    console.error("Error reading db.json, returning default mock data:", e.message);
    return {
      users: initialUsers,
      vendors: initialVendors,
      requests: initialRequests,
      cargos: initialCargoShipments,
      cargoCompanies: initialCargoCompanies
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
  } catch (err) {
    console.error("Error setting up PostgreSQL schemas/seeds:", err.message);
  }
}

// Run DB setup on start
await setupPgDatabase();

// ==================== API ENDPOINTS ====================

// 1. GET /api/state - Fetches full system state
app.get("/api/state", async (req, res) => {
  if (isPg) {
    try {
      const usersRes = await pool.query("SELECT * FROM users");
      const vendorsRes = await pool.query("SELECT * FROM vendors");
      const cargoCompaniesRes = await pool.query("SELECT * FROM cargo_companies");
      const cargosRes = await pool.query("SELECT * FROM cargos");
      const requestsRes = await pool.query("SELECT * FROM requests");

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

      res.json({
        users: usersRes.rows,
        vendors,
        cargoCompanies: cargoCompaniesRes.rows,
        cargos,
        requests
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
