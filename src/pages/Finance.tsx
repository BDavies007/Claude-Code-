import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { currency } from "@/lib/format";

const transactions = [
  { id: "t1", date: "2026-05-10", desc: "Stripe payout", amount: 4820, category: "Revenue" },
  { id: "t2", date: "2026-05-09", desc: "AWS", amount: -312.4, category: "Infra" },
  { id: "t3", date: "2026-05-08", desc: "Northwind retainer", amount: 8500, category: "Revenue" },
  { id: "t4", date: "2026-05-07", desc: "Contractor — design", amount: -1800, category: "Payroll" },
];

export function Finance() {
  const income = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-1 text-sm text-fg-muted">Income, expenses, and budget pulse.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Income (week)" value={currency(income)} tone="success" />
        <Stat label="Expenses (week)" value={currency(expense)} tone="danger" />
        <Stat label="Net" value={currency(income + expense)} tone={income + expense >= 0 ? "success" : "danger"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <span className="text-xs text-fg-muted">Manual entry — plug Stripe / Plaid later</span>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium">{t.desc}</div>
                  <div className="text-xs text-fg-muted">
                    {t.date} · {t.category}
                  </div>
                </div>
                <div className={"text-sm font-semibold " + (t.amount >= 0 ? "text-success" : "text-danger")}>
                  {t.amount >= 0 ? "+" : ""}
                  {currency(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
