import type { Request } from "express";
import { Router } from "express";
import { inspect } from "node:util";
import { z } from "zod";
import { allow } from "../auth";
import { prisma, type GuestCategory, type Prisma, type ReservationStatus, type RoomType } from "../db/prisma";
import { logAccess } from "../lib/access-log";
import { HttpError, notFound, param } from "../lib/http";
import { ACTIVE_STATUSES, addDays, daySchema, folio, formatDay, PAGE_SIZE, pageOf, today } from "../lib/stay";

export const reservationsRouter = Router();

const include = {
  guest: { select: { id: true, fullName: true, category: true, designation: true, department: true, phone: true } },
  room: { select: { id: true, number: true, condition: true, type: { select: { name: true, capacity: true } } } },
  charges: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
} as const;

type Full = Prisma.ReservationGetPayload<{ include: typeof include }>;
const present = (r: Full) => ({ ...r, folio: folio(r) });
const label = (r: { number: number }) => `FGH-${String(r.number).padStart(6, "0")}`;

const rateFor = (category: GuestCategory, type: RoomType) =>
  category === "STATE_GUEST" ? 0 : category === "OFFICIAL" ? type.officialRateCents : type.privateRateCents;

/** Turns the database's overlap refusal into a message; this is what stops two simultaneous bookings. */
async function refuseOverlap<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (err) {
    if (inspect(err, { depth: 6 }).includes("reservation_no_overlap")) throw new HttpError(409, "That room is already booked for those dates");
    throw err;
  }
}

async function load(req: Request) {
  const r = await prisma().reservation.findUnique({ where: { id: param(req, "id") }, include });
  if (!r) throw notFound("Reservation");
  return r;
}

/** Moves a stay between statuses. Conditional on the current status, so a double click can't apply twice. */
async function transition(req: Request, from: ReservationStatus[], to: ReservationStatus, data: Prisma.ReservationUncheckedUpdateManyInput = {}) {
  const id = param(req, "id");
  const { count } = await prisma().reservation.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
  if (count === 0) throw new HttpError(409, `This reservation can't be changed to ${to.toLowerCase().replace("_", " ")} from its current status`);
  const r = await prisma().reservation.findUniqueOrThrow({ where: { id }, include });
  logAccess(req, `status:${to}`, "reservation", id, label(r));
  return present(r);
}

reservationsRouter.get("/", async (req, res) => {
  const { status, q } = z.object({ status: z.string().optional(), q: z.string().trim().optional(), page: z.string().optional() }).parse(req.query);
  const where: Prisma.ReservationWhereInput = {};
  if (status === "ACTIVE") where.status = { in: [...ACTIVE_STATUSES] };
  else if (status) where.status = z.enum(["REQUESTED", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "REJECTED", "NO_SHOW"]).parse(status);
  if (q) {
    const number = Number(q.replace(/\D/g, ""));
    where.OR = [
      { guest: { fullName: { contains: q, mode: "insensitive" } } },
      { room: { number: { contains: q } } },
      ...(number > 0 && number < 2 ** 31 ? [{ number }] : []),
    ];
  }
  const page = pageOf(req.query.page);
  const [rows, total] = await Promise.all([
    prisma().reservation.findMany({ where, orderBy: [{ checkIn: "desc" }, { number: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include }),
    prisma().reservation.count({ where }),
  ]);
  res.json({ items: rows.map(present), total, page, pageSize: PAGE_SIZE });
});

reservationsRouter.get("/calendar", async (req, res) => {
  const { from, days } = z.object({ from: daySchema, days: z.coerce.number().int().min(1).max(31).default(14) }).parse(req.query);
  const to = addDays(from, days);
  const [rooms, reservations] = await Promise.all([
    prisma().room.findMany({ orderBy: { number: "asc" }, include: { type: { select: { name: true } } } }),
    prisma().reservation.findMany({
      where: { status: { in: [...ACTIVE_STATUSES, "CHECKED_OUT"] }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { id: true, roomId: true, checkIn: true, checkOut: true, status: true, guest: { select: { fullName: true } } },
    }),
  ]);
  res.json({ rooms, reservations });
});

reservationsRouter.post("/", async (req, res) => {
  const input = z
    .object({
      guestId: z.string().uuid(),
      roomId: z.string().uuid(),
      checkIn: daySchema,
      checkOut: daySchema,
      adults: z.coerce.number().int().min(1).default(1),
      purpose: z.string().trim().min(3),
    })
    .parse(req.body);
  if (input.checkOut <= input.checkIn) throw new HttpError(400, "Departure must be after arrival");
  if (input.checkIn < today()) throw new HttpError(400, "Arrival can't be in the past");
  const [guest, room] = await Promise.all([
    prisma().guest.findUnique({ where: { id: input.guestId } }),
    prisma().room.findUnique({ where: { id: input.roomId }, include: { type: true } }),
  ]);
  if (!guest) throw notFound("Guest");
  if (!room) throw notFound("Room");
  if (room.condition === "OUT_OF_ORDER") throw new HttpError(409, `Room ${room.number} is out of order`);
  if (input.adults > room.type.capacity) throw new HttpError(400, `Room ${room.number} sleeps ${room.type.capacity}`);
  const created = await refuseOverlap(
    prisma().reservation.create({
      data: { ...input, nightlyRateCents: rateFor(guest.category, room.type), createdBy: req.user!.name },
      include,
    }),
  );
  logAccess(req, "create", "reservation", created.id, `${label(created)} ${guest.fullName}`);
  res.status(201).json(present(created));
});

reservationsRouter.get("/:id", async (req, res) => {
  const r = await load(req);
  logAccess(req, "view", "reservation", r.id, label(r));
  res.json(present(r));
});

reservationsRouter.post("/:id/approve", allow("ADMIN"), async (req, res) => {
  res.json(await transition(req, ["REQUESTED"], "CONFIRMED", { decidedBy: req.user!.name }));
});

reservationsRouter.post("/:id/reject", allow("ADMIN"), async (req, res) => {
  const { note } = z.object({ note: z.string().trim().min(3, "Give a reason") }).parse(req.body);
  res.json(await transition(req, ["REQUESTED"], "REJECTED", { decidedBy: req.user!.name, decisionNote: note }));
});

reservationsRouter.post("/:id/cancel", async (req, res) => {
  const { note } = z.object({ note: z.string().trim().min(3, "Give a reason") }).parse(req.body);
  res.json(await transition(req, ["REQUESTED", "CONFIRMED"], "CANCELLED", { decisionNote: note }));
});

reservationsRouter.post("/:id/no-show", async (req, res) => {
  const r = await load(req);
  if (r.checkIn > today()) throw new HttpError(409, "The guest isn't due yet");
  res.json(await transition(req, ["CONFIRMED"], "NO_SHOW"));
});

reservationsRouter.post("/:id/check-in", async (req, res) => {
  const r = await load(req);
  const day = today();
  if (r.checkIn > day) throw new HttpError(409, `This stay starts on ${formatDay(r.checkIn)}`);
  if (r.checkOut <= day) throw new HttpError(409, "This stay's dates have passed");
  if (r.room.condition !== "READY") throw new HttpError(409, `Room ${r.room.number} isn't ready yet`);
  const occupant = await prisma().reservation.findFirst({ where: { roomId: r.roomId, status: "CHECKED_IN" } });
  if (occupant) throw new HttpError(409, `Room ${r.room.number} still has a guest in it`);
  res.json(await transition(req, ["CONFIRMED"], "CHECKED_IN", { checkedInAt: new Date() }));
});

reservationsRouter.post("/:id/check-out", async (req, res) => {
  const r = await load(req);
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Only guests in house can check out");
  const bill = folio(r);
  if (bill.balanceCents !== 0) throw new HttpError(409, "Settle the balance before checking out");
  // The stay ends today, or after the one-night minimum if they leave on the day they arrived.
  const departure = addDays(r.checkIn, bill.nights);
  await refuseOverlap(
    prisma().$transaction([
      prisma().reservation.update({ where: { id: r.id }, data: { status: "CHECKED_OUT", checkOut: departure, checkedOutAt: new Date() } }),
      prisma().room.update({ where: { id: r.roomId }, data: { condition: "DIRTY" } }),
    ]),
  );
  logAccess(req, "status:CHECKED_OUT", "reservation", r.id, label(r));
  res.json(present(await load(req)));
});

/** Extends or shortens a stay, or moves it to another room. */
reservationsRouter.patch("/:id/stay", async (req, res) => {
  const input = z.object({ checkOut: daySchema.optional(), roomId: z.string().uuid().optional() }).parse(req.body);
  const r = await load(req);
  if (!(ACTIVE_STATUSES as readonly string[]).includes(r.status)) throw new HttpError(409, "This stay can no longer be changed");
  const inHouse = r.status === "CHECKED_IN";
  if (input.checkOut) {
    if (input.checkOut <= r.checkIn) throw new HttpError(400, "Departure must be after arrival");
    if (inHouse && input.checkOut < today()) throw new HttpError(400, "Departure can't be in the past");
  }
  const moving = input.roomId && input.roomId !== r.roomId;
  if (moving) {
    const target = await prisma().room.findUnique({ where: { id: input.roomId }, include: { type: true } });
    if (!target) throw notFound("Room");
    if (target.condition === "OUT_OF_ORDER") throw new HttpError(409, `Room ${target.number} is out of order`);
    if (r.adults > target.type.capacity) throw new HttpError(400, `Room ${target.number} sleeps ${target.type.capacity}`);
    if (inHouse && target.condition !== "READY") throw new HttpError(409, `Room ${target.number} isn't ready yet`);
  }
  await refuseOverlap(
    prisma().$transaction([
      prisma().reservation.update({ where: { id: r.id }, data: { checkOut: input.checkOut, roomId: input.roomId } }),
      ...(moving && inHouse ? [prisma().room.update({ where: { id: r.roomId }, data: { condition: "DIRTY" } })] : []),
    ]),
  );
  logAccess(req, "change-stay", "reservation", r.id, label(r));
  res.json(present(await load(req)));
});

reservationsRouter.post("/:id/charges", async (req, res) => {
  const input = z
    .object({
      kind: z.enum(["MEAL", "LAUNDRY", "TRANSPORT", "OTHER"]),
      description: z.string().trim().min(2),
      quantity: z.coerce.number().int().min(1).default(1),
      unitPriceCents: z.coerce.number().int().min(1),
    })
    .parse(req.body);
  const r = await load(req);
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Charges can only be added while the guest is in house");
  await prisma().charge.create({ data: { ...input, reservationId: r.id } });
  logAccess(req, "add-charge", "reservation", r.id, `${label(r)} ${input.description}`);
  res.status(201).json(present(await load(req)));
});

reservationsRouter.delete("/:id/charges/:chargeId", async (req, res) => {
  const r = await load(req);
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Charges can only be removed while the guest is in house");
  const charge = r.charges.find((c) => c.id === param(req, "chargeId"));
  if (!charge) throw notFound("Charge");
  if (folio(r).balanceCents < charge.quantity * charge.unitPriceCents) throw new HttpError(409, "This charge has already been paid");
  await prisma().charge.delete({ where: { id: charge.id } });
  logAccess(req, "remove-charge", "reservation", r.id, `${label(r)} ${charge.description}`);
  res.json(present(await load(req)));
});

reservationsRouter.post("/:id/payments", async (req, res) => {
  const input = z
    .object({
      method: z.enum(["CASH", "CARD", "DEPARTMENT"]),
      amountCents: z.coerce.number().int().min(1),
      reference: z.string().trim().optional(),
    })
    .parse(req.body);
  const r = await load(req);
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Payments can only be taken while the guest is in house");
  if (input.amountCents > folio(r).balanceCents) throw new HttpError(409, "That is more than the balance");
  if (input.method === "DEPARTMENT" && !input.reference) throw new HttpError(400, "Enter the department's billing reference");
  await prisma().payment.create({ data: { ...input, reservationId: r.id } });
  logAccess(req, `payment:${input.method}`, "reservation", r.id, label(r));
  res.status(201).json(present(await load(req)));
});

reservationsRouter.post("/:id/payments/:paymentId/reverse", allow("ADMIN"), async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3, "Give a reason") }).parse(req.body);
  const r = await load(req);
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Payments can only be reversed while the guest is in house");
  const { count } = await prisma().payment.updateMany({
    where: { id: param(req, "paymentId"), reservationId: r.id, reversedAt: null },
    data: { reversedAt: new Date(), reversedBy: req.user!.name, reversalNote: reason },
  });
  if (count === 0) throw new HttpError(409, "That payment doesn't exist or is already reversed");
  logAccess(req, "reverse-payment", "reservation", r.id, `${label(r)} ${reason}`);
  res.json(present(await load(req)));
});
