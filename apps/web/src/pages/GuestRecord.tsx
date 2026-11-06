import { useState } from "react";
import { Link, useParams } from "react-router";
import { GuestForm } from "../components/GuestForm";
import { Button, Card, CategoryPill, Empty, ErrorNote, Loading, PageHeader, StatusPill } from "../components/ui";
import type { GuestRecord } from "../lib/api";
import { reservationNo, shortDay } from "../lib/format";
import { useFetch } from "../lib/useFetch";

export function GuestRecordPage() {
  const { id } = useParams();
  const { data: g, error, reload } = useFetch<GuestRecord>(`/guests/${id}`);
  const [editing, setEditing] = useState(false);
  if (error) return <ErrorNote message={error} />;
  if (!g) return <Loading />;
  const details: [string, string | null][] = [["ID number", g.idNumber], ["Designation", g.designation], ["Department", g.department], ["Phone", g.phone], ["Email", g.email]];
  return (
    <>
      <PageHeader title={g.fullName} subtitle={<CategoryPill category={g.category} />} actions={<Button variant="soft" onClick={() => setEditing(true)}>Edit</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">Details</h2>
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-fg-3">{label}</span><span className="text-right font-medium">{value ?? "—"}</span></div>
          ))}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="border-b border-edge px-5 py-3 text-lg font-bold">Stays</h2>
          {g.reservations.length === 0 ? <Empty>No stays yet.</Empty> : (
            <ul className="divide-y divide-edge">
              {g.reservations.map((r) => (
                <li key={r.id}>
                  <Link to={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-soft">
                    <div>
                      <div className="font-semibold">{shortDay(r.checkIn)} to {shortDay(r.checkOut)} · Room {r.room.number}</div>
                      <div className="text-xs text-fg-3">{reservationNo(r.number)} · {r.purpose}</div>
                    </div>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {editing && <GuestForm guest={g} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}
