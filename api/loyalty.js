const { neon } = require("@neondatabase/serverless");
const crypto = require("node:crypto");

const COOKIE_NAME = "msh_loyalty_session";
const SESSION_SECONDS = 8 * 60 * 60;
let schemaPromise;

function json(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function makeCookie(req, value, maxAge) {
  const secure = process.env.VERCEL === "1" || req.headers["x-forwarded-proto"] === "https";
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : [])
  ].join("; ");
}

function getCookie(req) {
  const header = req.headers.cookie || "";
  const part = header.split(";").map(v => v.trim())
    .find(v => v.startsWith(COOKIE_NAME + "="));
  return part ? part.slice(COOKIE_NAME.length + 1) : "";
}

function isAuthenticated(req) {
  const secret = process.env.LOYALTY_SESSION_SECRET;
  if (!secret) return false;
  const token = getCookie(req);
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiresAt = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expiresAt, secret));
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  // Normalize common Indian phone formats: +91XXXXXXXXXX and 0XXXXXXXXXX.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function validatePhone(value) {
  const phone = normalizePhone(value);
  if (phone.length < 7 || phone.length > 15) {
    const error = new Error("Enter a valid phone number (7–15 digits).");
    error.status = 400;
    throw error;
  }
  return phone;
}

function validateName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    const error = new Error("Enter a customer name between 2 and 80 characters.");
    error.status = 400;
    throw error;
  }
  return name;
}

async function getDatabase() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("Loyalty database is not configured. Follow LOYALTY_SETUP.md to connect a database.");
    error.status = 503;
    throw error;
  }
  const sql = neon(process.env.DATABASE_URL);
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql.query(`
        CREATE TABLE IF NOT EXISTS loyalty_customers (
          phone VARCHAR(15) PRIMARY KEY CHECK (phone ~ '^[0-9]{7,15}$'),
          name VARCHAR(80) NOT NULL,
          visits INTEGER NOT NULL DEFAULT 0 CHECK (visits >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_visit TIMESTAMPTZ
        )
      `, []);
      await sql.query(`
        CREATE TABLE IF NOT EXISTS loyalty_visits (
          id BIGSERIAL PRIMARY KEY,
          customer_phone VARCHAR(15) NOT NULL REFERENCES loyalty_customers(phone),
          visit_number INTEGER NOT NULL,
          visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, []);
      await sql.query(
        "CREATE INDEX IF NOT EXISTS loyalty_visits_phone_date_idx ON loyalty_visits (customer_phone, visited_at DESC)",
        []
      );
    })().catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return sql;
}

function shapeCustomer(row) {
  if (!row) return null;
  return {
    phone: String(row.phone),
    name: String(row.name),
    visits: Number(row.visits) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    lastVisit: row.last_visit ? new Date(row.last_visit).toISOString() : null
  };
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch {
    const error = new Error("Invalid request origin.");
    error.status = 403;
    throw error;
  }
  if (originHost !== req.headers.host) {
    const error = new Error("Cross-origin requests are not allowed.");
    error.status = 403;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const queryAction = req.query && req.query.action;
  if (req.method === "GET" && queryAction === "me") {
    return json(res, 200, { authenticated: isAuthenticated(req) });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    assertSameOrigin(req);
    const body = requestBody(req);
    const action = String(body.action || "");

    if (action === "login") {
      const configuredPassword = process.env.LOYALTY_ADMIN_PASSWORD;
      const secret = process.env.LOYALTY_SESSION_SECRET;
      if (!configuredPassword || !secret || !process.env.DATABASE_URL) {
        return json(res, 503, {
          error: "The loyalty service is not configured yet. Follow LOYALTY_SETUP.md before using it."
        });
      }
      if (!safeEqual(body.password || "", configuredPassword)) {
        return json(res, 401, { error: "Incorrect staff password." });
      }
      const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
      const token = expiry + "." + sign(expiry, secret);
      res.setHeader("Set-Cookie", makeCookie(req, token, SESSION_SECONDS));
      return json(res, 200, { ok: true });
    }

    if (action === "logout") {
      res.setHeader("Set-Cookie", makeCookie(req, "", 0));
      return json(res, 200, { ok: true });
    }

    if (!isAuthenticated(req)) {
      return json(res, 401, { error: "Please sign in with the staff password again." });
    }

    const sql = await getDatabase();

    if (action === "search") {
      const phone = validatePhone(body.phone);
      const rows = await sql.query(
        "SELECT phone, name, visits, created_at, last_visit FROM loyalty_customers WHERE phone = $1 LIMIT 1",
        [phone]
      );
      return json(res, 200, { customer: shapeCustomer(rows[0]) });
    }

    if (action === "register") {
      const phone = validatePhone(body.phone);
      const name = validateName(body.name);
      try {
        const rows = await sql.query(
          "INSERT INTO loyalty_customers (phone, name) VALUES ($1, $2) RETURNING phone, name, visits, created_at, last_visit",
          [phone, name]
        );
        return json(res, 201, { customer: shapeCustomer(rows[0]) });
      } catch (error) {
        if (error && error.code === "23505") {
          return json(res, 409, { error: "This phone number is already registered. Search for the existing member instead." });
        }
        throw error;
      }
    }

    if (action === "visit") {
      const phone = validatePhone(body.phone);
      const rows = await sql.query(`
        WITH updated AS (
          UPDATE loyalty_customers
          SET visits = visits + 1, last_visit = NOW()
          WHERE phone = $1
          RETURNING phone, name, visits, created_at, last_visit
        ), logged AS (
          INSERT INTO loyalty_visits (customer_phone, visit_number)
          SELECT phone, visits FROM updated
          RETURNING customer_phone, visit_number
        )
        SELECT updated.phone, updated.name, updated.visits, updated.created_at, updated.last_visit
        FROM updated
        JOIN logged ON logged.customer_phone = updated.phone
                  AND logged.visit_number = updated.visits
      `, [phone]);
      if (!rows[0]) return json(res, 404, { error: "Customer not found. Register them first." });
      return json(res, 200, { customer: shapeCustomer(rows[0]) });
    }

    return json(res, 400, { error: "Unknown action." });
  } catch (error) {
    const status = Number(error && error.status) || 500;
    if (status >= 500) {
      console.error("Loyalty API error:", error);
      return json(res, status, {
        error: status === 503
          ? error.message
          : "The loyalty request could not be completed. Please try again."
      });
    }
    return json(res, status, { error: error.message || "Invalid request." });
  }
};
