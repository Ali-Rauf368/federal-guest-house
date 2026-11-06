/** Resets the database to a demo guest house: three weeks of history, guests in house, and upcoming bookings. */
import { config } from "../config";
import { disconnectPrisma, prisma, type GuestCategory } from "../db/prisma";
import { hashPassword } from "../lib/password";
import { addDays, folio, today } from "../lib/stay";

const PASSWORD = "guesthouse-demo-2026";

let state = 20261106;
const rand = (n: number) => {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return (state >>> 12) % n;
};
const pick = <T>(items: readonly T[]) => items[rand(items.length)]!;

const TYPES = [
  { name: "Standard Single", capacity: 1, officialRateCents: 350000, privateRateCents: 700000, rooms: 8 },
  { name: "Standard Double", capacity: 2, officialRateCents: 500000, privateRateCents: 1000000, rooms: 10 },
  { name: "Executive Suite", capacity: 3, officialRateCents: 900000, privateRateCents: 1800000, rooms: 4 },
  { name: "VIP Suite", capacity: 4, officialRateCents: 1500000, privateRateCents: 3000000, rooms: 2 },
];

const FIRST = ["Sara", "Bilal", "Hina", "Usman", "Maryam", "Tariq", "Ayesha", "Kamran", "Nadia", "Farhan", "Zainab", "Imran", "Rabia", "Salman", "Fatima", "Omar"];
const LAST = ["Qureshi", "Malik", "Siddiqui", "Baig", "Chaudhry", "Mirza", "Hashmi", "Rana", "Sheikh", "Abbasi"];
const DEPARTMENTS = ["Ministry of Finance", "Ministry of Education", "Ministry of Planning", "Audit Department", "Foreign Office", "Ministry of Health"];
const DESIGNATIONS = ["Joint Secretary", "Deputy Secretary", "Section Officer", "Director General", "Additional Secretary"];
const PURPOSES = ["Official meeting", "Training course", "Inspection visit", "Inter-ministry conference", "Budget review"];

async function main() {
  if (config().NODE_ENV === "production") throw new Error("Refusing to reset a production database");
  const db = prisma();
  await db.$transaction([db.payment.deleteMany(), db.charge.deleteMany(), db.reservation.deleteMany(), db.guest.deleteMany(), db.room.deleteMany(), db.roomType.deleteMany(), db.user.deleteMany()]);

  const passwordHash = await hashPassword(PASSWORD);
  await db.user.createMany({
    data: [
      { email: "manager@fgh.example", name: "Asma Rehman", role: "ADMIN", passwordHash },
      { email: "reception@fgh.example", name: "Danish Akhtar", role: "RECEPTION", passwordHash },
      { email: "housekeeping@fgh.example", name: "Shabnam Gill", role: "HOUSEKEEPING", passwordHash },
    ],
  });

  const rooms = [];
  let index = 0;
  for (const { rooms: count, ...type } of TYPES) {
    const created = await db.roomType.create({ data: type });
    for (let i = 0; i < count; i++, index++) {
      const floor = Math.floor(index / 8) + 1;
      const room = await db.room.create({ data: { number: `${floor}${String((index % 8) + 1).padStart(2, "0")}`, floor, typeId: created.id } });
      rooms.push({ ...room, type: created });
    }
  }

  const guests = [];
  for (let i = 0; i < 40; i++) {
    const category: GuestCategory = i < 3 ? "STATE_GUEST" : i < 30 ? "OFFICIAL" : "PRIVATE";
    const official = category !== "PRIVATE";
    guests.push(
      await db.guest.create({
        data: {
          fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 3 + Math.floor(i / 16)) % LAST.length]}`,
          category,
          idNumber: `${10000 + i}-${1000000 + i * 137}-${i % 10}`,
          designation: official ? pick(DESIGNATIONS) : null,
          department: official ? pick(DEPARTMENTS) : null,
          phone: `+92 300 ${String(1000000 + i * 7919).slice(0, 7)}`,
        },
      }),
    );
  }

  const day = today();
  for (const room of rooms) {
    let cursor = addDays(day, -21 + rand(4));
    while (cursor < addDays(day, 16)) {
      const checkIn = cursor;
      const checkOut = addDays(checkIn, 1 + rand(5));
      const guest = pick(guests);
      const nightlyRateCents = guest.category === "STATE_GUEST" ? 0 : guest.category === "OFFICIAL" ? room.type.officialRateCents : room.type.privateRateCents;
      const past = checkOut < day;
      const inHouse = checkIn < day && checkOut >= day;
      const status = past ? "CHECKED_OUT" : inHouse ? "CHECKED_IN" : checkIn > addDays(day, 3) && rand(3) === 0 ? "REQUESTED" : "CONFIRMED";
      const reservation = await db.reservation.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          checkIn,
          checkOut,
          adults: 1 + rand(room.type.capacity),
          purpose: guest.category === "PRIVATE" ? "Private stay" : pick(PURPOSES),
          status,
          nightlyRateCents,
          createdBy: "Danish Akhtar",
          decidedBy: status === "REQUESTED" ? null : "Asma Rehman",
          checkedInAt: past || inHouse ? new Date(checkIn.getTime() + 14 * 3600_000) : null,
          checkedOutAt: past ? new Date(checkOut.getTime() + 10 * 3600_000) : null,
          createdAt: addDays(checkIn, -5),
          charges: past || inHouse ? { create: { kind: "MEAL", description: "Dinner", quantity: 1 + rand(3), unitPriceCents: 120000, createdAt: checkIn } } : undefined,
        },
        include: { charges: true, payments: true },
      });
      if (past) {
        const { balanceCents } = folio(reservation);
        await db.payment.create({
          data: {
            reservationId: reservation.id,
            method: guest.category === "PRIVATE" ? pick(["CASH", "CARD"] as const) : "DEPARTMENT",
            amountCents: balanceCents,
            reference: guest.category === "PRIVATE" ? null : `DEP-${reservation.number}`,
            createdAt: checkOut,
          },
        });
      }
      cursor = addDays(checkOut, rand(6));
    }
  }

  const free = await db.room.findMany({ where: { reservations: { none: { status: "CHECKED_IN" } } }, orderBy: { number: "desc" }, take: 3 });
  if (free[0]) await db.room.update({ where: { id: free[0].id }, data: { condition: "OUT_OF_ORDER", note: "Air conditioner repair" } });
  if (free[1]) await db.room.update({ where: { id: free[1].id }, data: { condition: "DIRTY" } });
  if (free[2]) await db.room.update({ where: { id: free[2].id }, data: { condition: "CLEANING" } });

  console.log(`Seeded ${rooms.length} rooms, ${guests.length} guests, ${await db.reservation.count()} reservations. Password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
