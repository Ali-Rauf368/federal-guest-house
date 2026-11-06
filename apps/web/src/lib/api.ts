export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    credentials: "include",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("fgh:signed-out"));
    const detail = data.issues?.[0] ? `: ${data.issues[0].path} ${data.issues[0].message}` : "";
    throw new ApiError(res.status, (data.error ?? `Request failed (${res.status})`) + detail);
  }
  return data as T;
}

export type Role = "ADMIN" | "RECEPTION" | "HOUSEKEEPING";
export type GuestCategory = "OFFICIAL" | "STATE_GUEST" | "PRIVATE";
export type RoomCondition = "READY" | "DIRTY" | "CLEANING" | "OUT_OF_ORDER";
export type ReservationStatus = "REQUESTED" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REJECTED" | "NO_SHOW";
export type ChargeKind = "MEAL" | "LAUNDRY" | "TRANSPORT" | "OTHER";
export type PaymentMethod = "CASH" | "CARD" | "DEPARTMENT";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Staff extends User {
  active: boolean;
}
export interface RoomType {
  id: string;
  name: string;
  capacity: number;
  officialRateCents: number;
  privateRateCents: number;
}
export interface Room {
  id: string;
  number: string;
  floor: number;
  condition: RoomCondition;
  note: string | null;
  type: RoomType;
  occupied?: boolean;
}
export interface Guest {
  id: string;
  fullName: string;
  category: GuestCategory;
  idNumber: string | null;
  designation: string | null;
  department: string | null;
  phone: string;
  email: string | null;
  createdAt: string;
}
export interface Charge {
  id: string;
  kind: ChargeKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
  createdAt: string;
}
export interface Payment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  reference: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalNote: string | null;
}
export interface Folio {
  nights: number;
  roomCents: number;
  extrasCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
}
export interface Reservation {
  id: string;
  number: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  purpose: string;
  status: ReservationStatus;
  nightlyRateCents: number;
  decisionNote: string | null;
  createdBy: string;
  decidedBy: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  guest: Pick<Guest, "id" | "fullName" | "category" | "designation" | "department" | "phone">;
  room: { id: string; number: string; condition: RoomCondition; type: { name: string; capacity: number } };
  charges: Charge[];
  payments: Payment[];
  folio: Folio;
}
export interface DashboardRow {
  id: string;
  number: number;
  checkIn: string;
  checkOut: string;
  purpose: string;
  guest: Pick<Guest, "id" | "fullName" | "category">;
  room: { number: string; condition: RoomCondition };
}
export interface Dashboard {
  arrivals: DashboardRow[];
  departures: DashboardRow[];
  pending: DashboardRow[];
  inHouse: number;
  totalRooms: number;
  conditions: Partial<Record<RoomCondition, number>>;
  occupancy: { day: string; rooms: number }[];
  collectedThisMonthCents: number;
}
export interface GuestRecord extends Guest {
  reservations: { id: string; number: number; checkIn: string; checkOut: string; status: ReservationStatus; purpose: string; room: { number: string } }[];
}
export interface CalendarData {
  rooms: { id: string; number: string; condition: RoomCondition; type: { name: string } }[];
  reservations: { id: string; roomId: string; checkIn: string; checkOut: string; status: ReservationStatus; guest: { fullName: string } }[];
}
export interface AccessEntry {
  _id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  ip?: string;
  at: string;
}
