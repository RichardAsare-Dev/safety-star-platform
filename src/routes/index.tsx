import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  Award,
  CheckCircle2,
  Clock,
  ShieldCheck,
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
      {
        name: "description",
        content:
          "Live WTP OHSE recognition dashboard: nominee counts by plant section, HSE verification status, safety champions and culture maturity tracking.",
      },
      { property: "og:title", content: "OHSE Safety Recognition Dashboard | WTP Awards" },
      {
        property: "og:description",
        content:
          "Track nominations, HSE verification outcomes and safety champions across every WTP plant section in real time.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="surface flex items-center gap-4 p-4">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg", tone)}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="font-display text-2xl font-bold">{value}</p>
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
  const countBy = (status: NominationStatus) =>
    nominations.filter((n) => n.status === status).length;

  const champions = nominations
    .map((n) => ({ n, score: totalScore(n) }))
    .filter((x) => x.score !== null && x.n.status !== "Disqualified")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  const stageIndex = Math.max(
    0,
    MATURITY_STAGES.indexOf((settings?.maturity_stage ?? "Proactive") as (typeof MATURITY_STAGES)[number]),
  );

  return (
    <AppShell>
      <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Live Visual Summary</p>
          <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">
            Safety Recognition Control Room
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every nomination flows through the 70/30 dual-engine framework — an HSE verification
            gate followed by HOD behavioural evaluation.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/nominate">Submit a nomination</Link>
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total nominations"
          value={nominations.length}
          tone="bg-primary/8 text-primary"
        />
        <StatCard
          icon={Clock}
          label="Pending HSE"
          value={countBy("Pending HSE Verification")}
          tone="bg-warning/20 text-warning-foreground"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved for HOD"
          value={countBy("Approved for HOD Evaluation")}
          tone="bg-success/12 text-success"
        />
        <StatCard
          icon={AlertOctagon}
          label="Disqualified"
          value={countBy("Disqualified")}
          tone="bg-destructive/10 text-destructive"
        />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Department Nomination Grid</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((dept) => {
            const rows = nominations.filter((n) => n.nominee_department_id === dept.id);
            const uniqueNominees = new Set(rows.map((r) => r.nominee_id)).size;
            return (
              <article key={dept.id} className="surface flex flex-col overflow-hidden">
                <header className="flex items-start justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                  <div>
                    <h3 className="font-display text-sm font-bold leading-tight">{dept.name}</h3>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {dept.batch_category}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                    {uniqueNominees} nominee(s)
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">No nominations yet.</p>
                  )}
                  {rows.map((n) => (
                    <NomineeRow key={n.id} nomination={n} name={employeeById.get(n.nominee_id ?? "")?.full_name} />
                  ))}
                </div>
              </article>
            );
          })}
          {isLoading && <p className="text-sm text-muted-foreground">Loading nominations…</p>}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="size-5 text-accent" />
            <h2 className="font-display text-xl font-bold">Executive Safety Wall</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {champions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Champions appear once HSE scores and HOD ratings are both recorded.
              </p>
            )}
            {champions.map(({ n, score }, index) => {
              const name = employeeById.get(n.nominee_id ?? "")?.full_name ?? "Nominee";
              return (
                <div
                  key={n.id}
                  className="rounded-lg border border-border bg-secondary/50 p-4 text-center"
                >
                  <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                    {initials(name)}
                  </div>
                  <p className="mt-3 font-display text-sm font-bold">{name}</p>
                  <p className="text-[11px] text-muted-foreground">{n.nominee_position_title}</p>
                  <p className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                    {index === 0 ? "Overall Champion" : `Rank ${index + 1}`} · {score}
                  </p>
                  {n.citation_note && (
                    <p className="mt-2 text-xs italic text-muted-foreground">“{n.citation_note}”</p>
                  )}
                  <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    {n.award_categories[0]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-5 text-accent" />
            <h2 className="font-display text-xl font-bold">Safety Culture Journey</h2>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${((stageIndex + 1) / MATURITY_STAGES.length) * 100}%` }}
            />
          </div>
          <ol className="mt-4 space-y-2">
            {MATURITY_STAGES.map((stage, i) => (
              <li
                key={stage}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
                  i === stageIndex
                    ? "bg-accent/10 font-bold text-accent"
                    : i < stageIndex
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    i <= stageIndex ? "bg-accent" : "bg-border",
                  )}
                />
                {stage}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </AppShell>
  );
}

function NomineeRow({ nomination, name }: { nomination: Nomination; name?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{name ?? nomination.voter_name}</p>
        <StatusPill status={nomination.status} />
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {nomination.nominee_position_title} · nominated by {nomination.voter_name}
      </p>
      {nomination.disqualification_reason && (
        <p className="mt-1 text-[11px] font-semibold text-destructive">
          {nomination.disqualification_reason}
        </p>
      )}
    </div>
  );
}
