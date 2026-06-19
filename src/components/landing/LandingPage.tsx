"use client";

import Link from "next/link";
import {
  ArrowRight,
  Sun,
  LayoutDashboard,
  ClipboardList,
  Target,
  Calculator,
  GitCompareArrows,
  KanbanSquare,
  Map,
  ShieldAlert,
  Zap,
  BatteryCharging,
  Leaf,
  Plug,
  Gauge,
  FileBarChart,
  Sparkles,
  TrendingUp,
  Building2,
} from "lucide-react";
import { HeroMockup } from "./HeroMockup";

const MODULES = [
  { icon: LayoutDashboard, title: "Executive Dashboard", desc: "Score, NPV, IRR, payback, carbon and recommended action at a glance." },
  { icon: ClipboardList, title: "Site Intake", desc: "Five-section intake for client, site, commercial, technology and ESG." },
  { icon: Target, title: "Scoring Engine", desc: "Weighted 0–100 score across seven explainable categories." },
  { icon: Calculator, title: "Financial Model", desc: "NPV, IRR, DSCR, risk-adjusted returns and 25-year cash flows." },
  { icon: GitCompareArrows, title: "Scenario Engine", desc: "Base, conservative, downside, upside and aggressive cases." },
  { icon: KanbanSquare, title: "Opportunity Pipeline", desc: "Nine-stage pipeline from lead to operational asset." },
  { icon: Map, title: "European Market Map", desc: "Nine markets ranked by attractiveness with entry strategy." },
  { icon: ShieldAlert, title: "Risk Matrix", desc: "Likelihood × impact heat-map with mitigations." },
];

const REVENUE_STREAMS = [
  { icon: Zap, title: "PPAs", desc: "10–25 year fixed price + inflation, zero-capex client offers." },
  { icon: BatteryCharging, title: "Storage & flexibility", desc: "BESS arbitrage, DSR, capacity and balancing services." },
  { icon: Leaf, title: "Carbon value", desc: "Verified abatement monetised through digital MRV." },
  { icon: Plug, title: "EV & optimisation", desc: "EV charging, BEMS/HEMS and behind-the-meter optimisation." },
  { icon: Gauge, title: "Developer margin", desc: "Recurring 1p/kWh margin on every delivered unit." },
  { icon: FileBarChart, title: "ESG / MRV", desc: "ISSB/CSRD-aligned reporting and Scope 1/2/3 disclosure." },
];

const STATS = [
  { value: "12–25%+", label: "Target portfolio IRR" },
  { value: "10–25 yr", label: "Contracted PPA revenue" },
  { value: "9", label: "European markets" },
  { value: "8", label: "Integrated modules" },
];

const TICKER = [
  "ETS expansion", "ISSB / CSRD reporting", "Grid constraints", "Flexible demand",
  "Zero-capex offers", "Digital MRV", "Risk-adjusted NPV", "Portfolio aggregation",
  "Scope 3 pressure", "PPA structuring", "BESS arbitrage", "Carbon value",
];

const MARKETS = [
  ["United Kingdom", "88"], ["Germany", "84"], ["Netherlands", "82"],
  ["Spain", "80"], ["Ireland", "78"], ["Italy", "76"],
  ["Nordics", "74"], ["Poland", "72"], ["France", "70"],
];

const JOURNEY = [
  { step: "01", title: "Developer", desc: "Originate and structure zero-capex PPA opportunities." },
  { step: "02", title: "Co-investor", desc: "Take equity alongside strategic finance partners." },
  { step: "03", title: "Platform", desc: "Aggregate sites, data and MRV into a scalable platform." },
  { step: "04", title: "Asset owner", desc: "Own hybrid solar-battery portfolios with diversified income." },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="aurora-blob left-[-10%] top-[-10%] h-[480px] w-[480px] bg-primary/30" />
        <div className="aurora-blob right-[-8%] top-[6%] h-[420px] w-[420px] bg-accent/30" style={{ animationDelay: "-6s" }} />
        <div className="aurora-blob left-[30%] top-[40%] h-[460px] w-[460px] bg-violet-500/20" style={{ animationDelay: "-12s" }} />
        <div className="absolute inset-0 grid-overlay" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50">
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full glass px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Sun className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Lightsummit</p>
              <p className="text-[9px] text-muted-foreground">Opportunity Engine</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="hover:text-foreground">Platform</a>
            <a href="#revenue" className="hover:text-foreground">Revenue</a>
            <a href="#markets" className="hover:text-foreground">Markets</a>
            <a href="#journey" className="hover:text-foreground">Strategy</a>
          </nav>
          <Link
            href="/app"
            className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Launch Engine
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-16 lg:grid-cols-2 lg:pt-24">
        <div className="animate-fade-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Decentralised energy · carbon · MRV · flexibility
          </div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Assess every <span className="text-gradient">energy opportunity</span> with institutional rigour.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            The Lightsummit Opportunity Assessing Engine evaluates European
            commercial, industrial and data-centre sites for solar, storage,
            flexibility, PPAs and carbon value — scoring, modelling and ranking
            each one in seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 animate-pulse-ring"
            >
              Launch the engine
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#platform"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary/60"
            >
              Explore the platform
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <HeroMockup />
        </div>
      </section>

      {/* Ticker */}
      <div className="border-y border-border/60 bg-background/40 py-3">
        <div className="relative flex overflow-hidden">
          <div className="marquee-track flex shrink-0 items-center gap-8 whitespace-nowrap pr-8 text-sm text-muted-foreground">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Platform modules */}
      <section id="platform" className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="The platform"
          title="Eight modules, one decision engine"
          subtitle="From raw site intake to investment-committee-ready output — every stage of opportunity assessment in a single, integrated workflow."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.title} className="card-glow rounded-2xl border border-border bg-card/50 p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{m.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Revenue streams */}
      <section id="revenue" className="border-y border-border/60 bg-background/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            eyebrow="Diversified income"
            title="Six revenue streams, stacked"
            subtitle="Predictable contracted revenue plus optionality — the engine models each stream and the recurring developer margin across the full asset life."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REVENUE_STREAMS.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.title} className="card-glow flex gap-4 rounded-2xl border border-border bg-card/50 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{r.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section id="markets" className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="European coverage"
          title="Nine markets, ranked and ready"
          subtitle="Attractiveness scoring across grid constraint, PPA maturity, carbon pressure, BESS opportunity and regulatory complexity."
        />
        <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {MARKETS.map(([country, score], i) => (
            <div
              key={country}
              className="card-glow flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium">{country}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${score}%` }} />
                </div>
                <span className="w-7 text-right text-sm font-bold text-primary">{score}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Strategy journey */}
      <section id="journey" className="border-y border-border/60 bg-background/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading
            eyebrow="The strategy"
            title="From developer to asset owner"
            subtitle="An asset-light path that compounds: originate, co-invest, build the platform, then own diversified hybrid portfolios."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {JOURNEY.map((j, i) => (
              <div key={j.step} className="relative rounded-2xl border border-border bg-card/50 p-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-2xl font-bold text-gradient">{j.step}</span>
                  {i < JOURNEY.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  {i === 0 ? <Building2 className="h-4 w-4 text-primary" /> : i === 3 ? <TrendingUp className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                  <h3 className="text-sm font-semibold">{j.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{j.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border glass p-10 text-center sm:p-16">
          <div className="aurora-blob left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-primary/30" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Turn sites into a <span className="text-gradient">contracted portfolio</span>.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
            Score, model and prioritise your next decentralised energy
            opportunity in seconds. Everything runs locally on sample data — no
            sign-up required.
          </p>
          <div className="relative mt-8 flex justify-center">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Launch the engine
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            <span>Lightsummit Opportunity Assessing Engine</span>
          </div>
          <p>Figures illustrative · not financial advice · built for assessment.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
    </div>
  );
}
