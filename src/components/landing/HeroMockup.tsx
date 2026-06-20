"use client";

/**
 * A lightweight, decorative dashboard mock for the hero — pure SVG/markup so it
 * renders instantly and stays crisp at any size. Not interactive by design.
 */
export function HeroMockup() {
  const bars = [42, 58, 51, 70, 64, 82, 76, 90, 85, 96];
  return (
    <div className="glass animate-float rounded-2xl p-4 shadow-2xl">
      {/* window chrome */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
        <span className="ml-3 text-[10px] text-muted-foreground">
          Executive Dashboard · Northgate Logistics
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* score gauge */}
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Opportunity score</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-bold text-primary">72</span>
            <span className="mb-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold text-accent">
              Priority
            </span>
          </div>
          <svg viewBox="0 0 120 8" className="mt-2 w-full">
            <rect width="120" height="8" rx="4" fill="hsl(var(--secondary))" />
            <rect width="86" height="8" rx="4" fill="hsl(var(--primary))" />
          </svg>
        </div>

        {/* IRR */}
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Project IRR</p>
          <p className="mt-1 text-3xl font-bold text-accent">23.1%</p>
          <p className="text-[9px] text-muted-foreground">Payback 4.7 yrs</p>
        </div>

        {/* NPV */}
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Risk-adj NPV</p>
          <p className="mt-1 text-3xl font-bold text-primary">£2.2m</p>
          <p className="text-[9px] text-muted-foreground">25-yr revenue £18m</p>
        </div>
      </div>

      {/* chart */}
      <div className="mt-3 rounded-xl border border-border bg-card/60 p-3">
        <p className="mb-2 text-[9px] uppercase tracking-wide text-muted-foreground">
          Revenue stack over PPA term
        </p>
        <div className="flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 overflow-hidden rounded-t" style={{ height: `${h}%` }}>
              <div
                className="h-full w-full"
                style={{
                  background:
                    "linear-gradient(180deg,#22c55e, #0ea5e9 60%, transparent)",
                  opacity: 0.85,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          ["Carbon", "2.1kt"],
          ["Savings/yr", "£0.8m"],
          ["Solar", "3.0 MWp"],
          ["BESS", "4 MWh"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card/40 py-2">
            <p className="text-[8px] uppercase text-muted-foreground">{k}</p>
            <p className="text-xs font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
