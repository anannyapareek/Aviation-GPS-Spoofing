/**
 * Production Node.js server for Render deployment.
 *
 * The TanStack Start build produces:
 *   dist/client/  – static assets (JS, CSS, images)
 *   dist/server/server.js – SSR handler that exports { default: { fetch(Request) => Response } }
 *
 * This script bridges the Web-API fetch interface to a standard Node.js HTTP server,
 * serving static assets from dist/client and falling back to SSR for everything else.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client");

// ── MIME types for static file serving ──────────────────────────────────
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

// ── Import the SSR server (built by TanStack Start) ─────────────────────
const { default: ssrServer } = await import("./dist/server/server.js");

// ── Static file handler ─────────────────────────────────────────────────
async function tryServeStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = join(CLIENT_DIR, url.pathname);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(CLIENT_DIR)) return false;

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return false;

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await readFile(filePath);

    const headers = {
      "Content-Type": contentType,
      "Content-Length": content.length,
    };

    // Vite hashes asset filenames, so they can be cached forever
    if (url.pathname.startsWith("/assets/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }

    res.writeHead(200, headers);
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

// ── Convert Node.js IncomingMessage → Web API Request ───────────────────
function toWebRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

// ── Stream a Web API Response back to Node.js ServerResponse ────────────
async function sendWebResponse(webResponse, res) {
  // Collect all Set-Cookie headers properly
  const headerEntries = {};
  const setCookies = [];
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      setCookies.push(value);
    } else {
      headerEntries[key] = value;
    }
  });

  res.writeHead(webResponse.status, headerEntries);
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      res.setHeader("Set-Cookie", cookie);
    }
  }

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}

// ── Main HTTP server ────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // 1. Try serving a static file from dist/client
  if (await tryServeStatic(req, res)) return;

  // 2. Fall back to SSR
  try {
    const webRequest = toWebRequest(req);
    const webResponse = await ssrServer.fetch(webRequest);
    await sendWebResponse(webResponse, res);
  } catch (error) {
    console.error("SSR Error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
    }
    res.end("Internal Server Error");
  }
});

// ── Start listening ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Production server running on http://0.0.0.0:${PORT}`);
});
