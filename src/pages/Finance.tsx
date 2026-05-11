import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { currency } from "@/lib/format";
import type { Transaction } from "@/types/atlas";

const CATEGORIES = ["Revenue", "Payroll", "Infra", "Marketing", "Tools", "Other"];

export function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = () => window.atlas.db.finance.list().then(setTransactions);

  useEffect(() => {
    load();
  }, []);

  const income = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-1 text-sm text-fg-muted">Income, expenses, and budget pulse.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Income" value={currency(income)} tone="success" />
        <Stat label="Expenses" value={currency(expense)} tone="danger" />
        <Stat label="Net" value={currency(income + expense)} tone={income + expense >= 0 ? "success" : "danger"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add transaction</CardTitle>
        </CardHeader>
        <CardBody>
          <AddTransactionForm onAdded={load} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <span className="text-xs text-fg-muted">{transactions.length} total</span>
        </CardHeader>
        <CardBody>
          {transactions.length === 0 ? (
            <p className="text-sm text-fg-muted">No transactions yet — add one above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium">{t.desc}</div>
                    <div className="text-xs text-fg-muted">
                      {t.date} · {t.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        "text-sm font-semibold " + (t.amount >= 0 ? "text-success" : "text-danger")
                      }
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {currency(t.amount)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await window.atlas.db.finance.delete(t.id);
                        load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function AddTransactionForm({ onAdded }: { onAdded: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !amount) return;
    setBusy(true);
    await window.atlas.db.finance.add({
      id: crypto.randomUUID(),
      date,
      desc,
      amount: Number(amount),
      category,
    });
    setDesc("");
    setAmount("");
    setBusy(false);
    onAdded();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-5">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        type="text"
        placeholder="Description"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="md:col-span-2 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        type="number"
        step="0.01"
        placeholder="Amount (+/-)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      >
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <div className="md:col-span-5">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}
