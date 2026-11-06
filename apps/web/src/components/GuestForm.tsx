import { useState, type FormEvent } from "react";
import { api, type Guest, type GuestCategory } from "../lib/api";
import { Button, ErrorNote, Field, Input, Modal, Select } from "./ui";

export function GuestForm({ guest, onClose, onSaved }: { guest?: Guest; onClose: () => void; onSaved: (g: Guest) => void }) {
  const [form, setForm] = useState({
    fullName: guest?.fullName ?? "",
    category: guest?.category ?? ("OFFICIAL" as GuestCategory),
    idNumber: guest?.idNumber ?? "",
    designation: guest?.designation ?? "",
    department: guest?.department ?? "",
    phone: guest?.phone ?? "",
    email: guest?.email ?? "",
  });
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      onSaved(await api<Guest>(guest ? `/guests/${guest.id}` : "/guests", { method: guest ? "PUT" : "POST", body: form }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={guest ? "Edit guest" : "New guest"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Full name"><Input value={form.fullName} onChange={set("fullName")} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={set("category")}>
              <option value="OFFICIAL">Official</option>
              <option value="STATE_GUEST">State guest (no charge)</option>
              <option value="PRIVATE">Private</option>
            </Select>
          </Field>
          <Field label="National ID or passport"><Input value={form.idNumber} onChange={set("idNumber")} /></Field>
          <Field label="Designation"><Input value={form.designation} onChange={set("designation")} /></Field>
          <Field label="Department"><Input value={form.department} onChange={set("department")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
