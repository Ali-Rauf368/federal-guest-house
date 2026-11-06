import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NewReservation } from "../components/NewReservation";
import { Button, Card, CategoryPill, CONDITION_LABEL, Empty, ErrorNote, Loading, PageHeader } from "../components/ui";
import type { Dashboard, DashboardRow, RoomCondition } from "../lib/api";
import { cash, shortDay } from "../lib/format";
import { useFetch } from "../lib/useFetch";

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-3">{label}</div>
      <div className="mt-1 font-serif text-3xl font-bold">{value}</div>
      {note && <div className="mt-0.5 text-xs text-fg-3">{note}</div>}
    </Card>
  );
}

function List({ title, rows, empty, detail }: { title: string; rows: DashboardRow[]; empty: string; detail: (r: DashboardRow) => string }) {
  return (
    <Card>
      <h2 className="border-b border-edge px-5 py-3 text-lg font-bold">{title} <span className="font-sans text-sm font-medium text-fg-3">{rows.length}</span></h2>
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <ul className="max-h-80 divide-y divide-edge overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.guest.fullName}</div>
                  <div className="truncate text-xs text-fg-3">Room {r.room.number} · {detail(r)}</div>
                </div>
                <CategoryPill category={r.guest.category} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TodayPage() {
  const { data, error } = useFetch<Dashboard>("/dashboard");
  const [booking, setBooking] = useState(false);
  const navigate = useNavigate();
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;
  const conditions = (["DIRTY", "CLEANING", "OUT_OF_ORDER"] as RoomCondition[]).filter((c) => data.conditions[c]);

  return (
    <>
      <PageHeader title="Today" subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} actions={<Button onClick={() => setBooking(true)}><Plus size={16} /> New reservation</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="In house" value={`${data.inHouse} / ${data.totalRooms}`} note={`${Math.round((data.inHouse / Math.max(1, data.totalRooms)) * 100)}% of rooms occupied`} />
        <Stat label="Rooms ready" value={data.conditions.READY ?? 0} note={conditions.map((c) => `${data.conditions[c]} ${CONDITION_LABEL[c].toLowerCase()}`).join(", ") || "All rooms ready"} />
        <Stat label="Awaiting approval" value={data.pending.length} />
        <Stat label="Collected this month" value={cash(data.collectedThisMonthCents)} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <List title="Arrivals" rows={data.arrivals} empty="No more arrivals today." detail={(r) => r.purpose} />
        <List title="Departures" rows={data.departures} empty="No departures due." detail={(r) => `due ${shortDay(r.checkOut)}`} />
        <List title="Awaiting approval" rows={data.pending} empty="Nothing to approve." detail={(r) => `${shortDay(r.checkIn)} to ${shortDay(r.checkOut)}`} />
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Rooms booked, next 14 days</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.occupancy} margin={{ left: -24, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--edge)" />
              <XAxis dataKey="day" tickFormatter={(d: string) => shortDay(d)} tick={{ fontSize: 11, fill: "var(--fg-3)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[0, data.totalRooms]} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--fg-3)" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--soft)" }}
                labelFormatter={(d) => shortDay(String(d))}
                formatter={(v) => [`${v} of ${data.totalRooms}`, "Rooms booked"]}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--edge)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
              />
              <Bar dataKey="rooms" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {booking && <NewReservation onClose={() => setBooking(false)} onSaved={(r) => navigate(`/reservations/${r.id}`)} />}
    </>
  );
}
