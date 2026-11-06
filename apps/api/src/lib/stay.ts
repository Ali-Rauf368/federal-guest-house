import { z } from "zod";

const DAY_MS = 86_400_000;

/** Calendar days are stored as UTC midnight, matching Postgres DATE columns. */
export const parseDay = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const formatDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const nightsBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Today at the guest house (server local time). */
export function today() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(parseDay(s).getTime()) && formatDay(parseDay(s)) === s, "Not a real date")
  .transform(parseDay);

export const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED", "CHECKED_IN"] as const;

interface FolioInput {
  status: string;
  checkIn: Date;
  checkOut: Date;
  nightlyRateCents: number;
  charges: { quantity: number; unitPriceCents: number }[];
  payments: { amountCents: number; reversedAt?: Date | null }[];
}

/**
 * The bill for a stay. While a guest is in house, room nights run up to today (minimum one),
 * so the balance is always exactly what they owe if they leave now, early or late.
 */
export function folio(r: FolioInput) {
  const end = r.status === "CHECKED_IN" ? today() : r.checkOut;
  const nights = Math.max(1, nightsBetween(r.checkIn, end));
  const roomCents = nights * r.nightlyRateCents;
  const extrasCents = r.charges.reduce((s, c) => s + c.quantity * c.unitPriceCents, 0);
  const paidCents = r.payments.reduce((s, p) => s + (p.reversedAt ? 0 : p.amountCents), 0);
  return { nights, roomCents, extrasCents, totalCents: roomCents + extrasCents, paidCents, balanceCents: roomCents + extrasCents - paidCents };
}

export const PAGE_SIZE = 50;
export const pageOf = (value: unknown) => Math.max(1, Math.floor(Number(value)) || 1);
