import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Card, ConfirmDialog, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select } from "../components/ui";
import { api, type Role, type Staff } from "../lib/api";
import { useUser } from "../lib/auth";
import { useToast } from "../lib/toast";
import { useFetch } from "../lib/useFetch";

export function StaffPage() {
  const me = useUser();
  const { data, error, reload } = useFetch<Staff[]>("/staff");
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<Staff>();
  const [resetting, setResetting] = useState<Staff>();
  const notify = useToast();

  async function toggle(s: Staff) {
    try {
      await api(`/staff/${s.id}`, { method: "PATCH", body: { active: !s.active } });
      notify(`${s.name} ${s.active ? "deactivated" : "reactivated"}`);
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader title="Staff" subtitle="Who can sign in, and what they can do." actions={<Button onClick={() => setAdding(true)}><UserPlus size={16} /> Add staff</Button>} />
      <ErrorNote message={error} />
      <Card className="overflow-x-auto">
        {!data ? <Loading /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-fg-3">
              <tr className="border-b border-edge">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Email</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {data.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {s.name}
                    </div>
                  </td>
                  <td className="px-3 py-3 capitalize text-fg-2">{s.role.toLowerCase()}</td>
                  <td className="px-3 py-3 text-fg-2">{s.email}</td>
                  <td className="px-5 py-3 text-right">
                    {s.id !== me.id && <Button variant="ghost" onClick={() => setResetting(s)}>Reset password</Button>}
                    {s.id !== me.id && <Button variant={s.active ? "danger" : "soft"} onClick={() => (s.active ? setDeactivating(s) : toggle(s))}>{s.active ? "Deactivate" : "Reactivate"}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {deactivating && <ConfirmDialog title="Deactivate account" body={`${deactivating.name} will be signed out and won't be able to sign in.`} label="Deactivate" danger onClose={() => setDeactivating(undefined)} onConfirm={() => toggle(deactivating)} />}
      {resetting && <ResetPassword staff={resetting} onClose={() => setResetting(undefined)} onSaved={() => { notify(`Password reset for ${resetting.name}`); setResetting(undefined); }} />}
      {adding && <AddStaff onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function AddStaff({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "RECEPTION" as Role, password: "" });
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/staff", { method: "POST", body: form });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title="Add staff member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Full name"><Input value={form.name} onChange={set("name")} required /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} required /></Field>
        <Field label="Role">
          <Select value={form.role} onChange={set("role")}>
            <option value="HOUSEKEEPING">Housekeeping</option>
            <option value="RECEPTION">Reception</option>
            <option value="ADMIN">Manager</option>
          </Select>
        </Field>
        <Field label="Initial password" hint="At least 10 characters. Share it with them securely."><Input type="password" value={form.password} onChange={set("password")} required minLength={10} /></Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Add</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/staff/${staff.id}/password`, { method: "POST", body: { password } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title={`Reset password for ${staff.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password" hint="At least 10 characters. Share it with them securely."><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Reset password</Button>
        </div>
      </form>
    </Modal>
  );
}
