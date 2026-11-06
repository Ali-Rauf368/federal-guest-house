import { Router } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "../db/prisma";
import { logAccess } from "../lib/access-log";
import { HttpError, notFound, param } from "../lib/http";
import { PAGE_SIZE, pageOf } from "../lib/stay";

export const guestsRouter = Router();

const optional = z.string().trim().transform((s) => s || null).nullish();
const guestInput = z.object({
  fullName: z.string().trim().min(2),
  category: z.enum(["OFFICIAL", "STATE_GUEST", "PRIVATE"]),
  idNumber: optional,
  designation: optional,
  department: optional,
  phone: z.string().trim().min(5),
  email: z.union([z.literal(""), z.string().email()]).transform((s) => s || null).nullish(),
});

async function assertIdFree(idNumber: string | null | undefined, exceptId?: string) {
  if (!idNumber) return;
  const other = await prisma().guest.findUnique({ where: { idNumber } });
  if (other && other.id !== exceptId) throw new HttpError(409, `That ID number already belongs to ${other.fullName}`);
}

guestsRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where: Prisma.GuestWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { idNumber: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { department: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const page = pageOf(req.query.page);
  const [items, total] = await Promise.all([
    prisma().guest.findMany({ where, orderBy: [{ fullName: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma().guest.count({ where }),
  ]);
  res.json({ items, total, page, pageSize: PAGE_SIZE });
});

guestsRouter.post("/", async (req, res) => {
  const input = guestInput.parse(req.body);
  await assertIdFree(input.idNumber);
  const guest = await prisma().guest.create({ data: input });
  logAccess(req, "create", "guest", guest.id, guest.fullName);
  res.status(201).json(guest);
});

guestsRouter.get("/:id", async (req, res) => {
  const guest = await prisma().guest.findUnique({
    where: { id: param(req, "id") },
    include: { reservations: { orderBy: { checkIn: "desc" }, include: { room: { select: { number: true } } } } },
  });
  if (!guest) throw notFound("Guest");
  logAccess(req, "view", "guest", guest.id, guest.fullName);
  res.json(guest);
});

guestsRouter.put("/:id", async (req, res) => {
  const input = guestInput.parse(req.body);
  const id = param(req, "id");
  if (!(await prisma().guest.findUnique({ where: { id } }))) throw notFound("Guest");
  await assertIdFree(input.idNumber, id);
  const guest = await prisma().guest.update({ where: { id }, data: input });
  logAccess(req, "edit", "guest", guest.id, guest.fullName);
  res.json(guest);
});
