import { useState, type FormEvent } from "react";
import { Button, Card, CONDITION_LABEL, ConditionPill, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select } from "../components/ui";
import { api, type Room, type RoomCondition, type RoomType } from "../lib/api";
import { useUser } from "../lib/auth";
import { useToast } from "../lib/toast";
import { useFetch } from "../lib/useFetch";

const NEXT: Partial<Record<RoomCondition, { to: RoomCondition; label: string }>> = {
  DIRTY: { to: "CLEANING", label: "Start cleaning" },
  CLEANING: { to: "READY", label: "Mark ready" },
  READY: { to: "DIRTY", label: "Needs cleaning" },
};

export function RoomsPage() {
  const me = useUser();
  const { data, error, reload } = useFetch<Room[]>("/rooms");
  const [filter, setFilter] = useState("");
  const [actionError, setActionError] = useState<string>();
  const [outOfOrder, setOutOfOrder] = useState<Room>();
  const [tariffs, setTariffs] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const desk = me.role !== "HOUSEKEEPING";
  const notify = useToast();

  async function change(room: Room, condition: RoomCondition) {
    setActionError(undefined);
    try {
      await api(`/rooms/${room.id}/condition`, { method: "PATCH", body: { condition } });
      notify(`Room ${room.number}: ${CONDITION_LABEL[condition].toLowerCase()}`);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const rooms = data?.filter((r) => !filter || r.condition === filter);
  const floors = [...new Set(rooms?.map((r) => r.floor))];

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Cleaning status of every room, updated as the work happens."
        actions={
          <>
            <Select className="w-44" aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All rooms</option>
              <option value="DIRTY">Needs cleaning</option>
              <option value="CLEANING">Being cleaned</option>
              <option value="READY">Ready</option>
              <option value="OUT_OF_ORDER">Out of order</option>
            </Select>
            {me.role === "ADMIN" && <><Button variant="soft" onClick={() => setTariffs(true)}>Room types and tariffs</Button><Button onClick={() => setAddingRoom(true)}>Add room</Button></>}
          </>
        }
      />
      <div className="mb-4 space-y-2"><ErrorNote message={error} /><ErrorNote message={actionError} /></div>
      {!rooms ? <Loading /> : floors.map((floor) => (
        <section key={floor} className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Floor {floor}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.filter((r) => r.floor === floor).map((r) => {
              const next = NEXT[r.condition];
              return (
                <Card key={r.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-serif text-xl font-bold">{r.number}</div>
                      <div className="text-xs text-fg-3">{r.type.name}{r.occupied && " · occupied"}</div>
                    </div>
                    <ConditionPill condition={r.condition} />
                  </div>
                  {r.note && <p className="text-xs text-fg-2">{r.note}</p>}
                  <div className="mt-auto flex flex-wrap gap-1">
                    {next && <Button variant={r.condition === "READY" ? "ghost" : "soft"} className="px-2.5 py-1" onClick={() => change(r, next.to)}>{next.label}</Button>}
                    {desk && r.condition === "OUT_OF_ORDER" && <Button variant="soft" className="px-2.5 py-1" onClick={() => change(r, "DIRTY")}>Back in service</Button>}
                    {desk && r.condition !== "OUT_OF_ORDER" && !r.occupied && <Button variant="danger" className="px-2.5 py-1" onClick={() => setOutOfOrder(r)}>Out of order</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
      {outOfOrder && <OutOfOrder room={outOfOrder} onClose={() => setOutOfOrder(undefined)} onSaved={() => { setOutOfOrder(undefined); reload(); }} />}
      {tariffs && <Tariffs onClose={() => setTariffs(false)} />}
      {addingRoom && <AddRoom onClose={() => setAddingRoom(false)} onSaved={() => { setAddingRoom(false); notify("Room added"); reload(); }} />}
    </>
  );
}

function OutOfOrder({ room, onClose, onSaved }: { room: Room; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/rooms/${room.id}/condition`, { method: "PATCH", body: { condition: "OUT_OF_ORDER", note } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title={`Take room ${room.number} out of order`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="What's wrong?"><Input value={note} onChange={(e) => setNote(e.target.value)} required /></Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function Tariffs({ onClose }: { onClose: () => void }) {
  const { data, error, reload } = useFetch<RoomType[]>("/rooms/types");
  const [saveError, setSaveError] = useState<string>();
  async function save(t: RoomType, key: "officialRateCents" | "privateRateCents", value: string) {
    const cents = Math.round(Number(value) * 100);
    if (cents === t[key]) return;
    setSaveError(undefined);
    try {
      await api(`/rooms/types/${t.id}`, { method: "PATCH", body: { officialRateCents: t.officialRateCents, privateRateCents: t.privateRateCents, [key]: cents } });
      reload();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  return (
    <Modal title="Room types and tariffs" onClose={onClose} wide>
      <ErrorNote message={error ?? saveError} />
      {!data ? <Loading /> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-fg-3">
            <tr className="border-b border-edge"><th className="py-2 font-semibold">Room type</th><th className="px-2 py-2 font-semibold">Official</th><th className="py-2 font-semibold">Private</th></tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {data.map((t) => (
              <tr key={t.id}>
                <td className="py-2 font-semibold">{t.name}<div className="text-xs font-normal text-fg-3">Sleeps {t.capacity}</div></td>
                <td className="px-2 py-2"><Input type="number" min={0} aria-label={`${t.name} official tariff`} defaultValue={t.officialRateCents / 100} onBlur={(e) => save(t, "officialRateCents", e.target.value)} /></td>
                <td className="py-2"><Input type="number" min={0} aria-label={`${t.name} private tariff`} defaultValue={t.privateRateCents / 100} onBlur={(e) => save(t, "privateRateCents", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AddType onSaved={reload} />
      <p className="mt-3 text-xs text-fg-3">Saved when you leave a field. New tariffs apply to new reservations only. State guests stay free of charge.</p>
    </Modal>
  );
}

function AddType({ onSaved }: { onSaved: () => void }) {
  const blank = { name: "", capacity: "2", official: "", private: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      await api("/rooms/types", {
        method: "POST",
        body: { name: form.name, capacity: form.capacity, officialRateCents: Math.round(Number(form.official) * 100), privateRateCents: Math.round(Number(form.private) * 100) },
      });
      setForm(blank);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-edge pt-4">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
        <div className="col-span-2"><Field label="New room type"><Input value={form.name} onChange={set("name")} required minLength={2} /></Field></div>
        <Field label="Sleeps"><Input type="number" min={1} max={12} value={form.capacity} onChange={set("capacity")} required /></Field>
        <Field label="Official"><Input type="number" min={0} value={form.official} onChange={set("official")} required /></Field>
        <Field label="Private"><Input type="number" min={0} value={form.private} onChange={set("private")} required /></Field>
      </div>
      <ErrorNote message={error} />
      <Button variant="soft">Add room type</Button>
    </form>
  );
}

function AddRoom({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const types = useFetch<RoomType[]>("/rooms/types");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/rooms", { method: "POST", body: { number, floor, typeId } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title="Add room" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room number"><Input value={number} onChange={(e) => setNumber(e.target.value)} required /></Field>
          <Field label="Floor"><Input type="number" min={0} value={floor} onChange={(e) => setFloor(e.target.value)} required /></Field>
        </div>
        <Field label="Room type" hint={types.data?.length === 0 ? "Add a room type first." : undefined}>
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
            <option value="">Choose a type</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <ErrorNote message={error ?? types.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Add room</Button>
        </div>
      </form>
    </Modal>
  );
}
