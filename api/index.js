import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";

const app = express();

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

app.use(cors());
app.use(express.json());

let initialized = false;

async function initializeDatabase() {
  if (initialized) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      vehicle TEXT NOT NULL DEFAULT '',
      plate TEXT NOT NULL DEFAULT '',
      vin TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Unlisted',
      notes TEXT NOT NULL DEFAULT '',
      ocr TEXT NOT NULL DEFAULT '',
      updated TEXT NOT NULL
    )
  `);

  initialized = true;
}

app.get("/api/health", async (_req, res) => {
  try {
    await initializeDatabase();

    const r = await db.execute("SELECT 1 AS ok");

    res.json({
      ok: true,
      database: "connected",
      result: r.rows
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

app.get("/api/vehicles", async (_req, res) => {
  try {
    await initializeDatabase();

    const result = await db.execute(
      "SELECT * FROM vehicles ORDER BY updated DESC"
    );

    res.json(result.rows);
  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

app.post("/api/vehicles", async (req, res) => {
  try {
    await initializeDatabase();

    const {
      id,
      vehicle = "",
      plate = "",
      vin = "",
      status = "Unlisted",
      notes = "",
      ocr = "",
      updated = new Date().toISOString()
    } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "Vehicle ID is required"
      });
    }

    await db.execute({
      sql: `
        INSERT INTO vehicles
        (id, vehicle, plate, vin, status, notes, ocr, updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          vehicle=excluded.vehicle,
          plate=excluded.plate,
          vin=excluded.vin,
          status=excluded.status,
          notes=excluded.notes,
          ocr=excluded.ocr,
          updated=excluded.updated
      `,
      args: [
        id,
        vehicle,
        plate,
        vin,
        status,
        notes,
        ocr,
        updated
      ]
    });

    res.json({ ok: true });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: e.message
    });
  }
});

app.delete("/api/vehicles/:id", async (req, res) => {
  try {
    await initializeDatabase();

    await db.execute({
      sql: "DELETE FROM vehicles WHERE id = ?",
      args: [req.params.id]
    });

    res.json({ ok: true });

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

export default app;