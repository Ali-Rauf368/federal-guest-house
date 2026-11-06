import { Printer, Trash2, Undo2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Button, Card, CategoryPill, ConditionPill, ConfirmDialog, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, StatusPill } from "../components/ui";
import { api, type ChargeKind, type Payment, type PaymentMethod, type Reservation, type Room } from "../lib/api";
import { useUser } from "../lib/auth";
import { ORG } from "../lib/org";
import { useToast } from "../lib/toast";
import { cash, CATEGORY_LABEL, dateTime, day, isoDay, plusDays, reservationNo } from "../lib/format";
import { useFetch } from "../lib/useFetch";

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-fg-3">{label}</span><span className="text-right font-medium">{children}</span></div>
);

type Dialog = "cancel" | "reject" | "charge" | "payment" | "stay" | "check-out" | "no-show" | null;

export function ReservationPage() {
  const { id } = useParams();
  const me = useUser();
  const { data: r, error, reload } = useFetch<Reservation>(`/reservations/${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const notify = useToast();
  const [reversing, setReversing] = useState<Payment>();

  async function run(path: string, success: string, init: { method?: string; body?: unknown } = { method: "POST" }) {
    try {
      await api(`/reservations/${id}${path}`, init);
      notify(success);
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }
  if (error) return <ErrorNote message={error} />;
  if (!r) return <Loading />;
  const f = r.folio;
  const inHouse = r.status === "CHECKED_IN";
  const active = inHouse || r.status === "REQUESTED" || r.status === "CONFIRMED";
  const done = (message: string) => { setDialog(null); notify(message); reload(); };

  return (
    <>
      <PrintedBill r={r} />
      <div className="print:hidden">
      <PageHeader
        title={reservationNo(r.number)}
        subtitle={<StatusPill status={r.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {r.status === "REQUESTED" && me.role === "ADMIN" && <><Button onClick={() => run("/approve", "Request approved")}>Approve</Button><Button variant="danger" onClick={() => setDialog("reject")}>Reject</Button></>}
            {r.status === "CONFIRMED" && r.checkIn.slice(0, 10) <= isoDay() && <Button onClick={() => run("/check-in", `${r.guest.fullName} checked in to room ${r.room.number}`)}>Check in</Button>}
            {inHouse && <Button onClick={() => setDialog("check-out")} disabled={f.balanceCents !== 0} title={f.balanceCents !== 0 ? "Settle the balance first" : undefined}>Check out</Button>}
            {active && <Button variant="soft" onClick={() => setDialog("stay")}>Change stay</Button>}
            {r.status === "CONFIRMED" && r.checkIn.slice(0, 10) <= isoDay() && <Button variant="ghost" onClick={() => setDialog("no-show")}>No-show</Button>}
            {(r.status === "REQUESTED" || r.status === "CONFIRMED") && <Button variant="danger" onClick={() => setDialog("cancel")}>Cancel</Button>}
            <Button variant="ghost" onClick={() => window.print()}><Printer size={16} /> Print bill</Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">Stay</h2>
          <Row label="Guest"><Link className="text-brand hover:underline" to={`/guests/${r.guest.id}`}>{r.guest.fullName}</Link></Row>
          <Row label="Category"><CategoryPill category={r.guest.category} /></Row>
          {r.guest.designation && <Row label="Designation">{r.guest.designation}</Row>}
          {r.guest.department && <Row label="Department">{r.guest.department}</Row>}
          <Row label="Phone">{r.guest.phone}</Row>
          <Row label="Room">{r.room.number} · {r.room.type.name}</Row>
          {active && <Row label="Room state"><ConditionPill condition={r.room.condition} /></Row>}
          <Row label="Arrival">{day(r.checkIn)}</Row>
          <Row label="Departure">{day(r.checkOut)}</Row>
          <Row label="Guests">{r.adults}</Row>
          <Row label="Purpose">{r.purpose}</Row>
          <Row label="Requested by">{r.createdBy}</Row>
          {r.decidedBy && <Row label="Decided by">{r.decidedBy}</Row>}
          {r.decisionNote && <Row label="Reason">{r.decisionNote}</Row>}
          {r.checkedInAt && <Row label="Checked in">{dateTime(r.checkedInAt)}</Row>}
          {r.checkedOutAt && <Row label="Checked out">{dateTime(r.checkedOutAt)}</Row>}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Bill</h2>
            {inHouse && (
              <div className="flex gap-2 print:hidden">
                <Button variant="soft" onClick={() => setDialog("charge")}>Add charge</Button>
                <Button variant="soft" onClick={() => setDialog("payment")} disabled={f.balanceCents === 0}>Take payment</Button>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-edge">
              <tr>
                <td className="py-2">Room {r.room.number}, {f.nights} {f.nights === 1 ? "night" : "nights"} at {cash(r.nightlyRateCents)}{inHouse && <span className="text-fg-3"> (to date)</span>}</td>
                <td className="py-2 text-right font-medium tabular-nums">{cash(f.roomCents)}</td>
                <td className="w-8" />
              </tr>
              {r.charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">{c.description}{c.quantity > 1 && ` × ${c.quantity}`}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{cash(c.quantity * c.unitPriceCents)}</td>
                  <td className="text-right print:hidden">{inHouse && <button aria-label={`Remove ${c.description}`} className="rounded p-1 text-fg-3 hover:text-rose-600" onClick={() => run(`/charges/${c.id}`, "Charge removed", { method: "DELETE" })}><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
              {r.payments.map((p) => (
                <tr key={p.id} className="text-fg-2">
                  <td className="py-2">
                    <span className={p.reversedAt ? "line-through" : undefined}>Paid: {p.method === "DEPARTMENT" ? "billed to department" : p.method.toLowerCase()}{p.reference && ` (${p.reference})`}</span>
                    {p.reversedAt && <div className="text-xs text-fg-3">Reversed by {p.reversedBy}: {p.reversalNote}</div>}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${p.reversedAt ? "line-through" : ""}`}>−{cash(p.amountCents)}</td>
                  <td className="text-right">{inHouse && !p.reversedAt && me.role === "ADMIN" && <button aria-label="Reverse payment" title="Reverse payment" className="rounded p-1 text-fg-3 hover:text-rose-600" onClick={() => setReversing(p)}><Undo2 size={14} /></button>}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-3">Balance</td>
                <td className="py-3 text-right tabular-nums">{cash(f.balanceCents)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
      </div>
      {(dialog === "cancel" || dialog === "reject") && <Reason action={dialog} id={r.id} onClose={() => setDialog(null)} onSaved={() => done(dialog === "cancel" ? "Reservation cancelled" : "Request rejected")} />}
      {dialog === "charge" && <AddCharge id={r.id} onClose={() => setDialog(null)} onSaved={() => done("Charge added")} />}
      {dialog === "payment" && <TakePayment r={r} onClose={() => setDialog(null)} onSaved={() => done("Payment recorded")} />}
      {dialog === "stay" && <ChangeStay r={r} onClose={() => setDialog(null)} onSaved={() => done("Stay updated")} />}
      {reversing && <ReversePayment id={r.id} payment={reversing} onClose={() => setReversing(undefined)} onSaved={() => { setReversing(undefined); done("Payment reversed"); }} />}
      {dialog === "check-out" && (
        <ConfirmDialog title="Check out guest" body={`${r.guest.fullName} will be checked out of room ${r.room.number}, and the room will go to housekeeping.`} label="Check out" onClose={() => setDialog(null)} onConfirm={() => run("/check-out", `${r.guest.fullName} checked out`)} />
      )}
      {dialog === "no-show" && (
        <ConfirmDialog title="Mark as no-show" body={`Room ${r.room.number} will be released. This can't be undone.`} label="Mark no-show" danger onClose={() => setDialog(null)} onConfirm={() => run("/no-show", "Marked as no-show")} />
      )}
    </>
  );
}

/** The paper copy of the bill. Only appears when printing. */
function PrintedBill({ r }: { r: Reservation }) {
  const f = r.folio;
  const cell = "border-b border-zinc-300 py-2";
  return (
    <section className="hidden text-sm text-black print:block">
      <div className="flex items-end justify-between border-b-2 border-black pb-3">
        <div>
          <div className="font-serif text-2xl font-bold">{ORG.name}</div>
          {ORG.contact && <div className="text-xs">{ORG.contact}</div>}
          <div className="mt-1 text-xs uppercase tracking-widest">Guest bill</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{reservationNo(r.number)}</div>
          <div className="text-xs">Printed {dateTime(new Date().toISOString())}</div>
        </div>
      </div>
      <div className="my-5 grid grid-cols-2 gap-x-8 gap-y-1">
        <div><b>Guest:</b> {r.guest.fullName}</div>
        <div><b>Room:</b> {r.room.number}, {r.room.type.name}</div>
        <div><b>Category:</b> {CATEGORY_LABEL[r.guest.category]}</div>
        <div><b>Arrival:</b> {day(r.checkIn)}</div>
        {r.guest.department && <div><b>Department:</b> {r.guest.department}</div>}
        <div><b>Departure:</b> {day(r.checkOut)}</div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-black text-left"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td className={cell}>Accommodation, {f.nights} {f.nights === 1 ? "night" : "nights"} at {cash(r.nightlyRateCents)}</td><td className={`${cell} text-right`}>{cash(f.roomCents)}</td></tr>
          {r.charges.map((c) => <tr key={c.id}><td className={cell}>{c.description}{c.quantity > 1 && ` × ${c.quantity}`}</td><td className={`${cell} text-right`}>{cash(c.quantity * c.unitPriceCents)}</td></tr>)}
          <tr className="font-semibold"><td className={cell}>Total</td><td className={`${cell} text-right`}>{cash(f.totalCents)}</td></tr>
          {r.payments.filter((p) => !p.reversedAt).map((p) => <tr key={p.id}><td className={cell}>{p.method === "DEPARTMENT" ? "Billed to department" : `Paid by ${p.method.toLowerCase()}`}{p.reference && ` (${p.reference})`}, {day(p.createdAt)}</td><td className={`${cell} text-right`}>−{cash(p.amountCents)}</td></tr>)}
          <tr className="text-base font-bold"><td className="py-3">Balance due</td><td className="py-3 text-right">{cash(f.balanceCents)}</td></tr>
        </tbody>
      </table>
      <div className="mt-20 grid grid-cols-2 gap-16 text-xs">
        <div className="border-t border-black pt-1">Guest signature</div>
        <div className="border-t border-black pt-1">Reception</div>
      </div>
    </section>
  );
}

interface DialogProps {
  onClose: () => void;
  onSaved: () => void;
}

function useSubmit(onSaved: () => void) {
  const [error, setError] = useState<string>();
  const submit = (path: string, body: unknown, method = "POST") => async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(path, { method, body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return { error, submit };
}

const Actions = ({ onClose, label }: { onClose: () => void; label: string }) => (
  <div className="flex justify-end gap-2">
    <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
    <Button>{label}</Button>
  </div>
);

function Reason({ action, id, onClose, onSaved }: DialogProps & { action: "cancel" | "reject"; id: string }) {
  const [note, setNote] = useState("");
  const { error, submit } = useSubmit(onSaved);
  return (
    <Modal title={action === "cancel" ? "Cancel reservation" : "Reject request"} onClose={onClose}>
      <form onSubmit={submit(`/reservations/${id}/${action}`, { note })} className="space-y-3">
        <Field label="Reason"><Input value={note} onChange={(e) => setNote(e.target.value)} required minLength={3} /></Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} label={action === "cancel" ? "Cancel reservation" : "Reject"} />
      </form>
    </Modal>
  );
}

function ReversePayment({ id, payment, onClose, onSaved }: DialogProps & { id: string; payment: Payment }) {
  const [reason, setReason] = useState("");
  const { error, submit } = useSubmit(onSaved);
  return (
    <Modal title={`Reverse payment of ${cash(payment.amountCents)}`} onClose={onClose}>
      <form onSubmit={submit(`/reservations/${id}/payments/${payment.id}/reverse`, { reason })} className="space-y-3">
        <Field label="Reason" hint="The payment stays on record, marked as reversed."><Input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} label="Reverse payment" />
      </form>
    </Modal>
  );
}

function AddCharge({ id, onClose, onSaved }: DialogProps & { id: string }) {
  const [kind, setKind] = useState<ChargeKind>("MEAL");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const { error, submit } = useSubmit(onSaved);
  return (
    <Modal title="Add charge" onClose={onClose}>
      <form onSubmit={submit(`/reservations/${id}/charges`, { kind, description, quantity, unitPriceCents: Math.round(Number(price) * 100) })} className="space-y-3">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ChargeKind)}>
            <option value="MEAL">Meal</option>
            <option value="LAUNDRY">Laundry</option>
            <option value="TRANSPORT">Transport</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} required minLength={2} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required /></Field>
          <Field label="Unit price"><Input type="number" min={0.01} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
        </div>
        <ErrorNote message={error} />
        <Actions onClose={onClose} label="Add" />
      </form>
    </Modal>
  );
}

function TakePayment({ r, onClose, onSaved }: DialogProps & { r: Reservation }) {
  const [method, setMethod] = useState<PaymentMethod>(r.guest.category === "PRIVATE" ? "CASH" : "DEPARTMENT");
  const [amount, setAmount] = useState(String(r.folio.balanceCents / 100));
  const [reference, setReference] = useState("");
  const { error, submit } = useSubmit(onSaved);
  return (
    <Modal title="Take payment" onClose={onClose}>
      <form onSubmit={submit(`/reservations/${r.id}/payments`, { method, amountCents: Math.round(Number(amount) * 100), reference: reference || undefined })} className="space-y-3">
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="DEPARTMENT">Bill to department</option>
          </Select>
        </Field>
        <Field label="Amount" hint={`Balance ${cash(r.folio.balanceCents)}`}><Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label={method === "DEPARTMENT" ? "Billing reference" : "Reference (optional)"}><Input value={reference} onChange={(e) => setReference(e.target.value)} required={method === "DEPARTMENT"} /></Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} label="Record payment" />
      </form>
    </Modal>
  );
}

function ChangeStay({ r, onClose, onSaved }: DialogProps & { r: Reservation }) {
  const [checkOut, setCheckOut] = useState(r.checkOut.slice(0, 10));
  const [roomId, setRoomId] = useState(r.room.id);
  const valid = checkOut > r.checkIn.slice(0, 10);
  const from = r.status === "CHECKED_IN" ? isoDay() : r.checkIn.slice(0, 10);
  const to = checkOut > from ? checkOut : plusDays(from, 1);
  const rooms = useFetch<Room[]>(valid ? `/rooms/available?from=${from}&to=${to}&adults=${r.adults}&excluding=${r.id}` : null);
  const { error, submit } = useSubmit(onSaved);
  return (
    <Modal title="Change stay" onClose={onClose}>
      <form onSubmit={submit(`/reservations/${r.id}/stay`, { checkOut, roomId }, "PATCH")} className="space-y-3">
        <Field label="Departure"><Input type="date" min={plusDays(r.checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required /></Field>
        <Field label="Room">
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value={r.room.id}>{r.room.number} · {r.room.type.name} (current)</option>
            {rooms.data?.filter((x) => x.id !== r.room.id).map((x) => <option key={x.id} value={x.id}>{x.number} · {x.type.name}</option>)}
          </Select>
        </Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} label="Save" />
      </form>
    </Modal>
  );
}
