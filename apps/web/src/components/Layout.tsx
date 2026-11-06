import clsx from "clsx";
import { BedDouble, BookOpenCheck, CalendarRange, KeyRound, Landmark, LayoutGrid, LogOut, Moon, ShieldCheck, Sun, UserRound, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api, type Role } from "../lib/api";
import { useAuth, useUser } from "../lib/auth";
import { useToast } from "../lib/toast";
import { Button, ErrorNote, Field, Input, Modal } from "./ui";

const DESK: Role[] = ["ADMIN", "RECEPTION"];
const NAV: { group: string; items: { to: string; label: string; icon: typeof Users; roles?: Role[] }[] }[] = [
  {
    group: "Front office",
    items: [
      { to: "/", label: "Today", icon: LayoutGrid, roles: DESK },
      { to: "/calendar", label: "Room calendar", icon: CalendarRange, roles: DESK },
      { to: "/reservations", label: "Reservations", icon: BookOpenCheck, roles: DESK },
      { to: "/guests", label: "Guests", icon: UserRound, roles: DESK },
    ],
  },
  { group: "Housekeeping", items: [{ to: "/rooms", label: "Rooms", icon: BedDouble }] },
  {
    group: "Administration",
    items: [
      { to: "/staff", label: "Staff", icon: Users, roles: ["ADMIN"] },
      { to: "/access-log", label: "Access log", icon: ShieldCheck, roles: ["ADMIN"] },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Manager", RECEPTION: "Reception", HOUSEKEEPING: "Housekeeping" };
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fgh.theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
    setDark(next);
  };
  return { dark, toggle };
}

export function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();
  const [changingPassword, setChangingPassword] = useState(false);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.roles || n.roles.includes(user.role)) })).filter((g) => g.items.length > 0);
  const current = NAV.flatMap((g) => g.items).find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen md:flex print:block">
      <aside className="border-t-4 border-brass bg-side text-side-fg md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col print:hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brass text-side">
            <Landmark size={19} />
          </span>
          <div className="leading-tight">
            <div className="font-serif font-bold text-white">Federal</div>
            <div className="text-[11px] font-medium uppercase tracking-widest opacity-70">Guest House</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto">
          {groups.map((g) => (
            <div key={g.group} className="flex shrink-0 gap-1 md:flex-col md:gap-0.5">
              <div className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider opacity-55 md:block">{g.group}</div>
              {g.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    clsx("flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition", isActive ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--brass)]" : "hover:bg-white/6 hover:text-white")
                  }
                >
                  <Icon size={17} /> {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <p className="hidden border-t border-white/10 px-5 py-3 text-[11px] leading-snug opacity-55 md:block">Authorised staff only. All access is logged.</p>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-edge bg-card px-4 md:px-8 print:hidden">
          <div className="truncate text-sm text-fg-3">Federal Guest House <span className="px-1">/</span> <span className="font-semibold text-fg">{current?.label}</span></div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-2 hidden text-right leading-tight sm:block">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-fg-3">{ROLE_LABEL[user.role]}</span>
            </span>
            <span aria-hidden className="mr-1 grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(user.name)}</span>
            <button onClick={toggle} className="rounded-md p-2 text-fg-2 hover:bg-soft" aria-label="Toggle dark mode">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setChangingPassword(true)} className="rounded-md p-2 text-fg-2 hover:bg-soft" aria-label="Change password" title="Change password">
              <KeyRound size={16} />
            </button>
            <button onClick={logout} className="rounded-md p-2 text-fg-2 hover:bg-soft" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-7 print:p-0">
          <div className="mx-auto max-w-6xl print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
      {changingPassword && <ChangePassword onClose={() => setChangingPassword(false)} />}
    </div>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string>();
  const notify = useToast();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/password", { method: "POST", body: { current, next } });
      notify("Password changed");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title="Change password" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="New password" hint="At least 10 characters."><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} /></Field>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Change password</Button>
        </div>
      </form>
    </Modal>
  );
}
