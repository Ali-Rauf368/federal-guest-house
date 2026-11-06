import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { NewReservation } from "../components/NewReservation";
import { Button, Card, CategoryPill, Empty, ErrorNote, Input, Loading, PageHeader, Pager, Select, StatusPill } from "../components/ui";
import type { Page, Reservation } from "../lib/api";
import { reservationNo, shortDay } from "../lib/format";
import { useFetch } from "../lib/useFetch";

export function ReservationsPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState(false);
  const navigate = useNavigate();
  const { data, error } = useFetch<Page<Reservation>>(`/reservations?status=${status}&q=${encodeURIComponent(q)}&page=${page}`.replace("status=&", ""));

  return (
    <>
      <PageHeader title="Reservations" subtitle="Requests, confirmed bookings and past stays." actions={<Button onClick={() => setBooking(true)}><Plus size={16} /> New reservation</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Guest, room or reservation number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select className="max-w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="REQUESTED">Awaiting approval</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CHECKED_IN">In house</option>
          <option value="CHECKED_OUT">Checked out</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
          <option value="NO_SHOW">No-show</option>
          <option value="">All</option>
        </Select>
      </div>
      <ErrorNote message={error} />
      <Card className="overflow-x-auto">
        {!data ? <Loading /> : data.items.length === 0 ? <Empty>No reservations match.</Empty> : (
          <>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-fg-3">
              <tr className="border-b border-edge">
                <th className="px-5 py-3 font-semibold">Number</th>
                <th className="px-3 py-3 font-semibold">Guest</th>
                <th className="px-3 py-3 font-semibold">Room</th>
                <th className="px-3 py-3 font-semibold">Stay</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {data.items.map((r) => (
                <tr key={r.id} className="hover:bg-soft">
                  <td className="whitespace-nowrap px-5 py-2.5"><Link className="font-semibold text-brand hover:underline" to={`/reservations/${r.id}`}>{reservationNo(r.number)}</Link></td>
                  <td className="px-3 py-2.5"><span className="mr-2 font-semibold">{r.guest.fullName}</span><CategoryPill category={r.guest.category} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-fg-2">{r.room.number} · {r.room.type.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-fg-2">{shortDay(r.checkIn)} to {shortDay(r.checkOut)}</td>
                  <td className="px-5 py-2.5"><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={data} onPage={setPage} />
          </>
        )}
      </Card>
      {booking && <NewReservation onClose={() => setBooking(false)} onSaved={(r) => navigate(`/reservations/${r.id}`)} />}
    </>
  );
}
