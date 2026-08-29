import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  Award,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { useDepartments, useEmployees, useNominations, useNominationsRealtime, useProgramSettings } from "@/lib/data";
import {
  MATURITY_STAGES,
  initials,
  totalScore,
  type Nomination,
  type NominationStatus,
} from "@/lib/ohse";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OHSE Safety Recognition Dashboard | WTP Awards" },
      { name: "description", content: "Live WTP OHSE recognition dashboard." },
      { property: "og:title", content: "OHSE Safety Recognition Dashboard | WTP Awards" },
    ],
  }),
  component: Dashboard,
});

const STAT_CONFIG = [
  { key: "total", label: "Total", icon: Users, tone: "bg-primary/10 text-primary border-primary/20" },
  { key: "pending", label: "Pending HSE", icon: Clock, tone: "bg-warning/15 text-warning-foreground border-warning/25" },
  { key: "approved", label: "HOD Queue", icon: CheckCircle2, tone: "bg-success/12 text-success border-success/20" },
  { key: "completed", label: "Completed", icon: Star, tone: "bg-accent/12 text-accent border-accent/20" },
  { key: "disqualified", label: "Disqualified", icon: AlertOctagon, tone: "bg-destructive/10 text-destructive border-destructive/20" },
] as const;

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className={cn("surface-hover flex items-center gap-3 p-4 border", tone)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <p className="font-display text-2xl font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

function Dashboard() {
  useNominationsRealtime();
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployees();
  const { data: nominations = [], isLoading } = useNominations();
  const { data: settings } = useProgramSettings();

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const countBy = (status: NominationStatus) => nominations.filter((n) => n.status === status).length;

  const completedNoms = nominations.filter((n) => n.status === "Completed" && totalScore(n) !== null);
  const topByPrefix = (prefix: string) =>
    completedNoms
      .filter((n) => n.award_categories.some((c) => c.startsWith(prefix)))
      .sort((a, b) => (totalScore(b) ?? 0) - (totalScore(a) ?? 0))[0];

  const wallChampions: { nom: Nomination; label: string; emoji: string }[] = [
    { nom: topByPrefix("Monthly"), label: "Monthly Champion", emoji: "🥇" },
    { nom: topByPrefix("Quarterly"), label: "Quarterly Champion", emoji: "🏆" },
    { nom: topByPrefix("Annual"), label: "Annual Champion", emoji: "⭐" },
  ].filter((x) => x.nom !== undefined) as { nom: Nomination; label: string; emoji: string }[];

  const stageIndex = Math.max(
    0,
    MATURITY_STAGES.indexOf((settings?.maturity_stage ?? "Proactive") as (typeof MATURITY_STAGES)[number]),
  );

  const stats: number[] = [
    nominations.length,
    countBy("Pending HSE Verification"),
    countBy("Approved for HOD Evaluation"),
    countBy("Completed"),
    countBy("Disqualified"),
  ];

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-foreground shadow-lg md:px-8 md:py-10">
        <div className="hatch-accent absolute inset-y-0 right-0 w-32 opacity-10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Live Visual Summary</p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
              Safety Recognition<br className="sm:hidden" /> Control Room
            </h1>
            <p className="mt-2 max-w-lg text-sm text-primary-foreground/65">
              Every nomination flows through the 70/30 dual-engine framework.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/nominate">+ Nominate</Link>
          </Button>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CONFIG.map((cfg, i) => (
          <StatCard key={cfg.key} icon={cfg.icon} label={cfg.label} value={stats[i]!} tone={cfg.tone} />
        ))}
      </section>

      {/* Department grid */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Department Nomination Grid</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((dept) => {
            const rows = nominations.filter((n) => n.nominee_department_id === dept.id);
            const uniqueNominees = new Set(rows.map((r) => r.nominee_id)).size;
            const hasApproved = rows.some((r) => r.status === "Approved for HOD Evaluation" || r.status === "Completed");
            const hasDisqualified = rows.some((r) => r.status === "Disqualified");
            return (
              <article key={dept.id} className="surface flex flex-col overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-secondary/80 to-secondary/40 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-sm font-bold">{dept.name}</h3>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{dept.batch_category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {hasApproved && <span className="size-2 rounded-full bg-success" title="Has approved nominees" />}
                    {hasDisqualified && <span className="size-2 rounded-full bg-destructive" title="Has disqualified nominees" />}
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {uniqueNominees}
                    </span>
                  </div>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {rows.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No nominations yet</p>
                  )}
                  {rows.map((n) => (
                    <NomineeRow
                      key={n.id}
                      nomination={n}
                      name={employeeById.get(n.nominee_id ?? "")?.full_name ?? undefined}
                    />
                  ))}
                </div>
              </article>
            );
          })}
          {isLoading && (
            <div className="surface col-span-full flex items-center justify-center p-8 text-sm text-muted-foreground">
              Loading nominations…
            </div>
          )}
        </div>
      </section>

      {/* Safety Wall + Culture Journey */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Safety Wall */}
        <div className="surface overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-5 py-4">
            <Award className="size-5 text-accent" />
            <h2 className="font-display text-lg font-bold">Executive Safety Wall</h2>
          </div>
          <div className="p-5">
            {wallChampions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="text-4xl">🏅</span>
                <p className="text-sm text-muted-foreground">
                  Champions appear once nominations are completed with both HSE scores and HOD ratings.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {wallChampions.map(({ nom: n, label, emoji }) => {
                  const name = employeeById.get(n.nominee_id ?? "")?.full_name ?? "Nominee";
                  const score = totalScore(n);
                  return (
                    <div key={n.id} className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-secondary/60 to-secondary/20 p-4 text-center transition-all hover:border-accent/40 hover:shadow-md">
                      <div className="absolute right-2 top-2 text-xl">{emoji}</div>
                      <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground shadow-md">
                        {initials(name)}
                      </div>
                      <p className="mt-3 font-display text-sm font-bold leading-tight">{name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{n.nominee_position_title}</p>
                      <span className="mt-2 inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">
                        {label} · {score}
                      </span>
                      {n.citation_note && (
                        <p className="mt-2 text-[11px] italic text-muted-foreground">"{n.citation_note}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Culture Journey */}
        <div className="surface overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-5 py-4">
            <TrendingUp className="size-5 text-accent" />
            <h2 className="font-display text-lg font-bold">Safety Culture Journey</h2>
          </div>
          <div className="p-5">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-700"
                style={{ width: `${((stageIndex + 1) / MATURITY_STAGES.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-right text-[11px] font-semibold text-accent">
              {Math.round(((stageIndex + 1) / MATURITY_STAGES.length) * 100)}% maturity
            </p>
            <ol className="mt-3 space-y-1.5">
              {MATURITY_STAGES.map((stage, i) => (
                <li
                  key={stage}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    i === stageIndex
                      ? "bg-accent/12 font-bold text-accent ring-1 ring-accent/25"
                      : i < stageIndex
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", i <= stageIndex ? "bg-accent" : "bg-border")} />
                  <span className="flex-1">{stage}</span>
                  {i === stageIndex && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Current</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function NomineeRow({ nomination, name }: { nomination: Nomination; name?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 transition-colors hover:bg-secondary/50">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{name ?? nomination.voter_name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{nomination.nominee_position_title}</p>
      </div>
      <StatusPill status={nomination.status} />
    </div>
  );
}
