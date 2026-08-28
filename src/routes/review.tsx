import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, useEmployees, useNominations, useNominationsRealtime } from "@/lib/data";
import { HOD_METRICS, initials, type HodMetricKey, type Nomination } from "@/lib/ohse";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "HOD Behavioural Evaluation | WTP OHSE Awards" },
      {
        name: "description",
        content:
          "Heads of department rate qualified safety nominees across five behavioural metrics on a 1-5 scale to complete the 30% evaluation engine.",
      },
      { property: "og:title", content: "HOD Behavioural Evaluation | WTP OHSE Awards" },
      {
        property: "og:description",
        content:
          "Fast 30-second review cards with score sliders for duty of care, safe work behaviour, hazard reporting, speaking up and participation.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  useNominationsRealtime();
  const { data: nominations = [], isLoading } = useNominations();
  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useDepartments();

  const queue = nominations.filter((n) => n.status === "Approved for HOD Evaluation");

  return (
    <AppShell>
      <div className="mb-6">
        <p className="eyebrow">Engine B — 30% weight</p>
        <h1 className="mt-1 font-display text-3xl font-bold">HOD Behavioural Evaluation</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Rate each qualified nominee from 1 to 5 across the five behavioural metrics (30 points
          max). Saving all five ratings completes the nomination.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading review queue…</p>}
      {!isLoading && queue.length === 0 && (
        <div className="surface flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <ClipboardCheck className="size-5 text-success" />
          No nominees are currently awaiting HOD evaluation.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {queue.map((n) => (
          <ReviewCard
            key={n.id}
            nomination={n}
            nomineeName={employees.find((e) => e.id === n.nominee_id)?.full_name ?? "Nominee"}
            department={departments.find((d) => d.id === n.nominee_department_id)?.name ?? "—"}
          />
        ))}
      </div>
    </AppShell>
  );
}

function ReviewCard({
  nomination,
  nomineeName,
  department,
}: {
  nomination: Nomination;
  nomineeName: string;
  department: string;
}) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<HodMetricKey, number>>(() => {
    const initial = {} as Record<HodMetricKey, number>;
    for (const metric of HOD_METRICS) initial[metric.key] = nomination[metric.key] ?? 3;
    return initial;
  });
  const [citation, setCitation] = useState(nomination.citation_note ?? "");

  const hodTotal = HOD_METRICS.reduce((sum, m) => sum + scores[m.key], 0);
  const projected =
    nomination.hse_score !== null
      ? Math.round((nomination.hse_score * 0.7 + hodTotal) * 10) / 10
      : null;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("nominations")
        .update({
          hod_duty_of_care: scores.hod_duty_of_care,
          hod_safe_work_behavior: scores.hod_safe_work_behavior,
          hod_hazard_awareness: scores.hod_hazard_awareness,
          hod_speaking_up: scores.hod_speaking_up,
          hod_participation: scores.hod_participation,
          citation_note: citation.trim().slice(0, 500) || null,
          status: "Completed",
        })
        .eq("id", nomination.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${nomineeName} evaluated — nomination completed.`);
      queryClient.invalidateQueries({ queryKey: ["nominations"] });
    },
    onError: () => toast.error("Could not save the evaluation."),
  });

  return (
    <article className="surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
            {initials(nomineeName)}
          </span>
          <div>
            <h2 className="font-display text-base font-bold leading-tight">{nomineeName}</h2>
            <p className="text-[11px] text-muted-foreground">
              {nomination.nominee_position_title} · {department}
            </p>
          </div>
        </div>
        <StatusPill status={nomination.status} />
      </header>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {nomination.award_categories.join(" · ")}
      </p>

      <div className="mt-4 space-y-4">
        {HOD_METRICS.map((metric) => (
          <div key={metric.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{metric.label}</span>
              <span className="font-display font-bold text-accent">{scores[metric.key]}</span>
            </div>
            <Slider
              className="mt-2"
              min={1}
              max={5}
              step={1}
              value={[scores[metric.key]]}
              onValueChange={([value]) =>
                setScores((prev) => ({ ...prev, [metric.key]: value ?? 3 }))
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Label htmlFor={`citation-${nomination.id}`}>Citation note (optional)</Label>
        <Input
          id={`citation-${nomination.id}`}
          value={citation}
          maxLength={500}
          onChange={(e) => setCitation(e.target.value)}
          placeholder="Why does this nominee stand out?"
          className="mt-1.5"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-sm">
          <p className="font-semibold">
            HOD rating: <span className="text-accent">{hodTotal}/30</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            HSE {nomination.hse_score ?? "—"}/100 · Total score {projected ?? "pending HSE score"}
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
          <Save className="size-4" />
          {save.isPending ? "Saving…" : "Save evaluation"}
        </Button>
      </div>
    </article>
  );
}
