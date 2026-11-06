/** The guest house's currency. Change it here; amounts are stored in minor units. */
const money = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
export const cash = (cents: number) => money.format(cents / 100);

export const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
/** Stay dates are calendar days stored at UTC midnight, so they are always shown in UTC. */
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const dateTime = (iso: string) => `${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${time(iso)}`;

/** YYYY-MM-DD in local time. */
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const reservationNo = (n: number) => `FGH-${String(n).padStart(6, "0")}`;
export const CATEGORY_LABEL = { OFFICIAL: "Official", STATE_GUEST: "State guest", PRIVATE: "Private" } as const;
