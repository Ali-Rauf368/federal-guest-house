import { Router } from "express";
import { z } from "zod";
import { allow } from "../auth";
import { prisma } from "../db/prisma";
import { logAccess } from "../lib/access-log";
import { HttpError, notFound, param } from "../lib/http";
import { ACTIVE_STATUSES, daySchema } from "../lib/stay";

export const roomsRouter = Router();

/** Housekeeping uses this list too, so it says whether a room is occupied but never by whom. */
roomsRouter.get("/", async (_req, res) => {
  const rooms = await prisma().room.findMany({
    orderBy: { number: "asc" },
    include: { type: true, reservations: { where: { status: "CHECKED_IN" }, select: { id: true } } },
  });
  res.json(rooms.map(({ reservations, ...room }) => ({ ...room, occupied: reservations.length > 0 })));
});

roomsRouter.get("/types", async (_req, res) => {
  res.json(await prisma().roomType.findMany({ orderBy: { officialRateCents: "asc" } }));
});

roomsRouter.post("/types", allow("ADMIN"), async (req, res) => {
  const data = z
    .object({
      name: z.string().trim().min(2),
      capacity: z.coerce.number().int().min(1).max(12),
      officialRateCents: z.coerce.number().int().min(0),
      privateRateCents: z.coerce.number().int().min(0),
    })
    .parse(req.body);
  if (await prisma().roomType.findUnique({ where: { name: data.name } })) throw new HttpError(409, "That room type already exists");
  const type = await prisma().roomType.create({ data });
  logAccess(req, "create", "room-type", type.id, type.name);
  res.status(201).json(type);
});

roomsRouter.post("/", allow("ADMIN"), async (req, res) => {
  const data = z.object({ number: z.string().trim().min(1), floor: z.coerce.number().int().min(0), typeId: z.string().uuid() }).parse(req.body);
  if (await prisma().room.findUnique({ where: { number: data.number } })) throw new HttpError(409, `Room ${data.number} already exists`);
  if (!(await prisma().roomType.findUnique({ where: { id: data.typeId } }))) throw notFound("Room type");
  const room = await prisma().room.create({ data });
  logAccess(req, "create", "room", room.id, room.number);
  res.status(201).json(room);
});

roomsRouter.patch("/types/:id", allow("ADMIN"), async (req, res) => {
  const data = z
    .object({ officialRateCents: z.coerce.number().int().min(0), privateRateCents: z.coerce.number().int().min(0) })
    .parse(req.body);
  const type = await prisma().roomType.update({ where: { id: param(req, "id") }, data });
  logAccess(req, "edit-tariff", "room-type", type.id, type.name);
  res.json(type);
});

roomsRouter.get("/available", allow("ADMIN", "RECEPTION"), async (req, res) => {
  const { from, to, adults, excluding } = z
    .object({ from: daySchema, to: daySchema, adults: z.coerce.number().int().min(1).default(1), excluding: z.string().optional() })
    .parse(req.query);
  if (to <= from) throw new HttpError(400, "Departure must be after arrival");
  const rooms = await prisma().room.findMany({
    where: {
      condition: { not: "OUT_OF_ORDER" },
      type: { capacity: { gte: adults } },
      reservations: { none: { status: { in: [...ACTIVE_STATUSES] }, checkIn: { lt: to }, checkOut: { gt: from }, id: { not: excluding } } },
    },
    orderBy: { number: "asc" },
    include: { type: true },
  });
  res.json(rooms);
});

roomsRouter.patch("/:id/condition", async (req, res) => {
  const { condition, note } = z
    .object({ condition: z.enum(["READY", "DIRTY", "CLEANING", "OUT_OF_ORDER"]), note: z.string().trim().optional() })
    .parse(req.body);
  const room = await prisma().room.findUnique({
    where: { id: param(req, "id") },
    include: { reservations: { where: { status: "CHECKED_IN" }, select: { id: true } } },
  });
  if (!room) throw notFound("Room");
  const touchesOutOfOrder = condition === "OUT_OF_ORDER" || room.condition === "OUT_OF_ORDER";
  if (touchesOutOfOrder && req.user!.role === "HOUSEKEEPING") throw new HttpError(403, "Ask the front desk to change out-of-order rooms");
  if (condition === "OUT_OF_ORDER" && room.reservations.length > 0) throw new HttpError(409, "Move the guest out before taking this room out of order");
  const updated = await prisma().room.update({
    where: { id: room.id },
    data: { condition, note: condition === "OUT_OF_ORDER" ? note || null : null },
  });
  logAccess(req, `condition:${condition}`, "room", room.id, room.number);
  res.json(updated);
});
