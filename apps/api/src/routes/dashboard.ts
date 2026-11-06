import { Router } from "express";
import { prisma } from "../db/prisma";
import { ACTIVE_STATUSES, addDays, formatDay, today } from "../lib/stay";

export const dashboardRouter = Router();

const include = { guest: { select: { id: true, fullName: true, category: true } }, room: { select: { number: true, condition: true } } } as const;

dashboardRouter.get("/", async (_req, res) => {
  const day = today();
  const horizon = addDays(day, 14);
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const db = prisma();
  const [arrivals, departures, pending, inHouse, rooms, upcoming, collected] = await Promise.all([
    db.reservation.findMany({ where: { status: "CONFIRMED", checkIn: { lte: day } }, orderBy: { checkIn: "asc" }, include }),
    db.reservation.findMany({ where: { status: "CHECKED_IN", checkOut: { lte: day } }, orderBy: { checkOut: "asc" }, include }),
    db.reservation.findMany({ where: { status: "REQUESTED" }, orderBy: { checkIn: "asc" }, take: 20, include }),
    db.reservation.count({ where: { status: "CHECKED_IN" } }),
    db.room.groupBy({ by: ["condition"], _count: true }),
    db.reservation.findMany({
      where: { status: { in: [...ACTIVE_STATUSES] }, checkIn: { lt: horizon }, checkOut: { gt: day } },
      select: { checkIn: true, checkOut: true },
    }),
    db.payment.aggregate({ where: { createdAt: { gte: monthStart }, reversedAt: null }, _sum: { amountCents: true } }),
  ]);
  const occupancy = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(day, i);
    return { day: formatDay(d), rooms: upcoming.filter((r) => r.checkIn <= d && r.checkOut > d).length };
  });
  res.json({
    arrivals,
    departures,
    pending,
    inHouse,
    totalRooms: rooms.reduce((s, r) => s + r._count, 0),
    conditions: Object.fromEntries(rooms.map((r) => [r.condition, r._count])),
    occupancy,
    collectedThisMonthCents: collected._sum.amountCents ?? 0,
  });
});
