import { Landmark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";

const DEMO = [
  { email: "reception@fgh.example", label: "Reception" },
  { email: "housekeeping@fgh.example", label: "Housekeeping" },
  { email: "manager@fgh.example", label: "Manager" },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-side p-12 text-side-fg md:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brass text-side">
            <Landmark size={21} />
          </span>
          <span className="text-lg font-serif font-bold text-white">Federal Guest House</span>
        </div>
        <div>
          <h1 className="max-w-md font-serif text-4xl font-bold leading-tight text-white">Every room, every guest and every bill, in one register.</h1>
          <p className="mt-4 max-w-md">Take booking requests, approve allotments, check guests in and out, and keep housekeeping in step.</p>
        </div>
        <p className="text-xs opacity-60">Every access to a guest record is logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Sign in</h2>
            <p className="mt-1 text-sm text-fg-3">Use your staff account.</p>
          </div>
          <Field label="Email">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full py-2.5" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          {import.meta.env.DEV && (
            <div className="rounded-xl bg-soft p-3 text-xs text-fg-2">
              <div className="mb-2 font-semibold">Demo accounts (password guesthouse-demo-2026)</div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO.map((d) => (
                  <button
                    type="button"
                    key={d.email}
                    className="rounded-lg bg-card px-2.5 py-1 font-semibold hover:text-brand"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword("guesthouse-demo-2026");
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
