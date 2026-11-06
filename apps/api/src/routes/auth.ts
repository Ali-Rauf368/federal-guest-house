import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { COOKIE, issueSession, requireAuth } from "../auth";
import { prisma } from "../db/prisma";
import { logAccess } from "../lib/access-log";
import { HttpError } from "../lib/http";
import { hashPassword, verifyPassword } from "../lib/password";

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma().user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Email or password is incorrect");
  }
  issueSession(res, user.id);
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  logAccess(req, "login", "user", user.id);
  res.json({ user: req.user });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE);
  res.status(204).end();
});

authRouter.post("/password", loginLimiter, requireAuth, async (req, res) => {
  const { current, next } = z.object({ current: z.string().min(1), next: z.string().min(10, "Use at least 10 characters") }).parse(req.body);
  const user = await prisma().user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  await prisma().user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  logAccess(req, "change-password", "user", user.id);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
