import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import path from "node:path";
import { allow, requireAuth } from "./auth";
import { config } from "./config";
import { errorHandler, HttpError } from "./lib/http";
import { activityRouter } from "./routes/activity";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { guestsRouter } from "./routes/guests";
import { reservationsRouter } from "./routes/reservations";
import { roomsRouter } from "./routes/rooms";
import { staffRouter } from "./routes/staff";

export function createApp() {
  const app = express();
  app.set("trust proxy", config().TRUST_PROXY);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], fontSrc: ["'self'", "https://fonts.gstatic.com"] },
      },
    }),
  );
  app.use(cors({ origin: config().CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api", requireAuth);
  app.use("/api/dashboard", allow("ADMIN", "RECEPTION"), dashboardRouter);
  app.use("/api/guests", allow("ADMIN", "RECEPTION"), guestsRouter);
  app.use("/api/reservations", allow("ADMIN", "RECEPTION"), reservationsRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/staff", allow("ADMIN"), staffRouter);
  app.use("/api/activity", allow("ADMIN"), activityRouter);
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));
  // In production the API also serves the built web app, so one process and one origin run everything.
  const web = path.resolve(__dirname, "../../web/dist");
  if (existsSync(path.join(web, "index.html"))) {
    app.use(express.static(web));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(web, "index.html")));
  }
  app.use(errorHandler);
  return app;
}
