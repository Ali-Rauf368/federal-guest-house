import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { logAccess } from "../lib/access-log";
import { HttpError, param } from "../lib/http";
import { hashPassword } from "../lib/password";

export const staffRouter = Router();

const select = { id: true, email: true, name: true, role: true, active: true } as const;

staffRouter.get("/", async (_req, res) => {
  res.json(await prisma().user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select }));
});

staffRouter.post("/", async (req, res) => {
  const input = z
    .object({
      email: z.string().email(),
      name: z.string().trim().min(2),
      role: z.enum(["ADMIN", "RECEPTION", "HOUSEKEEPING"]),
      password: z.string().min(10, "Use at least 10 characters"),
    })
    .parse(req.body);
  const email = input.email.toLowerCase();
  if (await prisma().user.findUnique({ where: { email } })) throw new HttpError(409, "That email is already in use");
  const user = await prisma().user.create({
    data: { email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) },
    select,
  });
  logAccess(req, "create", "user", user.id, `${user.name} (${user.role})`);
  res.status(201).json(user);
});

staffRouter.patch("/:id", async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  if (param(req, "id") === req.user!.id) throw new HttpError(400, "You can't deactivate yourself");
  const user = await prisma().user.update({ where: { id: param(req, "id") }, data: { active }, select });
  logAccess(req, active ? "activate" : "deactivate", "user", user.id, user.name);
  res.json(user);
});

staffRouter.post("/:id/password", async (req, res) => {
  const { password } = z.object({ password: z.string().min(10, "Use at least 10 characters") }).parse(req.body);
  const user = await prisma().user.update({ where: { id: param(req, "id") }, data: { passwordHash: await hashPassword(password) }, select });
  logAccess(req, "reset-password", "user", user.id, user.name);
  res.status(204).end();
});
