import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, ErrorNote, Loading, PageHeader } from "../components/ui";
import type { CalendarData, ReservationStatus } from "../lib/api";
import { isoDay, plusDays } from "../lib/format";
import { useFetch } from "../lib/useFetch";

const DAYS = 14;
const dayNumber = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

const barStyle: Partial<Record<ReservationStatus, string>> = {
  REQUESTED: "border border-dashed border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  CONFIRMED: "bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-100",
  CHECKED_IN: "bg-brand text-brand-fg",
  CHECKED_OUT: "bg-soft text-fg-3",
};
const LEGEND: [ReservationStatus, string][] = [["CHECKED_IN", "In house"], ["CONFIRMED", "Confirmed"], ["REQUESTED", "Awaiting approval"], ["CHECKED_OUT", "Checked out"]];

export function CalendarPage() {
  const [from, setFrom] = useState(() => plusDays(isoDay(), -2));
  const { data, error } = useFetch<CalendarData>(`/reservations/calendar?from=${from}&days=${DAYS}`);
  const days = Array.from({ length: DAYS }, (_, i) => plusDays(from, i));
  const start = dayNumber(from);
  const columns = { gridTemplateColumns: `4.5rem repeat(${DAYS}, minmax(3.25rem, 1fr))` };

  return (
    <>
      <PageHeader
        title="Room calendar"
        subtitle="Every room, two weeks at a time."
        actions={
          <>
            <Button variant="ghost" onClick={() => setFrom(plusDays(from, -7))} aria-label="Previous week"><ChevronLeft size={16} /></Button>
            <Button variant="soft" onClick={() => setFrom(plusDays(isoDay(), -2))}>Today</Button>
            <Button variant="ghost" onClick={() => setFrom(plusDays(from, 7))} aria-label="Next week"><ChevronRight size={16} /></Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-fg-2">
        {LEGEND.map(([s, label]) => <span key={s} className="flex items-center gap-1.5"><span className={clsx("h-3 w-5 rounded", barStyle[s])} /> {label}</span>)}
      </div>
      <ErrorNote message={error} />
      <Card className="overflow-x-auto">
        {!data ? <Loading /> : (
          <div className="min-w-[52rem]">
            <div className="grid border-b border-edge text-center text-xs text-fg-3" style={columns}>
              <div className="sticky left-0 bg-card" />
              {days.map((d) => (
                <div key={d} className={clsx("py-2", d === isoDay() && "bg-brand-soft font-bold text-brand")}>
                  <div>{new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>
                  <div className="font-semibold">{Number(d.slice(8))}</div>
                </div>
              ))}
            </div>
            {data.rooms.map((room) => (
              <div key={room.id} className="grid h-9 items-center border-b border-edge last:border-0" style={columns}>
                <div className="sticky left-0 z-10 flex h-full items-center bg-card px-3 text-sm font-semibold" style={{ gridColumn: 1, gridRow: 1 }} title={room.type.name}>{room.number}</div>
                {data.reservations.filter((r) => r.roomId === room.id).map((r) => {
                  const a = Math.max(0, dayNumber(r.checkIn) - start);
                  const b = Math.min(DAYS, dayNumber(r.checkOut) - start);
                  return (
                    <Link
                      key={r.id}
                      to={`/reservations/${r.id}`}
                      title={r.guest.fullName}
                      className={clsx("mx-0.5 truncate rounded px-1.5 py-1 text-xs font-semibold hover:brightness-110", barStyle[r.status])}
                      style={{ gridColumn: `${a + 2} / ${b + 2}`, gridRow: 1 }}
                    >
                      {r.guest.fullName}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
