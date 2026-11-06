# Federal Guest House

Federal Guest House runs a government guest house in one web app: booking requests, approvals, the front desk, housekeeping and billing.

- **Today:** arrivals, departures, requests awaiting approval, rooms ready, and bookings for the next 14 days.
- **Room calendar:** every room across two weeks, with each stay shown as a bar.
- **Reservations:** reception raises a request for a free room, the manager approves or rejects it, and reception checks the guest in and out. Stays can be extended, shortened or moved to another room.
- **Bill:** room nights, meals, laundry and transport, paid by cash, card or billed to the guest's department. Checkout needs a zero balance.
- **Guests:** official, state guest (no charge) and private guests, with their stay history.
- **Rooms:** housekeeping moves rooms from needs cleaning to being cleaned to ready. Checkout marks a room as needing cleaning, and only a ready room can be checked into.
- **Staff, rooms, tariffs and access log (manager):** add or deactivate accounts, reset passwords, add rooms and room types, set nightly rates, reverse mistaken payments, and see every sign-in, guest record view and change.

## Roles

| | Reception | Housekeeping | Manager |
| --- | --- | --- | --- |
| Raise, change and cancel reservations | ✓ | | ✓ |
| Approve or reject requests | | | ✓ |
| Check in and out, bills and payments | ✓ | | ✓ |
| Guest records | ✓ | | ✓ |
| Room cleaning status | ✓ | ✓ | ✓ |
| Take rooms out of order | ✓ | | ✓ |
| Rooms, tariffs, staff and access log | | | ✓ |
| Reverse a payment | | | ✓ |

The API checks the role on every request; hiding a menu item is never the only protection. Housekeeping sees whether a room is occupied, never who is in it.

Two bookings can never share a room on the same night: a PostgreSQL exclusion constraint refuses the second one, even if both arrive at the same moment.

## How it's built

| Folder | What it is |
| --- | --- |
| `apps/api` | Express 5 + TypeScript. PostgreSQL via Prisma for rooms, guests, reservations and bills. MongoDB for the access log (expires after two years). Email/password sign-in with scrypt hashes and an httpOnly JWT cookie. |
| `apps/web` | React 19 + Vite + Tailwind, light and dark mode. |

## Running it locally

You need Node 24 and PostgreSQL 16 binaries installed (`sudo apt install postgresql-16`). MongoDB is downloaded automatically the first time.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET to a long random string
npm run dev:services                      # Postgres on :5437, MongoDB on :27021
npm run db:migrate
npm run db:seed                           # demo guest house with three weeks of data
npm run dev                               # API on :4500, web on http://localhost:5490
```

`npm run stop:services` stops the databases. The currency is set at the top of `apps/web/src/lib/format.ts`.

## Tests

`npm test` runs the API tests against real databases, using a separate test database so demo data isn't touched. CI runs them on every push.

## Going live

The API also serves the built web app, so production is one container plus PostgreSQL and MongoDB.

```bash
cp .env.production.example .env.production   # set the passwords and JWT_SECRET
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production exec -e ADMIN_EMAIL=you@example.org -e ADMIN_NAME="Your Name" -e ADMIN_PASSWORD=choose-a-long-one app node apps/api/dist/scripts/create-admin.js
```

Then sign in, and add room types, rooms and staff from the Rooms and Staff pages.

- **HTTPS is required.** Sign-in cookies are HTTPS-only in production, so put the app behind a reverse proxy with a certificate and set `TRUST_PROXY=1`.
- **Letterhead:** set the `VITE_ORG_*` values before building. They appear on printed bills.
- **Backups:** schedule `pg_dump` for the `postgres` volume. Guest and billing records live there.

### Demo accounts

All use the password `guesthouse-demo-2026`. The sign-in page has buttons that fill them in.

| Email | Role |
| --- | --- |
| reception@fgh.example | Reception |
| housekeeping@fgh.example | Housekeeping |
| manager@fgh.example | Manager |

A good tour: as **reception**, raise a reservation for today. As **manager**, approve it from the Today page. Back as reception, check the guest in, add a charge, take payment and check out. Then sign in as **housekeeping** and clean the room.
