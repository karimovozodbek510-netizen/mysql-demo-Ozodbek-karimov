import mysql from "mysql2/promise";

// Environment variable names configured on the site are DB_PASSWORD and
// DB_DATABASE; the older DB_PASS / DB_NAME names are kept as fallbacks.
function dbConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? process.env.DB_PASS,
    database: process.env.DB_DATABASE ?? process.env.DB_NAME,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectTimeout: 10000,
  };
}

let tableReady = false;

async function ensureTable(db) {
  if (tableReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

async function listNotes(db) {
  const [rows] = await db.execute(
    "SELECT name, created_at FROM notes ORDER BY id DESC LIMIT 50"
  );
  return rows;
}

export default async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ error: "Ruxsat etilmagan so‘rov" }, { status: 405 });
  }

  let name = "";
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
    }
    name = String(body?.name ?? "").trim().slice(0, 100);
    if (!name) {
      return Response.json({ error: "Ism kiritilmagan" }, { status: 400 });
    }
  }

  let db;
  try {
    db = await mysql.createConnection(dbConfig());
  } catch (err) {
    console.error("MySQL connection failed:", err.code || err.message);
    return Response.json(
      { error: "Ma’lumotlar bazasiga ulanib bo‘lmadi" },
      { status: 503 }
    );
  }

  try {
    await ensureTable(db);
    if (req.method === "POST") {
      await db.execute("INSERT INTO notes (name) VALUES (?)", [name]);
      return Response.json(
        { ok: true, name, rows: await listNotes(db) },
        { status: 201 }
      );
    }
    return Response.json(await listNotes(db));
  } catch (err) {
    console.error("MySQL query failed:", err.code || err.message);
    return Response.json({ error: "Server xatosi" }, { status: 500 });
  } finally {
    await db.end().catch(() => {});
  }
};
