import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { GuestForm } from "../components/GuestForm";
import { Button, Card, CategoryPill, Empty, ErrorNote, Input, Loading, PageHeader, Pager } from "../components/ui";
import type { Guest, Page } from "../lib/api";
import { useFetch } from "../lib/useFetch";

export function GuestsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const { data, error } = useFetch<Page<Guest>>(`/guests?q=${encodeURIComponent(q)}&page=${page}`);
  return (
    <>
      <PageHeader title="Guests" subtitle="Everyone who has stayed or is due to stay." actions={<Button onClick={() => setAdding(true)}><UserPlus size={16} /> New guest</Button>} />
      <Input className="mb-4 max-w-sm" placeholder="Name, ID number, phone or department" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <ErrorNote message={error} />
      <Card className="overflow-x-auto">
        {!data ? <Loading /> : data.items.length === 0 ? <Empty>No guests match.</Empty> : (
          <>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-fg-3">
              <tr className="border-b border-edge">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold">Department</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {data.items.map((g) => (
                <tr key={g.id} className="hover:bg-soft">
                  <td className="px-5 py-2.5"><Link className="font-semibold text-brand hover:underline" to={`/guests/${g.id}`}>{g.fullName}</Link></td>
                  <td className="px-3 py-2.5"><CategoryPill category={g.category} /></td>
                  <td className="px-3 py-2.5 text-fg-2">{g.department ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-fg-2">{g.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager data={data} onPage={setPage} />
          </>
        )}
      </Card>
      {adding && <GuestForm onClose={() => setAdding(false)} onSaved={(g) => navigate(`/guests/${g.id}`)} />}
    </>
  );
}
