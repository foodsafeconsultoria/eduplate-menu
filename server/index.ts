import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import stripeRouter from "./stripe.js";
import emailRouter from "./email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Parse JSON for all API routes ────────────────────────────────────────
  // The webhook route uses express.raw() internally (applied per-route),
  // so it's safe to have express.json() here globally.
  app.use(express.json());

  // ── Stripe routes ─────────────────────────────────────────────────────────
  app.use('/api/stripe', stripeRouter);

  // ── Email routes ──────────────────────────────────────────────────────────
  app.use('/api/email', emailRouter);

  // ── Static files (production build) ──────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (process.env.NODE_ENV !== "production") {
      console.log("  Stripe API routes available at /api/stripe/*");
    }
  });
}

startServer().catch(console.error);
