import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type Guest, type Page, type Reservation, type Room } from "../lib/api";
import { cash, isoDay, plusDays } from "../lib/format";
import { useFetch } from "../lib/useFetch";
import { GuestForm } from "./GuestForm";
import { Button, ErrorNote, Field, Input, Modal, Select } from "./ui";

const nightlyRate = (guest: Guest | undefined, room: Room) =>
  !guest || guest.category === "OFFICIAL" ? room.type.officialRateCents : guest.category === "PRIVATE" ? room.type.privateRateCents : 0;

export function NewReservation({ onClose, onSaved }: { onClose: () => void; onSaved: (r: Reservation) => void }) {
  const [search, setSearch] = useState("");
  const [guest, setGuest] = useState<Guest>();
  const [addingGuest, setAddingGuest] = useState(false);
  const [checkIn, setCheckIn] = useState(isoDay());
  const [checkOut, setCheckOut] = useState(plusDays(isoDay(), 2));
  const [adults, setAdults] = useState(1);
  const [roomId, setRoomId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string>();

  const guests = useFetch<Page<Guest>>(search.length >= 2 ? `/guests?q=${encodeURIComponent(search)}` : null);
  const validDates = checkOut > checkIn;
  const rooms = useFetch<Room[]>(validDates ? `/rooms/available?from=${checkIn}&to=${checkOut}&adults=${adults}` : null);
  const roomStillFree = rooms.data?.some((r) => r.id === roomId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!guest) return setError("Choose a guest first");
    try {
      onSaved(await api<Reservation>("/reservations", { method: "POST", body: { guestId: guest.id, roomId, checkIn, checkOut, adults, purpose } }));
    } catch (err) {
      setError((err as Error).message);
      rooms.reload();
    }
  }

  return (
    <Modal title="New reservation" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        {guest ? (
          <div className="flex items-center justify-between rounded-lg bg-soft px-3 py-2 text-sm">
            <span><b>{guest.fullName}</b> {guest.department && <span className="text-fg-3">· {guest.department}</span>}</span>
            <Button type="button" variant="ghost" onClick={() => setGuest(undefined)}>Change</Button>
          </div>
        ) : (
          <Field label="Guest">
            <div className="flex gap-2">
              <Input placeholder="Search by name, ID, phone or department" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="button" variant="soft" className="shrink-0" onClick={() => setAddingGuest(true)}><UserPlus size={16} /> New</Button>
            </div>
            {search.length >= 2 && guests.data && (
              <div className="mt-1 max-h-40 divide-y divide-edge overflow-y-auto rounded-lg border border-edge">
                {guests.data.items.length === 0 && <p className="px-3 py-2 text-sm text-fg-3">No guest found.</p>}
                {guests.data.items.map((g) => (
                  <button type="button" key={g.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-soft" onClick={() => setGuest(g)}>
                    <b>{g.fullName}</b> <span className="text-fg-3">{g.department ?? g.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Arrival"><Input type="date" min={isoDay()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></Field>
          <Field label="Departure"><Input type="date" min={plusDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required /></Field>
          <Field label="Guests"><Input type="number" min={1} max={4} value={adults} onChange={(e) => setAdults(Number(e.target.value) || 1)} required /></Field>
        </div>
        <Field label="Room" hint={rooms.data ? `${rooms.data.length} rooms free for these dates` : undefined}>
          <Select value={roomStillFree ? roomId : ""} onChange={(e) => setRoomId(e.target.value)} required>
            <option value="">Choose a room</option>
            {rooms.data?.map((r) => (
              <option key={r.id} value={r.id}>{r.number} · {r.type.name} · {cash(nightlyRate(guest, r))} a night</option>
            ))}
          </Select>
        </Field>
        <Field label="Purpose of stay"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} required minLength={3} /></Field>
        <ErrorNote message={error ?? rooms.error} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-fg-3">The manager approves the request before it is confirmed.</p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={!guest || !roomStillFree}>Send for approval</Button>
          </div>
        </div>
      </form>
      {addingGuest && <GuestForm onClose={() => setAddingGuest(false)} onSaved={(g) => { setGuest(g); setAddingGuest(false); }} />}
    </Modal>
  );
}
