/** End-to-end API tests against a real PostgreSQL and MongoDB. Run with `npm test`, which uses a separate database. */
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app";
import { connectMongo, disconnectMongo } from "../src/db/mongo";
import { disconnectPrisma, prisma } from "../src/db/prisma";
import { addDays, formatDay, today } from "../src/lib/stay";

const PASSWORD = "guesthouse-demo-2026";
const day = (n: number) => formatDay(addDays(today(), n));
let server: Server;
let base: string;
let reception: string;
let manager: string;
let housekeeping: string;

async function call(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers: { cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
}

async function signIn(email: string, password = PASSWORD) {
  const res = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

/** A room used only by one test, so tests don't depend on the demo bookings. */
async function freshRoom(number: string) {
  const type = await prisma().roomType.findFirstOrThrow({ where: { name: "Standard Double" } });
  return prisma().room.create({ data: { number, floor: 9, typeId: type.id }, include: { type: true } });
}

async function guest(category: "OFFICIAL" | "PRIVATE" | "STATE_GUEST") {
  return prisma().guest.findFirstOrThrow({ where: { category } });
}

async function book(roomId: string, guestId: string, from = 0, to = 2) {
  return call(reception, "POST", "/reservations", { guestId, roomId, checkIn: day(from), checkOut: day(to), adults: 1, purpose: "Test stay" });
}

async function checkedInStay(number: string) {
  const room = await freshRoom(number);
  const created = await book(room.id, (await guest("PRIVATE")).id);
  const path = `/reservations/${created.data.id}`;
  assert.equal((await call(manager, "POST", `${path}/approve`)).status, 200);
  assert.equal((await call(reception, "POST", `${path}/check-in`)).status, 200);
  return { room, path };
}

before(async () => {
  await connectMongo();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  [reception, manager, housekeeping] = await Promise.all(["reception", "manager", "housekeeping"].map((n) => signIn(`${n}@fgh.example`))) as [string, string, string];
});

after(async () => {
  server.close();
  await Promise.all([disconnectPrisma(), disconnectMongo()]);
});

test("simultaneous bookings of one room: exactly one succeeds", async () => {
  const room = await freshRoom("T01");
  const g = await guest("OFFICIAL");
  const results = await Promise.all(Array.from({ length: 6 }, () => book(room.id, g.id)));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
});

test("back-to-back stays are allowed, and a cancelled stay frees the room", async () => {
  const room = await freshRoom("T02");
  const g = await guest("OFFICIAL");
  const first = await book(room.id, g.id, 1, 3);
  assert.equal((await book(room.id, g.id, 3, 5)).status, 201);
  assert.equal((await book(room.id, g.id, 2, 4)).status, 409);
  await call(reception, "POST", `/reservations/${first.data.id}/cancel`, { note: "Plans changed" });
  assert.equal((await book(room.id, g.id, 1, 3)).status, 201);
});

test("tariff depends on guest category and is fixed at booking", async () => {
  const room = await freshRoom("T03");
  const state = await book(room.id, (await guest("STATE_GUEST")).id, 1, 2);
  const official = await book(room.id, (await guest("OFFICIAL")).id, 2, 3);
  const priv = await book(room.id, (await guest("PRIVATE")).id, 3, 4);
  assert.equal(state.data.nightlyRateCents, 0);
  assert.equal(official.data.nightlyRateCents, room.type.officialRateCents);
  assert.equal(priv.data.nightlyRateCents, room.type.privateRateCents);
});

test("only the manager approves, and only once", async () => {
  const room = await freshRoom("T04");
  const { data } = await book(room.id, (await guest("OFFICIAL")).id);
  const path = `/reservations/${data.id}`;
  assert.equal((await call(reception, "POST", `${path}/approve`)).status, 403);
  assert.equal((await call(reception, "POST", `${path}/check-in`)).status, 409);
  assert.equal((await call(manager, "POST", `${path}/approve`)).status, 200);
  assert.equal((await call(manager, "POST", `${path}/approve`)).status, 409);
});

test("a dirty room can't be checked into", async () => {
  const room = await freshRoom("T05");
  const { data } = await book(room.id, (await guest("OFFICIAL")).id);
  const path = `/reservations/${data.id}`;
  await call(manager, "POST", `${path}/approve`);
  await call(housekeeping, "PATCH", `/rooms/${room.id}/condition`, { condition: "DIRTY" });
  assert.equal((await call(reception, "POST", `${path}/check-in`)).status, 409);
  await call(housekeeping, "PATCH", `/rooms/${room.id}/condition`, { condition: "READY" });
  assert.equal((await call(reception, "POST", `${path}/check-in`)).status, 200);
});

test("a stay is billed, settled and checked out, and the room goes to housekeeping", async () => {
  const { room, path } = await checkedInStay("T06");
  await call(reception, "POST", `${path}/charges`, { kind: "MEAL", description: "Lunch", quantity: 2, unitPriceCents: 50000 });
  const { folio } = (await call(reception, "GET", path)).data;
  assert.equal(folio.balanceCents, room.type.privateRateCents + 100000);
  assert.equal((await call(reception, "POST", `${path}/check-out`)).status, 409);
  assert.equal((await call(reception, "POST", `${path}/payments`, { method: "CASH", amountCents: folio.balanceCents + 1 })).status, 409);
  assert.equal((await call(reception, "POST", `${path}/payments`, { method: "DEPARTMENT", amountCents: 1 })).status, 400);
  assert.equal((await call(reception, "POST", `${path}/payments`, { method: "CASH", amountCents: folio.balanceCents })).status, 201);
  const out = await call(reception, "POST", `${path}/check-out`);
  assert.equal(out.status, 200);
  assert.equal(out.data.folio.balanceCents, 0);
  assert.equal(out.data.checkOut.slice(0, 10), day(1));
  assert.equal((await prisma().room.findUniqueOrThrow({ where: { id: room.id } })).condition, "DIRTY");
});

test("the manager can reverse a payment, once, and it stays on record", async () => {
  const { room, path } = await checkedInStay("T07");
  const paid = await call(reception, "POST", `${path}/payments`, { method: "CASH", amountCents: room.type.privateRateCents });
  const payment = paid.data.payments[0];
  assert.equal(paid.data.folio.balanceCents, 0);
  const reverse = `${path}/payments/${payment.id}/reverse`;
  assert.equal((await call(reception, "POST", reverse, { reason: "Wrong amount" })).status, 403);
  const reversed = await call(manager, "POST", reverse, { reason: "Wrong amount" });
  assert.equal(reversed.status, 200);
  assert.equal(reversed.data.folio.balanceCents, room.type.privateRateCents);
  assert.equal(reversed.data.payments.length, 1);
  assert.equal((await call(manager, "POST", reverse, { reason: "Wrong amount" })).status, 409);
});

test("a paid charge can't be removed", async () => {
  const { room, path } = await checkedInStay("T08");
  const added = await call(reception, "POST", `${path}/charges`, { kind: "OTHER", description: "Taxi", unitPriceCents: 1000 });
  await call(reception, "POST", `${path}/payments`, { method: "CARD", amountCents: room.type.privateRateCents + 1000 });
  assert.equal((await call(reception, "DELETE", `${path}/charges/${added.data.charges[0].id}`)).status, 409);
});

test("housekeeping sees rooms but no guest data", async () => {
  const rooms = await call(housekeeping, "GET", "/rooms");
  assert.equal(rooms.status, 200);
  assert.ok(!JSON.stringify(rooms.data).toLowerCase().includes("guest"));
  for (const path of ["/guests", "/reservations", "/dashboard", "/staff", "/activity"]) assert.equal((await call(housekeeping, "GET", path)).status, 403, path);
  const room = rooms.data[0];
  assert.equal((await call(housekeeping, "PATCH", `/rooms/${room.id}/condition`, { condition: "OUT_OF_ORDER" })).status, 403);
});

test("bad dates are refused", async () => {
  const room = await freshRoom("T09");
  const g = await guest("OFFICIAL");
  assert.equal((await book(room.id, g.id, -3, -1)).status, 400);
  assert.equal((await book(room.id, g.id, 3, 3)).status, 400);
  assert.equal((await call(reception, "GET", "/rooms/available?from=2026-02-31&to=2026-03-02")).status, 400);
});

test("lists are paged", async () => {
  const first = await call(reception, "GET", "/reservations?page=1");
  const second = await call(reception, "GET", "/reservations?page=2");
  assert.equal(first.data.items.length, first.data.pageSize);
  assert.ok(first.data.total > first.data.pageSize);
  assert.notEqual(first.data.items[0].id, second.data.items[0].id);
});

test("the manager adds rooms; reception can't", async () => {
  const type = await prisma().roomType.findFirstOrThrow();
  const body = { number: "T10", floor: 9, typeId: type.id };
  assert.equal((await call(reception, "POST", "/rooms", body)).status, 403);
  assert.equal((await call(manager, "POST", "/rooms", body)).status, 201);
  assert.equal((await call(manager, "POST", "/rooms", body)).status, 409);
});

test("staff can change their password, and a deactivated account loses access at once", async () => {
  const email = "temp@fgh.example";
  const created = await call(manager, "POST", "/staff", { email, name: "Temp Staff", role: "RECEPTION", password: "first-password" });
  const cookie = await signIn(email, "first-password");
  assert.equal((await call(cookie, "POST", "/auth/password", { current: "wrong", next: "second-password" })).status, 400);
  assert.equal((await call(cookie, "POST", "/auth/password", { current: "first-password", next: "second-password" })).status, 204);
  await signIn(email, "second-password");
  await call(manager, "PATCH", `/staff/${created.data.id}`, { active: false });
  assert.equal((await call(cookie, "GET", "/guests")).status, 401);
});
